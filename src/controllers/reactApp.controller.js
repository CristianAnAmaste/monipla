const fs = require('fs');
const path = require('path');
const NavigationService = require('../services/navigation.service');
const ChanchitosService = require('../services/chanchitos.service');

class ReactAppController {
  constructor({
    navigationService = new NavigationService(),
    chanchitosService = new ChanchitosService(),
    fsModule = fs,
    distDirectory = path.join(__dirname, '..', '..', 'frontend', 'dist'),
  } = {}) {
    this.navigationService = navigationService;
    this.chanchitosService = chanchitosService;
    this.fs = fsModule;
    this.indexPath = path.join(distDirectory, 'index.html');

    this.index = this.index.bind(this);
    this.bootstrap = this.bootstrap.bind(this);
    this.obtenerFormularioChanchitos = this.obtenerFormularioChanchitos.bind(this);
    this.crearMonitoreoChanchitos = this.crearMonitoreoChanchitos.bind(this);
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

  async obtenerFormularioChanchitos(req, res) {
    try {
      const formulario = await this.chanchitosService.getFormularioData();

      return res.json({ success: true, data: formulario });
    } catch (error) {
      console.error('[MONIPLA][REACT][CHANCHITOS][FORMULARIO][ERROR]', error);
      return res.status(500).json({
        success: false,
        message: 'No fue posible cargar el formulario de Monitoreo de Chanchitos.',
      });
    }
  }

  async crearMonitoreoChanchitos(req, res) {
    try {
      const result = await this.chanchitosService.guardarMonitoreo(
        req.body,
        req.session.usuario
      );

      if (!result.success) {
        return res.status(400).json({
          success: false,
          errors: result.errors || [],
          values: result.values || null,
          resumenCatalogo: result.resumenCatalogo || null,
        });
      }

      return res.status(201).json({
        success: true,
        data: { idMonitoreo: result.id_monitoreo },
      });
    } catch (error) {
      console.error('[MONIPLA][REACT][CHANCHITOS][CREAR][ERROR]', error);
      return res.status(500).json({
        success: false,
        message: 'No fue posible guardar el Monitoreo de Chanchitos. Revise los datos e intente nuevamente.',
      });
    }
  }
}

module.exports = ReactAppController;
