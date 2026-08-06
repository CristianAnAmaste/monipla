# AGENT.md - Monitoreo de Plagas

## 1. Proposito del proyecto

Sistema web interno para registrar, consultar y administrar monitoreos de plagas agricolas. Permite crear cabeceras de monitoreo, registrar resultados con o sin plagas, asociar evidencias fotograficas comprimidas y consultar historial con filtros y detalle bajo demanda.

## 2. Stack tecnico

- Node.js, Express, EJS, SQL Server, `mssql`, `express-session`, `bcrypt`, `multer`, `sharp`.
- Estructura: `src/app.js`, `src/routes`, `src/controllers`, `src/services`, `src/repositories`, `src/views`, `src/public/js`, `src/public/css`, `scripts`.

## 3. Arquitectura obligatoria

- Routes solo definen URLs, middlewares y delegan en controllers.
- Controllers coordinan `req`, `res`, render, redirect y codigos HTTP.
- Services contienen reglas de negocio, validaciones, normalizacion y orquestacion.
- Repositories contienen todo el SQL y usan parametros de `mssql`.
- Views renderizan EJS; no contienen SQL ni reglas de negocio.
- `public/js` maneja interaccion frontend; `public/css` maneja estilos.
- Mantener el patron routes -> controllers -> services -> repositories.
- No crear capas, archivos ni modulos duplicados si ya existe una pieza equivalente.

## 4. Reglas de desarrollo para Codex

- Antes de modificar, leer este `AGENT.md` y ejecutar `git status --short`.
- No hacer refactor global ni tocar modulos no solicitados.
- No cambiar base de datos sin aprobacion.
- No inventar columnas, tablas, estados ni catalogos.
- Verificar nombres reales de columnas en repositories o scripts antes de usarlos.
- No modificar login, usuarios, roles o sesiones salvo pedido explicito.
- No tocar `README.md` ni `CHANGELOG_AI.md` salvo pedido explicito o necesidad real de trazabilidad.
- No copiar historiales largos en este archivo.
- Entregar resumen de archivos modificados.
- Ejecutar `node --check` sobre JS modificado cuando corresponda.
- Ejecutar `git diff --check` al finalizar cambios de codigo o documentacion.

## Protocolo de bajo consumo de tokens para Codex

- Lectura minima por defecto: para una tarea nueva, leer primero solo `AGENT.md`. No leer `README.md`, `CHANGELOG_AI.md`, `GUIA_FUNCIONAMIENTO_SOFTWARE.md` ni `README_FRONTEND.md` por defecto.
- Leer documentos secundarios solo si la tarea lo pide, falta una decision historica o hay contradiccion funcional.
- Antes de abrir muchos archivos, definir internamente: tipo de tarea (frontend, backend, SQL, UX, documentacion o Git), modulo afectado, archivos exactos a revisar, archivos que no se deben tocar y si realmente hace falta documentacion secundaria.
- Evitar leer todo el proyecto. Usar busquedas especificas antes de lectura masiva: `rg "pageSize"`, `rg "OFFSET"`, `rg "detalle-parcial"`, `rg "MONIPLA_IMAGEN"`, `rg "estado_resultado"`, `rg "historial"` u otra busqueda dirigida segun la tarea.
- Lectura dirigida por caso:
  - Visual del historial: leer `historial.ejs`, `monitoreos-historial.js` y CSS relacionado. No leer repositories/services/controllers salvo problema de datos.
  - SQL: leer repository correspondiente y service relacionado. No leer CSS ni views salvo impacto visual.
  - Imagenes: leer rutas/controller/service/repository relacionados con imagenes y resultados. No leer historial completo salvo que la tarea sea mostrar imagenes.
  - Paginacion: buscar `pageSize`, `limit`, `OFFSET`, `FETCH`; revisar controller/service/repository/vista del historial. No tocar CSS.
- Antes de editar, listar archivos que se modificaran, archivos solo revisados, archivos que no se tocaran y motivo de cada modificacion.
- Prohibido aprovechar una tarea puntual para refactorizar, reordenar codigo, cambiar estilos globales, actualizar documentacion extensa, corregir temas no pedidos o tocar otros modulos.
- Salida final compacta: archivos modificados, cambio realizado, pruebas ejecutadas y riesgos pendientes. No dar explicaciones largas si no son necesarias.
- Leer `CHANGELOG_AI.md` solo si hay contradiccion funcional, se necesita entender una decision, el usuario pide trazabilidad historica o se modificara una regla ya implementada.
- Leer `README.md` solo para setup, instalacion, dependencias, ejecucion local o estructura general antigua no cubierta por `AGENT.md`.
- Leer `GUIA_FUNCIONAMIENTO_SOFTWARE.md` o `README_FRONTEND.md` solo si el usuario pide comparar documentacion antigua, se trabaja en layout global o se necesita una regla historica ausente. Asumir que pueden estar obsoletos.
- Modo reparacion puntual: ante bug visual o funcional especifico, reproducir mentalmente el alcance, buscar el archivo mas probable, hacer el cambio minimo y no reescribir el modulo.
- Modo implementacion nueva: leer `AGENT.md`, revisar solo archivos del modulo, proponer plan breve, implementar por fases y no mezclar PDF, edicion, eliminacion o reportes si no fueron pedidos.

## 5. Base de datos principal

Tablas MONIPLA vigentes:

- `MONIPLA_ORIGEN_MUESTRA`: origen logico. Clave funcional: `gen_cuartel`, `gen_variedad_campo`, `id_rel_cuartel_sdp`.
- `MONIPLA_MUESTREO`: cabecera. Claves: `id_muestreo`, `numero_muestreo`, `id_origen_muestra`, `fecha_muestreo`, `fecha_revision_muestra`, `id_estructura`, `cant_unidades_muestreadas`, `estado_resultado`, `id_usuario_creacion`.
- `MONIPLA_RESULTADO_PLAGA`: resultado por plaga. Claves: `id_resultado_plaga`, `id_muestreo`, `id_plaga`, `cantidad_total`, `observacion`.
- `MONIPLA_RESULTADO_CONTEO`: conteo por estadio/estado. Claves: `id_resultado_conteo`, `id_resultado_plaga`, `id_estadio`, `id_estado_ejemplar`, `cantidad`.
- `MONIPLA_IMAGEN`: evidencias. Claves: `id_imagen`, `id_muestreo`, `orden`, `imagen`, `mime`, `comentario`.
- `MONIPLA_PLAGA`: catalogo de plagas. Claves: `id_plaga`, `nombre_plaga`, `nombre_cientifico`, `tipo_registro`, `es_cuarentenaria`, `activo`.
- `MONIPLA_ESTADIO`: catalogo de estadios. Claves: `id_estadio`, `nombre_estadio`, `activo`.
- `MONIPLA_ESTADO_EJEMPLAR`: catalogo de estados. Claves: `id_estado_ejemplar`, `nombre_estado`, `activo`.
- `MONIPLA_ESTRUCTURA`: catalogo de estructuras. Claves: `id_estructura`, `nombre_estructura`, `activo`.
- `MONIPLA_REL_CUARTEL_SDP`: relacion cuartel, SDP, CSG y trazabilidad. Claves: `id_rel_cuartel_sdp`, `gen_cuartel`, `codigo_cuartel`, `trazabilidad`, `sdp`, `csg`, `activo`.
- Combos agricolas: `GEN_FUNDO`, `GEN_CAMPO`, `GEN_VARIEDAD`, `GEN_CUARTEL`, `GEN_VARIEDAD_CAMPO`.
- Usuarios: `usuarios_sistema`. No modificar sin pedido explicito.

## 6. Flujo actual implementado

### Cabecera de monitoreo

- Se guarda en `MONIPLA_MUESTREO`; el origen se guarda o reutiliza en `MONIPLA_ORIGEN_MUESTRA`.
- `numero_muestreo` es correlativo funcional; no usar `id_muestreo` como numero.
- `fecha_muestreo` usa `fecha_revision_muestra` mientras no exista campo visual separado.
- `cant_unidades_muestreadas` `NULL`; `fecha_creacion` usa `SYSDATETIME()`; `fecha_modificacion` queda `NULL` en CREATE.
- `estado_resultado` inicia como `PENDIENTE`.
- Resolucion agricola desde `GEN_CUARTEL`, no desde SDP.
- Flujo de combos: `GEN_FUNDO` -> `GEN_CAMPO` -> `GEN_VARIEDAD_CAMPO` -> `GEN_CUARTEL`.
- El sistema resuelve `gen_variedad_campo`, `id_rel_cuartel_sdp`, SDP, CSG y trazabilidad.

### Resultados

- `SIN_PLAGAS` se guarda en `MONIPLA_MUESTREO.estado_resultado`.
- `CON_PLAGAS` inserta en `MONIPLA_RESULTADO_PLAGA` y `MONIPLA_RESULTADO_CONTEO`.
- No existe plaga falsa "Sin plagas"; `id_plaga` es `NOT NULL` y no debe hacerse nullable.
- `cantidad_total` se calcula en backend. No confiar en totales del frontend.
- Una misma plaga no debe repetirse dentro del mismo muestreo.
- No se insertan resultados ni conteos cuando el estado es `SIN_PLAGAS`.
- No guardar resultados si el muestreo ya esta `SIN_PLAGAS` o `CON_PLAGAS`.
- El ingreso `CON_PLAGAS` usa planilla unica de hallazgos con filas planas.
- Validar filas planas antes de agrupar: filas vacias se ignoran; filas parciales fallan; cantidad debe ser entero positivo; cantidad 0 se omite.
- No permitir duplicados por `id_plaga` + `id_estadio` + `id_estado_ejemplar`.
- Validar `id_estadio` e `id_estado_ejemplar` contra catalogos activos.
- Errores deben referirse a "Fila 1", "Fila 2", etc.
- Logs de resultados: `[MONIPLA][RESULTADOS]`.

### Evidencias

- Se guardan en `MONIPLA_IMAGEN`, asociadas a `id_muestreo`, no a una plaga.
- Se permiten en `SIN_PLAGAS` y `CON_PLAGAS`.
- Maximo 3 imagenes por muestreo.
- Comprimir con `sharp` antes de la transaccion final.
- No base64; guardar como `Buffer` / `VARBINARY`.
- La transaccion de resultados inserta imagenes para rollback conjunto.
- No agregar mas imagenes a un muestreo cerrado mientras no exista edicion.
- Endpoint seguro: `GET /monitoreos/imagenes/:idImagen`.

### Historial

- Existe historial con filtros y paginacion.
- Fecha principal: `MONIPLA_MUESTREO.fecha_muestreo`.
- Filtros: fundo, campo, variedad, cuartel, fecha monitoreo, estructura, plaga, tipo de plaga si existe y `estado_resultado`.
- Filtros de plaga/tipo usan `EXISTS`; tipo usa `MONIPLA_PLAGA.tipo_registro`.
- No traer `MONIPLA_IMAGEN.imagen`; solo conteo de evidencias.
- Paginacion vigente: 10 registros por pagina.
- Detalle bajo demanda con toggler.

### Detalle de monitoreo

- Se carga desde historial con `GET /monitoreos/:idMuestreo/detalle-parcial`.
- No traer imagen binaria; solo metadata de evidencias.
- Miniaturas por `GET /monitoreos/imagenes/:idImagen`.
- Resultados `CON_PLAGAS`: repository devuelve filas planas y service agrupa por plaga.
- Logs: `[MONIPLA][DETALLE]` y `[MONIPLA][IMAGENES]`.

## 7. Estados de resultado

- `PENDIENTE`: cabecera creada sin resultado registrado.
- `SIN_PLAGAS`: monitoreo cerrado sin plagas; no crea filas en resultados ni conteos.
- `CON_PLAGAS`: monitoreo cerrado con una o mas plagas y conteos guardados.

## 8. Reglas de imagenes

- No usar base64.
- No traer binario en listados ni detalle parcial.
- Leer binario solo desde `GET /monitoreos/imagenes/:idImagen`.
- Endpoint exige sesion, valida `idImagen` numerico, envia `Content-Type` real, `X-Content-Type-Options: nosniff` y cache privado.
- Validar MIME permitido y comprimir antes de guardar.
- En historial principal mostrar conteo y miniaturas bajo demanda, no imagenes completas.

## 9. Reglas UX vigentes

- Formularios simples y orientados a usuarios agricolas.
- Historial compacto; evitar scroll horizontal general.
- No repetir cabecera completa en detalle.
- Detalle bajo demanda en `tr` separado con `colspan="7"`.
- Tabla historial debe tener 7 `th` y 7 `td`.
- Si una tabla requiere scroll, contenerlo en wrapper especifico.
- Evitar tarjetas enormes y bloques repetidos.
- Mantener el detalle enfocado en resultado, conteos y evidencias.
- En resultados cerrados, mostrar estado informativo y ocultar formulario.
- Mantener textos compactos y legibles con nombres agricolas largos.


## 11. Que NO hacer sin aprobacion

- No cambiar estructura de base de datos ni ejecutar scripts SQL de migracion.
- No crear plagas falsas ni hacer `id_plaga` nullable.
- No guardar imagenes en base64 ni traer binarios en historial/detalle parcial.
- No implementar PDF antes de estabilizar detalle.
- No tocar login, usuarios, roles, sedes ni sesiones.
- No reescribir arquitectura ni mover SQL fuera de repositories.
- No reescribir CSS global sin necesidad puntual.
- No cambiar rutas publicas existentes sin confirmar impacto.
- No borrar, mover ni renombrar documentos `.md` sin aprobacion.

## 12. Documentos secundarios

- `AGENT.md`: fuente principal para Codex. Leer por defecto.
- `CHANGELOG_AI.md`: historial de cambios. Leer solo para contradicciones, decisiones historicas o trazabilidad.
- `README.md`: setup inicial, instalacion, dependencias y ejecucion local.
- `GUIA_FUNCIONAMIENTO_SOFTWARE.md`: referencia tecnica antigua; puede estar obsoleta.
- `README_FRONTEND.md`: referencia frontend antigua; util para layout base, puede estar obsoleta.
- cuando se agreguen mas estaciones o campos se debe mejorar aqui la tabla, recuerda que tiene prioridad segun el lugar donde esta la estacion o la muestra, por ejemplo estaba la estacion de las terrazas pero esta mala, entonces para esos sectores se utiliza nantoco.
