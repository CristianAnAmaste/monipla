function parsearArgumentos(argv) {
  let apply = false;
  let idMuestreo = null;
  let recalcular = false;
  let confirmarTodos = false;
  let stationIdUuid = null;

  for (let index = 0; index < argv.length; index += 1) {
    const argumento = argv[index];

    if (argumento === '--apply') {
      apply = true;
      continue;
    }

    if (argumento === '--recalcular') {
      recalcular = true;
      continue;
    }

    if (argumento === '--confirmar-todos') {
      confirmarTodos = true;
      continue;
    }

    if (argumento === '--station-id' || argumento.startsWith('--station-id=')) {
      const valor = argumento === '--station-id'
        ? argv[index + 1]
        : argumento.slice('--station-id='.length);
      const uuid = normalizarUuid(valor);

      if (!uuid || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(uuid)) {
        throw new Error('USO_INVALIDO: --station-id requiere un UUID valido.');
      }

      stationIdUuid = uuid;

      if (argumento === '--station-id') {
        index += 1;
      }

      continue;
    }

    if (argumento === '--id') {
      const valor = argv[index + 1];

      if (!/^\d+$/.test(String(valor || ''))) {
        throw new Error('USO_INVALIDO: --id requiere un id_muestreo entero positivo.');
      }

      const id = Number.parseInt(valor, 10);

      if (!Number.isSafeInteger(id) || id <= 0) {
        throw new Error('USO_INVALIDO: --id requiere un id_muestreo entero positivo.');
      }

      idMuestreo = id;
      index += 1;
      continue;
    }

    throw new Error(`USO_INVALIDO: argumento no reconocido ${argumento}.`);
  }

  if (confirmarTodos && (!apply || !recalcular || idMuestreo !== null)) {
    throw new Error(
      'USO_INVALIDO: --confirmar-todos solo se usa con --apply --recalcular y sin --id.'
    );
  }

  if (apply && recalcular && idMuestreo === null && !confirmarTodos) {
    throw new Error(
      'USO_INVALIDO: para recalcular todos debes agregar --confirmar-todos; usa antes --recalcular sin --apply.'
    );
  }

  return { apply, idMuestreo, recalcular, confirmarTodos, stationIdUuid };
}

function tieneValor(value) {
  return value !== null && value !== undefined;
}

function esSnapshotActualizable(snapshot) {
  return Boolean(snapshot && snapshot.fechaCorteAgroclima)
    && (tieneValor(snapshot.horasFrioAcumuladas) || tieneValor(snapshot.diasGradoAcumulados));
}

function esSnapshotSinEstacion(snapshot) {
  const observacion = String(snapshot && snapshot.agroclimaObservacion || '').trim().toUpperCase();
  return observacion.includes('SIN ESTACION');
}

function esSnapshotAplicable(snapshot) {
  return esSnapshotActualizable(snapshot) || esSnapshotSinEstacion(snapshot);
}

function clasificarSnapshotNoActualizable(snapshot) {
  const observacion = String(snapshot && snapshot.agroclimaObservacion || '').trim().toUpperCase();

  if (observacion.includes('SIN ESTACION')) {
    return 'sinEstacion';
  }

  if (observacion.includes('SIN DATOS')) {
    return 'sinDatos';
  }

  return 'errores';
}

function crearResumen(candidatos = 0, stationIdUuid = null) {
  return {
    candidatos,
    candidatosEstacion: 0,
    estacionSolicitadaUuid: stationIdUuid,
    actualizables: 0,
    actualizados: 0,
    sinCambios: 0,
    limpiadosSinEstacion: 0,
    sinEstacion: 0,
    sinDatos: 0,
    errores: 0,
    omitidosPorConcurrencia: 0,
    excluidosPorEstacion: 0,
    omitidosPorEstacionResuelta: 0,
    fechaCorteMinima: null,
    fechaCorteMaxima: null,
    fechasCorteDistintas: new Set(),
    otrasEstacionesIncluidas: 0,
  };
}

function normalizarTexto(value) {
  if (value === null || value === undefined) {
    return null;
  }

  const texto = String(value).trim();
  return texto || null;
}

function normalizarUuid(value) {
  const texto = normalizarTexto(value);
  return texto ? texto.toLowerCase() : null;
}

function normalizarNumero(value) {
  if (value === null || value === undefined || value === '') {
    return null;
  }

  const numero = Number(value);
  return Number.isFinite(numero) ? numero : null;
}

function crearSnapshotActual(candidato) {
  return {
    horasFrioAcumuladas: candidato.horas_frio_actuales,
    diasGradoAcumulados: candidato.dias_grado_actuales,
    estacionMeteoUuid: candidato.estacion_uuid_actual,
    nombreEstacionMeteo: candidato.nombre_estacion_actual,
    fechaCorteAgroclima: candidato.fecha_corte_actual,
    semanaIsoCorte: candidato.semana_iso_actual,
    temporadaAgroclima: candidato.temporada_actual,
    agroclimaObservacion: candidato.observacion_actual,
  };
}

function snapshotsIguales(actual, nuevo) {
  return normalizarNumero(actual.horasFrioAcumuladas) === normalizarNumero(nuevo.horasFrioAcumuladas)
    && normalizarNumero(actual.diasGradoAcumulados) === normalizarNumero(nuevo.diasGradoAcumulados)
    && normalizarUuid(actual.estacionMeteoUuid) === normalizarUuid(nuevo.estacionMeteoUuid)
    && normalizarTexto(actual.nombreEstacionMeteo) === normalizarTexto(nuevo.nombreEstacionMeteo)
    && normalizarTexto(actual.fechaCorteAgroclima) === normalizarTexto(nuevo.fechaCorteAgroclima)
    && normalizarNumero(actual.semanaIsoCorte) === normalizarNumero(nuevo.semanaIsoCorte)
    && normalizarTexto(actual.temporadaAgroclima) === normalizarTexto(nuevo.temporadaAgroclima)
    && normalizarTexto(actual.agroclimaObservacion) === normalizarTexto(nuevo.agroclimaObservacion);
}

function resumirSnapshot(snapshot) {
  return {
    estacion: snapshot.nombreEstacionMeteo || null,
    estacionUuid: snapshot.estacionMeteoUuid || null,
    horasFrio: snapshot.horasFrioAcumuladas ?? null,
    diasGrado: snapshot.diasGradoAcumulados ?? null,
    fechaCorte: snapshot.fechaCorteAgroclima || null,
    observacion: snapshot.agroclimaObservacion || null,
  };
}

function registrarFechaCorte(resumen, fechaCorte) {
  if (!fechaCorte) {
    return;
  }

  resumen.fechaCorteMinima = !resumen.fechaCorteMinima || fechaCorte < resumen.fechaCorteMinima
    ? fechaCorte
    : resumen.fechaCorteMinima;
  resumen.fechaCorteMaxima = !resumen.fechaCorteMaxima || fechaCorte > resumen.fechaCorteMaxima
    ? fechaCorte
    : resumen.fechaCorteMaxima;
  resumen.fechasCorteDistintas.add(fechaCorte);
}

function calcularFechaCorteAmericaSantiago(fechaMuestra) {
  const fecha = String(fechaMuestra || '').trim();

  if (!/^\d{4}-\d{2}-\d{2}$/.test(fecha)) {
    return null;
  }

  const [year, month, day] = fecha.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));

  if (
    date.getUTCFullYear() !== year
    || date.getUTCMonth() !== month - 1
    || date.getUTCDate() !== day
  ) {
    return null;
  }

  date.setUTCDate(date.getUTCDate() - 1);
  return date.toISOString().slice(0, 10);
}

function construirDetalleCandidato(candidato, snapshotActual, snapshotPropuesto, estacionConfigurada) {
  return {
    idMuestreo: candidato.id_muestreo,
    numeroMuestreo: candidato.numero_muestreo,
    fechaMuestra: candidato.fecha_recepcion_muestra,
    fechaCorteEsperada: calcularFechaCorteAmericaSantiago(candidato.fecha_recepcion_muestra),
    estacionConfigurada: estacionConfigurada && estacionConfigurada.nombre_estacion || null,
    estacionConfiguradaUuid: estacionConfigurada && normalizarUuid(estacionConfigurada.station_id_uuid),
    estacionResuelta: snapshotPropuesto && snapshotPropuesto.nombreEstacionMeteo || null,
    estacionResueltaUuid: snapshotPropuesto && normalizarUuid(snapshotPropuesto.estacionMeteoUuid),
    horasFrioActuales: snapshotActual.horasFrioAcumuladas,
    horasFrioPropuestas: snapshotPropuesto && snapshotPropuesto.horasFrioAcumuladas,
    diasGradoActuales: snapshotActual.diasGradoAcumulados,
    diasGradoPropuestos: snapshotPropuesto && snapshotPropuesto.diasGradoAcumulados,
    estadoCobertura: snapshotPropuesto && snapshotPropuesto.agroclimaObservacion || null,
  };
}

function resumirResumen(resumen) {
  const esVdc = resumen.estacionSolicitadaUuid === '444d144f-0cb1-4790-85cf-9efd79cd0ac6';

  return {
    ...resumen,
    candidatosVdc: esVdc ? resumen.candidatosEstacion : null,
    fechasCorteDistintas: resumen.fechasCorteDistintas.size,
    confirmacionSinOtrasEstaciones: resumen.otrasEstacionesIncluidas === 0,
  };
}

function mostrarResumen(resumen, logger = console) {
  logger.info('[MONIPLA][AGROCLIMA][BACKFILL][RESUMEN]', resumirResumen(resumen));
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

async function ejecutarBackfill(opciones, dependencias = {}) {
  const { repository, agroclimaService, logger = console } = dependencias;
  const candidatos = await repository.listarMuestreosPendientesBackfill(
    opciones.idMuestreo,
    opciones.recalcular
  );
  const resumen = crearResumen(opciones.stationIdUuid ? 0 : candidatos.length, opciones.stationIdUuid);

  logger.info('[MONIPLA][AGROCLIMA][BACKFILL][INICIO]', {
    modo: opciones.apply ? 'apply' : 'dry-run',
    idMuestreo: opciones.idMuestreo,
    recalcular: opciones.recalcular,
    stationIdUuid: opciones.stationIdUuid,
  });

  for (const candidato of candidatos) {
    let snapshot;
    let estacionesConfiguradas = null;
    let estacionConfigurada = null;

    if (opciones.stationIdUuid) {
      try {
        estacionesConfiguradas = await agroclimaService.resolverEstacionesConfiguradas(
          candidato.id_origen_muestra,
          candidato.fecha_recepcion_muestra
        );
        estacionConfigurada = (estacionesConfiguradas || []).find(
          (estacion) => estacion && estacion.station_id_uuid
        ) || null;
      } catch (error) {
        resumen.errores += 1;
        logger.error('[MONIPLA][AGROCLIMA][BACKFILL][ERROR]', {
          idMuestreo: candidato.id_muestreo,
          error: error.message,
        });
        continue;
      }

      if (
        !estacionConfigurada
        || normalizarUuid(estacionConfigurada.station_id_uuid) !== opciones.stationIdUuid
      ) {
        resumen.excluidosPorEstacion += 1;
        continue;
      }

      resumen.candidatos += 1;
      resumen.candidatosEstacion += 1;
      registrarFechaCorte(
        resumen,
        calcularFechaCorteAmericaSantiago(candidato.fecha_recepcion_muestra)
      );
    }

    try {
      snapshot = await agroclimaService.calcularSnapshotSeguro(
        candidato.id_origen_muestra,
        candidato.fecha_recepcion_muestra,
        null,
        estacionesConfiguradas
      );
    } catch (error) {
      resumen.errores += 1;
      logger.error('[MONIPLA][AGROCLIMA][BACKFILL][ERROR]', {
        idMuestreo: candidato.id_muestreo,
        error: error.message,
      });
      continue;
    }

    const snapshotActual = crearSnapshotActual(candidato);
    const detalleCandidato = construirDetalleCandidato(
      candidato,
      snapshotActual,
      snapshot,
      estacionConfigurada
    );

    if (
      opciones.stationIdUuid
      && normalizarUuid(snapshot && snapshot.estacionMeteoUuid) !== opciones.stationIdUuid
    ) {
      resumen.omitidosPorEstacionResuelta += 1;
      resumen.excluidosPorEstacion += 1;
      logger.info('[MONIPLA][AGROCLIMA][BACKFILL][OMITIDO_ESTACION]', detalleCandidato);
      continue;
    }

    if (!esSnapshotAplicable(snapshot)) {
      const clasificacion = clasificarSnapshotNoActualizable(snapshot);
      resumen[clasificacion] += 1;
      logger.info('[MONIPLA][AGROCLIMA][BACKFILL][SIN_ACTUALIZAR]', {
        ...detalleCandidato,
        motivo: clasificacion,
      });
      continue;
    }

    if (snapshotsIguales(snapshotActual, snapshot)) {
      resumen.sinCambios += 1;
      logger.info('[MONIPLA][AGROCLIMA][BACKFILL][SIN_CAMBIOS]', {
        ...detalleCandidato,
      });
      continue;
    }

    resumen.actualizables += 1;

    if (!opciones.apply) {
      logger.info('[MONIPLA][AGROCLIMA][BACKFILL][DRY_RUN]', {
        ...detalleCandidato,
        actual: resumirSnapshot(snapshotActual),
        propuesto: resumirSnapshot(snapshot),
      });
      continue;
    }

    try {
      const filasActualizadas = await repository.actualizarSnapshotSiPendienteBackfill(
        candidato.id_muestreo,
        snapshot,
        opciones.recalcular
      );

      if (filasActualizadas === 1) {
        resumen.actualizados += 1;

        if (esSnapshotSinEstacion(snapshot)) {
          resumen.limpiadosSinEstacion += 1;
        }
      } else {
        resumen.omitidosPorConcurrencia += 1;
        logger.info('[MONIPLA][AGROCLIMA][BACKFILL][CONCURRENCIA]', {
          ...detalleCandidato,
        });
      }
    } catch (error) {
      resumen.errores += 1;
      logger.error('[MONIPLA][AGROCLIMA][BACKFILL][ERROR]', {
        idMuestreo: candidato.id_muestreo,
        error: error.message,
      });
    }
  }

  mostrarResumen(resumen, logger);

  return resumirResumen(resumen);
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
      console.error('[MONIPLA][AGROCLIMA][BACKFILL][FATAL]', error.message);
      process.exitCode = 1;
    })
    .finally(cerrarConexion);
}

module.exports = {
  parsearArgumentos,
  esSnapshotAplicable,
  crearSnapshotActual,
  snapshotsIguales,
  calcularFechaCorteAmericaSantiago,
  ejecutarBackfill,
};
