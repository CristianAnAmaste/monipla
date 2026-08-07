const test = require('node:test');
const assert = require('node:assert/strict');
const ChanchitosService = require('../src/services/chanchitos.service');
const CatalogoSdpService = require('../src/services/catalogoSdp.service');

const catalogoValido = {
  id_catalogo_sdp: 40,
  gen_fundo: 10,
  gen_campo: 20,
  gen_variedad: 30,
  cuartel: 'A-10',
  sdp: 'SDP-40',
  codigo_sag: 'CSG-40',
  codigo_trazabilidad: 'TR-40',
  activo: 1,
};

function crearBody(overrides = {}) {
  const body = {
    genFundo: '10',
    genCampo: '20',
    genVariedad: '30',
    idCatalogoSdp: '40',
    cantPlantas: '25',
    fechaMonitoreo: '2026-08-06',
    idEstadoFenologico: '5',
    idMonitoreador: '7',
    observaciones: '  Observacion de prueba  ',
  };

  [1, 2, 3].forEach((estado) => {
    [1, 2, 3, 4].forEach((posicion) => {
      body[`cantidad_${estado}_${posicion}`] = '';
    });
  });

  return { ...body, ...overrides };
}

function crearServicio({
  filasCatalogo = [catalogoValido],
  monitoreador = [{ id_monitoreador: 7, nombre_monitoreador: 'Margarita Garrido', activo: 1 }],
  estado = [{ estado: 1 }],
} = {}) {
  const llamadasCatalogo = [];
  const catalogoService = new CatalogoSdpService({
    findByIdActivoConSdp: async (...args) => {
      llamadasCatalogo.push(args);
      return filasCatalogo;
    },
  });
  const repository = {
    findMonitoreadorById: async () => monitoreador,
    findEstadoFenologicoById: async () => estado,
    crearMonitoreoTransaccional: async (payload) => ({
      id_monitoreo: 88,
      payload,
    }),
  };

  return {
    llamadasCatalogo,
    repository,
    servicio: new ChanchitosService(repository, catalogoService),
  };
}

test('construye un payload valido con las 12 combinaciones canonicas', async () => {
  const { servicio, repository } = crearServicio();
  let payloadRecibido;
  repository.crearMonitoreoTransaccional = async (payload) => {
    payloadRecibido = payload;
    return { id_monitoreo: 88 };
  };

  const result = await servicio.guardarMonitoreo(crearBody({ cantidad_2_3: '4' }), { id: 12 });

  assert.equal(result.success, true);
  assert.equal(result.id_monitoreo, 88);
  assert.equal(payloadRecibido.cabecera.idUsuario, 12);
  assert.equal(payloadRecibido.cabecera.observaciones, 'Observacion de prueba');
  assert.equal(payloadRecibido.detalles.length, 12);
  assert.deepEqual(
    payloadRecibido.detalles.map((detalle) => [detalle.idEstadoMonitoreo, detalle.idEstadoPosicion]),
    [[1, 1], [1, 2], [1, 3], [1, 4], [2, 1], [2, 2], [2, 3], [2, 4], [3, 1], [3, 2], [3, 3], [3, 4]]
  );
  assert.equal(payloadRecibido.detalles[6].cantidadBichos, 4);
  assert.equal(payloadRecibido.detalles.filter((detalle) => detalle.cantidadBichos === 0).length, 11);
});

test('rechaza usuario ausente', async () => {
  const { servicio } = crearServicio();

  const result = await servicio.guardarMonitoreo(crearBody(), null);

  assert.equal(result.success, false);
  assert.match(result.errors.join(' '), /usuario autenticado/);
});

test('rechaza cant_plantas cero, negativo, decimal o invalido', async () => {
  for (const cantPlantas of ['0', '-1', '2.5', 'texto']) {
    const { servicio } = crearServicio();
    const result = await servicio.guardarMonitoreo(crearBody({ cantPlantas }), { id: 12 });

    assert.equal(result.success, false, cantPlantas);
    assert.match(result.errors.join(' '), /cantidad de plantas/);
  }
});

test('rechaza cantidades negativas, decimales, texto y fuera de rango', async () => {
  for (const cantidad of ['-1', '1.5', 'texto', '2147483648']) {
    const { servicio } = crearServicio();
    const result = await servicio.guardarMonitoreo(
      crearBody({ cantidad_1_1: cantidad }),
      { id: 12 }
    );

    assert.equal(result.success, false, cantidad);
    assert.match(result.errors.join(' '), /cantidad 1-1/);
  }
});

test('convierte campos vacios de matriz en cero sin omitir filas', () => {
  const { servicio } = crearServicio();
  const matriz = servicio.construirMatriz(crearBody());

  assert.deepEqual(matriz.errors, []);
  assert.equal(matriz.detalles.length, 12);
  assert.equal(matriz.detalles.every((detalle) => detalle.cantidadBichos === 0), true);
});

test('rechaza catalogo inexistente, inactivo, sin SDP e incoherente', async () => {
  const casos = [
    { filasCatalogo: [], mensaje: /no esta disponible/ },
    { filasCatalogo: [{ ...catalogoValido, activo: 0 }], mensaje: /no esta disponible/ },
    { filasCatalogo: [{ ...catalogoValido, sdp: null }], mensaje: /no esta disponible/ },
    { filasCatalogo: [{ ...catalogoValido, gen_campo: 99 }], mensaje: /combinacion seleccionada/ },
  ];

  for (const item of casos) {
    const { servicio } = crearServicio(item);
    const result = await servicio.guardarMonitoreo(crearBody(), { id: 12 });

    assert.equal(result.success, false);
    assert.match(result.errors.join(' '), item.mensaje);
  }
});

test('rechaza monitoreador inexistente o inactivo', async () => {
  for (const monitoreador of [[], [{ activo: 0 }]]) {
    const { servicio } = crearServicio({ monitoreador });
    const result = await servicio.guardarMonitoreo(crearBody(), { id: 12 });

    assert.equal(result.success, false);
    assert.match(result.errors.join(' '), /monitoreador seleccionado/);
  }
});

test('rechaza estado fenologico inexistente o inactivo', async () => {
  for (const estado of [[], [{ estado: 0 }]]) {
    const { servicio } = crearServicio({ estado });
    const result = await servicio.guardarMonitoreo(crearBody(), { id: 12 });

    assert.equal(result.success, false);
    assert.match(result.errors.join(' '), /estado fenologico seleccionado/);
  }
});

test('propaga la transaccion a la revalidacion canonica del catalogo', async () => {
  const { servicio, repository, llamadasCatalogo } = crearServicio();
  let payloadRecibido;
  repository.crearMonitoreoTransaccional = async (payload) => {
    payloadRecibido = payload;
    return { id_monitoreo: 88 };
  };

  await servicio.guardarMonitoreo(crearBody(), { id: 12 });
  const transaction = { id: 'tx-prueba' };
  await payloadRecibido.revalidarCatalogoSdp(transaction);

  assert.deepEqual(llamadasCatalogo.at(-1), [40, transaction]);
});
