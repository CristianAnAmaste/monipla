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
    this.mostrarDetalle = this.mostrarDetalle.bind(this);
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
        req.session.usuario
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

      return this.renderHistorial(res.status(500), resultado);
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
      values: data.values,
      opciones: data.opciones || { fundos: [], monitoreadores: [], estadosFenologicos: [] },
      registros: data.registros || [],
      resumen: data.resumen,
      paginacion: data.paginacion,
    });
  }
}

module.exports = ChanchitosController;
