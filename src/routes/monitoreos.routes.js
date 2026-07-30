const express = require('express');
const multer = require('multer');
const MonitoreosController = require('../controllers/monitoreos.controller');
const { ensureAuthenticated } = require('../middlewares/auth.middleware');
const { ensureAdmin } = require('../middlewares/role.middleware');

const router = express.Router();
const monitoreosController = new MonitoreosController();
const uploadImagenes = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 8 * 1024 * 1024,
    files: 3,
  },
  fileFilter: (req, file, callback) => {
    const permitidos = new Set(['image/jpeg', 'image/png', 'image/webp']);

    if (!permitidos.has(file.mimetype)) {
      return callback(new Error('Solo se permiten imagenes JPG, PNG o WebP.'));
    }

    return callback(null, true);
  },
});

const recibirImagenesResultados = (req, res, next) => {
  const middleware = uploadImagenes.fields([
    { name: 'imagen1', maxCount: 1 },
    { name: 'imagen2', maxCount: 1 },
    { name: 'imagen3', maxCount: 1 },
  ]);

  middleware(req, res, (error) => {
    if (error) {
      req.uploadImagenesError = error;
    }

    next();
  });
};

router.get('/monitoreos/nuevo', ensureAuthenticated, monitoreosController.nuevo);
router.post('/monitoreos', ensureAuthenticated, monitoreosController.crear);
router.get(
  '/monitoreos/:idMuestreo/resultados',
  ensureAuthenticated,
  monitoreosController.mostrarFormularioResultados
);
router.post(
  '/monitoreos/:idMuestreo/resultados',
  ensureAuthenticated,
  recibirImagenesResultados,
  monitoreosController.guardarResultados
);
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
router.post(
  '/monitoreos/:idMuestreo/eliminar',
  ensureAuthenticated,
  ensureAdmin,
  monitoreosController.eliminar
);
router.get('/monitoreos/imagenes/:idImagen', ensureAuthenticated, monitoreosController.verImagen);
router.get('/monitoreos/:idMuestreo/pdf', ensureAuthenticated, monitoreosController.descargarPdf);
router.get('/monitoreos/:idMuestreo/detalle-parcial', ensureAuthenticated, monitoreosController.detalleParcial);
router.get('/monitoreos/:idMuestreo/detalle', ensureAuthenticated, monitoreosController.detalle);
router.get('/monitoreos/editar', ensureAuthenticated, monitoreosController.editar);

module.exports = router;
