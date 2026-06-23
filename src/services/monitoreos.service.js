const MonitoreosRepository = require('../repositories/monitoreos.repository');

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

  async guardarResultadosMuestreo(idMuestreo, body, usuarioSesion) {
    const muestreoId = this.normalizarId(idMuestreo);
    const values = this.normalizarResultadosEntrada(body);

    console.info('[MONIPLA][RESULTADOS][SERVICE]', {
      evento: 'INICIO_VALIDACION',
      idMuestreo: muestreoId || idMuestreo,
      modo: values.modoResultado,
      filasRecibidas: Array.isArray(values.resultados) ? values.resultados.length : 0,
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

      try {
        const resultado = await this.monitoreosRepository.guardarSinPlagasMuestreoTransaccional(
          muestreoId,
          {
            observacionResultado: values.observacionResultado || null,
            idUsuarioResultado,
          }
        );

        return {
          success: true,
          values: this.getValoresInicialesResultados(),
          id_muestreo: resultado.id_muestreo,
          numero_muestreo: resultado.numero_muestreo,
          estado_resultado: 'SIN_PLAGAS',
        };
      } catch (error) {
        if (error.message === 'RESULTADOS_YA_REGISTRADOS') {
          return {
            success: false,
            errors: ['Este muestreo ya tiene resultados registrados. La edición se implementará en una etapa posterior.'],
            values,
          };
        }

        throw error;
      }
    }

    const plagasActivas = new Set(formulario.opciones.plagas.map((item) => Number(item.value)));
    const estadiosActivos = new Set(formulario.opciones.estadios.map((item) => Number(item.value)));
    const estadosActivos = new Set(formulario.opciones.estados.map((item) => Number(item.value)));
    const plagasLimpias = [];
    const plagasUsadas = new Set();
    const resultadosAgrupados = this.agruparResultadosPlanos(values.resultados);
    const plagasParaValidar = resultadosAgrupados.length > 0 ? resultadosAgrupados : values.plagas;

    plagasParaValidar.forEach((plaga, plagaIndex) => {
      const tieneDatosPlaga = plaga.idPlaga
        || plaga.detalleTexto
        || plaga.observacion
        || plaga.conteos.some((conteo) => (
          conteo.idEstadio || conteo.idEstadoEjemplar || conteo.cantidad
        ));

      if (!tieneDatosPlaga) {
        return;
      }

      const numeroPlaga = plagaIndex + 1;
      const idPlaga = this.normalizarIdEstricto(plaga.idPlaga);

      if (!idPlaga) {
        errors.push(`Debe seleccionar una plaga en el bloque ${numeroPlaga}.`);
      } else if (!plagasActivas.has(idPlaga)) {
        errors.push(`La plaga seleccionada en el bloque ${numeroPlaga} no esta disponible.`);
      } else if (plagasUsadas.has(idPlaga)) {
        errors.push(`La plaga del bloque ${numeroPlaga} ya fue ingresada en otro bloque.`);
      }

      if (plaga.detalleTexto.length > 500) {
        errors.push(`El detalle del bloque ${numeroPlaga} no puede superar los 500 caracteres.`);
      }

      if (plaga.observacion.length > 500) {
        errors.push(`La observacion del bloque ${numeroPlaga} no puede superar los 500 caracteres.`);
      }

      const conteosLimpios = [];
      const combinacionesConteo = new Set();

      plaga.conteos.forEach((conteo, conteoIndex) => {
        const tieneDatosConteo = conteo.idEstadio || conteo.idEstadoEjemplar || conteo.cantidad;

        if (!tieneDatosConteo) {
          return;
        }

        const numeroConteo = conteoIndex + 1;
        const cantidadCruda = String(conteo.cantidad || '').trim();

        if (cantidadCruda === '0') {
          return;
        }

        const idEstadio = this.normalizarIdEstricto(conteo.idEstadio);
        const idEstadoEjemplar = this.normalizarIdEstricto(conteo.idEstadoEjemplar);
        const cantidad = this.normalizarCantidad(cantidadCruda);

        if (!idEstadio) {
          errors.push(`Debe seleccionar un estadio en el conteo ${numeroConteo} del bloque ${numeroPlaga}.`);
        } else if (!estadiosActivos.has(idEstadio)) {
          errors.push(`El estadio del conteo ${numeroConteo} del bloque ${numeroPlaga} no esta disponible.`);
        }

        if (!idEstadoEjemplar) {
          errors.push(`Debe seleccionar un estado en el conteo ${numeroConteo} del bloque ${numeroPlaga}.`);
        } else if (!estadosActivos.has(idEstadoEjemplar)) {
          errors.push(`El estado del conteo ${numeroConteo} del bloque ${numeroPlaga} no esta disponible.`);
        }

        if (cantidad === null) {
          errors.push(`La cantidad del conteo ${numeroConteo} del bloque ${numeroPlaga} debe ser un entero positivo.`);
        }

        if (!idEstadio || !idEstadoEjemplar || cantidad === null) {
          return;
        }

        const claveConteo = `${idEstadio}:${idEstadoEjemplar}`;

        if (combinacionesConteo.has(claveConteo)) {
          errors.push('Hay conteos duplicados para la misma plaga, estadio y estado.');
          return;
        }

        combinacionesConteo.add(claveConteo);
        conteosLimpios.push({
          idEstadio,
          idEstadoEjemplar,
          cantidad,
        });
      });

      if (conteosLimpios.length === 0) {
        errors.push(`Debe ingresar al menos un conteo valido para la plaga del bloque ${numeroPlaga}.`);
      }

      if (idPlaga) {
        plagasUsadas.add(idPlaga);
      }

      const cantidadTotal = conteosLimpios.reduce((total, conteo) => total + conteo.cantidad, 0);

      plagasLimpias.push({
        idPlaga,
        detalleTexto: plaga.detalleTexto || null,
        observacion: plaga.observacion || null,
        cantidadTotal,
        conteos: conteosLimpios,
      });
    });

    if (plagasLimpias.length === 0) {
      errors.push('Debe ingresar al menos una plaga con conteos validos.');
    }

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

    let resultado;
    const conteosValidos = plagasLimpias.reduce((total, plaga) => total + plaga.conteos.length, 0);

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

      throw error;
    }

    return {
      success: true,
      values: this.getValoresInicialesResultados(),
      id_muestreo: resultado.id_muestreo,
      numero_muestreo: resultado.numero_muestreo,
      estado_resultado: 'CON_PLAGAS',
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
        resultados: resultados.map((fila) => ({
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
