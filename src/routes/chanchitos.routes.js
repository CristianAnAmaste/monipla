const express = require('express');
const ChanchitosController = require('../controllers/chanchitos.controller');
const { ensureAuthenticated } = require('../middlewares/auth.middleware');

const router = express.Router();
const chanchitosController = new ChanchitosController();

router.get('/chanchitos/nuevo', ensureAuthenticated, chanchitosController.nuevo);
router.post('/chanchitos', ensureAuthenticated, chanchitosController.crear);

module.exports = router;
