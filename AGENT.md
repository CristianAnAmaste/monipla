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

