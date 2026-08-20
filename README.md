# MONIPLA — Monitoreo de Plagas

Sistema interno agrícola para registrar monitoreos, resultados, evidencias fotográficas, información agroclimática y reportes. Conviven el módulo general MONIPLA, Chanchito Blanco, administración de usuarios y una migración gradual de pantallas EJS hacia React.

## Tecnologías

- Backend: Node.js, Express 5, EJS, `express-session`, SQL Server y `mssql`.
- Funcionalidades: bcrypt, Multer, Sharp y PDFKit.
- Frontend nuevo: React 19, React Router 7, Vite 8, Tailwind CSS 4 y Lucide React.

> El `package.json` raíz no fija una versión de Node.js. Use una versión compatible con las dependencias del proyecto y la política del entorno.

## Estructura

```text
src/
  app.js                 # Express, sesiones, estáticos y montaje de rutas
  routes/                # URLs y middlewares
  controllers/           # HTTP, EJS y JSON
  services/              # validación, negocio, PDFs y agroclima
  repositories/          # consultas SQL Server y transacciones
  views/                 # pantallas EJS
  public/                # JavaScript y CSS EJS
frontend/
  src/                   # React: páginas, componentes, hooks y cliente API
  vite.config.js
scripts/                 # mantenimiento y backfills controlados
test/                    # pruebas con node:test
```

## Requisitos y configuración

- Node.js y npm.
- Acceso a una instancia SQL Server compatible con el esquema MONIPLA.
- Un archivo `.env` basado en `.env.example`.

Variables configurables detectadas (no incluya valores en documentación, commits o logs):

```text
PORT
DB_USER
DB_PASSWORD
DB_SERVER
DB_DATABASE
DB_ENCRYPT
DB_TRUST_SERVER_CERTIFICATE
SESSION_SECRET
NODE_ENV
METEO_FEAL_BASE_URL
METEO_INTERNAL_TOKEN
AGROCLIMA_PUBLIC_URL
```

## Instalación local

```powershell
# Backend y pruebas
npm install

# Frontend React
cd frontend
npm install
cd ..
```

Configure `.env` antes de iniciar el backend. No ejecute migraciones, scripts SQL ni backfills como parte de la instalación normal.

## Desarrollo

Terminal 1:

```powershell
npm run dev
```

Terminal 2:

```powershell
npm run dev:frontend
```

Express escucha el puerto definido en `PORT` (el ejemplo local usa `3001`). Vite se ejecuta en su puerto de desarrollo y su proxy apunta a `http://127.0.0.1:3001`; ambos valores deben coincidir. Las rutas EJS requieren sesión. React obtiene la sesión mediante rutas JSON protegidas y no usa CORS adicional.

## React y build de producción

```powershell
cd frontend
npm run build
```

El build se genera en `frontend/dist`. En producción Express sirve los assets compilados desde `/react-app/assets` y entrega el `index.html` protegido para `/app`; Vite no debe permanecer ejecutándose.

Rutas React actuales:

- `/app`
- `/app/chanchitos/nuevo`
- `/app/chanchitos/historial`

El shell solicita `/app/bootstrap`; las APIs de Chanchitos están bajo `/app/api/chanchitos`. Las pantallas EJS siguen activas, por ejemplo `/home`, `/chanchitos/nuevo` y `/chanchitos/historial`.

## Producción

Procedimiento mínimo confirmado:

```powershell
npm install
cd frontend
npm install
npm run build
cd ..
npm run start
```

Después verifique login, `/home`, `/app` y los recursos `/react-app/assets`. El repositorio no define un administrador de procesos ni una estrategia de despliegue; use el mecanismo aprobado por el entorno.

## Arquitectura

```text
Ruta → Middleware → Controlador → Servicio → Repositorio → SQL Server
```

- EJS consume las rutas tradicionales de Express.
- React consume endpoints JSON autenticados, pero reutiliza los mismos servicios, repositories, validaciones y transacciones.
- `ensureAuthenticated` redirige páginas sin sesión a `/login`; `ensureApiAuthenticated` responde `401` JSON.
- La navegación y roles siguen siendo responsabilidad del backend. React es una capa de presentación durante la transición.

## Módulos

- **MONIPLA general:** cabeceras, resultados con/sin plagas, historial, detalle, evidencias y PDFs. Lógica principal: `monitoreos.service.js` y `monitoreos.repository.js`.
- **Chanchito Blanco:** formulario con 12 combinaciones de matriz, catálogo SDP, imágenes opcionales, historial, detalle y reportes. Capas: `chanchitos.*` y `catalogoSdp.*`.
- **Agroclima:** snapshots de horas frío y días grado usando estaciones por fundo y MeteoFEAL. No recalcular ni sustituir faltantes sin revisar `agroclimaMonipla.service.js` y sus pruebas.
- **Administración:** usuarios, autenticación, sesión y navegación existentes.

## Pruebas y validaciones

```powershell
npm test

cd frontend
npm run lint
npm run build
cd ..

git diff --check
git status
git diff --stat
```

## Flujo Git recomendado

1. Cree una rama por funcionalidad; no trabaje directamente sobre `main`.
2. Antes de cambiar: lea `AGENTS.md`, ejecute `git status` y delimite el módulo.
3. Mantenga commits pequeños y con validaciones ejecutadas.
4. Revise `git diff --check` y los riesgos antes de integrar.
5. No haga commit, push o merge sin autorización explícita.

## Problemas frecuentes

- **`frontend/dist` inexistente:** `/app` responde disponibilidad controlada. Ejecute `cd frontend; npm run build`.
- **Sesión vencida:** las APIs devuelven `401`; vuelva a `/login` mediante el flujo existente.
- **Conexión SQL:** revise nombres de variables de entorno y conectividad del servidor, sin registrar secretos.
- **Timeout SQL:** identifique consulta, filtros y etapa antes de aumentar timeouts o crear índices. El historial filtrado de Chanchitos con `genFundo=9` ha presentado `ETIMEOUT` a 15 s y requiere confirmación en el entorno objetivo.
- **Vite y Express:** desarrollo usa proxy Vite; producción usa assets compilados por Express.
- **Puerto ocupado:** cambie el proceso que usa el puerto o ajuste `PORT` y el proxy de Vite de forma consistente.

## Estado de migración

React se incorpora gradualmente, no es una reescritura total. Chanchito Blanco es el primer módulo de referencia en React, mientras formularios, historiales y rutas EJS continúan disponibles para validar la convivencia.
