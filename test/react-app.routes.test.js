const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ReactAppController = require('../src/controllers/reactApp.controller');
const HomeController = require('../src/controllers/home.controller');
const { ensureApiAuthenticated, ensureAuthenticated } = require('../src/middlewares/auth.middleware');

function createResponse() {
  return {
    statusCode: 200,
    status(code) { this.statusCode = code; return this; },
    type(value) { this.contentType = value; return this; },
    send(value) { this.body = value; return value; },
    sendFile(value) { this.file = value; return value; },
    json(value) { this.body = value; return value; },
    redirect(value) { this.redirectedTo = value; return value; },
  };
}

test('GET /app sin sesión redirige al login mediante el middleware de páginas', () => {
  const response = createResponse();

  ensureAuthenticated({ session: {} }, response, () => assert.fail('No debe continuar sin sesión'));

  assert.equal(response.redirectedTo, '/login');
});

test('GET /app con sesión intenta entregar el index React compilado', () => {
  const controller = new ReactAppController({
    distDirectory: path.join('frontend', 'dist'),
    fsModule: { existsSync: () => true },
  });
  const response = createResponse();

  controller.index({ session: { usuario: { nombre: 'Cristian Yanez' } } }, response);

  assert.match(response.file, /frontend[\\/]dist[\\/]index\.html$/);
});

test('GET /app devuelve un error controlado cuando falta el build', () => {
  const controller = new ReactAppController({
    fsModule: { existsSync: () => false },
  });
  const response = createResponse();

  controller.index({}, response);

  assert.equal(response.statusCode, 503);
  assert.equal(response.contentType, 'text/plain');
  assert.equal(response.body, 'La aplicación no está disponible en este momento.');
});

test('GET /app/bootstrap sin sesión responde 401 JSON sin redirigir', () => {
  const response = createResponse();

  ensureApiAuthenticated({ session: {} }, response, () => assert.fail('No debe continuar sin sesión'));

  assert.equal(response.statusCode, 401);
  assert.deepEqual(response.body, { error: 'NO_AUTENTICADO' });
  assert.equal(response.redirectedTo, undefined);
});

test('GET /app/bootstrap para admin incluye usuario seguro y /usuarios', () => {
  const navigationCalls = [];
  const controller = new ReactAppController({
    navigationService: {
      buildMenu(user, currentPath) {
        navigationCalls.push({ user, currentPath });
        return [{ href: '/home' }, { href: '/usuarios' }, { href: '/logout' }];
      },
    },
  });
  const response = createResponse();
  const usuario = {
    nombre: 'Cristian Yanez',
    rol: 'admin',
    sede: 'Copiapo',
    password: 'no-debe-salir',
    correo: 'no-necesario@ejemplo.cl',
  };

  controller.bootstrap({ session: { usuario }, path: '/bootstrap' }, response);

  assert.deepEqual(response.body.user, { nombre: 'Cristian Yanez', rol: 'admin', sede: 'Copiapo' });
  assert.equal(response.body.currentPath, '/app');
  assert.ok(response.body.menu.some((item) => item.href === '/usuarios'));
  assert.deepEqual(navigationCalls, [{ user: usuario, currentPath: '/bootstrap' }]);
  assert.doesNotMatch(JSON.stringify(response.body), /no-debe-salir|no-necesario@ejemplo\.cl/);
});

test('GET /app/bootstrap para usuario normal no incluye /usuarios', () => {
  const controller = new ReactAppController({
    navigationService: {
      buildMenu: () => [{ href: '/home' }, { href: '/logout' }],
    },
  });
  const response = createResponse();

  controller.bootstrap({
    session: { usuario: { nombre: 'Usuario Prueba', rol: 'usuario', sede: 'Copiapo' } },
    path: '/bootstrap',
  }, response);

  assert.equal(response.body.menu.some((item) => item.href === '/usuarios'), false);
});

test('GET /app/api/chanchitos/nuevo entrega los datos iniciales con sesión', async () => {
  const formulario = {
    values: { genFundo: '', idCatalogoSdp: '' },
    opciones: { fundos: [{ value: 10, label: 'Fundo Norte' }], estadosFenologicos: [], monitoreadores: [] },
  };
  const controller = new ReactAppController({
    chanchitosService: { getFormularioData: async () => formulario },
  });
  const response = createResponse();

  await controller.obtenerFormularioChanchitos({ session: { usuario: { id: 12 } } }, response);

  assert.deepEqual(response.body, { success: true, data: formulario });
});

test('POST /app/api/chanchitos reutiliza el servicio y responde creación JSON', async () => {
  const llamadas = [];
  const controller = new ReactAppController({
    chanchitosService: {
      guardarMonitoreo: async (...args) => {
        llamadas.push(args);
        return { success: true, id_monitoreo: 88 };
      },
    },
  });
  const response = createResponse();
  const body = { genFundo: '10', cantidad_1_1: '0' };
  const usuario = { id: 12, rol: 'usuario' };

  const files = [{ buffer: Buffer.from('uno') }, { buffer: Buffer.from('dos') }, { buffer: Buffer.from('tres') }];
  await controller.crearMonitoreoChanchitos({ body, files, session: { usuario } }, response);

  assert.equal(response.statusCode, 201);
  assert.deepEqual(response.body, { success: true, data: { idMonitoreo: 88 } });
  assert.deepEqual(llamadas, [[body, usuario, { files, uploadError: undefined }]]);
});

test('POST /app/api/chanchitos conserva los errores de validación del servicio', async () => {
  const controller = new ReactAppController({
    chanchitosService: {
      guardarMonitoreo: async () => ({
        success: false,
        errors: ['Debe seleccionar un cuartel valido.'],
        values: { idCatalogoSdp: '' },
        resumenCatalogo: null,
      }),
    },
  });
  const response = createResponse();

  await controller.crearMonitoreoChanchitos({ body: {}, session: { usuario: { id: 12 } } }, response);

  assert.equal(response.statusCode, 400);
  assert.deepEqual(response.body.errors, ['Debe seleccionar un cuartel valido.']);
  assert.deepEqual(response.body.values, { idCatalogoSdp: '' });
});

test('POST /app/api/chanchitos oculta errores inesperados del servicio', async () => {
  const controller = new ReactAppController({
    chanchitosService: { guardarMonitoreo: async () => { throw new Error('FALLA_SQL_INTERNA'); } },
  });
  const response = createResponse();

  await controller.crearMonitoreoChanchitos({ body: {}, session: { usuario: { id: 12 } } }, response);

  assert.equal(response.statusCode, 500);
  assert.deepEqual(response.body, {
    success: false,
    message: 'No fue posible guardar el Monitoreo de Chanchitos. Revise los datos e intente nuevamente.',
  });
});

test('GET /app/api/chanchitos/historial reutiliza el servicio y entrega paginación JSON', async () => {
  const historial = {
    success: true,
    values: { pagina: 2, pageSize: 25 },
    opciones: { fundos: [] },
    registros: [{ idMonitoreo: 91 }],
    resumen: { totalMonitoreos: 26 },
    paginacion: { pagina: 2, totalPaginas: 2, totalRegistros: 26 },
  };
  const calls = [];
  const controller = new ReactAppController({
    chanchitosService: { obtenerHistorial: async (...args) => { calls.push(args); return historial; } },
  });
  const response = createResponse();

  await controller.obtenerHistorialChanchitos({
    query: { pagina: '2' },
    headers: { 'x-request-id': 'react-chanchitos-historial-7' },
    session: { usuario: { rol: 'admin' }, },
  }, response);

  assert.deepEqual(calls, [[{ pagina: '2' }, { requestId: 'react-chanchitos-historial-7' }]]);
  assert.equal(response.statusCode, 200);
  assert.equal(response.body.data.registros[0].idMonitoreo, 91);
  assert.equal(response.body.data.puedeEliminar, true);
});

test('GET /app/api/chanchitos/historial conserva parametros y tipos en la traza correlacionada', async () => {
  const controller = new ReactAppController({
    chanchitosService: { obtenerHistorial: async () => ({ success: true, opciones: {}, registros: [], resumen: {}, paginacion: {} }) },
  });
  const response = createResponse();

  await controller.obtenerHistorialChanchitos({
    query: { genFundo: '9', pagina: '1', pageSize: '10' },
    headers: { 'x-request-id': 'historial-fundo-9' },
    session: { usuario: { rol: 'usuario' } },
  }, response);

  assert.deepEqual(controller.describirParametrosHistorial({ genFundo: '9', pagina: '1', pageSize: '10' }), {
    genFundo: { tipo: 'string', valor: '9' },
    pagina: { tipo: 'string', valor: '1' },
    pageSize: { tipo: 'string', valor: '10' },
  });
  assert.equal(response.statusCode, 200);
});

test('GET /app/api/chanchitos/:id/detalle carga el detalle bajo demanda y controla 400 y 404', async () => {
  const controller = new ReactAppController({
    chanchitosService: { obtenerDetalle: async (id) => {
      if (id === '404') throw new Error('CHANCHITO_NO_EXISTE');
      return { idMonitoreo: 91, matriz: [] };
    } },
  });
  const validResponse = createResponse();
  await controller.obtenerDetalleChanchitos({ params: { id: '91' } }, validResponse);
  assert.deepEqual(validResponse.body, { success: true, data: { idMonitoreo: 91, matriz: [] } });

  const invalidResponse = createResponse();
  await controller.obtenerDetalleChanchitos({ params: { id: 'abc' } }, invalidResponse);
  assert.equal(invalidResponse.statusCode, 400);

  const missingResponse = createResponse();
  await controller.obtenerDetalleChanchitos({ params: { id: '404' } }, missingResponse);
  assert.equal(missingResponse.statusCode, 404);
});

test('DELETE /app/api/chanchitos reutiliza la autorización y eliminación existentes', async () => {
  const controller = new ReactAppController({
    chanchitosService: {
      eliminarMonitoreo: async (id, user) => user.rol === 'admin'
        ? { success: true, idMonitoreo: Number(id) }
        : { success: false, reason: 'NO_AUTORIZADO' },
    },
  });
  const adminResponse = createResponse();
  await controller.eliminarMonitoreoChanchitos({ params: { id: '91' }, session: { usuario: { rol: 'admin' } } }, adminResponse);
  assert.equal(adminResponse.statusCode, 200);
  assert.equal(adminResponse.body.data.idMonitoreo, 91);

  const userResponse = createResponse();
  await controller.eliminarMonitoreoChanchitos({ params: { id: '91' }, session: { usuario: { rol: 'usuario' } } }, userResponse);
  assert.equal(userResponse.statusCode, 403);
});

test('las rutas React usan los middlewares adecuados y /home conserva controller y vista', () => {
  const reactRoutes = fs.readFileSync(path.join(__dirname, '..', 'src', 'routes', 'reactApp.routes.js'), 'utf8');
  const homeRoutes = fs.readFileSync(path.join(__dirname, '..', 'src', 'routes', 'home.routes.js'), 'utf8');
  const appSource = fs.readFileSync(path.join(__dirname, '..', 'src', 'app.js'), 'utf8');

  assert.match(reactRoutes, /router\.get\('\/app', ensureAuthenticated, reactAppController\.index\)/);
  assert.match(reactRoutes, /router\.get\('\/app\/chanchitos\/nuevo', ensureAuthenticated, reactAppController\.index\)/);
  assert.match(reactRoutes, /router\.get\('\/app\/chanchitos\/historial', ensureAuthenticated, reactAppController\.index\)/);
  assert.match(reactRoutes, /router\.get\('\/app\/api\/chanchitos\/nuevo', ensureApiAuthenticated, reactAppController\.obtenerFormularioChanchitos\)/);
  assert.match(reactRoutes, /router\.get\('\/app\/api\/chanchitos\/historial', ensureApiAuthenticated, reactAppController\.obtenerHistorialChanchitos\)/);
  assert.match(reactRoutes, /router\.get\('\/app\/api\/chanchitos\/:id\/detalle', ensureApiAuthenticated, reactAppController\.obtenerDetalleChanchitos\)/);
  assert.match(reactRoutes, /router\.delete\('\/app\/api\/chanchitos\/:id', ensureApiAuthenticated, reactAppController\.eliminarMonitoreoChanchitos\)/);
  assert.match(reactRoutes, /chanchitosRoutes\.recibirImagenes/);
  assert.match(reactRoutes, /router\.post\([\s\S]*'\/app\/api\/chanchitos'[\s\S]*ensureApiAuthenticated[\s\S]*chanchitosRoutes\.recibirImagenes/);
  assert.match(reactRoutes, /router\.get\('\/app\/bootstrap', ensureApiAuthenticated, reactAppController\.bootstrap\)/);
  assert.match(homeRoutes, /router\.get\('\/home', ensureAuthenticated, homeController\.index\)/);
  assert.match(appSource, /app\.use\('\/react-app\/assets', express\.static/);
  assert.match(appSource, /app\.use\(reactAppRoutes\)/);
  assert.match(appSource, /app\.use\(chanchitosRoutes\)/);
});

test('POST /app/api/chanchitos entrega el error multipart compartido al servicio', async () => {
  const uploadError = new Error('LIMIT_FILE_COUNT');
  const calls = [];
  const controller = new ReactAppController({
    chanchitosService: {
      guardarMonitoreo: async (...args) => {
        calls.push(args);
        return { success: false, errors: ['Solo puedes adjuntar hasta tres imágenes.'] };
      },
    },
  });
  const response = createResponse();

  await controller.crearMonitoreoChanchitos({
    body: {},
    files: [],
    uploadImagenesError: uploadError,
    session: { usuario: { id: 12 } },
  }, response);

  assert.equal(response.statusCode, 400);
  assert.equal(calls[0][2].uploadError, uploadError);
});

test('/home conserva el controller y la vista actuales', () => {
  const controller = new HomeController({ buildCards: () => [{ href: '/monitoreos/nuevo' }] });
  const response = {
    render(view, data) { this.view = view; this.data = data; return data; },
  };

  controller.index({ session: { usuario: { nombre: 'Cristian Yanez' } } }, response);

  assert.equal(response.view, 'layouts/main');
  assert.equal(response.data.contentView, '../home/index');
  assert.equal(response.data.title, 'Inicio');
});
