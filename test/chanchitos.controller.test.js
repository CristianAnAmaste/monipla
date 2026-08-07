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
