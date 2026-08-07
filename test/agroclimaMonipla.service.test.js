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

test('consulta prioridad 2 y la usa cuando la primaria es parcial', async () => {
  const { servicio, llamadas } = crearServicio({
    [LTZ_UUID]: {
      station_id_uuid: LTZ_UUID,
      fecha_corte: '2026-08-04',
      anio_corte: 2026,
      semana_corte: 32,
      indicador_activo: 'HORAS_FRIO',
      horas_frio_acumuladas: 55.25,
      grados_dia_acumulados: null,
      dias_con_datos: 15,
      dias_sin_datos: 110,
      calculation_status: 'PARCIAL',
    },
    [NTC_UUID]: {
      station_id_uuid: NTC_UUID,
      fecha_corte: '2026-08-04',
      anio_corte: 2026,
      semana_corte: 32,
      indicador_activo: 'HORAS_FRIO',
      horas_frio_acumuladas: 420.5,
      grados_dia_acumulados: null,
      dias_con_datos: 125,
      dias_sin_datos: 0,
      calculation_status: 'OK',
    },
  });

  const snapshot = await servicio.calcularSnapshot(10, '2026-08-05');

  assert.deepEqual(llamadas, [LTZ_UUID, NTC_UUID]);
  assert.equal(snapshot.estacionMeteoUuid, NTC_UUID);
  assert.equal(snapshot.nombreEstacionMeteo, 'NTC');
  assert.equal(snapshot.horasFrioAcumuladas, 420.5);
  assert.match(snapshot.agroclimaObservacion, /Cobertura completa/);
  assert.match(snapshot.agroclimaObservacion, /primaria tenia cobertura parcial/);
});

test('si ambas estaciones son parciales usa la de mayor cobertura', async () => {
  const { servicio, llamadas } = crearServicio({
    [LTZ_UUID]: {
      station_id_uuid: LTZ_UUID,
      fecha_corte: '2026-08-04',
      indicador_activo: 'HORAS_FRIO',
      horas_frio_acumuladas: 55.25,
      dias_con_datos: 15,
      dias_sin_datos: 110,
      calculation_status: 'PARCIAL',
    },
    [NTC_UUID]: {
      station_id_uuid: NTC_UUID,
      fecha_corte: '2026-08-04',
      indicador_activo: 'HORAS_FRIO',
      horas_frio_acumuladas: 390.75,
      dias_con_datos: 100,
      dias_sin_datos: 25,
      calculation_status: 'PARCIAL',
    },
  });

  const snapshot = await servicio.calcularSnapshot(10, '2026-08-05');

  assert.deepEqual(llamadas, [LTZ_UUID, NTC_UUID]);
  assert.equal(snapshot.estacionMeteoUuid, NTC_UUID);
  assert.equal(snapshot.horasFrioAcumuladas, 390.75);
  assert.match(snapshot.agroclimaObservacion, /Cobertura parcial: 100 dias con datos y 25 sin datos/);
});

test('mantiene la primaria si ambas son parciales y la primaria tiene mayor cobertura', async () => {
  const { servicio, llamadas } = crearServicio({
    [LTZ_UUID]: {
      station_id_uuid: LTZ_UUID,
      fecha_corte: '2026-08-04',
      indicador_activo: 'HORAS_FRIO',
      horas_frio_acumuladas: 380.25,
      dias_con_datos: 100,
      dias_sin_datos: 25,
      calculation_status: 'PARCIAL',
    },
    [NTC_UUID]: {
      station_id_uuid: NTC_UUID,
      fecha_corte: '2026-08-04',
      indicador_activo: 'HORAS_FRIO',
      horas_frio_acumuladas: 45.5,
      dias_con_datos: 15,
      dias_sin_datos: 110,
      calculation_status: 'PARCIAL',
    },
  });

  const snapshot = await servicio.calcularSnapshot(10, '2026-08-05');

  assert.deepEqual(llamadas, [LTZ_UUID, NTC_UUID]);
  assert.equal(snapshot.estacionMeteoUuid, LTZ_UUID);
  assert.equal(snapshot.horasFrioAcumuladas, 380.25);
  assert.match(snapshot.agroclimaObservacion, /No se encontro una estacion con cobertura completa/);
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

test('describe cobertura completa, parcial incluida y sin temperatura cuando Meteo FEAL las informa', async () => {
  const { servicio } = crearServicio({
    [LTZ_UUID]: {
      station_id_uuid: LTZ_UUID,
      fecha_corte: '2026-08-04',
      indicador_activo: 'HORAS_FRIO',
      horas_frio_acumuladas: 401.5,
      dias_con_datos: 128,
      dias_sin_datos: 0,
      dias_completos: 88,
      dias_parciales_aprovechados: 40,
      dias_sin_temperatura: 0,
      calculation_status: 'PARCIAL',
    },
  });

  const snapshot = await servicio.calcularSnapshot(10, '2026-08-05');

  assert.match(snapshot.agroclimaObservacion, /88 dias con cobertura completa/);
  assert.match(snapshot.agroclimaObservacion, /40 dias con cobertura parcial incluidos/);
  assert.match(snapshot.agroclimaObservacion, /0 dias sin temperatura no incluidos/);
  assert.doesNotMatch(snapshot.agroclimaObservacion, /40 sin datos/);
});

test('mantiene la descripcion historica de cobertura cuando Meteo FEAL no envia campos detallados', async () => {
  const { servicio } = crearServicio({
    [LTZ_UUID]: {
      station_id_uuid: LTZ_UUID,
      fecha_corte: '2026-08-04',
      indicador_activo: 'HORAS_FRIO',
      horas_frio_acumuladas: 401.5,
      dias_con_datos: 88,
      dias_sin_datos: 40,
      calculation_status: 'PARCIAL',
    },
  });

  const snapshot = await servicio.calcularSnapshot(10, '2026-08-05');

  assert.match(snapshot.agroclimaObservacion, /88 dias con datos y 40 sin datos/);
});
