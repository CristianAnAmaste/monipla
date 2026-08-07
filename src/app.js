require('dotenv').config();

const express = require('express');
const path = require('path');
const session = require('express-session');

const authRoutes = require('./routes/auth.routes');
const homeRoutes = require('./routes/home.routes');
const usuariosRoutes = require('./routes/usuarios.routes');
const monitoreosRoutes = require('./routes/monitoreos.routes');
const chanchitosRoutes = require('./routes/chanchitos.routes');
const NavigationService = require('./services/navigation.service');

const app = express();
const PORT = process.env.PORT || 3000;
const navigationService = new NavigationService();

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

app.use(express.urlencoded({ extended: false }));
app.use(express.json());

app.use(express.static(path.join(__dirname, 'public')));

app.use(
  session({
    name: 'monitoreo.sid',
    secret: process.env.SESSION_SECRET || 'cambiar-este-secreto-en-env',
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 1000 * 60 * 60 * 8,
    },
  })
);

app.use((req, res, next) => {
  res.locals.usuario = req.session.usuario || null;
  res.locals.menuPrincipal = navigationService.buildMenu(req.session.usuario, req.path);
  res.locals.dashboardCards = [];
  res.locals.errors = [];
  res.locals.success = null;
  res.locals.error = null;
  res.locals.values = {};
  res.locals.opciones = {};
  res.locals.pageTitle = '';
  res.locals.pageMessage = '';
  next();
});

app.get('/', (req, res) => {
  if (req.session.usuario) {
    return res.redirect('/home');
  }

  return res.redirect('/login');
});

app.use(authRoutes);
app.use(homeRoutes);
app.use(usuariosRoutes);
app.use(monitoreosRoutes);
app.use(chanchitosRoutes);

app.use((req, res) => {
  res.status(404).render('layouts/main', {
    title: 'Pagina no encontrada',
    contentView: '../home/index',
    pageTitle: 'Pagina no encontrada',
    pageMessage: 'La ruta solicitada no existe.',
  });
});

app.use((error, req, res, next) => {
  console.error('Error no controlado', error);

  res.status(500).render('layouts/main', {
    title: 'Error',
    contentView: '../home/index',
    pageTitle: 'Error interno',
    pageMessage: 'Ocurrio un problema inesperado. Intente nuevamente.',
  });
});

app.listen(PORT, () => {
  console.log(`Monitoreo de Plagas escuchando en http://localhost:${PORT}`);
});

module.exports = app;
