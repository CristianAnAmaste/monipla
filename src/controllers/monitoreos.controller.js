const MonitoreosService = require('../services/monitoreos.service');

class MonitoreosController {
  constructor(monitoreosService = new MonitoreosService()) {
    this.monitoreosService = monitoreosService;

    this.nuevo = this.nuevo.bind(this);
    this.crear = this.crear.bind(this);
    this.mostrarFormularioResultados = this.mostrarFormularioResultados.bind(this);
    this.guardarResultados = this.guardarResultados.bind(this);
    this.obtenerResumenPrevio = this.obtenerResumenPrevio.bind(this);
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
      const result = await this.monitoreosService.guardarCabeceraMonitoreo(
        req.body,
        req.session.usuario
      );

      if (!result.success) {
        const formulario = await this.monitoreosService.getFormularioData(result.values);

        return this.renderNuevo(res.status(400), {
          ...formulario,
          errors: result.errors,
          success: null,
        });
      }

      return res.redirect(`/monitoreos/${result.id_muestreo}/resultados?cabecera=1`);
    } catch (error) {
      console.error('Error al guardar cabecera de monitoreo', error);

      let formulario;

      try {
        formulario = await this.monitoreosService.getFormularioData(
          this.monitoreosService.normalizarEntrada(req.body)
        );
      } catch (formError) {
        formulario = {
          values: this.monitoreosService.normalizarEntrada(req.body),
          opciones: {
            fundos: [],
            estructuras: [],
          },
        };
      }

      return this.renderNuevo(res.status(500), {
        ...formulario,
        errors: ['No fue posible guardar el monitoreo. Revise los datos e intente nuevamente.'],
        success: null,
      });
    }
  }

  async mostrarFormularioResultados(req, res) {
    try {
      console.info('[MONIPLA][RESULTADOS][GET]', {
        idMuestreo: req.params.idMuestreo,
      });

      const formulario = await this.monitoreosService.obtenerFormularioResultados(req.params.idMuestreo);
      const formularioVisible = formulario.muestreo.estado_resultado === 'PENDIENTE';

      console.info('[MONIPLA][RESULTADOS][GET]', {
        idMuestreo: formulario.muestreo.id_muestreo,
        estadoResultado: formulario.muestreo.estado_resultado,
        vista: formularioVisible ? 'FORMULARIO' : 'COMPLETADO',
      });

      return this.renderResultados(res, {
        ...formulario,
        errors: [],
        success: req.query.cabecera === '1'
          ? `Monitoreo guardado correctamente. Numero de muestreo: ${formulario.muestreo.numero_muestreo}.`
          : null,
        values: this.monitoreosService.getValoresInicialesResultados(),
      });
    } catch (error) {
      console.error('Error al cargar formulario de resultados', error);

      return res.status(404).render('layouts/main', {
        title: 'Registrar Resultados',
        contentView: '../monitoreos/placeholder',
        pageTitle: 'Muestreo no disponible',
        pageMessage: 'No fue posible cargar el muestreo solicitado para registrar resultados.',
      });
    }
  }

  async guardarResultados(req, res) {
    try {
      const payload = this.monitoreosService.normalizarResultadosEntrada(req.body);
      const filasRecibidas = Array.isArray(payload.resultados)
        ? payload.resultados.length
        : payload.plagas.reduce((total, plaga) => total + plaga.conteos.length, 0);

      console.info('[MONIPLA][RESULTADOS][POST]', {
        idMuestreo: req.params.idMuestreo,
        modo: payload.modoResultado,
        idUsuario: req.session.usuario && req.session.usuario.id,
        filasRecibidas,
      });

      const result = await this.monitoreosService.guardarResultadosMuestreo(
        req.params.idMuestreo,
        req.body,
        req.session.usuario
      );

      const formulario = await this.monitoreosService.obtenerFormularioResultados(req.params.idMuestreo);

      if (!result.success) {
        return this.renderResultados(res.status(400), {
          ...formulario,
          errors: result.errors,
          success: null,
          values: result.values,
        });
      }

      return this.renderResultados(res, {
        ...formulario,
        errors: [],
        success: result.estado_resultado === 'SIN_PLAGAS'
          ? `Muestreo N° ${formulario.muestreo.numero_muestreo} marcado correctamente como sin plagas detectadas.`
          : `Resultados guardados correctamente para el muestreo N° ${formulario.muestreo.numero_muestreo}.`,
        values: this.monitoreosService.getValoresInicialesResultados(),
      });
    } catch (error) {
      console.error('Error al guardar resultados de monitoreo', error);

      let formulario;

      try {
        formulario = await this.monitoreosService.obtenerFormularioResultados(req.params.idMuestreo);
      } catch (formError) {
        return res.status(404).render('layouts/main', {
          title: 'Registrar Resultados',
          contentView: '../monitoreos/placeholder',
          pageTitle: 'Muestreo no disponible',
          pageMessage: 'No fue posible cargar el muestreo solicitado para registrar resultados.',
        });
      }

      return this.renderResultados(res.status(500), {
        ...formulario,
        errors: ['No fue posible guardar los resultados. Revise los datos e intente nuevamente.'],
        success: null,
        values: this.monitoreosService.normalizarResultadosEntrada(req.body),
      });
    }
  }

  async obtenerResumenPrevio(req, res) {
    try {
      const result = await this.monitoreosService.obtenerResumenPrevio(req.body);

      if (!result.success) {
        return res.status(400).json({
          success: false,
          errors: result.errors,
        });
      }

      return res.json({
        success: true,
        data: result.resumen,
      });
    } catch (error) {
      console.error('Error al obtener resumen previo del monitoreo', error);
      return res.status(500).json({
        success: false,
        message: 'No fue posible generar el resumen previo del monitoreo.',
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

  renderResultados(res, data) {
    return res.render('layouts/main', {
      title: 'Registrar Resultados',
      contentView: '../monitoreos/resultados',
      errors: data.errors || [],
      success: data.success || null,
      muestreo: data.muestreo,
      values: data.values || this.monitoreosService.getValoresInicialesResultados(),
      opciones: data.opciones,
    });
  }
}

module.exports = MonitoreosController;
