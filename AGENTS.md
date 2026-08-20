# AGENTS.md — guía canónica para agentes

## 1. Propósito y alcance

MONIPLA es un sistema interno agrícola para registrar, consultar y administrar monitoreos de plagas, resultados, evidencias, agroclima y reportes. Sus módulos activos son MONIPLA general, Chanchito Blanco, autenticación, usuarios, agroclima MeteoFEAL y PDF.

Stack confirmado: Node.js, Express, EJS, SQL Server con `mssql`, `express-session`, bcrypt, Multer, Sharp, PDFKit; `frontend/` usa React, React Router, Vite, Tailwind v4 y Lucide.

## 2. Arquitectura y entradas

```
Ruta → Middleware → Controlador → Servicio → Repositorio → SQL Server
React/Vite → rutas JSON protegidas → controlador/servicio/repositorio existentes
EJS → rutas tradicionales → controlador/servicio/repositorio existentes
```

- Servidor y montaje: `src/app.js`; rutas: `src/routes/`; controladores: `src/controllers/`; negocio: `src/services/`; SQL: `src/repositories/`.
- EJS, JS y CSS: `src/views/`, `src/public/js/`, `src/public/css/styles.css`.
- React: `frontend/src/`; Vite: `frontend/vite.config.js`; build: `frontend/dist/`.
- Autenticación: `src/middlewares/auth.middleware.js`; administración: `src/middlewares/role.middleware.js`.

## 3. Invariantes

- SQL solo en repositories y siempre parametrizado; nunca concatenar entradas ni crear consultas duplicadas para React.
- Controladores coordinan HTTP; servicios validan, normalizan y orquestan; componentes React no contienen lógica de negocio.
- El navegador mejora la UX, pero backend conserva validaciones, permisos y transacciones autoritativas.
- Mantener sesiones, roles, permisos, contratos y rutas. `ensureAuthenticated` redirige a `/login`; `ensureApiAuthenticated` devuelve `401` JSON.
- React es migración gradual: EJS sigue operativo hasta una decisión explícita de reemplazo.
- Separar cambios visuales de funcionales; no mezclar migración React con cambios agroclimáticos.
- No inventar tablas, columnas, rutas, catálogos ni contratos. No modificar datos reales, ejecutar migraciones ni backfills sin autorización; los backfills comienzan en dry-run.
- No ocultar faltantes agroclimáticos con el último valor disponible.
- No aumentar timeouts, agregar índices ni usar `OPTION(RECOMPILE)` sin identificar la consulta y obtener evidencia de plan/medición.

## 4. Reglas de negocio confirmadas

### MONIPLA general

- Cabecera/origen: `MONIPLA_MUESTREO` y `MONIPLA_ORIGEN_MUESTRA`; resultados: `MONIPLA_RESULTADO_PLAGA` y `MONIPLA_RESULTADO_CONTEO`; evidencias: `MONIPLA_IMAGEN`.
- Estados: `PENDIENTE`, `SIN_PLAGAS`, `CON_PLAGAS`. No existe plaga ficticia “Sin plagas”; `id_plaga` no se hace nullable.
- `SIN_PLAGAS` no inserta resultados/conteos; los totales se calculan en backend. Validación: `src/services/monitoreos.service.js`; transacciones: `src/repositories/monitoreos.repository.js`.
- Historial no trae binarios; detalle e imágenes se cargan bajo demanda. Ver pruebas de `monitoreos`.

### Chanchito Blanco

- EJS: `GET /chanchitos/nuevo`, `POST /chanchitos`, historial, detalle, PDF e imágenes están en `src/routes/chanchitos.routes.js`.
- React: `/app`, `/app/chanchitos/nuevo`, `/app/chanchitos/historial`; API en `/app/api/chanchitos…` (`src/routes/reactApp.routes.js`).
- `ChanchitosService.guardarMonitoreo` reutiliza catálogo, monitoreador, estado fenológico, snapshot y repositorio; su transacción crea una cabecera y exactamente 12 detalles en `MONI_CABECERAMONITOREO` y `MONI_DETALLEMONITOREO`.
- Matriz canónica: 3 estados (Ovisaco, Ninfa, Adulto) × 4 posiciones (Bajo corteza, Base de brote, Hoja, Racimo). Sus claves `cantidad_<idEstado>_<idPosicion>` no se cambian. Clasificación central: `src/services/chanchitosPresion.service.js`.
- `MONIPLA_CATALOGO_SDP_MB` resuelve la combinación canónica activa con SDP; validar Fundo → Campo/Productor → Variedad → Cuartel y revalidar dentro de transacción. Servicios: `catalogoSdp.service.js`, `chanchitos.service.js`; pruebas: `test/catalogoSdp.service.test.js`.
- Monitoreadores activos: `MONI_MONITOREADORES`; estados fenológicos activos se revalidan antes de persistir.
- Imágenes opcionales: máximo 3, JPEG/PNG/WebP, 10 MB de entrada por archivo, Multer en memoria y Sharp. Se normalizan a JPEG, sin Base64 ni disco, y se almacenan en las tres columnas de cabecera. Ver `chanchitos.routes.js`, `chanchitosImagen.service.js`, `chanchitos.repository.js`.
- PDFs general e individual reutilizan datos/servicios, no recalculan negocio; servicios `chanchitosPdf.service.js` y `monitoreoPdf.service.js`. El historial no selecciona `VARBINARY`.

### Agroclima

- `agroclimaMonipla.service.js` solicita estaciones configuradas en `MONIPLA_FUNDO_ESTACION_METEO` y MeteoFEAL mediante `meteoFealClient.js`; repositories: `agroclima.repository.js`.
- Se evalúa la estación por prioridad; se usa respaldo cuando la principal no es utilizable y, entre parciales, la de mejor cobertura. La respuesta exige estación y fecha de corte válidas. Ver `test/agroclimaMonipla.service.test.js`.
- Horas frío y días grado son snapshot al guardar. En historial React de Chanchitos se expone un único indicador: HF si existe; en otro caso DG; si ambos faltan, “Sin datos”. No alterar cálculo, temporada ni fallback sin revisar pruebas.

## 5. Frontend React

- `frontend/src/main.jsx` monta `BrowserRouter`; `App.jsx` carga `/app/bootstrap` con sesión y redirige a `/login` ante `401`.
- Vite usa `/` en desarrollo y `/react-app/` en producción. Express sirve `/react-app/assets` y entrega `frontend/dist/index.html` protegido para `/app` (`src/app.js`, `reactApp.controller.js`). Si falta build, `/app` responde controladamente.
- Páginas: `pages/DashboardPage.jsx`, `pages/chanchitos/NuevoMonitoreoChanchitosPage.jsx`, `pages/chanchitos/ChanchitosHistoryPage.jsx`; componentes, hooks y API están en sus carpetas homónimas.
- Nuevo Chanchitos usa wizard, `FormData`, `credentials: 'include'`, prevención de doble envío y el mismo middleware multipart que EJS. No persistir sesión/permisos en `localStorage` o `sessionStorage`.
- Historial React serializa filtros en `api/chanchitosApi.js`, carga detalle bajo demanda y conserva EJS como respaldo. Rutas React usan Router; las no migradas son enlaces EJS.

## 6. Base de datos y rendimiento

- Tablas vistas: `MONIPLA_MUESTREO`, `MONIPLA_RESULTADO_PLAGA`, `MONIPLA_RESULTADO_CONTEO`, `MONIPLA_IMAGEN`, `MONIPLA_PLAGA`, `MONIPLA_ESTADIO`, `MONIPLA_ESTADO_EJEMPLAR`, `MONIPLA_ESTRUCTURA`, `MONIPLA_REL_CUARTEL_SDP`, `MONIPLA_LUGAR_MUESTRA`, `MONIPLA_MUESTRADOR`, `MONI_CABECERAMONITOREO`, `MONI_DETALLEMONITOREO`, `MONI_MONITOREADORES`, `MONIPLA_CATALOGO_SDP_MB`, `MONIPLA_FUNDO_ESTACION_METEO`, `MONIPLA_DIAS_GRADOS_MUESTREO`, catálogos `GEN_*`, `estado_fenologico` y `usuarios_sistema`.
- Transacciones en repositories (`crear…Transaccional`, `guardar…Transaccional`, `eliminar…Transaccional`); reutilizar su flujo.
- Ante timeout/bloqueo, registrar requestId, parámetros no sensibles y etapa; medir opciones, resumen y página antes de cambiar SQL. Evitar N+1 y binarios en listados.

## 7. Comandos confirmados

```powershell
npm install
npm run dev                 # Express/nodemon
npm run start               # Express
npm run dev:frontend        # Vite desde la raíz
npm run build:frontend      # build React desde la raíz
npm test
cd frontend; npm run lint
cd frontend; npm run build
git diff --check
```

`nodemon.json` observa `src/` e ignora frontend. Vite proxy apunta a `http://127.0.0.1:3001`; alinear `PORT` local con ese valor.

## 8. Protocolo de cambio

Antes: leer este archivo, ejecutar `git status --short`, delimitar módulo, inspeccionar el flujo completo mínimo, identificar reutilización y declarar archivos a modificar. No leer documentación secundaria salvo contradicción, setup o solicitud explícita.

Después: ejecutar pruebas proporcionales, lint/build si hay React, `node --check` si cambia JS y `git diff --check`; informar archivos, riesgos y pruebas no realizadas. No hacer commit/push/merge salvo solicitud explícita.

## 9. Estado actual

- Rama de trabajo esperada: `feature/react-form-chanchitos`; no asumir árbol limpio.
- Chanchito Blanco es el patrón inicial de migración React; EJS sigue disponible.
- PENDIENTE DE CONFIRMACIÓN: el historial filtrado por `genFundo=9` ha producido `ETIMEOUT` SQL a 15 s aunque el listado sin filtro responda. No declararlo resuelto sin reproducción y validación en el entorno objetivo.
