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
    this.obtenerHistorialChanchitos = this.obtenerHistorialChanchitos.bind(this);
    this.obtenerDetalleChanchitos = this.obtenerDetalleChanchitos.bind(this);
    this.eliminarMonitoreoChanchitos = this.eliminarMonitoreoChanchitos.bind(this);
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
        req.session.usuario,
        {
          files: req.files,
          uploadError: req.uploadImagenesError,
        },
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
      const status = [400, 403, 409].includes(Number(error.statusCode))
        ? Number(error.statusCode)
        : 500;
      const messages = {
        400: 'No fue posible validar la información enviada.',
        403: 'No tienes permisos para realizar esta acción.',
        409: 'No fue posible guardar el monitoreo por un conflicto de datos.',
        500: 'No fue posible guardar el Monitoreo de Chanchitos. Revise los datos e intente nuevamente.',
      };

      return res.status(status).json({
        success: false,
        message: messages[status],
      });
    }
  }

  async obtenerHistorialChanchitos(req, res) {
    try {
      const result = await this.chanchitosService.obtenerHistorial(req.query || {});

      if (!result.success) {
        return res.status(400).json({
          success: false,
          errors: result.errors || [],
          data: {
            values: result.values,
            opciones: result.opciones,
            resumen: result.resumen,
            paginacion: result.paginacion,
          },
        });
      }

      return res.json({
        success: true,
        data: {
          ...result,
          puedeEliminar: req.session.usuario?.rol === 'admin',
        },
      });
    } catch (error) {
      console.error('[MONIPLA][REACT][CHANCHITOS][HISTORIAL][ERROR]', error);
      return res.status(500).json({
        success: false,
        message: 'No fue posible cargar el historial de Chanchito Blanco.',
      });
    }
  }

  async obtenerDetalleChanchitos(req, res) {
    if (!/^\d+$/.test(String(req.params.id || '')) || Number(req.params.id) <= 0) {
      return res.status(400).json({
        success: false,
        message: 'El identificador del monitoreo no es válido.',
      });
    }

    try {
      const detalle = await this.chanchitosService.obtenerDetalle(req.params.id);
      return res.json({ success: true, data: detalle });
    } catch (error) {
      const status = error.message === 'CHANCHITO_NO_EXISTE' ? 404 : 500;
      console.error('[MONIPLA][REACT][CHANCHITOS][DETALLE][ERROR]', {
        idMonitoreo: req.params.id,
        error: error.message,
      });
      return res.status(status).json({
        success: false,
        message: status === 404
          ? 'El monitoreo de Chanchito Blanco solicitado no existe.'
          : 'No fue posible cargar el detalle del monitoreo.',
      });
    }
  }

  async eliminarMonitoreoChanchitos(req, res) {
    try {
      const result = await this.chanchitosService.eliminarMonitoreo(
        req.params.id,
        req.session.usuario,
      );

      if (result.success) {
        return res.json({ success: true, data: result });
      }

      const responses = {
        ID_INVALIDO: [400, 'El identificador del monitoreo no es válido.'],
        NO_AUTORIZADO: [403, 'No tiene permisos para eliminar monitoreos.'],
        CHANCHITO_NO_EXISTE: [404, 'El monitoreo seleccionado no existe.'],
        CHANCHITO_CON_IMAGENES: [409, 'No fue posible eliminar el monitoreo porque tiene imágenes asociadas.'],
      };
      const [status, message] = responses[result.reason] || [500, 'No fue posible eliminar el monitoreo.'];

      return res.status(status).json({ success: false, error: result.reason, message });
    } catch (error) {
      console.error('[MONIPLA][REACT][CHANCHITOS][ELIMINAR][ERROR]', {
        idMonitoreo: req.params.id,
        error: error.message,
      });
      return res.status(500).json({
        success: false,
        message: 'No fue posible eliminar el monitoreo.',
      });
    }
  }
}

module.exports = ReactAppController;
