const express = require('express');
const ReactAppController = require('../controllers/reactApp.controller');
const { ensureApiAuthenticated, ensureAuthenticated } = require('../middlewares/auth.middleware');

const router = express.Router();
const reactAppController = new ReactAppController();

router.get('/app/api/chanchitos/nuevo', ensureApiAuthenticated, reactAppController.obtenerFormularioChanchitos);
router.post('/app/api/chanchitos', ensureApiAuthenticated, reactAppController.crearMonitoreoChanchitos);
router.get('/app/bootstrap', ensureApiAuthenticated, reactAppController.bootstrap);
router.get('/app/chanchitos/nuevo', ensureAuthenticated, reactAppController.index);
router.get('/app', ensureAuthenticated, reactAppController.index);

module.exports = router;
