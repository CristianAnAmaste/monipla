const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const assert = require('node:assert/strict');
const {
  DIAS_PREDETERMINADOS,
  parsearArgumentos,
  calcularVentanaReciente,
  ejecutarReconciliacion,
} = require('../scripts/reconcile-chanchitos-agroclima');

const NTC_UUID = '9373a0db-6a2d-48c9-883a-f23e6f26753b';

function crearCandidato(overrides = {}) {
  return {
    id_monitoreo: 439,
    gen_fundo: 9,
    fecha_monitoreo: '2026-08-11',
    horas_frio_actuales: null,
    dias_grado_actuales: null,
    estacion_uuid_actual: null,
    nombre_estacion_actual: null,
    fecha_corte_actual: null,
    semana_iso_actual: null,
    temporada_actual: null,
    observacion_actual: 'Sin datos agroclimaticos para la fecha de corte.',
    ...overrides,
  };
}

function crearSnapshot(overrides = {}) {
  return {
    horasFrioAcumuladas: 12.3456,
    diasGradoAcumulados: 4.3611,
    estacionMeteoUuid: NTC_UUID,
    nombreEstacionMeteo: 'NTC',
    fechaCorteAgroclima: '2026-08-10',
    semanaIsoCorte: 33,
    temporadaAgroclima: '2026',
    agroclimaObservacion: 'Agroclima OK desde Meteo FEAL.',
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
    listarMonitoreosChanchitosPendientesReconciliacion: async (ventana) => {
      consultas.push(ventana);
      return candidatos;
    },
    actualizarSnapshotChanchitosSiCoincide: async (...args) => {
      actualizaciones.push(args);
      return filasActualizadas;
    },
  };
  const agroclimaService = {
    calcularSnapshotSeguroPorFundo: async (genFundo, fechaMuestra) => {
      consultas.push({ genFundo, fechaMuestra });
      return snapshot;
    },
  };
  const logger = {
    info: (...args) => logs.push(['info', ...args]),
    error: (...args) => logs.push(['error', ...args]),
  };

  return { repository, agroclimaService, logger, actualizaciones, consultas, logs };
}

function opciones(overrides = {}) {
  return {
    apply: false,
    dias: DIAS_PREDETERMINADOS,
    ...overrides,
  };
}

test('usa dry-run y ventana predeterminada de 60 dias en America/Santiago', () => {
  assert.deepEqual(parsearArgumentos([]), opciones());
  assert.deepEqual(parsearArgumentos(['--days=15', '--apply']), { apply: true, dias: 15 });
  assert.throws(() => parsearArgumentos(['--days=0']), /entero positivo/);
  assert.throws(() => parsearArgumentos(['--id=439']), /argumento no reconocido/);

  assert.deepEqual(
    calcularVentanaReciente(60, new Date('2026-08-13T02:30:00.000Z')),
    { fechaDesde: '2026-06-14', fechaHasta: '2026-08-12' }
  );
  assert.deepEqual(
    calcularVentanaReciente(7, new Date('2026-08-13T12:00:00.000Z')),
    { fechaDesde: '2026-08-07', fechaHasta: '2026-08-13' }
  );
});

test('dry-run de SIN_DATOS a OK no escribe y reporta valores con dos decimales', async () => {
  const dependencias = crearDependencias();

  const resumen = await ejecutarReconciliacion(
    opciones(),
    dependencias,
    new Date('2026-08-13T12:00:00.000Z')
  );
  const registro = dependencias.logs.find(([, evento]) => evento.endsWith('[REGISTRO]'));

  assert.deepEqual(dependencias.actualizaciones, []);
  assert.deepEqual(dependencias.consultas[0], { fechaDesde: '2026-06-15', fechaHasta: '2026-08-13' });
  assert.deepEqual(dependencias.consultas[1], { genFundo: 9, fechaMuestra: '2026-08-11' });
  assert.equal(resumen.actualizables, 1);
  assert.equal(registro[2].fundo, 9);
  assert.equal(registro[2].hf_propuesta, '12.35');
  assert.equal(registro[2].dg_propuesta, '4.36');
  assert.equal(registro[2].accion, 'ACTUALIZARIA');
});

test('apply actualiza un SIN_DATOS a OK con exclusivamente los ocho campos del snapshot', async () => {
  const dependencias = crearDependencias();

  const resumen = await ejecutarReconciliacion(opciones({ apply: true }), dependencias);

  assert.equal(resumen.actualizados, 1);
  assert.equal(dependencias.actualizaciones.length, 1);
  const [idMonitoreo, snapshot, actual] = dependencias.actualizaciones[0];
  assert.equal(idMonitoreo, 439);
  assert.deepEqual(Object.keys(snapshot).sort(), [
    'agroclimaObservacion',
    'diasGradoAcumulados',
    'estacionMeteoUuid',
    'fechaCorteAgroclima',
    'horasFrioAcumuladas',
    'nombreEstacionMeteo',
    'semanaIsoCorte',
    'temporadaAgroclima',
  ]);
  assert.equal(snapshot.horasFrioAcumuladas, 12.35);
  assert.equal(snapshot.diasGradoAcumulados, 4.36);
  assert.equal(actual.diasGradoAcumulados, null);
});

test('PARCIAL mejora a OK y se actualiza', async () => {
  const dependencias = crearDependencias({
    candidatos: [crearCandidato({
      horas_frio_actuales: 10,
      observacion_actual: 'Agroclima parcial. Cobertura: 50 dias con datos y 10 sin datos.',
    })],
  });

  const resumen = await ejecutarReconciliacion(opciones({ apply: true }), dependencias);

  assert.equal(resumen.actualizados, 1);
  assert.equal(dependencias.actualizaciones.length, 1);
});

test('PARCIAL mejora a una cobertura parcial superior', async () => {
  const dependencias = crearDependencias({
    candidatos: [crearCandidato({
      horas_frio_actuales: 10,
      observacion_actual: 'Agroclima parcial. Cobertura: 50 dias con datos y 10 sin datos.',
    })],
    snapshot: crearSnapshot({
      diasGradoAcumulados: null,
      agroclimaObservacion: 'Agroclima parcial. Cobertura: 60 dias con datos y 5 sin datos.',
    }),
  });

  const resumen = await ejecutarReconciliacion(opciones({ apply: true }), dependencias);

  assert.equal(resumen.actualizados, 1);
  assert.equal(dependencias.actualizaciones.length, 1);
});

test('PARCIAL con cobertura inferior no se escribe', async () => {
  const dependencias = crearDependencias({
    candidatos: [crearCandidato({
      horas_frio_actuales: 10,
      observacion_actual: 'Agroclima parcial. Cobertura: 60 dias con datos y 5 sin datos.',
    })],
    snapshot: crearSnapshot({
      diasGradoAcumulados: null,
      agroclimaObservacion: 'Agroclima parcial. Cobertura: 50 dias con datos y 10 sin datos.',
    }),
  });

  const resumen = await ejecutarReconciliacion(opciones({ apply: true }), dependencias);

  assert.equal(resumen.noDegradados, 1);
  assert.deepEqual(dependencias.actualizaciones, []);
});

function obtenerConsultaDiaria() {
  const contenido = fs.readFileSync(
    path.join(__dirname, '..', 'src', 'repositories', 'agroclima.repository.js'),
    'utf8'
  );
  const inicio = contenido.indexOf('async listarMonitoreosChanchitosPendientesReconciliacion');
  const fin = contenido.indexOf('async actualizarSnapshotChanchitosSiCoincide', inicio);
  return contenido.slice(inicio, fin);
}

test('un SIN_DATOS sin estacion vigente no aparece como candidato diario', () => {
  const consulta = obtenerConsultaDiaria();

  assert.match(consulta, /AND EXISTS \(\s+SELECT 1\s+FROM dbo\.MONIPLA_FUNDO_ESTACION_METEO fem\s+WHERE fem\.gen_fundo = cab\.gen_fundo\s+AND fem\.activo = 1/s);
});

test('un SIN_DATOS aparece cuando existe una estacion vigente para su fundo', () => {
  const consulta = obtenerConsultaDiaria();

  assert.match(consulta, /AND EXISTS \([\s\S]*?fem\.gen_fundo = cab\.gen_fundo[\s\S]*?fem\.activo = 1[\s\S]*?fem\.fecha_desde <= cab\.fecha_monitoreo[\s\S]*?fem\.fecha_hasta IS NULL OR fem\.fecha_hasta >= cab\.fecha_monitoreo/);
  assert.match(consulta, /UPPER\(cab\.agroclima_observacion\) LIKE '%SIN DATOS%'/);
});

test('una estacion futura no habilita un monitoreo anterior', () => {
  const consulta = obtenerConsultaDiaria();

  assert.match(consulta, /fem\.fecha_desde <= cab\.fecha_monitoreo/);
});

test('una estacion vencida no habilita el monitoreo', () => {
  const consulta = obtenerConsultaDiaria();

  assert.match(consulta, /\(fem\.fecha_hasta IS NULL OR fem\.fecha_hasta >= cab\.fecha_monitoreo\)/);
});

test('la consulta diaria conserva PARCIAL y excluye OK y SIN_ESTACION', () => {
  const consulta = obtenerConsultaDiaria();

  assert.match(consulta, /cab\.fecha_monitoreo >= @fechaDesde/);
  assert.match(consulta, /cab\.fecha_monitoreo <= @fechaHasta/);
  assert.match(consulta, /UPPER\(ISNULL\(cab\.agroclima_observacion, ''\)\) NOT LIKE '%SIN ESTACION%'/);
  assert.match(consulta, /\(cab\.horas_frio_acumuladas IS NOT NULL OR cab\.dias_grado_acumulados IS NOT NULL\)\s+AND UPPER\(ISNULL\(cab\.agroclima_observacion, ''\)\) LIKE '%PARCIAL%'/);
  assert.doesNotMatch(consulta, /id_catalogo_sdp/);
});

test('un error de MeteoFEAL no escribe', async () => {
  const dependencias = crearDependencias({
    snapshot: crearSnapshot({
      horasFrioAcumuladas: null,
      diasGradoAcumulados: null,
      estacionMeteoUuid: null,
      nombreEstacionMeteo: null,
      fechaCorteAgroclima: null,
      semanaIsoCorte: null,
      temporadaAgroclima: null,
      agroclimaObservacion: 'Error al consultar Meteo FEAL.',
    }),
  });

  const resumen = await ejecutarReconciliacion(opciones({ apply: true }), dependencias);

  assert.equal(resumen.errores, 1);
  assert.deepEqual(dependencias.actualizaciones, []);
});

test('la guardia optimista no sobreescribe un cambio concurrente', async () => {
  const dependencias = crearDependencias({ filasActualizadas: 0 });

  const resumen = await ejecutarReconciliacion(opciones({ apply: true }), dependencias);

  assert.equal(dependencias.actualizaciones.length, 1);
  assert.equal(resumen.actualizados, 0);
  assert.equal(resumen.noDegradados, 1);
  assert.ok(dependencias.logs.some(([, evento]) => evento.endsWith('[CONCURRENCIA]')));
});
