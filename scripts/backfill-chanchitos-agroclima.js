function normalizarEntero(valor, argumento) {
  if (!/^\d+$/.test(String(valor || ''))) {
    throw new Error(`USO_INVALIDO: ${argumento} requiere un entero positivo.`);
  }

  const numero = Number.parseInt(valor, 10);

  if (!Number.isSafeInteger(numero) || numero <= 0) {
    throw new Error(`USO_INVALIDO: ${argumento} requiere un entero positivo.`);
  }

  return numero;
}

function normalizarFecha(valor, argumento) {
  const fecha = String(valor || '').trim();

  if (!/^\d{4}-\d{2}-\d{2}$/.test(fecha)) {
    throw new Error(`USO_INVALIDO: ${argumento} requiere una fecha YYYY-MM-DD valida.`);
  }

  const [year, month, day] = fecha.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));

  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) {
    throw new Error(`USO_INVALIDO: ${argumento} requiere una fecha YYYY-MM-DD valida.`);
  }

  return fecha;
}

function normalizarIds(valor) {
  const ids = String(valor || '')
    .split(',')
    .map((id) => id.trim())
    .filter(Boolean)
    .map((id) => normalizarEntero(id, '--ids'));

  if (ids.length === 0) {
    throw new Error('USO_INVALIDO: --ids requiere al menos un ID.');
  }

  return [...new Set(ids)];
}

function parsearArgumentos(argv) {
  const opciones = {
    apply: false,
    dryRun: true,
    confirmarTodos: false,
    ids: [],
    fechaDesde: null,
    fechaHasta: null,
    genFundo: null,
    limit: null,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const argumento = argv[index];
    const [nombre, valorIncluido] = argumento.split('=', 2);
    const valor = valorIncluido === undefined ? argv[index + 1] : valorIncluido;

    if (argumento === '--apply') {
      opciones.apply = true;
      opciones.dryRun = false;
      continue;
    }

    if (argumento === '--dry-run') {
      opciones.dryRun = true;
      continue;
    }

    if (argumento === '--confirmar-todos') {
      opciones.confirmarTodos = true;
      continue;
    }

    if (['--ids', '--from', '--to', '--fundo', '--limit'].includes(nombre)) {
      if (valorIncluido === undefined) index += 1;
      if (nombre === '--ids') opciones.ids = normalizarIds(valor);
      if (nombre === '--from') opciones.fechaDesde = normalizarFecha(valor, '--from');
      if (nombre === '--to') opciones.fechaHasta = normalizarFecha(valor, '--to');
      if (nombre === '--fundo') opciones.genFundo = normalizarEntero(valor, '--fundo');
      if (nombre === '--limit') opciones.limit = normalizarEntero(valor, '--limit');
      continue;
    }

    throw new Error(`USO_INVALIDO: argumento no reconocido ${argumento}.`);
  }

  if (opciones.apply && argv.includes('--dry-run')) {
    throw new Error('USO_INVALIDO: --apply y --dry-run no se pueden combinar.');
  }

  if (Boolean(opciones.fechaDesde) !== Boolean(opciones.fechaHasta)) {
    throw new Error('USO_INVALIDO: --from y --to deben usarse juntos.');
  }

  if (opciones.fechaDesde && opciones.fechaDesde > opciones.fechaHasta) {
    throw new Error('USO_INVALIDO: --from no puede ser posterior a --to.');
  }

  if (opciones.apply && opciones.ids.length === 0 && !opciones.confirmarTodos) {
    throw new Error('USO_INVALIDO: --apply sin --ids requiere --confirmar-todos.');
  }

  return opciones;
}

function normalizarNumero(valor) {
  if (valor === null || valor === undefined || valor === '') return null;
  const numero = Number(valor);
  return Number.isFinite(numero) ? numero : null;
}

function redondearDosDecimales(valor) {
  const numero = normalizarNumero(valor);
  return numero === null ? null : Math.round((numero + Number.EPSILON) * 100) / 100;
}

function formatearDecimal(valor) {
  const numero = redondearDosDecimales(valor);
  return numero === null ? 'NULL' : numero.toFixed(2);
}

function calcularFechaCorteEsperada(fechaMuestra) {
  const fecha = normalizarFecha(fechaMuestra, 'fecha_monitoreo');
  const date = new Date(`${fecha}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() - 1);
  return date.toISOString().slice(0, 10);
}

function normalizarTexto(valor) {
  if (valor === null || valor === undefined) return null;
  const texto = String(valor).trim();
  return texto || null;
}

function normalizarUuid(valor) {
  const texto = normalizarTexto(valor);
  return texto ? texto.toLowerCase() : null;
}

function crearSnapshotActual(candidato) {
  return {
    horasFrioAcumuladas: redondearDosDecimales(candidato.horas_frio_actuales),
    diasGradoAcumulados: redondearDosDecimales(candidato.dias_grado_actuales),
    estacionMeteoUuid: normalizarUuid(candidato.estacion_uuid_actual),
    nombreEstacionMeteo: normalizarTexto(candidato.nombre_estacion_actual),
    fechaCorteAgroclima: normalizarTexto(candidato.fecha_corte_actual),
    semanaIsoCorte: normalizarNumero(candidato.semana_iso_actual),
    temporadaAgroclima: normalizarTexto(candidato.temporada_actual),
    agroclimaObservacion: normalizarTexto(candidato.observacion_actual),
  };
}

function normalizarSnapshot(snapshot = {}) {
  return {
    horasFrioAcumuladas: redondearDosDecimales(snapshot.horasFrioAcumuladas),
    diasGradoAcumulados: redondearDosDecimales(snapshot.diasGradoAcumulados),
    estacionMeteoUuid: normalizarUuid(snapshot.estacionMeteoUuid),
    nombreEstacionMeteo: normalizarTexto(snapshot.nombreEstacionMeteo),
    fechaCorteAgroclima: normalizarTexto(snapshot.fechaCorteAgroclima),
    semanaIsoCorte: normalizarNumero(snapshot.semanaIsoCorte),
    temporadaAgroclima: normalizarTexto(snapshot.temporadaAgroclima),
    agroclimaObservacion: normalizarTexto(snapshot.agroclimaObservacion),
  };
}

function tieneMetricas(snapshot) {
  return snapshot.horasFrioAcumuladas !== null || snapshot.diasGradoAcumulados !== null;
}

function estadoSnapshot(snapshot) {
  const observacion = String(snapshot && snapshot.agroclimaObservacion || '').toUpperCase();
  if (tieneMetricas(snapshot)) return observacion.includes('PARCIAL') ? 'PARCIAL' : 'OK';
  if (observacion.includes('NO CORRESPONDE') || observacion.includes('NO_APLICA')) return 'NO_APLICA';
  if (observacion.includes('SIN ESTACION')) return 'SIN_ESTACION';
  if (observacion.includes('ERROR')) return 'ERROR';
  return 'SIN_DATOS';
}

// Mantiene el contrato consumido por reconcile-chanchitos-agroclima.js.
function snapshotsIguales(actual, propuesto) {
  return actual.horasFrioAcumuladas === propuesto.horasFrioAcumuladas
    && actual.diasGradoAcumulados === propuesto.diasGradoAcumulados
    && actual.estacionMeteoUuid === propuesto.estacionMeteoUuid
    && actual.nombreEstacionMeteo === propuesto.nombreEstacionMeteo
    && actual.fechaCorteAgroclima === propuesto.fechaCorteAgroclima
    && actual.semanaIsoCorte === propuesto.semanaIsoCorte
    && actual.temporadaAgroclima === propuesto.temporadaAgroclima
    && actual.agroclimaObservacion === propuesto.agroclimaObservacion;
}

function extraerCoberturaParcial(snapshot) {
  const observacion = String(snapshot && snapshot.agroclimaObservacion || '');
  const simple = observacion.match(/(\d+) dias con datos(?: y (\d+) sin datos)?/i);
  if (simple) return { diasConDatos: Number(simple[1]), diasSinDatos: simple[2] === undefined ? null : Number(simple[2]) };
  const completos = observacion.match(/(\d+) dias con cobertura completa/i);
  const parciales = observacion.match(/(\d+) dias con cobertura parcial incluidos/i);
  const sinTemperatura = observacion.match(/(\d+) dias sin temperatura no incluidos/i);
  if (completos || parciales) {
    return {
      diasConDatos: Number(completos && completos[1] || 0) + Number(parciales && parciales[1] || 0),
      diasSinDatos: sinTemperatura ? Number(sinTemperatura[1]) : null,
    };
  }
  return null;
}

function esMejorParcial(actual, propuesto) {
  const coberturaActual = extraerCoberturaParcial(actual);
  const coberturaPropuesta = extraerCoberturaParcial(propuesto);
  if (!coberturaActual || !coberturaPropuesta) return false;
  if (coberturaPropuesta.diasConDatos !== coberturaActual.diasConDatos) {
    return coberturaPropuesta.diasConDatos > coberturaActual.diasConDatos;
  }
  return coberturaActual.diasSinDatos !== null
    && coberturaPropuesta.diasSinDatos !== null
    && coberturaPropuesta.diasSinDatos < coberturaActual.diasSinDatos;
}

function prioridadEstado(estado) {
  return { SIN_ESTACION: 0, ERROR: 0, SIN_DATOS: 1, PARCIAL: 2, OK: 3 }[estado] || 0;
}

function decidirAccion(actual, propuesto) {
  const estadoActual = estadoSnapshot(actual);
  const estadoPropuesto = estadoSnapshot(propuesto);
  if (snapshotsIguales(actual, propuesto)) return { accion: 'SIN_CAMBIOS', estadoActual, estadoPropuesto, actualizable: false };
  if (estadoPropuesto === 'SIN_ESTACION') return { accion: tieneMetricas(actual) ? 'NO_DEGRADAR' : 'SIN_ESTACION', estadoActual, estadoPropuesto, actualizable: false };
  if (estadoPropuesto === 'ERROR') return { accion: 'ERROR', estadoActual, estadoPropuesto, actualizable: false };
  if (prioridadEstado(estadoActual) > prioridadEstado(estadoPropuesto)) return { accion: 'NO_DEGRADAR', estadoActual, estadoPropuesto, actualizable: false };
  if (estadoActual === 'PARCIAL' && estadoPropuesto === 'PARCIAL' && !esMejorParcial(actual, propuesto)) return { accion: 'NO_DEGRADAR', estadoActual, estadoPropuesto, actualizable: false };
  if (estadoPropuesto === 'SIN_DATOS') return { accion: 'SIN_DATOS', estadoActual, estadoPropuesto, actualizable: false };
  return { accion: 'ACTUALIZARIA', estadoActual, estadoPropuesto, actualizable: true };
}

function esFechaIsoValida(fecha) {
  return /^\d{4}-\d{2}-\d{2}$/.test(String(fecha || ''));
}

function esEstacionValida(uuid) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(uuid || ''));
}

function clasificarPropuesta(snapshot) {
  const estado = estadoSnapshot(snapshot);
  if (estado === 'SIN_ESTACION' || estado === 'SIN_DATOS' || estado === 'NO_APLICA' || estado === 'ERROR') return estado;
  if (!esFechaIsoValida(snapshot.fechaCorteAgroclima) || !esEstacionValida(snapshot.estacionMeteoUuid) || !tieneMetricas(snapshot)) return 'ERROR';
  return 'ACTUALIZABLE';
}

function crearResumen(candidatos) {
  return {
    candidatos,
    actualizables: 0,
    actualizados: 0,
    sinCambios: 0,
    noDegradados: 0,
    sinDatos: 0,
    sinEstacion: 0,
    noAplica: 0,
    yaCompletos: 0,
    cambiosConcurrentes: 0,
    errores: 0,
    llamadasRealizadas: 0,
    duracionMs: 0,
  };
}

function detalleCandidato(candidato, actual, propuesto, estado) {
  const decision = estado && typeof estado === 'object' ? estado : null;
  const estadoFinal = decision ? decision.accion : estado;
  return {
    id_monitoreo: candidato.id_monitoreo,
    gen_fundo: candidato.gen_fundo,
    fecha_monitoreo: candidato.fecha_monitoreo,
    fecha_corte_esperada: calcularFechaCorteEsperada(candidato.fecha_monitoreo),
    estacion_anterior: actual.nombreEstacionMeteo || 'NULL',
    estacion_propuesta: propuesto.nombreEstacionMeteo || 'NULL',
    hf_anterior: formatearDecimal(actual.horasFrioAcumuladas),
    hf_propuesta: formatearDecimal(propuesto.horasFrioAcumuladas),
    dg_anterior: formatearDecimal(actual.diasGradoAcumulados),
    dg_propuesta: formatearDecimal(propuesto.diasGradoAcumulados),
    observacion_propuesta: propuesto.agroclimaObservacion || 'NULL',
    fecha_corte: propuesto.fechaCorteAgroclima || calcularFechaCorteEsperada(candidato.fecha_monitoreo),
    estado_actual: decision ? decision.estadoActual : estadoSnapshot(actual),
    estado_propuesto: decision ? decision.estadoPropuesto : estadoSnapshot(propuesto),
    estacion_actual: actual.nombreEstacionMeteo || 'NULL',
    hf_actual: formatearDecimal(actual.horasFrioAcumuladas),
    dg_actual: formatearDecimal(actual.diasGradoAcumulados),
    hf_propuesta: formatearDecimal(propuesto.horasFrioAcumuladas),
    dg_propuesta: formatearDecimal(propuesto.diasGradoAcumulados),
    accion: decision ? decision.accion : estadoFinal,
    estado: estadoFinal,
  };
}

function registrarEstado(resumen, estado) {
  if (estado === 'ACTUALIZABLE') resumen.actualizables += 1;
  if (estado === 'SIN_DATOS') resumen.sinDatos += 1;
  if (estado === 'SIN_ESTACION') resumen.sinEstacion += 1;
  if (estado === 'NO_APLICA') resumen.noAplica += 1;
  if (estado === 'YA_COMPLETO') resumen.yaCompletos += 1;
  if (estado === 'CAMBIO_CONCURRENTE') resumen.cambiosConcurrentes += 1;
  if (estado === 'ERROR') resumen.errores += 1;
}

// Compatibilidad con la reconciliacion diaria, que permite mejorar parciales.
function registrarDecision(resumen, accion) {
  if (accion === 'ACTUALIZARIA') resumen.actualizables += 1;
  if (accion === 'SIN_CAMBIOS') resumen.sinCambios += 1;
  if (accion === 'NO_DEGRADAR') resumen.noDegradados += 1;
  if (accion === 'SIN_ESTACION') resumen.sinEstacion += 1;
  if (accion === 'SIN_DATOS') resumen.sinDatos += 1;
  if (accion === 'ERROR') resumen.errores += 1;
}

async function ejecutarBackfill(opciones, dependencias = {}) {
  const { repository, agroclimaService, logger = console } = dependencias;
  const inicio = Date.now();
  const candidatos = await repository.listarMonitoreosChanchitosPendientesBackfill(opciones);
  const resumen = crearResumen(candidatos.length);

  logger.info('[MONIPLA][CHANCHITOS][AGROCLIMA][BACKFILL][INICIO]', {
    modo: opciones.apply ? 'apply' : 'dry-run', ids: opciones.ids, fechaDesde: opciones.fechaDesde,
    fechaHasta: opciones.fechaHasta, genFundo: opciones.genFundo, limit: opciones.limit,
  });

  for (const candidato of candidatos) {
    const actual = crearSnapshotActual(candidato);

    if (tieneMetricas(actual)) {
      const detalleCompleto = detalleCandidato(candidato, actual, actual, 'YA_COMPLETO');
      registrarEstado(resumen, 'YA_COMPLETO');
      logger.info('[MONIPLA][CHANCHITOS][AGROCLIMA][BACKFILL][REGISTRO]', detalleCompleto);
      continue;
    }

    let propuesto;
    try {
      resumen.llamadasRealizadas += 1;
      propuesto = normalizarSnapshot(await agroclimaService.calcularSnapshotSeguroPorFundo(
        candidato.gen_fundo,
        candidato.fecha_monitoreo
      ));
    } catch (error) {
      const detalleError = detalleCandidato(candidato, actual, {}, 'ERROR');
      registrarEstado(resumen, 'ERROR');
      logger.error('[MONIPLA][CHANCHITOS][AGROCLIMA][BACKFILL][ERROR]', { ...detalleError, error: error.message });
      continue;
    }

    let estado = clasificarPropuesta(propuesto);
    let detalle = detalleCandidato(candidato, actual, propuesto, estado);
    registrarEstado(resumen, estado);

    if (estado !== 'ACTUALIZABLE' || !opciones.apply) {
      logger.info('[MONIPLA][CHANCHITOS][AGROCLIMA][BACKFILL][REGISTRO]', detalle);
      continue;
    }

    try {
      const filasActualizadas = await repository.actualizarSnapshotChanchitosPendiente(
        candidato.id_monitoreo,
        candidato.fecha_monitoreo,
        propuesto
      );

      if (filasActualizadas === 1) {
        resumen.actualizados += 1;
        logger.info('[MONIPLA][CHANCHITOS][AGROCLIMA][BACKFILL][ACTUALIZADO]', detalle);
      } else {
        resumen.actualizables -= 1;
        estado = 'CAMBIO_CONCURRENTE';
        detalle = { ...detalle, estado };
        registrarEstado(resumen, estado);
        logger.info('[MONIPLA][CHANCHITOS][AGROCLIMA][BACKFILL][CONCURRENCIA]', detalle);
      }
    } catch (error) {
      resumen.actualizables -= 1;
      registrarEstado(resumen, 'ERROR');
      logger.error('[MONIPLA][CHANCHITOS][AGROCLIMA][BACKFILL][ERROR]', { ...detalle, estado: 'ERROR', error: error.message });
    }
  }

  resumen.duracionMs = Date.now() - inicio;
  logger.info('[MONIPLA][CHANCHITOS][AGROCLIMA][BACKFILL][RESUMEN]', resumen);
  return resumen;
}

async function cerrarConexion() {
  try {
    const { poolPromise } = require('../src/config/db');
    const pool = await poolPromise;
    await pool.close();
  } catch (error) {
    // La conexion puede no haberse establecido; el error principal ya se informa en main.
  }
}

async function main() {
  const AgroclimaRepository = require('../src/repositories/agroclima.repository');
  const AgroclimaMoniplaService = require('../src/services/agroclimaMonipla.service');
  const opciones = parsearArgumentos(process.argv.slice(2));
  const repository = new AgroclimaRepository();
  const agroclimaService = new AgroclimaMoniplaService(repository);
  const resumen = await ejecutarBackfill(opciones, { repository, agroclimaService });
  if (resumen.errores > 0) process.exitCode = 1;
}

if (require.main === module) {
  main()
    .catch((error) => {
      console.error('[MONIPLA][CHANCHITOS][AGROCLIMA][BACKFILL][FATAL]', error.message);
      process.exitCode = 1;
    })
    .finally(cerrarConexion);
}

module.exports = {
  parsearArgumentos,
  crearSnapshotActual,
  normalizarSnapshot,
  estadoSnapshot,
  esMejorParcial,
  decidirAccion,
  formatearDecimal,
  calcularFechaCorteEsperada,
  crearResumen,
  detalleCandidato,
  registrarEstado,
  registrarDecision,
  clasificarPropuesta,
  ejecutarBackfill,
};
