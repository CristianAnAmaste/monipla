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
  agroclimaSnapshot = {
    horasFrioAcumuladas: 430.15,
    diasGradoAcumulados: 120.45,
    estacionMeteoUuid: 'ec674291-52c6-416b-9f61-72bd680fd038',
    nombreEstacionMeteo: 'LTZ',
    fechaCorteAgroclima: '2026-08-05',
    semanaIsoCorte: 32,
    temporadaAgroclima: '2026',
    agroclimaObservacion: 'Agroclima OK desde Meteo FEAL.',
  },
  chanchitosImagenService = { procesarImagenes: async () => [] },
} = {}) {
  const llamadasCatalogo = [];
  const llamadasAgroclima = [];
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
  const agroclimaService = {
    calcularSnapshotSeguroPorFundo: async (...args) => {
      llamadasAgroclima.push(args);
      return agroclimaSnapshot;
    },
  };

  return {
    llamadasCatalogo,
    llamadasAgroclima,
    repository,
    servicio: new ChanchitosService(repository, catalogoService, agroclimaService, chanchitosImagenService),
  };
}

test('eliminarMonitoreo valida ID y rol antes de llamar al repository', async () => {
  const llamadas = [];
  const servicio = new ChanchitosService({
    eliminarMonitoreoTransaccional: async (idMonitoreo) => {
      llamadas.push(idMonitoreo);
      return { idMonitoreo, detallesEliminados: 12 };
    },
  }, {}, {});

  assert.deepEqual(await servicio.eliminarMonitoreo('invalido', { rol: 'admin' }), { success: false, reason: 'ID_INVALIDO' });
  assert.deepEqual(await servicio.eliminarMonitoreo('440', { rol: 'usuario' }), { success: false, reason: 'NO_AUTORIZADO' });
  assert.deepEqual(await servicio.eliminarMonitoreo('440', { rol: 'admin' }), {
    success: true,
    idMonitoreo: 440,
    detallesEliminados: 12,
  });
  assert.deepEqual(llamadas, [440]);
});

test('eliminarMonitoreo traduce ausencia y propaga fallas inesperadas', async () => {
  const servicio = new ChanchitosService({
    eliminarMonitoreoTransaccional: async () => { throw new Error('CHANCHITO_NO_EXISTE'); },
  }, {}, {});
  const inesperado = new ChanchitosService({
    eliminarMonitoreoTransaccional: async () => { throw new Error('FALLA_SQL'); },
  }, {}, {});

  assert.deepEqual(await servicio.eliminarMonitoreo('440', { rol: 'admin' }), {
    success: false,
    reason: 'CHANCHITO_NO_EXISTE',
  });
  await assert.rejects(inesperado.eliminarMonitoreo('440', { rol: 'admin' }), /FALLA_SQL/);
});

test('construye un payload valido con las 12 combinaciones canonicas y snapshot agroclimatico', async () => {
  const { servicio, repository, llamadasAgroclima } = crearServicio();
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
  assert.deepEqual(llamadasAgroclima, [[10, '2026-08-06']]);
  assert.equal(payloadRecibido.cabecera.agroclimaSnapshot.horasFrioAcumuladas, 430.15);
  assert.equal(payloadRecibido.cabecera.agroclimaSnapshot.diasGradoAcumulados, 120.45);
});

test('entrega al repositorio exclusivamente los buffers optimizados de las imagenes', async () => {
  const optimizado = Buffer.from([0xff, 0xd8, 0xff, 0x00]);
  const archivos = [{ buffer: Buffer.from('original'), mimetype: 'image/png', size: 8 }];
  const llamadas = [];
  const { servicio, repository } = crearServicio({
    chanchitosImagenService: {
      procesarImagenes: async (...args) => {
        llamadas.push(args);
        return [optimizado];
      },
    },
  });
  let payloadRecibido;
  repository.crearMonitoreoTransaccional = async (payload) => {
    payloadRecibido = payload;
    return { id_monitoreo: 88 };
  };

  const result = await servicio.guardarMonitoreo(crearBody(), { id: 12 }, { files: archivos });

  assert.equal(result.success, true);
  assert.deepEqual(llamadas, [[archivos, undefined]]);
  assert.deepEqual(payloadRecibido.cabecera.imagenes, [optimizado]);
  assert.notEqual(payloadRecibido.cabecera.imagenes[0], archivos[0].buffer);
});

test('rechaza una imagen cuando el optimizador informa un error controlado', async () => {
  const { servicio, repository } = crearServicio({
    chanchitosImagenService: {
      procesarImagenes: async () => {
        const error = new Error('IMAGEN_CORRUPTA');
        error.userMessage = 'Imagen 1: no fue posible procesar el archivo seleccionado.';
        throw error;
      },
    },
  });
  let persistido = false;
  repository.crearMonitoreoTransaccional = async () => { persistido = true; };

  const result = await servicio.guardarMonitoreo(crearBody(), { id: 12 }, { files: [{}] });

  assert.equal(result.success, false);
  assert.match(result.errors[0], /Imagen 1/);
  assert.equal(persistido, false);
});

test('obtiene imagenes historicas JPEG, PNG o WebP y rechaza posiciones invalidas', async () => {
  const repository = {
    obtenerImagenMonitoreoChanchitos: async (id, posicion) => {
      assert.equal(id, 88);
      return {
        1: Buffer.from([0xff, 0xd8, 0xff]),
        2: Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
        3: Buffer.from('RIFF0000WEBP', 'ascii'),
      }[posicion] || null;
    },
  };
  const servicio = new ChanchitosService(repository, {}, {}, { procesarImagenes: async () => [] });

  assert.equal((await servicio.obtenerImagen('88', '1')).mime, 'image/jpeg');
  assert.equal((await servicio.obtenerImagen('88', '2')).mime, 'image/png');
  assert.equal((await servicio.obtenerImagen('88', '3')).mime, 'image/webp');
  await assert.rejects(servicio.obtenerImagen('88', '4'), /IMAGEN_CHANCHITO_NO_DISPONIBLE/);
});

test('prepara el detalle individual para PDF y recupera las tres evidencias en una sola llamada', async () => {
  const llamadas = [];
  const imagen1 = Buffer.from([0xff, 0xd8, 0xff]);
  const imagen3 = Buffer.from([0xff, 0xd8, 0xff, 0x00]);
  const repository = {
    obtenerDetalleChanchitos: async (idMonitoreo) => ({
      cabecera: {
        id_monitoreo: idMonitoreo,
        fecha_monitoreo: '2026-08-12',
        fecha_registro: '2026-08-12',
        nombre_fundo: 'Fundo PDF',
        nombre_campo: 'Campo PDF',
        nombre_variedad: 'Variedad PDF',
        codigo_cuartel: 'A-1',
        sdp: 'SDP-1',
        csg: 'CSG-1',
        trazabilidad: 'TR-1',
        cant_plantas: 12,
        nombre_monitoreador: 'Monitoreador PDF',
        nombre_estado_fenologico: 'Pinta',
        observaciones: '',
        nombre_estacion_meteo: 'Estacion PDF',
        horas_frio_acumuladas: 10.5,
        dias_grado_acumulados: 4.25,
        fecha_corte_agroclima: '2026-08-12',
        agroclima_observacion: '',
        tiene_imagen_1: 1,
        tiene_imagen_2: 0,
        tiene_imagen_3: 1,
        total_bichos: 3,
        posiciones_con_deteccion: 2,
      },
      detalles: [{ id_estadomonitoreo: 1, id_estadoposicion: 1, cantidad_bichos: 3 }],
    }),
    obtenerImagenesMonitoreoChanchitos: async (idMonitoreo) => {
      llamadas.push(idMonitoreo);
      return [{ posicion: 1, buffer: imagen1 }, { posicion: 3, buffer: imagen3 }];
    },
  };
  const servicio = new ChanchitosService(repository, {}, {}, {});

  const detalle = await servicio.obtenerDetalleParaPdf('88');

  assert.deepEqual(llamadas, [88]);
  assert.equal(detalle.idMonitoreo, 88);
  assert.equal(detalle.imagenes.length, 2);
  assert.equal(detalle.imagenes[0].buffer, imagen1);
  assert.equal(detalle.matriz[0].posiciones[0].cantidad, 3);
  await assert.rejects(servicio.obtenerDetalleParaPdf('invalido'), /CHANCHITO_NO_EXISTE/);
});

test('guarda Chanchitos sin estacion meteorologica con acumulados nulos', async () => {
  const agroclimaSnapshot = {
    horasFrioAcumuladas: null,
    diasGradoAcumulados: null,
    estacionMeteoUuid: null,
    nombreEstacionMeteo: null,
    fechaCorteAgroclima: null,
    semanaIsoCorte: null,
    temporadaAgroclima: null,
    agroclimaObservacion: 'Sin estacion meteorologica asociada al fundo.',
  };
  const { servicio, repository } = crearServicio({ agroclimaSnapshot });
  let payloadRecibido;
  repository.crearMonitoreoTransaccional = async (payload) => {
    payloadRecibido = payload;
    return { id_monitoreo: 88 };
  };

  const result = await servicio.guardarMonitoreo(crearBody(), { id: 12 });

  assert.equal(result.success, true);
  assert.deepEqual(payloadRecibido.cabecera.agroclimaSnapshot, agroclimaSnapshot);
});

test('guarda Chanchitos cuando MeteoFEAL falla y conserva su observacion', async () => {
  const agroclimaSnapshot = {
    horasFrioAcumuladas: null,
    diasGradoAcumulados: null,
    estacionMeteoUuid: null,
    nombreEstacionMeteo: null,
    fechaCorteAgroclima: null,
    semanaIsoCorte: null,
    temporadaAgroclima: null,
    agroclimaObservacion: 'Error al consultar Meteo FEAL.',
  };
  const { servicio } = crearServicio({ agroclimaSnapshot });

  const result = await servicio.guardarMonitoreo(crearBody(), { id: 12 });

  assert.equal(result.success, true);
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
