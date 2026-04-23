const express = require('express');
const HomeController = require('../controllers/home.controller');
const { ensureAuthenticated } = require('../middlewares/auth.middleware');

const router = express.Router();
const homeController = new HomeController();

router.get('/home', ensureAuthenticated, homeController.index);

module.exports = router;
