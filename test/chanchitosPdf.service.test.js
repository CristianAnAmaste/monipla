const test = require('node:test');
const assert = require('node:assert/strict');
const ChanchitosPdfService = require('../src/services/chanchitosPdf.service');

function filasDetalle(cabecera, cantidades = []) {
  const filas = [];

  [1, 2, 3].forEach((idEstadoMonitoreo) => {
    [1, 2, 3, 4].forEach((idEstadoPosicion) => {
      filas.push({
        ...cabecera,
        id_estadomonitoreo: idEstadoMonitoreo,
        id_estadoposicion: idEstadoPosicion,
        cantidad_bichos: cantidades[filas.length] ?? 0,
      });
    });
  });

  return filas;
}

const nuevo438 = {
  id_monitoreo: 438,
  fecha_monitoreo: '2026-08-05',
  gen_cuartel: null,
  id_catalogo_sdp: 105,
  codigo_cuartel: '1',
  nombre_fundo: 'NANTOCO',
  nombre_campo: 'LA ROTONDA',
  nombre_variedad: 'AUTUMN CRISP',
  sdp: 60149,
  csg: 87720,
  trazabilidad: '0102',
  nombre_estado_fenologico: 'Pinta',
  cant_plantas: 12,
  nombre_monitoreador: 'Jocelyn Pasten',
  observaciones: 'asdf',
};

const historico429 = {
  id_monitoreo: 429,
  fecha_monitoreo: '2026-08-04',
  gen_cuartel: 51,
  id_catalogo_sdp: null,
  codigo_cuartel: '5',
  nombre_fundo: 'BUENOS AIRES',
  nombre_campo: 'BUENOS AIRES',
  nombre_variedad: 'RED GLOBE',
  sdp: 63632,
  csg: null,
  trazabilidad: null,
  nombre_estado_fenologico: 'Envero',
  cant_plantas: 10,
  nombre_monitoreador: 'Margarita Garrido',
  observaciones: '   ',
};

function crearServicio(filas = []) {
  const llamadas = [];
  const repository = {
    obtenerMonitoreosPdfGeneral: async (filtros) => {
      llamadas.push(filtros);
      return filas;
    },
  };

  return {
    llamadas,
    servicio: new ChanchitosPdfService(repository, { logoPath: null }),
  };
}

test('genera reporte sin filtros, agrupa una cabecera y devuelve un PDF valido', async () => {
  const filas = filasDetalle(nuevo438, [1, 1, 1, 1, 1, 1, 1, 0, 0, 0, 0, 0]);
  const { servicio, llamadas } = crearServicio(filas);

  const reporte = await servicio.generarReporteGeneral();

  assert.deepEqual(llamadas, [{
    fechaDesde: null, fechaHasta: null, genFundo: null, genCampo: null,
    genVariedad: null, idCatalogoSdp: null, idMonitoreador: null,
    idEstadoFenologico: null, deteccion: '',
  }]);
  assert.equal(reporte.totalMonitoreos, 1);
  assert.equal(reporte.paginas, 1);
  assert.equal(reporte.buffer.subarray(0, 5).toString(), '%PDF-');
  assert.match(reporte.filename, /^monipla-chanchitos-reporte-general-\d{8}\.pdf$/);
});

test('mantiene los filtros del contrato y descarta solamente pagina y pageSize', async () => {
  const { servicio, llamadas } = crearServicio([]);

  await servicio.generarReporteGeneral({
    fechaDesde: '2026-08-01',
    fechaHasta: '2026-08-13',
    genFundo: '9',
    genCampo: '12',
    genVariedad: '18',
    idCatalogoSdp: '44',
    idMonitoreador: '3',
    idEstadoFenologico: '7',
    deteccion: 'SIN_DETECCION',
    pagina: '4',
    pageSize: '50',
  });

  assert.deepEqual(llamadas, [{
    fechaDesde: '2026-08-01', fechaHasta: '2026-08-13', genFundo: 9,
    genCampo: 12, genVariedad: 18, idCatalogoSdp: 44,
    idMonitoreador: 3, idEstadoFenologico: 7, deteccion: 'SIN_DETECCION',
  }]);
});

test('compacta tres monitoreos normales en una pagina y cuatro en dos paginas', async () => {
  const filasTres = [438, 439, 440].flatMap((id_monitoreo) => filasDetalle({
    ...nuevo438,
    id_monitoreo,
    observaciones: 'Observacion breve.',
  }, [1, 2, 3, 0, 1, 2, 0, 0, 0, 0, 0, 0]));
  const { servicio: servicioTres } = crearServicio(filasTres);
  const reporteTres = await servicioTres.generarReporteGeneral();

  assert.equal(reporteTres.totalMonitoreos, 3);
  assert.equal(reporteTres.paginas, 1);

  const filasCuatro = [438, 439, 440, 441].flatMap((id_monitoreo) => filasDetalle({
    ...nuevo438,
    id_monitoreo,
    observaciones: 'Observacion breve.',
  }, [1, 2, 3, 0, 1, 2, 0, 0, 0, 0, 0, 0]));
  const { servicio: servicioCuatro } = crearServicio(filasCuatro);
  const reporteCuatro = await servicioCuatro.generarReporteGeneral();

  assert.equal(reporteCuatro.totalMonitoreos, 4);
  assert.equal(reporteCuatro.paginas, 2);
});

test('presenta agroclima completo, matriz de presion y observaciones largas sin truncarlas', async () => {
  const observacionLarga = 'Observacion extensa para validar la altura dinamica de la ficha. '.repeat(18);
  const cabecera = {
    ...nuevo438,
    horas_frio_acumuladas: 431.53,
    dias_grado_acumulados: 19.61,
    nombre_estacion_meteo: 'NTC',
    fecha_corte_agroclima: '2026-08-12',
    observaciones: observacionLarga,
  };
  const { servicio } = crearServicio(filasDetalle(cabecera, [12, 24, 36, 0, 1, 2, 3, 4, 5, 6, 7, 8]));

  const reporte = await servicio.generarReporteGeneral();
  const [monitoreo] = servicio.agruparMonitoreos(filasDetalle(cabecera, [12, 24, 36, 0, 1, 2, 3, 4, 5, 6, 7, 8]));

  assert.equal(reporte.paginas, 1);
  assert.match(servicio.descripcionAgroclimaCompleto(monitoreo), /HF 431,53 h · DG 19,61 · NTC · Corte/);
  assert.equal(monitoreo.totalIndividuos, 108);
  assert.equal(monitoreo.matriz.length, 3);
  assert.equal(monitoreo.matriz.every((fila) => fila.celdas.length === 4), true);
  assert.equal(monitoreo.observaciones, observacionLarga.trim());
  assert.ok(servicio.calcularAlturaFicha({
    page: { width: 792, height: 612, margins: { left: 24, right: 24, top: 24, bottom: 34 } },
    font() { return this; },
    fontSize() { return this; },
    heightOfString(texto) { return Math.ceil(String(texto).length / 75) * 8; },
  }, monitoreo) > 136);
});

test('valida filtros de fecha y los entrega al repositorio', async () => {
  const { servicio, llamadas } = crearServicio([]);

  await servicio.generarReporteGeneral({ fechaDesde: '2026-08-01', fechaHasta: '2026-08-05' });
  assert.deepEqual(llamadas, [{
    fechaDesde: '2026-08-01', fechaHasta: '2026-08-05', genFundo: null,
    genCampo: null, genVariedad: null, idCatalogoSdp: null,
    idMonitoreador: null, idEstadoFenologico: null, deteccion: '',
  }]);

  await assert.rejects(
    servicio.generarReporteGeneral({ fechaDesde: '2026-99-01' }),
    /FILTROS_REPORTE_INVALIDOS/
  );
  await assert.rejects(
    servicio.generarReporteGeneral({ fechaDesde: '2026-08-06', fechaHasta: '2026-08-05' }),
    /FILTROS_REPORTE_INVALIDOS/
  );
});

test('normaliza todos los filtros del historial antes de consultar el PDF', async () => {
  const { servicio, llamadas } = crearServicio([]);

  await servicio.generarReporteGeneral({
    genFundo: '9', genCampo: '12', genVariedad: '18', idCatalogoSdp: '44',
    idMonitoreador: '3', idEstadoFenologico: '7', deteccion: 'CON_DETECCION',
  });

  assert.deepEqual(llamadas, [{
    fechaDesde: null, fechaHasta: null, genFundo: 9, genCampo: 12,
    genVariedad: 18, idCatalogoSdp: 44, idMonitoreador: 3,
    idEstadoFenologico: 7, deteccion: 'CON_DETECCION',
  }]);
});

test('agrupa una cabecera unica y anexa los detalles desde el segundo resultset', () => {
  const { servicio } = crearServicio();
  const detalles = filasDetalle(nuevo438, [1, 1, 1, 1, 1, 1, 1, 0, 0, 0, 0, 0])
    .map(({ id_monitoreo, id_estadomonitoreo, id_estadoposicion, cantidad_bichos }) => ({
      id_monitoreo, id_estadomonitoreo, id_estadoposicion, cantidad_bichos,
    }));
  const [monitoreo] = servicio.agruparMonitoreos({
    cabeceras: [{
      ...nuevo438,
      nombre_monitoreador: '',
      nombre_estado_fenologico: '',
      id_monitoreador: 3,
      id_estadofenologico: 7,
    }],
    detalles,
  }, {
    monitoreadores: [{ id_monitoreador: 3, nombre_monitoreador: 'Jocelyn Pasten' }],
    estadosFenologicos: [{ id_estadofenologico: 7, nom_estadofenologico: 'Envero' }],
  });

  assert.equal(monitoreo.idMonitoreo, 438);
  assert.equal(monitoreo.totalIndividuos, 7);
  assert.equal(monitoreo.monitoreador, 'Jocelyn Pasten');
  assert.equal(monitoreo.estadoFenologico, 'Envero');
  assert.equal(monitoreo.detallesValidos, 12);
});

test('incluye registros nuevos e historicos sin depender de gen_cuartel o id_catalogo_sdp', () => {
  const filas = [
    ...filasDetalle(nuevo438, [1, 1, 1, 1, 1, 1, 1, 0, 0, 0, 0, 0]),
    ...filasDetalle(historico429),
  ];
  const { servicio } = crearServicio();

  const monitoreos = servicio.agruparMonitoreos(filas);
  const nuevo = monitoreos.find((item) => item.idMonitoreo === 438);
  const historico = monitoreos.find((item) => item.idMonitoreo === 429);

  assert.equal(monitoreos.length, 2);
  assert.equal(nuevo.cuartel, '1');
  assert.equal(nuevo.sdp, 60149);
  assert.equal(nuevo.csg, 87720);
  assert.equal(nuevo.monitoreador, 'Jocelyn Pasten');
  assert.equal(nuevo.totalIndividuos, 7);
  assert.deepEqual(nuevo.matriz.map((fila) => [fila.estado, ...fila.celdas.map((celda) => celda.cantidad)]), [
    ['Ovisaco', 1, 1, 1, 1],
    ['Ninfa', 1, 1, 1, 0],
    ['Adulto', 0, 0, 0, 0],
  ]);
  assert.equal(historico.cuartel, '5');
  assert.equal(historico.sdp, 63632);
  assert.equal(historico.monitoreador, 'Margarita Garrido');
  assert.equal(historico.totalIndividuos, 0);
  assert.equal(historico.observaciones, 'Sin observaciones');
  assert.equal(historico.matriz[0].celdas[0].cantidad, 0);
});

test('resuelve trazabilidad nueva e historica sin adivinar y conserva los ceros iniciales', () => {
  const { servicio } = crearServicio();
  const cabeceras = [441, 442, 443, 444, 445, 446].map((id_monitoreo) => ({
    ...nuevo438,
    id_monitoreo,
    id_catalogo_sdp: id_monitoreo === 446 ? 99 : null,
    trazabilidad: null,
  }));
  const detalles = cabeceras.flatMap((cabecera) => filasDetalle(cabecera)
    .map(({ id_monitoreo, id_estadomonitoreo, id_estadoposicion, cantidad_bichos }) => ({
      id_monitoreo, id_estadomonitoreo, id_estadoposicion, cantidad_bichos,
    })));
  const monitoreos = servicio.agruparMonitoreos({
    cabeceras,
    detalles,
    catalogos: [{ id_catalogo_sdp: 99, codigo_trazabilidad: 'N/A' }],
    trazabilidades: [
      { id_monitoreo: 441, codigo_trazabilidad: '0305', cantidad_coincidencias: 1, cantidad_trazabilidades_distintas: 1, estado_resolucion: 'HISTORICA_UNICA' },
      { id_monitoreo: 442, codigo_trazabilidad: '0305', cantidad_coincidencias: 1, cantidad_trazabilidades_distintas: 1, estado_resolucion: 'HISTORICA_UNICA' },
      { id_monitoreo: 443, codigo_trazabilidad: '4958', cantidad_coincidencias: 1, cantidad_trazabilidades_distintas: 1, estado_resolucion: 'HISTORICA_UNICA' },
      { id_monitoreo: 444, codigo_trazabilidad: null, cantidad_coincidencias: 1, cantidad_trazabilidades_distintas: 0, estado_resolucion: 'SIN_TRAZABILIDAD' },
      { id_monitoreo: 445, codigo_trazabilidad: null, cantidad_coincidencias: 2, cantidad_trazabilidades_distintas: 2, estado_resolucion: 'AMBIGUA' },
      { id_monitoreo: 446, codigo_trazabilidad: '0009', cantidad_coincidencias: 1, cantidad_trazabilidades_distintas: 1, estado_resolucion: 'POR_ID_CATALOGO' },
    ],
  });
  const porId = new Map(monitoreos.map((monitoreo) => [monitoreo.idMonitoreo, monitoreo]));

  assert.equal(porId.get(441).trazabilidad, '0305');
  assert.equal(porId.get(442).trazabilidad, '0305');
  assert.equal(porId.get(443).trazabilidad, '4958');
  assert.equal(porId.get(444).trazabilidad, '');
  assert.equal(porId.get(445).trazabilidad, '');
  assert.equal(porId.get(445).trazabilidadEstadoResolucion, 'AMBIGUA');
  assert.equal(porId.get(446).trazabilidad, '0009');
  assert.equal(porId.get(446).trazabilidadEstadoResolucion, 'POR_ID_CATALOGO');
  assert.equal(servicio.normalizarTrazabilidad(' N/A '), '');
  assert.equal(servicio.normalizarTrazabilidad('S/SDP'), '');
});

test('preserva cuarteles alfanumericos y detecta detalles faltantes o duplicados', () => {
  const filas = filasDetalle({ ...nuevo438, codigo_cuartel: '6A', observaciones: null }, [2]);
  filas.pop();
  filas.push({ ...filas[0], cantidad_bichos: 3 });
  const { servicio } = crearServicio();

  const [monitoreo] = servicio.agruparMonitoreos(filas);

  assert.equal(monitoreo.cuartel, '6A');
  assert.equal(monitoreo.observaciones, 'Sin observaciones');
  assert.equal(monitoreo.detallesValidos, 11);
  assert.equal(monitoreo.matriz[2].celdas[3].cantidad, null);
  assert.equal(monitoreo.detallesDuplicados, 1);
  assert.match(monitoreo.advertencias.join(' '), /Detalle incompleto: 11 de 12/);
  assert.match(monitoreo.advertencias.join(' '), /Detalle duplicado: 1/);
});

test('detecta detalles fuera de la matriz canonica sin interrumpir el reporte', () => {
  const filas = filasDetalle(nuevo438);
  filas.push({ ...nuevo438, id_estadomonitoreo: 4, id_estadoposicion: 1, cantidad_bichos: 9 });
  const { servicio } = crearServicio();

  const [monitoreo] = servicio.agruparMonitoreos(filas);

  assert.equal(monitoreo.detallesFueraRango, 1);
  assert.match(monitoreo.advertencias.join(' '), /Detalle fuera de rango: 1/);
  assert.equal(monitoreo.matriz.length, 3);
  assert.equal(monitoreo.matriz[0].celdas.length, 4);
});
