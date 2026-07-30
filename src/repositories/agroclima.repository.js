const { poolPromise, sql } = require('../config/db');

class AgroclimaRepository {
  async resolverEstacionPorOrigen(idOrigenMuestra, fechaMuestra, transaction = null) {
    const request = await this.createRequest(transaction);

    const result = await request
      .input('idOrigenMuestra', sql.Int, idOrigenMuestra)
      .input('fechaMuestra', sql.Date, fechaMuestra)
      .query(`
        SELECT TOP 1
          om.id_origen_muestra,
          COALESCE(gvc.Gen_Fundo, mb.gen_fundo) AS gen_fundo,
          COALESCE(gf.Nombre, mb.fundo) AS nombre_fundo,
          fem.station_id_uuid,
          fem.nombre_estacion
        FROM dbo.MONIPLA_ORIGEN_MUESTRA om
        LEFT JOIN dbo.GEN_VARIEDAD_CAMPO gvc
          ON gvc.Gen_Variedad_Campo = om.gen_variedad_campo
        LEFT JOIN dbo.GEN_FUNDO gf
          ON gf.Gen_Fundo = gvc.Gen_Fundo
        LEFT JOIN dbo.MONIPLA_CATALOGO_SDP_MB mb
          ON mb.id_catalogo_sdp = om.id_catalogo_sdp
        LEFT JOIN dbo.MONIPLA_FUNDO_ESTACION_METEO fem
          ON fem.gen_fundo = COALESCE(gvc.Gen_Fundo, mb.gen_fundo)
         AND fem.activo = 1
         AND fem.fecha_desde <= @fechaMuestra
         AND (fem.fecha_hasta IS NULL OR fem.fecha_hasta >= @fechaMuestra)
        WHERE om.id_origen_muestra = @idOrigenMuestra
        ORDER BY fem.fecha_desde DESC, fem.id_fundo_estacion_meteo DESC
      `);

    return result.recordset[0] || null;
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
