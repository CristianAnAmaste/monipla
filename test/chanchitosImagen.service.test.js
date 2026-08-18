const test = require('node:test');
const assert = require('node:assert/strict');
const sharp = require('sharp');
const ChanchitosImagenService = require('../src/services/chanchitosImagen.service');

async function crearImagen({ width = 100, height = 80, withMetadata = false } = {}) {
  let imagen = sharp({
    create: {
      width,
      height,
      channels: 3,
      background: { r: 25, g: 100, b: 40 },
    },
  });

  if (withMetadata) {
    imagen = imagen.withMetadata({ exif: { IFD0: { Make: 'Telefono de prueba' } } });
  }

  return imagen.png().toBuffer();
}

function archivo(buffer, overrides = {}) {
  return {
    buffer,
    mimetype: 'image/png',
    size: buffer.length,
    ...overrides,
  };
}

test('permite cero, una, dos y tres imagenes, siempre como JPEG optimizado', async () => {
  const servicio = new ChanchitosImagenService();
  const imagen = await crearImagen();

  assert.deepEqual(await servicio.procesarImagenes([]), []);

  for (const cantidad of [1, 2, 3]) {
    const resultado = await servicio.procesarImagenes(
      Array.from({ length: cantidad }, () => archivo(imagen))
    );
    assert.equal(resultado.length, cantidad);
    for (const buffer of resultado) {
      const metadata = await sharp(buffer).metadata();
      assert.equal(metadata.format, 'jpeg');
    }
  }
});

test('rechaza cuarta imagen, archivo invalido y archivo mayor a 10 MB', async () => {
  const servicio = new ChanchitosImagenService();
  const imagen = await crearImagen();

  await assert.rejects(servicio.procesarImagenes([archivo(imagen), archivo(imagen), archivo(imagen), archivo(imagen)]), /MAX_IMAGENES_EXCEDIDO/);
  await assert.rejects(servicio.procesarImagenes([archivo(Buffer.from('%PDF-prueba'), { mimetype: 'image/jpeg' })]), /IMAGEN_CORRUPTA/);
  await assert.rejects(servicio.procesarImagenes([archivo(imagen, { mimetype: 'image/jpeg' })]), /MIME_IMAGEN_INCONSISTENTE/);
  await assert.rejects(servicio.procesarImagenes([archivo(Buffer.alloc((10 * 1024 * 1024) + 1))]), /IMAGEN_ENTRADA_PESADA/);
});

test('reduce dimensiones, no amplia imagenes pequenas y elimina metadatos', async () => {
  const servicio = new ChanchitosImagenService();
  const grande = await crearImagen({ width: 3000, height: 2200 });
  const pequenaConExif = await crearImagen({ width: 100, height: 80, withMetadata: true });

  const [grandeProcesada, pequenaProcesada] = await servicio.procesarImagenes([
    archivo(grande),
    archivo(pequenaConExif),
  ]);
  const metadataGrande = await sharp(grandeProcesada).metadata();
  const metadataPequena = await sharp(pequenaProcesada).metadata();

  assert.ok(metadataGrande.width <= 1920);
  assert.ok(metadataGrande.height <= 1920);
  assert.equal(metadataPequena.width, 100);
  assert.equal(metadataPequena.height, 80);
  assert.equal(metadataPequena.exif, undefined);
  assert.equal(metadataPequena.xmp, undefined);
});

test('ejecuta el segundo intento cuando el primer JPEG supera 2 MB', async () => {
  const servicio = new ChanchitosImagenService();
  const imagen = await crearImagen();
  const llamadas = [];
  servicio.procesar = async (buffer, lado, calidad) => {
    llamadas.push([lado, calidad]);
    return lado === 1920 ? Buffer.alloc((2 * 1024 * 1024) + 1) : Buffer.from([0xff, 0xd8, 0xff]);
  };

  const [resultado] = await servicio.procesarImagenes([archivo(imagen)]);

  assert.deepEqual(llamadas, [[1920, 82], [1600, 75]]);
  assert.equal(resultado.length, 3);
});

test('rechaza la imagen si el segundo intento todavia supera 2 MB', async () => {
  const servicio = new ChanchitosImagenService();
  const imagen = await crearImagen();
  servicio.procesar = async () => Buffer.alloc((2 * 1024 * 1024) + 1);

  await assert.rejects(servicio.procesarImagenes([archivo(imagen)]), /IMAGEN_SALIDA_PESADA/);
});
