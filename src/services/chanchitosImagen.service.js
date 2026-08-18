const sharp = require('sharp');

const MAX_IMAGENES = 3;
const MAX_BYTES_ENTRADA = 10 * 1024 * 1024;
const MAX_BYTES_SALIDA = 2 * 1024 * 1024;
const MIMES_PERMITIDOS = new Set(['image/jpeg', 'image/png', 'image/webp']);
const FORMATOS_PERMITIDOS = new Set(['jpeg', 'png', 'webp']);
const MIME_POR_FORMATO = Object.freeze({ jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp' });

class ChanchitosImagenService {
  async procesarImagenes(files = [], uploadError = null) {
    this.validarErrorCarga(uploadError);
    const archivos = Array.isArray(files) ? files : [];

    if (archivos.length > MAX_IMAGENES) {
      throw this.crearError('MAX_IMAGENES_EXCEDIDO', 'Puede adjuntar hasta 3 imagenes de evidencia.');
    }

    const imagenes = [];
    for (let index = 0; index < archivos.length; index += 1) {
      imagenes.push(await this.optimizarImagen(archivos[index], index + 1));
    }

    return imagenes;
  }

  validarErrorCarga(error) {
    if (!error) return;

    const mensajes = {
      LIMIT_FILE_COUNT: 'Puede adjuntar hasta 3 imagenes de evidencia.',
      LIMIT_FILE_SIZE: 'Cada imagen puede pesar como maximo 10 MB.',
      LIMIT_UNEXPECTED_FILE: 'Solo se permite el campo de imagenes del formulario.',
    };
    throw this.crearError(
      error.code || 'ERROR_CARGA_IMAGEN',
      mensajes[error.code] || error.userMessage || 'No fue posible recibir las imagenes adjuntas.'
    );
  }

  async optimizarImagen(file, orden) {
    if (!file || !Buffer.isBuffer(file.buffer) || file.buffer.length === 0) {
      throw this.crearError('IMAGEN_VACIA', `Imagen ${orden}: el archivo esta vacio o no pudo leerse.`);
    }
    if (!MIMES_PERMITIDOS.has(file.mimetype)) {
      throw this.crearError('MIME_IMAGEN_INVALIDO', `Imagen ${orden}: solo se permiten archivos JPEG, PNG o WebP.`);
    }
    if (file.buffer.length > MAX_BYTES_ENTRADA) {
      throw this.crearError('IMAGEN_ENTRADA_PESADA', `Imagen ${orden}: supera el maximo de 10 MB permitido.`);
    }

    try {
      const metadata = await sharp(file.buffer, { failOn: 'warning' }).metadata();
      if (!FORMATOS_PERMITIDOS.has(metadata.format)) {
        throw this.crearError('FORMATO_IMAGEN_INVALIDO', `Imagen ${orden}: solo se permiten archivos JPEG, PNG o WebP validos.`);
      }
      if (MIME_POR_FORMATO[metadata.format] !== file.mimetype) {
        throw this.crearError('MIME_IMAGEN_INCONSISTENTE', `Imagen ${orden}: el tipo declarado no coincide con el archivo.`);
      }

      const primerIntento = await this.procesar(file.buffer, 1920, 82);
      const buffer = primerIntento.length > MAX_BYTES_SALIDA
        ? await this.procesar(file.buffer, 1600, 75)
        : primerIntento;

      if (buffer.length > MAX_BYTES_SALIDA) {
        throw this.crearError('IMAGEN_SALIDA_PESADA', `Imagen ${orden}: no puede reducirse por debajo de 2 MB.`);
      }

      return buffer;
    } catch (error) {
      if (error.userMessage) throw error;
      throw this.crearError('IMAGEN_CORRUPTA', `Imagen ${orden}: no fue posible procesar el archivo seleccionado.`);
    }
  }

  procesar(buffer, ladoMaximo, calidad) {
    return sharp(buffer, { failOn: 'warning' })
      .rotate()
      .resize({
        width: ladoMaximo,
        height: ladoMaximo,
        fit: 'inside',
        withoutEnlargement: true,
      })
      .jpeg({ quality: calidad })
      .toBuffer();
  }

  crearError(code, userMessage) {
    const error = new Error(code);
    error.userMessage = userMessage;
    return error;
  }
}

module.exports = ChanchitosImagenService;
