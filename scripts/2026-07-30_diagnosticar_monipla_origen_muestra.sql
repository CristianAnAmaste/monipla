/* Diagnóstico de solo lectura. Ejecutar antes de la migración de marcha blanca. */
SELECT
    @@SERVERNAME AS servidor,
    DB_NAME() AS base_datos;

EXEC sp_help 'dbo.MONIPLA_ORIGEN_MUESTRA';

SELECT
    c.name AS columna,
    TYPE_NAME(c.user_type_id) AS tipo,
    c.max_length,
    c.is_nullable
FROM sys.columns AS c
WHERE c.object_id = OBJECT_ID('dbo.MONIPLA_ORIGEN_MUESTRA')
ORDER BY c.column_id;

SELECT
    fk.name AS foreign_key,
    OBJECT_NAME(fk.parent_object_id) AS tabla_origen,
    OBJECT_NAME(fk.referenced_object_id) AS tabla_referenciada
FROM sys.foreign_keys AS fk
WHERE fk.parent_object_id = OBJECT_ID('dbo.MONIPLA_ORIGEN_MUESTRA');
