const { poolPromise, sql } = require('../config/db');

class AgroclimaRepository {
  async listarMuestreosPendientesBackfill(idMuestreo = null, recalcular = false) {
    const request = await this.createRequest();

    const result = await request
      .input('idMuestreo', sql.Int, idMuestreo)
      .input('recalcular', sql.Bit, recalcular ? 1 : 0)
      .query(`
        SELECT
          m.id_muestreo,
          m.numero_muestreo,
          m.id_origen_muestra,
          CONVERT(char(10), m.fecha_recepcion_muestra, 23) AS fecha_recepcion_muestra,
          COALESCE(gf.Nombre, mb.fundo) AS nombre_fundo,
          m.horas_frio_acumuladas AS horas_frio_actuales,
          m.dias_grado_acumulados AS dias_grado_actuales,
          m.estacion_meteo_uuid AS estacion_uuid_actual,
          m.nombre_estacion_meteo AS nombre_estacion_actual,
          CONVERT(char(10), m.fecha_corte_agroclima, 23) AS fecha_corte_actual,
          m.semana_iso_corte AS semana_iso_actual,
          m.temporada_agroclima AS temporada_actual,
          m.agroclima_observacion AS observacion_actual
        FROM dbo.MONIPLA_MUESTREO m
        INNER JOIN dbo.MONIPLA_ORIGEN_MUESTRA om
          ON om.id_origen_muestra = m.id_origen_muestra
        LEFT JOIN dbo.GEN_VARIEDAD_CAMPO gvc
          ON gvc.Gen_Variedad_Campo = om.gen_variedad_campo
        LEFT JOIN dbo.GEN_FUNDO gf
          ON gf.Gen_Fundo = gvc.Gen_Fundo
        LEFT JOIN dbo.MONIPLA_CATALOGO_SDP_MB mb
          ON mb.id_catalogo_sdp = om.id_catalogo_sdp
        WHERE m.fecha_recepcion_muestra IS NOT NULL
          AND (@idMuestreo IS NULL OR m.id_muestreo = @idMuestreo)
          AND (
            @recalcular = 1
            OR (
              m.fecha_corte_agroclima IS NULL
              OR (
                m.horas_frio_acumuladas IS NULL
                AND m.dias_grado_acumulados IS NULL
                AND (
                  m.agroclima_observacion IS NULL
                  OR LTRIM(RTRIM(m.agroclima_observacion)) = ''
                  OR UPPER(m.agroclima_observacion) LIKE '%ERROR%'
                  OR UPPER(m.agroclima_observacion) LIKE '%SIN DATOS%'
                )
              )
            )
          )
        ORDER BY m.id_muestreo ASC
      `);

    return result.recordset;
  }

  async actualizarSnapshotSiPendienteBackfill(idMuestreo, snapshot, recalcular = false) {
    const request = await this.createRequest();

    const result = await request
      .input('idMuestreo', sql.Int, idMuestreo)
      .input('recalcular', sql.Bit, recalcular ? 1 : 0)
      .input('horasFrioAcumuladas', sql.Decimal(10, 2), snapshot.horasFrioAcumuladas ?? null)
      .input('diasGradoAcumulados', sql.Decimal(10, 2), snapshot.diasGradoAcumulados ?? null)
      .input('estacionMeteoUuid', sql.UniqueIdentifier, snapshot.estacionMeteoUuid || null)
      .input('nombreEstacionMeteo', sql.NVarChar(100), snapshot.nombreEstacionMeteo || null)
      .input('fechaCorteAgroclima', sql.Date, snapshot.fechaCorteAgroclima || null)
      .input('semanaIsoCorte', sql.TinyInt, snapshot.semanaIsoCorte ?? null)
      .input('temporadaAgroclima', sql.VarChar(9), snapshot.temporadaAgroclima || null)
      .input('agroclimaObservacion', sql.NVarChar(250), snapshot.agroclimaObservacion || null)
      .query(`
        UPDATE dbo.MONIPLA_MUESTREO
        SET
          horas_frio_acumuladas = @horasFrioAcumuladas,
          dias_grado_acumulados = @diasGradoAcumulados,
          estacion_meteo_uuid = @estacionMeteoUuid,
          nombre_estacion_meteo = @nombreEstacionMeteo,
          fecha_corte_agroclima = @fechaCorteAgroclima,
          semana_iso_corte = @semanaIsoCorte,
          temporada_agroclima = @temporadaAgroclima,
          agroclima_observacion = @agroclimaObservacion
        WHERE id_muestreo = @idMuestreo
          AND (
            @recalcular = 1
            OR (
              fecha_corte_agroclima IS NULL
              OR (
                horas_frio_acumuladas IS NULL
                AND dias_grado_acumulados IS NULL
                AND (
                  agroclima_observacion IS NULL
                  OR LTRIM(RTRIM(agroclima_observacion)) = ''
                  OR UPPER(agroclima_observacion) LIKE '%ERROR%'
                  OR UPPER(agroclima_observacion) LIKE '%SIN DATOS%'
                )
              )
            )
          )
      `);

    return result.rowsAffected[0] || 0;
  }

  async resolverEstacionesPorOrigen(idOrigenMuestra, fechaMuestra, transaction = null) {
    const request = await this.createRequest(transaction);

    const result = await request
      .input('idOrigenMuestra', sql.Int, idOrigenMuestra)
      .input('fechaMuestra', sql.Date, fechaMuestra)
      .query(`
        SELECT
          om.id_origen_muestra,
          COALESCE(gvc.Gen_Fundo, mb.gen_fundo) AS gen_fundo,
          COALESCE(gf.Nombre, mb.fundo) AS nombre_fundo,
          fem.station_id_uuid,
          fem.nombre_estacion,
          fem.prioridad
        FROM dbo.MONIPLA_ORIGEN_MUESTRA om
        LEFT JOIN dbo.GEN_VARIEDAD_CAMPO gvc
          ON gvc.Gen_Variedad_Campo = om.gen_variedad_campo
        LEFT JOIN dbo.GEN_FUNDO gf
          ON gf.Gen_Fundo = gvc.Gen_Fundo
        LEFT JOIN dbo.MONIPLA_CATALOGO_SDP_MB mb
          ON mb.id_catalogo_sdp = om.id_catalogo_sdp
        INNER JOIN dbo.MONIPLA_FUNDO_ESTACION_METEO fem
          ON fem.gen_fundo = COALESCE(gvc.Gen_Fundo, mb.gen_fundo)
         AND fem.activo = 1
         AND fem.fecha_desde <= @fechaMuestra
         AND (fem.fecha_hasta IS NULL OR fem.fecha_hasta >= @fechaMuestra)
        WHERE om.id_origen_muestra = @idOrigenMuestra
        ORDER BY
          fem.prioridad ASC,
          fem.fecha_desde DESC,
          fem.id_fundo_estacion_meteo DESC
      `);

    return result.recordset || [];
  }

  async resolverEstacionesPorFundo(genFundo, fechaMuestra, transaction = null) {
    const request = await this.createRequest(transaction);

    const result = await request
      .input('genFundo', sql.Int, genFundo)
      .input('fechaMuestra', sql.Date, fechaMuestra)
      .query(`
        SELECT
          fem.gen_fundo,
          fem.station_id_uuid,
          fem.nombre_estacion,
          fem.prioridad
        FROM dbo.MONIPLA_FUNDO_ESTACION_METEO fem
        WHERE fem.gen_fundo = @genFundo
          AND fem.activo = 1
          AND fem.fecha_desde <= @fechaMuestra
          AND (fem.fecha_hasta IS NULL OR fem.fecha_hasta >= @fechaMuestra)
        ORDER BY
          fem.prioridad ASC,
          fem.fecha_desde DESC,
          fem.id_fundo_estacion_meteo DESC
      `);

    return result.recordset || [];
  }

  async listarMonitoreosChanchitosAgroclima({ idMonitoreo = null, fechaDesde = null, fechaHasta = null, genFundo = null } = {}) {
    const request = await this.createRequest();

    const result = await request
      .input('idMonitoreo', sql.Int, idMonitoreo)
      .input('fechaDesde', sql.Date, fechaDesde)
      .input('fechaHasta', sql.Date, fechaHasta)
      .input('genFundo', sql.Int, genFundo)
      .query(`
        SELECT
          cab.id_monitoreo,
          cab.gen_fundo,
          CONVERT(char(10), cab.fecha_monitoreo, 23) AS fecha_monitoreo,
          cab.horas_frio_acumuladas AS horas_frio_actuales,
          cab.dias_grado_acumulados AS dias_grado_actuales,
          cab.estacion_meteo_uuid AS estacion_uuid_actual,
          cab.nombre_estacion_meteo AS nombre_estacion_actual,
          CONVERT(char(10), cab.fecha_corte_agroclima, 23) AS fecha_corte_actual,
          cab.semana_iso_corte AS semana_iso_actual,
          cab.temporada_agroclima AS temporada_actual,
          cab.agroclima_observacion AS observacion_actual
        FROM dbo.MONI_CABECERAMONITOREO cab
        WHERE cab.gen_fundo IS NOT NULL
          AND cab.fecha_monitoreo IS NOT NULL
          AND (@idMonitoreo IS NULL OR cab.id_monitoreo = @idMonitoreo)
          AND (@fechaDesde IS NULL OR cab.fecha_monitoreo >= @fechaDesde)
          AND (@fechaHasta IS NULL OR cab.fecha_monitoreo <= @fechaHasta)
          AND (@genFundo IS NULL OR cab.gen_fundo = @genFundo)
        ORDER BY cab.id_monitoreo ASC
      `);

    return result.recordset || [];
  }

  async listarMonitoreosChanchitosPendientesBackfill({
    ids = [],
    fechaDesde = null,
    fechaHasta = null,
    genFundo = null,
    limit = null,
  } = {}) {
    const request = await this.createRequest();
    const idsValidos = [...new Set((Array.isArray(ids) ? ids : [])
      .filter((id) => Number.isSafeInteger(id) && id > 0))];

    request
      .input('fechaDesde', sql.Date, fechaDesde)
      .input('fechaHasta', sql.Date, fechaHasta)
      .input('genFundo', sql.Int, genFundo)
      .input('limit', sql.Int, limit);

    const parametrosIds = idsValidos.map((id, index) => {
      const nombre = `id${index}`;
      request.input(nombre, sql.Int, id);
      return `@${nombre}`;
    });

    const filtroIds = parametrosIds.length > 0
      ? `AND cab.id_monitoreo IN (${parametrosIds.join(', ')})`
      : '';

    const result = await request.query(`
      SELECT TOP (ISNULL(@limit, 2147483647))
        cab.id_monitoreo,
        cab.gen_fundo,
        CONVERT(char(10), cab.fecha_monitoreo, 23) AS fecha_monitoreo,
        cab.horas_frio_acumuladas AS horas_frio_actuales,
        cab.dias_grado_acumulados AS dias_grado_actuales,
        cab.estacion_meteo_uuid AS estacion_uuid_actual,
        cab.nombre_estacion_meteo AS nombre_estacion_actual,
        CONVERT(char(10), cab.fecha_corte_agroclima, 23) AS fecha_corte_actual,
        cab.semana_iso_corte AS semana_iso_actual,
        cab.temporada_agroclima AS temporada_actual,
        cab.agroclima_observacion AS observacion_actual
      FROM dbo.MONI_CABECERAMONITOREO cab
      WHERE cab.id_monitoreo > 0
        AND cab.gen_fundo > 0
        AND cab.fecha_monitoreo IS NOT NULL
        AND cab.horas_frio_acumuladas IS NULL
        AND cab.dias_grado_acumulados IS NULL
        ${filtroIds}
        AND (@fechaDesde IS NULL OR cab.fecha_monitoreo >= @fechaDesde)
        AND (@fechaHasta IS NULL OR cab.fecha_monitoreo <= @fechaHasta)
        AND (@genFundo IS NULL OR cab.gen_fundo = @genFundo)
      ORDER BY cab.fecha_monitoreo ASC, cab.id_monitoreo ASC;
    `);

    return result.recordset || [];
  }

  async listarMonitoreosChanchitosPendientesReconciliacion({ fechaDesde, fechaHasta }) {
    const request = await this.createRequest();

    const result = await request
      .input('fechaDesde', sql.Date, fechaDesde)
      .input('fechaHasta', sql.Date, fechaHasta)
      .query(`
        SELECT
          cab.id_monitoreo,
          cab.gen_fundo,
          CONVERT(char(10), cab.fecha_monitoreo, 23) AS fecha_monitoreo,
          cab.horas_frio_acumuladas AS horas_frio_actuales,
          cab.dias_grado_acumulados AS dias_grado_actuales,
          cab.estacion_meteo_uuid AS estacion_uuid_actual,
          cab.nombre_estacion_meteo AS nombre_estacion_actual,
          CONVERT(char(10), cab.fecha_corte_agroclima, 23) AS fecha_corte_actual,
          cab.semana_iso_corte AS semana_iso_actual,
          cab.temporada_agroclima AS temporada_actual,
          cab.agroclima_observacion AS observacion_actual
        FROM dbo.MONI_CABECERAMONITOREO cab
        WHERE cab.gen_fundo IS NOT NULL
          AND cab.fecha_monitoreo IS NOT NULL
          AND cab.fecha_monitoreo >= @fechaDesde
          AND cab.fecha_monitoreo <= @fechaHasta
          AND EXISTS (
            SELECT 1
            FROM dbo.MONIPLA_FUNDO_ESTACION_METEO fem
            WHERE fem.gen_fundo = cab.gen_fundo
              AND fem.activo = 1
              AND fem.fecha_desde <= cab.fecha_monitoreo
              AND (fem.fecha_hasta IS NULL OR fem.fecha_hasta >= cab.fecha_monitoreo)
          )
          AND UPPER(ISNULL(cab.agroclima_observacion, '')) NOT LIKE '%SIN ESTACION%'
          AND (
            (
              (cab.horas_frio_acumuladas IS NOT NULL OR cab.dias_grado_acumulados IS NOT NULL)
              AND UPPER(ISNULL(cab.agroclima_observacion, '')) LIKE '%PARCIAL%'
            )
            OR (
              cab.horas_frio_acumuladas IS NULL
              AND cab.dias_grado_acumulados IS NULL
              AND (
                cab.agroclima_observacion IS NULL
                OR LTRIM(RTRIM(cab.agroclima_observacion)) = ''
                OR UPPER(cab.agroclima_observacion) LIKE '%SIN DATOS%'
                OR UPPER(cab.agroclima_observacion) LIKE '%ERROR%'
              )
            )
          )
        ORDER BY cab.fecha_monitoreo ASC, cab.id_monitoreo ASC
      `);

    return result.recordset || [];
  }

  async actualizarSnapshotChanchitosSiCoincide(idMonitoreo, snapshot, actual) {
    const request = await this.createRequest();

    const result = await request
      .input('idMonitoreo', sql.Int, idMonitoreo)
      .input('horasFrioAcumuladas', sql.Decimal(10, 2), snapshot.horasFrioAcumuladas ?? null)
      .input('diasGradoAcumulados', sql.Decimal(10, 2), snapshot.diasGradoAcumulados ?? null)
      .input('estacionMeteoUuid', sql.UniqueIdentifier, snapshot.estacionMeteoUuid || null)
      .input('nombreEstacionMeteo', sql.NVarChar(100), snapshot.nombreEstacionMeteo || null)
      .input('fechaCorteAgroclima', sql.Date, snapshot.fechaCorteAgroclima || null)
      .input('semanaIsoCorte', sql.TinyInt, snapshot.semanaIsoCorte ?? null)
      .input('temporadaAgroclima', sql.VarChar(9), snapshot.temporadaAgroclima || null)
      .input('agroclimaObservacion', sql.NVarChar(250), snapshot.agroclimaObservacion || null)
      .input('horasFrioActuales', sql.Decimal(10, 2), actual.horasFrioAcumuladas ?? null)
      .input('diasGradoActuales', sql.Decimal(10, 2), actual.diasGradoAcumulados ?? null)
      .input('estacionMeteoUuidActual', sql.UniqueIdentifier, actual.estacionMeteoUuid || null)
      .input('nombreEstacionMeteoActual', sql.NVarChar(100), actual.nombreEstacionMeteo || null)
      .input('fechaCorteAgroclimaActual', sql.Date, actual.fechaCorteAgroclima || null)
      .input('semanaIsoCorteActual', sql.TinyInt, actual.semanaIsoCorte ?? null)
      .input('temporadaAgroclimaActual', sql.VarChar(9), actual.temporadaAgroclima || null)
      .input('agroclimaObservacionActual', sql.NVarChar(250), actual.agroclimaObservacion || null)
      .query(`
        UPDATE dbo.MONI_CABECERAMONITOREO
        SET
          horas_frio_acumuladas = @horasFrioAcumuladas,
          dias_grado_acumulados = @diasGradoAcumulados,
          estacion_meteo_uuid = @estacionMeteoUuid,
          nombre_estacion_meteo = @nombreEstacionMeteo,
          fecha_corte_agroclima = @fechaCorteAgroclima,
          semana_iso_corte = @semanaIsoCorte,
          temporada_agroclima = @temporadaAgroclima,
          agroclima_observacion = @agroclimaObservacion
        WHERE id_monitoreo = @idMonitoreo
          AND (horas_frio_acumuladas = @horasFrioActuales OR (horas_frio_acumuladas IS NULL AND @horasFrioActuales IS NULL))
          AND (dias_grado_acumulados = @diasGradoActuales OR (dias_grado_acumulados IS NULL AND @diasGradoActuales IS NULL))
          AND (estacion_meteo_uuid = @estacionMeteoUuidActual OR (estacion_meteo_uuid IS NULL AND @estacionMeteoUuidActual IS NULL))
          AND (nombre_estacion_meteo = @nombreEstacionMeteoActual OR (nombre_estacion_meteo IS NULL AND @nombreEstacionMeteoActual IS NULL))
          AND (fecha_corte_agroclima = @fechaCorteAgroclimaActual OR (fecha_corte_agroclima IS NULL AND @fechaCorteAgroclimaActual IS NULL))
          AND (semana_iso_corte = @semanaIsoCorteActual OR (semana_iso_corte IS NULL AND @semanaIsoCorteActual IS NULL))
          AND (temporada_agroclima = @temporadaAgroclimaActual OR (temporada_agroclima IS NULL AND @temporadaAgroclimaActual IS NULL))
          AND (agroclima_observacion = @agroclimaObservacionActual OR (agroclima_observacion IS NULL AND @agroclimaObservacionActual IS NULL))
      `);

    return result.rowsAffected[0] || 0;
  }

  async actualizarSnapshotChanchitosPendiente(idMonitoreo, fechaMonitoreo, snapshot) {
    const request = await this.createRequest();

    const result = await request
      .input('idMonitoreo', sql.Int, idMonitoreo)
      .input('fechaMonitoreo', sql.Date, fechaMonitoreo)
      .input('horasFrioAcumuladas', sql.Decimal(10, 2), snapshot.horasFrioAcumuladas ?? null)
      .input('diasGradoAcumulados', sql.Decimal(10, 2), snapshot.diasGradoAcumulados ?? null)
      .input('estacionMeteoUuid', sql.UniqueIdentifier, snapshot.estacionMeteoUuid || null)
      .input('nombreEstacionMeteo', sql.NVarChar(100), snapshot.nombreEstacionMeteo || null)
      .input('fechaCorteAgroclima', sql.Date, snapshot.fechaCorteAgroclima || null)
      .input('semanaIsoCorte', sql.TinyInt, snapshot.semanaIsoCorte ?? null)
      .input('temporadaAgroclima', sql.VarChar(9), snapshot.temporadaAgroclima || null)
      .input('agroclimaObservacion', sql.NVarChar(250), snapshot.agroclimaObservacion || null)
      .query(`
        UPDATE dbo.MONI_CABECERAMONITOREO
        SET
          horas_frio_acumuladas = @horasFrioAcumuladas,
          dias_grado_acumulados = @diasGradoAcumulados,
          estacion_meteo_uuid = @estacionMeteoUuid,
          nombre_estacion_meteo = @nombreEstacionMeteo,
          fecha_corte_agroclima = @fechaCorteAgroclima,
          semana_iso_corte = @semanaIsoCorte,
          temporada_agroclima = @temporadaAgroclima,
          agroclima_observacion = @agroclimaObservacion
        WHERE id_monitoreo = @idMonitoreo
          AND fecha_monitoreo = @fechaMonitoreo
          AND horas_frio_acumuladas IS NULL
          AND dias_grado_acumulados IS NULL;
      `);

    return result.rowsAffected[0] || 0;
  }

  async createRequest(transaction = null) {
    if (transaction) {
      return new sql.Request(transaction);
    }

    const pool = await poolPromise;
    return pool.request();
  }
}

module.exports = AgroclimaRepository;
