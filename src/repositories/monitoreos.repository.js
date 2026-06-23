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

  async buscarOrigenMuestra(origen, transaction = null) {
    const request = await this.createRequest(transaction);

    const result = await request
      .input('genCuartel', sql.SmallInt, origen.genCuartel)
      .input('genVariedadCampo', sql.SmallInt, origen.genVariedadCampo || null)
      .input('idRelCuartelSdp', sql.Int, origen.idRelCuartelSdp || null)
      .query(`
        SELECT TOP 1
          id_origen_muestra
        FROM dbo.MONIPLA_ORIGEN_MUESTRA WITH (UPDLOCK, HOLDLOCK)
        WHERE gen_cuartel = @genCuartel
          AND (
            gen_variedad_campo = @genVariedadCampo
            OR (gen_variedad_campo IS NULL AND @genVariedadCampo IS NULL)
          )
          AND (
            id_rel_cuartel_sdp = @idRelCuartelSdp
            OR (id_rel_cuartel_sdp IS NULL AND @idRelCuartelSdp IS NULL)
          )
      `);

    return result.recordset[0] || null;
  }

  async crearOrigenMuestra(origen, transaction = null) {
    const request = await this.createRequest(transaction);

    const result = await request
      .input('genCuartel', sql.SmallInt, origen.genCuartel)
      .input('genVariedadCampo', sql.SmallInt, origen.genVariedadCampo || null)
      .input('idRelCuartelSdp', sql.Int, origen.idRelCuartelSdp || null)
      .query(`
        INSERT INTO dbo.MONIPLA_ORIGEN_MUESTRA (
          gen_cuartel,
          gen_variedad_campo,
          id_rel_cuartel_sdp,
          activo,
          fecha_creacion
        )
        OUTPUT INSERTED.id_origen_muestra
        VALUES (
          @genCuartel,
          @genVariedadCampo,
          @idRelCuartelSdp,
          1,
          SYSDATETIME()
        )
      `);

    return result.recordset[0];
  }

  async obtenerSiguienteNumeroMuestreo(transaction) {
    const request = await this.createRequest(transaction);

    const result = await request.query(`
      SELECT ISNULL(MAX(numero_muestreo), 0) + 1 AS siguiente_numero
      FROM dbo.MONIPLA_MUESTREO WITH (UPDLOCK, HOLDLOCK)
    `);

    return result.recordset[0].siguiente_numero;
  }

  async crearMuestreo(data, transaction = null) {
    const request = await this.createRequest(transaction);

    const result = await request
      .input('numeroMuestreo', sql.Int, data.numeroMuestreo)
      .input('idOrigenMuestra', sql.Int, data.idOrigenMuestra)
      .input('fechaMuestreo', sql.Date, data.fechaMuestreo)
      .input('fechaRevisionMuestra', sql.Date, data.fechaRevisionMuestra)
      .input('idEstructura', sql.Int, data.idEstructura)
      .input('cantUnidadesMuestreadas', sql.Int, null)
      .input('observacionGeneral', sql.VarChar(500), data.observacionGeneral || null)
      .input('idUsuarioCreacion', sql.Int, data.idUsuarioCreacion)
      .input('fechaSolicitudMuestra', sql.Date, data.fechaSolicitudMuestra)
      .input('fechaRecepcionMuestra', sql.Date, data.fechaRecepcionMuestra)
      .query(`
        INSERT INTO dbo.MONIPLA_MUESTREO (
          numero_muestreo,
          id_origen_muestra,
          fecha_muestreo,
          fecha_revision_muestra,
          id_estructura,
          cant_unidades_muestreadas,
          observacion_general,
          id_usuario_creacion,
          estado_resultado,
          fecha_creacion,
          fecha_modificacion,
          fecha_solicitud_muestra,
          fecha_recepcion_muestra
        )
        OUTPUT
          INSERTED.id_muestreo,
          INSERTED.numero_muestreo
        VALUES (
          @numeroMuestreo,
          @idOrigenMuestra,
          @fechaMuestreo,
          @fechaRevisionMuestra,
          @idEstructura,
          @cantUnidadesMuestreadas,
          @observacionGeneral,
          @idUsuarioCreacion,
          'PENDIENTE',
          SYSDATETIME(),
          NULL,
          @fechaSolicitudMuestra,
          @fechaRecepcionMuestra
        )
      `);

    return result.recordset[0];
  }

  async crearCabeceraMonitoreoTransaccional(data) {
    const pool = await poolPromise;
    const transaction = new sql.Transaction(pool);
    let transactionStarted = false;

    try {
      await transaction.begin();
      transactionStarted = true;

      let origenMuestra = await this.buscarOrigenMuestra(data.origen, transaction);

      if (!origenMuestra) {
        origenMuestra = await this.crearOrigenMuestra(data.origen, transaction);
      }

      const numeroMuestreo = await this.obtenerSiguienteNumeroMuestreo(transaction);
      const muestreo = await this.crearMuestreo(
        {
          ...data.muestreo,
          idOrigenMuestra: origenMuestra.id_origen_muestra,
          numeroMuestreo,
        },
        transaction
      );

      await transaction.commit();

      return {
        id_origen_muestra: origenMuestra.id_origen_muestra,
        id_muestreo: muestreo.id_muestreo,
        numero_muestreo: muestreo.numero_muestreo,
      };
    } catch (error) {
      if (transactionStarted) {
        await transaction.rollback();
      }

      throw error;
    }
  }

  async obtenerMuestreoPorId(idMuestreo, transaction = null) {
    const request = await this.createRequest(transaction);

    const result = await request
      .input('idMuestreo', sql.Int, idMuestreo)
      .query(`
        SELECT TOP 1
          m.id_muestreo,
          m.numero_muestreo,
          m.fecha_revision_muestra,
          m.fecha_solicitud_muestra,
          m.fecha_recepcion_muestra,
          m.observacion_general,
          m.estado_resultado,
          m.observacion_resultado,
          m.fecha_resultado,
          m.id_usuario_resultado,
          e.id_estructura,
          LTRIM(RTRIM(e.nombre_estructura)) AS nombre_estructura,
          om.id_origen_muestra,
          gc.GEN_CUARTEL AS gen_cuartel,
          LTRIM(RTRIM(gc.CODIGO)) AS codigo_cuartel,
          LTRIM(RTRIM(f.Nombre)) AS nombre_fundo,
          LTRIM(RTRIM(c.Nombre)) AS nombre_campo,
          LTRIM(RTRIM(v.Nombre)) AS nombre_variedad,
          rel.sdp,
          rel.csg,
          rel.trazabilidad
        FROM dbo.MONIPLA_MUESTREO m
        INNER JOIN dbo.MONIPLA_ORIGEN_MUESTRA om
          ON om.id_origen_muestra = m.id_origen_muestra
        INNER JOIN dbo.GEN_CUARTEL gc
          ON gc.GEN_CUARTEL = om.gen_cuartel
        INNER JOIN dbo.GEN_FUNDO f
          ON f.Gen_Fundo = gc.GEN_FUNDO
        INNER JOIN dbo.GEN_CAMPO c
          ON c.Gen_Campo = gc.GEN_CAMPO
        INNER JOIN dbo.GEN_VARIEDAD v
          ON v.gen_variedad = gc.GEN_VARIEDAD
        INNER JOIN dbo.MONIPLA_ESTRUCTURA e
          ON e.id_estructura = m.id_estructura
        LEFT JOIN dbo.MONIPLA_REL_CUARTEL_SDP rel
          ON rel.id_rel_cuartel_sdp = om.id_rel_cuartel_sdp
        WHERE m.id_muestreo = @idMuestreo
      `);

    return result.recordset[0] || null;
  }

  async bloquearMuestreoParaResultados(idMuestreo, transaction) {
    const request = await this.createRequest(transaction);

    const result = await request
      .input('idMuestreo', sql.Int, idMuestreo)
      .query(`
        SELECT TOP 1
          id_muestreo,
          numero_muestreo,
          estado_resultado
        FROM dbo.MONIPLA_MUESTREO WITH (UPDLOCK, HOLDLOCK)
        WHERE id_muestreo = @idMuestreo
      `);

    return result.recordset[0] || null;
  }

  async marcarMuestreoSinPlagas(data, transaction) {
    const request = await this.createRequest(transaction);

    console.info('[MONIPLA][RESULTADOS][TX_UPDATE_SIN_PLAGAS]', {
      idMuestreo: data.idMuestreo,
      idUsuarioResultado: data.idUsuarioResultado,
    });

    await request
      .input('idMuestreo', sql.Int, data.idMuestreo)
      .input('observacionResultado', sql.VarChar(500), data.observacionResultado || null)
      .input('idUsuarioResultado', sql.Int, data.idUsuarioResultado)
      .query(`
        UPDATE dbo.MONIPLA_MUESTREO
        SET
          estado_resultado = 'SIN_PLAGAS',
          observacion_resultado = @observacionResultado,
          fecha_resultado = SYSDATETIME(),
          id_usuario_resultado = @idUsuarioResultado,
          fecha_modificacion = SYSDATETIME()
        WHERE id_muestreo = @idMuestreo
      `);
  }

  async marcarMuestreoConPlagas(data, transaction) {
    const request = await this.createRequest(transaction);

    console.info('[MONIPLA][RESULTADOS][TX_UPDATE_CON_PLAGAS]', {
      idMuestreo: data.idMuestreo,
      idUsuarioResultado: data.idUsuarioResultado,
    });

    await request
      .input('idMuestreo', sql.Int, data.idMuestreo)
      .input('idUsuarioResultado', sql.Int, data.idUsuarioResultado)
      .query(`
        UPDATE dbo.MONIPLA_MUESTREO
        SET
          estado_resultado = 'CON_PLAGAS',
          observacion_resultado = NULL,
          fecha_resultado = SYSDATETIME(),
          id_usuario_resultado = @idUsuarioResultado,
          fecha_modificacion = SYSDATETIME()
        WHERE id_muestreo = @idMuestreo
      `);
  }

  async listarPlagasActivas() {
    const pool = await poolPromise;

    const result = await pool.request().query(`
      SELECT
        id_plaga AS value,
        LTRIM(RTRIM(nombre_plaga)) AS label,
        LTRIM(RTRIM(ISNULL(nombre_cientifico, ''))) AS nombre_cientifico,
        tipo_registro,
        es_cuarentenaria
      FROM dbo.MONIPLA_PLAGA
      WHERE activo = 1
      ORDER BY nombre_plaga ASC
    `);

    return result.recordset;
  }

  async listarEstadiosActivos() {
    const pool = await poolPromise;

    const result = await pool.request().query(`
      SELECT
        id_estadio AS value,
        LTRIM(RTRIM(nombre_estadio)) AS label
      FROM dbo.MONIPLA_ESTADIO
      WHERE activo = 1
      ORDER BY id_estadio ASC
    `);

    return result.recordset;
  }

  async listarEstadosActivos() {
    const pool = await poolPromise;

    const result = await pool.request().query(`
      SELECT
        id_estado_ejemplar AS value,
        LTRIM(RTRIM(nombre_estado)) AS label
      FROM dbo.MONIPLA_ESTADO_EJEMPLAR
      WHERE activo = 1
      ORDER BY id_estado_ejemplar ASC
    `);

    return result.recordset;
  }

  async crearResultadoPlaga(data, transaction) {
    const request = await this.createRequest(transaction);

    console.info('[MONIPLA][RESULTADOS][TX_INSERT_PLAGA]', {
      idMuestreo: data.idMuestreo,
      idPlaga: data.idPlaga,
      cantidadTotal: data.cantidadTotal,
    });

    const result = await request
      .input('idMuestreo', sql.Int, data.idMuestreo)
      .input('idPlaga', sql.Int, data.idPlaga)
      .input('detalleTexto', sql.VarChar(500), data.detalleTexto || null)
      .input('cantidadTotal', sql.Int, data.cantidadTotal)
      .input('observacion', sql.VarChar(500), data.observacion || null)
      .query(`
        INSERT INTO dbo.MONIPLA_RESULTADO_PLAGA (
          id_muestreo,
          id_plaga,
          detalle_texto,
          cantidad_total,
          observacion,
          fecha_creacion
        )
        OUTPUT INSERTED.id_resultado_plaga
        VALUES (
          @idMuestreo,
          @idPlaga,
          @detalleTexto,
          @cantidadTotal,
          @observacion,
          SYSDATETIME()
        )
      `);

    return result.recordset[0];
  }

  async crearResultadoConteo(data, transaction) {
    const request = await this.createRequest(transaction);

    console.info('[MONIPLA][RESULTADOS][TX_INSERT_CONTEO]', {
      idResultadoPlaga: data.idResultadoPlaga,
      idEstadio: data.idEstadio,
      idEstadoEjemplar: data.idEstadoEjemplar,
      cantidad: data.cantidad,
    });

    const result = await request
      .input('idResultadoPlaga', sql.Int, data.idResultadoPlaga)
      .input('idEstadio', sql.Int, data.idEstadio)
      .input('idEstadoEjemplar', sql.Int, data.idEstadoEjemplar)
      .input('cantidad', sql.Int, data.cantidad)
      .query(`
        INSERT INTO dbo.MONIPLA_RESULTADO_CONTEO (
          id_resultado_plaga,
          id_estadio,
          id_estado_ejemplar,
          cantidad,
          fecha_creacion
        )
        OUTPUT INSERTED.id_resultado_conteo
        VALUES (
          @idResultadoPlaga,
          @idEstadio,
          @idEstadoEjemplar,
          @cantidad,
          SYSDATETIME()
        )
      `);

    return result.recordset[0];
  }

  async guardarResultadosMuestreoTransaccional(idMuestreo, plagas, metadata) {
    const pool = await poolPromise;
    const transaction = new sql.Transaction(pool);
    let transactionStarted = false;

    try {
      console.info('[MONIPLA][RESULTADOS][TX_BEGIN]', {
        idMuestreo,
        modo: 'CON_PLAGAS',
      });

      await transaction.begin();
      transactionStarted = true;

      const muestreo = await this.bloquearMuestreoParaResultados(idMuestreo, transaction);

      if (!muestreo) {
        throw new Error('MUESTREO_NO_EXISTE');
      }

      if (muestreo.estado_resultado !== 'PENDIENTE') {
        throw new Error('RESULTADOS_YA_REGISTRADOS');
      }

      const resultados = [];

      for (const plaga of plagas) {
        const resultadoPlaga = await this.crearResultadoPlaga(
          {
            idMuestreo,
            idPlaga: plaga.idPlaga,
            detalleTexto: plaga.detalleTexto,
            cantidadTotal: plaga.cantidadTotal,
            observacion: plaga.observacion,
          },
          transaction
        );

        const conteos = [];

        for (const conteo of plaga.conteos) {
          const resultadoConteo = await this.crearResultadoConteo(
            {
              idResultadoPlaga: resultadoPlaga.id_resultado_plaga,
              idEstadio: conteo.idEstadio,
              idEstadoEjemplar: conteo.idEstadoEjemplar,
              cantidad: conteo.cantidad,
            },
            transaction
          );

          conteos.push(resultadoConteo.id_resultado_conteo);
        }

        resultados.push({
          id_resultado_plaga: resultadoPlaga.id_resultado_plaga,
          conteos,
        });
      }

      await this.marcarMuestreoConPlagas(
        {
          idMuestreo,
          idUsuarioResultado: metadata.idUsuarioResultado,
        },
        transaction
      );

      await transaction.commit();

      console.info('[MONIPLA][RESULTADOS][TX_COMMIT]', {
        idMuestreo,
        estadoResultado: 'CON_PLAGAS',
      });

      return {
        id_muestreo: muestreo.id_muestreo,
        numero_muestreo: muestreo.numero_muestreo,
        resultados,
      };
    } catch (error) {
      if (transactionStarted) {
        await transaction.rollback();
      }

      console.error('[MONIPLA][RESULTADOS][TX_ROLLBACK]', {
        idMuestreo,
        error: error.message,
        stack: process.env.NODE_ENV === 'development' ? error.stack : undefined,
      });

      throw error;
    }
  }

  async guardarSinPlagasMuestreoTransaccional(idMuestreo, data) {
    const pool = await poolPromise;
    const transaction = new sql.Transaction(pool);
    let transactionStarted = false;

    try {
      console.info('[MONIPLA][RESULTADOS][TX_BEGIN]', {
        idMuestreo,
        modo: 'SIN_PLAGAS',
      });

      await transaction.begin();
      transactionStarted = true;

      const muestreo = await this.bloquearMuestreoParaResultados(idMuestreo, transaction);

      if (!muestreo) {
        throw new Error('MUESTREO_NO_EXISTE');
      }

      if (muestreo.estado_resultado !== 'PENDIENTE') {
        throw new Error('RESULTADOS_YA_REGISTRADOS');
      }

      await this.marcarMuestreoSinPlagas(
        {
          idMuestreo,
          observacionResultado: data.observacionResultado,
          idUsuarioResultado: data.idUsuarioResultado,
        },
        transaction
      );

      await transaction.commit();

      console.info('[MONIPLA][RESULTADOS][TX_COMMIT]', {
        idMuestreo,
        estadoResultado: 'SIN_PLAGAS',
      });

      return {
        id_muestreo: muestreo.id_muestreo,
        numero_muestreo: muestreo.numero_muestreo,
      };
    } catch (error) {
      if (transactionStarted) {
        await transaction.rollback();
      }

      console.error('[MONIPLA][RESULTADOS][TX_ROLLBACK]', {
        idMuestreo,
        error: error.message,
        stack: process.env.NODE_ENV === 'development' ? error.stack : undefined,
      });

      throw error;
    }
  }

  async createRequest(transaction = null) {
    if (transaction) {
      return new sql.Request(transaction);
    }

    const pool = await poolPromise;
    return pool.request();
  }
}

module.exports = MonitoreosRepository;
