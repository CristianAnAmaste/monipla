const sharp = require('sharp');
const MonitoreosRepository = require('../repositories/monitoreos.repository');

const MIMES_IMAGEN_PERMITIDOS = new Set(['image/jpeg', 'image/png', 'image/webp']);
const MAX_IMAGENES_MONITOREO = 3;
const MAX_BYTES_IMAGEN_ORIGINAL = 8 * 1024 * 1024;
const MAX_BYTES_IMAGEN_PROCESADA = 800 * 1024;
const MAX_COMENTARIO_IMAGEN = 400;

class MonitoreosService {
  constructor(monitoreosRepository = new MonitoreosRepository()) {
    this.monitoreosRepository = monitoreosRepository;
  }

  async getFormularioData(values = this.getValoresIniciales()) {
    const [fundos, estructuras] = await Promise.all([
      this.monitoreosRepository.findFondosDisponibles(),
      this.monitoreosRepository.findEstructurasActivas(),
    ]);

    return {
      values,
      opciones: {
        fundos,
        estructuras,
      },
    };
  }

  async listarCampos(genFundo) {
    const fundoId = this.normalizarId(genFundo);

    if (!fundoId) {
      return [];
    }

    return this.monitoreosRepository.findCamposByFundo(fundoId);
  }

  async listarVariedades(genFundo, genCampo) {
    const fundoId = this.normalizarId(genFundo);
    const campoId = this.normalizarId(genCampo);

    if (!fundoId || !campoId) {
      return [];
    }

    return this.monitoreosRepository.findVariedadesByFundoCampo(fundoId, campoId);
  }

  async listarCuarteles(genFundo, genCampo, genVariedad) {
    const fundoId = this.normalizarId(genFundo);
    const campoId = this.normalizarId(genCampo);
    const variedadId = this.normalizarId(genVariedad);

    if (!fundoId || !campoId || !variedadId) {
      return [];
    }

    return this.monitoreosRepository.findCuartelesByFiltros(fundoId, campoId, variedadId);
  }

  async guardarCabeceraMonitoreo(data, usuarioSesion) {
    const resolucion = await this.resolverFormulario(data);

    if (!resolucion.success) {
      return resolucion;
    }

    if (!this.esConfirmacionValida(data.confirmacionResumen)) {
      return {
        success: false,
        errors: ['Debe confirmar el resumen del monitoreo antes de guardar.'],
        values: resolucion.values,
      };
    }

    const idUsuarioCreacion = this.obtenerIdUsuarioCreacion(usuarioSesion);

    if (!idUsuarioCreacion) {
      return {
        success: false,
        errors: ['No fue posible identificar el usuario autenticado. Inicie sesion nuevamente.'],
        values: resolucion.values,
      };
    }

    if (resolucion.values.observacionGeneral.length > 500) {
      return {
        success: false,
        errors: ['La observacion general no puede superar los 500 caracteres.'],
        values: resolucion.values,
      };
    }

    const payload = {
      origen: {
        genCuartel: resolucion.origen.gen_cuartel,
        genVariedadCampo: resolucion.origen.gen_variedad_campo,
        idRelCuartelSdp: resolucion.origen.id_rel_cuartel_sdp,
      },
      muestreo: {
        fechaMuestreo: resolucion.values.fechaRevisionMuestra,
        fechaRevisionMuestra: resolucion.values.fechaRevisionMuestra,
        idEstructura: resolucion.values.idEstructura,
        observacionGeneral: resolucion.values.observacionGeneral || null,
        idUsuarioCreacion,
        fechaSolicitudMuestra: resolucion.values.fechaSolicitudMuestra,
        fechaRecepcionMuestra: resolucion.values.fechaRecepcionMuestra,
      },
    };

    const cabecera = await this.monitoreosRepository.crearCabeceraMonitoreoTransaccional(payload);

    return {
      success: true,
      values: resolucion.values,
      origen: resolucion.origen,
      estructura: resolucion.estructura,
      resumen: resolucion.resumen,
      id_muestreo: cabecera.id_muestreo,
      numero_muestreo: cabecera.numero_muestreo,
      message: `Monitoreo guardado correctamente. Numero de muestreo: ${cabecera.numero_muestreo}. ID interno: ${cabecera.id_muestreo}.`,
    };
  }

  async obtenerResumenPrevio(data) {
    const resolucion = await this.resolverFormulario(data);

    if (!resolucion.success) {
      return resolucion;
    }

    return {
      success: true,
      values: resolucion.values,
      resumen: resolucion.resumen,
    };
  }

  async obtenerFormularioResultados(idMuestreo) {
    const muestreoId = this.normalizarId(idMuestreo);

    if (!muestreoId) {
      throw new Error('ID_MUESTREO_INVALIDO');
    }

    const [muestreo, plagas, estadios, estados] = await Promise.all([
      this.monitoreosRepository.obtenerMuestreoPorId(muestreoId),
      this.monitoreosRepository.listarPlagasActivas(),
      this.monitoreosRepository.listarEstadiosActivos(),
      this.monitoreosRepository.listarEstadosActivos(),
    ]);

    if (!muestreo) {
      throw new Error('MUESTREO_NO_EXISTE');
    }

    return {
      muestreo,
      opciones: {
        plagas,
        estadios,
        estados,
      },
    };
  }

  async guardarResultadosMuestreo(idMuestreo, body, usuarioSesion, archivos = {}) {
    const muestreoId = this.normalizarId(idMuestreo);
    const values = this.normalizarResultadosEntrada(body);
    const imagenesRecibidas = this.contarImagenesRecibidas(archivos.files);

    console.info('[MONIPLA][RESULTADOS][SERVICE]', {
      evento: 'INICIO_VALIDACION',
      idMuestreo: muestreoId || idMuestreo,
      modo: values.modoResultado,
      filasRecibidas: Array.isArray(values.resultados) ? values.resultados.length : 0,
      imagenesRecibidas,
    });

    if (!muestreoId) {
      console.info('[MONIPLA][RESULTADOS][SERVICE]', {
        evento: 'VALIDACION_ERROR',
        errores: ['El muestreo solicitado no es valido.'],
      });

      return {
        success: false,
        errors: ['El muestreo solicitado no es valido.'],
        values,
      };
    }

    const formulario = await this.obtenerFormularioResultados(muestreoId);
    const idUsuarioResultado = this.obtenerIdUsuarioCreacion(usuarioSesion);

    if (!idUsuarioResultado) {
      console.info('[MONIPLA][RESULTADOS][SERVICE]', {
        evento: 'VALIDACION_ERROR',
        idMuestreo: muestreoId,
        errores: ['No fue posible identificar el usuario autenticado.'],
      });

      return {
        success: false,
        errors: ['No fue posible identificar el usuario autenticado. Inicie sesion nuevamente.'],
        values,
      };
    }

    if (formulario.muestreo.estado_resultado !== 'PENDIENTE') {
      console.info('[MONIPLA][RESULTADOS][SERVICE]', {
        evento: 'VALIDACION_ERROR',
        idMuestreo: muestreoId,
        estadoResultado: formulario.muestreo.estado_resultado,
        errores: ['RESULTADOS_YA_REGISTRADOS'],
      });

      return {
        success: false,
        errors: ['Este muestreo ya tiene resultados registrados. La edición se implementará en una etapa posterior.'],
        values,
      };
    }

    const errors = [];

    if (archivos.uploadError) {
      errors.push(this.formatearErrorCargaImagen(archivos.uploadError));
    }

    if (!['SIN_PLAGAS', 'CON_PLAGAS'].includes(values.modoResultado)) {
      errors.push('Debe seleccionar si el monitoreo tiene plagas detectadas.');
    }

    if (values.observacionResultado.length > 500) {
      errors.push('La observacion de resultado no puede superar los 500 caracteres.');
    }

    if (values.modoResultado === 'SIN_PLAGAS') {
      if (errors.length > 0) {
        console.info('[MONIPLA][RESULTADOS][SERVICE]', {
          evento: 'VALIDACION_ERROR',
          idMuestreo: muestreoId,
          errores: errors,
        });

        return {
          success: false,
          errors,
          values,
        };
      }

      let imagenesProcesadas;

      try {
        imagenesProcesadas = await this.procesarImagenesResultados(archivos.files, body, muestreoId);
      } catch (error) {
        console.error('[MONIPLA][IMAGENES][ERROR]', {
          idMuestreo: muestreoId,
          error: error.message,
        });

        return {
          success: false,
          errors: [error.userMessage || 'No fue posible procesar las imagenes adjuntas.'],
          values,
        };
      }


      try {
        const resultado = await this.monitoreosRepository.guardarSinPlagasMuestreoTransaccional(
          muestreoId,
          {
            observacionResultado: values.observacionResultado || null,
            idUsuarioResultado,
            imagenes: imagenesProcesadas,
          }
        );

        return {
          success: true,
          values: this.getValoresInicialesResultados(),
          id_muestreo: resultado.id_muestreo,
          numero_muestreo: resultado.numero_muestreo,
          estado_resultado: 'SIN_PLAGAS',
          imagenes_insertadas: resultado.imagenes_insertadas || 0,
        };
      } catch (error) {
        if (error.message === 'RESULTADOS_YA_REGISTRADOS') {
          return {
            success: false,
            errors: ['Este muestreo ya tiene resultados registrados. La edición se implementará en una etapa posterior.'],
            values,
          };
        }

        if (error.message === 'IMAGENES_YA_REGISTRADAS') {
          return {
            success: false,
            errors: ['Este muestreo ya tiene imagenes registradas. La edicion se implementara en una etapa posterior.'],
            values,
          };
        }

        throw error;
      }
    }

    const plagasActivas = new Set(formulario.opciones.plagas.map((item) => Number(item.value)));
    const estadiosActivos = new Set(formulario.opciones.estadios.map((item) => Number(item.value)));
    const estadosActivos = new Set(formulario.opciones.estados.map((item) => Number(item.value)));
    const validacionFilas = this.validarResultadosPlanos(values.resultados, {
      plagasActivas,
      estadiosActivos,
      estadosActivos,
    });

    errors.push(...validacionFilas.errors);

    console.info('[MONIPLA][RESULTADOS][FILAS_RECIBIDAS]', {
      totalFilas: validacionFilas.totalFilas,
      filasConDatos: validacionFilas.filasConDatos,
      filasValidas: validacionFilas.filasValidas.length,
      filasInvalidas: validacionFilas.filasInvalidas,
    });

    const plagasLimpias = this.agruparFilasResultadosValidas(validacionFilas.filasValidas);

    if (errors.length > 0) {
      console.info('[MONIPLA][RESULTADOS][VALIDACION_ERROR]', {
        idMuestreo: muestreoId,
        errores: errors,
        filasRecibidas: validacionFilas.totalFilas,
      });

      return {
        success: false,
        errors,
        values,
      };
    }

    let resultado;
    const conteosValidos = plagasLimpias.reduce((total, plaga) => total + plaga.conteos.length, 0);
    let imagenesProcesadas;

    try {
      imagenesProcesadas = await this.procesarImagenesResultados(archivos.files, body, muestreoId);
    } catch (error) {
      console.error('[MONIPLA][IMAGENES][ERROR]', {
        idMuestreo: muestreoId,
        error: error.message,
      });

      return {
        success: false,
        errors: [error.userMessage || 'No fue posible procesar las imagenes adjuntas.'],
        values,
      };
    }

    console.info('[MONIPLA][RESULTADOS][SERVICE]', {
      evento: 'VALIDACION_OK',
      idMuestreo: muestreoId,
      plagasAgrupadas: plagasLimpias.length,
      conteosValidos,
    });

    try {
      resultado = await this.monitoreosRepository.guardarResultadosMuestreoTransaccional(
        muestreoId,
        plagasLimpias,
        {
          idUsuarioResultado,
          imagenes: imagenesProcesadas,
        }
      );
    } catch (error) {
      if (error.message === 'RESULTADOS_YA_REGISTRADOS') {
        console.info('[MONIPLA][RESULTADOS][SERVICE]', {
          evento: 'VALIDACION_ERROR',
          idMuestreo: muestreoId,
          errores: ['RESULTADOS_YA_REGISTRADOS'],
        });

        return {
          success: false,
          errors: ['Este muestreo ya tiene resultados registrados. La edición se implementará en una etapa posterior.'],
          values,
        };
      }

      if (error.message === 'IMAGENES_YA_REGISTRADAS') {
        return {
          success: false,
          errors: ['Este muestreo ya tiene imagenes registradas. La edicion se implementara en una etapa posterior.'],
          values,
        };
      }

      throw error;
    }

    return {
      success: true,
      values: this.getValoresInicialesResultados(),
      id_muestreo: resultado.id_muestreo,
      numero_muestreo: resultado.numero_muestreo,
      estado_resultado: 'CON_PLAGAS',
      imagenes_insertadas: resultado.imagenes_insertadas || 0,
    };
  }

  async resolverFormulario(data) {
    const values = this.normalizarEntrada(data);
    const errors = [];

    if (!values.genFundo) {
      errors.push('Debe seleccionar un fundo.');
    }

    if (!values.genCampo) {
      errors.push('Debe seleccionar un campo.');
    }

    if (!values.genVariedad) {
      errors.push('Debe seleccionar una variedad.');
    }

    if (!values.genCuartel) {
      errors.push('Debe seleccionar un cuartel.');
    }

    if (!values.idEstructura) {
      errors.push('Debe seleccionar una estructura.');
    }

    if (!values.fechaSolicitudMuestra) {
      errors.push('Debe ingresar la fecha de solicitud de muestra.');
    }

    if (!values.fechaRecepcionMuestra) {
      errors.push('Debe ingresar la fecha de recepcion de muestra.');
    }

    if (!values.fechaRevisionMuestra) {
      errors.push('Debe ingresar la fecha de revision de muestra.');
    }

    const fechasValidas = [
      ['fecha de solicitud de muestra', values.fechaSolicitudMuestra],
      ['fecha de recepcion de muestra', values.fechaRecepcionMuestra],
      ['fecha de revision de muestra', values.fechaRevisionMuestra],
    ];

    fechasValidas.forEach(([label, value]) => {
      if (value && !this.esFechaValida(value)) {
        errors.push(`La ${label} no tiene un formato valido.`);
      }
    });

    if (
      this.esFechaValida(values.fechaSolicitudMuestra)
      && this.esFechaValida(values.fechaRecepcionMuestra)
      && values.fechaSolicitudMuestra > values.fechaRecepcionMuestra
    ) {
      errors.push('La fecha de solicitud no puede ser posterior a la fecha de recepcion.');
    }

    if (
      this.esFechaValida(values.fechaRecepcionMuestra)
      && this.esFechaValida(values.fechaRevisionMuestra)
      && values.fechaRecepcionMuestra > values.fechaRevisionMuestra
    ) {
      errors.push('La fecha de recepcion no puede ser posterior a la fecha de revision.');
    }

    let origen = null;

    if (errors.length === 0) {
      origen = await this.monitoreosRepository.findResumenByGenCuartel(values.genCuartel);

      if (!origen) {
        errors.push('El cuartel seleccionado no tiene una relacion activa para resolver SDP, CSG y trazabilidad.');
      }
    }

    if (errors.length === 0) {
      const seleccionInconsistente =
        Number(origen.gen_fundo) !== values.genFundo
        || Number(origen.gen_campo) !== values.genCampo
        || Number(origen.gen_variedad) !== values.genVariedad;

      if (seleccionInconsistente) {
        errors.push('La combinacion seleccionada de fundo, campo, variedad y cuartel no es valida.');
      }
    }

    let estructura = null;

    if (errors.length === 0) {
      estructura = await this.monitoreosRepository.findEstructuraById(values.idEstructura);

      if (!estructura || (estructura.activo !== true && estructura.activo !== 1)) {
        errors.push('La estructura seleccionada no esta disponible.');
      }
    }

    if (errors.length > 0) {
      return {
        success: false,
        errors,
        values,
      };
    }

    return {
      success: true,
      values,
      origen,
      estructura,
      resumen: this.buildResumen(values, origen, estructura),
    };
  }

  getValoresIniciales() {
    return {
      genFundo: '',
      genCampo: '',
      genVariedad: '',
      genCuartel: '',
      idEstructura: '',
      fechaSolicitudMuestra: '',
      fechaRecepcionMuestra: '',
      fechaRevisionMuestra: '',
      observacionGeneral: '',
    };
  }

  getValoresInicialesResultados() {
    return {
      modoResultado: 'CON_PLAGAS',
      observacionResultado: '',
      resultados: [
        {
          idPlaga: '',
          idEstadio: '',
          idEstadoEjemplar: '',
          cantidad: '',
        },
      ],
      plagas: [
        {
          idPlaga: '',
          detalleTexto: '',
          observacion: '',
          conteos: [
            {
              idEstadio: '',
              idEstadoEjemplar: '',
              cantidad: '',
            },
          ],
        },
      ],
    };
  }

  normalizarEntrada(data) {
    return {
      genFundo: this.normalizarId(data.genFundo),
      genCampo: this.normalizarId(data.genCampo),
      genVariedad: this.normalizarId(data.genVariedad),
      genCuartel: this.normalizarId(data.genCuartel),
      idEstructura: this.normalizarId(data.idEstructura),
      fechaSolicitudMuestra: (data.fechaSolicitudMuestra || '').trim(),
      fechaRecepcionMuestra: (data.fechaRecepcionMuestra || '').trim(),
      fechaRevisionMuestra: (data.fechaRevisionMuestra || '').trim(),
      observacionGeneral: (data.observacionGeneral || '').trim(),
    };
  }

  normalizarResultadosEntrada(data) {
    if (!data || !data.resultadosPayload) {
      return {
        ...this.getValoresInicialesResultados(),
        modoResultado: this.normalizarModoResultado(data && data.modoResultado),
        observacionResultado: String((data && data.observacionResultado) || '').trim(),
      };
    }

    try {
      const parsed = JSON.parse(data.resultadosPayload);
      const plagas = Array.isArray(parsed.plagas) ? parsed.plagas : [];
      const resultados = Array.isArray(parsed.resultados) ? parsed.resultados : [];

      return {
        modoResultado: ['SIN_PLAGAS', 'CON_PLAGAS'].includes(parsed.modoResultado)
          ? parsed.modoResultado
          : this.normalizarModoResultado(data.modoResultado),
        observacionResultado: String(parsed.observacionResultado || data.observacionResultado || '').trim(),
        resultados: resultados.map((fila, index) => ({
          numeroFila: Number.isInteger(Number(fila.numeroFila)) && Number(fila.numeroFila) > 0
            ? Number(fila.numeroFila)
            : index + 1,
          idPlaga: String(fila.idPlaga || '').trim(),
          idEstadio: String(fila.idEstadio || '').trim(),
          idEstadoEjemplar: String(fila.idEstadoEjemplar || '').trim(),
          cantidad: String(fila.cantidad || '').trim(),
        })),
        plagas: plagas.map((plaga) => ({
          idPlaga: String(plaga.idPlaga || '').trim(),
          detalleTexto: String(plaga.detalleTexto || '').trim(),
          observacion: String(plaga.observacion || '').trim(),
          conteos: Array.isArray(plaga.conteos)
            ? plaga.conteos.map((conteo) => ({
              idEstadio: String(conteo.idEstadio || '').trim(),
              idEstadoEjemplar: String(conteo.idEstadoEjemplar || '').trim(),
              cantidad: String(conteo.cantidad || '').trim(),
            }))
            : [],
        })),
      };
    } catch (error) {
      return {
        ...this.getValoresInicialesResultados(),
        modoResultado: this.normalizarModoResultado(data.modoResultado),
        observacionResultado: String(data.observacionResultado || '').trim(),
      };
    }
  }

  normalizarModoResultado(value) {
    if (value === 'SIN_PLAGAS' || value === 'CON_PLAGAS') {
      return value;
    }

    return '';
  }

  contarImagenesRecibidas(files) {
    if (!files || typeof files !== 'object') {
      return 0;
    }

    return ['imagen1', 'imagen2', 'imagen3'].reduce((total, fieldName) => {
      const fieldFiles = Array.isArray(files[fieldName]) ? files[fieldName] : [];
      return total + fieldFiles.length;
    }, 0);
  }

  formatearErrorCargaImagen(error) {
    if (!error) {
      return '';
    }

    if (error.code === 'LIMIT_FILE_SIZE') {
      return 'Cada imagen debe pesar como maximo 8 MB antes de comprimirla.';
    }

    if (error.code === 'LIMIT_FILE_COUNT' || error.code === 'LIMIT_UNEXPECTED_FILE') {
      return 'Puede adjuntar hasta 3 imagenes de evidencia.';
    }

    return error.message || 'No fue posible recibir las imagenes adjuntas.';
  }

  obtenerComentarioImagen(body, orden) {
    if (!body) {
      return '';
    }

    if (body.comentariosImagen && typeof body.comentariosImagen === 'object') {
      return String(body.comentariosImagen[orden] || '').trim();
    }

    return String(body[`comentariosImagen[${orden}]`] || '').trim();
  }

  async procesarImagenesResultados(files, body, idMuestreo) {
    const imagenes = [];
    const totalImagenes = this.contarImagenesRecibidas(files);

    console.info('[MONIPLA][IMAGENES][RECIBIDAS]', {
      idMuestreo,
      totalImagenes,
    });

    if (totalImagenes > MAX_IMAGENES_MONITOREO) {
      const error = new Error('MAX_IMAGENES_EXCEDIDO');
      error.userMessage = 'Puede adjuntar hasta 3 imagenes de evidencia.';
      throw error;
    }

    for (let orden = 1; orden <= MAX_IMAGENES_MONITOREO; orden += 1) {
      const fieldName = `imagen${orden}`;
      const file = Array.isArray(files && files[fieldName]) ? files[fieldName][0] : null;
      const comentario = this.obtenerComentarioImagen(body, orden);

      if (comentario.length > MAX_COMENTARIO_IMAGEN) {
        const error = new Error('COMENTARIO_IMAGEN_LARGO');
        error.userMessage = `Evidencia ${orden}: el comentario no puede superar los ${MAX_COMENTARIO_IMAGEN} caracteres.`;
        throw error;
      }

      if (!file) {
        continue;
      }

      if (!MIMES_IMAGEN_PERMITIDOS.has(file.mimetype)) {
        const error = new Error('MIME_IMAGEN_INVALIDO');
        error.userMessage = `Evidencia ${orden}: solo se permiten imagenes JPG, PNG o WebP.`;
        throw error;
      }

      if (!file.buffer || file.buffer.length === 0) {
        const error = new Error('IMAGEN_VACIA');
        error.userMessage = `Evidencia ${orden}: la imagen esta vacia o no pudo leerse.`;
        throw error;
      }

      if (file.size > MAX_BYTES_IMAGEN_ORIGINAL) {
        const error = new Error('IMAGEN_ORIGINAL_PESADA');
        error.userMessage = `Evidencia ${orden}: la imagen supera el maximo de 8 MB permitido.`;
        throw error;
      }

      const procesada = await this.comprimirImagen(file, orden);

      console.info('[MONIPLA][IMAGENES][PROCESADA]', {
        orden,
        mimeOriginal: file.mimetype,
        bytesOriginal: file.size,
        mimeFinal: procesada.mime,
        bytesFinal: procesada.buffer.length,
      });

      imagenes.push({
        orden,
        buffer: procesada.buffer,
        mime: procesada.mime,
        comentario: comentario || null,
      });
    }

    return imagenes;
  }

  async comprimirImagen(file, orden) {
    try {
      const base = sharp(file.buffer, {
        failOn: 'warning',
      })
        .rotate()
        .resize({
          width: 1280,
          height: 1280,
          fit: 'inside',
          withoutEnlargement: true,
        });

      const webpBuffer = await base.clone().webp({ quality: 65 }).toBuffer();

      if (webpBuffer.length <= MAX_BYTES_IMAGEN_PROCESADA) {
        return {
          buffer: webpBuffer,
          mime: 'image/webp',
        };
      }

      const jpegBuffer = await base.clone().jpeg({ quality: 70, progressive: true }).toBuffer();
      const mejorBuffer = jpegBuffer.length < webpBuffer.length ? jpegBuffer : webpBuffer;
      const mejorMime = jpegBuffer.length < webpBuffer.length ? 'image/jpeg' : 'image/webp';

      if (mejorBuffer.length > MAX_BYTES_IMAGEN_PROCESADA) {
        const error = new Error('IMAGEN_PROCESADA_PESADA');
        error.userMessage = `Evidencia ${orden}: la imagen es demasiado pesada incluso despues de comprimirla.`;
        throw error;
      }

      return {
        buffer: mejorBuffer,
        mime: mejorMime,
      };
    } catch (error) {
      if (error.userMessage) {
        throw error;
      }

      const procesarError = new Error(`ERROR_COMPRESION_IMAGEN: ${error.message}`);
      procesarError.userMessage = `Evidencia ${orden}: no fue posible procesar la imagen.`;
      throw procesarError;
    }
  }

  validarResultadosPlanos(resultados, catalogos) {
    const filas = Array.isArray(resultados) ? resultados : [];
    const errors = [];
    const filasValidas = [];
    const clavesUsadas = new Set();
    let filasConDatos = 0;

    filas.forEach((fila, index) => {
      const numeroFila = Number(fila.numeroFila) || index + 1;
      const tieneDatos = fila.idPlaga || fila.idEstadio || fila.idEstadoEjemplar || fila.cantidad;

      if (!tieneDatos) {
        return;
      }

      filasConDatos += 1;

      const idPlaga = this.normalizarIdEstricto(fila.idPlaga);
      const idEstadio = this.normalizarIdEstricto(fila.idEstadio);
      const idEstadoEjemplar = this.normalizarIdEstricto(fila.idEstadoEjemplar);
      const cantidadCruda = String(fila.cantidad || '').trim();
      const cantidad = this.normalizarCantidad(cantidadCruda);
      let filaValida = true;

      if (!idPlaga) {
        errors.push(`Fila ${numeroFila}: seleccione una plaga o elimine la fila.`);
        filaValida = false;
      } else if (!catalogos.plagasActivas.has(idPlaga)) {
        errors.push(`Fila ${numeroFila}: la plaga seleccionada no esta disponible.`);
        filaValida = false;
      }

      if (!idEstadio) {
        errors.push(`Fila ${numeroFila}: debe seleccionar un estadio.`);
        filaValida = false;
      } else if (!catalogos.estadiosActivos.has(idEstadio)) {
        errors.push(`Fila ${numeroFila}: el estadio seleccionado no esta disponible.`);
        filaValida = false;
      }

      if (!idEstadoEjemplar) {
        errors.push(`Fila ${numeroFila}: debe seleccionar un estado.`);
        filaValida = false;
      } else if (!catalogos.estadosActivos.has(idEstadoEjemplar)) {
        errors.push(`Fila ${numeroFila}: el estado seleccionado no esta disponible.`);
        filaValida = false;
      }

      if (!cantidadCruda) {
        errors.push(`Fila ${numeroFila}: debe ingresar una cantidad.`);
        filaValida = false;
      } else if (!/^\d+$/.test(cantidadCruda)) {
        errors.push(`Fila ${numeroFila}: la cantidad debe ser un entero positivo.`);
        filaValida = false;
      } else if (Number.parseInt(cantidadCruda, 10) <= 0) {
        errors.push(`Fila ${numeroFila}: la cantidad debe ser mayor a 0 o elimine la fila.`);
        filaValida = false;
      } else if (cantidad === null) {
        errors.push(`Fila ${numeroFila}: la cantidad debe ser un entero positivo.`);
        filaValida = false;
      }

      if (!filaValida) {
        return;
      }

      const claveConteo = `${idPlaga}:${idEstadio}:${idEstadoEjemplar}`;

      if (clavesUsadas.has(claveConteo)) {
        errors.push(`Fila ${numeroFila}: ya existe un conteo para esta misma plaga, estadio y estado.`);
        return;
      }

      clavesUsadas.add(claveConteo);
      filasValidas.push({
        numeroFila,
        idPlaga,
        idEstadio,
        idEstadoEjemplar,
        cantidad,
      });
    });

    if (filasConDatos === 0) {
      errors.push('Debe ingresar al menos una fila completa de hallazgo.');
    }

    return {
      errors,
      filasValidas,
      totalFilas: filas.length,
      filasConDatos,
      filasInvalidas: errors.length > 0 ? filasConDatos - filasValidas.length : 0,
    };
  }

  agruparFilasResultadosValidas(filasValidas) {
    const agrupadas = [];
    const indicesPorPlaga = new Map();

    filasValidas.forEach((fila) => {
      if (!indicesPorPlaga.has(fila.idPlaga)) {
        indicesPorPlaga.set(fila.idPlaga, agrupadas.length);
        agrupadas.push({
          idPlaga: fila.idPlaga,
          detalleTexto: null,
          observacion: null,
          cantidadTotal: 0,
          conteos: [],
        });
      }

      const plaga = agrupadas[indicesPorPlaga.get(fila.idPlaga)];

      plaga.conteos.push({
        idEstadio: fila.idEstadio,
        idEstadoEjemplar: fila.idEstadoEjemplar,
        cantidad: fila.cantidad,
      });
      plaga.cantidadTotal += fila.cantidad;
    });

    return agrupadas;
  }

  agruparResultadosPlanos(resultados) {
    if (!Array.isArray(resultados) || resultados.length === 0) {
      return [];
    }

    const agrupadas = [];
    const indicesPorPlaga = new Map();

    resultados.forEach((fila) => {
      const idPlaga = String(fila.idPlaga || '').trim();

      if (!indicesPorPlaga.has(idPlaga)) {
        indicesPorPlaga.set(idPlaga, agrupadas.length);
        agrupadas.push({
          idPlaga,
          detalleTexto: '',
          observacion: '',
          conteos: [],
        });
      }

      agrupadas[indicesPorPlaga.get(idPlaga)].conteos.push({
        idEstadio: String(fila.idEstadio || '').trim(),
        idEstadoEjemplar: String(fila.idEstadoEjemplar || '').trim(),
        cantidad: String(fila.cantidad || '').trim(),
      });
    });

    return agrupadas;
  }

  normalizarId(value) {
    const parsedValue = Number.parseInt(value, 10);
    return Number.isInteger(parsedValue) && parsedValue > 0 ? parsedValue : '';
  }

  normalizarIdEstricto(value) {
    const rawValue = String(value || '').trim();

    if (!/^\d+$/.test(rawValue)) {
      return '';
    }

    const parsedValue = Number.parseInt(rawValue, 10);
    return Number.isInteger(parsedValue) && parsedValue > 0 ? parsedValue : '';
  }

  normalizarCantidad(value) {
    const rawValue = String(value || '').trim();

    if (!/^\d+$/.test(rawValue)) {
      return null;
    }

    const parsedValue = Number.parseInt(rawValue, 10);
    return Number.isInteger(parsedValue) && parsedValue > 0 ? parsedValue : null;
  }

  esFechaValida(value) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
      return false;
    }

    const [year, month, day] = value.split('-').map(Number);
    const date = new Date(Date.UTC(year, month - 1, day));

    return date.getUTCFullYear() === year
      && date.getUTCMonth() === month - 1
      && date.getUTCDate() === day;
  }

  esConfirmacionValida(value) {
    return value === '1' || value === 1 || value === true || value === 'true';
  }

  obtenerIdUsuarioCreacion(usuarioSesion) {
    const idUsuario = this.normalizarId(usuarioSesion && usuarioSesion.id);
    return idUsuario || null;
  }

  buildResumen(values, origen, estructura) {
    return {
      ubicacion: {
        fundo: origen.nombre_fundo,
        campo: origen.nombre_campo,
        variedad: origen.nombre_variedad,
        cuartel: origen.codigo_cuartel,
      },
      resolucion: {
        sdp: origen.sdp,
        csg: origen.csg,
        trazabilidad: origen.trazabilidad,
      },
      estructura: estructura.nombre_estructura,
      fechas: {
        solicitudMuestra: values.fechaSolicitudMuestra,
        recepcionMuestra: values.fechaRecepcionMuestra,
        revisionMuestra: values.fechaRevisionMuestra,
      },
      observacionGeneral: values.observacionGeneral || '',
    };
  }
}

module.exports = MonitoreosService;
