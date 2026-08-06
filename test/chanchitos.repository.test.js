const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ChanchitosRepository = require('../src/repositories/chanchitos.repository');

function crearDetalles() {
  const detalles = [];

  [1, 2, 3].forEach((idEstadoMonitoreo) => {
    [1, 2, 3, 4].forEach((idEstadoPosicion) => {
      detalles.push({ idEstadoMonitoreo, idEstadoPosicion, cantidadBichos: 0 });
    });
  });

  return detalles;
}

function crearRepository({ fallaCabecera = false, fallaDetalle = 0 } = {}) {
  const state = {
    consultas: [],
    transacciones: [],
    detalles: 0,
  };

  class Transaction {
    constructor(pool) {
      this.pool = pool;
      this.beginCount = 0;
      this.commitCount = 0;
      this.rollbackCount = 0;
      state.transacciones.push(this);
    }

    async begin() { this.beginCount += 1; }
    async commit() { this.commitCount += 1; }
    async rollback() { this.rollbackCount += 1; }
  }

  class Request {
    constructor(transaction) {
      this.transaction = transaction;
      this.inputs = [];
    }

    input(nombre, tipo, valor) {
      this.inputs.push({ nombre, tipo, valor });
      return this;
    }

    async query(texto) {
      state.consultas.push({ texto, transaction: this.transaction, inputs: this.inputs });

      if (/INSERT INTO dbo\.MONI_CABECERAMONITOREO/.test(texto)) {
        if (fallaCabecera) {
          throw new Error('FALLA_CABECERA');
        }

        return { recordset: [{ id_monitoreo: 501 }], rowsAffected: [1] };
      }

      if (/INSERT INTO dbo\.MONI_DETALLEMONITOREO/.test(texto)) {
        state.detalles += 1;

        if (state.detalles === fallaDetalle) {
          throw new Error('FALLA_DETALLE');
        }

        return { recordset: [], rowsAffected: [1] };
      }

      if (/FROM dbo\.MONI_MONITOREADORES/.test(texto) && /ORDER BY nombre_monitoreador;/.test(texto)) {
        return {
          recordset: [
            {
              id_monitoreador: 1,
              nombre_monitoreador: 'Margarita Garrido',
            },
          ],
        };
      }

      if (/FROM dbo\.MONI_MONITOREADORES/.test(texto) && /WHERE id_monitoreador = @idMonitoreador/.test(texto)) {
        return { recordset: [{ id_monitoreador: 1, activo: 1 }] };
      }

      throw new Error('CONSULTA_NO_ESPERADA');
    }
  }

  const database = {
    poolPromise: Promise.resolve({ request: () => new Request(null) }),
    sql: {
      Int: 'INT',
      Date: 'DATE',
      NVarChar: () => 'NVARCHAR',
      Transaction,
      Request,
    },
  };

  return {
    state,
    repository: new ChanchitosRepository(database),
  };
}

function crearPayload(registro = {}) {
  const revalidaciones = [];
  const { catalogo: catalogoSobrescrito = {}, ...payloadSobrescrito } = registro;
  const catalogo = {
    id_catalogo_sdp: 40,
    gen_fundo: 10,
    gen_campo: 20,
    gen_variedad: 30,
    cuartel: 'A-10',
    sdp: 'SDP-40',
    codigo_sag: 'CSG-40',
    ...catalogoSobrescrito,
  };

  return {
    revalidaciones,
    payload: {
      cabecera: {
        cantPlantas: 20,
        idUsuario: 12,
        fechaMonitoreo: '2026-08-06',
        idEstadoFenologico: 5,
        observaciones: null,
        idMonitoreador: 7,
      },
      detalles: crearDetalles(),
      revalidarCatalogoSdp: async (transaction) => {
        revalidaciones.push(['catalogo', transaction]);
        return catalogo;
      },
      revalidarMonitoreador: async (transaction) => {
        revalidaciones.push(['monitoreador', transaction]);
      },
      revalidarEstadoFenologico: async (transaction) => {
        revalidaciones.push(['estado', transaction]);
      },
      ...payloadSobrescrito,
    },
  };
}

function obtenerInputsCabecera(state) {
  const consulta = state.consultas.find((item) => /INSERT INTO dbo\.MONI_CABECERAMONITOREO/.test(item.texto));
  return new Map(consulta.inputs.map((input) => [input.nombre, input.valor]));
}

test('obtiene id_monitoreo con OUTPUT y confirma cabecera con 12 detalles', async () => {
  const { repository, state } = crearRepository();
  const { payload, revalidaciones } = crearPayload();

  const resultado = await repository.crearMonitoreoTransaccional(payload);

  assert.equal(resultado.id_monitoreo, 501);
  assert.equal(resultado.detalles_insertados, 12);
  assert.equal(state.transacciones[0].beginCount, 1);
  assert.equal(state.transacciones[0].commitCount, 1);
  assert.equal(state.transacciones[0].rollbackCount, 0);
  assert.equal(state.consultas.filter((item) => /MONI_CABECERAMONITOREO/.test(item.texto)).length, 1);
  assert.equal(state.consultas.filter((item) => /MONI_DETALLEMONITOREO/.test(item.texto)).length, 12);
  assert.match(state.consultas[0].texto, /OUTPUT INSERTED\.id_monitoreo/);
  assert.equal(state.consultas.some((item) => /MONIPLA_RESULTADO_/.test(item.texto)), false);
  assert.equal(state.consultas.some((item) => /MONIPLA_MUESTREADOR/.test(item.texto)), false);
  assert.deepEqual(revalidaciones.map(([tipo]) => tipo), ['catalogo', 'monitoreador', 'estado']);
  assert.equal(revalidaciones.every(([, transaction]) => transaction === state.transacciones[0]), true);
});

test('normaliza SDP, cuartel y CSG numericos antes de enlazarlos como NVARCHAR', async () => {
  const { repository, state } = crearRepository();
  const { payload } = crearPayload({
    catalogo: {
      sdp: 60103,
      cuartel: 45,
      codigo_sag: 7001,
    },
  });

  const resultado = await repository.crearMonitoreoTransaccional(payload);
  const inputs = obtenerInputsCabecera(state);

  assert.equal(resultado.detalles_insertados, 12);
  assert.equal(inputs.get('sdp'), '60103');
  assert.equal(inputs.get('codigoCuartel'), '45');
  assert.equal(inputs.get('csg'), '7001');
  assert.equal(state.transacciones[0].commitCount, 1);
  assert.equal(state.consultas.filter((item) => /MONI_DETALLEMONITOREO/.test(item.texto)).length, 12);
});

test('conserva SDP de texto valido al enlazar la cabecera', async () => {
  const { repository, state } = crearRepository();
  const { payload } = crearPayload({ catalogo: { sdp: 'SDP-60103' } });

  await repository.crearMonitoreoTransaccional(payload);

  assert.equal(obtenerInputsCabecera(state).get('sdp'), 'SDP-60103');
});

test('mantiene como NULL los textos opcionales nulos del catalogo', async () => {
  const { repository, state } = crearRepository();
  const { payload } = crearPayload({
    catalogo: {
      cuartel: null,
      codigo_sag: undefined,
    },
  });

  await repository.crearMonitoreoTransaccional(payload);

  const inputs = obtenerInputsCabecera(state);
  assert.equal(inputs.get('codigoCuartel'), null);
  assert.equal(inputs.get('csg'), null);
});

test('rechaza SDP nulo, indefinido, vacio o texto no valido antes del INSERT y hace rollback', async () => {
  for (const sdp of [null, undefined, '', 'null', 'undefined', '[object Object]']) {
    const { repository, state } = crearRepository();
    const { payload } = crearPayload({ catalogo: { sdp } });

    await assert.rejects(
      repository.crearMonitoreoTransaccional(payload),
      /CATALOGO_SDP_MB_TEXTO_INVALIDO/
    );

    assert.equal(state.transacciones[0].commitCount, 0);
    assert.equal(state.transacciones[0].rollbackCount, 1);
    assert.equal(state.consultas.some((item) => /MONI_CABECERAMONITOREO/.test(item.texto)), false);
    assert.equal(state.consultas.some((item) => /MONI_DETALLEMONITOREO/.test(item.texto)), false);
  }
});

test('lista exclusivamente monitoreadores activos por nombre', async () => {
  const { repository, state } = crearRepository();

  const monitoreadores = await repository.listarMonitoreadoresActivos();

  assert.deepEqual(monitoreadores, [
    {
      id_monitoreador: 1,
      nombre_monitoreador: 'Margarita Garrido',
    },
  ]);

  const consulta = state.consultas.at(-1).texto;
  assert.match(consulta, /SELECT\s+id_monitoreador,\s+nombre_monitoreador/i);
  assert.match(consulta, /FROM dbo\.MONI_MONITOREADORES/i);
  assert.match(consulta, /WHERE activo = 1/i);
  assert.match(consulta, /ORDER BY nombre_monitoreador;/i);
  assert.doesNotMatch(consulta, /MONIPLA_MUESTREADOR/i);
});

test('revalida el monitoreador por ID exclusivamente en MONI_MONITOREADORES', async () => {
  const { repository, state } = crearRepository();

  const filas = await repository.findMonitoreadorById(1);

  assert.deepEqual(filas, [{ id_monitoreador: 1, activo: 1 }]);
  const consulta = state.consultas.at(-1);
  assert.match(consulta.texto, /FROM dbo\.MONI_MONITOREADORES/i);
  assert.match(consulta.texto, /WHERE id_monitoreador = @idMonitoreador/i);
  assert.doesNotMatch(consulta.texto, /MONIPLA_MUESTREADOR/i);
  assert.deepEqual(consulta.inputs, [{ nombre: 'idMonitoreador', tipo: 'INT', valor: 1 }]);
});

test('el formulario usa el ID como valor y el nombre como etiqueta del monitoreador', () => {
  const vista = fs.readFileSync(
    path.join(__dirname, '..', 'src', 'views', 'chanchitos', 'nuevo.ejs'),
    'utf8',
  );

  assert.match(vista, /value="<%= item\.id_monitoreador %>"/);
  assert.match(vista, /<%= item\.nombre_monitoreador %><\/option>/);
});

test('hace rollback si falla la cabecera', async () => {
  const { repository, state } = crearRepository({ fallaCabecera: true });
  const { payload } = crearPayload();

  await assert.rejects(repository.crearMonitoreoTransaccional(payload), /FALLA_CABECERA/);

  assert.equal(state.transacciones[0].commitCount, 0);
  assert.equal(state.transacciones[0].rollbackCount, 1);
  assert.equal(state.consultas.filter((item) => /MONI_DETALLEMONITOREO/.test(item.texto)).length, 0);
});

test('hace rollback si falla cualquier detalle', async () => {
  const { repository, state } = crearRepository({ fallaDetalle: 5 });
  const { payload } = crearPayload();

  await assert.rejects(repository.crearMonitoreoTransaccional(payload), /FALLA_DETALLE/);

  assert.equal(state.transacciones[0].commitCount, 0);
  assert.equal(state.transacciones[0].rollbackCount, 1);
  assert.equal(state.consultas.filter((item) => /MONI_CABECERAMONITOREO/.test(item.texto)).length, 1);
  assert.equal(state.consultas.filter((item) => /MONI_DETALLEMONITOREO/.test(item.texto)).length, 5);
});
