const ChanchitosService = require('../services/chanchitos.service');
const ChanchitosPdfService = require('../services/chanchitosPdf.service');

class ChanchitosController {
  constructor(
    chanchitosService = new ChanchitosService(),
    chanchitosPdfService = new ChanchitosPdfService()
  ) {
    this.chanchitosService = chanchitosService;
    this.chanchitosPdfService = chanchitosPdfService;
    this.nuevo = this.nuevo.bind(this);
    this.crear = this.crear.bind(this);
    this.mostrarHistorial = this.mostrarHistorial.bind(this);
    this.eliminar = this.eliminar.bind(this);
    this.mostrarDetalleParcial = this.mostrarDetalleParcial.bind(this);
    this.mostrarDetalle = this.mostrarDetalle.bind(this);
    this.verImagen = this.verImagen.bind(this);
    this.descargarPdfGeneral = this.descargarPdfGeneral.bind(this);
  }

  async nuevo(req, res) {
    try {
      const formulario = await this.chanchitosService.getFormularioData();

      return this.renderNuevo(res, {
        ...formulario,
        errors: [],
        success: req.query.creado === '1'
          ? 'Monitoreo de Chanchitos guardado correctamente.'
          : null,
        resumenCatalogo: null,
      });
    } catch (error) {
      console.error('[MONIPLA][CHANCHITOS][GET][ERROR]', error);

      return this.renderNuevo(res.status(500), {
        values: this.chanchitosService.getValoresIniciales(),
        opciones: {
          fundos: [],
          estadosFenologicos: [],
          monitoreadores: [],
        },
        errors: ['No fue posible cargar el formulario de Monitoreo de Chanchitos.'],
        success: null,
        resumenCatalogo: null,
      });
    }
  }

  async crear(req, res) {
    try {
      const result = await this.chanchitosService.guardarMonitoreo(
        req.body,
        req.session.usuario,
        {
          files: req.files,
          uploadError: req.uploadImagenesError,
        }
      );

      if (result.success) {
        return res.redirect('/chanchitos/nuevo?creado=1');
      }

      const formulario = await this.chanchitosService.getFormularioData(result.values);

      return this.renderNuevo(res.status(400), {
        ...formulario,
        errors: result.errors,
        success: null,
        resumenCatalogo: result.resumenCatalogo || null,
      });
    } catch (error) {
      console.error('[MONIPLA][CHANCHITOS][POST][ERROR]', error);

      let formulario;

      try {
        formulario = await this.chanchitosService.getFormularioData(
          this.chanchitosService.normalizarEntrada(req.body)
        );
      } catch (formError) {
        formulario = {
          values: this.chanchitosService.normalizarEntrada(req.body),
          opciones: {
            fundos: [],
            estadosFenologicos: [],
            monitoreadores: [],
          },
        };
      }

      return this.renderNuevo(res.status(500), {
        ...formulario,
        errors: ['No fue posible guardar el Monitoreo de Chanchitos. Revise los datos e intente nuevamente.'],
        success: null,
        resumenCatalogo: null,
      });
    }
  }

  async descargarPdfGeneral(req, res) {
    try {
      const pdf = await this.chanchitosPdfService.generarReporteGeneral(req.query);

      console.info('[MONIPLA][CHANCHITOS][PDF_GENERAL]', {
        filtros: pdf.filtros,
        totalMonitoreos: pdf.totalMonitoreos,
        consultaMs: pdf.metricas && pdf.metricas.consultaMs,
        renderMs: pdf.metricas && pdf.metricas.renderMs,
      });

      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="${pdf.filename}"`);
      res.setHeader('Content-Length', pdf.buffer.length);
      res.setHeader('X-Content-Type-Options', 'nosniff');
      res.setHeader('Cache-Control', 'no-store');

      return res.send(pdf.buffer);
    } catch (error) {
      const status = error.message === 'FILTROS_REPORTE_INVALIDOS' ? 400 : 500;
      console.error('[MONIPLA][CHANCHITOS][PDF_GENERAL][ERROR]', {
        filtros: req.query,
        error: error.message,
      });

      return res.status(status).render('layouts/main', {
        title: 'Reporte general de Chanchitos',
        contentView: '../monitoreos/placeholder',
        pageTitle: 'Reporte no disponible',
        pageMessage: status === 400
          ? 'Los filtros de fecha no son validos para generar el reporte.'
          : 'No fue posible generar el reporte general de Chanchitos.',
      });
    }
  }

  async mostrarHistorial(req, res) {
    try {
      const resultado = await this.chanchitosService.obtenerHistorial(req.query);
      resultado.successMessage = this.getMensajeExitoHistorial(req.query);
      resultado.error = this.getMensajeErrorHistorial(req.query);
      resultado.puedeEliminar = Boolean(req.session && req.session.usuario && req.session.usuario.rol === 'admin');

      return this.renderHistorial(res.status(resultado.success ? 200 : 400), resultado);
    } catch (error) {
      console.error('[MONIPLA][CHANCHITOS][HISTORIAL][ERROR]', { filtros: req.query, error: error.message });
      const values = this.chanchitosService.normalizarFiltrosHistorial(req.query);
      let opciones = { fundos: [], monitoreadores: [], estadosFenologicos: [] };
      try {
        opciones = await this.chanchitosService.obtenerOpcionesHistorial();
      } catch (_) {
        // Mantiene los filtros recibidos aunque los catálogos livianos no estén disponibles.
      }
      const resultado = this.chanchitosService.crearResultadoHistorialInvalido(
        values,
        ['No fue posible cargar el historial de Chanchito Blanco.']
      );
      resultado.opciones = opciones;
      resultado.successMessage = this.getMensajeExitoHistorial(req.query);
      resultado.error = this.getMensajeErrorHistorial(req.query);
      resultado.puedeEliminar = Boolean(req.session && req.session.usuario && req.session.usuario.rol === 'admin');

      return this.renderHistorial(res.status(500), resultado);
    }
  }

  async eliminar(req, res) {
    const idMonitoreo = req.params.id;
    const filtros = req.body || {};

    try {
      const result = await this.chanchitosService.eliminarMonitoreo(
        idMonitoreo,
        req.session && req.session.usuario
      );
      console.info('[MONIPLA][CHANCHITOS][ELIMINAR]', {
        idMonitoreo,
        success: result.success,
        reason: result.reason || null,
      });

      return res.redirect(this.construirUrlHistorial(filtros, result.success ? 'eliminado' : result.reason));
    } catch (error) {
      console.error('[MONIPLA][CHANCHITOS][ELIMINAR][ERROR]', {
        idMonitoreo,
        error: error.message,
      });

      return res.redirect(this.construirUrlHistorial(filtros, 'ERROR_ELIMINACION'));
    }
  }

  async mostrarDetalle(req, res) {
    try {
      const detalle = await this.chanchitosService.obtenerDetalle(req.params.id);

      return res.render('layouts/main', {
        title: 'Detalle Monitoreo Chanchito Blanco',
        contentView: '../chanchitos/detalle',
        detalle,
      });
    } catch (error) {
      const status = error.message === 'CHANCHITO_NO_EXISTE' ? 404 : 500;
      console.error('[MONIPLA][CHANCHITOS][DETALLE][ERROR]', { id: req.params.id, error: error.message });

      return res.status(status).render('layouts/main', {
        title: 'Detalle de Chanchito Blanco',
        contentView: '../monitoreos/placeholder',
        pageTitle: status === 404 ? 'Monitoreo no disponible' : 'Detalle no disponible',
        pageMessage: status === 404
          ? 'El monitoreo de Chanchito Blanco solicitado no existe.'
          : 'No fue posible cargar el detalle del monitoreo.',
      });
    }
  }

  async mostrarDetalleParcial(req, res) {
    try {
      const detalle = await this.chanchitosService.obtenerDetalle(req.params.id);

      return res.render('chanchitos/partials/detalle-monitoreo', { detalle });
    } catch (error) {
      const status = error.message === 'CHANCHITO_NO_EXISTE' ? 404 : 500;
      console.error('[MONIPLA][CHANCHITOS][DETALLE_PARCIAL][ERROR]', {
        id: req.params.id,
        error: error.message,
      });

      return res.status(status).render('chanchitos/partials/detalle-error', {
        message: status === 404
          ? 'El monitoreo de Chanchito Blanco solicitado no existe.'
          : 'No fue posible cargar el detalle del monitoreo.',
      });
    }
  }

  async verImagen(req, res) {
    try {
      const imagen = await this.chanchitosService.obtenerImagen(
        req.params.idMonitoreo,
        req.params.posicion
      );

      res.setHeader('Content-Type', imagen.mime);
      res.setHeader('Content-Length', imagen.buffer.length);
      res.setHeader('Content-Disposition', 'inline');
      res.setHeader('X-Content-Type-Options', 'nosniff');
      res.setHeader('Cache-Control', 'private, max-age=3600');

      return res.send(imagen.buffer);
    } catch (error) {
      const status = error.message === 'IMAGEN_CHANCHITO_NO_DISPONIBLE' ? 404 : 500;
      console.error('[MONIPLA][CHANCHITOS][IMAGEN][ERROR]', {
        idMonitoreo: req.params.idMonitoreo,
        posicion: req.params.posicion,
        error: error.message,
      });
      return res.status(status).send('Imagen no disponible.');
    }
  }

  renderNuevo(res, data) {
    return res.render('layouts/main', {
      title: 'Registrar Monitoreo de Chanchitos',
      contentView: '../chanchitos/nuevo',
      errors: data.errors || [],
      success: data.success || null,
      values: data.values,
      opciones: data.opciones,
      resumenCatalogo: data.resumenCatalogo || null,
    });
  }

  renderHistorial(res, data) {
    return res.render('layouts/main', {
      title: 'Historial Chanchito Blanco',
      contentView: '../chanchitos/historial',
      errors: data.errors || [],
      success: data.successMessage || null,
      error: data.error || null,
      puedeEliminar: Boolean(data.puedeEliminar),
      values: data.values,
      opciones: data.opciones || { fundos: [], monitoreadores: [], estadosFenologicos: [] },
      registros: data.registros || [],
      resumen: data.resumen,
      paginacion: data.paginacion,
    });
  }

  construirUrlHistorial(body = {}, estado = '') {
    const values = this.chanchitosService.normalizarFiltrosHistorial(body);
    const params = new URLSearchParams();
    const filtrosPermitidos = [
      'fechaDesde',
      'fechaHasta',
      'genFundo',
      'genCampo',
      'genVariedad',
      'idCatalogoSdp',
      'idMonitoreador',
      'idEstadoFenologico',
      'deteccion',
      'pagina',
      'pageSize',
    ];

    filtrosPermitidos.forEach((key) => {
      if (values[key]) {
        params.set(key, values[key]);
      }
    });

    if (estado === 'eliminado') {
      params.set('eliminado', '1');
    } else if (estado === 'CHANCHITO_NO_EXISTE') {
      params.set('error', 'no-encontrado');
    } else if (estado === 'NO_AUTORIZADO') {
      params.set('error', 'no-autorizado');
    } else {
      params.set('error', 'eliminacion');
    }

    return `/chanchitos/historial?${params.toString()}`;
  }

  getMensajeExitoHistorial(query = {}) {
    return query.eliminado === '1'
      ? 'Monitoreo de Chanchito Blanco eliminado correctamente.'
      : null;
  }

  getMensajeErrorHistorial(query = {}) {
    const mensajes = {
      'no-encontrado': 'El monitoreo seleccionado ya no existe o fue eliminado anteriormente.',
      'no-autorizado': 'No tiene permisos para eliminar monitoreos.',
      eliminacion: 'No fue posible eliminar el monitoreo. Intente nuevamente.',
    };

    return mensajes[query.error] || null;
  }
}

module.exports = ChanchitosController;
