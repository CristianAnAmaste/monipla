const test = require('node:test');
const assert = require('node:assert/strict');
const CatalogoSdpService = require('../src/services/catalogoSdp.service');

const seleccionValida = {
  genFundo: 10,
  genCampo: 20,
  genVariedad: 30,
};

const filaValida = {
  id_catalogo_sdp: 40,
  gen_fundo: 10,
  gen_campo: 20,
  gen_variedad: 30,
  sdp: 'SDP-40',
  activo: 1,
};

function crearServicio(filas) {
  const llamadas = [];
  const repository = {
    findByIdActivoConSdp: async (...args) => {
      llamadas.push(args);
      return filas;
    },
  };

  return {
    llamadas,
    servicio: new CatalogoSdpService(repository),
  };
}

test('resuelve una fila activa con SDP y jerarquia coherente', async () => {
  const { servicio } = crearServicio([filaValida]);

  const resultado = await servicio.resolverCanonicoPorId(40, seleccionValida);

  assert.equal(resultado, filaValida);
});

test('rechaza un id_catalogo_sdp inexistente', async () => {
  const { servicio } = crearServicio([]);

  await assert.rejects(
    servicio.resolverCanonicoPorId(999, seleccionValida),
    { message: 'CATALOGO_SDP_MB_NO_DISPONIBLE' }
  );
});

test('rechaza una fila inactiva', async () => {
  const { servicio } = crearServicio([{ ...filaValida, activo: 0 }]);

  await assert.rejects(
    servicio.resolverCanonicoPorId(41, seleccionValida),
    { message: 'CATALOGO_SDP_MB_NO_DISPONIBLE' }
  );
});

test('rechaza una fila con SDP nulo', async () => {
  const { servicio } = crearServicio([{ ...filaValida, sdp: null }]);

  await assert.rejects(
    servicio.resolverCanonicoPorId(42, seleccionValida),
    { message: 'CATALOGO_SDP_MB_NO_DISPONIBLE' }
  );
});

test('rechaza incoherencia de fundo', async () => {
  const { servicio } = crearServicio([{ ...filaValida, gen_fundo: 11 }]);

  await assert.rejects(
    servicio.resolverCanonicoPorId(40, seleccionValida),
    { message: 'CATALOGO_SDP_MB_SELECCION_INVALIDA' }
  );
});

test('rechaza incoherencia de campo', async () => {
  const { servicio } = crearServicio([{ ...filaValida, gen_campo: 21 }]);

  await assert.rejects(
    servicio.resolverCanonicoPorId(40, seleccionValida),
    { message: 'CATALOGO_SDP_MB_SELECCION_INVALIDA' }
  );
});

test('rechaza incoherencia de variedad', async () => {
  const { servicio } = crearServicio([{ ...filaValida, gen_variedad: 31 }]);

  await assert.rejects(
    servicio.resolverCanonicoPorId(40, seleccionValida),
    { message: 'CATALOGO_SDP_MB_SELECCION_INVALIDA' }
  );
});

test('reutiliza la misma resolucion con la transaccion recibida', async () => {
  const { servicio, llamadas } = crearServicio([filaValida]);
  const transaction = { id: 'transaccion-prueba' };

  await servicio.resolverCanonicoPorId(40, seleccionValida, transaction);

  assert.deepEqual(llamadas, [[40, transaction]]);
});
