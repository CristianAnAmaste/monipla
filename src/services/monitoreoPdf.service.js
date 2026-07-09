const fs = require('fs');
const path = require('path');
const PDFDocument = require('pdfkit');
const sharp = require('sharp');

const FONT = {
  base: 12,
  table: 11,
  section: 13,
  title: 17,
  subtitle: 12,
  footer: 8,
};

const COLORS = {
  text: '#1f2a24',
  muted: '#66736b',
  line: '#cfe0d5',
  primary: '#1f6b4a',
  primaryDark: '#164d36',
  soft: '#edf6f0',
  header: '#f5faf7',
  white: '#ffffff',
};

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

class MonitoreoPdfService {
  constructor(options = {}) {
    this.logoPath = options.logoPath || this.buscarLogo();
  }

  async generarInforme(detalle, generatedAt = new Date()) {
    return this.crearBuffer(async (doc) => {
      await this.agregarEncabezado(doc, detalle, generatedAt);
      this.agregarDatosCabecera(doc, detalle);
      this.agregarResponsables(doc, detalle);
      this.agregarAgroclima(doc, detalle.agroclima);
      this.agregarResultado(doc, detalle);
      this.agregarTotales(doc, detalle);
      await this.agregarEvidencias(doc, detalle);
      this.agregarPiesPagina(doc);
    });
  }

  crearBuffer(build) {
    return new Promise((resolve, reject) => {
      const doc = new PDFDocument({
        size: 'LETTER',
        margins: {
          top: 40,
          right: 40,
          bottom: 44,
          left: 40,
        },
        bufferPages: true,
        info: {
          Title: 'Informe de Monitoreo de Plagas',
          Author: 'MONIPLA',
          Subject: 'Informe individual de monitoreo',
        },
      });
      const chunks = [];

      doc.on('data', (chunk) => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      Promise.resolve()
        .then(() => build(doc))
        .then(() => doc.end())
        .catch(reject);
    });
  }

  async agregarEncabezado(doc, detalle, generatedAt) {
    const x = doc.page.margins.left;
    const y = doc.y;
    const width = this.anchoUtil(doc);
    const logoWidth = 82;

    doc.save()
      .roundedRect(x, y, width, 76, 5)
      .fill(COLORS.header)
      .restore();

    const titleX = this.logoPath ? x + logoWidth + 18 : x + 14;

    if (this.logoPath) {
      try {
        const logoBuffer = await this.obtenerBufferImagen(this.logoPath);
        doc.image(logoBuffer, x + 12, y + 12, {
          fit: [logoWidth, 48],
          align: 'left',
          valign: 'center',
        });
      } catch (_) {
        // El informe no debe fallar por un logo ausente o corrupto.
      }
    }

    doc.font('Helvetica-Bold')
      .fontSize(FONT.title)
      .fillColor(COLORS.primaryDark)
      .text('Informe de Monitoreo de Plagas', titleX, y + 11, {
        width: x + width - titleX - 12,
        lineGap: 1,
      });

    doc.font('Helvetica-Bold')
      .fontSize(FONT.subtitle)
      .fillColor(COLORS.text)
      .text(`MONIPLA - Muestreo Nro ${this.valor(detalle.numeroMuestreo)}`, titleX, y + 34, {
        width: x + width - titleX - 12,
      });

    doc.font('Helvetica')
      .fontSize(10)
      .fillColor(COLORS.muted)
      .text(`Fecha de generacion: ${this.formatearFechaHora(generatedAt)}`, titleX, y + 51, {
        width: 235,
        continued: true,
      })
      .fillColor(COLORS.primaryDark)
      .font('Helvetica-Bold')
      .text(`  Estado resultado: ${this.valor(detalle.estadoResultado)}`, {
        width: x + width - titleX - 250,
      });

    doc.y = y + 86;
  }

  agregarDatosCabecera(doc, detalle) {
    const info = detalle.cabecera || {};

    this.agregarSeccion(doc, 'Datos del monitoreo');
    this.agregarKeyValuesEnColumnas(doc, [
      ['Número de muestreo', detalle.numeroMuestreo],
      ['Fecha de muestreo', info.fechaMonitoreo],
      ['Fecha solicitud de muestra', info.fechaSolicitudMuestra],
      ['Fecha recepción de muestra', info.fechaRecepcionMuestra],
      ['Fecha revisión', info.fechaRevisionMuestra],
    ]);

    this.agregarSeccion(doc, 'Origen agrícola');
    this.agregarKeyValuesEnColumnas(doc, [
      ['Fundo', info.fundo],
      ['Campo', info.campo],
      ['Variedad', info.variedad],
      ['Cuartel', info.cuartel],
      ['Estructura monitoreada', info.estructura],
      ['Estado fenológico', info.estadoFenologico],
      ['SPD / SDP', info.sdp],
      ['CSG', info.csg],
      ['Trazabilidad', info.trazabilidad],
    ]);

    if (this.tieneValor(info.observacionGeneral)) {
      this.agregarTexto(doc, `Observación general: ${this.valor(info.observacionGeneral)}`);
    }
  }

  agregarResponsables(doc, detalle) {
    const responsables = detalle.responsables || {};
    const registroIngresadoPor = this.tieneValor(responsables.usuarioResultado)
      && responsables.usuarioResultado !== 'Pendiente'
      ? responsables.usuarioResultado
      : responsables.usuarioCreacion;
    const personaEnvioMuestra = responsables.muestrador
      || responsables.personaEnvioMuestra
      || (detalle.cabecera || {}).muestreador;

    this.agregarSeccion(doc, 'Responsables');
    this.agregarKeyValuesEnColumnas(doc, [
      ['Persona que envió la muestra', this.tieneValor(personaEnvioMuestra) ? personaEnvioMuestra : 'No registrada'],
      ['Registro ingresado por', this.tieneValor(registroIngresadoPor) ? registroIngresadoPor : 'No registrado'],
    ]);
  }

  agregarAgroclima(doc, agroclima) {
    this.agregarSeccion(doc, 'Bloque agroclimático');

    if (!agroclima || !agroclima.tieneDatos) {
      this.agregarTexto(doc, 'No hay estación para el fundo.');
      return;
    }

    if (agroclima.mostrarSinEstacion) {
      this.agregarTexto(doc, 'No hay estación para el fundo.');
      return;
    }

    const rows = [];
    if (agroclima.estacion) rows.push(['Estación meteorológica', agroclima.estacion]);
    if (agroclima.horasFrio) rows.push(['Horas frío acumuladas', `${agroclima.horasFrio} horas`]);
    if (!agroclima.horasFrio && agroclima.diasGrado) rows.push(['Grados día acumulados', `${agroclima.diasGrado} GD`]);

    if (rows.length > 0) {
      this.agregarKeyValuesEnColumnas(doc, rows);
      return;
    }

    if (agroclima.observacion) {
      this.agregarTexto(doc, this.limitarTexto(agroclima.observacion, 120));
      return;
    }

    this.agregarTexto(doc, 'No hay estación para el fundo.');
  }

  agregarResultado(doc, detalle) {
    const info = detalle.cabecera || {};

    this.agregarSeccion(doc, 'Resultado de plagas');

    if (detalle.estadoResultado === 'SIN_PLAGAS') {
      this.agregarTexto(doc, 'No se detectaron plagas en la muestra revisada.', { bold: true });
      if (info.observacionResultado) {
        this.agregarTexto(doc, `Observacion resultado: ${info.observacionResultado}`);
      }
      return;
    }

    if (detalle.estadoResultado !== 'CON_PLAGAS' || !Array.isArray(detalle.plagas) || detalle.plagas.length === 0) {
      this.agregarTexto(doc, 'El monitoreo no tiene resultados de plagas registrados.');
      return;
    }

    detalle.plagas.forEach((plaga) => this.agregarPlaga(doc, plaga));
  }

  agregarPlaga(doc, plaga) {
    this.ensureSpace(doc, 74);

    const x = doc.page.margins.left;
    const width = this.anchoUtil(doc);
    const y = doc.y + 2;

    doc.save()
      .roundedRect(x, y, width, 30, 4)
      .fill(COLORS.soft)
      .restore();

    doc.font('Helvetica-Bold')
      .fontSize(FONT.subtitle)
      .fillColor(COLORS.primaryDark)
      .text(this.valor(plaga.nombrePlaga), x + 9, y + 8, {
        width: width - 125,
        continued: false,
      });

    doc.font('Helvetica-Bold')
      .fontSize(11)
      .fillColor(COLORS.primaryDark)
      .text(`Total: ${this.valor(plaga.cantidadTotal)}`, x + width - 104, y + 8, {
        width: 94,
        align: 'right',
      });

    doc.y = y + 36;

    this.agregarKeyValuesEnColumnas(doc, [
      ['Nombre cientifico', plaga.nombreCientifico],
      ['Clasificacion / tipo', plaga.tipoRegistro],
      ['Cuarentenaria', plaga.esCuarentenaria ? 'Si' : ''],
      ['Observacion', plaga.observacion],
    ]);

    this.agregarTabla(doc, ['Estadio', 'Estado', 'Cantidad'], (plaga.conteos || []).map((conteo) => [
      conteo.estadio,
      conteo.estado,
      conteo.cantidad,
    ]), [220, 190, 82]);
  }

  agregarTotales(doc, detalle) {
    const resumen = detalle.resumen || {};
    this.agregarSeccion(doc, 'Totales');
    this.agregarBadges(doc, [
      ['Plagas detectadas', resumen.totalPlagas],
      ['Conteos', resumen.totalConteos],
      ['Ejemplares', resumen.totalEjemplares],
    ]);

    if (Array.isArray(detalle.plagas) && detalle.plagas.length > 0) {
      this.agregarSubseccionTabla(doc, 'Totales por plaga');
      this.agregarTabla(doc, ['Plaga', 'Total'], detalle.plagas.map((plaga) => [
        plaga.nombrePlaga,
        plaga.cantidadTotal,
      ]));
    }

    if (Array.isArray(resumen.totalesPorEstado) && resumen.totalesPorEstado.length > 0) {
      this.agregarSubseccionTabla(doc, 'Totales por estado');
      this.agregarTabla(doc, ['Estado', 'Total'], resumen.totalesPorEstado.map((item) => [
        item.nombre,
        item.cantidad,
      ]));
    }

    if (Array.isArray(resumen.totalesPorEstadio) && resumen.totalesPorEstadio.length > 0) {
      this.agregarSubseccionTabla(doc, 'Totales por estadio');
      this.agregarTabla(doc, ['Estadio', 'Total'], resumen.totalesPorEstadio.map((item) => [
        item.nombre,
        item.cantidad,
      ]));
    }
  }

  async agregarEvidencias(doc, detalle) {
    const imagenes = Array.isArray(detalle.imagenes) ? detalle.imagenes : [];

    if (!imagenes.length) {
      if (this.hayEspacio(doc, 46)) {
        this.agregarSeccion(doc, 'Evidencias fotográficas');
        this.agregarTexto(doc, 'Sin evidencia fotográfica registrada.');
      }
      return;
    }

    doc.addPage();
    this.agregarSeccion(doc, 'Evidencias fotográficas');

    const gap = 10;
    const x = doc.page.margins.left;
    const width = this.anchoUtil(doc);
    const imageHeight = 175;
    const commentHeight = 34;
    const blockHeight = imageHeight + commentHeight + 8;

    let rowY = doc.y;
    for (let index = 0; index < imagenes.length; index += 1) {
      if (index > 0 && index % 3 === 0) {
        doc.addPage();
        this.agregarSeccion(doc, 'Evidencias fotográficas');
        rowY = doc.y;
      }

      const groupStart = index - (index % 3);
      const groupSize = Math.min(3, imagenes.length - groupStart);
      const cellWidth = (width - (gap * (groupSize - 1))) / groupSize;
      const usedWidth = (cellWidth * groupSize) + (gap * (groupSize - 1));
      const startX = x + ((width - usedWidth) / 2);
      const column = index % 3;
      const colX = startX + (column * (cellWidth + gap));

      await this.dibujarEvidencia(doc, imagenes[index], colX, rowY, cellWidth, imageHeight, commentHeight);

      if (column === groupSize - 1 || index === imagenes.length - 1) {
        doc.y = rowY + blockHeight;
      }
    }
  }

  async dibujarEvidencia(doc, imagen, x, y, width, imageHeight, commentHeight) {
    const previousY = doc.y;
    doc.save()
      .roundedRect(x, y, width, imageHeight, 4)
      .fill(COLORS.header)
      .strokeColor(COLORS.line)
      .stroke()
      .restore();

    try {
      const buffer = await this.obtenerBufferImagen(imagen.buffer || imagen.imagen);
      doc.image(buffer, x + 5, y + 5, {
        fit: [width - 10, imageHeight - 10],
        align: 'center',
        valign: 'center',
      });
    } catch (_) {
      doc.font('Helvetica')
        .fontSize(10)
        .fillColor(COLORS.muted)
        .text('Imagen no disponible', x + 8, y + 64, {
          width: width - 16,
          align: 'center',
        });
    }

    const comentario = this.limitarTexto(imagen.comentario || '', 90);
    doc.font('Helvetica')
      .fontSize(9)
      .fillColor(COLORS.text)
      .text(comentario || `Evidencia ${this.valor(imagen.orden) || ''}`.trim(), x, y + imageHeight + 5, {
        width,
        height: commentHeight,
        align: 'center',
        lineGap: 1,
      });
    doc.y = previousY;
  }

  agregarSeccion(doc, titulo) {
    this.ensureSpace(doc, 28);
    const x = doc.page.margins.left;
    const width = this.anchoUtil(doc);

    if (doc.y > doc.page.margins.top + 84) {
      doc.y += 4;
    }

    doc.strokeColor(COLORS.line).lineWidth(0.8)
      .moveTo(x, doc.y)
      .lineTo(x + width, doc.y)
      .stroke();

    doc.y += 4;
    doc.font('Helvetica-Bold')
      .fontSize(FONT.section)
      .fillColor(COLORS.primary)
      .text(titulo, x, doc.y, {
        width,
        align: 'center',
      });
    doc.y += 2;
  }

  agregarSubseccionTabla(doc, titulo) {
    this.ensureSpace(doc, 30);
    const x = doc.page.margins.left;
    const width = this.anchoUtil(doc);

    doc.y += 2;
    doc.font('Helvetica-Bold')
      .fontSize(11)
      .fillColor(COLORS.primaryDark)
      .text(titulo, x, doc.y, {
        width,
        align: 'center',
      });
    doc.y += 3;
  }

  agregarTexto(doc, text, options = {}) {
    const clean = this.valor(text);
    if (!clean) return;

    this.ensureSpace(doc, 22);
    doc.font(options.bold ? 'Helvetica-Bold' : 'Helvetica')
      .fontSize(options.size || FONT.base)
      .fillColor(options.color || COLORS.text)
      .text(clean, {
        width: this.anchoUtil(doc),
        lineGap: 2,
      });
  }

  agregarKeyValues(doc, rows) {
    rows
      .filter((row) => this.tieneValor(row[1]))
      .forEach(([label, value]) => {
        this.ensureSpace(doc, 18);
        doc.font('Helvetica-Bold')
          .fontSize(FONT.base)
          .fillColor(COLORS.text)
          .text(`${label}: `, {
            continued: true,
            lineGap: 2,
          });
        doc.font('Helvetica')
          .fontSize(FONT.base)
          .fillColor(COLORS.text)
          .text(this.valor(value), {
            width: this.anchoUtil(doc),
            lineGap: 2,
          });
      });
  }

  agregarKeyValuesEnColumnas(doc, rows) {
    const validRows = rows.filter((row) => this.tieneValor(row[1]));
    if (!validRows.length) return;

    const x = doc.page.margins.left;
    const width = this.anchoUtil(doc);
    const gap = 14;
    const colWidth = (width - gap) / 2;

    for (let index = 0; index < validRows.length; index += 2) {
      const pair = validRows.slice(index, index + 2);
      const heights = pair.map(([label, value]) => this.alturaKeyValue(doc, label, value, colWidth));
      const rowHeight = Math.max(...heights, 22);
      this.ensureSpace(doc, rowHeight + 2);
      const y = doc.y;

      pair.forEach(([label, value], pairIndex) => {
        const colX = x + (pairIndex * (colWidth + gap));
        doc.font('Helvetica-Bold')
          .fontSize(9)
          .fillColor(COLORS.muted)
          .text(`${label}:`, colX, y, {
            width: colWidth,
            lineGap: 0,
          });
        doc.font('Helvetica')
          .fontSize(11)
          .fillColor(COLORS.text)
          .text(this.valor(value), colX, y + 10, {
            width: colWidth,
            lineGap: 0,
          });
      });

      doc.y = y + rowHeight + 2;
    }
  }

  alturaKeyValue(doc, label, value, width) {
    const labelHeight = doc.font('Helvetica-Bold').fontSize(9).heightOfString(`${label}:`, {
      width,
      lineGap: 0,
    });
    const valueHeight = doc.font('Helvetica').fontSize(11).heightOfString(this.valor(value), {
      width,
      lineGap: 0,
    });

    return labelHeight + valueHeight;
  }

  agregarBadges(doc, items) {
    const validItems = items.filter((item) => this.tieneValor(item[1]));
    if (!validItems.length) return;

    const gap = 8;
    const width = (this.anchoUtil(doc) - (gap * (validItems.length - 1))) / validItems.length;
    const x = doc.page.margins.left;
    const height = 36;

    this.ensureSpace(doc, height + 8);
    const y = doc.y;
    validItems.forEach(([label, value], index) => {
      const itemX = x + (index * (width + gap));
      doc.save()
        .roundedRect(itemX, y, width, height, 4)
        .fill(COLORS.soft)
        .strokeColor(COLORS.line)
        .stroke()
        .restore();
      doc.font('Helvetica-Bold')
        .fontSize(14)
        .fillColor(COLORS.primaryDark)
        .text(this.valor(value), itemX + 8, y + 5, {
          width: width - 16,
          align: 'center',
        });
      doc.font('Helvetica')
        .fontSize(8.5)
        .fillColor(COLORS.muted)
        .text(label, itemX + 8, y + 22, {
          width: width - 16,
          align: 'center',
        });
    });

    doc.y = y + height + 6;
  }

  agregarTabla(doc, headers, rows, widths = null) {
    const tableRows = rows.length > 0 ? rows : [['Sin registros', '', '']];
    const x = doc.page.margins.left;
    const rowPadding = 5;
    const tableWidths = this.normalizarAnchosTabla(doc, headers, widths);

    this.ensureSpace(doc, 34);
    this.dibujarFilaTabla(doc, x, headers, tableWidths, rowPadding, true);

    tableRows.forEach((row) => {
      this.dibujarFilaTabla(doc, x, row, tableWidths, rowPadding, false);
    });

    doc.y += 2;
  }

  dibujarFilaTabla(doc, x, row, widths, padding, isHeader) {
    const font = isHeader ? 'Helvetica-Bold' : 'Helvetica';
    const fill = isHeader ? COLORS.soft : COLORS.white;
    const values = row.map((cell) => this.valor(cell));

    doc.font(font).fontSize(FONT.table);

    const heights = values.map((value, index) => doc.heightOfString(value, {
      width: widths[index] - (padding * 2),
      lineGap: 1,
    }));
    const rowHeight = Math.max(isHeader ? 23 : 22, Math.max(...heights) + (padding * 2));

    this.ensureSpace(doc, rowHeight + 4);

    let cellX = x;
    const y = doc.y;
    doc.save()
      .fillColor(fill)
      .rect(x, y, widths.reduce((total, width) => total + width, 0), rowHeight)
      .fill()
      .restore();

    values.forEach((value, index) => {
      doc.strokeColor(COLORS.line)
        .lineWidth(0.6)
        .rect(cellX, y, widths[index], rowHeight)
        .stroke();
      doc.font(font)
        .fontSize(FONT.table)
        .fillColor(COLORS.text)
        .text(value, cellX + padding, y + padding, {
          width: widths[index] - (padding * 2),
          lineGap: 1,
        });
      cellX += widths[index];
    });

    doc.y = y + rowHeight;
  }

  agregarPiesPagina(doc) {
    const range = doc.bufferedPageRange();

    for (let i = range.start; i < range.start + range.count; i += 1) {
      doc.switchToPage(i);
      const pageNumber = i + 1;
      const totalPages = range.count;
      const y = doc.page.height - doc.page.margins.bottom - 16;
      const x = doc.page.margins.left;
      const width = this.anchoUtil(doc);
      const previousY = doc.y;

      doc.font('Helvetica')
        .fontSize(FONT.footer)
        .fillColor(COLORS.muted)
        .text('Documento generado automaticamente por MONIPLA.', x, y, {
          width: width - 120,
          lineBreak: false,
        })
        .text(`Pagina ${pageNumber} de ${totalPages}`, x + width - 110, y, {
          width: 100,
          align: 'right',
          lineBreak: false,
        });
      doc.y = previousY;
    }
  }

  ensureSpace(doc, height) {
    const bottom = doc.page.height - doc.page.margins.bottom - 10;

    if (doc.y + height > bottom) {
      doc.addPage();
    }
  }

  hayEspacio(doc, height) {
    const bottom = doc.page.height - doc.page.margins.bottom - 10;
    return doc.y + height <= bottom;
  }

  anchoUtil(doc) {
    return doc.page.width - doc.page.margins.left - doc.page.margins.right;
  }

  normalizarAnchosTabla(doc, headers, widths) {
    const width = this.anchoUtil(doc);

    if (headers.length === 2) {
      return [width * 0.75, width * 0.25];
    }

    if (!Array.isArray(widths) || widths.length !== headers.length) {
      return Array.from({ length: headers.length }, () => width / headers.length);
    }

    const total = widths.reduce((sum, item) => sum + item, 0);
    if (total <= width) {
      return widths;
    }

    return widths.map((item) => (item / total) * width);
  }

  buscarLogo() {
    const base = path.resolve(__dirname, '..', '..');
    const dirs = [
      path.join(base, 'public'),
      path.join(base, 'src', 'public'),
      path.join(base, 'public', 'assets'),
      path.join(base, 'src', 'public', 'assets'),
    ];
    const exts = ['.png', '.jpg', '.jpeg', '.webp'];

    for (const dir of dirs) {
      for (const ext of exts) {
        const file = path.join(dir, `logoatacama2026${ext}`);
        if (fs.existsSync(file)) {
          return file;
        }
      }
    }

    return null;
  }

  async obtenerBufferImagen(input) {
    if (!input) {
      throw new Error('IMAGEN_NO_DISPONIBLE');
    }

    const buffer = Buffer.isBuffer(input) ? input : fs.readFileSync(input);
    const metadata = await sharp(buffer).metadata();

    if (metadata.format === 'webp') {
      return sharp(buffer).jpeg({ quality: 82 }).toBuffer();
    }

    return buffer;
  }

  tieneValor(value) {
    const clean = this.valor(value);
    return clean !== '' && clean !== '-';
  }

  valor(value) {
    if (value === null || value === undefined) {
      return '';
    }

    const clean = String(value).replace(/\s+/g, ' ').trim();
    if (!clean || clean === '-' || /^null$/i.test(clean) || UUID_RE.test(clean)) {
      return '';
    }

    return clean;
  }

  limitarTexto(value, maxLength) {
    const clean = this.valor(value);
    if (clean.length <= maxLength) {
      return clean;
    }

    return `${clean.slice(0, maxLength - 1).trim()}...`;
  }

  formatearFechaHora(value) {
    return new Intl.DateTimeFormat('es-CL', {
      dateStyle: 'short',
      timeStyle: 'medium',
      timeZone: 'America/Santiago',
    }).format(value);
  }
}

module.exports = MonitoreoPdfService;
