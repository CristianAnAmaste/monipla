class ChanchitosRepository {
  constructor(database = null) {
    const db = database || require('../config/db');
    this.poolPromise = db.poolPromise;
    this.sql = db.sql;
  }

  async listarEstadosFenologicosActivos() {
    const pool = await this.poolPromise;
    const result = await pool.request().query(`
      SELECT
        id_estadofenologico AS value,
        LTRIM(RTRIM(nom_estadofenologico)) AS label
      FROM dbo.estado_fenologico
      WHERE estado = 1
      ORDER BY nom_estadofenologico ASC
    `);

    return result.recordset;
  }

  async listarMonitoreadoresActivos() {
    const pool = await this.poolPromise;
    const result = await pool.request().query(`
      SELECT
        id_monitoreador,
        nombre_monitoreador
      FROM dbo.MONI_MONITOREADORES
      WHERE activo = 1
      ORDER BY nombre_monitoreador;
    `);

    return result.recordset;
  }

  async findMonitoreadorById(idMonitoreador, transaction = null) {
    const request = await this.createRequest(transaction);
    const result = await request
      .input('idMonitoreador', this.sql.Int, idMonitoreador)
      .query(`
        SELECT
          id_monitoreador,
          activo
        FROM dbo.MONI_MONITOREADORES
        WHERE id_monitoreador = @idMonitoreador
      `);

    return result.recordset;
  }

  async findEstadoFenologicoById(idEstadoFenologico, transaction = null) {
    const request = await this.createRequest(transaction);
    const result = await request
      .input('idEstadoFenologico', this.sql.Int, idEstadoFenologico)
      .query(`
        SELECT
          id_estadofenologico,
          estado
        FROM dbo.estado_fenologico
        WHERE id_estadofenologico = @idEstadoFenologico
      `);

    return result.recordset;
  }

  async obtenerMonitoreosPdfGeneral(filtros = {}) {
    return this.ejecutarConsultaPdfFiltrada(filtros);
  }

  async ejecutarConsultaPdfFiltrada(filtros) {
    const pool = await this.poolPromise;
    const result = await this.crearRequestHistorial(pool, filtros).query(`
        SET NOCOUNT ON;
        CREATE TABLE #ChanchitosFiltrados (id_monitoreo INT NOT NULL PRIMARY KEY);
        DECLARE @CatalogoFundo INT = NULL, @CatalogoCampo INT = NULL, @CatalogoVariedad INT = NULL, @CatalogoCuartel nvarchar(100) = NULL;
        SELECT TOP (1)
          @CatalogoFundo = gen_fundo,
          @CatalogoCampo = gen_campo,
          @CatalogoVariedad = gen_variedad,
          @CatalogoCuartel = CONVERT(nvarchar(100), cuartel)
        FROM dbo.MONIPLA_CATALOGO_SDP_MB
        WHERE id_catalogo_sdp = @idCatalogoSdp;

        INSERT INTO #ChanchitosFiltrados (id_monitoreo)
        SELECT cab.id_monitoreo
        FROM dbo.MONI_CABECERAMONITOREO cab
        WHERE ${this.obtenerPredicadoIdsChanchitos({ ...filtros, deteccion: '' })}
        OPTION (RECOMPILE);

        ${filtros.deteccion === 'CON_DETECCION' ? `
        CREATE TABLE #ChanchitosConDeteccion (id_monitoreo INT NOT NULL PRIMARY KEY);
        INSERT INTO #ChanchitosConDeteccion (id_monitoreo)
        SELECT det.id_monitoreo
        FROM dbo.MONI_DETALLEMONITOREO det
        INNER JOIN #ChanchitosFiltrados seleccion ON seleccion.id_monitoreo = det.id_monitoreo
        WHERE det.cantidad_bichos > 0
        GROUP BY det.id_monitoreo
        OPTION (RECOMPILE);
        DELETE seleccion
        FROM #ChanchitosFiltrados seleccion
        LEFT JOIN #ChanchitosConDeteccion conDeteccion ON conDeteccion.id_monitoreo = seleccion.id_monitoreo
        WHERE conDeteccion.id_monitoreo IS NULL;` : filtros.deteccion === 'SIN_DETECCION' ? `
        DELETE seleccion
        FROM #ChanchitosFiltrados seleccion
        WHERE EXISTS (
          SELECT 1 FROM dbo.MONI_DETALLEMONITOREO det
          WHERE det.id_monitoreo = seleccion.id_monitoreo AND det.cantidad_bichos > 0
        );` : ''}

        CREATE TABLE #CabecerasPdf (
          id_monitoreo INT NOT NULL PRIMARY KEY, id_catalogo_sdp INT NULL,
          gen_fundo INT NULL, gen_campo INT NULL, gen_variedad INT NULL, gen_cuartel INT NULL,
          codigo_cuartel NVARCHAR(100) NULL, fecha_monitoreo DATE NULL, cant_plantas INT NULL,
          observaciones NVARCHAR(1000) NULL, sdp NVARCHAR(100) NULL, csg NVARCHAR(100) NULL,
          id_monitoreador INT NULL, id_estadofenologico INT NULL,
          horas_frio_acumuladas DECIMAL(10,2) NULL, dias_grado_acumulados DECIMAL(10,2) NULL,
          nombre_estacion_meteo NVARCHAR(100) NULL, fecha_corte_agroclima DATE NULL
        );
        INSERT INTO #CabecerasPdf
        SELECT cab.id_monitoreo, cab.id_catalogo_sdp, cab.gen_fundo, cab.gen_campo, cab.gen_variedad, cab.gen_cuartel,
          CONVERT(nvarchar(100), cab.codigo_cuartel), cab.fecha_monitoreo, cab.cant_plantas, cab.observaciones,
          CONVERT(nvarchar(100), cab.sdp), CONVERT(nvarchar(100), cab.CSG), cab.id_monitoreador, cab.id_estadofenologico,
          cab.horas_frio_acumuladas, cab.dias_grado_acumulados, cab.nombre_estacion_meteo, cab.fecha_corte_agroclima
        FROM dbo.MONI_CABECERAMONITOREO cab
        INNER JOIN #ChanchitosFiltrados seleccion ON seleccion.id_monitoreo = cab.id_monitoreo;

        CREATE TABLE #CatalogosPdf (
          id_catalogo_sdp INT NOT NULL PRIMARY KEY,
          fundo NVARCHAR(250) NULL, nombre_productor NVARCHAR(250) NULL,
          variedad NVARCHAR(250) NULL, cuartel NVARCHAR(100) NULL,
          codigo_trazabilidad NVARCHAR(100) NULL, sdp NVARCHAR(100) NULL,
          codigo_sag NVARCHAR(100) NULL
        );
        INSERT INTO #CatalogosPdf
        SELECT mb.id_catalogo_sdp,
          CONVERT(nvarchar(250), mb.fundo), CONVERT(nvarchar(250), mb.nombre_productor),
          CONVERT(nvarchar(250), mb.variedad), CONVERT(nvarchar(100), mb.cuartel),
          CONVERT(nvarchar(100), mb.codigo_trazabilidad), CONVERT(nvarchar(100), mb.sdp),
          CONVERT(nvarchar(100), mb.codigo_sag)
        FROM dbo.MONIPLA_CATALOGO_SDP_MB mb
        INNER JOIN (
          SELECT DISTINCT id_catalogo_sdp
          FROM #CabecerasPdf
          WHERE id_catalogo_sdp IS NOT NULL
        ) usados ON usados.id_catalogo_sdp = mb.id_catalogo_sdp;

        CREATE TABLE #CabecerasTrazabilidadHistorica (
          id_monitoreo INT NOT NULL PRIMARY KEY,
          gen_fundo INT NULL, gen_campo INT NULL, gen_variedad INT NULL, gen_cuartel INT NULL,
          codigo_cuartel NVARCHAR(100) NULL, sdp NVARCHAR(100) NULL, csg NVARCHAR(100) NULL
        );
        INSERT INTO #CabecerasTrazabilidadHistorica
        SELECT id_monitoreo, gen_fundo, gen_campo, gen_variedad, gen_cuartel, codigo_cuartel, sdp, csg
        FROM #CabecerasPdf
        WHERE id_catalogo_sdp IS NULL;

        CREATE TABLE #ClavesAgricolasTrazabilidadHistorica (
          gen_fundo INT NOT NULL, gen_campo INT NOT NULL, gen_variedad INT NOT NULL
        );
        INSERT INTO #ClavesAgricolasTrazabilidadHistorica
        SELECT DISTINCT gen_fundo, gen_campo, gen_variedad
        FROM #CabecerasTrazabilidadHistorica
        WHERE gen_fundo IS NOT NULL AND gen_campo IS NOT NULL AND gen_variedad IS NOT NULL;

        CREATE TABLE #TrazabilidadHistoricaNormalizada (
          id_monitoreo INT NOT NULL, gen_fundo INT NULL, gen_campo INT NULL, gen_variedad INT NULL,
          cuartel_normalizado NVARCHAR(100) NULL, sdp_normalizado NVARCHAR(100) NULL, csg_normalizado NVARCHAR(100) NULL
        );
        INSERT INTO #TrazabilidadHistoricaNormalizada
        SELECT cp.id_monitoreo, cp.gen_fundo, cp.gen_campo, cp.gen_variedad,
          COALESCE(
            NULLIF(NULLIF(NULLIF(UPPER(LTRIM(RTRIM(cp.codigo_cuartel))), ''), 'N/A'), 'S/SDP'),
            NULLIF(NULLIF(NULLIF(UPPER(LTRIM(RTRIM(CONVERT(nvarchar(100), gcuHistorico.CODIGO)))), ''), 'N/A'), 'S/SDP')
          ),
          NULLIF(NULLIF(NULLIF(UPPER(LTRIM(RTRIM(cp.sdp))), ''), 'N/A'), 'S/SDP'),
          NULLIF(NULLIF(NULLIF(UPPER(LTRIM(RTRIM(cp.csg))), ''), 'N/A'), 'S/SDP')
        FROM #CabecerasTrazabilidadHistorica cp
        LEFT JOIN dbo.GEN_CUARTEL gcuHistorico ON gcuHistorico.GEN_CUARTEL = cp.gen_cuartel;

        CREATE TABLE #CatalogosTrazabilidadHistorica (
          gen_fundo INT NULL, gen_campo INT NULL, gen_variedad INT NULL,
          cuartel_normalizado NVARCHAR(100) NULL, sdp_normalizado NVARCHAR(100) NULL, csg_normalizado NVARCHAR(100) NULL,
          codigo_trazabilidad NVARCHAR(100) NULL
        );
        INSERT INTO #CatalogosTrazabilidadHistorica
        SELECT
          mb.gen_fundo, mb.gen_campo, mb.gen_variedad,
          NULLIF(NULLIF(NULLIF(UPPER(LTRIM(RTRIM(CONVERT(nvarchar(100), mb.cuartel)))), ''), 'N/A'), 'S/SDP'),
          NULLIF(NULLIF(NULLIF(UPPER(LTRIM(RTRIM(CONVERT(nvarchar(100), mb.sdp)))), ''), 'N/A'), 'S/SDP'),
          NULLIF(NULLIF(NULLIF(UPPER(LTRIM(RTRIM(CONVERT(nvarchar(100), mb.codigo_sag)))), ''), 'N/A'), 'S/SDP'),
          CONVERT(nvarchar(100), mb.codigo_trazabilidad)
        FROM dbo.MONIPLA_CATALOGO_SDP_MB mb
        INNER JOIN #ClavesAgricolasTrazabilidadHistorica claves ON claves.gen_fundo = mb.gen_fundo
          AND claves.gen_campo = mb.gen_campo
          AND claves.gen_variedad = mb.gen_variedad
        OPTION (RECOMPILE);

        CREATE TABLE #TrazabilidadCoincidencias (
          id_monitoreo INT NOT NULL,
          codigo_trazabilidad NVARCHAR(100) NULL
        );
        INSERT INTO #TrazabilidadCoincidencias (id_monitoreo, codigo_trazabilidad)
        SELECT
          cp.id_monitoreo,
          NULLIF(NULLIF(NULLIF(LTRIM(RTRIM(mbHistorico.codigo_trazabilidad)), ''), 'N/A'), 'S/SDP')
        FROM #TrazabilidadHistoricaNormalizada cp
        INNER JOIN #CatalogosTrazabilidadHistorica mbHistorico ON mbHistorico.gen_fundo = cp.gen_fundo
          AND mbHistorico.gen_campo = cp.gen_campo
          AND mbHistorico.gen_variedad = cp.gen_variedad
          AND mbHistorico.cuartel_normalizado = cp.cuartel_normalizado
          AND mbHistorico.sdp_normalizado = cp.sdp_normalizado
          AND mbHistorico.csg_normalizado = cp.csg_normalizado
        OPTION (RECOMPILE);

        CREATE TABLE #TrazabilidadResumen (
          id_monitoreo INT NOT NULL PRIMARY KEY,
          cantidad_coincidencias INT NOT NULL,
          cantidad_trazabilidades_distintas INT NOT NULL,
          codigo_trazabilidad NVARCHAR(100) NULL
        );
        INSERT INTO #TrazabilidadResumen
        SELECT
          id_monitoreo,
          COUNT(*) AS cantidad_coincidencias,
          COUNT(DISTINCT codigo_trazabilidad) AS cantidad_trazabilidades_distintas,
          MIN(codigo_trazabilidad) AS codigo_trazabilidad
        FROM #TrazabilidadCoincidencias
        GROUP BY id_monitoreo;

        SELECT
          cp.id_monitoreo, cp.fecha_monitoreo, cp.id_catalogo_sdp, cp.gen_fundo, cp.gen_campo, cp.gen_variedad, cp.gen_cuartel,
          NULL AS nombre_fundo,
          NULL AS nombre_campo,
          NULL AS nombre_variedad,
          NULLIF(LTRIM(RTRIM(cp.codigo_cuartel)), '') AS codigo_cuartel,
          cp.sdp, cp.csg,
          NULL AS trazabilidad,
          cp.id_estadofenologico, cp.id_monitoreador, cp.cant_plantas, cp.observaciones,
          cp.horas_frio_acumuladas, cp.dias_grado_acumulados, cp.nombre_estacion_meteo,
          CONVERT(char(10), cp.fecha_corte_agroclima, 23) AS fecha_corte_agroclima
        FROM #CabecerasPdf cp
        ORDER BY cp.fecha_monitoreo DESC, cp.id_monitoreo DESC;

        SELECT det.id_monitoreo, det.id_estadomonitoreo, det.id_estadoposicion, det.cantidad_bichos
        FROM dbo.MONI_DETALLEMONITOREO det
        INNER JOIN #ChanchitosFiltrados seleccion ON seleccion.id_monitoreo = det.id_monitoreo
        ORDER BY det.id_monitoreo, det.id_estadomonitoreo, det.id_estadoposicion;

        SELECT id_catalogo_sdp, fundo, nombre_productor, variedad, cuartel, codigo_trazabilidad, sdp, codigo_sag
        FROM #CatalogosPdf;
        SELECT DISTINCT cp.gen_fundo AS id, LTRIM(RTRIM(gf.Nombre)) AS nombre FROM #CabecerasPdf cp INNER JOIN dbo.GEN_FUNDO gf ON gf.Gen_Fundo=cp.gen_fundo WHERE cp.gen_fundo IS NOT NULL;
        SELECT DISTINCT cp.gen_campo AS id, LTRIM(RTRIM(gc.Nombre)) AS nombre FROM #CabecerasPdf cp INNER JOIN dbo.GEN_CAMPO gc ON gc.Gen_Campo=cp.gen_campo WHERE cp.gen_campo IS NOT NULL;
        SELECT DISTINCT cp.gen_variedad AS id, LTRIM(RTRIM(gv.Nombre)) AS nombre FROM #CabecerasPdf cp INNER JOIN dbo.GEN_VARIEDAD gv ON gv.gen_variedad=cp.gen_variedad WHERE cp.gen_variedad IS NOT NULL;
        SELECT DISTINCT cp.gen_cuartel AS id, LTRIM(RTRIM(CONVERT(nvarchar(100), gcu.CODIGO))) AS codigo_cuartel, gcu.GEN_FUNDO, gcu.GEN_CAMPO, gcu.GEN_VARIEDAD FROM #CabecerasPdf cp INNER JOIN dbo.GEN_CUARTEL gcu ON gcu.GEN_CUARTEL=cp.gen_cuartel WHERE cp.gen_cuartel IS NOT NULL;
        SELECT DISTINCT mon.id_monitoreador, mon.nombre_monitoreador FROM dbo.MONI_MONITOREADORES mon INNER JOIN (SELECT DISTINCT id_monitoreador FROM #CabecerasPdf WHERE id_monitoreador IS NOT NULL) usados ON usados.id_monitoreador=mon.id_monitoreador;
        SELECT DISTINCT ef.id_estadofenologico, ef.nom_estadofenologico FROM dbo.estado_fenologico ef INNER JOIN (SELECT DISTINCT id_estadofenologico FROM #CabecerasPdf WHERE id_estadofenologico IS NOT NULL) usados ON usados.id_estadofenologico=ef.id_estadofenologico;
        SELECT
          cp.id_monitoreo,
          CASE
            WHEN cp.id_catalogo_sdp IS NOT NULL THEN NULLIF(NULLIF(NULLIF(LTRIM(RTRIM(catalogo.codigo_trazabilidad)), ''), 'N/A'), 'S/SDP')
            WHEN ISNULL(historia.cantidad_trazabilidades_distintas, 0) = 1 THEN historia.codigo_trazabilidad
            ELSE NULL
          END AS codigo_trazabilidad,
          CASE
            WHEN cp.id_catalogo_sdp IS NOT NULL AND catalogo.id_catalogo_sdp IS NOT NULL THEN 1
            ELSE ISNULL(historia.cantidad_coincidencias, 0)
          END AS cantidad_coincidencias,
          CASE
            WHEN cp.id_catalogo_sdp IS NOT NULL AND NULLIF(NULLIF(NULLIF(LTRIM(RTRIM(catalogo.codigo_trazabilidad)), ''), 'N/A'), 'S/SDP') IS NOT NULL THEN 1
            WHEN cp.id_catalogo_sdp IS NOT NULL THEN 0
            ELSE ISNULL(historia.cantidad_trazabilidades_distintas, 0)
          END AS cantidad_trazabilidades_distintas,
          CASE
            WHEN cp.id_catalogo_sdp IS NOT NULL AND catalogo.id_catalogo_sdp IS NOT NULL
              AND NULLIF(NULLIF(NULLIF(LTRIM(RTRIM(catalogo.codigo_trazabilidad)), ''), 'N/A'), 'S/SDP') IS NOT NULL THEN 'POR_ID_CATALOGO'
            WHEN cp.id_catalogo_sdp IS NOT NULL AND catalogo.id_catalogo_sdp IS NOT NULL THEN 'SIN_TRAZABILIDAD'
            WHEN cp.id_catalogo_sdp IS NOT NULL THEN 'SIN_COINCIDENCIA'
            WHEN ISNULL(historia.cantidad_coincidencias, 0) = 0 THEN 'SIN_COINCIDENCIA'
            WHEN ISNULL(historia.cantidad_trazabilidades_distintas, 0) = 1 THEN 'HISTORICA_UNICA'
            WHEN ISNULL(historia.cantidad_trazabilidades_distintas, 0) > 1 THEN 'AMBIGUA'
            ELSE 'SIN_TRAZABILIDAD'
          END AS estado_resolucion
        FROM #CabecerasPdf cp
        LEFT JOIN #CatalogosPdf catalogo ON catalogo.id_catalogo_sdp = cp.id_catalogo_sdp
        LEFT JOIN #TrazabilidadResumen historia ON historia.id_monitoreo = cp.id_monitoreo;
      `);
    const recordsets = result.recordsets || [result.recordset || [], []];
    return { cabeceras: recordsets[0] || [], detalles: recordsets[1] || [], catalogos: recordsets[2] || [], fundos: recordsets[3] || [], campos: recordsets[4] || [], variedades: recordsets[5] || [], cuarteles: recordsets[6] || [], monitoreadores: recordsets[7] || [], estadosFenologicos: recordsets[8] || [], trazabilidades: recordsets[9] || [] };
  }

  obtenerPredicadoIdsChanchitos(filtros) {
    const condiciones = ['1 = 1'];
    if (filtros.fechaDesde) condiciones.push('cab.fecha_monitoreo >= @fechaDesde');
    if (filtros.fechaHasta) condiciones.push('cab.fecha_monitoreo <= @fechaHasta');
    if (filtros.idMonitoreador) condiciones.push('cab.id_monitoreador = @idMonitoreador');
    if (filtros.idEstadoFenologico) condiciones.push('cab.id_estadofenologico = @idEstadoFenologico');
    if (filtros.genFundo) condiciones.push('(cab.gen_fundo = @genFundo OR EXISTS (SELECT 1 FROM dbo.MONIPLA_CATALOGO_SDP_MB mbF WHERE mbF.id_catalogo_sdp = cab.id_catalogo_sdp AND mbF.gen_fundo = @genFundo) OR EXISTS (SELECT 1 FROM dbo.GEN_CUARTEL gcuF WHERE gcuF.GEN_CUARTEL = cab.gen_cuartel AND gcuF.GEN_FUNDO = @genFundo))');
    if (filtros.genCampo) condiciones.push('(cab.gen_campo = @genCampo OR EXISTS (SELECT 1 FROM dbo.MONIPLA_CATALOGO_SDP_MB mbC WHERE mbC.id_catalogo_sdp = cab.id_catalogo_sdp AND mbC.gen_campo = @genCampo) OR EXISTS (SELECT 1 FROM dbo.GEN_CUARTEL gcuC WHERE gcuC.GEN_CUARTEL = cab.gen_cuartel AND gcuC.GEN_CAMPO = @genCampo))');
    if (filtros.genVariedad) condiciones.push('(cab.gen_variedad = @genVariedad OR EXISTS (SELECT 1 FROM dbo.MONIPLA_CATALOGO_SDP_MB mbV WHERE mbV.id_catalogo_sdp = cab.id_catalogo_sdp AND mbV.gen_variedad = @genVariedad) OR EXISTS (SELECT 1 FROM dbo.GEN_CUARTEL gcuV WHERE gcuV.GEN_CUARTEL = cab.gen_cuartel AND gcuV.GEN_VARIEDAD = @genVariedad))');
    if (filtros.idCatalogoSdp) condiciones.push('(cab.id_catalogo_sdp = @idCatalogoSdp OR (cab.id_catalogo_sdp IS NULL AND ((cab.gen_fundo = @CatalogoFundo AND cab.gen_campo = @CatalogoCampo AND cab.gen_variedad = @CatalogoVariedad) OR EXISTS (SELECT 1 FROM dbo.GEN_CUARTEL gcuS WHERE gcuS.GEN_CUARTEL = cab.gen_cuartel AND gcuS.GEN_FUNDO = @CatalogoFundo AND gcuS.GEN_CAMPO = @CatalogoCampo AND gcuS.GEN_VARIEDAD = @CatalogoVariedad AND CONVERT(nvarchar(100), gcuS.CODIGO) = @CatalogoCuartel))))');
    if (filtros.deteccion === 'CON_DETECCION') condiciones.push('EXISTS (SELECT 1 FROM dbo.MONI_DETALLEMONITOREO det WHERE det.id_monitoreo = cab.id_monitoreo AND det.cantidad_bichos > 0)');
    if (filtros.deteccion === 'SIN_DETECCION') condiciones.push('NOT EXISTS (SELECT 1 FROM dbo.MONI_DETALLEMONITOREO det WHERE det.id_monitoreo = cab.id_monitoreo AND det.cantidad_bichos > 0)');
    return condiciones.join('\n AND ');
  }

  async obtenerMonitoreosPdfGeneralAnterior(filtros = {}) {
    const pool = await this.poolPromise;
    const result = await this.crearRequestHistorial(pool, filtros)
      .query(`
        DECLARE @MonitoreosPdf TABLE (id_monitoreo INT NOT NULL PRIMARY KEY);

        INSERT INTO @MonitoreosPdf (id_monitoreo)
        SELECT cab.id_monitoreo
        ${this.obtenerBaseFiltradaHistorialChanchitos(filtros)}
        OPTION (RECOMPILE);

        SELECT
          cab.id_monitoreo,
          cab.fecha_monitoreo,
          cab.gen_cuartel,
          cab.id_catalogo_sdp,
          LTRIM(RTRIM(CONVERT(nvarchar(100), cab.codigo_cuartel))) AS codigo_cuartel,
          COALESCE(NULLIF(LTRIM(RTRIM(mb.fundo)), ''), CONCAT('Fundo ', cab.gen_fundo)) AS nombre_fundo,
          COALESCE(NULLIF(LTRIM(RTRIM(mb.nombre_productor)), ''), CONCAT('Campo ', cab.gen_campo)) AS nombre_campo,
          COALESCE(NULLIF(LTRIM(RTRIM(mb.variedad)), ''), CONCAT('Variedad ', cab.gen_variedad)) AS nombre_variedad,
          COALESCE(CONVERT(nvarchar(100), cab.sdp), CONVERT(nvarchar(100), mb.sdp), '') AS sdp,
          COALESCE(CONVERT(nvarchar(100), cab.CSG), CONVERT(nvarchar(100), mb.codigo_sag), '') AS csg,
          COALESCE(CONVERT(nvarchar(100), mb.codigo_trazabilidad), '') AS trazabilidad,
          cab.id_estadofenologico,
          cab.cant_plantas,
          cab.id_monitoreador,
          cab.observaciones
        FROM @MonitoreosPdf seleccion
        INNER JOIN dbo.MONI_CABECERAMONITOREO cab ON cab.id_monitoreo = seleccion.id_monitoreo
        LEFT JOIN dbo.MONIPLA_CATALOGO_SDP_MB mb ON mb.id_catalogo_sdp = cab.id_catalogo_sdp
        ORDER BY cab.fecha_monitoreo DESC, cab.id_monitoreo DESC;

        SELECT
          det.id_monitoreo,
          det.id_estadomonitoreo,
          det.id_estadoposicion,
          det.cantidad_bichos
        FROM dbo.MONI_DETALLEMONITOREO det
        INNER JOIN @MonitoreosPdf seleccion ON seleccion.id_monitoreo = det.id_monitoreo
        ORDER BY det.id_monitoreo ASC, det.id_estadomonitoreo ASC, det.id_estadoposicion ASC;
      `);

    const recordsets = result.recordsets || [result.recordset || [], []];
    return {
      cabeceras: recordsets[0] || [],
      detalles: recordsets[1] || [],
    };
  }

  async obtenerCatalogosPresentacionPdf() {
    const pool = await this.poolPromise;
    const result = await pool.request().query(`
      SELECT id_monitoreador, nombre_monitoreador
      FROM dbo.MONI_MONITOREADORES;

      SELECT id_estadofenologico, nom_estadofenologico
      FROM dbo.estado_fenologico;
    `);
    const recordsets = result.recordsets || [result.recordset || [], []];

    return {
      monitoreadores: recordsets[0] || [],
      estadosFenologicos: recordsets[1] || [],
    };
  }

  async obtenerHistorialConsolidado(filtros, pagina, pageSize) {
    const pool = await this.poolPromise;
    const offset = (pagina - 1) * pageSize;
    const result = await this.crearRequestHistorial(pool, filtros)
      .input('offset', this.sql.Int, offset)
      .input('pageSize', this.sql.Int, pageSize)
      .query(`
        SET NOCOUNT ON;
        CREATE TABLE #ChanchitosFiltrados (id_monitoreo INT NOT NULL PRIMARY KEY);
        CREATE TABLE #DetallesChanchitos (id_monitoreo INT NOT NULL PRIMARY KEY, total_bichos INT NOT NULL, posiciones_con_deteccion INT NOT NULL);
        DECLARE @CatalogoFundo INT = NULL, @CatalogoCampo INT = NULL, @CatalogoVariedad INT = NULL, @CatalogoCuartel nvarchar(100) = NULL;
        SELECT TOP (1) @CatalogoFundo = gen_fundo, @CatalogoCampo = gen_campo, @CatalogoVariedad = gen_variedad, @CatalogoCuartel = CONVERT(nvarchar(100), cuartel)
        FROM dbo.MONIPLA_CATALOGO_SDP_MB WHERE id_catalogo_sdp = @idCatalogoSdp;

        INSERT INTO #ChanchitosFiltrados (id_monitoreo)
        SELECT cab.id_monitoreo
        FROM dbo.MONI_CABECERAMONITOREO cab
        WHERE ${this.obtenerPredicadoIdsChanchitos(filtros)}
        OPTION (RECOMPILE);

        INSERT INTO #DetallesChanchitos (id_monitoreo, total_bichos, posiciones_con_deteccion)
        SELECT det.id_monitoreo, SUM(ISNULL(det.cantidad_bichos, 0)), SUM(CASE WHEN ISNULL(det.cantidad_bichos, 0) > 0 THEN 1 ELSE 0 END)
        FROM dbo.MONI_DETALLEMONITOREO det
        INNER JOIN #ChanchitosFiltrados seleccion ON seleccion.id_monitoreo = det.id_monitoreo
        GROUP BY det.id_monitoreo;

        DECLARE @TotalFiltrados INT = (SELECT COUNT(1) FROM #ChanchitosFiltrados);
        DECLARE @OffsetEfectivo INT = CASE WHEN @offset >= @TotalFiltrados AND @TotalFiltrados > 0 THEN ((@TotalFiltrados - 1) / @pageSize) * @pageSize ELSE @offset END;

        SELECT COUNT(1) AS total_registros, ISNULL(SUM(cab.cant_plantas), 0) AS total_plantas,
          ISNULL(SUM(ISNULL(det.total_bichos, 0)), 0) AS total_bichos,
          ISNULL(SUM(CASE WHEN ISNULL(det.total_bichos, 0) > 0 THEN 1 ELSE 0 END), 0) AS monitoreos_con_deteccion
        FROM #ChanchitosFiltrados seleccion
        INNER JOIN dbo.MONI_CABECERAMONITOREO cab ON cab.id_monitoreo = seleccion.id_monitoreo
        LEFT JOIN #DetallesChanchitos det ON det.id_monitoreo = seleccion.id_monitoreo;

        SELECT @TotalFiltrados AS total_registros;

        ;WITH Pagina AS (
          SELECT seleccion.id_monitoreo, ROW_NUMBER() OVER (ORDER BY cab.fecha_monitoreo DESC, cab.id_monitoreo DESC) AS fila
          FROM #ChanchitosFiltrados seleccion
          INNER JOIN dbo.MONI_CABECERAMONITOREO cab ON cab.id_monitoreo = seleccion.id_monitoreo
        )
        SELECT cab.id_monitoreo, CONVERT(char(10), cab.fecha_monitoreo, 23) AS fecha_monitoreo, CONVERT(char(10), cab.fecha_registro, 23) AS fecha_registro,
          COALESCE(NULLIF(LTRIM(RTRIM(mb.fundo)), ''), NULLIF(LTRIM(RTRIM(gf.Nombre)), '')) AS nombre_fundo,
          COALESCE(NULLIF(LTRIM(RTRIM(mb.nombre_productor)), ''), NULLIF(LTRIM(RTRIM(gcpo.Nombre)), '')) AS nombre_campo,
          COALESCE(NULLIF(LTRIM(RTRIM(mb.variedad)), ''), NULLIF(LTRIM(RTRIM(gv.Nombre)), '')) AS nombre_variedad,
          COALESCE(NULLIF(LTRIM(RTRIM(CONVERT(nvarchar(100), cab.codigo_cuartel))), ''), NULLIF(LTRIM(RTRIM(CONVERT(nvarchar(100), gcu.CODIGO))), ''), NULLIF(LTRIM(RTRIM(CONVERT(nvarchar(100), mb.cuartel))), '')) AS codigo_cuartel,
          COALESCE(CONVERT(nvarchar(100), cab.sdp), CONVERT(nvarchar(100), mb.sdp), '') AS sdp,
          COALESCE(CONVERT(nvarchar(100), cab.CSG), CONVERT(nvarchar(100), mb.codigo_sag), '') AS csg,
          CONVERT(nvarchar(100), mb.codigo_trazabilidad) AS trazabilidad, ISNULL(cab.cant_plantas, 0) AS cant_plantas,
          cab.id_estadofenologico, cab.id_monitoreador, cab.observaciones, cab.nombre_estacion_meteo, cab.horas_frio_acumuladas, cab.dias_grado_acumulados,
          CONVERT(char(10), cab.fecha_corte_agroclima, 23) AS fecha_corte_agroclima, cab.agroclima_observacion,
          ISNULL(det.total_bichos, 0) AS total_bichos, ISNULL(det.posiciones_con_deteccion, 0) AS posiciones_con_deteccion
        FROM Pagina pagina
        INNER JOIN dbo.MONI_CABECERAMONITOREO cab ON cab.id_monitoreo = pagina.id_monitoreo
        LEFT JOIN #DetallesChanchitos det ON det.id_monitoreo = cab.id_monitoreo
        LEFT JOIN dbo.MONIPLA_CATALOGO_SDP_MB mb ON mb.id_catalogo_sdp = cab.id_catalogo_sdp
        LEFT JOIN dbo.GEN_CUARTEL gcu ON gcu.GEN_CUARTEL = cab.gen_cuartel
        LEFT JOIN dbo.GEN_FUNDO gf ON gf.Gen_Fundo = gcu.GEN_FUNDO
        LEFT JOIN dbo.GEN_CAMPO gcpo ON gcpo.Gen_Campo = gcu.GEN_CAMPO
        LEFT JOIN dbo.GEN_VARIEDAD gv ON gv.gen_variedad = gcu.GEN_VARIEDAD
        WHERE pagina.fila > @OffsetEfectivo AND pagina.fila <= @OffsetEfectivo + @pageSize
        ORDER BY pagina.fila;

        ;WITH Pagina AS (
          SELECT seleccion.id_monitoreo, ROW_NUMBER() OVER (ORDER BY cab.fecha_monitoreo DESC, cab.id_monitoreo DESC) AS fila
          FROM #ChanchitosFiltrados seleccion
          INNER JOIN dbo.MONI_CABECERAMONITOREO cab ON cab.id_monitoreo = seleccion.id_monitoreo
        )
        SELECT det.id_monitoreo, det.id_estadomonitoreo, det.id_estadoposicion, det.cantidad_bichos
        FROM dbo.MONI_DETALLEMONITOREO det
        INNER JOIN Pagina pagina ON pagina.id_monitoreo = det.id_monitoreo
        WHERE pagina.fila > @OffsetEfectivo AND pagina.fila <= @OffsetEfectivo + @pageSize
        ORDER BY det.id_monitoreo, det.id_estadomonitoreo, det.id_estadoposicion;
      `);
    const recordsets = result.recordsets || [];
    return { resumen: recordsets[0]?.[0] || {}, totalRegistros: Number(recordsets[1]?.[0]?.total_registros || 0), cabeceras: recordsets[2] || [], detalles: recordsets[3] || [] };
  }

  async listarHistorialChanchitos(filtros, pagina, pageSize) {
    const pool = await this.poolPromise;
    const offset = (pagina - 1) * pageSize;
    const result = await this.crearRequestHistorial(pool, filtros)
      .input('offset', this.sql.Int, offset)
      .input('pageSize', this.sql.Int, pageSize)
      .query(`
        ;WITH BaseFiltrada AS (
          SELECT cab.id_monitoreo, cab.fecha_monitoreo
          ${this.obtenerBaseFiltradaHistorialChanchitos(filtros)}
        ), Pagina AS (
          SELECT id_monitoreo, fecha_monitoreo
          FROM BaseFiltrada
          ORDER BY fecha_monitoreo DESC, id_monitoreo DESC
          OFFSET @offset ROWS FETCH NEXT @pageSize ROWS ONLY
        )
        SELECT
          cab.id_monitoreo,
          CONVERT(char(10), cab.fecha_monitoreo, 23) AS fecha_monitoreo,
          CONVERT(char(10), cab.fecha_registro, 23) AS fecha_registro,
          COALESCE(NULLIF(LTRIM(RTRIM(mb.fundo)), ''), NULLIF(LTRIM(RTRIM(f.Nombre)), ''), CONCAT('Fundo ', cab.gen_fundo)) AS nombre_fundo,
          COALESCE(NULLIF(LTRIM(RTRIM(mb.nombre_productor)), ''), NULLIF(LTRIM(RTRIM(c.Nombre)), ''), '') AS nombre_campo,
          COALESCE(NULLIF(LTRIM(RTRIM(mb.variedad)), ''), NULLIF(LTRIM(RTRIM(v.Nombre)), ''), '') AS nombre_variedad,
          COALESCE(
            NULLIF(LTRIM(RTRIM(CONVERT(nvarchar(100), cab.codigo_cuartel))), ''),
            NULLIF(LTRIM(RTRIM(CONVERT(nvarchar(100), gc.CODIGO))), ''),
            NULLIF(LTRIM(RTRIM(CONVERT(nvarchar(100), mb.cuartel))), ''),
            ''
          ) AS codigo_cuartel,
          COALESCE(CONVERT(nvarchar(100), cab.sdp), CONVERT(nvarchar(100), rel.sdp), CONVERT(nvarchar(100), mb.sdp), '') AS sdp,
          COALESCE(CONVERT(nvarchar(100), cab.CSG), CONVERT(nvarchar(100), rel.csg), CONVERT(nvarchar(100), mb.codigo_sag), '') AS csg,
          COALESCE(CONVERT(nvarchar(100), rel.trazabilidad), CONVERT(nvarchar(100), mb.codigo_trazabilidad), '') AS trazabilidad,
          ISNULL(cab.cant_plantas, 0) AS cant_plantas,
          cab.id_estadofenologico,
          cab.id_monitoreador,
          cab.observaciones,
          LTRIM(RTRIM(ISNULL(cab.nombre_estacion_meteo, ''))) AS nombre_estacion_meteo,
          cab.horas_frio_acumuladas,
          cab.dias_grado_acumulados,
          CONVERT(char(10), cab.fecha_corte_agroclima, 23) AS fecha_corte_agroclima,
          cab.agroclima_observacion
        FROM Pagina pagina
        INNER JOIN dbo.MONI_CABECERAMONITOREO cab ON cab.id_monitoreo = pagina.id_monitoreo
        ${this.obtenerJoinsPresentacionHistorialChanchitos()}
        ORDER BY pagina.fecha_monitoreo DESC, pagina.id_monitoreo DESC
        OPTION (RECOMPILE)
      `);

    const registros = result.recordset || [];
    const detallesPorMonitoreo = await this.obtenerDetallesAgregadosPorMonitoreos(
      pool,
      registros.map((registro) => registro.id_monitoreo)
    );

    return registros.map((registro) => {
      const detalles = detallesPorMonitoreo.get(registro.id_monitoreo);
      return {
        ...registro,
        total_bichos: detalles ? detalles.total_bichos : 0,
        posiciones_con_deteccion: detalles ? detalles.posiciones_con_deteccion : 0,
      };
    });
  }

  async contarHistorialChanchitos(filtros) {
    const pool = await this.poolPromise;
    const result = await this.crearRequestHistorial(pool, filtros).query(`
      SELECT COUNT(1) AS total_registros
      ${this.obtenerBaseFiltradaHistorialChanchitos(filtros)}
      OPTION (RECOMPILE)
    `);

    return Number(result.recordset[0] && result.recordset[0].total_registros || 0);
  }

  async obtenerResumenHistorialChanchitos(filtros) {
    const pool = await this.poolPromise;
    const filtrosSinDeteccion = { ...filtros, deteccion: '' };
    const condicionDeteccion = filtros.deteccion === 'CON_DETECCION'
      ? 'WHERE ISNULL(detalles.tiene_deteccion, 0) = 1'
      : filtros.deteccion === 'SIN_DETECCION'
        ? 'WHERE ISNULL(detalles.tiene_deteccion, 0) = 0'
        : '';
    const result = await this.crearRequestHistorial(pool, filtros).query(`
      ;WITH BaseFiltrada AS (
        SELECT cab.id_monitoreo, ISNULL(cab.cant_plantas, 0) AS cant_plantas
        ${this.obtenerBaseFiltradaHistorialChanchitos(filtrosSinDeteccion)}
      ), DetallesAgregados AS (
        SELECT
          det.id_monitoreo,
          SUM(ISNULL(det.cantidad_bichos, 0)) AS total_bichos,
          MAX(CASE WHEN ISNULL(det.cantidad_bichos, 0) > 0 THEN 1 ELSE 0 END) AS tiene_deteccion
        FROM dbo.MONI_DETALLEMONITOREO det
        GROUP BY det.id_monitoreo
      )
      SELECT
        COUNT(1) AS total_registros,
        ISNULL(SUM(base.cant_plantas), 0) AS total_plantas,
        ISNULL(SUM(ISNULL(detalles.total_bichos, 0)), 0) AS total_bichos,
        ISNULL(SUM(CASE WHEN ISNULL(detalles.total_bichos, 0) > 0 THEN 1 ELSE 0 END), 0) AS monitoreos_con_deteccion
      FROM BaseFiltrada base
      LEFT JOIN DetallesAgregados detalles ON detalles.id_monitoreo = base.id_monitoreo
      ${condicionDeteccion}
      OPTION (RECOMPILE)
    `);

    return result.recordset[0] || {};
  }

  async obtenerDetalleChanchitos(idMonitoreo) {
    const pool = await this.poolPromise;
    const cabeceraResult = await pool.request()
      .input('idMonitoreo', this.sql.Int, idMonitoreo)
      .query(`
        SELECT
          cab.id_monitoreo,
          CONVERT(char(10), cab.fecha_monitoreo, 23) AS fecha_monitoreo,
          CONVERT(char(10), cab.fecha_registro, 23) AS fecha_registro,
          COALESCE(NULLIF(LTRIM(RTRIM(mb.fundo)), ''), NULLIF(LTRIM(RTRIM(f.Nombre)), ''), CONCAT('Fundo ', cab.gen_fundo)) AS nombre_fundo,
          COALESCE(NULLIF(LTRIM(RTRIM(mb.nombre_productor)), ''), NULLIF(LTRIM(RTRIM(c.Nombre)), ''), '') AS nombre_campo,
          COALESCE(NULLIF(LTRIM(RTRIM(mb.variedad)), ''), NULLIF(LTRIM(RTRIM(v.Nombre)), ''), '') AS nombre_variedad,
          COALESCE(NULLIF(LTRIM(RTRIM(CONVERT(nvarchar(100), cab.codigo_cuartel))), ''), NULLIF(LTRIM(RTRIM(CONVERT(nvarchar(100), gc.CODIGO))), ''), NULLIF(LTRIM(RTRIM(CONVERT(nvarchar(100), mb.cuartel))), ''), '') AS codigo_cuartel,
          COALESCE(CONVERT(nvarchar(100), cab.sdp), CONVERT(nvarchar(100), rel.sdp), CONVERT(nvarchar(100), mb.sdp), '') AS sdp,
          COALESCE(CONVERT(nvarchar(100), cab.CSG), CONVERT(nvarchar(100), rel.csg), CONVERT(nvarchar(100), mb.codigo_sag), '') AS csg,
          CASE
            WHEN cab.id_catalogo_sdp IS NOT NULL THEN NULLIF(NULLIF(NULLIF(LTRIM(RTRIM(CONVERT(nvarchar(100), mb.codigo_trazabilidad))), ''), 'N/A'), 'S/SDP')
            WHEN trazabilidadHistorica.cantidad_trazabilidades_distintas = 1 THEN trazabilidadHistorica.codigo_trazabilidad
            ELSE NULL
          END AS trazabilidad,
          ISNULL(cab.cant_plantas, 0) AS cant_plantas,
          cab.id_estadofenologico,
          cab.id_monitoreador,
          cab.observaciones,
          LTRIM(RTRIM(ISNULL(cab.nombre_estacion_meteo, ''))) AS nombre_estacion_meteo,
          cab.horas_frio_acumuladas,
          cab.dias_grado_acumulados,
          CONVERT(char(10), cab.fecha_corte_agroclima, 23) AS fecha_corte_agroclima,
          cab.semana_iso_corte,
          cab.temporada_agroclima,
          cab.agroclima_observacion,
          ISNULL(detalles.total_bichos, 0) AS total_bichos,
          ISNULL(detalles.posiciones_con_deteccion, 0) AS posiciones_con_deteccion
        FROM dbo.MONI_CABECERAMONITOREO cab
        OUTER APPLY (
          SELECT
            SUM(ISNULL(det.cantidad_bichos, 0)) AS total_bichos,
            SUM(CASE WHEN ISNULL(det.cantidad_bichos, 0) > 0 THEN 1 ELSE 0 END) AS posiciones_con_deteccion
          FROM dbo.MONI_DETALLEMONITOREO det
          WHERE det.id_monitoreo = cab.id_monitoreo
        ) detalles
        OUTER APPLY (
          SELECT CONVERT(nvarchar(100), gcuHistorico.CODIGO) AS codigo_cuartel
          FROM dbo.GEN_CUARTEL gcuHistorico
          WHERE gcuHistorico.GEN_CUARTEL = cab.gen_cuartel
        ) cuartelHistorico
        OUTER APPLY (
          SELECT
            COUNT(*) AS cantidad_coincidencias,
            COUNT(DISTINCT coincidencia.codigo_trazabilidad) AS cantidad_trazabilidades_distintas,
            MIN(coincidencia.codigo_trazabilidad) AS codigo_trazabilidad
          FROM (
            SELECT NULLIF(NULLIF(NULLIF(LTRIM(RTRIM(CONVERT(nvarchar(100), mbHistorico.codigo_trazabilidad))), ''), 'N/A'), 'S/SDP') AS codigo_trazabilidad
            FROM dbo.MONIPLA_CATALOGO_SDP_MB mbHistorico
            WHERE cab.id_catalogo_sdp IS NULL
              AND mbHistorico.gen_fundo = cab.gen_fundo
              AND mbHistorico.gen_campo = cab.gen_campo
              AND mbHistorico.gen_variedad = cab.gen_variedad
              AND NULLIF(NULLIF(NULLIF(UPPER(LTRIM(RTRIM(CONVERT(nvarchar(100), mbHistorico.cuartel)))), ''), 'N/A'), 'S/SDP') =
                  COALESCE(
                    NULLIF(NULLIF(NULLIF(UPPER(LTRIM(RTRIM(CONVERT(nvarchar(100), cab.codigo_cuartel)))), ''), 'N/A'), 'S/SDP'),
                    NULLIF(NULLIF(NULLIF(UPPER(LTRIM(RTRIM(cuartelHistorico.codigo_cuartel))), ''), 'N/A'), 'S/SDP')
                  )
              AND NULLIF(NULLIF(NULLIF(UPPER(LTRIM(RTRIM(CONVERT(nvarchar(100), mbHistorico.sdp)))), ''), 'N/A'), 'S/SDP') =
                  NULLIF(NULLIF(NULLIF(UPPER(LTRIM(RTRIM(CONVERT(nvarchar(100), cab.sdp)))), ''), 'N/A'), 'S/SDP')
              AND NULLIF(NULLIF(NULLIF(UPPER(LTRIM(RTRIM(CONVERT(nvarchar(100), mbHistorico.codigo_sag)))), ''), 'N/A'), 'S/SDP') =
                  NULLIF(NULLIF(NULLIF(UPPER(LTRIM(RTRIM(CONVERT(nvarchar(100), cab.CSG)))), ''), 'N/A'), 'S/SDP')
          ) coincidencia
        ) trazabilidadHistorica
        ${this.obtenerJoinsPresentacionHistorialChanchitos()}
        WHERE cab.id_monitoreo = @idMonitoreo
      `);
    const cabecera = cabeceraResult.recordset[0];

    if (!cabecera) {
      return null;
    }

    const detallesResult = await pool.request()
      .input('idMonitoreo', this.sql.Int, idMonitoreo)
      .query(`
        SELECT id_estadomonitoreo, id_estadoposicion, ISNULL(cantidad_bichos, 0) AS cantidad_bichos
        FROM dbo.MONI_DETALLEMONITOREO
        WHERE id_monitoreo = @idMonitoreo
        ORDER BY id_estadomonitoreo ASC, id_estadoposicion ASC
      `);

    return { cabecera, detalles: detallesResult.recordset || [] };
  }

  crearRequestHistorial(pool, filtros) {
    return pool.request()
      .input('fechaDesde', this.sql.Date, filtros.fechaDesde || null)
      .input('fechaHasta', this.sql.Date, filtros.fechaHasta || null)
      .input('genFundo', this.sql.Int, filtros.genFundo || null)
      .input('genCampo', this.sql.Int, filtros.genCampo || null)
      .input('genVariedad', this.sql.Int, filtros.genVariedad || null)
      .input('idCatalogoSdp', this.sql.Int, filtros.idCatalogoSdp || null)
      .input('idMonitoreador', this.sql.Int, filtros.idMonitoreador || null)
      .input('idEstadoFenologico', this.sql.Int, filtros.idEstadoFenologico || null)
      .input('deteccion', this.sql.VarChar(20), filtros.deteccion || null);
  }

  async obtenerDetallesAgregadosPorMonitoreos(pool, idsMonitoreo) {
    if (idsMonitoreo.length === 0) {
      return new Map();
    }

    const request = pool.request();
    const placeholders = idsMonitoreo.map((idMonitoreo, index) => {
      const nombreParametro = `idMonitoreo${index}`;
      request.input(nombreParametro, this.sql.Int, idMonitoreo);
      return `@${nombreParametro}`;
    });
    const result = await request.query(`
      SELECT
        id_monitoreo,
        SUM(ISNULL(cantidad_bichos, 0)) AS total_bichos,
        SUM(CASE WHEN ISNULL(cantidad_bichos, 0) > 0 THEN 1 ELSE 0 END) AS posiciones_con_deteccion
      FROM dbo.MONI_DETALLEMONITOREO
      WHERE id_monitoreo IN (${placeholders.join(', ')})
      GROUP BY id_monitoreo
      OPTION (RECOMPILE)
    `);

    return new Map((result.recordset || []).map((detalle) => [
      detalle.id_monitoreo,
      {
        total_bichos: Number(detalle.total_bichos || 0),
        posiciones_con_deteccion: Number(detalle.posiciones_con_deteccion || 0),
      },
    ]));
  }

  obtenerBaseFiltradaHistorialChanchitos(filtros) {
    const necesitaUbicacion = Boolean(
      filtros.genFundo || filtros.genCampo || filtros.genVariedad || filtros.idCatalogoSdp
    );
    const joins = [];
    const condiciones = ['1 = 1'];

    if (necesitaUbicacion) {
      joins.push(`
        LEFT JOIN dbo.MONIPLA_CATALOGO_SDP_MB mbFiltro ON mbFiltro.id_catalogo_sdp = cab.id_catalogo_sdp
        LEFT JOIN dbo.GEN_CUARTEL gcFiltro ON gcFiltro.GEN_CUARTEL = cab.gen_cuartel
        LEFT JOIN dbo.GEN_FUNDO fFiltro ON fFiltro.Gen_Fundo = COALESCE(gcFiltro.GEN_FUNDO, cab.gen_fundo)
        LEFT JOIN dbo.GEN_CAMPO cFiltro ON cFiltro.Gen_Campo = COALESCE(gcFiltro.GEN_CAMPO, cab.gen_campo)
        LEFT JOIN dbo.GEN_VARIEDAD vFiltro ON vFiltro.gen_variedad = COALESCE(gcFiltro.GEN_VARIEDAD, cab.gen_variedad)
      `);
      if (filtros.genFundo) condiciones.push(`COALESCE(mbFiltro.gen_fundo, gcFiltro.GEN_FUNDO, cab.gen_fundo) = @genFundo`);
      if (filtros.genCampo) condiciones.push(`COALESCE(mbFiltro.gen_campo, gcFiltro.GEN_CAMPO, cab.gen_campo) = @genCampo`);
      if (filtros.genVariedad) condiciones.push(`COALESCE(mbFiltro.gen_variedad, gcFiltro.GEN_VARIEDAD, cab.gen_variedad) = @genVariedad`);
      if (filtros.idCatalogoSdp) condiciones.push(`(
        cab.id_catalogo_sdp = @idCatalogoSdp
        OR cab.codigo_cuartel = (SELECT cuartel FROM dbo.MONIPLA_CATALOGO_SDP_MB WHERE id_catalogo_sdp = @idCatalogoSdp)
        OR gcFiltro.CODIGO = (SELECT cuartel FROM dbo.MONIPLA_CATALOGO_SDP_MB WHERE id_catalogo_sdp = @idCatalogoSdp)
      )`);
    }

    if (filtros.idMonitoreador) {
      condiciones.push('cab.id_monitoreador = @idMonitoreador');
    }

    if (filtros.idEstadoFenologico) {
      condiciones.push('cab.id_estadofenologico = @idEstadoFenologico');
    }

    if (filtros.fechaDesde) condiciones.push('cab.fecha_monitoreo >= @fechaDesde');
    if (filtros.fechaHasta) condiciones.push('cab.fecha_monitoreo <= @fechaHasta');
    if (filtros.deteccion) {
      joins.push(`
        LEFT JOIN (
          SELECT
            detFiltro.id_monitoreo,
            MAX(CASE WHEN ISNULL(detFiltro.cantidad_bichos, 0) > 0 THEN 1 ELSE 0 END) AS tiene_deteccion
          FROM dbo.MONI_DETALLEMONITOREO detFiltro
          GROUP BY detFiltro.id_monitoreo
        ) deteccionFiltro ON deteccionFiltro.id_monitoreo = cab.id_monitoreo
      `);
    }

    if (filtros.deteccion === 'CON_DETECCION') {
      condiciones.push('ISNULL(deteccionFiltro.tiene_deteccion, 0) = 1');
    }
    if (filtros.deteccion === 'SIN_DETECCION') {
      condiciones.push('ISNULL(deteccionFiltro.tiene_deteccion, 0) = 0');
    }

    return `
      FROM dbo.MONI_CABECERAMONITOREO cab
      ${joins.join('\n')}
      WHERE ${condiciones.join('\n AND ')}
    `;
  }

  obtenerJoinsPresentacionHistorialChanchitos() {
    return `
      LEFT JOIN dbo.MONIPLA_CATALOGO_SDP_MB mb ON mb.id_catalogo_sdp = cab.id_catalogo_sdp
      OUTER APPLY (SELECT CAST(NULL AS nvarchar(100)) AS CODIGO, CAST(NULL AS int) AS GEN_FUNDO, CAST(NULL AS int) AS GEN_CAMPO, CAST(NULL AS int) AS GEN_VARIEDAD) gc
      OUTER APPLY (SELECT CAST(NULL AS nvarchar(100)) AS Nombre) f
      OUTER APPLY (SELECT CAST(NULL AS nvarchar(100)) AS Nombre) c
      OUTER APPLY (SELECT CAST(NULL AS nvarchar(100)) AS Nombre) v
      OUTER APPLY (SELECT CAST(NULL AS nvarchar(100)) AS sdp, CAST(NULL AS nvarchar(100)) AS csg, CAST(NULL AS nvarchar(100)) AS trazabilidad) rel
    `;
  }

  async insertarCabecera(catalogo, cabecera, transaction) {
    const agroclima = cabecera.agroclimaSnapshot || {};
    const request = await this.createRequest(transaction);
    const result = await request
      .input('genFundo', this.sql.Int, catalogo.gen_fundo)
      .input('genCampo', this.sql.Int, catalogo.gen_campo)
      .input('genVariedad', this.sql.Int, catalogo.gen_variedad)
      .input('codigoCuartel', this.sql.NVarChar(100), catalogo.cuartel)
      .input('sdp', this.sql.NVarChar(100), catalogo.sdp)
      .input('cantPlantas', this.sql.Int, cabecera.cantPlantas)
      .input('idUsuario', this.sql.Int, cabecera.idUsuario)
      .input('fechaMonitoreo', this.sql.Date, cabecera.fechaMonitoreo)
      .input('idEstadoFenologico', this.sql.Int, cabecera.idEstadoFenologico)
      .input('observaciones', this.sql.NVarChar(1000), cabecera.observaciones)
      .input('idMonitoreador', this.sql.Int, cabecera.idMonitoreador)
      .input('csg', this.sql.NVarChar(100), catalogo.codigo_sag)
      .input('idCatalogoSdp', this.sql.Int, catalogo.id_catalogo_sdp)
      .input('horasFrioAcumuladas', this.sql.Decimal(10, 2), agroclima.horasFrioAcumuladas ?? null)
      .input('diasGradoAcumulados', this.sql.Decimal(10, 2), agroclima.diasGradoAcumulados ?? null)
      .input('estacionMeteoUuid', this.sql.UniqueIdentifier, agroclima.estacionMeteoUuid || null)
      .input('nombreEstacionMeteo', this.sql.NVarChar(100), agroclima.nombreEstacionMeteo || null)
      .input('fechaCorteAgroclima', this.sql.Date, agroclima.fechaCorteAgroclima || null)
      .input('semanaIsoCorte', this.sql.TinyInt, agroclima.semanaIsoCorte ?? null)
      .input('temporadaAgroclima', this.sql.VarChar(9), agroclima.temporadaAgroclima || null)
      .input('agroclimaObservacion', this.sql.NVarChar(250), agroclima.agroclimaObservacion || null)
      .query(`
        INSERT INTO dbo.MONI_CABECERAMONITOREO (
          gen_fundo,
          gen_campo,
          gen_variedad,
          codigo_cuartel,
          gen_cuartel,
          sdp,
          cant_plantas,
          id_usuario,
          fecha_monitoreo,
          fecha_registro,
          id_estadofenologico,
          observaciones,
          imagenmonitoreo,
          codigo_sag,
          id_monitoreador,
          seg_imagenmonitoreo,
          terc_imagenmonitoreo,
          CSG,
          id_catalogo_sdp,
          horas_frio_acumuladas,
          dias_grado_acumulados,
          estacion_meteo_uuid,
          nombre_estacion_meteo,
          fecha_corte_agroclima,
          semana_iso_corte,
          temporada_agroclima,
          agroclima_observacion
        )
        OUTPUT INSERTED.id_monitoreo
        VALUES (
          @genFundo,
          @genCampo,
          @genVariedad,
          @codigoCuartel,
          NULL,
          @sdp,
          @cantPlantas,
          @idUsuario,
          @fechaMonitoreo,
          SYSDATETIME(),
          @idEstadoFenologico,
          @observaciones,
          NULL,
          NULL,
          @idMonitoreador,
          NULL,
          NULL,
          @csg,
          @idCatalogoSdp,
          @horasFrioAcumuladas,
          @diasGradoAcumulados,
          @estacionMeteoUuid,
          @nombreEstacionMeteo,
          @fechaCorteAgroclima,
          @semanaIsoCorte,
          @temporadaAgroclima,
          @agroclimaObservacion
        )
      `);

    return result.recordset[0] || null;
  }

  async insertarDetalles(idMonitoreo, detalles, transaction) {
    let insertados = 0;

    for (const detalle of detalles) {
      const request = await this.createRequest(transaction);
      const result = await request
        .input('idMonitoreo', this.sql.Int, idMonitoreo)
        .input('idEstadoMonitoreo', this.sql.Int, detalle.idEstadoMonitoreo)
        .input('idEstadoPosicion', this.sql.Int, detalle.idEstadoPosicion)
        .input('cantidadBichos', this.sql.Int, detalle.cantidadBichos)
        .query(`
          INSERT INTO dbo.MONI_DETALLEMONITOREO (
            id_monitoreo,
            id_estadomonitoreo,
            id_estadoposicion,
            cantidad_bichos
          )
          VALUES (
            @idMonitoreo,
            @idEstadoMonitoreo,
            @idEstadoPosicion,
            @cantidadBichos
          )
        `);

      insertados += Number(result.rowsAffected && result.rowsAffected[0] || 0);
    }

    return insertados;
  }

  async crearMonitoreoTransaccional(data) {
    const pool = await this.poolPromise;
    const transaction = new this.sql.Transaction(pool);
    let transactionStarted = false;

    try {
      await transaction.begin();
      transactionStarted = true;

      const catalogoRevalidado = await data.revalidarCatalogoSdp(transaction);
      const catalogo = this.normalizarCatalogoParaCabecera(catalogoRevalidado);
      await data.revalidarMonitoreador(transaction);
      await data.revalidarEstadoFenologico(transaction);

      const cabecera = await this.insertarCabecera(catalogo, data.cabecera, transaction);

      if (!cabecera || !cabecera.id_monitoreo) {
        throw new Error('ID_MONITOREO_NO_GENERADO');
      }

      if (!Array.isArray(data.detalles) || data.detalles.length !== 12) {
        throw new Error('MATRIZ_CHANCHITOS_INVALIDA');
      }

      const detallesInsertados = await this.insertarDetalles(
        cabecera.id_monitoreo,
        data.detalles,
        transaction
      );

      if (detallesInsertados !== 12) {
        throw new Error('DETALLES_CHANCHITOS_INCOMPLETOS');
      }

      await transaction.commit();

      return {
        id_monitoreo: cabecera.id_monitoreo,
        detalles_insertados: detallesInsertados,
      };
    } catch (error) {
      if (transactionStarted) {
        await transaction.rollback();
      }

      throw error;
    }
  }

  async createRequest(transaction = null) {
    if (transaction) {
      return new this.sql.Request(transaction);
    }

    const pool = await this.poolPromise;
    return pool.request();
  }

  normalizarCatalogoParaCabecera(catalogo) {
    if (!catalogo || typeof catalogo !== 'object') {
      throw new Error('CATALOGO_SDP_MB_TEXTO_INVALIDO');
    }

    return {
      ...catalogo,
      sdp: this.normalizarTextoRequerido(catalogo.sdp),
      cuartel: this.normalizarTextoOpcional(catalogo.cuartel),
      codigo_sag: this.normalizarTextoOpcional(catalogo.codigo_sag),
    };
  }

  normalizarTextoRequerido(valor) {
    const normalizado = this.normalizarTextoOpcional(valor);

    if (normalizado === null) {
      throw new Error('CATALOGO_SDP_MB_TEXTO_INVALIDO');
    }

    return normalizado;
  }

  normalizarTextoOpcional(valor) {
    if (valor === null || valor === undefined) {
      return null;
    }

    if (!['string', 'number', 'bigint'].includes(typeof valor)) {
      throw new Error('CATALOGO_SDP_MB_TEXTO_INVALIDO');
    }

    const normalizado = String(valor).trim();

    if (normalizado === '') {
      return null;
    }

    if (['null', 'undefined', '[object object]'].includes(normalizado.toLowerCase())) {
      throw new Error('CATALOGO_SDP_MB_TEXTO_INVALIDO');
    }

    return normalizado;
  }
}

module.exports = ChanchitosRepository;
