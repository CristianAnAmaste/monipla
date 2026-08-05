const { poolPromise, sql } = require('../config/db');

class MonitoreosRepository {
  async findFondosDisponibles() {
    const pool = await poolPromise;

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
    const pool = await poolPromise;

    const result = await pool
      .request()
      .input('genFundo', sql.Int, genFundo)
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
    const pool = await poolPromise;

    const result = await pool
      .request()
      .input('genFundo', sql.Int, genFundo)
      .input('genCampo', sql.Int, genCampo)
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
    const pool = await poolPromise;

    const result = await pool
      .request()
      .input('genFundo', sql.Int, genFundo)
      .input('genCampo', sql.Int, genCampo)
      .input('genVariedad', sql.Int, genVariedad)
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

  async findLugaresMuestraActivos() {
    const pool = await poolPromise;

    const result = await pool.request().query(`
      SELECT
        id_lugar_muestra AS value,
        LTRIM(RTRIM(nombre_lugar_muestra)) AS label
      FROM dbo.MONIPLA_LUGAR_MUESTRA
      WHERE activo = 1
      ORDER BY id_lugar_muestra ASC
    `);

    return result.recordset;
  }

  async findEstadosFenologicosActivos() {
    const pool = await poolPromise;

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

  async findMuestreadoresActivos() {
    const pool = await poolPromise;

    const result = await pool.request().query(`
      SELECT
        id_muestrador AS value,
        LTRIM(RTRIM(nombre_muestrador)) AS label
      FROM dbo.MONIPLA_MUESTRADOR
      WHERE activo = 1
      ORDER BY nombre_muestrador ASC
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

  async findLugarMuestraById(idLugarMuestra) {
    const pool = await poolPromise;

    const result = await pool
      .request()
      .input('idLugarMuestra', sql.Int, idLugarMuestra)
      .query(`
        SELECT TOP 1
          id_lugar_muestra,
          nombre_lugar_muestra,
          activo
        FROM dbo.MONIPLA_LUGAR_MUESTRA
        WHERE id_lugar_muestra = @idLugarMuestra
      `);

    return result.recordset[0] || null;
  }

  async findEstadoFenologicoById(idEstadoFenologico) {
    const pool = await poolPromise;

    const result = await pool
      .request()
      .input('idEstadoFenologico', sql.Int, idEstadoFenologico)
      .query(`
        SELECT TOP 1
          id_estadofenologico,
          nom_estadofenologico,
          estado
        FROM dbo.estado_fenologico
        WHERE id_estadofenologico = @idEstadoFenologico
      `);

    return result.recordset[0] || null;
  }

  async findMuestreadorById(idMuestreador) {
    const pool = await poolPromise;

    const result = await pool
      .request()
      .input('idMuestreador', sql.Int, idMuestreador)
      .query(`
        SELECT TOP 1
          id_muestrador,
          nombre_muestrador,
          activo
        FROM dbo.MONIPLA_MUESTRADOR
        WHERE id_muestrador = @idMuestreador
      `);

    return result.recordset[0] || null;
  }

  async findCatalogoSdpMbById(idCatalogoSdp, transaction = null) {
    const request = await this.createRequest(transaction);

    const result = await request
      .input('idCatalogoSdp', sql.Int, idCatalogoSdp)
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
          codigo_sag,
          codigo_trazabilidad
        FROM dbo.MONIPLA_CATALOGO_SDP_MB
        WHERE id_catalogo_sdp = @idCatalogoSdp
          AND activo = 1
          AND sdp IS NOT NULL
      `);

    return result.recordset;
  }

  async buscarOrigenMuestra(origen, transaction = null) {
    const request = await this.createRequest(transaction);

    const result = await request
      .input('idCatalogoSdp', sql.Int, origen.idCatalogoSdp)
      .query(`
        SELECT TOP 1
          id_origen_muestra
        FROM dbo.MONIPLA_ORIGEN_MUESTRA WITH (UPDLOCK, HOLDLOCK)
        WHERE id_catalogo_sdp = @idCatalogoSdp
      `);

    return result.recordset[0] || null;
  }

  async crearOrigenMuestra(origen, transaction = null) {
    const request = await this.createRequest(transaction);

    const result = await request
      .input('idCatalogoSdp', sql.Int, origen.idCatalogoSdp)
      .query(`
        INSERT INTO dbo.MONIPLA_ORIGEN_MUESTRA (
          gen_cuartel,
          gen_variedad_campo,
          id_rel_cuartel_sdp,
          id_catalogo_sdp,
          activo,
          fecha_creacion
        )
        OUTPUT INSERTED.id_origen_muestra
        VALUES (
          NULL,
          NULL,
          NULL,
          @idCatalogoSdp,
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
    const agroclima = data.agroclimaSnapshot || {};

    const result = await request
      .input('numeroMuestreo', sql.Int, data.numeroMuestreo)
      .input('idOrigenMuestra', sql.Int, data.idOrigenMuestra)
      .input('fechaMuestreo', sql.Date, data.fechaMuestreo)
      .input('fechaRevisionMuestra', sql.Date, data.fechaRevisionMuestra)
      .input('idEstructura', sql.Int, data.idEstructura)
      .input('idLugarMuestra', sql.Int, data.idLugarMuestra)
      .input('cantUnidadesMuestreadas', sql.Int, null)
      .input('observacionGeneral', sql.VarChar(500), data.observacionGeneral || null)
      .input('idUsuarioCreacion', sql.Int, data.idUsuarioCreacion)
      .input('fechaSolicitudMuestra', sql.Date, data.fechaSolicitudMuestra)
      .input('fechaRecepcionMuestra', sql.Date, data.fechaRecepcionMuestra)
      .input('idMuestreador', sql.Int, data.idMuestreador)
      .input('idEstadoFenologico', sql.Int, data.idEstadoFenologico)
      .input('horasFrioAcumuladas', sql.Decimal(10, 2), agroclima.horasFrioAcumuladas ?? null)
      .input('diasGradoAcumulados', sql.Decimal(10, 2), agroclima.diasGradoAcumulados ?? null)
      .input('estacionMeteoUuid', sql.UniqueIdentifier, agroclima.estacionMeteoUuid || null)
      .input('nombreEstacionMeteo', sql.NVarChar(100), agroclima.nombreEstacionMeteo || null)
      .input('fechaCorteAgroclima', sql.Date, agroclima.fechaCorteAgroclima || null)
      .input('semanaIsoCorte', sql.TinyInt, agroclima.semanaIsoCorte ?? null)
      .input('temporadaAgroclima', sql.VarChar(9), agroclima.temporadaAgroclima || null)
      .input('agroclimaObservacion', sql.NVarChar(250), agroclima.agroclimaObservacion || null)
      .query(`
        INSERT INTO dbo.MONIPLA_MUESTREO (
          numero_muestreo,
          id_origen_muestra,
          fecha_muestreo,
          fecha_revision_muestra,
          id_estructura,
          id_lugar_muestra,
          cant_unidades_muestreadas,
          observacion_general,
          id_usuario_creacion,
          estado_resultado,
          fecha_creacion,
          fecha_modificacion,
          fecha_solicitud_muestra,
          fecha_recepcion_muestra,
          id_muestrador,
          id_estadofenologico,
          horas_frio_acumuladas,
          dias_grado_acumulados,
          estacion_meteo_uuid,
          nombre_estacion_meteo,
          fecha_corte_agroclima,
          semana_iso_corte,
          temporada_agroclima,
          agroclima_observacion
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
          @idLugarMuestra,
          @cantUnidadesMuestreadas,
          @observacionGeneral,
          @idUsuarioCreacion,
          'PENDIENTE',
          SYSDATETIME(),
          NULL,
          @fechaSolicitudMuestra,
          @fechaRecepcionMuestra,
          @idMuestreador,
          @idEstadoFenologico,
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

    return result.recordset[0];
  }

  async crearCabeceraMonitoreoTransaccional(data) {
    const pool = await poolPromise;
    const transaction = new sql.Transaction(pool);
    let transactionStarted = false;

    try {
      await transaction.begin();
      transactionStarted = true;

      const catalogos = await this.findCatalogoSdpMbById(data.idCatalogoSdp, transaction);

      if (catalogos.length === 0) {
        throw new Error('CATALOGO_SDP_MB_NO_DISPONIBLE');
      }

      if (catalogos.length !== 1) {
        throw new Error('CATALOGO_SDP_MB_NO_CANONICO');
      }

      const catalogo = catalogos[0];
      const seleccionInconsistente = Number(catalogo.gen_fundo) !== data.seleccion.genFundo
        || Number(catalogo.gen_campo) !== data.seleccion.genCampo
        || Number(catalogo.gen_variedad) !== data.seleccion.genVariedad;

      if (seleccionInconsistente) {
        throw new Error('CATALOGO_SDP_MB_SELECCION_INVALIDA');
      }

      let origenMuestra = await this.buscarOrigenMuestra(data.origen, transaction);

      if (!origenMuestra) {
        origenMuestra = await this.crearOrigenMuestra(data.origen, transaction);
      }

      const numeroMuestreo = await this.obtenerSiguienteNumeroMuestreo(transaction);
      const agroclimaSnapshot = typeof data.calcularAgroclimaSnapshot === 'function'
        ? await data.calcularAgroclimaSnapshot(origenMuestra.id_origen_muestra, transaction)
        : null;
      const muestreo = await this.crearMuestreo(
        {
          ...data.muestreo,
          idOrigenMuestra: origenMuestra.id_origen_muestra,
          numeroMuestreo,
          agroclimaSnapshot,
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
          m.horas_frio_acumuladas,
          m.dias_grado_acumulados,
          m.estacion_meteo_uuid,
          LTRIM(RTRIM(ISNULL(m.nombre_estacion_meteo, ''))) AS nombre_estacion_meteo,
          m.fecha_corte_agroclima,
          m.semana_iso_corte,
          m.temporada_agroclima,
          m.agroclima_observacion,
          e.id_estructura,
          LTRIM(RTRIM(e.nombre_estructura)) AS nombre_estructura,
          m.id_lugar_muestra,
          LTRIM(RTRIM(lm.nombre_lugar_muestra)) AS nombre_lugar_muestra,
          om.id_origen_muestra,
          om.id_catalogo_sdp,
          gc.GEN_CUARTEL AS gen_cuartel,
          COALESCE(LTRIM(RTRIM(gc.CODIGO)), LTRIM(RTRIM(mb.cuartel))) AS codigo_cuartel,
          COALESCE(LTRIM(RTRIM(f.Nombre)), LTRIM(RTRIM(mb.fundo))) AS nombre_fundo,
          COALESCE(LTRIM(RTRIM(c.Nombre)), LTRIM(RTRIM(mb.nombre_productor))) AS nombre_campo,
          COALESCE(LTRIM(RTRIM(v.Nombre)), LTRIM(RTRIM(mb.variedad))) AS nombre_variedad,
          COALESCE(rel.sdp, mb.sdp) AS sdp,
          COALESCE(rel.csg, mb.codigo_sag) AS csg,
          COALESCE(rel.trazabilidad, mb.codigo_trazabilidad) AS trazabilidad
        FROM dbo.MONIPLA_MUESTREO m
        INNER JOIN dbo.MONIPLA_ORIGEN_MUESTRA om
          ON om.id_origen_muestra = m.id_origen_muestra
        LEFT JOIN dbo.GEN_CUARTEL gc
          ON gc.GEN_CUARTEL = om.gen_cuartel
        LEFT JOIN dbo.GEN_FUNDO f
          ON f.Gen_Fundo = gc.GEN_FUNDO
        LEFT JOIN dbo.GEN_CAMPO c
          ON c.Gen_Campo = gc.GEN_CAMPO
        LEFT JOIN dbo.GEN_VARIEDAD v
          ON v.gen_variedad = gc.GEN_VARIEDAD
        LEFT JOIN dbo.MONIPLA_CATALOGO_SDP_MB mb
          ON mb.id_catalogo_sdp = om.id_catalogo_sdp
        INNER JOIN dbo.MONIPLA_ESTRUCTURA e
          ON e.id_estructura = m.id_estructura
        LEFT JOIN dbo.MONIPLA_LUGAR_MUESTRA lm
          ON lm.id_lugar_muestra = m.id_lugar_muestra
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

  async contarImagenesMuestreo(idMuestreo, transaction) {
    const request = await this.createRequest(transaction);

    const result = await request
      .input('idMuestreo', sql.Int, idMuestreo)
      .query(`
        SELECT COUNT(1) AS total
        FROM dbo.MONIPLA_IMAGEN WITH (UPDLOCK, HOLDLOCK)
        WHERE id_muestreo = @idMuestreo
      `);

    return Number(result.recordset[0].total || 0);
  }

  async insertarImagenMuestreo(idMuestreo, imagen, transaction) {
    const request = await this.createRequest(transaction);

    const result = await request
      .input('idMuestreo', sql.Int, idMuestreo)
      .input('orden', sql.TinyInt, imagen.orden)
      .input('imagen', sql.VarBinary(sql.MAX), imagen.buffer)
      .input('mime', sql.VarChar(30), imagen.mime)
      .input('comentario', sql.VarChar(400), imagen.comentario || null)
      .query(`
        INSERT INTO dbo.MONIPLA_IMAGEN (
          id_muestreo,
          orden,
          imagen,
          mime,
          comentario,
          fecha_creacion
        )
        OUTPUT INSERTED.id_imagen
        VALUES (
          @idMuestreo,
          @orden,
          @imagen,
          @mime,
          @comentario,
          SYSDATETIME()
        )
      `);

    return result.recordset[0];
  }

  async insertarImagenesMuestreo(idMuestreo, imagenes, transaction) {
    if (!Array.isArray(imagenes) || imagenes.length === 0) {
      return [];
    }

    const totalExistentes = await this.contarImagenesMuestreo(idMuestreo, transaction);

    if (totalExistentes > 0) {
      throw new Error('IMAGENES_YA_REGISTRADAS');
    }

    const insertadas = [];

    for (const imagen of imagenes) {
      try {
        const resultado = await this.insertarImagenMuestreo(idMuestreo, imagen, transaction);
        insertadas.push(resultado.id_imagen);
      } catch (error) {
        console.error('[MONIPLA][IMAGENES][ERROR]', {
          idMuestreo,
          orden: imagen.orden,
          error: error.message,
        });

        throw error;
      }
    }

    console.info('[MONIPLA][IMAGENES][INSERTADAS]', {
      idMuestreo,
      totalImagenes: insertadas.length,
    });

    return insertadas;
  }

  async obtenerFiltrosHistorial() {
    const pool = await poolPromise;

    const [
      fundos,
      campos,
      variedades,
      cuarteles,
      estructuras,
      plagas,
      tiposPlaga,
    ] = await Promise.all([
      pool.request().query(`
        SELECT
          q.value,
          q.label
        FROM (
          SELECT DISTINCT
            COALESCE(gc.GEN_FUNDO, mb.gen_fundo) AS value,
            COALESCE(LTRIM(RTRIM(f.Nombre)), LTRIM(RTRIM(mb.fundo))) AS label
          FROM dbo.MONIPLA_MUESTREO m
          INNER JOIN dbo.MONIPLA_ORIGEN_MUESTRA om
            ON om.id_origen_muestra = m.id_origen_muestra
          LEFT JOIN dbo.GEN_CUARTEL gc
            ON gc.GEN_CUARTEL = om.gen_cuartel
          LEFT JOIN dbo.GEN_FUNDO f
            ON f.Gen_Fundo = gc.GEN_FUNDO
          LEFT JOIN dbo.MONIPLA_CATALOGO_SDP_MB mb
            ON mb.id_catalogo_sdp = om.id_catalogo_sdp
          WHERE COALESCE(gc.GEN_FUNDO, mb.gen_fundo) IS NOT NULL
        ) q
        ORDER BY q.label ASC
      `),
      pool.request().query(`
        SELECT
          q.value,
          q.label
        FROM (
          SELECT DISTINCT
            COALESCE(gc.GEN_CAMPO, mb.gen_campo) AS value,
            COALESCE(LTRIM(RTRIM(c.Nombre)), LTRIM(RTRIM(mb.nombre_productor))) AS label
          FROM dbo.MONIPLA_MUESTREO m
          INNER JOIN dbo.MONIPLA_ORIGEN_MUESTRA om
            ON om.id_origen_muestra = m.id_origen_muestra
          LEFT JOIN dbo.GEN_CUARTEL gc
            ON gc.GEN_CUARTEL = om.gen_cuartel
          LEFT JOIN dbo.GEN_CAMPO c
            ON c.Gen_Campo = gc.GEN_CAMPO
          LEFT JOIN dbo.MONIPLA_CATALOGO_SDP_MB mb
            ON mb.id_catalogo_sdp = om.id_catalogo_sdp
          WHERE COALESCE(gc.GEN_CAMPO, mb.gen_campo) IS NOT NULL
        ) q
        ORDER BY q.label ASC
      `),
      pool.request().query(`
        SELECT
          q.value,
          q.label
        FROM (
          SELECT DISTINCT
            COALESCE(gc.GEN_VARIEDAD, mb.gen_variedad) AS value,
            COALESCE(LTRIM(RTRIM(v.Nombre)), LTRIM(RTRIM(mb.variedad))) AS label
          FROM dbo.MONIPLA_MUESTREO m
          INNER JOIN dbo.MONIPLA_ORIGEN_MUESTRA om
            ON om.id_origen_muestra = m.id_origen_muestra
          LEFT JOIN dbo.GEN_CUARTEL gc
            ON gc.GEN_CUARTEL = om.gen_cuartel
          LEFT JOIN dbo.GEN_VARIEDAD v
            ON v.gen_variedad = gc.GEN_VARIEDAD
          LEFT JOIN dbo.MONIPLA_CATALOGO_SDP_MB mb
            ON mb.id_catalogo_sdp = om.id_catalogo_sdp
          WHERE COALESCE(gc.GEN_VARIEDAD, mb.gen_variedad) IS NOT NULL
        ) q
        ORDER BY q.label ASC
      `),
      pool.request().query(`
        SELECT
          q.value,
          q.codigo,
          q.label
        FROM (
          SELECT DISTINCT
            COALESCE(gc.GEN_CUARTEL, mb.id_catalogo_sdp) AS value,
            COALESCE(LTRIM(RTRIM(gc.CODIGO)), LTRIM(RTRIM(mb.cuartel))) AS codigo,
            CONCAT('Cuartel ', COALESCE(LTRIM(RTRIM(gc.CODIGO)), LTRIM(RTRIM(mb.cuartel)))) AS label,
            TRY_CONVERT(INT, COALESCE(LTRIM(RTRIM(gc.CODIGO)), LTRIM(RTRIM(mb.cuartel)))) AS orden_numerico
          FROM dbo.MONIPLA_MUESTREO m
          INNER JOIN dbo.MONIPLA_ORIGEN_MUESTRA om
            ON om.id_origen_muestra = m.id_origen_muestra
          LEFT JOIN dbo.GEN_CUARTEL gc
            ON gc.GEN_CUARTEL = om.gen_cuartel
          LEFT JOIN dbo.MONIPLA_CATALOGO_SDP_MB mb
            ON mb.id_catalogo_sdp = om.id_catalogo_sdp
          WHERE COALESCE(gc.GEN_CUARTEL, mb.id_catalogo_sdp) IS NOT NULL
        ) q
        ORDER BY q.orden_numerico, q.codigo
      `),
      pool.request().query(`
        SELECT
          id_estructura AS value,
          LTRIM(RTRIM(nombre_estructura)) AS label
        FROM dbo.MONIPLA_ESTRUCTURA
        WHERE activo = 1
        ORDER BY nombre_estructura ASC
      `),
      pool.request().query(`
        SELECT
          id_plaga AS value,
          LTRIM(RTRIM(nombre_plaga)) AS label,
          LTRIM(RTRIM(ISNULL(nombre_cientifico, ''))) AS nombre_cientifico,
          LTRIM(RTRIM(ISNULL(tipo_registro, ''))) AS tipo_registro
        FROM dbo.MONIPLA_PLAGA
        WHERE activo = 1
        ORDER BY nombre_plaga ASC
      `),
      pool.request().query(`
        SELECT DISTINCT
          LTRIM(RTRIM(tipo_registro)) AS value,
          LTRIM(RTRIM(tipo_registro)) AS label
        FROM dbo.MONIPLA_PLAGA
        WHERE activo = 1
          AND tipo_registro IS NOT NULL
          AND LTRIM(RTRIM(tipo_registro)) <> ''
        ORDER BY label ASC
      `),
    ]);

    return {
      fundos: fundos.recordset,
      campos: campos.recordset,
      variedades: variedades.recordset,
      cuarteles: cuarteles.recordset,
      estructuras: estructuras.recordset,
      plagas: plagas.recordset,
      tiposPlaga: tiposPlaga.recordset,
      estadosResultado: [
        { value: 'PENDIENTE', label: 'Pendiente' },
        { value: 'SIN_PLAGAS', label: 'Sin plagas' },
        { value: 'CON_PLAGAS', label: 'Con plagas' },
      ],
    };
  }

  async listarHistorialMonitoreos(filtros) {
    const pool = await poolPromise;

    const buildRequest = () => pool.request()
      .input('idFundo', sql.Int, filtros.idFundo || null)
      .input('idCampo', sql.Int, filtros.idCampo || null)
      .input('idVariedad', sql.Int, filtros.idVariedad || null)
      .input('idCuartel', sql.Int, filtros.idCuartel || null)
      .input('fechaDesde', sql.Date, filtros.fechaDesde || null)
      .input('fechaHasta', sql.Date, filtros.fechaHasta || null)
      .input('idEstructura', sql.Int, filtros.idEstructura || null)
      .input('idPlaga', sql.Int, filtros.idPlaga || null)
      .input('tipoPlaga', sql.VarChar(20), filtros.tipoPlaga || null)
      .input('estadoResultado', sql.VarChar(20), filtros.estadoResultado || null);

    const fromWhere = `
      FROM dbo.MONIPLA_MUESTREO m
      INNER JOIN dbo.MONIPLA_ORIGEN_MUESTRA om
        ON om.id_origen_muestra = m.id_origen_muestra
      LEFT JOIN dbo.GEN_CUARTEL gc
        ON gc.GEN_CUARTEL = om.gen_cuartel
      LEFT JOIN dbo.GEN_FUNDO f
        ON f.Gen_Fundo = gc.GEN_FUNDO
      LEFT JOIN dbo.GEN_CAMPO c
        ON c.Gen_Campo = gc.GEN_CAMPO
      LEFT JOIN dbo.GEN_VARIEDAD v
        ON v.gen_variedad = gc.GEN_VARIEDAD
      LEFT JOIN dbo.MONIPLA_CATALOGO_SDP_MB mb
        ON mb.id_catalogo_sdp = om.id_catalogo_sdp
      LEFT JOIN dbo.MONIPLA_REL_CUARTEL_SDP rel
        ON rel.id_rel_cuartel_sdp = om.id_rel_cuartel_sdp
      INNER JOIN dbo.MONIPLA_ESTRUCTURA e
        ON e.id_estructura = m.id_estructura
      OUTER APPLY (
        SELECT
          COUNT(DISTINCT rp.id_plaga) AS plagas_detectadas,
          SUM(ISNULL(rc.cantidad, 0)) AS total_ejemplares
        FROM dbo.MONIPLA_RESULTADO_PLAGA rp
        LEFT JOIN dbo.MONIPLA_RESULTADO_CONTEO rc
          ON rc.id_resultado_plaga = rp.id_resultado_plaga
        WHERE rp.id_muestreo = m.id_muestreo
      ) resultados
      OUTER APPLY (
        SELECT COUNT(1) AS total_imagenes
        FROM dbo.MONIPLA_IMAGEN img
        WHERE img.id_muestreo = m.id_muestreo
      ) imagenes
      WHERE (@idFundo IS NULL OR COALESCE(gc.GEN_FUNDO, mb.gen_fundo) = @idFundo)
        AND (@idCampo IS NULL OR COALESCE(gc.GEN_CAMPO, mb.gen_campo) = @idCampo)
        AND (@idVariedad IS NULL OR COALESCE(gc.GEN_VARIEDAD, mb.gen_variedad) = @idVariedad)
        AND (@idCuartel IS NULL OR COALESCE(gc.GEN_CUARTEL, mb.id_catalogo_sdp) = @idCuartel)
        AND (@fechaDesde IS NULL OR m.fecha_muestreo >= @fechaDesde)
        AND (@fechaHasta IS NULL OR m.fecha_muestreo <= @fechaHasta)
        AND (@idEstructura IS NULL OR m.id_estructura = @idEstructura)
        AND (@estadoResultado IS NULL OR m.estado_resultado = @estadoResultado)
        AND (
          @idPlaga IS NULL
          OR EXISTS (
            SELECT 1
            FROM dbo.MONIPLA_RESULTADO_PLAGA rpFiltro
            WHERE rpFiltro.id_muestreo = m.id_muestreo
              AND rpFiltro.id_plaga = @idPlaga
          )
        )
        AND (
          @tipoPlaga IS NULL
          OR EXISTS (
            SELECT 1
            FROM dbo.MONIPLA_RESULTADO_PLAGA rpTipo
            INNER JOIN dbo.MONIPLA_PLAGA pTipo
              ON pTipo.id_plaga = rpTipo.id_plaga
            WHERE rpTipo.id_muestreo = m.id_muestreo
              AND pTipo.tipo_registro = @tipoPlaga
          )
        )
    `;

    const countResult = await buildRequest().query(`
      SELECT COUNT(1) AS total_registros
      ${fromWhere}
    `);

    const totalRegistros = Number(countResult.recordset[0].total_registros || 0);
    const totalPaginas = Math.max(1, Math.ceil(totalRegistros / filtros.pageSize));
    const pagina = Math.min(filtros.pagina, totalPaginas);
    const offset = (pagina - 1) * filtros.pageSize;

    const registrosResult = await buildRequest()
      .input('offset', sql.Int, offset)
      .input('pageSize', sql.Int, filtros.pageSize)
      .query(`
        SELECT
          m.id_muestreo,
          m.numero_muestreo,
          m.fecha_muestreo,
          m.estado_resultado,
          m.horas_frio_acumuladas,
          m.dias_grado_acumulados,
          m.estacion_meteo_uuid,
          LTRIM(RTRIM(ISNULL(m.nombre_estacion_meteo, ''))) AS nombre_estacion_meteo,
          m.fecha_corte_agroclima,
          m.semana_iso_corte,
          m.temporada_agroclima,
          m.agroclima_observacion,
          gc.GEN_CUARTEL AS gen_cuartel,
          COALESCE(LTRIM(RTRIM(gc.CODIGO)), LTRIM(RTRIM(mb.cuartel))) AS codigo_cuartel,
          COALESCE(LTRIM(RTRIM(f.Nombre)), LTRIM(RTRIM(mb.fundo))) AS nombre_fundo,
          COALESCE(LTRIM(RTRIM(c.Nombre)), LTRIM(RTRIM(mb.nombre_productor))) AS nombre_campo,
          COALESCE(LTRIM(RTRIM(v.Nombre)), LTRIM(RTRIM(mb.variedad))) AS nombre_variedad,
          COALESCE(rel.sdp, mb.sdp) AS sdp,
          LTRIM(RTRIM(e.nombre_estructura)) AS nombre_estructura,
          ISNULL(resultados.plagas_detectadas, 0) AS plagas_detectadas,
          ISNULL(resultados.total_ejemplares, 0) AS total_ejemplares,
          ISNULL(imagenes.total_imagenes, 0) AS total_imagenes
        ${fromWhere}
        ORDER BY
          m.fecha_muestreo DESC,
          m.numero_muestreo DESC,
          m.id_muestreo DESC
        OFFSET @offset ROWS
        FETCH NEXT @pageSize ROWS ONLY
      `);

    return {
      registros: registrosResult.recordset,
      totalRegistros,
      pagina,
      pageSize: filtros.pageSize,
      totalPaginas,
    };
  }

  async obtenerDatosReporteGeneral(filtros) {
    const pool = await poolPromise;
    const result = await pool.request()
      .input('idFundo', sql.Int, filtros.idFundo || null)
      .input('idCampo', sql.Int, filtros.idCampo || null)
      .input('idVariedad', sql.Int, filtros.idVariedad || null)
      .input('idCuartel', sql.Int, filtros.idCuartel || null)
      .input('fechaDesde', sql.Date, filtros.fechaDesde || null)
      .input('fechaHasta', sql.Date, filtros.fechaHasta || null)
      .input('idEstructura', sql.Int, filtros.idEstructura || null)
      .input('idPlaga', sql.Int, filtros.idPlaga || null)
      .input('tipoPlaga', sql.VarChar(20), filtros.tipoPlaga || null)
      .input('estadoResultado', sql.VarChar(20), filtros.estadoResultado || null)
      .query(`
        SELECT
          m.id_muestreo,
          m.numero_muestreo,
          m.fecha_muestreo,
          m.fecha_revision_muestra,
          m.fecha_solicitud_muestra,
          m.fecha_recepcion_muestra,
          m.cant_unidades_muestreadas,
          m.observacion_general,
          m.estado_resultado,
          m.observacion_resultado,
          m.fecha_resultado,
          m.fecha_creacion,
          m.fecha_modificacion,
          m.id_usuario_creacion,
          m.id_usuario_resultado,
          m.id_muestrador,
          m.id_estadofenologico,
          m.horas_frio_acumuladas,
          m.dias_grado_acumulados,
          m.estacion_meteo_uuid,
          LTRIM(RTRIM(ISNULL(m.nombre_estacion_meteo, ''))) AS nombre_estacion_meteo,
          m.fecha_corte_agroclima,
          m.semana_iso_corte,
          m.temporada_agroclima,
          m.agroclima_observacion,
          LTRIM(RTRIM(ISNULL(uc.nombre, ''))) AS nombre_usuario_creacion,
          LTRIM(RTRIM(ISNULL(ur.nombre, ''))) AS nombre_usuario_resultado,
          LTRIM(RTRIM(ISNULL(mm.nombre_muestrador, ''))) AS nombre_muestreador,
          LTRIM(RTRIM(ISNULL(ef.nom_estadofenologico, ''))) AS nombre_estado_fenologico,
          e.id_estructura,
          LTRIM(RTRIM(e.nombre_estructura)) AS nombre_estructura,
          m.id_lugar_muestra,
          LTRIM(RTRIM(lm.nombre_lugar_muestra)) AS nombre_lugar_muestra,
          om.id_origen_muestra,
          om.id_catalogo_sdp,
          gc.GEN_CUARTEL AS gen_cuartel,
          COALESCE(LTRIM(RTRIM(gc.CODIGO)), LTRIM(RTRIM(mb.cuartel))) AS codigo_cuartel,
          COALESCE(LTRIM(RTRIM(f.Nombre)), LTRIM(RTRIM(mb.fundo))) AS nombre_fundo,
          COALESCE(LTRIM(RTRIM(c.Nombre)), LTRIM(RTRIM(mb.nombre_productor))) AS nombre_campo,
          COALESCE(LTRIM(RTRIM(v.Nombre)), LTRIM(RTRIM(mb.variedad))) AS nombre_variedad,
          COALESCE(rel.sdp, mb.sdp) AS sdp,
          COALESCE(rel.csg, mb.codigo_sag) AS csg,
          COALESCE(rel.trazabilidad, mb.codigo_trazabilidad) AS trazabilidad,
          rp.id_resultado_plaga,
          rp.id_plaga,
          rp.detalle_texto,
          rp.cantidad_total,
          rp.observacion,
          rp.fecha_creacion AS fecha_resultado_plaga,
          LTRIM(RTRIM(p.nombre_plaga)) AS nombre_plaga,
          LTRIM(RTRIM(ISNULL(p.nombre_cientifico, ''))) AS nombre_cientifico,
          LTRIM(RTRIM(ISNULL(p.tipo_registro, ''))) AS tipo_registro,
          p.es_cuarentenaria,
          rc.id_resultado_conteo,
          rc.id_estadio,
          LTRIM(RTRIM(est.nombre_estadio)) AS nombre_estadio,
          rc.id_estado_ejemplar,
          LTRIM(RTRIM(ee.nombre_estado)) AS nombre_estado,
          rc.cantidad
        FROM dbo.MONIPLA_MUESTREO m
        INNER JOIN dbo.MONIPLA_ORIGEN_MUESTRA om
          ON om.id_origen_muestra = m.id_origen_muestra
        LEFT JOIN dbo.GEN_CUARTEL gc
          ON gc.GEN_CUARTEL = om.gen_cuartel
        LEFT JOIN dbo.GEN_FUNDO f
          ON f.Gen_Fundo = gc.GEN_FUNDO
        LEFT JOIN dbo.GEN_CAMPO c
          ON c.Gen_Campo = gc.GEN_CAMPO
        LEFT JOIN dbo.GEN_VARIEDAD v
          ON v.gen_variedad = gc.GEN_VARIEDAD
        LEFT JOIN dbo.MONIPLA_CATALOGO_SDP_MB mb
          ON mb.id_catalogo_sdp = om.id_catalogo_sdp
        INNER JOIN dbo.MONIPLA_ESTRUCTURA e
          ON e.id_estructura = m.id_estructura
        LEFT JOIN dbo.MONIPLA_LUGAR_MUESTRA lm
          ON lm.id_lugar_muestra = m.id_lugar_muestra
        LEFT JOIN dbo.MONIPLA_REL_CUARTEL_SDP rel
          ON rel.id_rel_cuartel_sdp = om.id_rel_cuartel_sdp
        LEFT JOIN dbo.usuarios_sistema uc
          ON uc.id = m.id_usuario_creacion
        LEFT JOIN dbo.usuarios_sistema ur
          ON ur.id = m.id_usuario_resultado
        LEFT JOIN dbo.MONIPLA_MUESTRADOR mm
          ON mm.id_muestrador = m.id_muestrador
        LEFT JOIN dbo.estado_fenologico ef
          ON ef.id_estadofenologico = m.id_estadofenologico
        LEFT JOIN dbo.MONIPLA_RESULTADO_PLAGA rp
          ON rp.id_muestreo = m.id_muestreo
        LEFT JOIN dbo.MONIPLA_PLAGA p
          ON p.id_plaga = rp.id_plaga
        LEFT JOIN dbo.MONIPLA_RESULTADO_CONTEO rc
          ON rc.id_resultado_plaga = rp.id_resultado_plaga
        LEFT JOIN dbo.MONIPLA_ESTADIO est
          ON est.id_estadio = rc.id_estadio
        LEFT JOIN dbo.MONIPLA_ESTADO_EJEMPLAR ee
          ON ee.id_estado_ejemplar = rc.id_estado_ejemplar
        WHERE (@idFundo IS NULL OR COALESCE(gc.GEN_FUNDO, mb.gen_fundo) = @idFundo)
          AND (@idCampo IS NULL OR COALESCE(gc.GEN_CAMPO, mb.gen_campo) = @idCampo)
          AND (@idVariedad IS NULL OR COALESCE(gc.GEN_VARIEDAD, mb.gen_variedad) = @idVariedad)
          AND (@idCuartel IS NULL OR COALESCE(gc.GEN_CUARTEL, mb.id_catalogo_sdp) = @idCuartel)
          AND (@fechaDesde IS NULL OR m.fecha_muestreo >= @fechaDesde)
          AND (@fechaHasta IS NULL OR m.fecha_muestreo <= @fechaHasta)
          AND (@idEstructura IS NULL OR m.id_estructura = @idEstructura)
          AND (@estadoResultado IS NULL OR m.estado_resultado = @estadoResultado)
          AND (
            @idPlaga IS NULL
            OR EXISTS (
              SELECT 1
              FROM dbo.MONIPLA_RESULTADO_PLAGA rpFiltro
              WHERE rpFiltro.id_muestreo = m.id_muestreo
                AND rpFiltro.id_plaga = @idPlaga
            )
          )
          AND (
            @tipoPlaga IS NULL
            OR EXISTS (
              SELECT 1
              FROM dbo.MONIPLA_RESULTADO_PLAGA rpTipo
              INNER JOIN dbo.MONIPLA_PLAGA pTipo
                ON pTipo.id_plaga = rpTipo.id_plaga
              WHERE rpTipo.id_muestreo = m.id_muestreo
                AND pTipo.tipo_registro = @tipoPlaga
            )
          )
        ORDER BY
          m.fecha_muestreo DESC,
          m.numero_muestreo DESC,
          m.id_muestreo DESC,
          rp.id_plaga ASC,
          rc.id_estadio ASC,
          rc.id_estado_ejemplar ASC
      `);

    return result.recordset;
  }

  async obtenerDetalleMuestreo(idMuestreo) {
    const pool = await poolPromise;

    const result = await pool
      .request()
      .input('idMuestreo', sql.Int, idMuestreo)
      .query(`
        SELECT TOP 1
          m.id_muestreo,
          m.numero_muestreo,
          m.fecha_muestreo,
          m.fecha_revision_muestra,
          m.fecha_solicitud_muestra,
          m.fecha_recepcion_muestra,
          m.cant_unidades_muestreadas,
          m.observacion_general,
          m.estado_resultado,
          m.observacion_resultado,
          m.fecha_resultado,
          m.fecha_creacion,
          m.fecha_modificacion,
          m.id_usuario_creacion,
          m.id_usuario_resultado,
          m.id_muestrador,
          m.id_estadofenologico,
          m.horas_frio_acumuladas,
          m.dias_grado_acumulados,
          m.estacion_meteo_uuid,
          LTRIM(RTRIM(ISNULL(m.nombre_estacion_meteo, ''))) AS nombre_estacion_meteo,
          m.fecha_corte_agroclima,
          m.semana_iso_corte,
          m.temporada_agroclima,
          m.agroclima_observacion,
          LTRIM(RTRIM(ISNULL(uc.nombre, ''))) AS nombre_usuario_creacion,
          LTRIM(RTRIM(ISNULL(ur.nombre, ''))) AS nombre_usuario_resultado,
          LTRIM(RTRIM(ISNULL(mm.nombre_muestrador, ''))) AS nombre_muestreador,
          LTRIM(RTRIM(ISNULL(ef.nom_estadofenologico, ''))) AS nombre_estado_fenologico,
          e.id_estructura,
          LTRIM(RTRIM(e.nombre_estructura)) AS nombre_estructura,
          m.id_lugar_muestra,
          LTRIM(RTRIM(lm.nombre_lugar_muestra)) AS nombre_lugar_muestra,
          om.id_origen_muestra,
          om.id_catalogo_sdp,
          gc.GEN_CUARTEL AS gen_cuartel,
          COALESCE(LTRIM(RTRIM(gc.CODIGO)), LTRIM(RTRIM(mb.cuartel))) AS codigo_cuartel,
          COALESCE(LTRIM(RTRIM(f.Nombre)), LTRIM(RTRIM(mb.fundo))) AS nombre_fundo,
          COALESCE(LTRIM(RTRIM(c.Nombre)), LTRIM(RTRIM(mb.nombre_productor))) AS nombre_campo,
          COALESCE(LTRIM(RTRIM(v.Nombre)), LTRIM(RTRIM(mb.variedad))) AS nombre_variedad,
          COALESCE(rel.sdp, mb.sdp) AS sdp,
          COALESCE(rel.csg, mb.codigo_sag) AS csg,
          COALESCE(rel.trazabilidad, mb.codigo_trazabilidad) AS trazabilidad
        FROM dbo.MONIPLA_MUESTREO m
        INNER JOIN dbo.MONIPLA_ORIGEN_MUESTRA om
          ON om.id_origen_muestra = m.id_origen_muestra
        LEFT JOIN dbo.GEN_CUARTEL gc
          ON gc.GEN_CUARTEL = om.gen_cuartel
        LEFT JOIN dbo.GEN_FUNDO f
          ON f.Gen_Fundo = gc.GEN_FUNDO
        LEFT JOIN dbo.GEN_CAMPO c
          ON c.Gen_Campo = gc.GEN_CAMPO
        LEFT JOIN dbo.GEN_VARIEDAD v
          ON v.gen_variedad = gc.GEN_VARIEDAD
        LEFT JOIN dbo.MONIPLA_CATALOGO_SDP_MB mb
          ON mb.id_catalogo_sdp = om.id_catalogo_sdp
        INNER JOIN dbo.MONIPLA_ESTRUCTURA e
          ON e.id_estructura = m.id_estructura
        LEFT JOIN dbo.MONIPLA_LUGAR_MUESTRA lm
          ON lm.id_lugar_muestra = m.id_lugar_muestra
        LEFT JOIN dbo.MONIPLA_REL_CUARTEL_SDP rel
          ON rel.id_rel_cuartel_sdp = om.id_rel_cuartel_sdp
        LEFT JOIN dbo.usuarios_sistema uc
          ON uc.id = m.id_usuario_creacion
        LEFT JOIN dbo.usuarios_sistema ur
          ON ur.id = m.id_usuario_resultado
        LEFT JOIN dbo.MONIPLA_MUESTRADOR mm
          ON mm.id_muestrador = m.id_muestrador
        LEFT JOIN dbo.estado_fenologico ef
          ON ef.id_estadofenologico = m.id_estadofenologico
        WHERE m.id_muestreo = @idMuestreo
      `);

    return result.recordset[0] || null;
  }

  async obtenerResultadosAgrupadosMuestreo(idMuestreo) {
    const pool = await poolPromise;

    const result = await pool
      .request()
      .input('idMuestreo', sql.Int, idMuestreo)
      .query(`
        SELECT
          rp.id_resultado_plaga,
          rp.id_muestreo,
          rp.id_plaga,
          rp.detalle_texto,
          rp.cantidad_total,
          rp.observacion,
          rp.fecha_creacion AS fecha_resultado_plaga,
          LTRIM(RTRIM(p.nombre_plaga)) AS nombre_plaga,
          LTRIM(RTRIM(ISNULL(p.nombre_cientifico, ''))) AS nombre_cientifico,
          LTRIM(RTRIM(ISNULL(p.tipo_registro, ''))) AS tipo_registro,
          p.es_cuarentenaria,
          rc.id_resultado_conteo,
          rc.id_estadio,
          LTRIM(RTRIM(est.nombre_estadio)) AS nombre_estadio,
          rc.id_estado_ejemplar,
          LTRIM(RTRIM(ee.nombre_estado)) AS nombre_estado,
          rc.cantidad
        FROM dbo.MONIPLA_RESULTADO_PLAGA rp
        INNER JOIN dbo.MONIPLA_PLAGA p
          ON p.id_plaga = rp.id_plaga
        LEFT JOIN dbo.MONIPLA_RESULTADO_CONTEO rc
          ON rc.id_resultado_plaga = rp.id_resultado_plaga
        LEFT JOIN dbo.MONIPLA_ESTADIO est
          ON est.id_estadio = rc.id_estadio
        LEFT JOIN dbo.MONIPLA_ESTADO_EJEMPLAR ee
          ON ee.id_estado_ejemplar = rc.id_estado_ejemplar
        WHERE rp.id_muestreo = @idMuestreo
        ORDER BY
          p.nombre_plaga ASC,
          rp.id_resultado_plaga ASC,
          est.id_estadio ASC,
          ee.id_estado_ejemplar ASC
      `);

    return result.recordset;
  }

  async obtenerImagenesMuestreo(idMuestreo) {
    const pool = await poolPromise;

    const result = await pool
      .request()
      .input('idMuestreo', sql.Int, idMuestreo)
      .query(`
        SELECT
          id_imagen,
          id_muestreo,
          orden,
          mime,
          comentario,
          fecha_creacion
        FROM dbo.MONIPLA_IMAGEN
        WHERE id_muestreo = @idMuestreo
        ORDER BY orden ASC, id_imagen ASC
      `);

    return result.recordset;
  }

  async obtenerImagenPorId(idImagen) {
    const pool = await poolPromise;

    const result = await pool
      .request()
      .input('idImagen', sql.Int, idImagen)
      .query(`
        SELECT TOP 1
          id_imagen,
          imagen,
          mime
        FROM dbo.MONIPLA_IMAGEN
        WHERE id_imagen = @idImagen
      `);

    return result.recordset[0] || null;
  }

  async bloquearMuestreoParaEliminacion(idMuestreo, transaction) {
    const request = await this.createRequest(transaction);
    const result = await request
      .input('idMuestreo', sql.Int, idMuestreo)
      .query(`
        SELECT
          id_muestreo,
          numero_muestreo,
          id_origen_muestra,
          estado_resultado
        FROM dbo.MONIPLA_MUESTREO WITH (UPDLOCK, HOLDLOCK)
        WHERE id_muestreo = @idMuestreo
      `);

    return result.recordset.length === 1 ? result.recordset[0] : null;
  }

  async eliminarConteosPorMuestreo(idMuestreo, transaction) {
    const request = await this.createRequest(transaction);
    const result = await request
      .input('idMuestreo', sql.Int, idMuestreo)
      .query(`
        DELETE rc
        FROM dbo.MONIPLA_RESULTADO_CONTEO rc
        INNER JOIN dbo.MONIPLA_RESULTADO_PLAGA rp
          ON rp.id_resultado_plaga = rc.id_resultado_plaga
        WHERE rp.id_muestreo = @idMuestreo
      `);

    return Number(result.rowsAffected[0] || 0);
  }

  async eliminarResultadosPlagaPorMuestreo(idMuestreo, transaction) {
    const request = await this.createRequest(transaction);
    const result = await request
      .input('idMuestreo', sql.Int, idMuestreo)
      .query(`
        DELETE FROM dbo.MONIPLA_RESULTADO_PLAGA
        WHERE id_muestreo = @idMuestreo
      `);

    return Number(result.rowsAffected[0] || 0);
  }

  async eliminarImagenesPorMuestreo(idMuestreo, transaction) {
    const request = await this.createRequest(transaction);
    const result = await request
      .input('idMuestreo', sql.Int, idMuestreo)
      .query(`
        DELETE FROM dbo.MONIPLA_IMAGEN
        WHERE id_muestreo = @idMuestreo
      `);

    return Number(result.rowsAffected[0] || 0);
  }

  async eliminarMuestreoPorId(idMuestreo, transaction) {
    const request = await this.createRequest(transaction);
    const result = await request
      .input('idMuestreo', sql.Int, idMuestreo)
      .query(`
        DELETE FROM dbo.MONIPLA_MUESTREO
        WHERE id_muestreo = @idMuestreo
      `);

    return Number(result.rowsAffected[0] || 0);
  }

  async eliminarMuestreoTransaccional(idMuestreo) {
    const pool = await poolPromise;
    const transaction = new sql.Transaction(pool);
    let transactionStarted = false;

    try {
      console.info('[MONIPLA][ELIMINAR][TX_BEGIN]', { idMuestreo });
      await transaction.begin();
      transactionStarted = true;

      const muestreo = await this.bloquearMuestreoParaEliminacion(idMuestreo, transaction);

      if (!muestreo) {
        throw new Error('MUESTREO_NO_EXISTE');
      }

      const conteosEliminados = await this.eliminarConteosPorMuestreo(idMuestreo, transaction);
      const resultadosEliminados = await this.eliminarResultadosPlagaPorMuestreo(idMuestreo, transaction);
      const imagenesEliminadas = await this.eliminarImagenesPorMuestreo(idMuestreo, transaction);
      const muestreosEliminados = await this.eliminarMuestreoPorId(idMuestreo, transaction);

      if (muestreosEliminados !== 1) {
        throw new Error('ELIMINACION_MUESTREO_INCONSISTENTE');
      }

      await transaction.commit();

      console.info('[MONIPLA][ELIMINAR][TX_COMMIT]', {
        idMuestreo,
        numeroMuestreo: muestreo.numero_muestreo,
        conteosEliminados,
        resultadosEliminados,
        imagenesEliminadas,
      });

      return muestreo;
    } catch (error) {
      if (transactionStarted) {
        await transaction.rollback();
      }

      console.error('[MONIPLA][ELIMINAR][TX_ROLLBACK]', {
        idMuestreo,
        error: error.message,
      });

      throw error;
    }
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

      const imagenesInsertadas = await this.insertarImagenesMuestreo(
        idMuestreo,
        metadata.imagenes || [],
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
        imagenes_insertadas: imagenesInsertadas.length,
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

      const imagenesInsertadas = await this.insertarImagenesMuestreo(
        idMuestreo,
        data.imagenes || [],
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
        imagenes_insertadas: imagenesInsertadas.length,
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
