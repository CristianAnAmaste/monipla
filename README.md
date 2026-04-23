# Monitoreo de Plagas

Base inicial de sistema web con Node.js, Express, EJS, SQL Server, bcrypt y sesiones.

## Estructura

- `src/app.js`: configura Express, sesiones, EJS, archivos estaticos, rutas y manejadores globales.
- `src/config/db.js`: crea `poolPromise` de SQL Server usando variables de entorno.
- `src/routes/auth.routes.js`: define `/login` y `/logout`.
- `src/routes/home.routes.js`: define `/home` protegido por middleware.
- `src/controllers/auth.controller.js`: maneja request/response de autenticacion.
- `src/controllers/home.controller.js`: renderiza la pagina privada inicial.
- `src/services/auth.service.js`: valida credenciales y reglas de autenticacion.
- `src/repositories/auth.repository.js`: consulta usuarios con parametros SQL.
- `src/middlewares/auth.middleware.js`: protege rutas privadas.
- `src/views/layouts/auth.ejs`: layout del acceso.
- `src/views/layouts/main.ejs`: layout principal autenticado.
- `src/views/auth/login.ejs`: formulario de login.
- `src/views/home/index.ejs`: contenido de inicio.
- `src/public/css/styles.css`: estilos del sistema.
- `scripts/database.sql`: tabla y ejemplo de insercion.

## Configuracion

Copie `.env.example` a `.env` y ajuste los valores:

```env
PORT=3000
DB_USER=sa
DB_PASSWORD=tu_password
DB_SERVER=localhost
DB_DATABASE=monitoreo_plagas
DB_ENCRYPT=false
DB_TRUST_SERVER_CERTIFICATE=true
SESSION_SECRET=cambia-este-valor-por-un-secreto-largo
NODE_ENV=development
```

## Base de datos

```sql
CREATE TABLE usuarios_sistema (
  id INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
  nombre NVARCHAR(120) NOT NULL,
  correo NVARCHAR(255) NOT NULL UNIQUE,
  contrasena NVARCHAR(255) NOT NULL,
  activo BIT NOT NULL CONSTRAINT DF_usuarios_sistema_activo DEFAULT 1
);
```

Ejemplo de usuario admin con contrasena inicial `Admin12345`:

```sql
INSERT INTO usuarios_sistema (nombre, correo, contrasena, activo)
VALUES (
  N'Administrador',
  N'admin@monitoreo.cl',
  N'$2b$12$msqmCUDF0Cpjit.9cOh20e4B59zFiUcW/pMXohcbhCzsH0zq0cQwC',
  1
);
```

Para generar otro hash:

```powershell
node -e "const bcrypt=require('bcrypt'); bcrypt.hash('NuevaClave', 12).then(console.log)"
```

## Ejecucion

```powershell
npm install
npm run dev
```

Abra `http://localhost:3000`.
