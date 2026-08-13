function parsearArgumentos(argv) {
  const opciones = {
    apply: false,
    idMonitoreo: null,
    fechaDesde: null,
    fechaHasta: null,
    genFundo: null,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const argumento = argv[index];
    const [nombre, valorIncluido] = argumento.split('=', 2);
    const valor = valorIncluido === undefined ? argv[index + 1] : valorIncluido;

    if (argumento === '--apply') {
      opciones.apply = true;
      continue;
    }

    if (['--id', '--from', '--to', '--fundo'].includes(nombre)) {
      if (valorIncluido === undefined) {
        index += 1;
      }

      if (nombre === '--id') opciones.idMonitoreo = normalizarEntero(valor, '--id');
      if (nombre === '--fundo') opciones.genFundo = normalizarEntero(valor, '--fundo');
      if (nombre === '--from') opciones.fechaDesde = normalizarFecha(valor, '--from');
      if (nombre === '--to') opciones.fechaHasta = normalizarFecha(valor, '--to');
      continue;
    }

    throw new Error(`USO_INVALIDO: argumento no reconocido ${argumento}.`);
  }

  const tieneRangoIncompleto = Boolean(opciones.fechaDesde) !== Boolean(opciones.fechaHasta);

  if (tieneRangoIncompleto) {
    throw new Error('USO_INVALIDO: --from y --to deben usarse juntos.');
  }

  if (opciones.fechaDesde && opciones.fechaDesde > opciones.fechaHasta) {
    throw new Error('USO_INVALIDO: --from no puede ser posterior a --to.');
  }

  if (opciones.idMonitoreo && (opciones.fechaDesde || opciones.genFundo)) {
    throw new Error('USO_INVALIDO: --id no se combina con --from, --to ni --fundo.');
  }

  if (opciones.apply && !opciones.idMonitoreo && !opciones.fechaDesde) {
    throw new Error('USO_INVALIDO: --apply requiere --id o un rango --from/--to.');
  }

  return opciones;
}

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

  if (
    date.getUTCFullYear() !== year
    || date.getUTCMonth() !== month - 1
    || date.getUTCDate() !== day
  ) {
    throw new Error(`USO_INVALIDO: ${argumento} requiere una fecha YYYY-MM-DD valida.`);
  }

  return fecha;
}

function normalizarNumero(valor) {
  if (valor === null || valor === undefined || valor === '') {
    return null;
  }

  const numero = Number(valor);
  return Number.isFinite(numero) ? numero : null;
}

function redondearDosDecimales(valor) {
  const numero = normalizarNumero(valor);
  return numero === null ? null : Math.round((numero + Number.EPSILON) * 100) / 100;
}

function formatearDecimal(valor) {
  const numero = normalizarNumero(valor);
  return numero === null ? 'NULL' : redondearDosDecimales(numero).toFixed(2);
}

function calcularFechaCorteEsperada(fechaMuestra) {
  const fecha = normalizarFecha(fechaMuestra, 'fecha_monitoreo');
  const [year, month, day] = fecha.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  date.setUTCDate(date.getUTCDate() - 1);
  return date.toISOString().slice(0, 10);
}

function normalizarTexto(valor) {
  if (valor === null || valor === undefined) {
    return null;
  }

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

function tieneMetricas(snapshot) {
  return snapshot.horasFrioAcumuladas !== null || snapshot.diasGradoAcumulados !== null;
}

function estadoSnapshot(snapshot) {
  const observacion = String(snapshot && snapshot.agroclimaObservacion || '').toUpperCase();

  if (tieneMetricas(snapshot)) {
    return observacion.includes('PARCIAL') ? 'PARCIAL' : 'OK';
  }

  if (observacion.includes('SIN ESTACION')) return 'SIN_ESTACION';
  if (observacion.includes('ERROR')) return 'ERROR';
  return 'SIN_DATOS';
}

function prioridadEstado(estado) {
  return {
    SIN_ESTACION: 0,
    ERROR: 0,
    SIN_DATOS: 1,
    PARCIAL: 2,
    OK: 3,
  }[estado] || 0;
}

function extraerCoberturaParcial(snapshot) {
  const observacion = String(snapshot && snapshot.agroclimaObservacion || '');
  const simple = observacion.match(/(\d+) dias con datos(?: y (\d+) sin datos)?/i);

  if (simple) {
    return {
      diasConDatos: Number(simple[1]),
      diasSinDatos: simple[2] === undefined ? null : Number(simple[2]),
    };
  }

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

  if (!coberturaActual || !coberturaPropuesta) {
    return false;
  }

  if (coberturaPropuesta.diasConDatos !== coberturaActual.diasConDatos) {
    return coberturaPropuesta.diasConDatos > coberturaActual.diasConDatos;
  }

  return coberturaActual.diasSinDatos !== null
    && coberturaPropuesta.diasSinDatos !== null
    && coberturaPropuesta.diasSinDatos < coberturaActual.diasSinDatos;
}

function decidirAccion(actual, propuesto) {
  const estadoActual = estadoSnapshot(actual);
  const estadoPropuesto = estadoSnapshot(propuesto);

  if (snapshotsIguales(actual, propuesto)) {
    return { accion: 'SIN_CAMBIOS', estadoActual, estadoPropuesto, actualizable: false };
  }

  if (estadoPropuesto === 'SIN_ESTACION') {
    if (tieneMetricas(actual)) {
      return { accion: 'NO_DEGRADAR', estadoActual, estadoPropuesto, actualizable: false };
    }

    return { accion: 'SIN_ESTACION', estadoActual, estadoPropuesto, actualizable: false };
  }

  if (estadoPropuesto === 'ERROR') {
    return { accion: 'ERROR', estadoActual, estadoPropuesto, actualizable: false };
  }

  if (prioridadEstado(estadoActual) > prioridadEstado(estadoPropuesto)) {
    return { accion: 'NO_DEGRADAR', estadoActual, estadoPropuesto, actualizable: false };
  }

  if (estadoActual === 'PARCIAL' && estadoPropuesto === 'PARCIAL' && !esMejorParcial(actual, propuesto)) {
    return { accion: 'NO_DEGRADAR', estadoActual, estadoPropuesto, actualizable: false };
  }

  if (estadoPropuesto === 'SIN_DATOS') {
    return { accion: 'SIN_DATOS', estadoActual, estadoPropuesto, actualizable: false };
  }

  return { accion: 'ACTUALIZARIA', estadoActual, estadoPropuesto, actualizable: true };
}

function crearResumen(candidatos) {
  return {
    candidatos,
    actualizables: 0,
    actualizados: 0,
    sinCambios: 0,
    noDegradados: 0,
    sinEstacion: 0,
    sinDatos: 0,
    errores: 0,
  };
}

function detalleCandidato(candidato, actual, propuesto, decision) {
  return {
    id_monitoreo: candidato.id_monitoreo,
    fecha_monitoreo: candidato.fecha_monitoreo,
    gen_fundo: candidato.gen_fundo,
    estado_actual: decision.estadoActual,
    estado_propuesto: decision.estadoPropuesto,
    estacion_actual: actual.nombreEstacionMeteo || 'NULL',
    estacion_propuesta: propuesto.nombreEstacionMeteo || 'NULL',
    hf_actual: formatearDecimal(actual.horasFrioAcumuladas),
    hf_propuesta: formatearDecimal(propuesto.horasFrioAcumuladas),
    dg_actual: formatearDecimal(actual.diasGradoAcumulados),
    dg_propuesta: formatearDecimal(propuesto.diasGradoAcumulados),
    fecha_corte: propuesto.fechaCorteAgroclima || calcularFechaCorteEsperada(candidato.fecha_monitoreo),
    accion: decision.accion,
  };
}

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
  const candidatos = await repository.listarMonitoreosChanchitosAgroclima(opciones);
  const resumen = crearResumen(candidatos.length);

  logger.info('[MONIPLA][CHANCHITOS][AGROCLIMA][BACKFILL][INICIO]', {
    modo: opciones.apply ? 'apply' : 'dry-run',
    idMonitoreo: opciones.idMonitoreo,
    fechaDesde: opciones.fechaDesde,
    fechaHasta: opciones.fechaHasta,
    genFundo: opciones.genFundo,
  });

  for (const candidato of candidatos) {
    const actual = crearSnapshotActual(candidato);
    let propuesto;

    try {
      propuesto = normalizarSnapshot(await agroclimaService.calcularSnapshotSeguroPorFundo(
        candidato.gen_fundo,
        candidato.fecha_monitoreo
      ));
    } catch (error) {
      resumen.errores += 1;
      logger.error('[MONIPLA][CHANCHITOS][AGROCLIMA][BACKFILL][ERROR]', {
        id_monitoreo: candidato.id_monitoreo,
        error: error.message,
      });
      continue;
    }

    const decision = decidirAccion(actual, propuesto);
    const detalle = detalleCandidato(candidato, actual, propuesto, decision);
    registrarDecision(resumen, decision.accion);

    if (!decision.actualizable || !opciones.apply) {
      logger.info('[MONIPLA][CHANCHITOS][AGROCLIMA][BACKFILL][REGISTRO]', detalle);
      continue;
    }

    try {
      const filasActualizadas = await repository.actualizarSnapshotChanchitosSiCoincide(
        candidato.id_monitoreo,
        propuesto,
        actual
      );

      if (filasActualizadas === 1) {
        resumen.actualizados += 1;
        logger.info('[MONIPLA][CHANCHITOS][AGROCLIMA][BACKFILL][ACTUALIZADO]', detalle);
      } else {
        resumen.noDegradados += 1;
        logger.info('[MONIPLA][CHANCHITOS][AGROCLIMA][BACKFILL][CONCURRENCIA]', {
          ...detalle,
          accion: 'NO_DEGRADAR',
        });
      }
    } catch (error) {
      resumen.errores += 1;
      logger.error('[MONIPLA][CHANCHITOS][AGROCLIMA][BACKFILL][ERROR]', {
        id_monitoreo: candidato.id_monitoreo,
        error: error.message,
      });
    }
  }

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

  if (resumen.errores > 0) {
    process.exitCode = 1;
  }
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
  registrarDecision,
  ejecutarBackfill,
};
