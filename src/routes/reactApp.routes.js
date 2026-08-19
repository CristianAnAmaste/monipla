const express = require('express');
const ReactAppController = require('../controllers/reactApp.controller');
const { ensureApiAuthenticated, ensureAuthenticated } = require('../middlewares/auth.middleware');
const chanchitosRoutes = require('./chanchitos.routes');

const router = express.Router();
const reactAppController = new ReactAppController();

router.get('/app/api/chanchitos/nuevo', ensureApiAuthenticated, reactAppController.obtenerFormularioChanchitos);
router.post(
  '/app/api/chanchitos',
  ensureApiAuthenticated,
  chanchitosRoutes.recibirImagenes,
  reactAppController.crearMonitoreoChanchitos,
);
router.get('/app/api/chanchitos/historial', ensureApiAuthenticated, reactAppController.obtenerHistorialChanchitos);
router.get('/app/api/chanchitos/:id/detalle', ensureApiAuthenticated, reactAppController.obtenerDetalleChanchitos);
router.delete('/app/api/chanchitos/:id', ensureApiAuthenticated, reactAppController.eliminarMonitoreoChanchitos);
router.get('/app/bootstrap', ensureApiAuthenticated, reactAppController.bootstrap);
router.get('/app/chanchitos/nuevo', ensureAuthenticated, reactAppController.index);
router.get('/app/chanchitos/historial', ensureAuthenticated, reactAppController.index);
router.get('/app', ensureAuthenticated, reactAppController.index);

module.exports = router;
