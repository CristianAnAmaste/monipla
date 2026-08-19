import { requestJson } from './apiClient';

export function obtenerFormularioChanchitos(signal) {
  return requestJson('/app/api/chanchitos/nuevo', { signal });
}

export function guardarMonitoreoChanchitos(values, images = []) {
  const formData = new FormData();

  Object.entries(values).forEach(([name, value]) => {
    formData.append(name, value ?? '');
  });
  images.forEach((image) => formData.append('imagenes', image));

  return requestJson('/app/api/chanchitos', {
    method: 'POST',
    body: formData,
  });
}

export function obtenerHistorialChanchitos(filters = {}, signal) {
  const query = new URLSearchParams();
  [
    'fechaDesde', 'fechaHasta', 'genFundo', 'genCampo', 'genVariedad',
    'idCatalogoSdp', 'idMonitoreador', 'idEstadoFenologico', 'deteccion', 'pagina', 'pageSize',
  ].forEach((key) => {
    if (filters[key] !== undefined && filters[key] !== null && filters[key] !== '') {
      query.set(key, filters[key]);
    }
  });
  const serialized = query.toString();
  return requestJson(`/app/api/chanchitos/historial${serialized ? `?${serialized}` : ''}`, { signal });
}

export function obtenerDetalleChanchitos(idMonitoreo, signal) {
  return requestJson(`/app/api/chanchitos/${idMonitoreo}/detalle`, { signal });
}

export function eliminarMonitoreoChanchitos(idMonitoreo) {
  return requestJson(`/app/api/chanchitos/${idMonitoreo}`, { method: 'DELETE' });
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
