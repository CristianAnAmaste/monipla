const test = require('node:test');
const assert = require('node:assert/strict');
const MonitoreosService = require('../src/services/monitoreos.service');

test('CREATE usa la fecha de recepcion para el snapshot y conserva ambos acumulados de MeteoFEAL', async () => {
  const snapshotMeteoFeal = {
    horasFrioAcumuladas: 460.02,
    diasGradoAcumulados: 125.75,
    estacionMeteoUuid: '444d144f-0cb1-4790-85cf-9efd79cd0ac6',
    nombreEstacionMeteo: 'VDC',
    fechaCorteAgroclima: '2026-08-05',
    semanaIsoCorte: 32,
    temporadaAgroclima: '2026',
    agroclimaObservacion: 'Agroclima OK desde Meteo FEAL.',
  };
  const captured = {};
  const repository = {
    crearCabeceraMonitoreoTransaccional: async (payload) => {
      captured.payload = payload;
      captured.snapshot = await payload.calcularAgroclimaSnapshot(71, null);
      return { id_muestreo: 501, numero_muestreo: 99 };
    },
  };
  const agroclimaService = {
    calcularSnapshotSeguro: async (...args) => {
      captured.agroclimaArgs = args;
      return snapshotMeteoFeal;
    },
  };
  const catalogoSdpService = {
    resolverCanonicoPorId: async () => null,
  };
  const service = new MonitoreosService(
    repository,
    agroclimaService,
    {},
    catalogoSdpService
  );
  service.resolverFormulario = async () => ({
    success: true,
    values: {
      genFundo: 3,
      genCampo: 4,
      genVariedad: 5,
      idEstructura: 6,
      idLugarMuestra: 7,
      idMuestreador: 8,
      idEstadoFenologico: 9,
      fechaSolicitudMuestra: '2026-07-15',
      fechaRecepcionMuestra: '2026-07-15',
      fechaRevisionMuestra: '2026-08-06',
      observacionGeneral: '',
    },
    origen: { id_catalogo_sdp: 10 },
    estructura: { nombre_estructura: 'Hoja' },
    resumen: {},
  });

  const result = await service.guardarCabeceraMonitoreo(
    { confirmacionResumen: '1' },
    { id: 12 }
  );

  assert.equal(result.success, true);
  assert.equal(captured.payload.muestreo.fechaMuestreo, '2026-08-06');
  assert.deepEqual(captured.agroclimaArgs, [71, '2026-07-15', null]);
  assert.deepEqual(captured.snapshot, snapshotMeteoFeal);
});
