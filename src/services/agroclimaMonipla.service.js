const MeteoFealClient = require('./meteoFealClient');

const OBSERVACIONES = {
  SIN_ESTACION: 'Sin estacion meteorologica asociada al fundo.',
  OK: 'Agroclima OK desde Meteo FEAL.',
  PARCIAL: 'Agroclima parcial: existen dias sin datos en el periodo.',
  SIN_DATOS: 'Sin datos agroclimaticos para la fecha de corte.',
  SIN_DATOS_ESTACIONES: 'Sin datos agroclimaticos en las estaciones configuradas.',
  NO_APLICA: 'No corresponde calcular horas frio ni grados dia para la fecha de corte.',
  ERROR: 'Error al consultar Meteo FEAL.',
};

class AgroclimaMoniplaService {
  constructor(
    agroclimaRepository = null,
    meteoFealClient = new MeteoFealClient()
  ) {
    this.agroclimaRepository = agroclimaRepository
      || new (require('../repositories/agroclima.repository'))();
    this.meteoFealClient = meteoFealClient;
  }

  async calcularSnapshotSeguro(
    idOrigenMuestra,
    fechaRecepcionMuestra,
    transaction = null,
    estacionesConfiguradas = null
  ) {
    try {
      return await this.calcularSnapshot(
        idOrigenMuestra,
        fechaRecepcionMuestra,
        transaction,
        estacionesConfiguradas
      );
    } catch (error) {
      console.error('[MONIPLA][AGROCLIMA][ERROR]', {
        idOrigenMuestra,
        fechaRecepcionMuestra,
        error: error.message,
      });

      return this.crearSnapshotBase(null, OBSERVACIONES.ERROR);
    }
  }

  async calcularSnapshot(
    idOrigenMuestra,
    fechaRecepcionMuestra,
    transaction = null,
    estacionesConfiguradas = null
  ) {
    const fechaMuestra = this.formatearFechaIso(fechaRecepcionMuestra);
    const snapshot = this.crearSnapshotBase(null, null);

    const estaciones = estacionesConfiguradas || await this.resolverEstacionesConfiguradas(
      idOrigenMuestra,
      fechaMuestra,
      transaction
    );

    const estacionesValidas = estaciones.filter((estacion) => estacion && estacion.station_id_uuid);

    if (estacionesValidas.length === 0) {
      return {
        ...snapshot,
        agroclimaObservacion: OBSERVACIONES.SIN_ESTACION,
      };
    }

    const estacionPrincipal = estacionesValidas[0];
    const snapshotPrincipal = {
      ...snapshot,
      estacionMeteoUuid: this.normalizarUuid(estacionPrincipal.station_id_uuid),
      nombreEstacionMeteo: estacionPrincipal.nombre_estacion || null,
    };
    const intentos = [];
    let mejorParcial = null;

    for (const estacion of estacionesValidas) {
      const stationIdUuid = this.normalizarUuid(estacion.station_id_uuid);
      let response;

      try {
        response = await this.meteoFealClient.obtenerAcumuladoAgroclimatico({
          stationIdUuid,
          fechaMuestra,
        });
      } catch (error) {
        intentos.push({ estacion, motivo: 'ERROR' });

        console.error('[MONIPLA][AGROCLIMA][METEO_FEAL_ERROR]', {
          idOrigenMuestra,
          stationIdUuid,
          prioridad: estacion.prioridad,
          fechaMuestra,
          error: error.message,
        });

        if (!this.debeIntentarSiguienteTrasError(error)) {
          break;
        }

        continue;
      }

      const evaluacion = this.evaluarRespuestaMeteoFeal(response, {
        stationIdUuid,
        fechaMuestra,
      });
      const snapshotRespuesta = this.crearSnapshotDesdeRespuesta(response, estacion);

      if (evaluacion.concluyenteSinIndicador) {
        return snapshotRespuesta;
      }

      if (!evaluacion.utilizable) {
        intentos.push({ estacion, motivo: evaluacion.motivo });

        console.warn('[MONIPLA][AGROCLIMA][ESTACION_NO_UTILIZABLE]', {
          idOrigenMuestra,
          stationIdUuid,
          prioridad: estacion.prioridad,
          fechaMuestra,
          calculationStatus: response && response.calculation_status,
          diasConDatos: response && response.dias_con_datos,
          diasSinDatos: response && response.dias_sin_datos,
          motivo: evaluacion.motivo,
        });

        continue;
      }

      const candidato = {
        estacion,
        evaluacion,
        response,
        snapshot: snapshotRespuesta,
      };

      if (evaluacion.cobertura === 'PARCIAL') {
        intentos.push({
          estacion,
          motivo: 'PARCIAL',
          diasConDatos: evaluacion.diasConDatos,
          diasSinDatos: evaluacion.diasSinDatos,
        });

        if (this.esMejorParcial(candidato, mejorParcial)) {
          mejorParcial = candidato;
        }

        continue;
      }

      const snapshotFinal = this.crearSnapshotSeleccionado(
        candidato,
        estacionPrincipal,
        intentos
      );

      this.logDebug('SNAPSHOT', {
        idOrigenMuestra,
        station_id_uuid: snapshotFinal.estacionMeteoUuid,
        prioridad: estacion.prioridad,
        fecha_muestra: fechaMuestra,
        response,
        snapshot: snapshotFinal,
      });

      return snapshotFinal;
    }

    if (mejorParcial) {
      const snapshotFinal = this.crearSnapshotSeleccionado(
        mejorParcial,
        estacionPrincipal,
        intentos
      );

      this.logDebug('SNAPSHOT', {
        idOrigenMuestra,
        station_id_uuid: snapshotFinal.estacionMeteoUuid,
        prioridad: mejorParcial.estacion.prioridad,
        fecha_muestra: fechaMuestra,
        response: mejorParcial.response,
        snapshot: snapshotFinal,
      });

      return snapshotFinal;
    }

    return {
      ...snapshotPrincipal,
      agroclimaObservacion: intentos.some((intento) => intento.motivo !== 'ERROR')
        ? this.crearObservacionSinDatos(estacionesValidas)
        : OBSERVACIONES.ERROR,
    };
  }

  crearSnapshotDesdeRespuesta(response, estacion) {
    const mapped = this.mapearRespuestaMeteoFeal(response);

    return {
      ...this.crearSnapshotBase(null, null),
      ...mapped,
      estacionMeteoUuid: mapped.estacionMeteoUuid
        || this.normalizarUuid(estacion.station_id_uuid),
      nombreEstacionMeteo: estacion.nombre_estacion || null,
    };
  }

  async resolverEstacionesConfiguradas(idOrigenMuestra, fechaMuestra, transaction = null) {
    return this.agroclimaRepository.resolverEstacionesPorOrigen(
      idOrigenMuestra,
      fechaMuestra,
      transaction
    );
  }

  crearSnapshotSeleccionado(candidato, estacionPrincipal, intentos) {
    const { estacion, evaluacion, snapshot } = candidato;
    let observacion = snapshot.agroclimaObservacion;

    if (estacion !== estacionPrincipal) {
      observacion = this.crearObservacionRespaldo(
        estacionPrincipal,
        estacion,
        evaluacion,
        intentos
      );
    } else if (evaluacion.cobertura === 'PARCIAL') {
      observacion = this.crearObservacionParcialSeleccionada(estacion, evaluacion);
    }

    return {
      ...snapshot,
      agroclimaObservacion: observacion,
    };
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
    const status = String(response && response.calculation_status || '').trim().toUpperCase();
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

  evaluarRespuestaMeteoFeal(response, { stationIdUuid, fechaMuestra }) {
    const status = String(response && response.calculation_status || '').trim().toUpperCase();

    if (status === 'NO_APLICA') {
      return {
        utilizable: false,
        concluyenteSinIndicador: true,
        motivo: 'NO_APLICA',
      };
    }

    if (status !== 'OK' && status !== 'PARCIAL') {
      return {
        utilizable: false,
        concluyenteSinIndicador: false,
        motivo: status || 'STATUS_INVALIDO',
      };
    }

    const responseStationId = this.normalizarUuid(response && response.station_id_uuid);

    if (!responseStationId || responseStationId !== this.normalizarUuid(stationIdUuid)) {
      return {
        utilizable: false,
        concluyenteSinIndicador: false,
        motivo: 'ESTACION_NO_COINCIDE',
      };
    }

    const fechaCorte = this.formatearFechaIso(response && response.fecha_corte);
    const fechaCorteEsperada = this.calcularFechaCorteEsperada(fechaMuestra);

    if (!fechaCorte || !fechaCorteEsperada || fechaCorte !== fechaCorteEsperada) {
      return {
        utilizable: false,
        concluyenteSinIndicador: false,
        motivo: 'FECHA_CORTE_INVALIDA',
      };
    }

    const diasConDatos = Number(response && response.dias_con_datos);

    if (!Number.isFinite(diasConDatos) || diasConDatos <= 0) {
      return {
        utilizable: false,
        concluyenteSinIndicador: false,
        motivo: 'SIN_DIAS_CON_DATOS',
      };
    }

    const indicadorActivo = String(response && response.indicador_activo || '').trim().toUpperCase();
    const horasFrio = this.normalizarDecimal(response && response.horas_frio_acumuladas);
    const gradosDia = this.normalizarDecimal(response && response.grados_dia_acumulados);
    const tieneMetricaActiva = indicadorActivo === 'HORAS_FRIO'
      ? horasFrio !== null
      : indicadorActivo === 'GRADOS_DIA'
        ? gradosDia !== null
        : horasFrio !== null || gradosDia !== null;

    const diasSinDatosValue = Number(response && response.dias_sin_datos);
    const diasSinDatos = Number.isFinite(diasSinDatosValue) && diasSinDatosValue >= 0
      ? diasSinDatosValue
      : null;
    const coberturaDetallada = this.obtenerCoberturaDetallada(response);
    const cobertura = status === 'OK' && (diasSinDatos === null || diasSinDatos === 0)
      ? 'COMPLETA'
      : 'PARCIAL';

    return {
      utilizable: tieneMetricaActiva,
      concluyenteSinIndicador: false,
      motivo: tieneMetricaActiva ? 'OK' : 'METRICA_ACTIVA_SIN_DATOS',
      cobertura,
      diasConDatos,
      diasSinDatos,
      ...coberturaDetallada,
    };
  }

  esMejorParcial(candidato, actual) {
    if (!actual) {
      return true;
    }

    if (candidato.evaluacion.diasConDatos !== actual.evaluacion.diasConDatos) {
      return candidato.evaluacion.diasConDatos > actual.evaluacion.diasConDatos;
    }

    const diasSinDatosCandidato = candidato.evaluacion.diasSinDatos ?? Number.MAX_SAFE_INTEGER;
    const diasSinDatosActual = actual.evaluacion.diasSinDatos ?? Number.MAX_SAFE_INTEGER;

    return diasSinDatosCandidato < diasSinDatosActual;
  }

  calcularFechaCorteEsperada(fechaMuestra) {
    if (!fechaMuestra) {
      return null;
    }

    const date = new Date(`${fechaMuestra}T00:00:00Z`);

    if (Number.isNaN(date.getTime())) {
      return null;
    }

    date.setUTCDate(date.getUTCDate() - 1);
    return date.toISOString().slice(0, 10);
  }

  debeIntentarSiguienteTrasError(error) {
    if (!error) {
      return false;
    }

    if (error.code === 'METEO_FEAL_TIMEOUT') {
      return true;
    }

    return error.code === 'METEO_FEAL_HTTP_ERROR'
      && Number(error.status) >= 500;
  }

  crearObservacionRespaldo(estacionPrincipal, estacionUtilizada, evaluacion, intentos) {
    const principal = String(estacionPrincipal.nombre_estacion || 'sin nombre').trim();
    const utilizada = String(estacionUtilizada.nombre_estacion || 'sin nombre').trim();
    const intentoPrincipal = intentos.find((intento) => intento.estacion === estacionPrincipal);
    const cobertura = evaluacion.cobertura === 'COMPLETA'
      ? 'Cobertura completa.'
      : `Cobertura parcial: ${this.formatearCobertura(evaluacion)}.`;
    const motivo = intentoPrincipal && intentoPrincipal.motivo === 'PARCIAL'
      ? 'la estacion primaria tenia cobertura parcial'
      : intentoPrincipal && intentoPrincipal.motivo === 'ERROR'
        ? 'error en estaciones anteriores'
        : 'estaciones anteriores sin datos utilizables';
    const texto = `Estacion de respaldo utilizada. Primaria: ${principal}. Utilizada: ${utilizada}. ${cobertura} Motivo: ${motivo}.`;

    return texto.trim().slice(0, 250);
  }

  crearObservacionParcialSeleccionada(estacion, evaluacion) {
    const nombre = String(estacion.nombre_estacion || 'sin nombre').trim();
    const texto = `Agroclima parcial. Estacion utilizada: ${nombre}. Cobertura: ${this.formatearCobertura(evaluacion)}. No se encontro una estacion con cobertura completa.`;

    return texto.slice(0, 250);
  }

  formatearCobertura(evaluacion) {
    const tieneCoberturaDetallada = evaluacion.diasCoberturaCompleta !== null
      || evaluacion.diasCoberturaParcialIncluida !== null
      || evaluacion.diasSinTemperatura !== null;

    if (tieneCoberturaDetallada) {
      const partes = [];

      if (evaluacion.diasCoberturaCompleta !== null) {
        partes.push(`${evaluacion.diasCoberturaCompleta} dias con cobertura completa`);
      }

      if (evaluacion.diasCoberturaParcialIncluida !== null) {
        partes.push(`${evaluacion.diasCoberturaParcialIncluida} dias con cobertura parcial incluidos`);
      }

      if (evaluacion.diasSinTemperatura !== null) {
        partes.push(`${evaluacion.diasSinTemperatura} dias sin temperatura no incluidos`);
      }

      return partes.join(', ');
    }

    const diasConDatos = `${evaluacion.diasConDatos} dias con datos`;

    if (evaluacion.diasSinDatos === null) {
      return diasConDatos;
    }

    return `${diasConDatos} y ${evaluacion.diasSinDatos} sin datos`;
  }

  obtenerCoberturaDetallada(response) {
    return {
      diasCoberturaCompleta: this.obtenerContadorRespuesta(response, [
        'dias_completos',
        'dias_cobertura_completa',
        'dias_con_cobertura_completa',
      ]),
      diasCoberturaParcialIncluida: this.obtenerContadorRespuesta(response, [
        'dias_parciales_aprovechados',
        'dias_parciales_incluidos',
        'dias_con_cobertura_parcial',
      ]),
      diasSinTemperatura: this.obtenerContadorRespuesta(response, [
        'dias_sin_temperatura',
        'dias_sin_datos_no_incluidos',
      ]),
    };
  }

  obtenerContadorRespuesta(response, campos) {
    for (const campo of campos) {
      const value = Number(response && response[campo]);

      if (Number.isFinite(value) && value >= 0) {
        return value;
      }
    }

    return null;
  }

  crearObservacionSinDatos(estaciones) {
    const nombres = estaciones
      .map((estacion) => String(estacion.nombre_estacion || '').trim())
      .filter(Boolean)
      .join(', ');
    const texto = nombres
      ? `${OBSERVACIONES.SIN_DATOS_ESTACIONES} Revisadas: ${nombres}.`
      : OBSERVACIONES.SIN_DATOS_ESTACIONES;

    return texto.slice(0, 250);
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

    if (status === 'NO_APLICA') {
      return OBSERVACIONES.NO_APLICA;
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
