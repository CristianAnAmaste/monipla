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

  try {
    response = await fetch(url, {
      ...options,
      credentials: 'include',
      headers: {
        Accept: 'application/json',
        ...options.headers,
      },
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
