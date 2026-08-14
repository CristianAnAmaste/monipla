const express = require('express');
const ChanchitosController = require('../controllers/chanchitos.controller');
const { ensureAuthenticated } = require('../middlewares/auth.middleware');

const router = express.Router();
const chanchitosController = new ChanchitosController();

router.get('/chanchitos/nuevo', ensureAuthenticated, chanchitosController.nuevo);
router.post('/chanchitos', ensureAuthenticated, chanchitosController.crear);
router.get('/chanchitos/pdf/general', ensureAuthenticated, chanchitosController.descargarPdfGeneral);
router.get('/chanchitos/historial', ensureAuthenticated, chanchitosController.mostrarHistorial);
router.get('/chanchitos/:id', ensureAuthenticated, chanchitosController.mostrarDetalle);

module.exports = router;
