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
    obtenerHistorialConsolidado: async (filtros, pagina, pageSize) => {
      llamadas.push(['consolidado', filtros, pagina, pageSize]);
      return {
        resumen: { total_registros: 26, total_plantas: 520, total_bichos: 91, monitoreos_con_deteccion: 12 },
        totalRegistros: 26,
        cabeceras: [crearRegistro({ id_catalogo_sdp: null, gen_cuartel: null })],
        detalles: [{ id_monitoreo: 440, id_estadomonitoreo: 1, id_estadoposicion: 1, cantidad_bichos: 7 }],
      };
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

test('normaliza filtros, conserva paginacion y presenta historicos sin id_catalogo_sdp', async () => {
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
  assert.deepEqual(llamadas.map(([nombre]) => nombre), ['consolidado']);
  assert.equal(llamadas[0][2], 9);
  assert.equal(llamadas[0][3], 25);
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
  const detalle = await servicio.obtenerDetalle('440');

  assert.equal(detalle.matriz.length, 3);
  assert.equal(detalle.matriz.flatMap((fila) => fila.posiciones).length, 12);
  assert.equal(detalle.matriz[0].posiciones[0].cantidad, 3);
  assert.equal(detalle.totalBichos, 7);
});

test('la paginacion se aplica a cabeceras y los detalles se agregan despues por IDs parametrizados', () => {
  const contenido = fs.readFileSync(path.join(__dirname, '..', 'src', 'repositories', 'chanchitos.repository.js'), 'utf8');

  assert.match(contenido, /FROM dbo\.MONI_CABECERAMONITOREO cab/);
  assert.match(contenido, /FROM dbo\.MONI_DETALLEMONITOREO det/);
  assert.match(contenido, /BaseFiltrada AS \(/);
  assert.match(contenido, /Pagina AS \(/);
  assert.match(contenido, /OFFSET @offset ROWS FETCH NEXT @pageSize ROWS ONLY/);
  assert.match(contenido, /async obtenerDetallesAgregadosPorMonitoreos/);
  assert.match(contenido, /WHERE id_monitoreo IN \(\$\{placeholders\.join\(', '\)\}\)/);
  assert.match(contenido, /SUM\(ISNULL\(cantidad_bichos, 0\)\) AS total_bichos/);
  assert.match(contenido, /\.input\('genFundo', this\.sql\.Int, filtros\.genFundo \|\| null\)/);
  assert.match(contenido, /\.input\('idCatalogoSdp', this\.sql\.Int, filtros\.idCatalogoSdp \|\| null\)/);
});

test('conteo, resumen y filtros de fecha reutilizan la misma base sin conversiones en WHERE', () => {
  const contenido = fs.readFileSync(path.join(__dirname, '..', 'src', 'repositories', 'chanchitos.repository.js'), 'utf8');
  const inicio = contenido.indexOf('  obtenerBaseFiltradaHistorialChanchitos(filtros) {');
  const fin = contenido.indexOf('obtenerJoinsPresentacionHistorialChanchitos', inicio);
  const base = contenido.slice(inicio, fin);

  assert.match(base, /cab\.fecha_monitoreo >= @fechaDesde/);
  assert.match(base, /cab\.fecha_monitoreo <= @fechaHasta/);
  assert.doesNotMatch(base, /CONVERT\([^\n]*fecha_monitoreo/);
  assert.match(contenido, /OPTION \(RECOMPILE\)/);
  assert.match(base, /MAX\(CASE WHEN ISNULL\(detFiltro\.cantidad_bichos, 0\) > 0 THEN 1 ELSE 0 END\) AS tiene_deteccion/);
  assert.match(base, /GROUP BY detFiltro\.id_monitoreo/);
  assert.doesNotMatch(base, /EXISTS \(SELECT 1 FROM dbo\.MONI_DETALLEMONITOREO/);
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

test('las rutas de historial y detalle exigen autenticacion y el detalle inexistente responde 404', async () => {
  const rutas = fs.readFileSync(path.join(__dirname, '..', 'src', 'routes', 'chanchitos.routes.js'), 'utf8');
  assert.match(rutas, /router\.get\('\/chanchitos\/historial', ensureAuthenticated, chanchitosController\.mostrarHistorial\)/);
  assert.match(rutas, /router\.get\('\/chanchitos\/:id', ensureAuthenticated, chanchitosController\.mostrarDetalle\)/);
  assert.ok(rutas.indexOf("'/chanchitos/historial'") < rutas.indexOf("'/chanchitos/:id'"));
  assert.ok(rutas.indexOf("'/chanchitos/pdf/general'") < rutas.indexOf("'/chanchitos/:id'"));

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
