const MAX_INT = 2147483647;

export const ESTADOS_MONITOREO = [
  { id: 1, label: 'Ovisaco' },
  { id: 2, label: 'Ninfa' },
  { id: 3, label: 'Adulto' },
];

export const POSICIONES_MONITOREO = [
  { id: 1, label: 'Base corteza' },
  { id: 2, label: 'Base brote' },
  { id: 3, label: 'Hoja' },
  { id: 4, label: 'Racimo' },
];

export const CHANCHITOS_STEP_FIELDS = Object.freeze({
  1: ['genFundo', 'genCampo', 'genVariedad', 'idCatalogoSdp'],
  2: ['fechaMonitoreo', 'idMonitoreador', 'idEstadoFenologico', 'cantPlantas'],
  3: ESTADOS_MONITOREO.flatMap(({ id: estado }) => POSICIONES_MONITOREO.map(
    ({ id: posicion }) => `cantidad_${estado}_${posicion}`
  )),
  4: [],
  5: [],
});

export function createInitialValues() {
  const values = {
    genFundo: '',
    genCampo: '',
    genVariedad: '',
    idCatalogoSdp: '',
    cantPlantas: '',
    fechaMonitoreo: '',
    idEstadoFenologico: '',
    idMonitoreador: '',
    observaciones: '',
  };

  ESTADOS_MONITOREO.forEach(({ id: estado }) => {
    POSICIONES_MONITOREO.forEach(({ id: posicion }) => {
      values[`cantidad_${estado}_${posicion}`] = '';
    });
  });

  return values;
}

function isPositiveInteger(value) {
  return /^\d+$/.test(String(value).trim()) && Number(value) > 0 && Number(value) <= MAX_INT;
}

function isValidDate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false;
  }

  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
}

export function validateChanchitosForm(values) {
  const fieldErrors = {};

  if (!isPositiveInteger(values.genFundo)) fieldErrors.genFundo = 'Debe seleccionar un fundo válido.';
  if (!isPositiveInteger(values.genCampo)) fieldErrors.genCampo = 'Debe seleccionar un campo válido.';
  if (!isPositiveInteger(values.genVariedad)) fieldErrors.genVariedad = 'Debe seleccionar una variedad válida.';
  if (!isPositiveInteger(values.idCatalogoSdp)) fieldErrors.idCatalogoSdp = 'Debe seleccionar un cuartel válido.';
  if (!isPositiveInteger(values.cantPlantas)) fieldErrors.cantPlantas = 'La cantidad de plantas debe ser un entero mayor que cero.';
  if (!isValidDate(values.fechaMonitoreo)) fieldErrors.fechaMonitoreo = 'Debe ingresar una fecha de monitoreo válida.';
  if (!isPositiveInteger(values.idEstadoFenologico)) fieldErrors.idEstadoFenologico = 'Debe seleccionar un estado fenológico válido.';
  if (!isPositiveInteger(values.idMonitoreador)) fieldErrors.idMonitoreador = 'Debe seleccionar un monitoreador válido.';

  ESTADOS_MONITOREO.forEach(({ id: estado }) => {
    POSICIONES_MONITOREO.forEach(({ id: posicion }) => {
      const field = `cantidad_${estado}_${posicion}`;
      const rawValue = String(values[field] ?? '').trim();
      const isValid = rawValue === '' || (/^\d+$/.test(rawValue) && Number(rawValue) <= MAX_INT);

      if (!isValid) {
        fieldErrors[field] = `La cantidad ${estado}-${posicion} debe ser un entero entre 0 y ${MAX_INT}.`;
      }
    });
  });

  return fieldErrors;
}

export function validateChanchitosStep(values, step) {
  const fieldErrors = validateChanchitosForm(values);
  const fields = CHANCHITOS_STEP_FIELDS[step] || [];

  return Object.fromEntries(Object.entries(fieldErrors).filter(([field]) => fields.includes(field)));
}

export function getChanchitosStepForField(field) {
  return Number(Object.entries(CHANCHITOS_STEP_FIELDS).find(([, fields]) => fields.includes(field))?.[0]) || null;
}
