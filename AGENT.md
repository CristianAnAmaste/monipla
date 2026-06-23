# Proyecto

Nombre:
Monitoreo de Plagas

Tecnologias:

* Node.js
* Express
* EJS
* SQL Server
* mssql
* express-session
* bcrypt

Arquitectura:

* Routes
* Controllers
* Services
* Repositories
* Views
* Public

Reglas:

* Nunca colocar SQL dentro de controllers.
* Nunca colocar SQL dentro de rutas.
* Todo acceso a datos debe pasar por repositories.
* Toda logica de negocio debe pasar por services.
* Controllers solo coordinan request/response.
* Utilizar consultas parametrizadas.
* Mantener orientacion a servicios.
* Mantener codigo modular.
* No crear archivos duplicados.
* Reutilizar servicios existentes cuando sea posible.

# Base De Datos

Tablas principales:

## MONIPLA_REL_CUARTEL_SDP

Proposito:
Resolver automaticamente:

* SDP
* CSG
* Trazabilidad

a partir de:

* gen_cuartel

## MONIPLA_ORIGEN_MUESTRA

Proposito:
Guardar origen logico de la muestra.

Clave funcional real detectada:

* gen_cuartel
* gen_variedad_campo
* id_rel_cuartel_sdp

## MONIPLA_MUESTREO

Proposito:
Cabecera del monitoreo.

Reglas confirmadas para CREATE de cabecera:

* numero_muestreo es correlativo funcional y no debe usarse id_muestreo como valor.
* fecha_muestreo se guarda con el mismo valor ingresado como fecha_revision_muestra mientras no exista campo visual separado.
* cant_unidades_muestreadas no se usa en esta etapa y debe insertarse explicitamente NULL.
* fecha_creacion se llena desde SQL Server con SYSDATETIME().
* fecha_modificacion queda NULL en CREATE.
* estado_resultado queda PENDIENTE al crear cabecera.

Estado funcional de resultados:

* PENDIENTE: cabecera creada sin resultado registrado.
* SIN_PLAGAS: monitoreo cerrado sin plagas detectadas; no crea filas en resultados.
* CON_PLAGAS: monitoreo cerrado con filas en MONIPLA_RESULTADO_PLAGA y MONIPLA_RESULTADO_CONTEO.

## MONIPLA_RESULTADO_PLAGA

Proposito:
Resultado por plaga observada.

Reglas confirmadas para CREATE de resultados:

* id_muestreo debe existir antes de registrar resultados.
* cantidad_total no se ingresa desde frontend; se calcula en backend sumando conteos validos.
* Una misma plaga no debe repetirse dentro del mismo muestreo.
* No se crea una plaga falsa para representar ausencia de plagas.
* No se insertan filas en MONIPLA_RESULTADO_PLAGA ni MONIPLA_RESULTADO_CONTEO cuando el estado es SIN_PLAGAS.
* La pantalla de resultados no debe mostrar error al abrir un muestreo ya cerrado; debe mostrar un estado informativo y ocultar el formulario.
* El ingreso de plagas se realiza como planilla unica de hallazgos y el backend agrupa las filas por plaga antes de guardar.

## MONIPLA_RESULTADO_CONTEO

Proposito:
Conteo detallado por estadio y estado.

Columna real para estado:

* id_estado_ejemplar

Reglas confirmadas para CREATE de conteos:

* Se validan id_estadio e id_estado_ejemplar contra catalogos activos.
* No se guardan cantidades negativas, decimales ni vacias.
* Cantidad 0 se omite para no ensuciar datos.
* No se permiten conteos duplicados para la misma combinacion id_estadio + id_estado_ejemplar dentro de una plaga.
* No se permite guardar resultados si MONIPLA_MUESTREO.estado_resultado ya es SIN_PLAGAS o CON_PLAGAS.
* Los logs backend de resultados usan prefijo [MONIPLA][RESULTADOS].
* En la planilla unica de hallazgos, los errores deben referirse a Fila 1, Fila 2, etc.; no usar lenguaje de bloques o conteos.
* La validacion principal de resultados debe ocurrir sobre filas planas antes de agrupar por plaga.
* Las filas completamente vacias se ignoran, pero cualquier fila con algun dato ingresado debe validarse completa.
* El total por plaga solo debe sumar filas completas y validas.

## MONIPLA_IMAGEN

Proposito:
Guardar evidencia fotografica del monitoreo completo.

Reglas confirmadas:

* Las imagenes se asocian a id_muestreo, no a una plaga especifica.
* Se pueden guardar tanto en SIN_PLAGAS como en CON_PLAGAS.
* Maximo 3 imagenes por muestreo.
* No se guardan imagenes en base64; se guardan como Buffer / VARBINARY.
* Las imagenes se procesan y comprimen con sharp antes de abrir la transaccion final.
* La transaccion de resultados tambien inserta MONIPLA_IMAGEN para proteger rollback completo.
* No se permite agregar mas imagenes si el muestreo ya tiene imagenes registradas mientras no exista edicion.

## Historial De Monitoreos

Reglas confirmadas:

* La fecha principal del historial es MONIPLA_MUESTREO.fecha_muestreo.
* En esta etapa, fecha_muestreo usa el mismo valor que fecha_revision_muestra.
* El historial no debe consultar MONIPLA_IMAGEN.imagen.
* La columna Evidencias solo muestra COUNT de MONIPLA_IMAGEN por id_muestreo.
* Los filtros de plaga y tipo de plaga deben usar EXISTS para no duplicar filas.
* El tipo de plaga usa MONIPLA_PLAGA.tipo_registro.
* La paginacion funcional del historial es de 20 registros por pagina.

## Detalle De Monitoreo

Reglas confirmadas:

* El detalle se carga bajo demanda desde el historial mediante GET /monitoreos/:idMuestreo/detalle-parcial.
* El historial no debe traer imagen binaria; solo puede mostrar cantidad de evidencias.
* La consulta de detalle tampoco debe traer MONIPLA_IMAGEN.imagen; solo metadata de evidencias.
* Las miniaturas se renderizan con GET /monitoreos/imagenes/:idImagen.
* El endpoint de imagen debe exigir sesion, validar id numerico, devolver buffer binario y no base64.
* El endpoint de imagen debe enviar Content-Type real, X-Content-Type-Options: nosniff y Cache-Control privado.
* Los resultados CON_PLAGAS se consultan como filas planas en repository y se agrupan por plaga en service.
* Los logs del detalle usan prefijo [MONIPLA][DETALLE].
* Los logs de visualizacion de imagenes usan prefijo [MONIPLA][IMAGENES].

# Flujo Funcional

## Registrar Monitoreo

1. Usuario selecciona:

* Fundo
* Campo
* Variedad
* Cuartel

2. Sistema resuelve:

* gen_variedad_campo
* id_rel_cuartel_sdp
* SDP
* CSG
* trazabilidad

3. Sistema busca o crea:

* MONIPLA_ORIGEN_MUESTRA

4. Sistema crea:

* MONIPLA_MUESTREO

5. Luego registra:

* MONIPLA_RESULTADO_PLAGA
* MONIPLA_RESULTADO_CONTEO

# Combos Dependientes

La logica correcta es:

GEN_FUNDO
-> GEN_CAMPO
-> GEN_VARIEDAD_CAMPO
-> GEN_CUARTEL

Nunca resolver desde SDP.

Siempre resolver desde GEN_CUARTEL hacia atras.

# Interfaz

Tema corporativo:

* Verde
* Blanco
* Tonos neutros

Sidebar:

Usuarios:

* Inicio
* Registrar Monitoreo
* Historial de Monitoreo
* Editar Monitoreo
* Cerrar Sesion

Administradores:

* Todo lo anterior
* Administracion de Usuarios

# Reglas Para Codex

Antes de modificar codigo:

1. Leer AGENT.md completo.
2. Revisar CHANGELOG_AI.md.
3. Analizar estructura existente.
4. Reutilizar arquitectura actual.
5. No reescribir modulos existentes innecesariamente.
6. Explicar archivos modificados.
7. Explicar impacto del cambio.

Cada vez que se trabaje en el proyecto:

1. Leer AGENT.md.
2. Leer CHANGELOG_AI.md.
3. Actualizar CHANGELOG_AI.md al finalizar.
4. Si se descubre nueva logica relevante, actualizar AGENT.md.
5. Mantener consistencia arquitectonica.
6. Nunca ignorar AGENT.md.

