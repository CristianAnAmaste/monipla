const ChanchitosService = require('../services/chanchitos.service');

class ChanchitosController {
  constructor(chanchitosService = new ChanchitosService()) {
    this.chanchitosService = chanchitosService;
    this.nuevo = this.nuevo.bind(this);
    this.crear = this.crear.bind(this);
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
}

module.exports = ChanchitosController;
