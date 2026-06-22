const { poolPromise, sql } = require('../config/db');

class MonitoreosRepository {
  async findFondosDisponibles() {
    const pool = await poolPromise;

    const result = await pool.request().query(`
      SELECT
        q.value,
        q.label
      FROM (
        SELECT DISTINCT
          f.Gen_Fundo AS value,
          LTRIM(RTRIM(f.Nombre)) AS label
        FROM dbo.GEN_CUARTEL gc
        INNER JOIN dbo.MONIPLA_REL_CUARTEL_SDP rel
          ON rel.gen_cuartel = gc.GEN_CUARTEL
         AND rel.activo = 1
        INNER JOIN dbo.GEN_FUNDO f
          ON f.Gen_Fundo = gc.GEN_FUNDO
        WHERE gc.estado = 1
          AND f.estado = 1
      ) q
      ORDER BY q.label ASC
    `);

    return result.recordset;
  }

  async findCamposByFundo(genFundo) {
    const pool = await poolPromise;

    const result = await pool
      .request()
      .input('genFundo', sql.Int, genFundo)
      .query(`
        SELECT
          q.value,
          q.label
        FROM (
          SELECT DISTINCT
            c.Gen_Campo AS value,
            LTRIM(RTRIM(c.Nombre)) AS label
          FROM dbo.GEN_CUARTEL gc
          INNER JOIN dbo.MONIPLA_REL_CUARTEL_SDP rel
            ON rel.gen_cuartel = gc.GEN_CUARTEL
           AND rel.activo = 1
          INNER JOIN dbo.GEN_CAMPO c
            ON c.Gen_Campo = gc.GEN_CAMPO
          WHERE gc.estado = 1
            AND c.estado = 1
            AND gc.GEN_FUNDO = @genFundo
        ) q
        ORDER BY q.label ASC
      `);

    return result.recordset;
  }

  async findVariedadesByFundoCampo(genFundo, genCampo) {
    const pool = await poolPromise;

    const result = await pool
      .request()
      .input('genFundo', sql.Int, genFundo)
      .input('genCampo', sql.Int, genCampo)
      .query(`
        SELECT
          q.value,
          q.label
        FROM (
          SELECT DISTINCT
            v.gen_variedad AS value,
            LTRIM(RTRIM(v.Nombre)) AS label
          FROM dbo.GEN_CUARTEL gc
          INNER JOIN dbo.MONIPLA_REL_CUARTEL_SDP rel
            ON rel.gen_cuartel = gc.GEN_CUARTEL
           AND rel.activo = 1
          INNER JOIN dbo.GEN_VARIEDAD v
            ON v.gen_variedad = gc.GEN_VARIEDAD
          WHERE gc.estado = 1
            AND v.Estado = 1
            AND gc.GEN_FUNDO = @genFundo
            AND gc.GEN_CAMPO = @genCampo
        ) q
        ORDER BY q.label ASC
      `);

    return result.recordset;
  }

  async findCuartelesByFiltros(genFundo, genCampo, genVariedad) {
    const pool = await poolPromise;

    const result = await pool
      .request()
      .input('genFundo', sql.Int, genFundo)
      .input('genCampo', sql.Int, genCampo)
      .input('genVariedad', sql.Int, genVariedad)
      .query(`
        SELECT
          q.value,
          q.codigo,
          q.label
        FROM (
          SELECT
            gc.GEN_CUARTEL AS value,
            LTRIM(RTRIM(gc.CODIGO)) AS codigo,
            CONCAT('Cuartel ', LTRIM(RTRIM(gc.CODIGO))) AS label,
            TRY_CONVERT(INT, gc.CODIGO) AS orden_numerico
          FROM dbo.GEN_CUARTEL gc
          INNER JOIN dbo.MONIPLA_REL_CUARTEL_SDP rel
            ON rel.gen_cuartel = gc.GEN_CUARTEL
           AND rel.activo = 1
          WHERE gc.estado = 1
            AND gc.GEN_FUNDO = @genFundo
            AND gc.GEN_CAMPO = @genCampo
            AND gc.GEN_VARIEDAD = @genVariedad
        ) q
        ORDER BY
          q.orden_numerico,
          q.codigo
      `);

    return result.recordset;
  }

  async findEstructurasActivas() {
    const pool = await poolPromise;

    const result = await pool.request().query(`
      SELECT
        id_estructura AS value,
        LTRIM(RTRIM(nombre_estructura)) AS label
      FROM dbo.MONIPLA_ESTRUCTURA
      WHERE activo = 1
      ORDER BY nombre_estructura ASC
    `);

    return result.recordset;
  }

  async findEstructuraById(idEstructura) {
    const pool = await poolPromise;

    const result = await pool
      .request()
      .input('idEstructura', sql.Int, idEstructura)
      .query(`
        SELECT TOP 1
          id_estructura,
          nombre_estructura,
          activo
        FROM dbo.MONIPLA_ESTRUCTURA
        WHERE id_estructura = @idEstructura
      `);

    return result.recordset[0] || null;
  }

  async findOrigenByGenCuartel(genCuartel) {
    const pool = await poolPromise;

    const result = await pool
      .request()
      .input('genCuartel', sql.Int, genCuartel)
      .query(`
        SELECT TOP 1
          gc.GEN_CUARTEL AS gen_cuartel,
          gc.GEN_FUNDO AS gen_fundo,
          gc.GEN_CAMPO AS gen_campo,
          gc.GEN_VARIEDAD AS gen_variedad,
          gc.GEN_VARIEDAD_CAMPO AS gen_variedad_campo,
          gc.CODIGO AS codigo_cuartel,
          rel.id_rel_cuartel_sdp,
          rel.trazabilidad,
          rel.sdp,
          rel.csg
        FROM dbo.GEN_CUARTEL gc
        INNER JOIN dbo.MONIPLA_REL_CUARTEL_SDP rel
          ON rel.gen_cuartel = gc.GEN_CUARTEL
         AND rel.activo = 1
        WHERE gc.estado = 1
          AND gc.GEN_CUARTEL = @genCuartel
      `);

    return result.recordset[0] || null;
  }

  async findResumenByGenCuartel(genCuartel) {
    const pool = await poolPromise;

    const result = await pool
      .request()
      .input('genCuartel', sql.Int, genCuartel)
      .query(`
        SELECT TOP 1
          gc.GEN_CUARTEL AS gen_cuartel,
          gc.GEN_FUNDO AS gen_fundo,
          gc.GEN_CAMPO AS gen_campo,
          gc.GEN_VARIEDAD AS gen_variedad,
          gc.GEN_VARIEDAD_CAMPO AS gen_variedad_campo,
          LTRIM(RTRIM(gc.CODIGO)) AS codigo_cuartel,
          LTRIM(RTRIM(f.Nombre)) AS nombre_fundo,
          LTRIM(RTRIM(c.Nombre)) AS nombre_campo,
          LTRIM(RTRIM(v.Nombre)) AS nombre_variedad,
          rel.id_rel_cuartel_sdp,
          rel.trazabilidad,
          rel.sdp,
          rel.csg
        FROM dbo.GEN_CUARTEL gc
        INNER JOIN dbo.MONIPLA_REL_CUARTEL_SDP rel
          ON rel.gen_cuartel = gc.GEN_CUARTEL
         AND rel.activo = 1
        INNER JOIN dbo.GEN_FUNDO f
          ON f.Gen_Fundo = gc.GEN_FUNDO
        INNER JOIN dbo.GEN_CAMPO c
          ON c.Gen_Campo = gc.GEN_CAMPO
        INNER JOIN dbo.GEN_VARIEDAD v
          ON v.gen_variedad = gc.GEN_VARIEDAD
        WHERE gc.estado = 1
          AND gc.GEN_CUARTEL = @genCuartel
      `);

    return result.recordset[0] || null;
  }
}

module.exports = MonitoreosRepository;
