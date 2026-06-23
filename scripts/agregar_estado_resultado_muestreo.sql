IF COL_LENGTH('dbo.MONIPLA_MUESTREO', 'estado_resultado') IS NULL
BEGIN
    ALTER TABLE dbo.MONIPLA_MUESTREO
    ADD estado_resultado VARCHAR(20) NOT NULL
        CONSTRAINT DF_MONIPLA_MUESTREO_estado_resultado DEFAULT ('PENDIENTE')
        WITH VALUES;
END;

IF COL_LENGTH('dbo.MONIPLA_MUESTREO', 'observacion_resultado') IS NULL
BEGIN
    ALTER TABLE dbo.MONIPLA_MUESTREO
    ADD observacion_resultado VARCHAR(500) NULL;
END;

IF COL_LENGTH('dbo.MONIPLA_MUESTREO', 'fecha_resultado') IS NULL
BEGIN
    ALTER TABLE dbo.MONIPLA_MUESTREO
    ADD fecha_resultado DATETIME2(0) NULL;
END;

IF COL_LENGTH('dbo.MONIPLA_MUESTREO', 'id_usuario_resultado') IS NULL
BEGIN
    ALTER TABLE dbo.MONIPLA_MUESTREO
    ADD id_usuario_resultado INT NULL;
END;

IF NOT EXISTS (
    SELECT 1
    FROM sys.check_constraints
    WHERE name = 'CK_MONIPLA_MUESTREO_estado_resultado'
      AND parent_object_id = OBJECT_ID('dbo.MONIPLA_MUESTREO')
)
BEGIN
    ALTER TABLE dbo.MONIPLA_MUESTREO
    ADD CONSTRAINT CK_MONIPLA_MUESTREO_estado_resultado
    CHECK (estado_resultado IN ('PENDIENTE', 'SIN_PLAGAS', 'CON_PLAGAS'));
END;
