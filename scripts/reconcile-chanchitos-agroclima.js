const {
  crearSnapshotActual,
  normalizarSnapshot,
  decidirAccion,
  crearResumen,
  detalleCandidato,
  registrarDecision,
} = require('./backfill-chanchitos-agroclima');

const DIAS_PREDETERMINADOS = 60;
const ZONA_HORARIA_CHILE = 'America/Santiago';

function normalizarDias(valor) {
  if (!/^\d+$/.test(String(valor || ''))) {
    throw new Error('USO_INVALIDO: --days requiere un entero positivo.');
  }

  const dias = Number.parseInt(valor, 10);

  if (!Number.isSafeInteger(dias) || dias <= 0) {
    throw new Error('USO_INVALIDO: --days requiere un entero positivo.');
  }

  return dias;
}

function parsearArgumentos(argv) {
  const opciones = {
    apply: false,
    dias: DIAS_PREDETERMINADOS,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const argumento = argv[index];
    const [nombre, valorIncluido] = argumento.split('=', 2);

    if (argumento === '--apply') {
      opciones.apply = true;
      continue;
    }

    if (nombre === '--days') {
      const valor = valorIncluido === undefined ? argv[index + 1] : valorIncluido;

      if (valorIncluido === undefined) {
        index += 1;
      }

      opciones.dias = normalizarDias(valor);
      continue;
    }

    throw new Error(`USO_INVALIDO: argumento no reconocido ${argumento}.`);
  }

  return opciones;
}

function fechaActualEnSantiago(ahora = new Date()) {
  const partes = new Intl.DateTimeFormat('en-CA', {
    timeZone: ZONA_HORARIA_CHILE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(ahora);
  const valores = Object.fromEntries(
    partes
      .filter(({ type }) => type !== 'literal')
      .map(({ type, value }) => [type, value])
  );

  return `${valores.year}-${valores.month}-${valores.day}`;
}

function calcularVentanaReciente(dias = DIAS_PREDETERMINADOS, ahora = new Date()) {
  const fechaHasta = fechaActualEnSantiago(ahora);
  const fechaInicio = new Date(`${fechaHasta}T00:00:00.000Z`);
  fechaInicio.setUTCDate(fechaInicio.getUTCDate() - (dias - 1));

  return {
    fechaDesde: fechaInicio.toISOString().slice(0, 10),
    fechaHasta,
  };
}

function detalleReconciliacion(candidato, actual, propuesto, decision) {
  const detalle = detalleCandidato(candidato, actual, propuesto, decision);

  return {
    ...detalle,
    fundo: candidato.gen_fundo,
  };
}

async function ejecutarReconciliacion(opciones, dependencias = {}, ahora = new Date()) {
  const { repository, agroclimaService, logger = console } = dependencias;
  const ventana = calcularVentanaReciente(opciones.dias, ahora);
  const candidatos = await repository.listarMonitoreosChanchitosPendientesReconciliacion(ventana);
  const resumen = crearResumen(candidatos.length);

  logger.info('[MONIPLA][CHANCHITOS][AGROCLIMA][RECONCILE][INICIO]', {
    modo: opciones.apply ? 'apply' : 'dry-run',
    dias: opciones.dias,
    ...ventana,
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
      logger.error('[MONIPLA][CHANCHITOS][AGROCLIMA][RECONCILE][ERROR]', {
        id_monitoreo: candidato.id_monitoreo,
        error: error.message,
      });
      continue;
    }

    const decision = decidirAccion(actual, propuesto);
    const detalle = detalleReconciliacion(candidato, actual, propuesto, decision);
    registrarDecision(resumen, decision.accion);

    if (!decision.actualizable || !opciones.apply) {
      logger.info('[MONIPLA][CHANCHITOS][AGROCLIMA][RECONCILE][REGISTRO]', detalle);
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
        logger.info('[MONIPLA][CHANCHITOS][AGROCLIMA][RECONCILE][ACTUALIZADO]', detalle);
      } else {
        resumen.noDegradados += 1;
        logger.info('[MONIPLA][CHANCHITOS][AGROCLIMA][RECONCILE][CONCURRENCIA]', {
          ...detalle,
          accion: 'NO_DEGRADAR',
        });
      }
    } catch (error) {
      resumen.errores += 1;
      logger.error('[MONIPLA][CHANCHITOS][AGROCLIMA][RECONCILE][ERROR]', {
        id_monitoreo: candidato.id_monitoreo,
        error: error.message,
      });
    }
  }

  logger.info('[MONIPLA][CHANCHITOS][AGROCLIMA][RECONCILE][RESUMEN]', resumen);
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
  const resumen = await ejecutarReconciliacion(opciones, { repository, agroclimaService });

  if (resumen.errores > 0) {
    process.exitCode = 1;
  }
}

if (require.main === module) {
  main()
    .catch((error) => {
      console.error('[MONIPLA][CHANCHITOS][AGROCLIMA][RECONCILE][FATAL]', error.message);
      process.exitCode = 1;
    })
    .finally(cerrarConexion);
}

module.exports = {
  DIAS_PREDETERMINADOS,
  parsearArgumentos,
  fechaActualEnSantiago,
  calcularVentanaReciente,
  ejecutarReconciliacion,
};
