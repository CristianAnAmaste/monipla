function parsearArgumentos(argv) {
  let apply = false;
  let idMuestreo = null;
  let recalcular = false;
  let confirmarTodos = false;

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

  return { apply, idMuestreo, recalcular, confirmarTodos };
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

function crearResumen(candidatos) {
  return {
    candidatos,
    actualizables: 0,
    actualizados: 0,
    sinCambios: 0,
    limpiadosSinEstacion: 0,
    sinEstacion: 0,
    sinDatos: 0,
    errores: 0,
    omitidosPorConcurrencia: 0,
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

function mostrarResumen(resumen) {
  console.info('[MONIPLA][AGROCLIMA][BACKFILL][RESUMEN]', resumen);
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
  const candidatos = await repository.listarMuestreosPendientesBackfill(
    opciones.idMuestreo,
    opciones.recalcular
  );
  const resumen = crearResumen(candidatos.length);

  console.info('[MONIPLA][AGROCLIMA][BACKFILL][INICIO]', {
    modo: opciones.apply ? 'apply' : 'dry-run',
    idMuestreo: opciones.idMuestreo,
    recalcular: opciones.recalcular,
  });

  for (const candidato of candidatos) {
    let snapshot;

    try {
      snapshot = await agroclimaService.calcularSnapshotSeguro(
        candidato.id_origen_muestra,
        candidato.fecha_recepcion_muestra
      );
    } catch (error) {
      resumen.errores += 1;
      console.error('[MONIPLA][AGROCLIMA][BACKFILL][ERROR]', {
        idMuestreo: candidato.id_muestreo,
        error: error.message,
      });
      continue;
    }

    if (!esSnapshotAplicable(snapshot)) {
      const clasificacion = clasificarSnapshotNoActualizable(snapshot);
      resumen[clasificacion] += 1;
      console.info('[MONIPLA][AGROCLIMA][BACKFILL][SIN_ACTUALIZAR]', {
        idMuestreo: candidato.id_muestreo,
        motivo: clasificacion,
        observacion: snapshot && snapshot.agroclimaObservacion,
      });
      continue;
    }

    const snapshotActual = crearSnapshotActual(candidato);

    if (snapshotsIguales(snapshotActual, snapshot)) {
      resumen.sinCambios += 1;
      console.info('[MONIPLA][AGROCLIMA][BACKFILL][SIN_CAMBIOS]', {
        idMuestreo: candidato.id_muestreo,
        numeroMuestreo: candidato.numero_muestreo,
        fundo: candidato.nombre_fundo,
      });
      continue;
    }

    resumen.actualizables += 1;

    if (!opciones.apply) {
      console.info('[MONIPLA][AGROCLIMA][BACKFILL][DRY_RUN]', {
        idMuestreo: candidato.id_muestreo,
        numeroMuestreo: candidato.numero_muestreo,
        fundo: candidato.nombre_fundo,
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
        console.info('[MONIPLA][AGROCLIMA][BACKFILL][CONCURRENCIA]', {
          idMuestreo: candidato.id_muestreo,
        });
      }
    } catch (error) {
      resumen.errores += 1;
      console.error('[MONIPLA][AGROCLIMA][BACKFILL][ERROR]', {
        idMuestreo: candidato.id_muestreo,
        error: error.message,
      });
    }
  }

  mostrarResumen(resumen);

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
};
