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

  async insertarCabecera(catalogo, cabecera, transaction) {
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
          id_catalogo_sdp
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
          @idCatalogoSdp
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
