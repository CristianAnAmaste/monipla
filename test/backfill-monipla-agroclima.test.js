const test = require('node:test');
const assert = require('node:assert/strict');
const {
  parsearArgumentos,
  esSnapshotAplicable,
  snapshotsIguales,
} = require('../scripts/backfill-monipla-agroclima');

test('permite simular el recalculo masivo sin confirmacion', () => {
  assert.deepEqual(parsearArgumentos(['--recalcular']), {
    apply: false,
    idMuestreo: null,
    recalcular: true,
    confirmarTodos: false,
  });
});

test('bloquea aplicar el recalculo masivo sin confirmacion explicita', () => {
  assert.throws(
    () => parsearArgumentos(['--recalcular', '--apply']),
    /--confirmar-todos/
  );
});

test('permite recalcular y aplicar un solo monitoreo', () => {
  assert.deepEqual(parsearArgumentos(['--recalcular', '--id', '31', '--apply']), {
    apply: true,
    idMuestreo: 31,
    recalcular: true,
    confirmarTodos: false,
  });
});

test('considera aplicable un snapshot definitivo sin estacion', () => {
  assert.equal(esSnapshotAplicable({
    horasFrioAcumuladas: null,
    diasGradoAcumulados: null,
    fechaCorteAgroclima: null,
    agroclimaObservacion: 'Sin estacion meteorologica asociada al fundo.',
  }), true);
});

test('detecta cambio de estacion aunque los acumulados sean iguales', () => {
  const base = {
    horasFrioAcumuladas: 405.27,
    diasGradoAcumulados: null,
    fechaCorteAgroclima: '2026-07-07',
    semanaIsoCorte: 28,
    temporadaAgroclima: '2026',
    agroclimaObservacion: 'Agroclima OK desde Meteo FEAL.',
  };

  assert.equal(snapshotsIguales(
    {
      ...base,
      estacionMeteoUuid: 'ec674291-52c6-416b-9f61-72bd680fd038',
      nombreEstacionMeteo: 'LTZ',
    },
    {
      ...base,
      estacionMeteoUuid: '9373a0db-6a2d-48c9-883a-f23e6f26753b',
      nombreEstacionMeteo: 'NTC',
    }
  ), false);
});
