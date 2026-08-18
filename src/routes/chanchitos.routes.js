const express = require('express');
const multer = require('multer');
const ChanchitosController = require('../controllers/chanchitos.controller');
const { ensureAuthenticated } = require('../middlewares/auth.middleware');
const { ensureAdmin } = require('../middlewares/role.middleware');

const router = express.Router();
const chanchitosController = new ChanchitosController();
const uploadImagenes = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024, files: 3 },
  fileFilter: (req, file, callback) => {
    const permitidos = new Set(['image/jpeg', 'image/png', 'image/webp']);
    if (!permitidos.has(file.mimetype)) {
      const error = new Error('MIME_IMAGEN_INVALIDO');
      error.userMessage = 'Solo se permiten imagenes JPEG, PNG o WebP.';
      return callback(error);
    }
    return callback(null, true);
  },
});
const recibirImagenes = (req, res, next) => {
  uploadImagenes.array('imagenes', 3)(req, res, (error) => {
    if (error) req.uploadImagenesError = error;
    next();
  });
};

router.get('/chanchitos/nuevo', ensureAuthenticated, chanchitosController.nuevo);
router.post('/chanchitos', ensureAuthenticated, recibirImagenes, chanchitosController.crear);
router.get('/chanchitos/pdf/general', ensureAuthenticated, chanchitosController.descargarPdfGeneral);
router.get('/chanchitos/historial', ensureAuthenticated, chanchitosController.mostrarHistorial);
router.post('/chanchitos/:id/eliminar', ensureAuthenticated, ensureAdmin, chanchitosController.eliminar);
router.get('/chanchitos/:id/detalle-parcial', ensureAuthenticated, chanchitosController.mostrarDetalleParcial);
router.get('/chanchitos/:idMonitoreo/imagenes/:posicion', ensureAuthenticated, chanchitosController.verImagen);
router.get('/chanchitos/:id', ensureAuthenticated, chanchitosController.mostrarDetalle);

module.exports = router;
