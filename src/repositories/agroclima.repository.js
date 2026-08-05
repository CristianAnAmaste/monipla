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

  async createRequest(transaction = null) {
    if (transaction) {
      return new sql.Request(transaction);
    }

    const pool = await poolPromise;
    return pool.request();
  }
}

module.exports = AgroclimaRepository;
