const test = require('node:test');
const assert = require('node:assert/strict');
const {
  parsearArgumentos,
  esSnapshotAplicable,
  snapshotsIguales,
  ejecutarBackfill,
} = require('../scripts/backfill-monipla-agroclima');

const VDC_UUID = '444d144f-0cb1-4790-85cf-9efd79cd0ac6';
const NTC_UUID = '9373a0db-6a2d-48c9-883a-f23e6f26753b';

test('permite simular el recalculo masivo sin confirmacion', () => {
  assert.deepEqual(parsearArgumentos(['--recalcular']), {
    apply: false,
    idMuestreo: null,
    recalcular: true,
    confirmarTodos: false,
    stationIdUuid: null,
  });
});

test('bloquea aplicar el recalculo masivo sin confirmacion explicita', () => {
  assert.throws(
    () => parsearArgumentos(['--recalcular', '--apply']),
    /--confirmar-todos/
  );
});

test('permite recalcular y aplicar un solo monitoreo', () => {
  assert.deepEqual(parsearArgumentos(['--recalcular', '--id', '31', '--apply']), {
    apply: true,
    idMuestreo: 31,
    recalcular: true,
    confirmarTodos: false,
    stationIdUuid: null,
  });
});

test('considera aplicable un snapshot definitivo sin estacion', () => {
  assert.equal(esSnapshotAplicable({
    horasFrioAcumuladas: null,
    diasGradoAcumulados: null,
    fechaCorteAgroclima: null,
    agroclimaObservacion: 'Sin estacion meteorologica asociada al fundo.',
  }), true);
});

test('detecta cambio de estacion aunque los acumulados sean iguales', () => {
  const base = {
    horasFrioAcumuladas: 405.27,
    diasGradoAcumulados: null,
    fechaCorteAgroclima: '2026-07-07',
    semanaIsoCorte: 28,
    temporadaAgroclima: '2026',
    agroclimaObservacion: 'Agroclima OK desde Meteo FEAL.',
  };

  assert.equal(snapshotsIguales(
    {
      ...base,
      estacionMeteoUuid: 'ec674291-52c6-416b-9f61-72bd680fd038',
      nombreEstacionMeteo: 'LTZ',
    },
    {
      ...base,
      estacionMeteoUuid: '9373a0db-6a2d-48c9-883a-f23e6f26753b',
      nombreEstacionMeteo: 'NTC',
    }
  ), false);
});

test('normaliza el UUID de --station-id sin comparar por nombre', () => {
  assert.deepEqual(
    parsearArgumentos([`--station-id=${VDC_UUID.toUpperCase()}`]),
    {
      apply: false,
      idMuestreo: null,
      recalcular: false,
      confirmarTodos: false,
      stationIdUuid: VDC_UUID,
    }
  );
});

function crearDependenciasBackfill() {
  const actualizaciones = [];
  const logs = [];
  const candidatos = [
    {
      id_muestreo: 10,
      numero_muestreo: 110,
      id_origen_muestra: 100,
      fecha_recepcion_muestra: '2026-08-05',
      horas_frio_actuales: null,
      dias_grado_actuales: null,
      estacion_uuid_actual: null,
      nombre_estacion_actual: null,
      fecha_corte_actual: null,
      semana_iso_actual: null,
      temporada_actual: null,
      observacion_actual: null,
    },
    {
      id_muestreo: 11,
      numero_muestreo: 111,
      id_origen_muestra: 101,
      fecha_recepcion_muestra: '2026-08-06',
      horas_frio_actuales: null,
      dias_grado_actuales: null,
      estacion_uuid_actual: null,
      nombre_estacion_actual: null,
      fecha_corte_actual: null,
      semana_iso_actual: null,
      temporada_actual: null,
      observacion_actual: null,
    },
    {
      id_muestreo: 12,
      numero_muestreo: 112,
      id_origen_muestra: 102,
      fecha_recepcion_muestra: '2026-08-07',
      horas_frio_actuales: null,
      dias_grado_actuales: null,
      estacion_uuid_actual: null,
      nombre_estacion_actual: null,
      fecha_corte_actual: null,
      semana_iso_actual: null,
      temporada_actual: null,
      observacion_actual: null,
    },
  ];
  const estaciones = {
    100: [{ station_id_uuid: VDC_UUID.toUpperCase(), nombre_estacion: 'VDC', prioridad: 1 }],
    101: [{ station_id_uuid: NTC_UUID, nombre_estacion: 'NTC', prioridad: 1 }],
    102: [{ station_id_uuid: VDC_UUID, nombre_estacion: 'VDC', prioridad: 1 }],
  };
  const repository = {
    listarMuestreosPendientesBackfill: async () => candidatos,
    actualizarSnapshotSiPendienteBackfill: async (idMuestreo) => {
      actualizaciones.push(idMuestreo);
      return 1;
    },
  };
  const agroclimaService = {
    resolverEstacionesConfiguradas: async (idOrigenMuestra) => estaciones[idOrigenMuestra],
    calcularSnapshotSeguro: async (idOrigenMuestra) => ({
      horasFrioAcumuladas: 10,
      diasGradoAcumulados: null,
      estacionMeteoUuid: idOrigenMuestra === 102 ? NTC_UUID : VDC_UUID,
      nombreEstacionMeteo: idOrigenMuestra === 102 ? 'NTC' : 'VDC',
      fechaCorteAgroclima: '2026-08-04',
      semanaIsoCorte: 32,
      temporadaAgroclima: '2026',
      agroclimaObservacion: 'Agroclima OK desde Meteo FEAL.',
    }),
  };
  const logger = {
    info: (...args) => logs.push(['info', ...args]),
    error: (...args) => logs.push(['error', ...args]),
  };

  return { repository, agroclimaService, logger, actualizaciones, logs };
}

function opcionesVdc(apply = false) {
  return {
    apply,
    idMuestreo: null,
    recalcular: false,
    confirmarTodos: false,
    stationIdUuid: VDC_UUID,
  };
}

test('dry-run procesa exclusivamente VDC y no actualiza monitoreos', async () => {
  const dependencias = crearDependenciasBackfill();

  const resumen = await ejecutarBackfill(opcionesVdc(), dependencias);

  assert.deepEqual(dependencias.actualizaciones, []);
  assert.equal(resumen.candidatos, 2);
  assert.equal(resumen.candidatosVdc, 2);
  assert.equal(resumen.actualizables, 1);
  assert.equal(resumen.excluidosPorEstacion, 2);
  assert.equal(resumen.omitidosPorEstacionResuelta, 1);
  assert.equal(resumen.otrasEstacionesIncluidas, 0);
  assert.equal(resumen.confirmacionSinOtrasEstaciones, true);
  assert.equal(resumen.fechaCorteMinima, '2026-08-04');
  assert.equal(resumen.fechaCorteMaxima, '2026-08-06');
  assert.equal(resumen.fechasCorteDistintas, 2);
});

test('--apply queda limitado a los mismos candidatos VDC', async () => {
  const dependencias = crearDependenciasBackfill();

  const resumen = await ejecutarBackfill(opcionesVdc(true), dependencias);

  assert.deepEqual(dependencias.actualizaciones, [10]);
  assert.equal(resumen.actualizados, 1);
  assert.equal(resumen.candidatosVdc, 2);
  assert.equal(resumen.omitidosPorEstacionResuelta, 1);
});
