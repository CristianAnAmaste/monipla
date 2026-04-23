# Guia del frontend del sistema Monitoreo de Plagas

Este documento explica como esta construido el frontend actual del proyecto: vistas EJS, layout principal, barra lateral, cabecera, dashboard, formularios, tablas y estilos CSS.

La idea es que puedas entender que hace cada parte visual antes de seguir agregando modulos.

## 1. Como esta armado el frontend

El frontend no usa React, Vue ni Angular. Usa EJS, que permite crear HTML desde el servidor usando datos que vienen de Express.

La estructura principal esta en:

- `src/views/layouts/auth.ejs`: layout para la pantalla de login.
- `src/views/layouts/main.ejs`: layout para las pantallas internas del sistema.
- `src/views/auth/login.ejs`: formulario de inicio de sesion.
- `src/views/home/index.ejs`: dashboard o pantalla de inicio.
- `src/views/usuarios/*.ejs`: pantallas del modulo usuarios.
- `src/views/monitoreos/placeholder.ejs`: pantallas temporales de monitoreos.
- `src/public/css/styles.css`: todos los estilos visuales.

El frontend funciona con una idea central:

1. El controlador decide que pantalla mostrar.
2. El controlador renderiza un layout.
3. El layout carga una vista interna usando `contentView`.
4. La vista interna muestra el contenido real de la pagina.
5. El CSS da forma visual a todo.

## 2. Layout de login

Archivo:

- `src/views/layouts/auth.ejs`

Este layout se usa solo para iniciar sesion.

Estructura:

```html
<body class="auth-page">
  <main class="auth-shell">
    <section class="auth-panel">
      <div class="brand-block">...</div>
      <%- include('../auth/login') %>
    </section>
  </main>
</body>
```

Partes importantes:

- `auth-page`: centra todo el login en pantalla.
- `auth-shell`: limita el ancho maximo del login.
- `auth-panel`: es la tarjeta blanca donde esta el logo y el formulario.
- `brand-block`: muestra la marca `MP` y el nombre del sistema.
- `include('../auth/login')`: inserta el formulario de login dentro del layout.

Visualmente, esta pantalla tiene:

- Fondo gris claro con un degradado verde suave.
- Una tarjeta blanca centrada.
- Sombra grande.
- Bordes redondeados.
- Formulario vertical.

## 3. Formulario de login

Archivo:

- `src/views/auth/login.ejs`

Este formulario envia datos a:

- `POST /login`

Campos:

- `correo`
- `contrasena`

Tambien muestra errores cuando el backend devuelve una respuesta invalida.

Ejemplo:

```ejs
<% if (error) { %>
  <div class="alert" role="alert"><%= error %></div>
<% } %>
```

Esto significa:

- Si existe una variable `error`, se muestra una alerta roja.
- Si no hay error, no se muestra nada.

El valor del correo se conserva cuando el login falla:

```ejs
value="<%= values.correo %>"
```

Eso mejora la experiencia porque el usuario no tiene que volver a escribir el correo.

## 4. Layout interno del sistema

Archivo:

- `src/views/layouts/main.ejs`

Este layout se usa para todas las pantallas privadas: inicio, usuarios y monitoreos.

Estructura principal:

```html
<body class="app-page">
  <div class="app-layout">
    <aside class="sidebar">...</aside>

    <div class="main-area">
      <header class="topbar">...</header>
      <main class="content-shell">
        <%- include(contentView) %>
      </main>
    </div>
  </div>
</body>
```

El layout tiene dos zonas principales:

- `sidebar`: barra lateral izquierda.
- `main-area`: zona derecha donde van cabecera y contenido.

Dentro de `main-area` hay:

- `topbar`: cabecera superior.
- `content-shell`: contenedor central del contenido.

## 5. Barra lateral o sidebar

Archivo visual:

- `src/views/layouts/main.ejs`

Archivo que arma los datos del menu:

- `src/services/navigation.service.js`

Clases CSS relacionadas:

- `sidebar`
- `sidebar-brand`
- `brand-mark`
- `sidebar-nav`
- `sidebar-link`
- `sidebar-icon`
- `is-active`
- `is-logout`

### 5.1. Que hace la barra lateral

La barra lateral sirve para navegar entre las secciones principales del sistema.

Actualmente muestra:

- Inicio.
- Registrar Monitoreo.
- Historial de Monitoreo.
- Editar Monitoreo.
- Administracion de Usuarios, solo si el usuario es admin.
- Cerrar sesion.

No todos ven el mismo menu. El menu depende del usuario conectado.

Si no hay usuario conectado, el menu queda vacio.

Si hay usuario normal, no aparece Administracion de Usuarios.

Si hay usuario admin, si aparece Administracion de Usuarios.

### 5.2. Como se genera el menu

En `src/app.js`, antes de renderizar vistas, se carga esto:

```js
res.locals.usuario = req.session.usuario || null;
res.locals.menuPrincipal = navigationService.buildMenu(req.session.usuario, req.path);
```

Esto significa:

- `usuario` queda disponible en todas las vistas.
- `menuPrincipal` queda disponible en el layout.
- El menu se calcula segun la sesion y la ruta actual.

El layout recorre el menu asi:

```ejs
<% menuPrincipal.forEach((item) => { %>
  <a class="sidebar-link <%= item.active ? 'is-active' : '' %> <%= item.type === 'logout' ? 'is-logout' : '' %>" href="<%= item.href %>">
    <span class="sidebar-icon"><%= item.icon %></span>
    <span><%= item.label %></span>
  </a>
<% }) %>
```

Cada item del menu tiene:

- `label`: texto visible.
- `href`: ruta a la que navega.
- `icon`: letras cortas usadas como icono.
- `match`: rutas que indican cuando el item esta activo.
- `active`: se calcula automaticamente.
- `type`: se usa para casos especiales como logout.

### 5.3. Marca superior de la barra lateral

Esta parte:

```html
<a class="sidebar-brand" href="/home">
  <span class="brand-mark">MP</span>
  <span>Monitoreo de Plagas</span>
</a>
```

Funciona como logo y tambien como link al inicio.

Visualmente:

- `MP` aparece dentro de un cuadrado.
- En la sidebar, ese cuadrado es blanco con letras verdes.
- El texto `Monitoreo de Plagas` aparece al lado.

### 5.4. Estilo visual de la sidebar

En CSS:

```css
.sidebar {
  position: sticky;
  top: 0;
  display: flex;
  height: 100vh;
  flex-direction: column;
  gap: 24px;
  padding: 24px 18px;
  background: #163f32;
  color: #ffffff;
}
```

Explicacion:

- `position: sticky`: la barra queda pegada arriba cuando la pagina se desplaza.
- `height: 100vh`: ocupa todo el alto visible de la pantalla.
- `flex-direction: column`: los elementos se ordenan de arriba hacia abajo.
- `background: #163f32`: color verde oscuro.
- `color: #ffffff`: textos blancos.

El layout completo usa:

```css
.app-layout {
  display: grid;
  grid-template-columns: 280px minmax(0, 1fr);
  min-height: 100vh;
}
```

Esto significa:

- La primera columna mide `280px`, donde va la sidebar.
- La segunda columna ocupa todo el espacio restante.
- El sistema siempre ocupa al menos el alto completo de la pantalla.

### 5.5. Links del menu

Cada link usa la clase `sidebar-link`.

Visualmente:

- Tiene altura minima.
- Usa texto blanco con algo de transparencia.
- Tiene icono a la izquierda.
- Al pasar el mouse o estar activo, cambia el fondo.

CSS importante:

```css
.sidebar-link:hover,
.sidebar-link.is-active {
  color: #ffffff;
  background: rgba(255, 255, 255, 0.12);
}
```

Esto significa:

- Si el mouse pasa encima, se ilumina.
- Si corresponde a la pagina actual, queda iluminado.

### 5.6. Como se marca activo un link

En `navigation.service.js`, cada item tiene un arreglo `match`.

Ejemplo:

```js
{
  label: 'Administracion de Usuarios',
  href: '/usuarios',
  icon: 'AU',
  match: ['/usuarios'],
}
```

Luego se calcula:

```js
active: item.match.some((path) => currentPath === path || currentPath.startsWith(`${path}/`))
```

Esto permite que:

- `/usuarios` marque activo Administracion de Usuarios.
- `/usuarios/nuevo` tambien marque activo Administracion de Usuarios.
- `/usuarios/5/editar` tambien marque activo Administracion de Usuarios.

Es un buen detalle porque mantiene el menu coherente dentro de secciones hijas.

### 5.7. Link de cerrar sesion

El logout se agrega al final:

```js
{
  label: 'Cerrar sesion',
  href: '/logout',
  icon: 'CS',
  match: ['/logout'],
  type: 'logout',
}
```

En el layout se agrega la clase `is-logout` si el item es de tipo logout.

CSS:

```css
.sidebar-link.is-logout {
  margin-top: auto;
}
```

Esto empuja el link hacia abajo cuando la sidebar tiene altura completa.

En escritorio queda abajo de la barra lateral. En pantallas chicas se elimina ese comportamiento para que no rompa el layout.

## 6. Cabecera superior o topbar

Archivo:

- `src/views/layouts/main.ejs`

Clases CSS:

- `topbar`
- `eyebrow`
- `user-chip`
- `user-avatar`

### 6.1. Que muestra la cabecera

La cabecera muestra dos cosas:

- A la izquierda: seccion actual.
- A la derecha: usuario conectado.

Parte izquierda:

```ejs
<div>
  <p class="eyebrow">Sistema interno</p>
  <h1><%= title %></h1>
</div>
```

`title` viene desde el controlador.

Ejemplos:

- Inicio.
- Usuarios.
- Nuevo usuario.
- Editar usuario.
- Cambiar contrasena.
- Registrar Monitoreo.

Esto permite que el mismo layout cambie el titulo segun la pagina.

### 6.2. Tarjeta de usuario conectado

Esta parte solo aparece si existe `usuario`:

```ejs
<% if (usuario) { %>
  <div class="user-chip" aria-label="Usuario conectado">
    <span class="user-avatar"><%= usuario.nombre ? usuario.nombre.charAt(0).toUpperCase() : 'U' %></span>
    <div>
      <strong><%= usuario.nombre %></strong>
      <small><%= usuario.rol %><%= usuario.sede ? ' - ' + usuario.sede : '' %></small>
    </div>
  </div>
<% } %>
```

Muestra:

- Inicial del nombre del usuario.
- Nombre completo.
- Rol.
- Sede, si existe.

Ejemplo visual:

- C
- Cristian
- admin - Copiapo

La inicial se calcula con:

```js
usuario.nombre.charAt(0).toUpperCase()
```

Si no hay nombre, muestra `U`.

### 6.3. Estilo visual de la cabecera

CSS:

```css
.topbar {
  display: flex;
  min-height: 72px;
  align-items: center;
  justify-content: space-between;
  gap: 18px;
  padding: 18px 32px;
  border-bottom: 1px solid var(--line);
  background: var(--surface);
}
```

Explicacion:

- `display: flex`: coloca titulo y usuario en una fila.
- `justify-content: space-between`: titulo a la izquierda, usuario a la derecha.
- `min-height: 72px`: asegura altura estable.
- `padding`: da aire interno.
- `border-bottom`: separa cabecera del contenido.
- `background: var(--surface)`: fondo blanco.

La tarjeta del usuario usa:

```css
.user-chip {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 8px 12px;
  border: 1px solid var(--line);
  border-radius: 8px;
  background: #ffffff;
}
```

Visualmente queda como una mini tarjeta.

## 7. Contenedor del contenido

Clase:

- `content-shell`

Esta zona contiene la vista especifica de cada pagina.

En el layout:

```ejs
<main class="content-shell">
  <%- include(contentView) %>
</main>
```

`contentView` lo manda cada controlador.

Ejemplos:

```js
res.render('layouts/main', {
  title: 'Usuarios',
  contentView: '../usuarios/index',
  usuarios,
});
```

Esto significa:

- Usa `layouts/main`.
- El titulo sera `Usuarios`.
- Dentro de `content-shell` se insertara `views/usuarios/index.ejs`.

CSS:

```css
.content-shell {
  width: min(100% - 32px, 1120px);
  margin: 42px auto;
}
```

Explicacion:

- El contenido nunca supera `1120px`.
- En pantallas chicas ocupa casi todo el ancho, dejando `16px` por lado.
- `margin: 42px auto` lo separa de la cabecera y lo centra.

## 8. Dashboard

Archivo:

- `src/views/home/index.ejs`

El dashboard tiene dos partes:

- `dashboard-hero`: bloque de bienvenida.
- `dashboard-grid`: grilla de tarjetas.

### 8.1. Hero de bienvenida

Muestra:

- Texto `Inicio`.
- Titulo de bienvenida.
- Descripcion corta.
- Tarjeta con usuario autenticado.

La tarjeta de sesion repite informacion del usuario:

- Nombre.
- Rol.
- Sede.

Esto es util para confirmar con que cuenta se esta trabajando.

### 8.2. Tarjetas del dashboard

Cada tarjeta viene desde `DashboardService.buildCards`.

Visualmente cada tarjeta tiene:

- Marca corta, por ejemplo `RM`.
- Titulo.
- Descripcion.
- Link a una seccion.

Clases:

- `dashboard-grid`
- `dashboard-card`
- `dashboard-card-mark`

La grilla usa dos columnas en escritorio:

```css
.dashboard-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 18px;
}
```

En pantallas menores a `900px`, pasa a una columna.

## 9. Encabezados de paginas internas

Muchas vistas usan:

- `page-header`

Ejemplo en usuarios:

```ejs
<section class="page-header">
  <div>
    <p class="eyebrow">Administracion</p>
    <h1>Usuarios</h1>
    <p>Gestion inicial de cuentas habilitadas para operar el sistema.</p>
  </div>

  <a class="button button-primary button-fit" href="/usuarios/nuevo">Nuevo usuario</a>
</section>
```

Este bloque sirve para:

- Mostrar contexto de la pagina.
- Mostrar titulo grande.
- Mostrar descripcion.
- Colocar una accion principal a la derecha.

En escritorio queda titulo a la izquierda y boton a la derecha.

En movil se apila verticalmente.

## 10. Formularios

Clases principales:

- `form`
- `form-grid`
- `form-group`
- `form-panel`
- `form-actions`
- `check-field`

### 10.1. Formulario normal

La clase `form` hace que los campos se ordenen con separacion uniforme.

```css
.form {
  display: grid;
  gap: 18px;
  margin-top: 24px;
}
```

### 10.2. Formulario en dos columnas

La clase `form-grid` hace dos columnas:

```css
.form-grid {
  grid-template-columns: repeat(2, minmax(0, 1fr));
}
```

Se usa en:

- Nuevo usuario.
- Editar usuario.
- Cambiar contrasena.

En pantallas chicas cambia a una columna:

```css
@media (max-width: 640px) {
  .form-grid {
    grid-template-columns: 1fr;
  }
}
```

### 10.3. Campos input y select

Los `input` y `select` tienen:

- Ancho completo.
- Alto minimo de `46px`.
- Borde gris.
- Radio de `8px`.
- Fondo blanco.
- Efecto verde al enfocar.

El efecto al enfocar ayuda a saber que campo se esta editando.

### 10.4. Botones de formulario

Clases:

- `button`
- `button-primary`
- `button-secondary`
- `button-danger`
- `button-small`
- `button-fit`

Uso:

- `button-primary`: accion principal, verde.
- `button-secondary`: accion secundaria, blanco con borde.
- `button-danger`: accion peligrosa, rojo.
- `button-small`: boton compacto para tablas.
- `button-fit`: evita que el boton ocupe todo el ancho.

Importante:

`button-primary` por defecto tiene `width: 100%`. Por eso cuando quieres que mida solo su contenido se agrega `button-fit`.

## 11. Alertas y mensajes

Clases:

- `alert`
- `alert-success`
- `message-list`

`alert` muestra errores en rojo.

`alert-success` muestra mensajes correctos en verde.

Ejemplos de uso:

- Login incorrecto.
- Usuario creado correctamente.
- Error al validar formulario.
- Usuario actualizado correctamente.

Cuando hay varios errores, se usa una lista:

```ejs
<ul class="message-list">
  <% errors.forEach((message) => { %>
    <li><%= message %></li>
  <% }) %>
</ul>
```

## 12. Tabla de usuarios

Archivo:

- `src/views/usuarios/index.ejs`

Clases:

- `data-panel`
- `table-wrap`
- `data-table`
- `badge`
- `status`
- `status-on`
- `status-off`
- `table-actions`
- `empty-state`

### 12.1. Panel de tabla

La tabla esta dentro de:

```html
<section class="data-panel">
  <div class="table-wrap">
    <table class="data-table">...</table>
  </div>
</section>
```

`data-panel` da el fondo blanco, borde y sombra.

`table-wrap` permite scroll horizontal si la tabla es muy ancha.

Esto es importante en movil porque la tabla tiene muchas columnas.

### 12.2. Tabla

La tabla tiene ancho minimo:

```css
.data-table {
  width: 100%;
  border-collapse: collapse;
  min-width: 980px;
}
```

Eso significa:

- En escritorio se ve completa.
- En pantallas chicas no se aplasta demasiado.
- Si no cabe, aparece scroll horizontal gracias a `table-wrap`.

### 12.3. Badges y estados

El rol se muestra con:

- `badge`

El estado activo se muestra con:

- `status status-on`
- `status status-off`

Esto permite distinguir rapidamente:

- Usuario activo en verde.
- Usuario inactivo en rojo.

### 12.4. Acciones de tabla

Cada fila tiene:

- Editar.
- Cambiar contrasena.
- Activar o desactivar.

Las acciones estan dentro de:

```html
<div class="table-actions">...</div>
```

CSS:

```css
.table-actions {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}
```

Esto hace que los botones se ordenen en fila, pero puedan saltar de linea si no caben.

## 13. Pantallas de usuarios

### 13.1. Listado de usuarios

Archivo:

- `src/views/usuarios/index.ejs`

Muestra:

- Encabezado de pagina.
- Boton `Nuevo usuario`.
- Mensajes de exito o error.
- Tabla de usuarios.

Depende de la variable:

- `usuarios`

Si no hay usuarios, muestra:

```ejs
No hay usuarios registrados.
```

### 13.2. Nuevo usuario

Archivo:

- `src/views/usuarios/nuevo.ejs`

Muestra:

- Formulario para crear usuario.
- Campos de nombre, correo, contrasena, confirmacion, rol, sede y activo.
- Errores de validacion si existen.

Depende de:

- `errors`
- `values`
- `opciones.roles`
- `opciones.sedes`

Esto permite que el formulario recuerde los datos cuando hay errores.

### 13.3. Editar usuario

Archivo:

- `src/views/usuarios/editar.ejs`

Muestra:

- Formulario parecido al de crear.
- No muestra campos de contrasena.
- Permite editar nombre, correo, rol, sede y activo.

La contrasena se cambia en otra pantalla, lo cual es correcto porque evita mezclar edicion de perfil con cambio de clave.

### 13.4. Cambiar contrasena

Archivo:

- `src/views/usuarios/cambiar-password.ejs`

Muestra:

- Resumen del usuario.
- Nueva contrasena.
- Confirmacion de nueva contrasena.

Usa:

- `user-summary`

La clase `user-summary` muestra una tarjeta pequeña con nombre y correo del usuario afectado.

## 14. Pantallas de monitoreos

Archivo:

- `src/views/monitoreos/placeholder.ejs`

Actualmente las rutas de monitoreos muestran un placeholder.

Clases:

- `page-header`
- `module-placeholder`
- `module-placeholder-icon`

Esto significa que el frontend ya tiene espacio preparado para:

- Registrar monitoreo.
- Historial de monitoreo.
- Editar monitoreo.

Pero aun falta implementar formularios, tablas y logica real.

## 15. Variables visuales del CSS

Al inicio de `styles.css` hay variables:

```css
:root {
  --bg: #f4f6f8;
  --surface: #ffffff;
  --surface-muted: #eef3f0;
  --text: #18212a;
  --muted: #687582;
  --line: #d8e0e6;
  --primary: #24745a;
  --primary-dark: #195640;
  --success-bg: #edf8f3;
  --success-text: #176244;
  --danger-bg: #fff1f0;
  --danger-text: #9b1c16;
  --shadow: 0 24px 60px rgba(24, 33, 42, 0.14);
}
```

Estas variables son importantes porque centralizan colores y sombras.

Si quieres cambiar la identidad visual, conviene empezar aqui.

Ejemplos:

- Cambiar `--primary` cambia el verde principal.
- Cambiar `--bg` cambia el fondo general.
- Cambiar `--line` cambia bordes.
- Cambiar `--shadow` cambia sombras grandes.

## 16. Responsive: como se adapta a pantallas chicas

El CSS tiene dos puntos de quiebre principales:

- `900px`
- `640px`

### 16.1. A menos de 900px

Cambios:

- El layout deja de tener dos columnas.
- La sidebar deja de ser lateral fija y pasa arriba.
- El menu se convierte en grilla de dos columnas.
- El dashboard pasa a una columna.
- Algunos bloques flexibles se apilan.

CSS:

```css
@media (max-width: 900px) {
  .app-layout {
    grid-template-columns: 1fr;
  }

  .sidebar {
    position: static;
    height: auto;
  }

  .sidebar-nav {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}
```

En palabras simples:

- En escritorio, menu al lado.
- En tablet o pantalla chica, menu arriba.

### 16.2. A menos de 640px

Cambios:

- El panel de login reduce padding.
- La cabecera se apila.
- El menu pasa a una sola columna.
- Los headers de paginas se apilan.
- Los formularios pasan a una columna.
- Los botones de formulario ocupan el ancho completo.

Esto hace que el sistema sea usable desde celular.

## 17. Como agregar una nueva pantalla siguiendo este frontend

Para agregar una nueva pantalla, el patron recomendado es:

1. Crear una ruta en `src/routes`.
2. Crear un metodo en un controlador.
3. Renderizar `layouts/main`.
4. Pasar un `title`.
5. Pasar un `contentView`.
6. Crear la vista EJS dentro de `src/views`.
7. Usar clases existentes del CSS.
8. Agregar item al menu si corresponde.

Ejemplo de render:

```js
return res.render('layouts/main', {
  title: 'Nueva pantalla',
  contentView: '../carpeta/nueva-vista',
});
```

Ejemplo de vista:

```ejs
<section class="page-header">
  <div>
    <p class="eyebrow">Modulo</p>
    <h1>Nueva pantalla</h1>
    <p>Descripcion simple de la pantalla.</p>
  </div>
</section>

<section class="form-panel">
  Contenido de la pantalla.
</section>
```

## 18. Reglas practicas para mantener el frontend ordenado

- Usar `layouts/main` para toda pantalla interna.
- Usar `layouts/auth` solo para login.
- Usar `page-header` al inicio de cada modulo.
- Usar `form-panel` para formularios.
- Usar `data-panel` para tablas.
- Usar `alert` para errores.
- Usar `alert-success` para mensajes correctos.
- Usar `button-primary` para la accion mas importante.
- Usar `button-secondary` para cancelar o volver.
- Usar `button-danger` para acciones peligrosas.
- No repetir estructura de sidebar ni topbar en cada vista; eso ya vive en el layout.
- Si agregas una ruta hija, revisar `NavigationService` para que el menu activo siga funcionando.

## 19. Resumen mental del frontend

El frontend actual se puede entender asi:

- `auth.ejs` es la puerta de entrada.
- `login.ejs` es el formulario de acceso.
- `main.ejs` es la carcasa del sistema interno.
- `sidebar` es la navegacion principal.
- `topbar` muestra donde estas y quien esta conectado.
- `content-shell` contiene la pantalla especifica.
- Cada vista EJS solo se preocupa de su contenido.
- `styles.css` contiene toda la identidad visual y la adaptacion responsive.

La barra lateral y la cabecera no se programan en cada pantalla. Se programan una sola vez en el layout principal y se alimentan con datos globales desde Express.

