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
    this.detalleParcial = this.detalleParcial.bind(this);
    this.descargarPdf = this.descargarPdf.bind(this);
    this.verImagen = this.verImagen.bind(this);
    this.detalle = this.detalle.bind(this);
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
          estadosFenologicos: [],
          muestreadores: [],
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
            estadosFenologicos: [],
            muestreadores: [],
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
      const imagenesRecibidas = this.monitoreosService.contarImagenesRecibidas(req.files);

      console.info('[MONIPLA][RESULTADOS][POST]', {
        idMuestreo: req.params.idMuestreo,
        modo: payload.modoResultado,
        idUsuario: req.session.usuario && req.session.usuario.id,
        filasRecibidas,
        imagenesRecibidas,
      });

      const result = await this.monitoreosService.guardarResultadosMuestreo(
        req.params.idMuestreo,
        req.body,
        req.session.usuario,
        {
          files: req.files,
          uploadError: req.uploadImagenesError,
        }
      );

      const formulario = await this.monitoreosService.obtenerFormularioResultados(req.params.idMuestreo);

      if (!result.success) {
        console.info('[MONIPLA][RESULTADOS][VALIDACION_ERROR]', {
          idMuestreo: req.params.idMuestreo,
          errores: result.errors,
          filasRecibidas,
        });

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
          ? `Monitoreo guardado sin plagas detectadas.${result.imagenes_insertadas ? ` Se adjuntaron ${result.imagenes_insertadas} imagenes de evidencia.` : ''}`
          : `Resultados guardados correctamente.${result.imagenes_insertadas ? ` Se adjuntaron ${result.imagenes_insertadas} imagenes de evidencia.` : ''}`,
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

  async historial(req, res) {
    try {
      const resultado = await this.monitoreosService.obtenerHistorialMonitoreos(req.query);

      console.info('[MONIPLA][HISTORIAL]', {
        filtros: resultado.values,
        pagina: resultado.paginacion.pagina,
        pageSize: resultado.paginacion.pageSize,
        totalRegistros: resultado.paginacion.totalRegistros,
        totalPaginas: resultado.paginacion.totalPaginas,
      });

      return this.renderHistorial(res.status(resultado.success ? 200 : 400), {
        errors: resultado.errors,
        values: resultado.values,
        opciones: resultado.opciones,
        registros: resultado.registros,
        paginacion: resultado.paginacion,
      });
    } catch (error) {
      console.error('[MONIPLA][HISTORIAL][ERROR]', {
        filtros: req.query,
        error: error.message,
      });

      return this.renderHistorial(res.status(500), {
        errors: ['No fue posible cargar el historial de monitoreos.'],
        values: this.monitoreosService.normalizarFiltrosHistorial(req.query),
        opciones: {
          fundos: [],
          campos: [],
          variedades: [],
          cuarteles: [],
          estructuras: [],
          plagas: [],
          tiposPlaga: [],
          estadosResultado: [],
        },
        registros: [],
        paginacion: {
          totalRegistros: 0,
          pagina: 1,
          pageSize: 10,
          totalPaginas: 1,
        },
      });
    }
  }

  async detalleParcial(req, res) {
    const { idMuestreo } = req.params;

    try {
      console.info('[MONIPLA][DETALLE][GET]', {
        idMuestreo,
      });

      const detalle = await this.monitoreosService.obtenerDetalleParcialMuestreo(idMuestreo);

      console.info('[MONIPLA][DETALLE][OK]', {
        idMuestreo: detalle.idMuestreo,
        estadoResultado: detalle.estadoResultado,
        totalPlagas: detalle.resumen.totalPlagas,
        totalConteos: detalle.resumen.totalConteos,
        totalImagenes: detalle.resumen.totalImagenes,
      });

      return res.render('monitoreos/partials/detalle-muestreo', {
        detalle,
      });
    } catch (error) {
      console.error('[MONIPLA][DETALLE][ERROR]', {
        idMuestreo,
        error: error.message,
      });

      const status = ['ID_MUESTREO_INVALIDO', 'MUESTREO_NO_EXISTE'].includes(error.message) ? 404 : 500;

      return res.status(status).send(`
        <div class="detalle-error" role="alert">
          No se pudo cargar el detalle del monitoreo.
        </div>
      `);
    }
  }

  async verImagen(req, res) {
    const { idImagen } = req.params;

    try {
      console.info('[MONIPLA][IMAGENES][GET]', {
        idImagen,
      });

      const imagen = await this.monitoreosService.obtenerImagenMuestreo(idImagen);

      console.info('[MONIPLA][IMAGENES][OK]', {
        idImagen: imagen.idImagen,
        mime: imagen.mime,
        bytes: imagen.buffer.length,
      });

      res.setHeader('Content-Type', imagen.mime);
      res.setHeader('X-Content-Type-Options', 'nosniff');
      res.setHeader('Cache-Control', 'private, max-age=3600');

      return res.send(imagen.buffer);
    } catch (error) {
      console.error('[MONIPLA][IMAGENES][ERROR]', {
        idImagen,
        error: error.message,
      });

      return res.status(404).send('Imagen no disponible.');
    }
  }

  async descargarPdf(req, res) {
    const { idMuestreo } = req.params;

    try {
      const pdf = await this.monitoreosService.generarPdfMuestreo(idMuestreo);

      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="${pdf.filename}"`);
      res.setHeader('Content-Length', pdf.buffer.length);
      res.setHeader('X-Content-Type-Options', 'nosniff');

      return res.send(pdf.buffer);
    } catch (error) {
      console.error('[MONIPLA][PDF][ERROR]', {
        idMuestreo,
        error: error.message,
      });

      return res.status(404).render('layouts/main', {
        title: 'PDF de Monitoreo',
        contentView: '../monitoreos/placeholder',
        pageTitle: 'PDF no disponible',
        pageMessage: 'No fue posible generar el PDF del monitoreo solicitado.',
      });
    }
  }

  detalle(req, res) {
    return res.render('layouts/main', {
      title: 'Detalle de Monitoreo',
      contentView: '../monitoreos/placeholder',
      pageTitle: 'Detalle de Monitoreo',
      pageMessage: `Modulo preparado para consultar el detalle del monitoreo ${req.params.idMuestreo}.`,
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

  renderHistorial(res, data) {
    return res.render('layouts/main', {
      title: 'Historial de Monitoreos',
      contentView: '../monitoreos/historial',
      errors: data.errors || [],
      success: null,
      values: data.values,
      opciones: data.opciones,
      registros: data.registros || [],
      paginacion: data.paginacion,
    });
  }
}

module.exports = MonitoreosController;
