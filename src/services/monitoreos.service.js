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

  async validarPasoUno(data) {
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

    return {
      success: true,
      values: resolucion.values,
      origen: resolucion.origen,
      estructura: resolucion.estructura,
      resumen: resolucion.resumen,
      message: 'Confirmacion recibida correctamente. El guardado definitivo del monitoreo se implementara en la siguiente etapa.',
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

  normalizarId(value) {
    const parsedValue = Number.parseInt(value, 10);
    return Number.isInteger(parsedValue) && parsedValue > 0 ? parsedValue : '';
  }

  esFechaValida(value) {
    return /^\d{4}-\d{2}-\d{2}$/.test(value);
  }

  esConfirmacionValida(value) {
    return value === '1' || value === 1 || value === true || value === 'true';
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
