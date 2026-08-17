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

test('las rutas React usan los middlewares adecuados y /home conserva controller y vista', () => {
  const reactRoutes = fs.readFileSync(path.join(__dirname, '..', 'src', 'routes', 'reactApp.routes.js'), 'utf8');
  const homeRoutes = fs.readFileSync(path.join(__dirname, '..', 'src', 'routes', 'home.routes.js'), 'utf8');
  const appSource = fs.readFileSync(path.join(__dirname, '..', 'src', 'app.js'), 'utf8');

  assert.match(reactRoutes, /router\.get\('\/app', ensureAuthenticated, reactAppController\.index\)/);
  assert.match(reactRoutes, /router\.get\('\/app\/bootstrap', ensureApiAuthenticated, reactAppController\.bootstrap\)/);
  assert.match(homeRoutes, /router\.get\('\/home', ensureAuthenticated, homeController\.index\)/);
  assert.match(appSource, /app\.use\('\/react-app\/assets', express\.static/);
  assert.match(appSource, /app\.use\(reactAppRoutes\)/);
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
