export class ApiClientError extends Error {
  constructor(status, payload = null) {
    super(payload?.message || 'No fue posible completar la solicitud.');
    this.name = 'ApiClientError';
    this.status = status;
    this.payload = payload;
  }
}

export async function requestJson(url, options = {}) {
  let response;
  const isFormData = typeof FormData !== 'undefined' && options.body instanceof FormData;
  const shouldSerializeJson = options.body
    && typeof options.body === 'object'
    && !isFormData
    && !(options.body instanceof Blob);
  const headers = {
    Accept: 'application/json',
    ...options.headers,
  };

  if (shouldSerializeJson && !headers['Content-Type']) {
    headers['Content-Type'] = 'application/json';
  }

  try {
    response = await fetch(url, {
      ...options,
      credentials: 'include',
      body: shouldSerializeJson ? JSON.stringify(options.body) : options.body,
      headers,
    });
  } catch (error) {
    if (error.name === 'AbortError') {
      throw error;
    }

    throw new ApiClientError(0, { message: 'No fue posible comunicarse con el servidor.' });
  }

  const isJson = response.headers.get('content-type')?.includes('application/json');
  const payload = isJson ? await response.json() : null;

  if (!response.ok) {
    throw new ApiClientError(response.status, payload);
  }

  return payload;
}
