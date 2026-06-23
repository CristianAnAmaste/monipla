# CHANGELOG AI

Bitacora tecnica de cambios realizados por IA en el proyecto Monitoreo de Plagas.

Cada entrada debe mantener el siguiente formato:

Fecha:
Modulo:
Archivos modificados:
Motivo:
Resumen tecnico:
Impacto:
Pendientes:

## 2026-06-22

Modulo:
Memoria permanente y bitacora tecnica del proyecto.

Archivos modificados:

* AGENT.md
* CHANGELOG_AI.md

Motivo:
Creacion de archivos base para documentar reglas permanentes del proyecto y mantener historial tecnico de cambios realizados por IA.

Resumen tecnico:
Se agrego AGENT.md con la descripcion del proyecto, tecnologias, arquitectura, reglas de desarrollo, tablas principales, flujo funcional de Registrar Monitoreo, reglas de combos dependientes, criterios de interfaz y reglas obligatorias para Codex. Se agrego CHANGELOG_AI.md como bitacora tecnica inicial con formato obligatorio para futuras entradas.

Impacto:
Las futuras sesiones de Codex tienen una fuente persistente para mantener la arquitectura Routes, Controllers, Services, Repositories, Views y Public; evitar SQL en controllers o rutas; centralizar acceso a datos en repositories; y registrar cada cambio en la bitacora.

Pendientes:
Mantener ambos documentos actualizados cuando se descubra nueva logica funcional o se realicen cambios tecnicos en el proyecto.

## 2026-06-22

Modulo:
Registrar Monitoreo - CREATE cabecera.

Archivos modificados:

* AGENT.md
* CHANGELOG_AI.md
* src/controllers/monitoreos.controller.js
* src/services/monitoreos.service.js
* src/repositories/monitoreos.repository.js

Motivo:
Implementar el guardado real de la cabecera del monitoreo contra SQL Server y eliminar el mensaje placeholder de guardado pendiente.

Resumen tecnico:
Se agrego guardado transaccional de cabecera usando MONIPLA_ORIGEN_MUESTRA y MONIPLA_MUESTREO. El repositorio busca o crea el origen por gen_cuartel, gen_variedad_campo e id_rel_cuartel_sdp, genera numero_muestreo dentro de la transaccion con UPDLOCK y HOLDLOCK, e inserta MONIPLA_MUESTREO con fecha_muestreo igual a fecha_revision_muestra, cant_unidades_muestreadas NULL explicito, fecha_creacion con SYSDATETIME() y fecha_modificacion NULL. El servicio revalida el formulario, exige confirmacion previa, exige usuario autenticado y prepara un payload limpio. El controller usa el nuevo servicio y muestra mensaje real de exito.

Impacto:
El formulario Registrar Monitoreo ahora crea cabecera real en base de datos tras confirmar el resumen. No se implementaron resultados de plaga, conteo, historial, edicion, eliminacion, reportes, dashboard ni cambios de usuarios/login.

Pendientes:
Agregar pruebas automatizadas y avanzar en etapas posteriores con resultados de plaga/conteo e historial cuando se solicite.

## 2026-06-22

Modulo:
Registrar Monitoreo - CREATE resultados.

Archivos modificados:

* AGENT.md
* CHANGELOG_AI.md
* src/controllers/monitoreos.controller.js
* src/public/css/styles.css
* src/repositories/monitoreos.repository.js
* src/routes/monitoreos.routes.js
* src/services/monitoreos.service.js

Archivos nuevos:

* src/public/js/monitoreos-resultados.js
* src/views/monitoreos/resultados.ejs

Motivo:
Implementar el registro real de resultados asociados a un muestreo existente usando MONIPLA_RESULTADO_PLAGA y MONIPLA_RESULTADO_CONTEO.

Resumen tecnico:
Se agregaron rutas GET y POST para /monitoreos/:idMuestreo/resultados. El CREATE de cabecera redirige al formulario de resultados. El repositorio obtiene resumen del muestreo, lista catalogos activos de plagas, estadios y estados de ejemplar, e inserta resultados en una transaccion. El servicio valida id_muestreo, payload, catalogos activos, cantidades enteras positivas, duplicados de plaga y duplicados de estadio/estado; omite cantidades 0 y calcula cantidad_total desde los conteos validos. Se creo una vista EJS con formulario dinamico y JS para agregar plagas y conteos.

Impacto:
Un muestreo existente puede recibir resultados de una o mas plagas con conteos asociados. No se implementaron edicion, eliminacion, historial completo, reportes, dashboard ni cambios de usuarios/login.

Pendientes:
Agregar pruebas automatizadas, decidir flujo de historial/listado y definir comportamiento para reintentos sobre plagas ya registradas en un muestreo.

## 2026-06-22

Modulo:
Registrar Monitoreo - estado de resultados.

Archivos modificados:

* AGENT.md
* CHANGELOG_AI.md
* src/controllers/monitoreos.controller.js
* src/public/css/styles.css
* src/public/js/monitoreos-resultados.js
* src/repositories/monitoreos.repository.js
* src/services/monitoreos.service.js
* src/views/monitoreos/resultados.ejs

Archivos nuevos:

* scripts/agregar_estado_resultado_muestreo.sql

Motivo:
Adaptar el flujo porque MONIPLA_RESULTADO_PLAGA.id_plaga es NOT NULL y no se debe crear una plaga falsa para representar ausencia de plagas.

Resumen tecnico:
Se agrego un script SQL idempotente para extender MONIPLA_MUESTREO con estado_resultado, observacion_resultado, fecha_resultado e id_usuario_resultado, mas CHECK de estados PENDIENTE, SIN_PLAGAS y CON_PLAGAS. El CREATE de cabecera inserta estado_resultado PENDIENTE. El formulario de resultados permite elegir entre SIN_PLAGAS y CON_PLAGAS. SIN_PLAGAS actualiza solo MONIPLA_MUESTREO en transaccion. CON_PLAGAS inserta resultados y conteos, y al finalizar actualiza MONIPLA_MUESTREO a CON_PLAGAS dentro de la misma transaccion. Se bloquea el guardado si el muestreo ya tiene estado SIN_PLAGAS o CON_PLAGAS.

Impacto:
La ausencia de plagas queda trazada en la cabecera del muestreo sin contaminar catalogos ni tablas de resultado. La escritura de resultados queda cerrada a un unico CREATE hasta que se implemente edicion.

Pendientes:
Ejecutar el script SQL idempotente en cada ambiente antes de usar el nuevo flujo y definir la futura etapa de edicion de resultados.

## 2026-06-22

Modulo:
Registrar Monitoreo - UX resultados y trazabilidad.

Archivos modificados:

* AGENT.md
* CHANGELOG_AI.md
* src/controllers/monitoreos.controller.js
* src/public/css/styles.css
* src/public/js/monitoreos-resultados.js
* src/repositories/monitoreos.repository.js
* src/services/monitoreos.service.js
* src/views/monitoreos/resultados.ejs

Motivo:
Corregir la experiencia posterior a guardar SIN_PLAGAS y simplificar el ingreso de resultados para usuarios agricolas no tecnicos.

Resumen tecnico:
La vista de resultados ahora muestra un estado informativo cuando el muestreo ya esta cerrado como SIN_PLAGAS o CON_PLAGAS, oculta el formulario y evita mostrar la advertencia de edicion como error en GET. El ingreso CON_PLAGAS se cambio a una planilla unica de hallazgos con columnas plaga, estadio, estado y cantidad. El JS genera un payload plano de resultados y muestra totales por plaga. El service acepta filas planas, las agrupa por id_plaga, valida duplicados plaga/estadio/estado y mantiene el calculo de cantidad_total en backend. Se agregaron logs con prefijo [MONIPLA][RESULTADOS] en controller, service y repository.

Impacto:
El flujo SIN_PLAGAS queda claro para el usuario despues del guardado correcto y el registro CON_PLAGAS requiere menos scroll y menos clics. No se implemento edicion, eliminacion, historial, reportes, dashboard ni cambios de login/usuarios.

Pendientes:
Probar manualmente con datos reales y definir una vista futura de solo lectura para consultar resultados CON_PLAGAS con detalle.

## 2026-06-23

Modulo:
Registrar Monitoreo - validacion UX de planilla de resultados.

Archivos modificados:

* AGENT.md
* CHANGELOG_AI.md
* src/controllers/monitoreos.controller.js
* src/public/css/styles.css
* src/public/js/monitoreos-resultados.js
* src/services/monitoreos.service.js
* src/views/monitoreos/resultados.ejs

Motivo:
Corregir mensajes y comportamiento de validacion para que coincidan con la planilla unica de hallazgos.

Resumen tecnico:
El frontend valida filas visibles antes de enviar, marca la fila y el campo con error, enfoca el primer campo invalido, excluye filas incompletas del total por plaga y evita el envio cuando hay datos parciales. El backend valida primero filas planas con numero de fila original y solo despues agrupa filas validas por plaga. Los mensajes dejan de hablar de bloques/conteos y usan "Fila X". Se agregaron logs de validacion y resumen de filas recibidas con prefijo [MONIPLA][RESULTADOS].

Impacto:
La experiencia de captura queda alineada con la tabla plana. La seguridad backend se mantiene aunque el frontend sea omitido. No se tocaron base de datos, edicion, historial ni PDF.

Pendientes:
Probar manualmente en navegador con datos reales y revisar futura vista de detalle/historial.

## 2026-06-23

Modulo:
Registrar Monitoreo - evidencia fotografica.

Archivos modificados:

* AGENT.md
* CHANGELOG_AI.md
* package.json
* package-lock.json
* src/controllers/monitoreos.controller.js
* src/public/css/styles.css
* src/public/js/monitoreos-resultados.js
* src/repositories/monitoreos.repository.js
* src/routes/monitoreos.routes.js
* src/services/monitoreos.service.js
* src/views/monitoreos/resultados.ejs

Motivo:
Permitir adjuntar hasta 3 imagenes de evidencia por monitoreo al guardar resultados, sin base64 y con compresion previa.

Resumen tecnico:
Se agregaron multer y sharp. El POST de resultados acepta multipart en memoria con tres slots de evidencia. La vista muestra tres cuadros fijos con preview, comentario y boton quitar. El service valida MIME, tamano original, comentario y comprime con sharp usando rotate, resize maximo 1280x1280 y salida WebP/JPEG bajo limite. El repository inserta MONIPLA_IMAGEN con sql.VarBinary(sql.MAX) dentro de la misma transaccion de resultados. Se agregaron logs [MONIPLA][IMAGENES].

Impacto:
SIN_PLAGAS y CON_PLAGAS pueden guardar evidencia opcional asociada al id_muestreo con rollback conjunto. No se implemento edicion, eliminacion, PDF, historial ni visualizacion de imagenes guardadas.

Pendientes:
Probar manualmente con imagenes reales de terreno y definir endpoint/vista de lectura para historial o detalle.

## 2026-06-23

Modulo:
Historial de monitoreos.

Archivos modificados:

* AGENT.md
* CHANGELOG_AI.md
* src/controllers/monitoreos.controller.js
* src/public/css/styles.css
* src/repositories/monitoreos.repository.js
* src/routes/monitoreos.routes.js
* src/services/monitoreos.service.js

Archivos nuevos:

* src/views/monitoreos/historial.ejs

Motivo:
Implementar la vista GET /monitoreos/historial con filtros y paginacion para consultar monitoreos registrados.

Resumen tecnico:
Se reemplazo el placeholder de historial por una vista EJS con filtros por fundo, campo, variedad, cuartel, fecha de monitoreo, estructura, plaga, tipo de plaga y estado_resultado. El repository agrega consultas parametrizadas con paginacion de 20 registros, filtros EXISTS para plaga/tipo de plaga, OUTER APPLY para totales y conteo de evidencias. No se consulta MONIPLA_IMAGEN.imagen. El service normaliza filtros, valida fechas, formatea estados para badges y prepara valores de tabla.

Impacto:
El usuario puede consultar monitoreos registrados sin cargar imagenes binarias ni duplicar filas por resultados de plagas. Queda preparada una ruta placeholder de detalle para la siguiente fase. No se implementaron PDF, Excel, edicion, eliminacion ni visualizacion de imagenes.

Pendientes:
Implementar detalle de monitoreo con resultados e imagenes en una fase posterior y probar filtros con volumen real.

## 2026-06-23

Modulo:
Historial de monitoreos - detalle desplegable.

Archivos modificados:

* AGENT.md
* CHANGELOG_AI.md
* src/controllers/monitoreos.controller.js
* src/public/css/styles.css
* src/repositories/monitoreos.repository.js
* src/routes/monitoreos.routes.js
* src/services/monitoreos.service.js
* src/views/monitoreos/historial.ejs

Archivos nuevos:

* src/public/js/monitoreos-historial.js
* src/views/monitoreos/partials/detalle-muestreo.ejs

Motivo:
Permitir consultar el detalle de un monitoreo desde el historial sin abandonar filtros ni paginacion, y mostrar evidencias mediante endpoint seguro.

Resumen tecnico:
Se agrego GET /monitoreos/:idMuestreo/detalle-parcial para renderizar un parcial EJS con cabecera, estado, resultados agrupados por plaga, conteos y metadata de evidencias. Se agrego GET /monitoreos/imagenes/:idImagen para devolver la imagen como buffer con Content-Type real, X-Content-Type-Options nosniff y Cache-Control privado. El historial ahora usa JS para abrir un unico detalle bajo demanda debajo de la fila seleccionada. Las consultas de historial y detalle no cargan MONIPLA_IMAGEN.imagen; el binario solo se consulta en el endpoint especifico de imagen.

Impacto:
El usuario puede revisar monitoreos PENDIENTE, SIN_PLAGAS y CON_PLAGAS desde el historial con una experiencia compacta y sin cargar imagenes pesadas en el listado. No se implemento PDF, Excel, edicion, eliminacion ni descarga masiva.

Pendientes:
Probar visualmente con datos productivos, revisar permisos finos por perfil si aplica y usar este detalle como base para una futura etapa PDF.

## 2026-06-23

Modulo:
Historial de monitoreos - compactacion UX/UI.

Archivos modificados:

* CHANGELOG_AI.md
* src/public/css/styles.css
* src/public/js/monitoreos-historial.js
* src/views/monitoreos/historial.ejs
* src/views/monitoreos/partials/detalle-muestreo.ejs

Motivo:
Reducir desborde horizontal y mejorar la lectura rapida del historial y del detalle desplegable.

Resumen tecnico:
Se compacto la tabla principal del historial de 12 columnas a 7 columnas agrupadas: Nro/Fecha, Origen, Estructura, Estado, Resultado, Evidencias y Accion. El detalle parcial se rediseño como panel compacto con contexto agricola en lineas, resultado por estado, plagas en tarjetas livianas con tabla de conteos angosta y evidencias como miniaturas fijas. El JS del historial conserva un unico detalle abierto y evita volver a pedir el HTML parcial si ya fue cargado. No se modificaron consultas SQL, endpoints ni reglas de negocio.

Impacto:
El historial queda mas legible, reduce scroll horizontal innecesario y el detalle prioriza resultados e imagenes en vez de repetir toda la ficha administrativa. No se implemento PDF, Excel, edicion, eliminacion, dashboard ni cambios de base de datos.

Pendientes:
Validar visualmente en navegador con nombres largos reales y usar el detalle compacto como base para una futura salida PDF.

## 2026-06-23

Modulo:
Historial de monitoreos - correccion de corte de texto.

Archivos modificados:

* CHANGELOG_AI.md
* src/public/css/styles.css
* src/views/monitoreos/historial.ejs
* src/views/monitoreos/partials/detalle-muestreo.ejs

Motivo:
Corregir la columna Origen del historial, que se estaba cortando letra por letra por reglas CSS demasiado agresivas.

Resumen tecnico:
Se cambio la tabla del historial a table-layout auto con min-width razonable y scroll horizontal solo dentro del contenedor de tabla. Se agrego el wrapper especifico historial-table-wrapper y se elimino la transformacion movil del historial a celdas tipo bloque para evitar columnas estrechas. Se reemplazo overflow-wrap anywhere por break-word/word-break normal en las celdas de historial y detalle. La columna Origen queda con min-width y max-width controlados para mostrar Fundo/Campo y Variedad/Cuartel en lineas normales. Se mantuvo la estructura compacta del detalle y se cambiaron separadores visuales no ASCII por guiones para evitar mojibake.

Impacto:
El historial conserva las 7 columnas compactas y el detalle desplegable, pero evita filas excesivamente altas por texto cortado letra a letra. No se modificaron backend, SQL, repositories, services, controllers, rutas, base de datos, PDF ni reglas de negocio.

Pendientes:
Validar en navegador con nombres largos reales y distintos anchos de pantalla.

