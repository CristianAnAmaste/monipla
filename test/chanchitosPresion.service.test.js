const test = require('node:test');
const assert = require('node:assert/strict');
const ChanchitosPresionService = require('../src/services/chanchitosPresion.service');

const service = new ChanchitosPresionService();

function clasificar(idEstadoMonitoreo, idEstadoPosicion, presion, cantPlantas = 1) {
  return service.clasificarPresion({
    idEstadoMonitoreo,
    idEstadoPosicion,
    cantidad: presion * cantPlantas,
    cantPlantas,
  });
}

const limites = [
  [1, 1, [[0, 'NULA'], [1, 'BAJA'], [5, 'BAJA'], [6, 'MEDIA'], [15, 'MEDIA'], [16, 'ALTA']]],
  [1, 2, [[1, 'BAJA'], [2, 'MEDIA'], [5, 'MEDIA'], [6, 'ALTA']]],
  [1, 3, [[1, 'BAJA'], [2, 'MEDIA'], [3, 'ALTA']]],
  [1, 4, [[1, 'BAJA'], [2, 'MEDIA'], [3, 'ALTA']]],
  [2, 1, [[5, 'BAJA'], [6, 'MEDIA'], [15, 'MEDIA'], [16, 'ALTA']]],
  [2, 2, [[1, 'BAJA'], [2, 'MEDIA'], [3, 'ALTA']]],
  [2, 3, [[2, 'BAJA'], [3, 'MEDIA'], [5, 'MEDIA'], [6, 'ALTA']]],
  [2, 4, [[1, 'BAJA'], [2, 'MEDIA'], [3, 'ALTA']]],
  [3, 1, [[10, 'BAJA'], [11, 'MEDIA'], [20, 'MEDIA'], [21, 'ALTA']]],
  [3, 2, [[2, 'BAJA'], [3, 'MEDIA'], [5, 'MEDIA'], [6, 'ALTA']]],
  [3, 3, [[2, 'BAJA'], [3, 'MEDIA'], [4, 'MEDIA'], [5, 'ALTA']]],
  [3, 4, [[1, 'BAJA'], [2, 'MEDIA'], [3, 'ALTA']]],
];

test('aplica todos los umbrales de Ovisaco, Ninfa y Adulto', () => {
  limites.forEach(([estado, posicion, casos]) => {
    casos.forEach(([presion, nivel]) => {
      const resultado = clasificar(estado, posicion, presion);
      assert.equal(resultado.nivel, nivel, `estado ${estado}, posicion ${posicion}, presion ${presion}`);
      assert.equal(resultado.presion, presion);
    });
  });
});

test('cantidad cero con plantas validas es Nula y conserva etiqueta y color', () => {
  const resultado = clasificar(1, 1, 0, 8);

  assert.deepEqual(resultado, {
    nivel: 'NULA',
    etiqueta: 'Nula',
    color: '#d9f2d9',
    presion: 0,
    cantidad: 0,
    cantPlantas: 8,
  });
});

test('expone las etiquetas y colores corporativos de todos los niveles', () => {
  const resultados = [
    clasificar(1, 1, 0),
    clasificar(1, 1, 1),
    clasificar(1, 1, 6),
    clasificar(1, 1, 16),
  ];

  assert.deepEqual(resultados.map(({ etiqueta, color }) => [etiqueta, color]), [
    ['Nula', '#d9f2d9'],
    ['Baja', '#cfe6ff'],
    ['Media', '#fff59d'],
    ['Alta', '#ffb3b3'],
  ]);
});

test('usa Math.ceil para la presion', () => {
  const resultado = service.clasificarPresion({
    idEstadoMonitoreo: 1,
    idEstadoPosicion: 1,
    cantidad: 41,
    cantPlantas: 8,
  });

  assert.equal(resultado.presion, 6);
  assert.equal(resultado.nivel, 'MEDIA');
});

test('no divide por cero ni por plantas invalidas', () => {
  [0, null, undefined, Number.NaN].forEach((cantPlantas) => {
    const resultado = service.clasificarPresion({
      idEstadoMonitoreo: 1,
      idEstadoPosicion: 1,
      cantidad: 2,
      cantPlantas,
    });
    assert.equal(resultado.nivel, 'NO_APLICA');
    assert.equal(resultado.etiqueta, 'No aplica');
    assert.equal(resultado.color, '#eeeeee');
    assert.equal(resultado.presion, null);
  });
});

test('estado o posicion invalidos devuelven No aplica', () => {
  [
    { idEstadoMonitoreo: 9, idEstadoPosicion: 1 },
    { idEstadoMonitoreo: 1, idEstadoPosicion: 9 },
  ].forEach(({ idEstadoMonitoreo, idEstadoPosicion }) => {
    const resultado = service.clasificarPresion({
      idEstadoMonitoreo,
      idEstadoPosicion,
      cantidad: 1,
      cantPlantas: 1,
    });
    assert.equal(resultado.nivel, 'NO_APLICA');
    assert.equal(resultado.etiqueta, 'No aplica');
    assert.equal(resultado.color, '#eeeeee');
  });
});
