const AgroclimaRepository = require('../src/repositories/agroclima.repository');
const AgroclimaMoniplaService = require('../src/services/agroclimaMonipla.service');
const { poolPromise } = require('../src/config/db');

function parsearArgumentos(argv) {
  let apply = false;
  let idMuestreo = null;

  for (let index = 0; index < argv.length; index += 1) {
    const argumento = argv[index];

    if (argumento === '--apply') {
      apply = true;
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

  return { apply, idMuestreo };
}

function tieneValor(value) {
  return value !== null && value !== undefined;
}

function esSnapshotActualizable(snapshot) {
  return Boolean(snapshot && snapshot.fechaCorteAgroclima)
    && (tieneValor(snapshot.horasFrioAcumuladas) || tieneValor(snapshot.diasGradoAcumulados));
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
    sinEstacion: 0,
    sinDatos: 0,
    errores: 0,
    omitidosPorConcurrencia: 0,
  };
}

function mostrarResumen(resumen) {
  console.info('[MONIPLA][AGROCLIMA][BACKFILL][RESUMEN]', resumen);
}

async function cerrarConexion() {
  try {
    const pool = await poolPromise;
    await pool.close();
  } catch (error) {
    // La conexion puede no haberse establecido; el error principal ya se informa en main.
  }
}

async function main() {
  const opciones = parsearArgumentos(process.argv.slice(2));
  const repository = new AgroclimaRepository();
  const agroclimaService = new AgroclimaMoniplaService(repository);
  const candidatos = await repository.listarMuestreosPendientesBackfill(opciones.idMuestreo);
  const resumen = crearResumen(candidatos.length);

  console.info('[MONIPLA][AGROCLIMA][BACKFILL][INICIO]', {
    modo: opciones.apply ? 'apply' : 'dry-run',
    idMuestreo: opciones.idMuestreo,
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

    if (!esSnapshotActualizable(snapshot)) {
      const clasificacion = clasificarSnapshotNoActualizable(snapshot);
      resumen[clasificacion] += 1;
      console.info('[MONIPLA][AGROCLIMA][BACKFILL][SIN_ACTUALIZAR]', {
        idMuestreo: candidato.id_muestreo,
        motivo: clasificacion,
        observacion: snapshot && snapshot.agroclimaObservacion,
      });
      continue;
    }

    resumen.actualizables += 1;

    if (!opciones.apply) {
      console.info('[MONIPLA][AGROCLIMA][BACKFILL][DRY_RUN]', {
        idMuestreo: candidato.id_muestreo,
        fechaCorteAgroclima: snapshot.fechaCorteAgroclima,
      });
      continue;
    }

    try {
      const filasActualizadas = await repository.actualizarSnapshotSiPendienteBackfill(
        candidato.id_muestreo,
        snapshot
      );

      if (filasActualizadas === 1) {
        resumen.actualizados += 1;
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

main()
  .catch((error) => {
    console.error('[MONIPLA][AGROCLIMA][BACKFILL][FATAL]', error.message);
    process.exitCode = 1;
  })
  .finally(cerrarConexion);
