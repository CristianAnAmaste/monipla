const DEFAULT_TIMEOUT_MS = 8000;

class MeteoFealClient {
  constructor(options = {}) {
    this.baseUrl = options.baseUrl || process.env.METEO_FEAL_BASE_URL || '';
    this.internalToken = options.internalToken || process.env.METEO_INTERNAL_TOKEN || '';
    this.timeoutMs = options.timeoutMs || Number(process.env.METEO_FEAL_TIMEOUT_MS) || DEFAULT_TIMEOUT_MS;
    this.debug = options.debug ?? (
      process.env.METEO_FEAL_DEBUG === 'true'
      || process.env.NODE_ENV === 'development'
    );
  }

  async obtenerAcumuladoAgroclimatico({ stationIdUuid, fechaMuestra }) {
    if (!this.baseUrl || !this.internalToken) {
      const error = new Error('METEO_FEAL_CONFIG_INCOMPLETA');
      error.code = 'METEO_FEAL_CONFIG_INCOMPLETA';
      throw error;
    }

    const url = new URL('/internal/meteo-agro-accumulated', this.baseUrl);
    url.searchParams.set('station_id_uuid', stationIdUuid);
    url.searchParams.set('fecha_muestra', fechaMuestra);

    this.logDebug('REQUEST', {
      url: url.toString(),
      station_id_uuid: stationIdUuid,
      fecha_muestra: fechaMuestra,
    });

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'x-internal-token': this.internalToken,
          accept: 'application/json',
        },
        signal: controller.signal,
      });

      const text = await response.text();
      const payload = text ? JSON.parse(text) : null;

      this.logDebug('RESPONSE', {
        status: response.status,
        payload,
      });

      if (!response.ok) {
        const error = new Error(`METEO_FEAL_HTTP_${response.status}`);
        error.code = 'METEO_FEAL_HTTP_ERROR';
        error.status = response.status;
        error.payload = payload;
        throw error;
      }

      return payload;
    } catch (error) {
      if (error.name === 'AbortError') {
        const timeoutError = new Error('METEO_FEAL_TIMEOUT');
        timeoutError.code = 'METEO_FEAL_TIMEOUT';
        throw timeoutError;
      }

      if (error instanceof SyntaxError) {
        const parseError = new Error('METEO_FEAL_JSON_INVALIDO');
        parseError.code = 'METEO_FEAL_JSON_INVALIDO';
        throw parseError;
      }

      throw error;
    } finally {
      clearTimeout(timeout);
    }
  }

  logDebug(evento, data) {
    if (!this.debug) {
      return;
    }

    console.info('[MONIPLA][METEO_FEAL]', {
      evento,
      ...data,
    });
  }
}

module.exports = MeteoFealClient;
