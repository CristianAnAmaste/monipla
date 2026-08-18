import { requestJson } from './apiClient';

export function obtenerFormularioChanchitos(signal) {
  return requestJson('/app/api/chanchitos/nuevo', { signal });
}

export function guardarMonitoreoChanchitos(values) {
  return requestJson('/app/api/chanchitos', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(values),
  });
}

export function obtenerCampos(genFundo, signal) {
  return requestJson(`/monitoreos/api/campos/${encodeURIComponent(genFundo)}`, { signal });
}

export function obtenerVariedades(genFundo, genCampo, signal) {
  return requestJson(
    `/monitoreos/api/variedades/${encodeURIComponent(genFundo)}/${encodeURIComponent(genCampo)}`,
    { signal }
  );
}

export function obtenerCuarteles(genFundo, genCampo, genVariedad, signal) {
  return requestJson(
    `/monitoreos/api/cuarteles/${encodeURIComponent(genFundo)}/${encodeURIComponent(genCampo)}/${encodeURIComponent(genVariedad)}`,
    { signal }
  );
}
