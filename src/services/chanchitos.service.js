const ChanchitosRepository = require('../repositories/chanchitos.repository');
const CatalogoSdpService = require('./catalogoSdp.service');
const AgroclimaMoniplaService = require('./agroclimaMonipla.service');

const MAX_INT = 2147483647;
const ESTADOS = [1, 2, 3];
const POSICIONES = [1, 2, 3, 4];
const MATRIZ_CANONICA = Object.freeze(
  ESTADOS.flatMap((idEstadoMonitoreo) => POSICIONES.map((idEstadoPosicion) => Object.freeze({
    idEstadoMonitoreo,
    idEstadoPosicion,
  })))
);

class ChanchitosService {
  constructor(
    chanchitosRepository = null,
    catalogoSdpService = new CatalogoSdpService(),
    agroclimaService = new AgroclimaMoniplaService()
  ) {
    this.chanchitosRepository = chanchitosRepository || new ChanchitosRepository();
    this.catalogoSdpService = catalogoSdpService;
    this.agroclimaService = agroclimaService;
  }

  async getFormularioData(values = this.getValoresIniciales()) {
    const [fundos, estadosFenologicos, monitoreadores] = await Promise.all([
      this.catalogoSdpService.listarFondosDisponibles(),
      this.chanchitosRepository.listarEstadosFenologicosActivos(),
      this.chanchitosRepository.listarMonitoreadoresActivos(),
    ]);

    return {
      values,
      opciones: {
        fundos,
        estadosFenologicos,
        monitoreadores,
      },
    };
  }

  async guardarMonitoreo(data, usuarioSesion) {
    const validacion = await this.validarRegistro(data, usuarioSesion);

    if (!validacion.success) {
      return validacion;
    }

    const { values, detalles, catalogo } = validacion;
    const agroclimaSnapshot = await this.agroclimaService.calcularSnapshotSeguroPorFundo(
      catalogo.gen_fundo,
      values.fechaMonitoreo
    );
    const seleccion = {
      genFundo: values.genFundo,
      genCampo: values.genCampo,
      genVariedad: values.genVariedad,
    };

    const payload = {
      cabecera: {
        idCatalogoSdp: values.idCatalogoSdp,
        cantPlantas: values.cantPlantas,
        idUsuario: values.idUsuario,
        fechaMonitoreo: values.fechaMonitoreo,
        idEstadoFenologico: values.idEstadoFenologico,
        observaciones: values.observaciones || null,
        idMonitoreador: values.idMonitoreador,
        agroclimaSnapshot,
      },
      detalles,
      revalidarCatalogoSdp: (transaction) => this.catalogoSdpService.resolverCanonicoPorId(
        values.idCatalogoSdp,
        seleccion,
        transaction
      ),
      revalidarMonitoreador: (transaction) => this.resolverMonitoreador(
        values.idMonitoreador,
        transaction
      ),
      revalidarEstadoFenologico: (transaction) => this.resolverEstadoFenologico(
        values.idEstadoFenologico,
        transaction
      ),
    };

    try {
      const resultado = await this.chanchitosRepository.crearMonitoreoTransaccional(payload);

      return {
        success: true,
        id_monitoreo: resultado.id_monitoreo,
      };
    } catch (error) {
      const mensaje = this.obtenerMensajeErrorPersistencia(error.message);

      if (!mensaje) {
        throw error;
      }

      return {
        success: false,
        errors: [mensaje],
        values,
        resumenCatalogo: validacion.resumenCatalogo,
      };
    }
  }

  async validarRegistro(data, usuarioSesion) {
    const values = this.normalizarEntrada(data);
    const errors = [];
    const matriz = this.construirMatriz(data);

    if (!values.genFundo) {
      errors.push('Debe seleccionar un fundo valido.');
    }

    if (!values.genCampo) {
      errors.push('Debe seleccionar un campo valido.');
    }

    if (!values.genVariedad) {
      errors.push('Debe seleccionar una variedad valida.');
    }

    if (!values.idCatalogoSdp) {
      errors.push('Debe seleccionar un cuartel valido.');
    }

    if (!values.cantPlantas) {
      errors.push('La cantidad de plantas debe ser un entero mayor que cero.');
    }

    if (!values.fechaMonitoreo || !this.esFechaValida(values.fechaMonitoreo)) {
      errors.push('Debe ingresar una fecha de monitoreo valida.');
    }

    if (!values.idEstadoFenologico) {
      errors.push('Debe seleccionar un estado fenologico valido.');
    }

    if (!values.idMonitoreador) {
      errors.push('Debe seleccionar un monitoreador valido.');
    }

    const idUsuario = this.obtenerIdUsuario(usuarioSesion);

    if (!idUsuario) {
      errors.push('No fue posible identificar el usuario autenticado. Inicie sesion nuevamente.');
    }

    values.idUsuario = idUsuario;
    errors.push(...matriz.errors);

    if (errors.length > 0) {
      return { success: false, errors, values };
    }

    const seleccion = {
      genFundo: values.genFundo,
      genCampo: values.genCampo,
      genVariedad: values.genVariedad,
    };
    let catalogo;

    try {
      catalogo = await this.catalogoSdpService.resolverCanonicoPorId(
        values.idCatalogoSdp,
        seleccion
      );
      await this.resolverMonitoreador(values.idMonitoreador);
      await this.resolverEstadoFenologico(values.idEstadoFenologico);
    } catch (error) {
      const mensaje = this.obtenerMensajeErrorPersistencia(error.message);

      if (!mensaje) {
        throw error;
      }

      return {
        success: false,
        errors: [mensaje],
        values,
        resumenCatalogo: catalogo ? this.construirResumenCatalogo(catalogo) : null,
      };
    }

    return {
      success: true,
      values,
      detalles: matriz.detalles,
      catalogo,
      resumenCatalogo: this.construirResumenCatalogo(catalogo),
    };
  }

  async resolverMonitoreador(idMonitoreador, transaction = null) {
    const filas = await this.chanchitosRepository.findMonitoreadorById(
      idMonitoreador,
      transaction
    );

    if (!Array.isArray(filas) || filas.length !== 1) {
      throw new Error('MONITOREADOR_NO_DISPONIBLE');
    }

    const [monitoreador] = filas;

    if (monitoreador.activo !== true && monitoreador.activo !== 1) {
      throw new Error('MONITOREADOR_NO_DISPONIBLE');
    }

    return monitoreador;
  }

  async resolverEstadoFenologico(idEstadoFenologico, transaction = null) {
    const filas = await this.chanchitosRepository.findEstadoFenologicoById(
      idEstadoFenologico,
      transaction
    );

    if (!Array.isArray(filas) || filas.length !== 1) {
      throw new Error('ESTADO_FENOLOGICO_NO_DISPONIBLE');
    }

    const [estado] = filas;

    if (estado.estado !== true && estado.estado !== 1) {
      throw new Error('ESTADO_FENOLOGICO_NO_DISPONIBLE');
    }

    return estado;
  }

  construirMatriz(data = {}) {
    const detalles = [];
    const errors = [];

    MATRIZ_CANONICA.forEach(({ idEstadoMonitoreo, idEstadoPosicion }) => {
      const fieldName = `cantidad_${idEstadoMonitoreo}_${idEstadoPosicion}`;
      const cantidad = this.normalizarCantidad(data[fieldName]);

      if (cantidad === null) {
        errors.push(`La cantidad ${idEstadoMonitoreo}-${idEstadoPosicion} debe ser un entero entre 0 y ${MAX_INT}.`);
        return;
      }

      detalles.push({
        idEstadoMonitoreo,
        idEstadoPosicion,
        cantidadBichos: cantidad,
      });
    });

    return { detalles, errors };
  }

  normalizarEntrada(data = {}) {
    const values = {
      genFundo: this.normalizarId(data.genFundo),
      genCampo: this.normalizarId(data.genCampo),
      genVariedad: this.normalizarId(data.genVariedad),
      idCatalogoSdp: this.normalizarId(data.idCatalogoSdp),
      cantPlantas: this.normalizarEnteroPositivo(data.cantPlantas),
      fechaMonitoreo: String(data.fechaMonitoreo || '').trim(),
      idEstadoFenologico: this.normalizarId(data.idEstadoFenologico),
      idMonitoreador: this.normalizarId(data.idMonitoreador),
      observaciones: String(data.observaciones || '').trim(),
      idUsuario: null,
    };

    ESTADOS.forEach((idEstadoMonitoreo) => {
      POSICIONES.forEach((idEstadoPosicion) => {
        const fieldName = `cantidad_${idEstadoMonitoreo}_${idEstadoPosicion}`;
        values[fieldName] = String(data[fieldName] ?? '').trim();
      });
    });

    return values;
  }

  getValoresIniciales() {
    const values = {
      genFundo: '',
      genCampo: '',
      genVariedad: '',
      idCatalogoSdp: '',
      cantPlantas: '',
      fechaMonitoreo: '',
      idEstadoFenologico: '',
      idMonitoreador: '',
      observaciones: '',
      idUsuario: null,
    };

    ESTADOS.forEach((idEstadoMonitoreo) => {
      POSICIONES.forEach((idEstadoPosicion) => {
        values[`cantidad_${idEstadoMonitoreo}_${idEstadoPosicion}`] = '';
      });
    });

    return values;
  }

  normalizarId(value) {
    const raw = String(value ?? '').trim();

    if (!/^\d+$/.test(raw)) {
      return '';
    }

    const parsed = Number.parseInt(raw, 10);
    return Number.isSafeInteger(parsed) && parsed > 0 && parsed <= MAX_INT ? parsed : '';
  }

  normalizarEnteroPositivo(value) {
    const raw = String(value ?? '').trim();

    if (!/^\d+$/.test(raw)) {
      return '';
    }

    const parsed = Number.parseInt(raw, 10);
    return Number.isSafeInteger(parsed) && parsed > 0 && parsed <= MAX_INT ? parsed : '';
  }

  normalizarCantidad(value) {
    const raw = String(value ?? '').trim();

    if (!raw) {
      return 0;
    }

    if (!/^\d+$/.test(raw)) {
      return null;
    }

    const parsed = Number.parseInt(raw, 10);
    return Number.isSafeInteger(parsed) && parsed >= 0 && parsed <= MAX_INT ? parsed : null;
  }

  obtenerIdUsuario(usuarioSesion) {
    return this.normalizarId(usuarioSesion && usuarioSesion.id) || null;
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

  construirResumenCatalogo(catalogo) {
    return {
      sdp: catalogo.sdp,
      csg: catalogo.codigo_sag || '-',
      trazabilidad: catalogo.codigo_trazabilidad || '-',
    };
  }

  obtenerMensajeErrorPersistencia(codigo) {
    const mensajes = {
      CATALOGO_SDP_MB_NO_DISPONIBLE: 'El cuartel seleccionado no esta disponible en el catalogo de marcha blanca.',
      CATALOGO_SDP_MB_NO_CANONICO: 'El cuartel seleccionado no tiene una resolucion canonica unica en el catalogo de marcha blanca.',
      CATALOGO_SDP_MB_SELECCION_INVALIDA: 'La combinacion seleccionada de fundo, campo, variedad y cuartel no es valida.',
      MONITOREADOR_NO_DISPONIBLE: 'El monitoreador seleccionado no esta disponible.',
      ESTADO_FENOLOGICO_NO_DISPONIBLE: 'El estado fenologico seleccionado no esta disponible.',
    };

    return mensajes[codigo] || null;
  }
}

ChanchitosService.MATRIZ_CANONICA = MATRIZ_CANONICA;

module.exports = ChanchitosService;
