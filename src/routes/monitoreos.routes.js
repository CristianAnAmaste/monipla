const express = require('express');
const MonitoreosController = require('../controllers/monitoreos.controller');
const { ensureAuthenticated } = require('../middlewares/auth.middleware');

const router = express.Router();
const monitoreosController = new MonitoreosController();

router.get('/monitoreos/nuevo', ensureAuthenticated, monitoreosController.nuevo);
router.post('/monitoreos', ensureAuthenticated, monitoreosController.crear);
router.post('/monitoreos/api/resumen-previo', ensureAuthenticated, monitoreosController.obtenerResumenPrevio);
router.get('/monitoreos/api/campos/:genFundo', ensureAuthenticated, monitoreosController.listarCampos);
router.get(
  '/monitoreos/api/variedades/:genFundo/:genCampo',
  ensureAuthenticated,
  monitoreosController.listarVariedades
);
router.get(
  '/monitoreos/api/cuarteles/:genFundo/:genCampo/:genVariedad',
  ensureAuthenticated,
  monitoreosController.listarCuarteles
);
router.get('/monitoreos/historial', ensureAuthenticated, monitoreosController.historial);
router.get('/monitoreos/editar', ensureAuthenticated, monitoreosController.editar);

module.exports = router;
