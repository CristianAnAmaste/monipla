const AgroclimaRepository = require('../repositories/agroclima.repository');
const MeteoFealClient = require('./meteoFealClient');

const OBSERVACIONES = {
  SIN_ESTACION: 'Sin estacion meteorologica asociada al fundo.',
  OK: 'Agroclima OK desde Meteo FEAL.',
  PARCIAL: 'Agroclima parcial: existen dias sin datos en el periodo.',
  SIN_DATOS: 'Sin datos agroclimaticos para la fecha de corte.',
  ERROR: 'Error al consultar Meteo FEAL.',
};

class AgroclimaMoniplaService {
  constructor(
    agroclimaRepository = new AgroclimaRepository(),
    meteoFealClient = new MeteoFealClient()
  ) {
    this.agroclimaRepository = agroclimaRepository;
    this.meteoFealClient = meteoFealClient;
  }

  async calcularSnapshotSeguro(idOrigenMuestra, fechaRecepcionMuestra, transaction = null) {
    try {
      return await this.calcularSnapshot(idOrigenMuestra, fechaRecepcionMuestra, transaction);
    } catch (error) {
      console.error('[MONIPLA][AGROCLIMA][ERROR]', {
        idOrigenMuestra,
        fechaRecepcionMuestra,
        error: error.message,
      });

      return this.crearSnapshotBase(null, OBSERVACIONES.ERROR);
    }
  }

  async calcularSnapshot(idOrigenMuestra, fechaRecepcionMuestra, transaction = null) {
    const fechaMuestra = this.formatearFechaIso(fechaRecepcionMuestra);
    const snapshot = this.crearSnapshotBase(null, null);

    const estacion = await this.agroclimaRepository.resolverEstacionPorOrigen(
      idOrigenMuestra,
      fechaMuestra,
      transaction
    );

    if (!estacion || !estacion.station_id_uuid) {
      return {
        ...snapshot,
        agroclimaObservacion: OBSERVACIONES.SIN_ESTACION,
      };
    }

    snapshot.estacionMeteoUuid = this.normalizarUuid(estacion.station_id_uuid);
    snapshot.nombreEstacionMeteo = estacion.nombre_estacion || null;

    let response;

    try {
      response = await this.meteoFealClient.obtenerAcumuladoAgroclimatico({
        stationIdUuid: snapshot.estacionMeteoUuid,
        fechaMuestra,
      });
    } catch (error) {
      console.error('[MONIPLA][AGROCLIMA][METEO_FEAL_ERROR]', {
        idOrigenMuestra,
        stationIdUuid: snapshot.estacionMeteoUuid,
        fechaMuestra,
        error: error.message,
      });

      return {
        ...snapshot,
        agroclimaObservacion: OBSERVACIONES.ERROR,
      };
    }

    const snapshotFinal = {
      ...snapshot,
      ...this.mapearRespuestaMeteoFeal(response),
    };

    this.logDebug('SNAPSHOT', {
      idOrigenMuestra,
      station_id_uuid: snapshot.estacionMeteoUuid,
      fecha_muestra: fechaMuestra,
      response,
      snapshot: snapshotFinal,
    });

    return snapshotFinal;
  }

  crearSnapshotBase(fechaCorte, observacion) {
    return {
      horasFrioAcumuladas: null,
      diasGradoAcumulados: null,
      estacionMeteoUuid: null,
      nombreEstacionMeteo: null,
      fechaCorteAgroclima: fechaCorte || null,
      semanaIsoCorte: null,
      temporadaAgroclima: null,
      agroclimaObservacion: observacion,
    };
  }

  mapearRespuestaMeteoFeal(response) {
    const status = String(response && response.calculation_status || '').trim();
    const base = {
      fechaCorteAgroclima: this.formatearFechaIso(response && response.fecha_corte),
      semanaIsoCorte: response && response.semana_corte != null ? Number(response.semana_corte) : null,
      temporadaAgroclima: response && response.anio_corte ? String(response.anio_corte) : null,
      estacionMeteoUuid: this.normalizarUuid(response && response.station_id_uuid),
      horasFrioAcumuladas: null,
      diasGradoAcumulados: null,
      agroclimaObservacion: this.obtenerObservacionStatus(status),
    };

    if (status === 'OK' || status === 'PARCIAL') {
      base.horasFrioAcumuladas = this.normalizarDecimal(response.horas_frio_acumuladas);
      base.diasGradoAcumulados = this.normalizarDecimal(response.grados_dia_acumulados);
    }

    return base;
  }

  obtenerObservacionStatus(status) {
    if (status === 'OK') {
      return OBSERVACIONES.OK;
    }

    if (status === 'PARCIAL') {
      return OBSERVACIONES.PARCIAL;
    }

    if (status === 'SIN_DATOS') {
      return OBSERVACIONES.SIN_DATOS;
    }

    return OBSERVACIONES.ERROR;
  }

  formatearFechaIso(value) {
    if (!value) {
      return null;
    }

    const date = value instanceof Date ? value : new Date(value);

    if (Number.isNaN(date.getTime())) {
      return String(value).slice(0, 10);
    }

    return date.toISOString().slice(0, 10);
  }

  normalizarUuid(value) {
    const uuid = String(value || '').trim();
    return uuid ? uuid.toLowerCase() : null;
  }

  normalizarDecimal(value) {
    if (value === null || value === undefined || value === '') {
      return null;
    }

    const number = Number(value);
    return Number.isFinite(number) ? number : null;
  }

  logDebug(evento, data) {
    if (
      process.env.METEO_FEAL_DEBUG !== 'true'
      && process.env.NODE_ENV !== 'development'
    ) {
      return;
    }

    console.info('[MONIPLA][AGROCLIMA]', {
      evento,
      ...data,
    });
  }
}

module.exports = AgroclimaMoniplaService;
