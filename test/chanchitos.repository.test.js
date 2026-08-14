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

function crearRepository({ fallaCabecera = false, fallaDetalle = 0, filasReporte = [] } = {}) {
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

      if (/FROM dbo\.MONI_CABECERAMONITOREO cab/.test(texto)) {
        return { recordset: filasReporte };
      }

      throw new Error('CONSULTA_NO_ESPERADA');
    }
  }

  const database = {
    poolPromise: Promise.resolve({ request: () => new Request(null) }),
    sql: {
      Int: 'INT',
      Date: 'DATE',
      Decimal: (precision, scale) => `DECIMAL(${precision},${scale})`,
      UniqueIdentifier: 'UNIQUEIDENTIFIER',
      TinyInt: 'TINYINT',
      VarChar: (length) => `VARCHAR(${length})`,
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
  const {
    catalogo: catalogoSobrescrito = {},
    cabecera: cabeceraSobrescrita = {},
    ...payloadSobrescrito
  } = registro;
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
        ...cabeceraSobrescrita,
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

test('persiste el snapshot agroclimatico de Chanchitos con Decimal(10,2)', async () => {
  const { repository, state } = crearRepository();
  const snapshot = {
    horasFrioAcumuladas: 430.15,
    diasGradoAcumulados: 120.45,
    estacionMeteoUuid: 'ec674291-52c6-416b-9f61-72bd680fd038',
    nombreEstacionMeteo: 'LTZ',
    fechaCorteAgroclima: '2026-08-11',
    semanaIsoCorte: 33,
    temporadaAgroclima: '2026',
    agroclimaObservacion: 'Agroclima OK desde Meteo FEAL.',
  };
  const { payload } = crearPayload({
    cabecera: { agroclimaSnapshot: snapshot },
  });

  await repository.crearMonitoreoTransaccional(payload);

  const consulta = state.consultas.find((item) => /INSERT INTO dbo\.MONI_CABECERAMONITOREO/.test(item.texto));
  const inputs = new Map(consulta.inputs.map((input) => [input.nombre, input]));
  assert.equal(inputs.get('horasFrioAcumuladas').tipo, 'DECIMAL(10,2)');
  assert.equal(inputs.get('diasGradoAcumulados').tipo, 'DECIMAL(10,2)');
  assert.equal(inputs.get('horasFrioAcumuladas').valor, 430.15);
  assert.equal(inputs.get('diasGradoAcumulados').valor, 120.45);
  assert.equal(inputs.get('estacionMeteoUuid').valor, snapshot.estacionMeteoUuid);
  assert.equal(inputs.get('fechaCorteAgroclima').valor, '2026-08-11');
  assert.equal(inputs.get('agroclimaObservacion').valor, snapshot.agroclimaObservacion);
  assert.match(consulta.texto, /horas_frio_acumuladas/i);
  assert.match(consulta.texto, /dias_grado_acumulados/i);
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

test('consulta el PDF general de Chanchitos con cabeceras y detalles separados y filtros de fecha', async () => {
  const filasReporte = [{ id_monitoreo: 438 }];
  const { repository, state } = crearRepository({ filasReporte });

  const filas = await repository.obtenerMonitoreosPdfGeneral({
    fechaDesde: '2026-08-01',
    fechaHasta: '2026-08-05',
  });

  assert.deepEqual(filas.cabeceras, filasReporte);
  assert.deepEqual(filas.detalles, []);
  assert.deepEqual(filas.catalogos, []);
  assert.deepEqual(filas.fundos, []);
  assert.deepEqual(filas.campos, []);
  assert.deepEqual(filas.variedades, []);
  assert.deepEqual(filas.cuarteles, []);
  assert.deepEqual(filas.monitoreadores, []);
  assert.deepEqual(filas.estadosFenologicos, []);
  assert.deepEqual(filas.trazabilidades, []);
  const consulta = state.consultas.at(-1);
  assert.match(consulta.texto, /CREATE TABLE #ChanchitosFiltrados \(id_monitoreo INT NOT NULL PRIMARY KEY\)/);
  assert.match(consulta.texto, /INSERT INTO #ChanchitosFiltrados \(id_monitoreo\)/);
  assert.match(consulta.texto, /FROM dbo\.MONI_CABECERAMONITOREO cab/);
  assert.match(consulta.texto, /FROM dbo\.MONI_DETALLEMONITOREO det/);
  assert.match(consulta.texto, /INNER JOIN #ChanchitosFiltrados seleccion ON seleccion\.id_monitoreo = det\.id_monitoreo/);
  assert.match(consulta.texto, /CONVERT\(nvarchar\(100\), cab\.codigo_cuartel\)/);
  assert.match(consulta.texto, /CONVERT\(nvarchar\(100\), cab\.sdp\)/);
  assert.match(consulta.texto, /CONVERT\(nvarchar\(100\), cab\.CSG\)/);
  assert.match(consulta.texto, /CREATE TABLE #TrazabilidadCoincidencias/);
  assert.match(consulta.texto, /mbHistorico\.gen_fundo = cp\.gen_fundo/);
  assert.match(consulta.texto, /mbHistorico\.gen_campo = cp\.gen_campo/);
  assert.match(consulta.texto, /mbHistorico\.gen_variedad = cp\.gen_variedad/);
  assert.match(consulta.texto, /csg_normalizado/);
  assert.match(consulta.texto, /COUNT\(DISTINCT codigo_trazabilidad\)/);
  assert.match(consulta.texto, /HISTORICA_UNICA/);
  assert.match(consulta.texto, /AMBIGUA/);
  assert.match(consulta.texto, /POR_ID_CATALOGO/);
  assert.match(consulta.texto, /#CabecerasPdf cp/);
  assert.match(consulta.texto, /ORDER BY\s+cp\.fecha_monitoreo DESC,\s+cp\.id_monitoreo DESC/i);
  assert.doesNotMatch(consulta.texto, /LEFT JOIN dbo\.MONIPLA_CATALOGO_SDP_MB mb ON mb\.id_catalogo_sdp = cp\.id_catalogo_sdp/i);
  assert.doesNotMatch(consulta.texto, /IN \(\$\{placeholders\.join/);
  assert.doesNotMatch(consulta.texto, /dbo\.MONIPLA_MUESTREO|dbo\.MONIPLA_RESULTADO_|dbo\.MONIPLA_MUESTREADOR/i);
  assert.deepEqual(consulta.inputs.slice(0, 2), [
    { nombre: 'fechaDesde', tipo: 'DATE', valor: '2026-08-01' },
    { nombre: 'fechaHasta', tipo: 'DATE', valor: '2026-08-05' },
  ]);
  assert.deepEqual(consulta.inputs.slice(2), [
    { nombre: 'genFundo', tipo: 'INT', valor: null },
    { nombre: 'genCampo', tipo: 'INT', valor: null },
    { nombre: 'genVariedad', tipo: 'INT', valor: null },
    { nombre: 'idCatalogoSdp', tipo: 'INT', valor: null },
    { nombre: 'idMonitoreador', tipo: 'INT', valor: null },
    { nombre: 'idEstadoFenologico', tipo: 'INT', valor: null },
    { nombre: 'deteccion', tipo: 'VARCHAR(20)', valor: null },
  ]);
});

test('la trazabilidad historica se resuelve en un resultset set-based y el detalle conserva la misma regla', () => {
  const contenido = fs.readFileSync(
    path.join(__dirname, '..', 'src', 'repositories', 'chanchitos.repository.js'),
    'utf8',
  );
  const inicioPdf = contenido.indexOf('CREATE TABLE #TrazabilidadCoincidencias');
  const finPdf = contenido.indexOf('FROM #CabecerasPdf cp\n        LEFT JOIN #CatalogosPdf', inicioPdf);
  const bloquePdf = contenido.slice(inicioPdf, finPdf);
  const inicioDetalle = contenido.indexOf('OUTER APPLY (\n          SELECT CONVERT(nvarchar(100), gcuHistorico.CODIGO)');
  const finDetalle = contenido.indexOf('${this.obtenerJoinsPresentacionHistorialChanchitos()}', inicioDetalle);
  const bloqueDetalle = contenido.slice(inicioDetalle, finDetalle);

  assert.match(contenido, /LEFT JOIN dbo\.GEN_CUARTEL gcuHistorico/);
  assert.match(contenido, /CREATE TABLE #CabecerasTrazabilidadHistorica/);
  assert.match(bloquePdf, /FROM #TrazabilidadHistoricaNormalizada cp/);
  assert.match(contenido, /FROM #CabecerasPdf\s+WHERE id_catalogo_sdp IS NULL/);
  assert.match(bloquePdf, /cp\.csg_normalizado/);
  assert.match(bloquePdf, /cantidad_trazabilidades_distintas/);
  assert.doesNotMatch(bloquePdf, /TOP\s+1/i);
  assert.match(bloqueDetalle, /cab\.id_catalogo_sdp IS NULL/);
  assert.match(bloqueDetalle, /cuartelHistorico\.codigo_cuartel/);
  assert.match(bloqueDetalle, /COUNT\(DISTINCT coincidencia\.codigo_trazabilidad\)/);
  assert.match(contenido, /WHEN trazabilidadHistorica\.cantidad_trazabilidades_distintas = 1/);
  assert.match(contenido, /NULLIF\(NULLIF\(NULLIF\(LTRIM\(RTRIM\(CONVERT\(nvarchar\(100\), mb\.codigo_trazabilidad\)\)\), ''\), 'N\/A'\), 'S\/SDP'\)/);
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
