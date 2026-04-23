const MonitoreosService = require('../services/monitoreos.service');

class MonitoreosController {
  constructor(monitoreosService = new MonitoreosService()) {
    this.monitoreosService = monitoreosService;

    this.nuevo = this.nuevo.bind(this);
    this.crear = this.crear.bind(this);
    this.listarCampos = this.listarCampos.bind(this);
    this.listarVariedades = this.listarVariedades.bind(this);
    this.listarCuarteles = this.listarCuarteles.bind(this);
    this.historial = this.historial.bind(this);
    this.editar = this.editar.bind(this);
  }

  async nuevo(req, res) {
    try {
      const formulario = await this.monitoreosService.getFormularioData();
      return this.renderNuevo(res, formulario);
    } catch (error) {
      console.error('Error al cargar formulario de monitoreo', error);

      return res.status(500).render('layouts/main', {
        title: 'Registrar Monitoreo',
        contentView: '../monitoreos/nuevo',
        errors: ['No fue posible cargar el formulario de monitoreo.'],
        success: null,
        values: this.monitoreosService.getValoresIniciales(),
        opciones: {
          fundos: [],
          estructuras: [],
        },
      });
    }
  }

  async crear(req, res) {
    try {
      const result = await this.monitoreosService.validarPasoUno(req.body);
      const formulario = await this.monitoreosService.getFormularioData(result.values);

      if (!result.success) {
        return this.renderNuevo(res.status(400), {
          ...formulario,
          errors: result.errors,
          success: null,
        });
      }

      return this.renderNuevo(res, {
        ...formulario,
        errors: [],
        success: result.message,
      });
    } catch (error) {
      console.error('Error al validar formulario de monitoreo', error);

      const formulario = await this.monitoreosService.getFormularioData(
        this.monitoreosService.normalizarEntrada(req.body)
      );

      return this.renderNuevo(res.status(500), {
        ...formulario,
        errors: ['No fue posible procesar el formulario de monitoreo.'],
        success: null,
      });
    }
  }

  async listarCampos(req, res) {
    try {
      const campos = await this.monitoreosService.listarCampos(req.params.genFundo);
      return res.json({ success: true, data: campos });
    } catch (error) {
      console.error('Error al listar campos para monitoreo', error);
      return res.status(500).json({ success: false, message: 'No fue posible cargar los campos.' });
    }
  }

  async listarVariedades(req, res) {
    try {
      const variedades = await this.monitoreosService.listarVariedades(
        req.params.genFundo,
        req.params.genCampo
      );

      return res.json({ success: true, data: variedades });
    } catch (error) {
      console.error('Error al listar variedades para monitoreo', error);
      return res.status(500).json({ success: false, message: 'No fue posible cargar las variedades.' });
    }
  }

  async listarCuarteles(req, res) {
    try {
      const cuarteles = await this.monitoreosService.listarCuarteles(
        req.params.genFundo,
        req.params.genCampo,
        req.params.genVariedad
      );

      return res.json({ success: true, data: cuarteles });
    } catch (error) {
      console.error('Error al listar cuarteles para monitoreo', error);
      return res.status(500).json({ success: false, message: 'No fue posible cargar los cuarteles.' });
    }
  }

  historial(req, res) {
    return res.render('layouts/main', {
      title: 'Historial de Monitoreo',
      contentView: '../monitoreos/placeholder',
      pageTitle: 'Historial de Monitoreo',
      pageMessage: 'Modulo preparado para consultar monitoreos registrados.',
    });
  }

  editar(req, res) {
    return res.render('layouts/main', {
      title: 'Editar Monitoreo',
      contentView: '../monitoreos/placeholder',
      pageTitle: 'Editar Monitoreo',
      pageMessage: 'Modulo preparado para editar monitoreos existentes.',
    });
  }

  renderNuevo(res, data) {
    return res.render('layouts/main', {
      title: 'Registrar Monitoreo',
      contentView: '../monitoreos/nuevo',
      errors: data.errors || [],
      success: data.success || null,
      values: data.values,
      opciones: data.opciones,
    });
  }
}

module.exports = MonitoreosController;
