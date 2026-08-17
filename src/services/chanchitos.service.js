const ChanchitosRepository = require('../repositories/chanchitos.repository');
const CatalogoSdpService = require('./catalogoSdp.service');
const AgroclimaMoniplaService = require('./agroclimaMonipla.service');
const { performance } = require('node:perf_hooks');

const MAX_INT = 2147483647;
const ESTADOS = [1, 2, 3];
const POSICIONES = [1, 2, 3, 4];
const HISTORIAL_PAGE_SIZES = [10, 25, 50];
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

  async obtenerHistorial(query = {}) {
    const inicioTotal = performance.now();
    const values = this.normalizarFiltrosHistorial(query);
    const errors = this.validarFiltrosHistorial(values);

    if (errors.length > 0) {
      return this.crearResultadoHistorialInvalido(values, errors);
    }

    const medir = async (nombre, operacion, metricas) => {
      const inicio = performance.now();
      const resultado = await operacion();
      metricas[nombre] = Math.round(performance.now() - inicio);
      return resultado;
    };
    const metricas = {};
    const [resumen, opciones] = await Promise.all([
      medir('resumenMs', () => this.chanchitosRepository.obtenerResumenHistorialChanchitos(values), metricas),
      medir('opcionesMs', () => this.obtenerOpcionesHistorial(), metricas),
    ]);
    const totalRegistros = Number(resumen.total_registros || 0);
    const totalPaginas = Math.max(1, Math.ceil(totalRegistros / values.pageSize));
    const pagina = Math.min(values.pagina, totalPaginas);
    const filtros = { ...values, pagina };
    const registros = await medir(
      'paginaMs',
      () => this.chanchitosRepository.listarHistorialChanchitos(filtros, pagina, values.pageSize),
      metricas
    );
    const inicioPreparacion = performance.now();
    const registrosPreparados = registros.map((registro) => this.prepararRegistroHistorial(registro, opciones));
    metricas.preparacionMs = Math.max(0, Math.round(performance.now() - inicioPreparacion));
    metricas.totalMs = Math.round(performance.now() - inicioTotal);
    console.info('[MONIPLA][CHANCHITOS][HISTORIAL][PERF]', metricas);

    return {
      success: true,
      errors: [],
      values: filtros,
      opciones,
      registros: registrosPreparados,
      resumen: {
        totalMonitoreos: totalRegistros,
        totalPlantas: Number(resumen.total_plantas || 0),
        totalBichos: Number(resumen.total_bichos || 0),
        monitoreosConDeteccion: Number(resumen.monitoreos_con_deteccion || 0),
      },
      paginacion: {
        totalRegistros,
        pagina,
        pageSize: filtros.pageSize,
        totalPaginas,
      },
    };
  }

  async eliminarMonitoreo(idMonitoreo, usuarioSesion) {
    const id = this.normalizarId(idMonitoreo);

    if (!id) {
      return { success: false, reason: 'ID_INVALIDO' };
    }

    if (!usuarioSesion || usuarioSesion.rol !== 'admin') {
      return { success: false, reason: 'NO_AUTORIZADO' };
    }

    try {
      const eliminado = await this.chanchitosRepository.eliminarMonitoreoTransaccional(id);

      return {
        success: true,
        idMonitoreo: eliminado.idMonitoreo,
        detallesEliminados: eliminado.detallesEliminados,
      };
    } catch (error) {
      if (['CHANCHITO_NO_EXISTE', 'CHANCHITO_CON_IMAGENES'].includes(error.message)) {
        return { success: false, reason: error.message };
      }

      throw error;
    }
  }

  async obtenerDetalle(idMonitoreo) {
    const inicioTotal = performance.now();
    const id = this.normalizarId(idMonitoreo);

    if (!id) {
      throw new Error('CHANCHITO_NO_EXISTE');
    }

    const inicioConsulta = performance.now();
    const resultado = await this.chanchitosRepository.obtenerDetalleChanchitos(id);
    const consultaMs = Math.round(performance.now() - inicioConsulta);

    if (!resultado || !resultado.cabecera) {
      throw new Error('CHANCHITO_NO_EXISTE');
    }

    const cabecera = resultado.cabecera;
    const cantidades = new Map((resultado.detalles || []).map((detalle) => [
      `${detalle.id_estadomonitoreo}-${detalle.id_estadoposicion}`,
      Number(detalle.cantidad_bichos || 0),
    ]));

    const detalle = {
      ...this.prepararRegistroHistorial(cabecera),
      fechaRegistro: this.formatearFecha(cabecera.fecha_registro),
      csg: this.textoSeguro(cabecera.csg),
      trazabilidad: this.textoSeguro(cabecera.trazabilidad),
      observaciones: this.textoSeguro(cabecera.observaciones),
      matriz: ESTADOS.map((idEstadoMonitoreo) => ({
        idEstadoMonitoreo,
        nombre: ({ 1: 'Ovisaco', 2: 'Ninfa', 3: 'Adulto' })[idEstadoMonitoreo],
        posiciones: POSICIONES.map((idEstadoPosicion) => ({
          idEstadoPosicion,
          cantidad: cantidades.get(`${idEstadoMonitoreo}-${idEstadoPosicion}`) || 0,
        })),
      })),
    };
    console.info('[MONIPLA][CHANCHITOS][DETALLE][PERF]', {
      consultaMs,
      preparacionMs: Math.max(0, Math.round(performance.now() - inicioTotal - consultaMs)),
      totalMs: Math.round(performance.now() - inicioTotal),
    });
    return detalle;
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

  normalizarFiltrosHistorial(query = {}) {
    return {
      fechaDesde: String(query.fechaDesde || '').trim() || null,
      fechaHasta: String(query.fechaHasta || '').trim() || null,
      genFundo: this.normalizarId(query.genFundo) || null,
      genCampo: this.normalizarId(query.genCampo) || null,
      genVariedad: this.normalizarId(query.genVariedad) || null,
      idCatalogoSdp: this.normalizarId(query.idCatalogoSdp) || null,
      idMonitoreador: this.normalizarId(query.idMonitoreador) || null,
      idEstadoFenologico: this.normalizarId(query.idEstadoFenologico) || null,
      deteccion: ['CON_DETECCION', 'SIN_DETECCION'].includes(String(query.deteccion || '').trim())
        ? String(query.deteccion).trim()
        : '',
      pagina: this.normalizarPagina(query.pagina),
      pageSize: this.normalizarPageSize(query.pageSize),
    };
  }

  validarFiltrosHistorial(filtros) {
    const errors = [];

    if (filtros.fechaDesde && !this.esFechaValida(filtros.fechaDesde)) {
      errors.push('La fecha desde no tiene un formato valido.');
    }

    if (filtros.fechaHasta && !this.esFechaValida(filtros.fechaHasta)) {
      errors.push('La fecha hasta no tiene un formato valido.');
    }

    if (this.esFechaValida(filtros.fechaDesde) && this.esFechaValida(filtros.fechaHasta)
      && filtros.fechaDesde > filtros.fechaHasta) {
      errors.push('La fecha desde no puede ser posterior a la fecha hasta.');
    }

    return errors;
  }

  crearResultadoHistorialInvalido(values, errors) {
    return {
      success: false,
      errors,
      values,
      opciones: { fundos: [], monitoreadores: [], estadosFenologicos: [] },
      registros: [],
      resumen: {
        totalMonitoreos: 0,
        totalPlantas: 0,
        totalBichos: 0,
        monitoreosConDeteccion: 0,
      },
      paginacion: {
        totalRegistros: 0,
        pagina: values.pagina,
        pageSize: values.pageSize,
        totalPaginas: 1,
      },
    };
  }

  prepararRegistroHistorial(registro, opciones = {}) {
    const totalBichos = Number(registro.total_bichos || 0);
    const horasFrio = this.formatearDecimal(registro.horas_frio_acumuladas);
    const diasGrado = this.formatearDecimal(registro.dias_grado_acumulados);

    return {
      idMonitoreo: registro.id_monitoreo,
      fechaMonitoreo: this.formatearFecha(registro.fecha_monitoreo),
      fundo: this.textoSeguro(registro.nombre_fundo),
      campo: this.textoSeguro(registro.nombre_campo),
      variedad: this.textoSeguro(registro.nombre_variedad),
      cuartel: this.textoSeguro(registro.codigo_cuartel),
      sdp: this.textoSeguro(registro.sdp),
      csg: this.textoSeguro(registro.csg),
      trazabilidad: this.textoSeguro(registro.trazabilidad),
      cantPlantas: Number(registro.cant_plantas || 0),
      estadoFenologico: this.textoSeguro(registro.nombre_estado_fenologico || (opciones.estadosFenologicos || []).find((item) => Number(item.value) === Number(registro.id_estadofenologico))?.label),
      monitoreador: this.textoSeguro(registro.nombre_monitoreador || (opciones.monitoreadores || []).find((item) => Number(item.id_monitoreador) === Number(registro.id_monitoreador))?.nombre_monitoreador),
      totalBichos,
      posicionesConDeteccion: Number(registro.posiciones_con_deteccion || 0),
      tieneDeteccion: totalBichos > 0,
      agroclima: {
        horasFrio,
        diasGrado,
        estacion: this.textoSeguro(registro.nombre_estacion_meteo),
        fechaCorte: this.formatearFecha(registro.fecha_corte_agroclima),
        observacion: this.textoSeguro(registro.agroclima_observacion),
        tieneDatos: horasFrio !== null || diasGrado !== null,
      },
    };
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

  normalizarTextoFiltro(value) {
    return String(value || '').trim().slice(0, 100);
  }

  async obtenerOpcionesHistorial() {
    const [fundos, monitoreadores, estadosFenologicos] = await Promise.all([
      this.catalogoSdpService.listarFondosDisponibles(),
      this.chanchitosRepository.listarMonitoreadoresActivos(),
      this.chanchitosRepository.listarEstadosFenologicosActivos(),
    ]);
    return { fundos, monitoreadores, estadosFenologicos };
  }

  normalizarPagina(value) {
    const pagina = Number.parseInt(value, 10);
    return Number.isSafeInteger(pagina) && pagina > 0 ? pagina : 1;
  }

  normalizarPageSize(value) {
    const pageSize = Number.parseInt(value, 10);
    return HISTORIAL_PAGE_SIZES.includes(pageSize) ? pageSize : 10;
  }

  textoSeguro(value) {
    return String(value || '').trim() || '-';
  }

  formatearFecha(value) {
    const texto = String(value || '').trim();
    return /^\d{4}-\d{2}-\d{2}$/.test(texto) ? texto : '-';
  }

  formatearDecimal(value) {
    if (value === null || value === undefined || value === '') {
      return null;
    }

    const numero = Number(value);
    return Number.isFinite(numero) ? numero.toFixed(2) : null;
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
