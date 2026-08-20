import { ApiClientError, requestJson } from './apiClient';

const HISTORY_FILTER_KEYS = [
  'fechaDesde', 'fechaHasta', 'genFundo', 'genCampo', 'genVariedad',
  'idCatalogoSdp', 'idMonitoreador', 'idEstadoFenologico', 'deteccion',
];
const HISTORY_PAGINATION_KEYS = ['pagina', 'pageSize'];

export function serializeChanchitosHistoryFilters(filters = {}, { includePagination = true } = {}) {
  const query = new URLSearchParams();
  const keys = includePagination
    ? [...HISTORY_FILTER_KEYS, ...HISTORY_PAGINATION_KEYS]
    : HISTORY_FILTER_KEYS;

  keys.forEach((key) => {
    if (filters[key] !== undefined && filters[key] !== null && filters[key] !== '') {
      query.set(key, filters[key]);
    }
  });

  return query.toString();
}

function getPdfFilename(contentDisposition) {
  const match = contentDisposition?.match(/filename="?([^";]+)"?/i);
  return match?.[1] || 'reporte-general-chanchitos.pdf';
}

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

export function obtenerHistorialChanchitos(filters = {}, signal, requestId) {
  const serialized = serializeChanchitosHistoryFilters(filters);
  return requestJson(`/app/api/chanchitos/historial${serialized ? `?${serialized}` : ''}`, {
    signal,
    headers: requestId ? { 'X-Request-Id': requestId } : undefined,
  });
}

export async function descargarPdfGeneralChanchitos(filters = {}) {
  const serialized = serializeChanchitosHistoryFilters(filters, { includePagination: false });
  const response = await fetch(`/chanchitos/pdf/general${serialized ? `?${serialized}` : ''}`, {
    credentials: 'include',
    headers: { Accept: 'application/pdf' },
  });
  const contentType = response.headers.get('content-type') || '';

  if (response.redirected && /\/login(?:[/?#]|$)/.test(response.url)) {
    throw new ApiClientError(401, { message: 'La sesión expiró. Redirigiendo al inicio de sesión.' });
  }
  if (!response.ok || !contentType.includes('application/pdf')) {
    throw new ApiClientError(response.status || 500, {
      message: response.status === 403
        ? 'No tiene permisos para generar este reporte.'
        : 'No fue posible generar el PDF general de Chanchitos.',
    });
  }

  const blob = await response.blob();
  if (blob.size === 0) {
    throw new ApiClientError(500, { message: 'No fue posible generar el PDF general de Chanchitos.' });
  }

  return {
    blob,
    filename: getPdfFilename(response.headers.get('content-disposition')),
  };
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
