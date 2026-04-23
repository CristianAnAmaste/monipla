# Guia de funcionamiento del software Monitoreo de Plagas

Este documento explica, en lenguaje simple, como esta funcionando actualmente el proyecto. No reemplaza al `README.md` original; sirve como guia de trabajo para entender la arquitectura, el modulo de usuarios y las tablas disponibles en la base.

## 1. Resumen general

El sistema es una aplicacion web hecha con:

- Node.js como runtime.
- Express como servidor web.
- EJS como motor de vistas HTML.
- SQL Server como base de datos.
- `mssql` para conectarse a SQL Server.
- `express-session` para manejar sesiones de usuario.
- `bcrypt` para validar y guardar contrasenas encriptadas.

El estilo de programacion que se esta usando es ordenado por capas:

- Rutas: reciben la URL y mandan la peticion al controlador.
- Controladores: manejan `req` y `res`, renderizan vistas o redirigen.
- Servicios: contienen las reglas de negocio y validaciones.
- Repositorios: hacen las consultas SQL a la base de datos.
- Vistas EJS: muestran formularios, tablas y pantallas.
- Middlewares: protegen rutas o revisan permisos.

Esta separacion es buena para seguir creciendo el software, porque evita mezclar SQL, reglas y HTML en un solo archivo.

## 2. Como arranca el sistema

El archivo principal es `src/app.js`.

Paso a paso:

1. Carga variables de entorno desde `.env`.
2. Crea una aplicacion Express.
3. Configura EJS como motor de vistas.
4. Define la carpeta `src/public` como carpeta publica para CSS y archivos estaticos.
5. Activa lectura de formularios con `express.urlencoded`.
6. Activa lectura de JSON con `express.json`.
7. Configura sesiones con cookie llamada `monitoreo.sid`.
8. Carga en `res.locals` el usuario conectado y el menu principal.
9. Si alguien entra a `/`, lo manda a `/home` si tiene sesion o a `/login` si no tiene sesion.
10. Registra las rutas de autenticacion, inicio, usuarios y monitoreos.
11. Maneja errores 404 y errores internos.
12. Levanta el servidor en el puerto configurado o en `3000`.

## 3. Conexion a SQL Server

La conexion esta en `src/config/db.js`.

El proyecto usa un `ConnectionPool` de SQL Server. Eso significa que la aplicacion mantiene una conexion reutilizable para no abrir una conexion nueva en cada consulta.

La configuracion sale desde `.env`:

- Usuario SQL.
- Password SQL.
- Servidor.
- Base de datos.
- Encriptacion.
- Confianza en certificado.

En esta revision, la base configurada en `.env` es `SistemaRiego`. Dentro de esa base existen tablas de monitoreo de plagas con prefijo `MONIPLA_`.

## 4. Flujo de login

Archivos principales:

- `src/routes/auth.routes.js`
- `src/controllers/auth.controller.js`
- `src/services/auth.service.js`
- `src/repositories/auth.repository.js`
- `src/views/layouts/auth.ejs`
- `src/views/auth/login.ejs`

Paso a paso:

1. El usuario entra a `/login`.
2. `AuthController.showLogin` muestra el formulario de login.
3. El usuario ingresa correo y contrasena.
4. El formulario envia `POST /login`.
5. `AuthController.login` recibe los datos.
6. `AuthService.login` valida que correo y contrasena existan.
7. El correo se normaliza: se limpia con `trim()` y se pasa a minusculas.
8. `AuthRepository.findByCorreo` busca el usuario en `usuarios_sistema`.
9. Si el usuario no existe o esta inactivo, devuelve credenciales invalidas.
10. Si existe, `bcrypt.compare` compara la contrasena escrita contra el hash guardado.
11. Si la contrasena es correcta, se regenera la sesion.
12. Se guarda en sesion un objeto con `id`, `nombre`, `correo`, `rol` y `sede`.
13. El usuario es redirigido a `/home`.

La contrasena real nunca se guarda en sesion. Solo se usa para comparar contra el hash.

## 5. Flujo de logout

Paso a paso:

1. El usuario hace clic en `Cerrar sesion`.
2. La ruta `/logout` llama a `AuthController.logout`.
3. Se destruye la sesion con `req.session.destroy`.
4. Se limpia la cookie `monitoreo.sid`.
5. El usuario vuelve a `/login`.

## 6. Proteccion de rutas

Hay dos middlewares importantes:

- `ensureAuthenticated`: exige que exista `req.session.usuario`.
- `ensureAdmin`: exige que el usuario conectado tenga `rol === 'admin'`.

Uso actual:

- `/home` requiere usuario autenticado.
- `/monitoreos/nuevo` requiere usuario autenticado.
- `/monitoreos/historial` requiere usuario autenticado.
- `/monitoreos/editar` requiere usuario autenticado.
- Todas las rutas `/usuarios` requieren usuario autenticado y rol admin.

Si un usuario no autenticado intenta entrar a una ruta privada, se redirige a `/login`.

Si un usuario autenticado sin rol admin intenta entrar a usuarios, se redirige a `/home`.

## 7. Menu principal

El menu se arma en `src/services/navigation.service.js`.

El servicio recibe:

- Usuario conectado.
- Ruta actual.

Con eso construye el menu lateral.

Opciones normales:

- Inicio.
- Registrar Monitoreo.
- Historial de Monitoreo.
- Editar Monitoreo.
- Cerrar sesion.

Opcion solo para admin:

- Administracion de Usuarios.

El menu tambien marca como activa la opcion que coincide con la ruta actual.

## 8. Dashboard o inicio

Archivos:

- `src/routes/home.routes.js`
- `src/controllers/home.controller.js`
- `src/services/dashboard.service.js`
- `src/views/home/index.ejs`

Paso a paso:

1. El usuario entra a `/home`.
2. Se valida que este autenticado.
3. `HomeController.index` renderiza el layout principal.
4. `DashboardService.buildCards` arma las tarjetas visibles.
5. Si el usuario es admin, agrega la tarjeta de administracion de usuarios.

Actualmente el dashboard funciona como panel de accesos.

## 9. Modulo de usuarios

Este es el modulo mas completo del sistema hasta ahora.

Archivos principales:

- `src/routes/usuarios.routes.js`
- `src/controllers/usuarios.controller.js`
- `src/services/usuarios.service.js`
- `src/repositories/usuarios.repository.js`
- `src/views/usuarios/index.ejs`
- `src/views/usuarios/nuevo.ejs`
- `src/views/usuarios/editar.ejs`
- `src/views/usuarios/cambiar-password.ejs`

### 9.1. Listar usuarios

Ruta:

- `GET /usuarios`

Paso a paso:

1. Se valida sesion con `ensureAuthenticated`.
2. Se valida rol admin con `ensureAdmin`.
3. `UsuariosController.index` llama a `UsuariosService.listarUsuarios`.
4. El servicio llama a `UsuariosRepository.findAll`.
5. SQL consulta `usuarios_sistema`.
6. La vista `usuarios/index.ejs` muestra una tabla con usuarios.

Campos mostrados:

- Nombre.
- Correo.
- Rol.
- Sede.
- Activo.
- Fecha de creacion.
- Acciones.

Acciones disponibles:

- Editar.
- Cambiar contrasena.
- Activar o desactivar.

El boton de desactivar se bloquea cuando el usuario de la fila es el mismo usuario conectado. Esto evita que un admin se desactive a si mismo desde la tabla.

### 9.2. Crear usuario

Rutas:

- `GET /usuarios/nuevo`
- `POST /usuarios`

Paso a paso:

1. El admin entra a `/usuarios/nuevo`.
2. Se muestra el formulario.
3. El admin ingresa nombre, correo, contrasena, confirmacion, rol, sede y estado activo.
4. `UsuariosService.crearUsuario` normaliza los datos.
5. Se validan campos obligatorios.
6. Se valida que la contrasena y confirmacion coincidan.
7. Se valida que el rol sea uno de los permitidos.
8. Se valida que la sede sea una de las permitidas.
9. Se revisa que no exista otro usuario con el mismo correo.
10. Si todo esta bien, se genera hash con bcrypt usando 12 rondas.
11. `UsuariosRepository.create` inserta el usuario en `usuarios_sistema`.
12. El sistema redirige a `/usuarios?creado=1`.

Roles permitidos actualmente:

- `admin`
- `usuario`

Sedes permitidas actualmente:

- `Copiapo`
- `Vicuna`

### 9.3. Editar usuario

Rutas:

- `GET /usuarios/:id/editar`
- `POST /usuarios/:id/editar`

Paso a paso:

1. El admin abre el formulario de edicion.
2. El sistema busca el usuario por `id`.
3. Si no existe, vuelve al listado con error.
4. Si existe, muestra nombre, correo, rol, sede y activo.
5. Al guardar, el servicio valida los datos.
6. Se revisa que el correo no este usado por otro usuario.
7. Si el admin esta editando su propio usuario, no puede quitarse el rol admin.
8. Si el admin esta editando su propio usuario, no puede desactivarse.
9. Si todo esta correcto, se actualiza `usuarios_sistema`.
10. Si el admin edito su propio nombre, correo, rol o sede, tambien se actualiza la sesion actual.
11. Redirige a `/usuarios?actualizado=1`.

### 9.4. Cambiar contrasena de usuario

Rutas:

- `GET /usuarios/:id/password`
- `POST /usuarios/:id/password`

Paso a paso:

1. El admin abre el formulario de cambio de contrasena.
2. El sistema busca el usuario por `id`.
3. Se muestra un resumen con nombre y correo.
4. El admin ingresa nueva contrasena y confirmacion.
5. Se valida que ambas existan.
6. Se valida que coincidan.
7. Se genera un nuevo hash bcrypt.
8. Se actualiza solo el campo `contrasena`.
9. Redirige a `/usuarios?password=1`.

El sistema no muestra ni recupera contrasenas antiguas. Eso es correcto.

### 9.5. Activar o desactivar usuario

Ruta:

- `POST /usuarios/:id/toggle-activo`

Paso a paso:

1. El admin presiona Activar o Desactivar.
2. El sistema busca el usuario.
3. Si no existe, vuelve con error.
4. Si el admin intenta cambiar su propio estado, el sistema lo bloquea.
5. Si es otro usuario, cambia `activo` de `1` a `0` o de `0` a `1`.
6. Redirige a `/usuarios?activo=1`.

## 10. Modulo de monitoreos

Archivos:

- `src/routes/monitoreos.routes.js`
- `src/controllers/monitoreos.controller.js`
- `src/views/monitoreos/placeholder.ejs`

Rutas actuales:

- `GET /monitoreos/nuevo`
- `GET /monitoreos/historial`
- `GET /monitoreos/editar`

Estas rutas ya estan conectadas al menu y al dashboard, pero todavia muestran pantallas de preparacion.

Todavia no existe logica real de:

- Crear muestreos.
- Buscar cuarteles.
- Guardar resultados.
- Subir imagenes.
- Editar monitoreos.
- Consultar historial real.

La base de datos ya tiene tablas que parecen preparadas para ese modulo.

## 11. Tablas detectadas en la base configurada

Base consultada:

- `SistemaRiego`

Tablas reales detectadas:

- `dbo._bak_MONI_CUARTELSDP_yyyyMMdd_hhmm`
- `dbo.Calicata`
- `dbo.Calicatas_Nueva`
- `dbo.calidad_regulacion`
- `dbo.calidad_regulacion_stg`
- `dbo.calidad_usuarios`
- `dbo.Campo`
- `dbo.conductividad_temp`
- `dbo.ConsumoFertilizantes_Semanal`
- `dbo.ConsumoFertilizantesTOTAL`
- `dbo.ControlCalidad_Importada`
- `dbo.Cuartel`
- `dbo.Cuartel_Excel_final`
- `dbo.Cuartel_Excel_Stg`
- `dbo.DatosCalicata`
- `dbo.DatosCalicata_respaldo`
- `dbo.DatosSFR`
- `dbo.estado_fenologico`
- `dbo.GEN_CAMPO`
- `dbo.Gen_CUARTEL`
- `dbo.GEN_ESPECIE`
- `dbo.GEN_FUNDO`
- `dbo.GEN_HILERA`
- `dbo.GEN_VARIEDAD`
- `dbo.GEN_VARIEDAD_CAMPO`
- `dbo.GEN_ZONA`
- `dbo.humedad_temp`
- `dbo.LadoPlanta`
- `dbo.Metodo`
- `dbo.MONI_CABECERAMONITOREO`
- `dbo.moni_csg_temporal`
- `dbo.MONI_CUARTELSDP`
- `dbo.MONI_CUARTELSDPMONI`
- `dbo.MONI_CUARTELSDPMONI2`
- `dbo.MONI_DATOSMONITOREO`
- `dbo.MONI_DETALLEMONITOREO`
- `dbo.MONI_ESTADOCHANCHITO`
- `dbo.MONI_ESTADOPOSICION`
- `dbo.MONI_IMAGENES`
- `dbo.moni_monitoreadores`
- `dbo.MONI_MONITOREO`
- `dbo.MONI_SDPPARAMONITOREO`
- `dbo.MONI_SDPPRUEBA`
- `dbo.MONI_SDPPRUEBA2`
- `dbo.MONIPLA_ESTADIO`
- `dbo.MONIPLA_ESTADO_EJEMPLAR`
- `dbo.MONIPLA_ESTRUCTURA`
- `dbo.MONIPLA_IMAGEN`
- `dbo.MONIPLA_MUESTREO`
- `dbo.MONIPLA_ORIGEN_MUESTRA`
- `dbo.MONIPLA_PLAGA`
- `dbo.MONIPLA_REL_CUARTEL_SDP`
- `dbo.MONIPLA_RESULTADO_CONTEO`
- `dbo.MONIPLA_RESULTADO_PLAGA`
- `dbo.ParametrosSistema`
- `dbo.Profundidad`
- `dbo.RiegoSemanal`
- `dbo.Sector`
- `dbo.sysdiagrams`
- `dbo.temperatura_temp`
- `dbo.TipoSuelo`
- `dbo.Usuario_Campo`
- `dbo.Usuarios`
- `dbo.usuarios_sistema`
- `dbo.VariedadUva`
- `dbo.vigor_planta`

## 12. Tablas principales del modulo MONIPLA

Estas son las tablas con prefijo `MONIPLA_` que parecen pertenecer directamente al nuevo modulo de monitoreo de plagas.

### MONIPLA_MUESTREO

Parece ser la tabla principal del muestreo.

Columnas detectadas:

- `id_muestreo`
- `numero_muestreo`
- `id_origen_muestra`
- `fecha_muestreo`
- `fecha_revision_muestra`
- `id_estructura`
- `cant_unidades_muestreadas`
- `observacion_general`
- `id_usuario_creacion`
- `fecha_creacion`
- `fecha_modificacion`
- `fecha_solicitud_muestra`
- `fecha_recepcion_muestra`

Relaciones:

- `id_origen_muestra` apunta a `MONIPLA_ORIGEN_MUESTRA`.
- `id_estructura` apunta a `MONIPLA_ESTRUCTURA`.

### MONIPLA_ORIGEN_MUESTRA

Parece guardar de donde viene la muestra.

Columnas:

- `id_origen_muestra`
- `gen_cuartel`
- `gen_variedad_campo`
- `id_rel_cuartel_sdp`
- `activo`
- `fecha_creacion`

Relaciones:

- `gen_cuartel` apunta a `Gen_CUARTEL`.
- `gen_variedad_campo` apunta a `GEN_VARIEDAD_CAMPO`.
- `id_rel_cuartel_sdp` apunta a `MONIPLA_REL_CUARTEL_SDP`.

### MONIPLA_REL_CUARTEL_SDP

Parece relacionar cuartel con SDP, CSG y trazabilidad.

Columnas:

- `id_rel_cuartel_sdp`
- `gen_cuartel`
- `codigo_cuartel`
- `trazabilidad`
- `sdp`
- `csg`
- `fuente`
- `activo`
- `fecha_creacion`

Relaciones:

- `gen_cuartel` apunta a `Gen_CUARTEL`.

### MONIPLA_ESTRUCTURA

Catalogo de estructura inspeccionada o muestreada.

Columnas:

- `id_estructura`
- `nombre_estructura`
- `descripcion`
- `activo`

### MONIPLA_PLAGA

Catalogo de plagas.

Columnas:

- `id_plaga`
- `nombre_plaga`
- `nombre_cientifico`
- `tipo_registro`
- `es_cuarentenaria`
- `activo`

### MONIPLA_RESULTADO_PLAGA

Parece guardar el resultado general de una plaga dentro de un muestreo.

Columnas:

- `id_resultado_plaga`
- `id_muestreo`
- `id_plaga`
- `detalle_texto`
- `cantidad_total`
- `observacion`
- `fecha_creacion`

Relaciones:

- `id_muestreo` apunta a `MONIPLA_MUESTREO`.
- `id_plaga` apunta a `MONIPLA_PLAGA`.

### MONIPLA_RESULTADO_CONTEO

Parece guardar conteos detallados por estadio y estado del ejemplar.

Columnas:

- `id_resultado_conteo`
- `id_resultado_plaga`
- `id_estadio`
- `id_estado_ejemplar`
- `cantidad`
- `fecha_creacion`

Relaciones:

- `id_resultado_plaga` apunta a `MONIPLA_RESULTADO_PLAGA`.
- `id_estadio` apunta a `MONIPLA_ESTADIO`.
- `id_estado_ejemplar` apunta a `MONIPLA_ESTADO_EJEMPLAR`.

### MONIPLA_ESTADIO

Catalogo de estadios.

Columnas:

- `id_estadio`
- `nombre_estadio`
- `activo`

### MONIPLA_ESTADO_EJEMPLAR

Catalogo de estado del ejemplar.

Columnas:

- `id_estado_ejemplar`
- `nombre_estado`
- `activo`

### MONIPLA_IMAGEN

Imagenes asociadas a un muestreo.

Columnas:

- `id_imagen`
- `id_muestreo`
- `orden`
- `imagen`
- `mime`
- `comentario`
- `fecha_creacion`

Relaciones:

- `id_muestreo` apunta a `MONIPLA_MUESTREO`.

## 13. Tabla de usuarios usada por el sistema actual

Tabla:

- `dbo.usuarios_sistema`

Columnas reales detectadas:

- `id`
- `nombre`
- `correo`
- `contrasena`
- `activo`
- `rol`
- `fecha_creacion`
- `sede`

Uso actual:

- Login.
- Listado de usuarios.
- Creacion de usuarios.
- Edicion de usuarios.
- Cambio de contrasena.
- Activacion y desactivacion.

Importante:

El archivo `scripts/database.sql` del proyecto esta desactualizado frente a la tabla real, porque solo define `id`, `nombre`, `correo`, `contrasena` y `activo`. El codigo actual tambien necesita `rol`, `sede` y `fecha_creacion`.

## 14. Relacion probable del flujo MONIPLA

Segun las tablas y relaciones detectadas, el flujo de negocio para monitoreo podria ser:

1. Se elige un cuartel o relacion cuartel-SDP.
2. Se define el origen de la muestra en `MONIPLA_ORIGEN_MUESTRA`.
3. Se crea un muestreo en `MONIPLA_MUESTREO`.
4. Se define la estructura muestreada con `MONIPLA_ESTRUCTURA`.
5. Se agregan una o mas plagas desde `MONIPLA_PLAGA`.
6. Por cada plaga se guarda un resultado en `MONIPLA_RESULTADO_PLAGA`.
7. Si la plaga requiere conteo, se guardan detalles en `MONIPLA_RESULTADO_CONTEO`.
8. Los conteos pueden clasificarse por estadio y estado del ejemplar.
9. Si hay imagenes, se guardan en `MONIPLA_IMAGEN`.

Este flujo todavia no esta implementado en la aplicacion web. Solo esta preparado visualmente con pantallas placeholder.

## 15. Forma actual de programar en el proyecto

El patron que estas usando se parece a MVC con capa de servicios y repositorios.

Ejemplo del modulo usuarios:

1. Ruta: define la URL.
2. Middleware: revisa sesion y rol.
3. Controlador: recibe la peticion y decide que vista mostrar.
4. Servicio: valida datos y aplica reglas.
5. Repositorio: ejecuta SQL.
6. Vista: muestra el resultado al usuario.

Este patron es recomendable para Node.js con Express porque permite crecer sin perder orden.

## 16. Buenas practicas que ya estan presentes

- Uso de consultas parametrizadas con `mssql`.
- Passwords protegidas con bcrypt.
- Sesion regenerada despues del login.
- Separacion clara entre controladores, servicios y repositorios.
- Validaciones en el servicio, no directamente en la vista.
- Restriccion de administracion por rol.
- No se permite que un admin se quite a si mismo el rol admin.
- No se permite que un admin se desactive a si mismo.
- Layout separado para login y sistema interno.
- Menu dinamico segun usuario y ruta.

## 17. Puntos a mejorar antes de crecer mucho mas

Estas no son fallas bloqueantes, pero conviene considerarlas:

- Actualizar `scripts/database.sql` para que coincida con la tabla real `usuarios_sistema`.
- Agregar proteccion CSRF en formularios POST.
- Definir reglas de seguridad de contrasenas, por ejemplo largo minimo.
- Mover sesiones a SQL Server o Redis si el sistema se usara en produccion. Ahora usa memoria del proceso.
- Agregar logs mas estructurados.
- Agregar pruebas automatizadas para servicios.
- Crear repositorios y servicios reales para `MONIPLA_*`.
- Agregar paginacion o busqueda al listado de usuarios si crece.
- Revisar si `dbo.Usuarios` y `dbo.usuarios_sistema` deben convivir o unificarse.

## 18. Siguiente instruccion sugerida

Con esta base, una buena siguiente instruccion podria ser una de estas:

- Crear el modulo real para registrar muestreos usando las tablas `MONIPLA_*`.
- Hacer una pantalla para listar muestreos existentes.
- Conectar combos de cuartel, estructura, plaga, estadio y estado.
- Actualizar `scripts/database.sql` para que refleje la base real.
- Mejorar seguridad del modulo usuarios.
- Crear roles mas detallados que `admin` y `usuario`.

