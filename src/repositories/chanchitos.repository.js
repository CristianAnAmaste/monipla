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
    const pool = await this.poolPromise;
    const result = await pool.request()
      .input('fechaDesde', this.sql.Date, filtros.fechaDesde || null)
      .input('fechaHasta', this.sql.Date, filtros.fechaHasta || null)
      .query(`
        SELECT
          cab.id_monitoreo,
          cab.fecha_monitoreo,
          cab.gen_cuartel,
          cab.id_catalogo_sdp,
          COALESCE(
            LTRIM(RTRIM(CONVERT(nvarchar(100), cab.codigo_cuartel))),
            LTRIM(RTRIM(CONVERT(nvarchar(100), gc.CODIGO))),
            LTRIM(RTRIM(CONVERT(nvarchar(100), mb.cuartel)))
          ) AS codigo_cuartel,
          COALESCE(LTRIM(RTRIM(mb.fundo)), LTRIM(RTRIM(f.Nombre))) AS nombre_fundo,
          COALESCE(LTRIM(RTRIM(mb.nombre_productor)), LTRIM(RTRIM(c.Nombre))) AS nombre_campo,
          COALESCE(LTRIM(RTRIM(mb.variedad)), LTRIM(RTRIM(v.Nombre))) AS nombre_variedad,
          COALESCE(
            CONVERT(nvarchar(100), cab.sdp),
            CONVERT(nvarchar(100), rel.sdp),
            CONVERT(nvarchar(100), mb.sdp)
          ) AS sdp,
          COALESCE(
            CONVERT(nvarchar(100), cab.CSG),
            CONVERT(nvarchar(100), rel.csg),
            CONVERT(nvarchar(100), mb.codigo_sag)
          ) AS csg,
          COALESCE(
            CONVERT(nvarchar(100), mb.codigo_trazabilidad),
            CONVERT(nvarchar(100), rel.trazabilidad)
          ) AS trazabilidad,
          LTRIM(RTRIM(ISNULL(ef.nom_estadofenologico, ''))) AS nombre_estado_fenologico,
          cab.cant_plantas,
          LTRIM(RTRIM(ISNULL(mon.nombre_monitoreador, ''))) AS nombre_monitoreador,
          cab.observaciones,
          det.id_estadomonitoreo,
          det.id_estadoposicion,
          det.cantidad_bichos
        FROM dbo.MONI_CABECERAMONITOREO cab
        LEFT JOIN dbo.MONI_DETALLEMONITOREO det
          ON det.id_monitoreo = cab.id_monitoreo
        LEFT JOIN dbo.MONI_MONITOREADORES mon
          ON mon.id_monitoreador = cab.id_monitoreador
        LEFT JOIN dbo.estado_fenologico ef
          ON ef.id_estadofenologico = cab.id_estadofenologico
        LEFT JOIN dbo.MONIPLA_CATALOGO_SDP_MB mb
          ON mb.id_catalogo_sdp = cab.id_catalogo_sdp
        LEFT JOIN dbo.GEN_CUARTEL gc
          ON gc.GEN_CUARTEL = cab.gen_cuartel
        LEFT JOIN dbo.GEN_FUNDO f
          ON f.Gen_Fundo = COALESCE(gc.GEN_FUNDO, cab.gen_fundo)
        LEFT JOIN dbo.GEN_CAMPO c
          ON c.Gen_Campo = COALESCE(gc.GEN_CAMPO, cab.gen_campo)
        LEFT JOIN dbo.GEN_VARIEDAD v
          ON v.gen_variedad = COALESCE(gc.GEN_VARIEDAD, cab.gen_variedad)
        LEFT JOIN dbo.MONIPLA_REL_CUARTEL_SDP rel
          ON rel.gen_cuartel = cab.gen_cuartel
        WHERE (@fechaDesde IS NULL OR cab.fecha_monitoreo >= @fechaDesde)
          AND (@fechaHasta IS NULL OR cab.fecha_monitoreo <= @fechaHasta)
        ORDER BY
          cab.fecha_monitoreo DESC,
          cab.id_monitoreo DESC,
          det.id_estadomonitoreo ASC,
          det.id_estadoposicion ASC
      `);

    return result.recordset;
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
