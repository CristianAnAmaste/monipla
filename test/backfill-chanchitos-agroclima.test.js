const test = require('node:test');
const assert = require('node:assert/strict');
const {
  parsearArgumentos,
  decidirAccion,
  esMejorParcial,
  formatearDecimal,
  calcularFechaCorteEsperada,
  ejecutarBackfill,
} = require('../scripts/backfill-chanchitos-agroclima');

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
    id_catalogo_sdp: null,
    ...overrides,
  };
}

function crearSnapshot(overrides = {}) {
  return {
    horasFrioAcumuladas: null,
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

function crearDependencias({ candidato = crearCandidato(), snapshot = crearSnapshot() } = {}) {
  const actualizaciones = [];
  const consultas = [];
  const logs = [];
  const repository = {
    listarMonitoreosChanchitosAgroclima: async (opciones) => {
      consultas.push(opciones);
      return [candidato];
    },
    actualizarSnapshotChanchitosSiCoincide: async (...args) => {
      actualizaciones.push(args);
      return 1;
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
    idMonitoreo: 439,
    fechaDesde: null,
    fechaHasta: null,
    genFundo: null,
    ...overrides,
  };
}

test('acepta --id=439 y bloquea combinaciones ambiguas', () => {
  assert.deepEqual(parsearArgumentos(['--id=439']), opciones());
  assert.deepEqual(parsearArgumentos(['--from=2026-08-01', '--to=2026-08-31', '--fundo=9']), {
    apply: false,
    idMonitoreo: null,
    fechaDesde: '2026-08-01',
    fechaHasta: '2026-08-31',
    genFundo: 9,
  });
  assert.throws(() => parsearArgumentos(['--id=439', '--fundo=9']), /no se combina/);
  assert.throws(() => parsearArgumentos(['--apply']), /requiere --id o un rango/);
});

test('historico sin id_catalogo_sdp usa gen_fundo y dry-run no escribe', async () => {
  const dependencias = crearDependencias();

  const resumen = await ejecutarBackfill(opciones(), dependencias);
  const registro = dependencias.logs.find(([, evento]) => evento.endsWith('[REGISTRO]'));

  assert.deepEqual(dependencias.actualizaciones, []);
  assert.deepEqual(dependencias.consultas.at(1), { genFundo: 9, fechaMuestra: '2026-08-11' });
  assert.equal(resumen.actualizables, 1);
  assert.equal(registro[2].estacion_propuesta, 'NTC');
  assert.equal(registro[2].dg_actual, 'NULL');
  assert.equal(registro[2].dg_propuesta, '4.36');
  assert.equal(registro[2].fecha_corte, '2026-08-10');
  assert.equal(registro[2].accion, 'ACTUALIZARIA');
});

test('permite SIN_DATOS a OK y PARCIAL a OK', () => {
  const propuestoOk = crearSnapshot();
  const sinDatos = crearSnapshot({
    diasGradoAcumulados: null,
    estacionMeteoUuid: null,
    nombreEstacionMeteo: null,
    fechaCorteAgroclima: null,
    semanaIsoCorte: null,
    temporadaAgroclima: null,
    agroclimaObservacion: 'Sin datos agroclimaticos para la fecha de corte.',
  });
  const parcial = crearSnapshot({
    horasFrioAcumuladas: 10,
    diasGradoAcumulados: null,
    agroclimaObservacion: 'Agroclima parcial: existen dias sin datos en el periodo.',
  });

  assert.equal(decidirAccion(sinDatos, propuestoOk).accion, 'ACTUALIZARIA');
  assert.equal(decidirAccion(parcial, propuestoOk).accion, 'ACTUALIZARIA');
});

test('permite PARCIAL a mejor PARCIAL y bloquea una cobertura inferior', () => {
  const actual = crearSnapshot({
    horasFrioAcumuladas: 100,
    diasGradoAcumulados: null,
    agroclimaObservacion: 'Agroclima parcial. Cobertura: 50 dias con datos y 10 sin datos.',
  });
  const mejor = crearSnapshot({
    horasFrioAcumuladas: 101,
    diasGradoAcumulados: null,
    agroclimaObservacion: 'Agroclima parcial. Cobertura: 60 dias con datos y 5 sin datos.',
  });
  const peor = crearSnapshot({
    horasFrioAcumuladas: 99,
    diasGradoAcumulados: null,
    agroclimaObservacion: 'Agroclima parcial. Cobertura: 40 dias con datos y 15 sin datos.',
  });

  assert.equal(esMejorParcial(actual, mejor), true);
  assert.equal(decidirAccion(actual, mejor).accion, 'ACTUALIZARIA');
  assert.equal(decidirAccion(actual, peor).accion, 'NO_DEGRADAR');
});

test('no degrada un snapshot OK cuando MeteoFEAL propone SIN_DATOS', () => {
  const actualOk = crearSnapshot({ diasGradoAcumulados: 9.11 });
  const sinDatos = crearSnapshot({
    diasGradoAcumulados: null,
    estacionMeteoUuid: null,
    nombreEstacionMeteo: null,
    fechaCorteAgroclima: null,
    semanaIsoCorte: null,
    temporadaAgroclima: null,
    agroclimaObservacion: 'Sin datos agroclimaticos para la fecha de corte.',
  });

  assert.equal(decidirAccion(actualOk, sinDatos).accion, 'NO_DEGRADAR');
});

test('reporta ERROR sin escribir cuando MeteoFEAL no entrega un snapshot utilizable', () => {
  const actualOk = crearSnapshot({ diasGradoAcumulados: 9.11 });
  const error = crearSnapshot({
    diasGradoAcumulados: null,
    estacionMeteoUuid: null,
    nombreEstacionMeteo: null,
    fechaCorteAgroclima: null,
    semanaIsoCorte: null,
    temporadaAgroclima: null,
    agroclimaObservacion: 'Error al consultar Meteo FEAL.',
  });

  assert.equal(decidirAccion(actualOk, error).accion, 'ERROR');
});

test('reporta fundo sin estacion sin intentar escritura', async () => {
  const dependencias = crearDependencias({
    snapshot: crearSnapshot({
      diasGradoAcumulados: null,
      estacionMeteoUuid: null,
      nombreEstacionMeteo: null,
      fechaCorteAgroclima: null,
      semanaIsoCorte: null,
      temporadaAgroclima: null,
      agroclimaObservacion: 'Sin estacion meteorologica asociada al fundo.',
    }),
  });

  const resumen = await ejecutarBackfill(opciones(), dependencias);

  assert.deepEqual(dependencias.actualizaciones, []);
  assert.equal(resumen.sinEstacion, 1);
});

test('el apply entrega exclusivamente snapshot y estado actual al repositorio', async () => {
  const dependencias = crearDependencias();

  const resumen = await ejecutarBackfill(opciones({ apply: true }), dependencias);

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
  assert.equal(snapshot.diasGradoAcumulados, 4.36);
  assert.equal(actual.diasGradoAcumulados, null);
});

test('formatea Horas Frio y Dias Grado a dos decimales', () => {
  assert.equal(formatearDecimal(9.1111), '9.11');
  assert.equal(formatearDecimal(4.3611), '4.36');
  assert.equal(formatearDecimal(null), 'NULL');
});

test('calcula el corte historico como un dia calendario antes de fecha_monitoreo', () => {
  assert.equal(calcularFechaCorteEsperada('2026-08-11'), '2026-08-10');
});
