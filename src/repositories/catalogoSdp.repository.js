class CatalogoSdpRepository {
  constructor(database = null) {
    const db = database || require('../config/db');
    this.poolPromise = db.poolPromise;
    this.sql = db.sql;
  }

  async findFondosDisponibles() {
    const pool = await this.poolPromise;

    const result = await pool.request().query(`
      SELECT
        gen_fundo AS value,
        fundo AS label
      FROM dbo.MONIPLA_CATALOGO_SDP_MB
      WHERE activo = 1
        AND sdp IS NOT NULL
      GROUP BY gen_fundo, fundo
      ORDER BY fundo ASC
    `);

    return result.recordset;
  }

  async findCamposByFundo(genFundo) {
    const pool = await this.poolPromise;

    const result = await pool
      .request()
      .input('genFundo', this.sql.Int, genFundo)
      .query(`
        SELECT
          gen_campo AS value,
          nombre_productor AS label
        FROM dbo.MONIPLA_CATALOGO_SDP_MB
        WHERE activo = 1
          AND sdp IS NOT NULL
          AND gen_fundo = @genFundo
        GROUP BY gen_campo, nombre_productor
        ORDER BY nombre_productor ASC
      `);

    return result.recordset;
  }

  async findVariedadesByFundoCampo(genFundo, genCampo) {
    const pool = await this.poolPromise;

    const result = await pool
      .request()
      .input('genFundo', this.sql.Int, genFundo)
      .input('genCampo', this.sql.Int, genCampo)
      .query(`
        SELECT
          gen_variedad AS value,
          variedad AS label
        FROM dbo.MONIPLA_CATALOGO_SDP_MB
        WHERE activo = 1
          AND sdp IS NOT NULL
          AND gen_fundo = @genFundo
          AND gen_campo = @genCampo
        GROUP BY gen_variedad, variedad
        ORDER BY variedad ASC
      `);

    return result.recordset;
  }

  async findCuartelesByFiltros(genFundo, genCampo, genVariedad) {
    const pool = await this.poolPromise;

    const result = await pool
      .request()
      .input('genFundo', this.sql.Int, genFundo)
      .input('genCampo', this.sql.Int, genCampo)
      .input('genVariedad', this.sql.Int, genVariedad)
      .query(`
        SELECT
          id_catalogo_sdp AS value,
          cuartel AS label
        FROM dbo.MONIPLA_CATALOGO_SDP_MB
        WHERE activo = 1
          AND sdp IS NOT NULL
          AND gen_fundo = @genFundo
          AND gen_campo = @genCampo
          AND gen_variedad = @genVariedad
        ORDER BY
          CASE WHEN TRY_CONVERT(INT, cuartel) IS NULL THEN 1 ELSE 0 END,
          TRY_CONVERT(INT, cuartel),
          cuartel
      `);

    return result.recordset;
  }

  async findByIdActivoConSdp(idCatalogoSdp, transaction = null) {
    const request = await this.createRequest(transaction);

    const result = await request
      .input('idCatalogoSdp', this.sql.Int, idCatalogoSdp)
      .query(`
        SELECT
          id_catalogo_sdp,
          gen_fundo,
          fundo,
          gen_campo,
          codigo_productor,
          nombre_productor,
          gen_variedad,
          variedad,
          cuartel,
          sdp,
          activo,
          codigo_sag,
          codigo_trazabilidad
        FROM dbo.MONIPLA_CATALOGO_SDP_MB
        WHERE id_catalogo_sdp = @idCatalogoSdp
          AND activo = 1
          AND sdp IS NOT NULL
      `);

    return result.recordset;
  }

  async createRequest(transaction = null) {
    if (transaction) {
      return new this.sql.Request(transaction);
    }

    const pool = await this.poolPromise;
    return pool.request();
  }
}

module.exports = CatalogoSdpRepository;
