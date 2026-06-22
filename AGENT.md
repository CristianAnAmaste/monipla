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

## MONIPLA_MUESTREO

Proposito:
Cabecera del monitoreo.

## MONIPLA_RESULTADO_PLAGA

Proposito:
Resultado por plaga observada.

## MONIPLA_RESULTADO_CONTEO

Proposito:
Conteo detallado por estadio y estado.

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

