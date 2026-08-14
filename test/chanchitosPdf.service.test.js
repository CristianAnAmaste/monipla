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
  assert.equal(reporte.buffer.subarray(0, 5).toString(), '%PDF-');
  assert.match(reporte.filename, /^monipla-chanchitos-reporte-general-\d{8}\.pdf$/);
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
