const express = require('express');
const ReactAppController = require('../controllers/reactApp.controller');
const { ensureApiAuthenticated, ensureAuthenticated } = require('../middlewares/auth.middleware');

const router = express.Router();
const reactAppController = new ReactAppController();

router.get('/app', ensureAuthenticated, reactAppController.index);
router.get('/app/bootstrap', ensureApiAuthenticated, reactAppController.bootstrap);

module.exports = router;
