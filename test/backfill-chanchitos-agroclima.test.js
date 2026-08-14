const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const assert = require('node:assert/strict');
const {
  parsearArgumentos,
  clasificarPropuesta,
  formatearDecimal,
  calcularFechaCorteEsperada,
  ejecutarBackfill,
} = require('../scripts/backfill-chanchitos-agroclima');

const NTC_UUID = '9373a0db-6a2d-48c9-883a-f23e6f26753b';

function crearCandidato(overrides = {}) {
  return {
    id_monitoreo: 441,
    gen_fundo: 8,
    fecha_monitoreo: '2026-08-13',
    horas_frio_actuales: null,
    dias_grado_actuales: null,
    estacion_uuid_actual: null,
    nombre_estacion_actual: null,
    fecha_corte_actual: null,
    semana_iso_actual: null,
    temporada_actual: null,
    observacion_actual: 'Sin datos agroclimaticos para la fecha de corte.',
    id_catalogo_sdp: null,
    ...overrides,
  };
}

function crearSnapshot(overrides = {}) {
  return {
    horasFrioAcumuladas: null,
    diasGradoAcumulados: 19.1667,
    estacionMeteoUuid: NTC_UUID,
    nombreEstacionMeteo: 'NTC',
    fechaCorteAgroclima: '2026-08-12',
    semanaIsoCorte: 33,
    temporadaAgroclima: '2026',
    agroclimaObservacion: 'Agroclima OK desde Meteo FEAL.',
    ...overrides,
  };
}

function opciones(overrides = {}) {
  return {
    apply: false,
    dryRun: true,
    confirmarTodos: false,
    ids: [441],
    fechaDesde: null,
    fechaHasta: null,
    genFundo: null,
    limit: null,
    ...overrides,
  };
}

function crearDependencias({
  candidatos = [crearCandidato()],
  snapshot = crearSnapshot(),
  filasActualizadas = 1,
} = {}) {
  const actualizaciones = [];
  const consultas = [];
  const logs = [];
  const repository = {
    listarMonitoreosChanchitosPendientesBackfill: async (filtros) => {
      consultas.push({ tipo: 'candidatos', filtros });
      return candidatos;
    },
    actualizarSnapshotChanchitosPendiente: async (...args) => {
      actualizaciones.push(args);
      return filasActualizadas;
    },
  };
  const agroclimaService = {
    calcularSnapshotSeguroPorFundo: async (genFundo, fechaMuestra) => {
      consultas.push({ tipo: 'agroclima', genFundo, fechaMuestra });
      return snapshot;
    },
  };
  const logger = {
    info: (...args) => logs.push(['info', ...args]),
    error: (...args) => logs.push(['error', ...args]),
  };
  return { repository, agroclimaService, logger, actualizaciones, consultas, logs };
}

test('usa dry-run por defecto, acepta IDs explicitos y exige confirmacion para apply masivo', () => {
  assert.deepEqual(parsearArgumentos(['--ids=441,442,441', '--fundo=8', '--limit=2']), opciones({
    ids: [441, 442], genFundo: 8, limit: 2,
  }));
  assert.deepEqual(parsearArgumentos(['--ids', '441', '--apply']), opciones({ apply: true, dryRun: false }));
  assert.throws(() => parsearArgumentos(['--apply', '--from=2026-08-01', '--to=2026-08-13']), /confirmar-todos/);
  assert.throws(() => parsearArgumentos(['--apply', '--dry-run', '--ids=441']), /no se pueden combinar/);
});

test('historico sin id_catalogo_sdp y con observacion SIN_DATOS calcula por fundo sin escribir en dry-run', async () => {
  const dependencias = crearDependencias();
  const resumen = await ejecutarBackfill(opciones(), dependencias);
  const registro = dependencias.logs.find(([, evento]) => evento.endsWith('[REGISTRO]'));

  assert.deepEqual(dependencias.actualizaciones, []);
  assert.deepEqual(dependencias.consultas[1], { tipo: 'agroclima', genFundo: 8, fechaMuestra: '2026-08-13' });
  assert.equal(resumen.actualizables, 1);
  assert.equal(registro[2].fecha_corte_esperada, '2026-08-12');
  assert.equal(registro[2].dg_propuesta, '19.17');
  assert.equal(registro[2].estado, 'ACTUALIZABLE');
});

test('registros con HF o DG ya existentes se clasifican YA_COMPLETO y no llaman MeteoFEAL', async () => {
  for (const candidato of [
    crearCandidato({ horas_frio_actuales: 1 }),
    crearCandidato({ dias_grado_actuales: 1 }),
  ]) {
    const dependencias = crearDependencias({ candidatos: [candidato] });
    const resumen = await ejecutarBackfill(opciones(), dependencias);
    assert.equal(resumen.yaCompletos, 1);
    assert.equal(dependencias.consultas.length, 1);
    assert.deepEqual(dependencias.actualizaciones, []);
  }
});

test('acepta cortes de grados dia y horas frio cuando existe estacion y fecha de corte valida', () => {
  assert.equal(clasificarPropuesta(crearSnapshot()), 'ACTUALIZABLE');
  assert.equal(clasificarPropuesta(crearSnapshot({ horasFrioAcumuladas: 431.53, diasGradoAcumulados: null })), 'ACTUALIZABLE');
  assert.equal(calcularFechaCorteEsperada('2026-08-13'), '2026-08-12');
  assert.equal(formatearDecimal(19.1667), '19.17');
});

test('conserva la estacion secundaria elegida por el servicio compartido', async () => {
  const dependencias = crearDependencias({
    snapshot: crearSnapshot({ nombreEstacionMeteo: 'Respaldo NTC' }),
  });
  await ejecutarBackfill(opciones(), dependencias);
  const registro = dependencias.logs.find(([, evento]) => evento.endsWith('[REGISTRO]'));
  assert.equal(registro[2].estacion_propuesta, 'Respaldo NTC');
});

test('clasifica SIN_DATOS, SIN_ESTACION, NO_APLICA y ERROR sin actualizar', async () => {
  const casos = [
    ['SIN_DATOS', crearSnapshot({ diasGradoAcumulados: null, estacionMeteoUuid: null, nombreEstacionMeteo: null, fechaCorteAgroclima: null, agroclimaObservacion: 'Sin datos agroclimaticos para la fecha de corte.' })],
    ['SIN_ESTACION', crearSnapshot({ diasGradoAcumulados: null, estacionMeteoUuid: null, nombreEstacionMeteo: null, fechaCorteAgroclima: null, agroclimaObservacion: 'Sin estacion meteorologica asociada al fundo.' })],
    ['NO_APLICA', crearSnapshot({ diasGradoAcumulados: null, estacionMeteoUuid: null, nombreEstacionMeteo: null, fechaCorteAgroclima: null, agroclimaObservacion: 'No corresponde calcular horas frio ni grados dia para la fecha de corte.' })],
    ['ERROR', crearSnapshot({ diasGradoAcumulados: null, estacionMeteoUuid: null, nombreEstacionMeteo: null, fechaCorteAgroclima: null, agroclimaObservacion: 'Error al consultar Meteo FEAL.' })],
  ];

  for (const [estado, snapshot] of casos) {
    const dependencias = crearDependencias({ snapshot });
    const resumen = await ejecutarBackfill(opciones(), dependencias);
    assert.equal(resumen.actualizables, 0);
    assert.deepEqual(dependencias.actualizaciones, []);
    assert.equal(resumen[estado === 'SIN_DATOS' ? 'sinDatos' : estado === 'SIN_ESTACION' ? 'sinEstacion' : estado === 'NO_APLICA' ? 'noAplica' : 'errores'], 1);
  }
});

test('apply usa guardia atomica por ID, fecha y ambas metricas pendientes; cero filas es CAMBIO_CONCURRENTE', async () => {
  const dependencias = crearDependencias({ filasActualizadas: 0 });
  const resumen = await ejecutarBackfill(opciones({ apply: true, dryRun: false }), dependencias);

  assert.equal(resumen.cambiosConcurrentes, 1);
  assert.equal(resumen.actualizables, 0);
  assert.deepEqual(dependencias.actualizaciones[0].slice(0, 2), [441, '2026-08-13']);
});

test('el SQL selecciona solo cabeceras pendientes y el UPDATE toca exclusivamente ocho campos agroclimaticos', () => {
  const contenido = fs.readFileSync(
    path.join(__dirname, '..', 'src', 'repositories', 'agroclima.repository.js'),
    'utf8',
  ).replace(/\r\n?/g, '\n');
  const coincidenciaLista = contenido.match(
    /async\s+listarMonitoreosChanchitosPendientesBackfill\b([\s\S]*?)\n\s*async\s+listarMonitoreosChanchitosPendientesReconciliacion\b/,
  );
  const coincidenciaUpdate = contenido.match(
    /async\s+actualizarSnapshotChanchitosPendiente\b([\s\S]*?)\n\s*async\s+createRequest\b/,
  );

  assert.ok(coincidenciaLista, 'No se pudo localizar listarMonitoreosChanchitosPendientesBackfill');
  assert.ok(coincidenciaUpdate, 'No se pudo localizar actualizarSnapshotChanchitosPendiente');

  const consultaLista = coincidenciaLista[0];
  const consultaUpdate = coincidenciaUpdate[0];

  assert.match(consultaLista, /FROM dbo\.MONI_CABECERAMONITOREO cab/);
  assert.match(consultaLista, /cab\.horas_frio_acumuladas IS NULL/);
  assert.match(consultaLista, /cab\.dias_grado_acumulados IS NULL/);
  assert.doesNotMatch(consultaLista, /id_catalogo_sdp/);
  assert.match(consultaUpdate, /WHERE id_monitoreo = @idMonitoreo\s+AND fecha_monitoreo = @fechaMonitoreo\s+AND horas_frio_acumuladas IS NULL\s+AND dias_grado_acumulados IS NULL/s);
  for (const columna of ['horas_frio_acumuladas', 'dias_grado_acumulados', 'estacion_meteo_uuid', 'nombre_estacion_meteo', 'fecha_corte_agroclima', 'semana_iso_corte', 'temporada_agroclima', 'agroclima_observacion']) {
    assert.match(consultaUpdate, new RegExp(`${columna} = @`));
  }
  assert.doesNotMatch(consultaUpdate, /id_catalogo_sdp\s*=/);
  assert.doesNotMatch(consultaUpdate, /\bSDP\s*=/i);
  assert.doesNotMatch(consultaUpdate, /\bCSG\s*=/i);
});
