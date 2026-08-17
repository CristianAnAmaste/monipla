const fs = require('fs');
const path = require('path');
const NavigationService = require('../services/navigation.service');

class ReactAppController {
  constructor({
    navigationService = new NavigationService(),
    fsModule = fs,
    distDirectory = path.join(__dirname, '..', '..', 'frontend', 'dist'),
  } = {}) {
    this.navigationService = navigationService;
    this.fs = fsModule;
    this.indexPath = path.join(distDirectory, 'index.html');

    this.index = this.index.bind(this);
    this.bootstrap = this.bootstrap.bind(this);
  }

  index(req, res) {
    if (!this.fs.existsSync(this.indexPath)) {
      return res.status(503).type('text/plain').send('La aplicación no está disponible en este momento.');
    }

    return res.sendFile(this.indexPath);
  }

  bootstrap(req, res) {
    const usuario = req.session.usuario;
    const menu = this.navigationService.buildMenu(usuario, req.path);

    return res.json({
      user: {
        nombre: usuario.nombre || '',
        rol: usuario.rol || '',
        sede: usuario.sede || '',
      },
      menu,
      currentPath: '/app',
    });
  }
}

module.exports = ReactAppController;
