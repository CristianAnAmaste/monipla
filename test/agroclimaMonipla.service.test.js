const test = require('node:test');
const assert = require('node:assert/strict');
const AgroclimaMoniplaService = require('../src/services/agroclimaMonipla.service');

const LTZ_UUID = 'ec674291-52c6-416b-9f61-72bd680fd038';
const NTC_UUID = '9373a0db-6a2d-48c9-883a-f23e6f26753b';

function crearServicio(respuestas) {
  const llamadas = [];
  const agroclimaRepository = {
    resolverEstacionesPorOrigen: async () => [
      {
        station_id_uuid: LTZ_UUID,
        nombre_estacion: 'LTZ',
        prioridad: 1,
      },
      {
        station_id_uuid: NTC_UUID,
        nombre_estacion: 'NTC',
        prioridad: 2,
      },
    ],
  };
  const meteoFealClient = {
    obtenerAcumuladoAgroclimatico: async ({ stationIdUuid }) => {
      llamadas.push(stationIdUuid);
      const respuesta = respuestas[stationIdUuid];

      if (respuesta instanceof Error) {
        throw respuesta;
      }

      return respuesta;
    },
  };

  return {
    llamadas,
    servicio: new AgroclimaMoniplaService(agroclimaRepository, meteoFealClient),
  };
}

test('usa la estacion de prioridad 2 cuando la primaria no tiene datos', async () => {
  const { servicio, llamadas } = crearServicio({
    [LTZ_UUID]: {
      station_id_uuid: LTZ_UUID,
      fecha_corte: '2026-08-04',
      indicador_activo: 'HORAS_FRIO',
      horas_frio_acumuladas: null,
      grados_dia_acumulados: null,
      dias_con_datos: 0,
      dias_sin_datos: 100,
      calculation_status: 'SIN_DATOS',
    },
    [NTC_UUID]: {
      station_id_uuid: NTC_UUID,
      fecha_corte: '2026-08-04',
      anio_corte: 2026,
      semana_corte: 32,
      indicador_activo: 'HORAS_FRIO',
      horas_frio_acumuladas: 412.75,
      grados_dia_acumulados: null,
      dias_con_datos: 100,
      dias_sin_datos: 0,
      calculation_status: 'OK',
    },
  });

  const snapshot = await servicio.calcularSnapshot(10, '2026-08-05');

  assert.deepEqual(llamadas, [LTZ_UUID, NTC_UUID]);
  assert.equal(snapshot.estacionMeteoUuid, NTC_UUID);
  assert.equal(snapshot.nombreEstacionMeteo, 'NTC');
  assert.equal(snapshot.horasFrioAcumuladas, 412.75);
  assert.match(snapshot.agroclimaObservacion, /Estacion de respaldo utilizada/);
  assert.match(snapshot.agroclimaObservacion, /Primaria: LTZ/);
  assert.match(snapshot.agroclimaObservacion, /Utilizada: NTC/);
});

test('acepta cero como valor real si la estacion primaria tiene dias con datos', async () => {
  const { servicio, llamadas } = crearServicio({
    [LTZ_UUID]: {
      station_id_uuid: LTZ_UUID.toUpperCase(),
      fecha_corte: '2026-08-04',
      anio_corte: 2026,
      semana_corte: 32,
      indicador_activo: 'GRADOS_DIA',
      horas_frio_acumuladas: null,
      grados_dia_acumulados: 0,
      dias_con_datos: 5,
      dias_sin_datos: 0,
      calculation_status: 'OK',
    },
  });

  const snapshot = await servicio.calcularSnapshot(10, '2026-08-05');

  assert.deepEqual(llamadas, [LTZ_UUID]);
  assert.equal(snapshot.estacionMeteoUuid, LTZ_UUID);
  assert.equal(snapshot.nombreEstacionMeteo, 'LTZ');
  assert.equal(snapshot.diasGradoAcumulados, 0);
  assert.equal(snapshot.agroclimaObservacion, 'Agroclima OK desde Meteo FEAL.');
});

test('no consulta el respaldo cuando Meteo FEAL tiene un error global de conexion', async () => {
  const fetchError = new Error('fetch failed');
  const { servicio, llamadas } = crearServicio({
    [LTZ_UUID]: fetchError,
  });

  const snapshot = await servicio.calcularSnapshot(10, '2026-08-05');

  assert.deepEqual(llamadas, [LTZ_UUID]);
  assert.equal(snapshot.estacionMeteoUuid, LTZ_UUID);
  assert.equal(snapshot.horasFrioAcumuladas, null);
  assert.equal(snapshot.diasGradoAcumulados, null);
  assert.equal(snapshot.agroclimaObservacion, 'Error al consultar Meteo FEAL.');
});
