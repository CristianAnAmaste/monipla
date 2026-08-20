const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ChanchitosService = require('../src/services/chanchitos.service');
const ChanchitosController = require('../src/controllers/chanchitos.controller');

function crearRegistro(overrides = {}) {
  return {
    id_monitoreo: 440,
    fecha_monitoreo: '2026-08-12',
    fecha_registro: '2026-08-13',
    nombre_fundo: 'Nantoco',
    nombre_campo: 'Productor Norte',
    nombre_variedad: 'Thompson',
    codigo_cuartel: 'A-01',
    sdp: 'SDP-9',
    csg: 'CSG-9',
    trazabilidad: 'TR-9',
    cant_plantas: 20,
    nombre_estado_fenologico: 'Pinta',
    nombre_monitoreador: 'Ana',
    observaciones: null,
    nombre_estacion_meteo: 'NTC',
    horas_frio_acumuladas: 12.5,
    dias_grado_acumulados: 4.3611,
    fecha_corte_agroclima: '2026-08-11',
    agroclima_observacion: 'Agroclima OK desde Meteo FEAL.',
    total_bichos: 7,
    posiciones_con_deteccion: 2,
    ...overrides,
  };
}

function crearServicio() {
  const llamadas = [];
  const repository = {
    obtenerResumenHistorialChanchitos: async (filtros) => {
      llamadas.push(['resumen', filtros]);
      return { total_registros: 26, total_plantas: 520, total_bichos: 91, monitoreos_con_deteccion: 12 };
    },
    listarHistorialChanchitos: async (filtros, pagina, pageSize) => {
      llamadas.push(['pagina', filtros, pagina, pageSize]);
      return [crearRegistro({ id_catalogo_sdp: null, gen_cuartel: null })];
    },
    obtenerDetalleChanchitos: async () => ({
      cabecera: crearRegistro(),
      detalles: [{ id_estadomonitoreo: 1, id_estadoposicion: 1, cantidad_bichos: 3 }],
    }),
  };
  const servicio = new ChanchitosService(repository, {
    listarFondosDisponibles: async () => [],
  }, {});
  repository.listarMonitoreadoresActivos = async () => [];
  repository.listarEstadosFenologicosActivos = async () => [];
  return { servicio, llamadas, repository };
}

test('normaliza filtros, pagina solo despues de conocer el total y presenta historicos sin id_catalogo_sdp', async () => {
  const { servicio, llamadas } = crearServicio();
  const resultado = await servicio.obtenerHistorial({
    fechaDesde: '2026-08-01', fechaHasta: '2026-08-31', fundo: 'Nantoco',
    deteccion: 'CON_DETECCION', pagina: '9', pageSize: '25',
  });

  assert.equal(resultado.success, true);
  assert.equal(resultado.values.pagina, 2);
  assert.equal(resultado.values.pageSize, 25);
  assert.equal(resultado.registros[0].idMonitoreo, 440);
  assert.equal(resultado.registros[0].sdp, 'SDP-9');
  assert.equal(resultado.registros[0].totalBichos, 7);
  assert.equal(resultado.registros[0].agroclima.diasGrado, '4.36');
  assert.equal(resultado.resumen.totalBichos, 91);
  assert.deepEqual(llamadas.map(([nombre]) => nombre).sort(), ['pagina', 'resumen']);
  const llamadaPagina = llamadas.find(([nombre]) => nombre === 'pagina');
  assert.equal(llamadaPagina[2], 2);
  assert.equal(llamadaPagina[3], 25);
  assert.equal(llamadas.some(([nombre]) => nombre === 'consolidado'), false);
});

test('propaga genFundo tipado y filtros combinados al resumen y la pagina', async () => {
  const { servicio, llamadas } = crearServicio();

  await servicio.obtenerHistorial({
    genFundo: '9',
    genCampo: '18',
    genVariedad: '27',
    idMonitoreador: '4',
    deteccion: 'CON_DETECCION',
    pagina: '1',
    pageSize: '10',
  }, { requestId: 'historial-fundo-9' });

  const resumen = llamadas.find(([nombre]) => nombre === 'resumen')[1];
  const pagina = llamadas.find(([nombre]) => nombre === 'pagina')[1];
  assert.deepEqual(resumen, {
    fechaDesde: null,
    fechaHasta: null,
    genFundo: 9,
    genCampo: 18,
    genVariedad: 27,
    idCatalogoSdp: null,
    idMonitoreador: 4,
    idEstadoFenologico: null,
    deteccion: 'CON_DETECCION',
    pagina: 1,
    pageSize: 10,
  });
  assert.deepEqual(pagina, resumen);
});

test('prepara un unico indicador agroclimatico para el historial y el detalle', () => {
  const { servicio } = crearServicio();

  const conHorasFrio = servicio.prepararRegistroHistorial(crearRegistro());
  const conDiasGrado = servicio.prepararRegistroHistorial(crearRegistro({
    horas_frio_acumuladas: null,
    dias_grado_acumulados: 4.3611,
  }));
  const sinDatos = servicio.prepararRegistroHistorial(crearRegistro({
    horas_frio_acumuladas: null,
    dias_grado_acumulados: null,
  }));

  assert.deepEqual(conHorasFrio.agroclima.indicador, { tipo: 'HF', valor: '12.50' });
  assert.deepEqual(conDiasGrado.agroclima.indicador, { tipo: 'DG', valor: '4.36' });
  assert.equal(sinDatos.agroclima.indicador, null);
  assert.equal(sinDatos.agroclima.tieneDatos, false);
});

test('el historial React mantiene un unico detalle inline y la terminologia de insectos', () => {
  const historyPage = fs.readFileSync(path.join(__dirname, '..', 'frontend', 'src', 'pages', 'chanchitos', 'ChanchitosHistoryPage.jsx'), 'utf8');
  const historyTable = fs.readFileSync(path.join(__dirname, '..', 'frontend', 'src', 'components', 'chanchitos', 'HistoryTable.jsx'), 'utf8');
  const detail = fs.readFileSync(path.join(__dirname, '..', 'frontend', 'src', 'components', 'chanchitos', 'ChanchitosDetail.jsx'), 'utf8');
  const actions = fs.readFileSync(path.join(__dirname, '..', 'frontend', 'src', 'components', 'chanchitos', 'HistoryRowActions.jsx'), 'utf8');

  assert.match(historyPage, /const \[openDetailId, setOpenDetailId\] = useState\(null\)/);
  assert.match(historyPage, /closeOpenDetail\(\);/);
  assert.match(historyTable, /<ChanchitosDetail detail=\{detailState\.data\} \/>/);
  assert.match(historyTable, /const isDetailOpen = detailState\.id === record\.idMonitoreo/);
  assert.match(historyTable, /Total insectos/);
  assert.match(detail, /Total de insectos/);
  assert.match(historyTable, /indicadorAgroclimatico/);
  assert.match(detail, /indicadorAgroclimatico/);
  assert.doesNotMatch(historyTable, /HF .*DG/);
  assert.doesNotMatch(historyPage, /ChanchitosDetailPanel|panelDetailId|onOpenPanel/);
  assert.doesNotMatch(actions, /Abrir panel experimental|onOpenPanel/);
});

test('el historial React invalida respuestas obsoletas y correlaciona sus consultas', () => {
  const historyPage = fs.readFileSync(path.join(__dirname, '..', 'frontend', 'src', 'pages', 'chanchitos', 'ChanchitosHistoryPage.jsx'), 'utf8');
  const api = fs.readFileSync(path.join(__dirname, '..', 'frontend', 'src', 'api', 'chanchitosApi.js'), 'utf8');
  const service = fs.readFileSync(path.join(__dirname, '..', 'src', 'services', 'chanchitos.service.js'), 'utf8');

  assert.match(historyPage, /historyRequestSequenceRef/);
  assert.match(historyPage, /historyControllerRef\.current\?\.abort\(\)/);
  assert.match(historyPage, /historyRequestSequenceRef\.current !== sequence/);
  assert.match(historyPage, /historyRequestSequenceRef\.current \+= 1/);
  assert.match(api, /X-Request-Id/);
  assert.match(service, /\[MONIPLA\]\[CHANCHITOS\]\[HISTORIAL\]\[QUERY_START\]/);
  assert.match(service, /\[MONIPLA\]\[CHANCHITOS\]\[HISTORIAL\]\[QUERY_END\]/);
  assert.match(service, /etapaTimeout: error\.code === 'ETIMEOUT' \? consulta : null/);
  assert.match(service, /medir\('resumen', 'resumenMs'/);
  assert.match(service, /medir\('opciones', 'opcionesMs'/);
  assert.match(service, /medir\(\s*'pagina',\s*'paginaMs'/);
});

test('valida rangos de fecha sin consultar el repositorio', async () => {
  const { servicio, llamadas } = crearServicio();
  const resultado = await servicio.obtenerHistorial({ fechaDesde: '2026-08-20', fechaHasta: '2026-08-01' });

  assert.equal(resultado.success, false);
  assert.match(resultado.errors[0], /no puede ser posterior/);
  assert.deepEqual(llamadas, []);
});

test('el detalle completa las 12 combinaciones y conserva el total', async () => {
  const { servicio } = crearServicio();
  servicio.obtenerOpcionesHistorial = async () => {
    throw new Error('NO_DEBE_CARGAR_OPCIONES');
  };
  const detalle = await servicio.obtenerDetalle('440');

  assert.equal(detalle.matriz.length, 3);
  assert.equal(detalle.matriz.flatMap((fila) => fila.posiciones).length, 12);
  assert.equal(detalle.matriz[0].posiciones[0].cantidad, 3);
  assert.equal(detalle.matriz[0].posiciones[0].clasificacion.etiqueta, 'Baja');
  assert.equal(detalle.totalBichos, 7);
});

test('el detalle prepara la clasificación con la combinación real de estado y posición', async () => {
  const { servicio, repository } = crearServicio();
  repository.obtenerDetalleChanchitos = async () => ({
    cabecera: crearRegistro({ cant_plantas: 1 }),
    detalles: [
      { id_estadomonitoreo: 1, id_estadoposicion: 1, cantidad_bichos: 6 },
      { id_estadomonitoreo: 3, id_estadoposicion: 4, cantidad_bichos: 3 },
    ],
  });

  const detalle = await servicio.obtenerDetalle('440');
  assert.equal(detalle.matriz[0].posiciones[0].cantidad, 6);
  assert.equal(detalle.matriz[0].posiciones[0].clasificacion.etiqueta, 'Media');
  assert.equal(detalle.matriz[2].posiciones[3].cantidad, 3);
  assert.equal(detalle.matriz[2].posiciones[3].clasificacion.etiqueta, 'Alta');
});

test('el detalle conserva la trazabilidad historica resuelta por el repository', async () => {
  const { servicio, repository } = crearServicio();
  repository.obtenerDetalleChanchitos = async () => ({
    cabecera: crearRegistro({
      id_monitoreo: 441,
      id_catalogo_sdp: null,
      codigo_cuartel: '4',
      sdp: '60106',
      csg: '87703',
      trazabilidad: '0305',
    }),
    detalles: [],
  });

  const detalle = await servicio.obtenerDetalle('441');

  assert.equal(detalle.trazabilidad, '0305');
});

test('el detalle historico conserva los nombres GEN que presenta el historial y el PDF', async () => {
  const { servicio, repository } = crearServicio();
  repository.obtenerDetalleChanchitos = async () => ({
    cabecera: crearRegistro({
      id_monitoreo: 442,
      id_catalogo_sdp: null,
      nombre_fundo: 'LAS PINTADAS I',
      nombre_campo: 'EL CHILE',
      nombre_variedad: 'PRIME',
      codigo_cuartel: '3',
      sdp: '60106',
      csg: '87703',
      trazabilidad: '0305',
    }),
    detalles: [{ id_estadomonitoreo: 1, id_estadoposicion: 1, cantidad_bichos: 3 }],
  });

  const detalle = await servicio.obtenerDetalle('442');

  assert.equal(detalle.fundo, 'LAS PINTADAS I');
  assert.equal(detalle.campo, 'EL CHILE');
  assert.equal(detalle.variedad, 'PRIME');
  assert.equal(detalle.cuartel, '3');
  assert.equal(detalle.sdp, '60106');
  assert.equal(detalle.csg, '87703');
  assert.equal(detalle.trazabilidad, '0305');
  assert.equal(detalle.matriz.flatMap((fila) => fila.posiciones).length, 12);
  assert.equal(detalle.agroclima.diasGrado, '4.36');
});

test('el detalle sin catalogo ni nombres GEN no inventa identificacion agricola', async () => {
  const { servicio, repository } = crearServicio();
  repository.obtenerDetalleChanchitos = async () => ({
    cabecera: crearRegistro({
      id_catalogo_sdp: null,
      nombre_fundo: null,
      nombre_campo: null,
      nombre_variedad: null,
      trazabilidad: null,
    }),
    detalles: [],
  });

  const detalle = await servicio.obtenerDetalle('440');

  assert.equal(detalle.fundo, '-');
  assert.equal(detalle.campo, '-');
  assert.equal(detalle.variedad, '-');
  assert.equal(detalle.trazabilidad, '-');
});

test('la paginacion se aplica a cabeceras y los detalles se agregan despues por IDs parametrizados', () => {
  const contenido = fs.readFileSync(path.join(__dirname, '..', 'src', 'repositories', 'chanchitos.repository.js'), 'utf8');
  const bloqueListado = contenido.slice(
    contenido.indexOf('  async listarHistorialChanchitos('),
    contenido.indexOf('  async contarHistorialChanchitos(')
  );

  assert.match(bloqueListado, /INNER JOIN dbo\.MONI_CABECERAMONITOREO cab ON cab\.id_monitoreo = pagina\.id_monitoreo/);
  assert.match(bloqueListado, /BaseFiltrada AS \(/);
  assert.match(bloqueListado, /Pagina AS \(/);
  assert.match(bloqueListado, /OFFSET @offset ROWS FETCH NEXT @pageSize ROWS ONLY/);
  assert.match(bloqueListado, /this\.obtenerDetallesAgregadosPorMonitoreos/);
  assert.ok(
    bloqueListado.indexOf('OFFSET @offset ROWS FETCH NEXT @pageSize ROWS ONLY')
      < bloqueListado.indexOf('this.obtenerDetallesAgregadosPorMonitoreos'),
    'La pagina debe resolverse antes de agregar detalles'
  );
  assert.doesNotMatch(bloqueListado, /id_estadomonitoreo|id_estadoposicion/);
  assert.match(contenido, /WHERE id_monitoreo IN \(\$\{placeholders\.join\(', '\)\}\)/);
  assert.match(contenido, /SUM\(ISNULL\(cantidad_bichos, 0\)\) AS total_bichos/);
  assert.match(contenido, /\.input\('genFundo', this\.sql\.Int, filtros\.genFundo \|\| null\)/);
  assert.match(contenido, /\.input\('idCatalogoSdp', this\.sql\.Int, filtros\.idCatalogoSdp \|\| null\)/);
  assert.match(contenido, /obtenerPredicadoUbicacionResuelta\(/);
  assert.match(contenido, /'mbFiltro\.gen_fundo', 'gcFiltro\.GEN_FUNDO', 'cab\.gen_fundo', 'genFundo'/);
  assert.match(contenido, /\$\{columnaCatalogo\} IS NULL AND \$\{columnaCuartel\} = @\$\{parametro\}/);
});

test('conteo, resumen y filtros de fecha reutilizan la misma base y deteccion correlacionada', () => {
  const contenido = fs.readFileSync(path.join(__dirname, '..', 'src', 'repositories', 'chanchitos.repository.js'), 'utf8');
  const inicio = contenido.indexOf('  obtenerBaseFiltradaHistorialChanchitos(filtros) {');
  const fin = contenido.indexOf('obtenerJoinsPresentacionHistorialChanchitos', inicio);
  const base = contenido.slice(inicio, fin);

  assert.match(base, /cab\.fecha_monitoreo >= @fechaDesde/);
  assert.match(base, /cab\.fecha_monitoreo <= @fechaHasta/);
  assert.doesNotMatch(base, /CONVERT\([^\n]*fecha_monitoreo/);
  assert.match(contenido, /OPTION \(RECOMPILE\)/);
  assert.match(base, /EXISTS \([\s\S]*?FROM dbo\.MONI_DETALLEMONITOREO detFiltro/);
  assert.match(base, /NOT EXISTS \([\s\S]*?FROM dbo\.MONI_DETALLEMONITOREO detFiltro/);
  assert.doesNotMatch(base, /GROUP BY detFiltro\.id_monitoreo/);
  assert.match(contenido, /CREATE TABLE #BaseFiltradaResumen/);
  assert.match(contenido, /INNER JOIN #BaseFiltradaResumen base ON base\.id_monitoreo = det\.id_monitoreo/);
});

test('el historial usa selects con IDs y carga la jerarquia agricola con los endpoints existentes', () => {
  const vista = fs.readFileSync(path.join(__dirname, '..', 'src', 'views', 'chanchitos', 'historial.ejs'), 'utf8');
  const script = fs.readFileSync(path.join(__dirname, '..', 'src', 'public', 'js', 'chanchitos-historial.js'), 'utf8');

  ['genFundo', 'genCampo', 'genVariedad', 'idCatalogoSdp', 'idMonitoreador', 'idEstadoFenologico'].forEach((id) => {
    assert.match(vista, new RegExp(`<select id="${id}" name="${id}"`));
  });
  assert.match(vista, /value="<%= item\.id_monitoreador %>"/);
  assert.match(vista, /value="<%= item\.value %>"/);
  assert.match(script, /\/monitoreos\/api\/campos\//);
  assert.match(script, /\/monitoreos\/api\/variedades\//);
  assert.match(script, /\/monitoreos\/api\/cuarteles\//);
  assert.match(script, /pagina\.value = '1'/);
});

test('la pagina conserva filtros seleccionables y el PDF recibe todos sin paginacion', () => {
  const vista = fs.readFileSync(path.join(__dirname, '..', 'src', 'views', 'chanchitos', 'historial.ejs'), 'utf8');

  assert.match(vista, /\['fechaDesde', 'fechaHasta', 'genFundo', 'genCampo', 'genVariedad', 'idCatalogoSdp', 'idMonitoreador', 'idEstadoFenologico', 'deteccion', 'pageSize'\]/);
  assert.match(vista, /buildPdfUrl/);
  assert.match(vista, /\['fechaDesde', 'fechaHasta', 'genFundo', 'genCampo', 'genVariedad', 'idCatalogoSdp', 'idMonitoreador', 'idEstadoFenologico', 'deteccion'\]/);
  assert.doesNotMatch(vista.slice(vista.indexOf('const buildPdfUrl'), vista.indexOf('%>')), /pageSize|pagina/);
});

test('la URL de PDF usa valores actuales del formulario y excluye paginacion', () => {
  const { construirUrlPdfChanchitos } = require('../src/public/js/chanchitos-historial');
  const url = construirUrlPdfChanchitos({
    genFundo: '21', genCampo: '21', genVariedad: '27', idCatalogoSdp: '51',
    idMonitoreador: '3', pageSize: '50', pagina: '2', deteccion: 'CON_DETECCION',
  });

  assert.match(url, /^\/chanchitos\/pdf\/general\?/);
  assert.match(url, /genFundo=21/);
  assert.match(url, /idCatalogoSdp=51/);
  assert.match(url, /deteccion=CON_DETECCION/);
  assert.doesNotMatch(url, /pageSize|pagina/);
});

test('el historial usa filas de detalle diferido y el frontend conserva una sola carga por monitoreo', () => {
  const vista = fs.readFileSync(path.join(__dirname, '..', 'src', 'views', 'chanchitos', 'historial.ejs'), 'utf8');
  const script = fs.readFileSync(path.join(__dirname, '..', 'src', 'public', 'js', 'chanchitos-historial.js'), 'utf8');
  const { construirUrlDetalleParcialChanchitos } = require('../src/public/js/chanchitos-historial');

  assert.match(vista, /type="button" data-action="toggle-detalle" data-id-monitoreo="<%= registro\.idMonitoreo %>" aria-expanded="false"/);
  assert.match(vista, /<tr class="historial-detail-row" data-detail-row="<%= registro\.idMonitoreo %>" hidden>/);
  assert.match(vista, /<td colspan="9"><div class="historial-detail-container" data-detail-container="<%= registro\.idMonitoreo %>"><\/div><\/td>/);
  assert.doesNotMatch(vista, /href="\/chanchitos\/<%= registro\.idMonitoreo %>"/);
  assert.equal(construirUrlDetalleParcialChanchitos('440'), '/chanchitos/440/detalle-parcial');
  assert.equal(construirUrlDetalleParcialChanchitos('440x'), null);
  assert.match(script, /const detallesCargados = new Set\(\)/);
  assert.match(script, /if \(detallesCargados\.has\(idMonitoreo\)\) return/);
  assert.match(script, /cerrarDetalleActual\(\);/);
  assert.match(script, /button\.textContent = 'Ocultar detalle';/);
  assert.match(script, /actual\.button\.setAttribute\('aria-expanded', 'false'\)/);
});

test('el historial limita la eliminacion a admin y conserva modal, filtros y detalle desplegable', () => {
  const vista = fs.readFileSync(path.join(__dirname, '..', 'src', 'views', 'chanchitos', 'historial.ejs'), 'utf8');
  const script = fs.readFileSync(path.join(__dirname, '..', 'src', 'public', 'js', 'chanchitos-historial.js'), 'utf8');
  const { construirUrlEliminarChanchitos } = require('../src/public/js/chanchitos-historial');

  assert.match(vista, /<% if \(puedeEliminar\) \{ %>/);
  assert.match(vista, /data-action="confirmar-eliminacion"/);
  ['data-id-monitoreo', 'data-fecha-monitoreo', 'data-fundo', 'data-campo', 'data-variedad', 'data-cuartel', 'data-sdp', 'data-cant-plantas', 'data-total-bichos', 'data-monitoreador'].forEach((atributo) => assert.match(vista, new RegExp(atributo)));
  assert.match(vista, /id="chanchitos-eliminar-modal"/);
  assert.match(vista, /<form id="chanchitos-eliminar-form" method="POST">/);
  assert.match(vista, /Eliminar monitoreo/);
  assert.match(vista, /Esta acción es irreversible\./);
  ['fechaDesde', 'fechaHasta', 'genFundo', 'genCampo', 'genVariedad', 'idCatalogoSdp', 'idMonitoreador', 'idEstadoFenologico', 'deteccion', 'pagina', 'pageSize'].forEach((filtro) => assert.match(vista, new RegExp(`'${filtro}'`)));
  assert.equal(construirUrlEliminarChanchitos('440'), '/chanchitos/440/eliminar');
  assert.equal(construirUrlEliminarChanchitos('440x'), null);
  assert.match(script, /confirmarEliminacion\.disabled = true/);
  assert.match(script, /cerrarDetalleActual\(\);/);
  assert.match(script, /data-close-chanchitos-delete-modal/);
});

test('las rutas de historial y detalle exigen autenticacion y el detalle inexistente responde 404', async () => {
  const rutas = fs.readFileSync(path.join(__dirname, '..', 'src', 'routes', 'chanchitos.routes.js'), 'utf8');
  assert.match(rutas, /router\.get\('\/chanchitos\/historial', ensureAuthenticated, chanchitosController\.mostrarHistorial\)/);
  assert.match(rutas, /router\.post\('\/chanchitos\/:id\/eliminar', ensureAuthenticated, ensureAdmin, chanchitosController\.eliminar\)/);
  assert.match(rutas, /router\.get\('\/chanchitos\/:id\/detalle-parcial', ensureAuthenticated, chanchitosController\.mostrarDetalleParcial\)/);
  assert.match(rutas, /router\.get\('\/chanchitos\/:id', ensureAuthenticated, chanchitosController\.mostrarDetalle\)/);
  assert.ok(rutas.indexOf("'/chanchitos/historial'") < rutas.indexOf("'/chanchitos/:id'"));
  assert.ok(rutas.indexOf("'/chanchitos/pdf/general'") < rutas.indexOf("'/chanchitos/:id'"));
  assert.ok(rutas.indexOf("'/chanchitos/:id/detalle-parcial'") < rutas.indexOf("'/chanchitos/:id'"));

  const controller = new ChanchitosController({
    obtenerDetalle: async () => { throw new Error('CHANCHITO_NO_EXISTE'); },
  }, {});
  const response = {
    statusCode: 200,
    status(code) { this.statusCode = code; return this; },
    render(view, data) { this.view = view; this.data = data; return data; },
  };
  await controller.mostrarDetalle({ params: { id: '999' } }, response);
  assert.equal(response.statusCode, 404);
});
