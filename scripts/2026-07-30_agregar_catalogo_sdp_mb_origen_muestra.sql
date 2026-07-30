/*
  Marcha blanca: conserva los orígenes históricos y habilita orígenes
  respaldados por dbo.MONIPLA_CATALOGO_SDP_MB.

  No ejecutar desde Node.js. Debe aplicarse por el responsable de base de datos.
*/
SET XACT_ABORT ON;

BEGIN TRY
  BEGIN TRANSACTION;

  IF OBJECT_ID('dbo.MONIPLA_ORIGEN_MUESTRA', 'U') IS NULL
    OR OBJECT_ID('dbo.MONIPLA_CATALOGO_SDP_MB', 'U') IS NULL
  BEGIN
    THROW 50001, 'No se encontraron las tablas requeridas para la migracion de marcha blanca.', 1;
  END;

  IF NOT EXISTS (
    SELECT 1
    FROM sys.columns c
    WHERE c.object_id = OBJECT_ID('dbo.MONIPLA_CATALOGO_SDP_MB')
      AND c.name = 'id_catalogo_sdp'
      AND TYPE_NAME(c.user_type_id) = 'int'
  )
  BEGIN
    THROW 50002, 'No se encontro dbo.MONIPLA_CATALOGO_SDP_MB.id_catalogo_sdp de tipo INT.', 1;
  END;

  /* Tipos reales diagnosticados en SistemaRiego: SMALLINT, SMALLINT e INT. */
  IF NOT EXISTS (
    SELECT 1 FROM sys.columns c
    WHERE c.object_id = OBJECT_ID('dbo.MONIPLA_ORIGEN_MUESTRA')
      AND c.name = 'gen_cuartel' AND TYPE_NAME(c.user_type_id) = 'smallint'
  ) OR NOT EXISTS (
    SELECT 1 FROM sys.columns c
    WHERE c.object_id = OBJECT_ID('dbo.MONIPLA_ORIGEN_MUESTRA')
      AND c.name = 'gen_variedad_campo' AND TYPE_NAME(c.user_type_id) = 'smallint'
  ) OR NOT EXISTS (
    SELECT 1 FROM sys.columns c
    WHERE c.object_id = OBJECT_ID('dbo.MONIPLA_ORIGEN_MUESTRA')
      AND c.name = 'id_rel_cuartel_sdp' AND TYPE_NAME(c.user_type_id) = 'int'
  )
  BEGIN
    THROW 50003, 'Los tipos reales de las columnas historicas no coinciden con el diagnostico previo.', 1;
  END;

  IF COL_LENGTH('dbo.MONIPLA_ORIGEN_MUESTRA', 'id_catalogo_sdp') IS NULL
  BEGIN
    ALTER TABLE dbo.MONIPLA_ORIGEN_MUESTRA
      ADD id_catalogo_sdp INT NULL;
  END;

  IF NOT EXISTS (
    SELECT 1 FROM sys.columns c
    WHERE c.object_id = OBJECT_ID('dbo.MONIPLA_ORIGEN_MUESTRA')
      AND c.name = 'id_catalogo_sdp'
      AND TYPE_NAME(c.user_type_id) = 'int'
  )
  BEGIN
    THROW 50004, 'MONIPLA_ORIGEN_MUESTRA.id_catalogo_sdp debe ser INT.', 1;
  END;

  /* Se valida antes de cambiar índices o agregar CHECK; no se usa WITH NOCHECK. */
  IF EXISTS (
    SELECT 1
    FROM dbo.MONIPLA_ORIGEN_MUESTRA
    WHERE NOT (
      (id_catalogo_sdp IS NOT NULL
        AND gen_cuartel IS NULL
        AND gen_variedad_campo IS NULL
        AND id_rel_cuartel_sdp IS NULL)
      OR
      (id_catalogo_sdp IS NULL
        AND gen_cuartel IS NOT NULL
        AND gen_variedad_campo IS NOT NULL
        AND id_rel_cuartel_sdp IS NOT NULL)
    )
  )
  BEGIN
    THROW 50005, 'Existen origenes que no cumplen el modelo historico completo o marcha blanca exclusivo.', 1;
  END;

  IF COLUMNPROPERTY(OBJECT_ID('dbo.MONIPLA_ORIGEN_MUESTRA'), 'gen_cuartel', 'AllowsNull') = 0
  BEGIN
    ALTER TABLE dbo.MONIPLA_ORIGEN_MUESTRA
      ALTER COLUMN gen_cuartel SMALLINT NULL;
  END;

  IF COLUMNPROPERTY(OBJECT_ID('dbo.MONIPLA_ORIGEN_MUESTRA'), 'gen_variedad_campo', 'AllowsNull') = 0
  BEGIN
    ALTER TABLE dbo.MONIPLA_ORIGEN_MUESTRA
      ALTER COLUMN gen_variedad_campo SMALLINT NULL;
  END;

  IF COLUMNPROPERTY(OBJECT_ID('dbo.MONIPLA_ORIGEN_MUESTRA'), 'id_rel_cuartel_sdp', 'AllowsNull') = 0
  BEGIN
    ALTER TABLE dbo.MONIPLA_ORIGEN_MUESTRA
      ALTER COLUMN id_rel_cuartel_sdp INT NULL;
  END;

  /* El UQ histórico no admite más de una terna NULL; se reemplaza por unicidad filtrada. */
  IF EXISTS (
    SELECT 1
    FROM sys.key_constraints
    WHERE name = 'UQ_MONIPLA_ORIGEN_MUESTRA_UNICO'
      AND parent_object_id = OBJECT_ID('dbo.MONIPLA_ORIGEN_MUESTRA')
  )
  BEGIN
    ALTER TABLE dbo.MONIPLA_ORIGEN_MUESTRA
      DROP CONSTRAINT UQ_MONIPLA_ORIGEN_MUESTRA_UNICO;
  END;

  IF NOT EXISTS (
    SELECT 1 FROM sys.indexes
    WHERE object_id = OBJECT_ID('dbo.MONIPLA_ORIGEN_MUESTRA')
      AND name = 'UX_MONIPLA_ORIGEN_MUESTRA_HISTORICO'
  )
  BEGIN
    CREATE UNIQUE INDEX UX_MONIPLA_ORIGEN_MUESTRA_HISTORICO
      ON dbo.MONIPLA_ORIGEN_MUESTRA(gen_cuartel, gen_variedad_campo, id_rel_cuartel_sdp)
      WHERE gen_cuartel IS NOT NULL;
  END;

  /* El repository busca y reutiliza un origen por fila canónica MB; este índice evita carreras. */
  IF NOT EXISTS (
    SELECT 1 FROM sys.indexes
    WHERE object_id = OBJECT_ID('dbo.MONIPLA_ORIGEN_MUESTRA')
      AND name = 'UX_MONIPLA_ORIGEN_MUESTRA_CATALOGO_SDP_MB'
  )
  BEGIN
    CREATE UNIQUE INDEX UX_MONIPLA_ORIGEN_MUESTRA_CATALOGO_SDP_MB
      ON dbo.MONIPLA_ORIGEN_MUESTRA(id_catalogo_sdp)
      WHERE id_catalogo_sdp IS NOT NULL;
  END;

  IF NOT EXISTS (
    SELECT 1 FROM sys.check_constraints
    WHERE name = 'CK_MONIPLA_ORIGEN_MUESTRA_TIPO_ORIGEN'
      AND parent_object_id = OBJECT_ID('dbo.MONIPLA_ORIGEN_MUESTRA')
  )
  BEGIN
    ALTER TABLE dbo.MONIPLA_ORIGEN_MUESTRA WITH CHECK
      ADD CONSTRAINT CK_MONIPLA_ORIGEN_MUESTRA_TIPO_ORIGEN CHECK (
        (id_catalogo_sdp IS NOT NULL
          AND gen_cuartel IS NULL
          AND gen_variedad_campo IS NULL
          AND id_rel_cuartel_sdp IS NULL)
        OR
        (id_catalogo_sdp IS NULL
          AND gen_cuartel IS NOT NULL
          AND gen_variedad_campo IS NOT NULL
          AND id_rel_cuartel_sdp IS NOT NULL)
      );
  END;

  IF NOT EXISTS (
    SELECT 1 FROM sys.foreign_keys
    WHERE name = 'FK_MONIPLA_ORIGEN_MUESTRA_CATALOGO_SDP_MB'
      AND parent_object_id = OBJECT_ID('dbo.MONIPLA_ORIGEN_MUESTRA')
  )
  BEGIN
    ALTER TABLE dbo.MONIPLA_ORIGEN_MUESTRA WITH CHECK
      ADD CONSTRAINT FK_MONIPLA_ORIGEN_MUESTRA_CATALOGO_SDP_MB
        FOREIGN KEY (id_catalogo_sdp)
        REFERENCES dbo.MONIPLA_CATALOGO_SDP_MB(id_catalogo_sdp)
        ON DELETE NO ACTION;
  END;

  COMMIT TRANSACTION;
END TRY
BEGIN CATCH
  IF XACT_STATE() <> 0
    ROLLBACK TRANSACTION;

  THROW;
END CATCH;
