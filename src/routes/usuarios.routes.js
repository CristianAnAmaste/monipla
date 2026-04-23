const express = require('express');
const UsuariosController = require('../controllers/usuarios.controller');
const { ensureAuthenticated } = require('../middlewares/auth.middleware');
const { ensureAdmin } = require('../middlewares/role.middleware');

const router = express.Router();
const usuariosController = new UsuariosController();

router.get('/usuarios', ensureAuthenticated, ensureAdmin, usuariosController.index);
router.get('/usuarios/nuevo', ensureAuthenticated, ensureAdmin, usuariosController.nuevo);
router.post('/usuarios', ensureAuthenticated, ensureAdmin, usuariosController.crear);
router.get('/usuarios/:id/editar', ensureAuthenticated, ensureAdmin, usuariosController.editar);
router.post('/usuarios/:id/editar', ensureAuthenticated, ensureAdmin, usuariosController.actualizar);
router.get('/usuarios/:id/password', ensureAuthenticated, ensureAdmin, usuariosController.cambiarPassword);
router.post('/usuarios/:id/password', ensureAuthenticated, ensureAdmin, usuariosController.guardarPassword);
router.post('/usuarios/:id/toggle-activo', ensureAuthenticated, ensureAdmin, usuariosController.toggleActivo);

module.exports = router;
