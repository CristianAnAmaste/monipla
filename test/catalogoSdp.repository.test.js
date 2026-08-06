const test = require('node:test');
const assert = require('node:assert/strict');
const CatalogoSdpRepository = require('../src/repositories/catalogoSdp.repository');

function crearRepository() {
  const consultas = [];
  const inputs = [];
  const request = {
    input(nombre, tipo, valor) {
      inputs.push({ nombre, tipo, valor });
      return this;
    },
    async query(texto) {
      consultas.push(texto);
      return { recordset: [] };
    },
  };
  const database = {
    poolPromise: Promise.resolve({ request: () => request }),
    sql: {
      Int: 'INT',
      Request: class {},
    },
  };

  return {
    consultas,
    inputs,
    repository: new CatalogoSdpRepository(database),
  };
}

test('la resolucion por id usa parametro y filtra filas activas con SDP', async () => {
  const { repository, consultas, inputs } = crearRepository();

  await repository.findByIdActivoConSdp(40);

  assert.deepEqual(inputs, [{ nombre: 'idCatalogoSdp', tipo: 'INT', valor: 40 }]);
  assert.match(consultas[0], /WHERE id_catalogo_sdp = @idCatalogoSdp/);
  assert.match(consultas[0], /AND activo = 1/);
  assert.match(consultas[0], /AND sdp IS NOT NULL/);
  assert.doesNotMatch(consultas[0], /TOP\s+1/i);
});

test('el listado de cuarteles conserva numeros antes de valores alfanumericos', async () => {
  const { repository, consultas, inputs } = crearRepository();

  await repository.findCuartelesByFiltros(10, 20, 30);

  assert.deepEqual(inputs, [
    { nombre: 'genFundo', tipo: 'INT', valor: 10 },
    { nombre: 'genCampo', tipo: 'INT', valor: 20 },
    { nombre: 'genVariedad', tipo: 'INT', valor: 30 },
  ]);
  assert.match(consultas[0], /CASE WHEN TRY_CONVERT\(INT, cuartel\) IS NULL THEN 1 ELSE 0 END/);
  assert.match(consultas[0], /TRY_CONVERT\(INT, cuartel\),\s*cuartel/);
});
