const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ChanchitosController = require('../src/controllers/chanchitos.controller');

test('entrega el PDF general de Chanchitos con headers seguros', async () => {
  const controller = new ChanchitosController({}, {
    generarReporteGeneral: async () => ({
      filename: 'reporte-chanchitos.pdf',
      buffer: Buffer.from('%PDF-prueba'),
      totalMonitoreos: 2,
      filtros: { fechaDesde: null, fechaHasta: null },
    }),
  });
  const headers = {};
  const response = {
    setHeader: (name, value) => { headers[name] = value; },
    send: (body) => body,
  };

  const body = await controller.descargarPdfGeneral({ query: {} }, response);

  assert.equal(body.toString(), '%PDF-prueba');
  assert.equal(headers['Content-Type'], 'application/pdf');
  assert.equal(headers['Content-Disposition'], 'attachment; filename="reporte-chanchitos.pdf"');
  assert.equal(headers['X-Content-Type-Options'], 'nosniff');
  assert.equal(headers['Cache-Control'], 'no-store');
});

test('la ruta del PDF general exige autenticacion', () => {
  const rutas = fs.readFileSync(path.join(__dirname, '..', 'src', 'routes', 'chanchitos.routes.js'), 'utf8');

  assert.match(rutas, /router\.get\('\/chanchitos\/pdf\/general', ensureAuthenticated, chanchitosController\.descargarPdfGeneral\)/);
});

test('entrega las tres posiciones de imagen con headers seguros y responde 404 si no existe', async () => {
  const buffer = Buffer.from([0xff, 0xd8, 0xff]);
  const solicitudes = [];
  const controller = new ChanchitosController({
    obtenerImagen: async (...args) => {
      solicitudes.push(args);
      if (args[1] === '4') throw new Error('IMAGEN_CHANCHITO_NO_DISPONIBLE');
      return { buffer, mime: 'image/jpeg' };
    },
  }, {});

  for (const posicion of ['1', '2', '3']) {
    const headers = {};
    const response = {
      setHeader: (name, value) => { headers[name] = value; },
      send: (body) => { response.body = body; return body; },
      status: (code) => { response.statusCode = code; return response; },
    };
    await controller.verImagen({ params: { idMonitoreo: '440', posicion } }, response);
    assert.equal(response.body, buffer);
    assert.equal(headers['Content-Type'], 'image/jpeg');
    assert.equal(headers['Content-Length'], buffer.length);
    assert.equal(headers['Content-Disposition'], 'inline');
    assert.equal(headers['X-Content-Type-Options'], 'nosniff');
  }

  const noDisponible = {
    status: (code) => { noDisponible.statusCode = code; return noDisponible; },
    send: (body) => { noDisponible.body = body; return body; },
  };
  await controller.verImagen({ params: { idMonitoreo: '440', posicion: '4' } }, noDisponible);
  assert.equal(noDisponible.statusCode, 404);
  assert.match(noDisponible.body, /Imagen no disponible/);
  assert.deepEqual(solicitudes.map((args) => args[1]), ['1', '2', '3', '4']);
});

test('el detalle parcial reutiliza obtenerDetalle y renderiza solo el fragmento', async () => {
  const llamadas = [];
  const controller = new ChanchitosController({
    obtenerDetalle: async (idMonitoreo) => {
      llamadas.push(idMonitoreo);
      return { idMonitoreo: 440, matriz: [] };
    },
  }, {});
  const response = {
    render(view, data) { this.view = view; this.data = data; return data; },
  };

  await controller.mostrarDetalleParcial({ params: { id: '440' } }, response);

  assert.deepEqual(llamadas, ['440']);
  assert.equal(response.view, 'chanchitos/partials/detalle-monitoreo');
  assert.equal(response.data.detalle.idMonitoreo, 440);
  assert.notEqual(response.view, 'layouts/main');
});

test('el detalle parcial responde fragmentos de error para 404 y 500', async () => {
  for (const [errorMessage, statusEsperado] of [['CHANCHITO_NO_EXISTE', 404], ['FALLA_SQL', 500]]) {
    const controller = new ChanchitosController({
      obtenerDetalle: async () => { throw new Error(errorMessage); },
    }, {});
    const response = {
      statusCode: 200,
      status(code) { this.statusCode = code; return this; },
      render(view, data) { this.view = view; this.data = data; return data; },
    };

    await controller.mostrarDetalleParcial({ params: { id: '999' } }, response);

    assert.equal(response.statusCode, statusEsperado);
    assert.equal(response.view, 'chanchitos/partials/detalle-error');
    assert.notEqual(response.view, 'layouts/main');
  }
});

test('eliminar redirige con exito, filtros y paginacion preservados', async () => {
  const llamadas = [];
  const controller = new ChanchitosController({
    eliminarMonitoreo: async (...args) => {
      llamadas.push(args);
      return { success: true, idMonitoreo: 440, detallesEliminados: 12 };
    },
    normalizarFiltrosHistorial: (values) => ({
      fechaDesde: values.fechaDesde || null,
      fechaHasta: values.fechaHasta || null,
      genFundo: Number(values.genFundo) || null,
      genCampo: Number(values.genCampo) || null,
      genVariedad: null,
      idCatalogoSdp: null,
      idMonitoreador: null,
      idEstadoFenologico: null,
      deteccion: values.deteccion || '',
      pagina: Number(values.pagina) || 1,
      pageSize: Number(values.pageSize) || 10,
    }),
  }, {});
  const response = { redirect(url) { this.url = url; return url; } };
  const body = { fechaDesde: '2026-08-01', fechaHasta: '2026-08-13', genFundo: '8', genCampo: '26', deteccion: 'CON_DETECCION', pagina: '2', pageSize: '25' };

  await controller.eliminar({ params: { id: '440' }, body, session: { usuario: { id: 1, rol: 'admin' } } }, response);

  assert.deepEqual(llamadas, [['440', { id: 1, rol: 'admin' }]]);
  assert.match(response.url, /^\/chanchitos\/historial\?/);
  ['fechaDesde=2026-08-01', 'genFundo=8', 'genCampo=26', 'deteccion=CON_DETECCION', 'pagina=2', 'pageSize=25', 'eliminado=1'].forEach((item) => assert.match(response.url, new RegExp(item)));
});

test('eliminar traduce ausencia y errores inesperados a mensajes controlados', async () => {
  const crearController = (resultado) => new ChanchitosController({
    eliminarMonitoreo: async () => {
      if (resultado instanceof Error) throw resultado;
      return resultado;
    },
    normalizarFiltrosHistorial: () => ({ pagina: 1, pageSize: 10, deteccion: '' }),
  }, {});

  for (const [resultado, esperado] of [
    [{ success: false, reason: 'CHANCHITO_NO_EXISTE' }, 'error=no-encontrado'],
    [new Error('FALLA_SQL'), 'error=eliminacion'],
  ]) {
    const response = { redirect(url) { this.url = url; return url; } };
    await crearController(resultado).eliminar({ params: { id: '999' }, body: {}, session: { usuario: { rol: 'admin' } } }, response);
    assert.match(response.url, new RegExp(esperado));
  }
});
