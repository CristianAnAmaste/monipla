const fs = require('fs');
const path = require('path');
const PDFDocument = require('pdfkit');
const ChanchitosRepository = require('../repositories/chanchitos.repository');
const ChanchitosService = require('./chanchitos.service');

const ESTADOS = new Map([
  [1, 'Ovisaco'],
  [2, 'Ninfa'],
  [3, 'Adulto'],
]);
const POSICIONES = new Map([
  [1, 'Base corteza'],
  [2, 'Base brote'],
  [3, 'Hoja'],
  [4, 'Racimo'],
]);
const COLORS = {
  primary: '#164d36',
  soft: '#edf6f0',
  line: '#cfe0d5',
  text: '#1f2a24',
  muted: '#66736b',
  white: '#ffffff',
};

class ChanchitosPdfService {
  constructor(chanchitosRepository = null, options = {}) {
    this.chanchitosRepository = chanchitosRepository || new ChanchitosRepository();
    this.logoPath = options.logoPath || this.buscarLogo();
  }

  async generarReporteGeneral(query = {}) {
    const filtros = this.normalizarFiltros(query);
    const errors = this.validarFiltros(filtros);

    if (errors.length > 0) {
      const error = new Error('FILTROS_REPORTE_INVALIDOS');
      error.validationErrors = errors;
      throw error;
    }

    const filas = await this.chanchitosRepository.obtenerMonitoreosPdfGeneral(filtros);
    const monitoreos = this.agruparMonitoreos(filas);
    const generatedAt = new Date();

    return {
      filename: `monipla-chanchitos-reporte-general-${this.fechaArchivo(generatedAt)}.pdf`,
      buffer: await this.generarPdf({ filtros, monitoreos }, generatedAt),
      totalMonitoreos: monitoreos.length,
      filtros,
    };
  }

  normalizarFiltros(query = {}) {
    return {
      fechaDesde: this.normalizarFecha(query.fechaDesde),
      fechaHasta: this.normalizarFecha(query.fechaHasta),
    };
  }

  validarFiltros(filtros) {
    const errors = [];

    if (filtros.fechaDesde && !this.esFechaValida(filtros.fechaDesde)) {
      errors.push('fechaDesde no es valida.');
    }

    if (filtros.fechaHasta && !this.esFechaValida(filtros.fechaHasta)) {
      errors.push('fechaHasta no es valida.');
    }

    if (
      this.esFechaValida(filtros.fechaDesde)
      && this.esFechaValida(filtros.fechaHasta)
      && filtros.fechaDesde > filtros.fechaHasta
    ) {
      errors.push('fechaDesde no puede ser posterior a fechaHasta.');
    }

    return errors;
  }

  agruparMonitoreos(filas = []) {
    const monitoreos = new Map();
    const matrizCanonica = ChanchitosService.MATRIZ_CANONICA || [];
    const combinacionesValidas = new Set(matrizCanonica.map((item) => this.claveDetalle(item)));

    for (const fila of Array.isArray(filas) ? filas : []) {
      const idMonitoreo = Number(fila.id_monitoreo);

      if (!Number.isSafeInteger(idMonitoreo) || idMonitoreo <= 0) {
        continue;
      }

      if (!monitoreos.has(idMonitoreo)) {
        monitoreos.set(idMonitoreo, {
          idMonitoreo,
          fechaMonitoreo: fila.fecha_monitoreo,
          fundo: fila.nombre_fundo,
          campo: fila.nombre_campo,
          variedad: fila.nombre_variedad,
          cuartel: fila.codigo_cuartel,
          sdp: fila.sdp,
          csg: fila.csg,
          trazabilidad: fila.trazabilidad,
          estadoFenologico: fila.nombre_estado_fenologico,
          cantPlantas: fila.cant_plantas,
          monitoreador: fila.nombre_monitoreador,
          observaciones: this.normalizarObservaciones(fila.observaciones),
          detallePorClave: new Map(),
          detallesDuplicados: 0,
          detallesFueraRango: 0,
          totalIndividuos: 0,
        });
      }

      const monitoreo = monitoreos.get(idMonitoreo);
      const idEstadoMonitoreo = this.normalizarIdDetalle(fila.id_estadomonitoreo);
      const idEstadoPosicion = this.normalizarIdDetalle(fila.id_estadoposicion);

      if (!idEstadoMonitoreo && !idEstadoPosicion) {
        continue;
      }

      const clave = this.claveDetalle({ idEstadoMonitoreo, idEstadoPosicion });
      const cantidad = this.normalizarCantidadDetalle(fila.cantidad_bichos);

      if (!combinacionesValidas.has(clave) || cantidad === null) {
        monitoreo.detallesFueraRango += 1;
        continue;
      }

      monitoreo.totalIndividuos += cantidad;

      if (monitoreo.detallePorClave.has(clave)) {
        monitoreo.detallesDuplicados += 1;
        continue;
      }

      monitoreo.detallePorClave.set(clave, cantidad);
    }

    return [...monitoreos.values()].map((monitoreo) => {
      const matriz = [...ESTADOS.entries()].map(([idEstadoMonitoreo, estado]) => ({
        estado,
        celdas: [...POSICIONES.entries()].map(([idEstadoPosicion, posicion]) => {
          const clave = this.claveDetalle({ idEstadoMonitoreo, idEstadoPosicion });
          return {
            posicion,
            cantidad: monitoreo.detallePorClave.has(clave)
              ? monitoreo.detallePorClave.get(clave)
              : null,
          };
        }),
      }));
      const detallesValidos = monitoreo.detallePorClave.size;
      const advertencias = [];

      if (detallesValidos !== matrizCanonica.length) {
        advertencias.push(`Detalle incompleto: ${detallesValidos} de ${matrizCanonica.length}`);
      }

      if (monitoreo.detallesDuplicados > 0) {
        advertencias.push(`Detalle duplicado: ${monitoreo.detallesDuplicados}`);
      }

      if (monitoreo.detallesFueraRango > 0) {
        advertencias.push(`Detalle fuera de rango: ${monitoreo.detallesFueraRango}`);
      }

      return {
        ...monitoreo,
        matriz,
        detallesValidos,
        advertencias,
      };
    });
  }

  async generarPdf(reporte, generatedAt) {
    return new Promise((resolve, reject) => {
      const doc = new PDFDocument({
        size: 'LETTER',
        layout: 'landscape',
        margins: { top: 36, right: 36, bottom: 42, left: 36 },
        bufferPages: true,
        info: {
          Title: 'Reporte general - Monitoreo de Chanchitos Blancos',
          Author: 'MONIPLA',
          Subject: 'Pseudococcus sp.',
        },
      });
      const chunks = [];

      doc.on('data', (chunk) => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      try {
        this.dibujarEncabezado(doc, reporte, generatedAt, false);

        if (!reporte.monitoreos.length) {
          doc.font('Helvetica').fontSize(11).fillColor(COLORS.text)
            .text('No se encontraron monitoreos para los filtros aplicados.');
        } else {
          reporte.monitoreos.forEach((monitoreo) => {
            const altura = this.calcularAlturaBloque(doc, monitoreo);

            if (!this.hayEspacio(doc, altura)) {
              this.nuevaPagina(doc, reporte, generatedAt);
            }

            this.dibujarBloqueMonitoreo(doc, monitoreo);
          });
        }

        this.agregarPiesPagina(doc);
        doc.end();
      } catch (error) {
        reject(error);
      }
    });
  }

  dibujarEncabezado(doc, reporte, generatedAt, compacto) {
    const x = doc.page.margins.left;
    const y = doc.y;
    const width = this.anchoUtil(doc);
    const logoWidth = 70;
    const altura = compacto ? 48 : 82;

    doc.save().roundedRect(x, y, width, altura, 4).fill(COLORS.soft).restore();

    if (this.logoPath) {
      try {
        doc.image(this.logoPath, x + 10, y + 8, { fit: [logoWidth, compacto ? 30 : 42] });
      } catch (_) {
        // El reporte continua aunque el logo no pueda leerse.
      }
    }

    const titleX = this.logoPath ? x + logoWidth + 18 : x + 12;
    doc.font('Helvetica-Bold').fontSize(compacto ? 11 : 15).fillColor(COLORS.primary)
      .text('Reporte general - Monitoreo de Chanchitos Blancos', titleX, y + 9, {
        width: x + width - titleX - 12,
      });
    doc.font('Helvetica').fontSize(compacto ? 8.5 : 10).fillColor(COLORS.text)
      .text(`Pseudococcus sp. - Generado: ${this.formatearFechaHora(generatedAt)}`, titleX, y + (compacto ? 25 : 31), {
        width: x + width - titleX - 12,
      });

    if (!compacto) {
      doc.font('Helvetica').fontSize(8.5).fillColor(COLORS.muted)
        .text(`Filtros: ${this.resumenFiltros(reporte.filtros)} - Monitoreos incluidos: ${reporte.monitoreos.length}`, titleX, y + 49, {
          width: x + width - titleX - 12,
        });
    }

    doc.y = y + altura + 10;
  }

  nuevaPagina(doc, reporte, generatedAt) {
    doc.addPage();
    this.dibujarEncabezado(doc, reporte, generatedAt, true);
  }

  calcularAlturaBloque(doc, monitoreo) {
    const width = this.anchoUtil(doc);
    const columna = (width - 12) / 2;
    const pares = this.filasDatos(monitoreo);
    const alturaDatos = pares.reduce((total, fila) => (
      total + Math.max(
        this.alturaDato(doc, fila[0], columna),
        this.alturaDato(doc, fila[1], columna),
        25
      )
    ), 0);
    const observacion = this.normalizarObservaciones(monitoreo.observaciones);
    const alturaObservacion = doc.font('Helvetica').fontSize(8.5)
      .heightOfString(observacion, { width, lineGap: 1 });
    const alturaAdvertencias = monitoreo.advertencias.length * 12;

    return 28 + alturaDatos + 20 + alturaObservacion + 12 + 22 + (3 * 20) + alturaAdvertencias + 16;
  }

  dibujarBloqueMonitoreo(doc, monitoreo) {
    const x = doc.page.margins.left;
    const width = this.anchoUtil(doc);
    const y = doc.y;

    doc.save().roundedRect(x, y, width, 22, 3).fill(COLORS.soft).restore();
    doc.font('Helvetica-Bold').fontSize(10).fillColor(COLORS.primary)
      .text(`Monitoreo #${monitoreo.idMonitoreo} - Fecha: ${this.formatearFecha(monitoreo.fechaMonitoreo)}`, x + 8, y + 6, {
        width: width - 16,
      });
    doc.y = y + 28;

    this.dibujarDatos(doc, monitoreo);

    const observacion = this.normalizarObservaciones(monitoreo.observaciones);
    doc.font('Helvetica-Bold').fontSize(7.5).fillColor(COLORS.muted)
      .text('Observaciones:', x, doc.y, { width });
    doc.font('Helvetica').fontSize(8.5).fillColor(COLORS.text)
      .text(observacion, x, doc.y + 2, { width, lineGap: 1 });
    doc.y += 6;

    this.dibujarMatriz(doc, monitoreo.matriz);

    if (monitoreo.advertencias.length > 0) {
      doc.font('Helvetica').fontSize(8).fillColor('#85503f')
        .text(monitoreo.advertencias.join(' - '), x, doc.y + 3, { width });
      doc.y += 13;
    }

    doc.y += 9;
  }

  dibujarDatos(doc, monitoreo) {
    const x = doc.page.margins.left;
    const width = this.anchoUtil(doc);
    const gap = 12;
    const columna = (width - gap) / 2;
    let y = doc.y;

    this.filasDatos(monitoreo).forEach((fila) => {
      const altura = Math.max(
        this.alturaDato(doc, fila[0], columna),
        this.alturaDato(doc, fila[1], columna),
        25
      );
      this.dibujarDato(doc, fila[0], x, y, columna);
      this.dibujarDato(doc, fila[1], x + columna + gap, y, columna);
      y += altura;
    });

    doc.y = y;
  }

  filasDatos(monitoreo) {
    return [
      [['Fundo', monitoreo.fundo], ['Campo / Productor', monitoreo.campo]],
      [['Variedad', monitoreo.variedad], ['Cuartel', monitoreo.cuartel]],
      [['SDP', monitoreo.sdp], ['CSG', monitoreo.csg]],
      [['Trazabilidad', monitoreo.trazabilidad], ['Estado fenologico', monitoreo.estadoFenologico]],
      [['Plantas revisadas', monitoreo.cantPlantas], ['Monitoreador', monitoreo.monitoreador]],
      [['Total de individuos', monitoreo.totalIndividuos], ['', '']],
    ];
  }

  alturaDato(doc, [, value], width) {
    const texto = this.valor(value, '-');
    return 10 + doc.font('Helvetica').fontSize(8.5).heightOfString(texto, { width, lineGap: 0 });
  }

  dibujarDato(doc, [label, value], x, y, width) {
    if (!label) return;

    doc.font('Helvetica-Bold').fontSize(7).fillColor(COLORS.muted)
      .text(`${label}:`, x, y, { width, lineBreak: false });
    doc.font('Helvetica').fontSize(8.5).fillColor(COLORS.text)
      .text(this.valor(value, '-'), x, y + 9, { width, lineGap: 0 });
  }

  dibujarMatriz(doc, matriz) {
    const x = doc.page.margins.left;
    const width = this.anchoUtil(doc);
    const anchoEstado = 108;
    const anchoCelda = (width - anchoEstado) / 4;
    const headers = ['Estado', ...POSICIONES.values()];

    this.dibujarFilaMatriz(doc, x, headers, [anchoEstado, anchoCelda, anchoCelda, anchoCelda, anchoCelda], true);
    matriz.forEach((fila) => {
      this.dibujarFilaMatriz(doc, x, [
        fila.estado,
        ...fila.celdas.map((celda) => celda.cantidad === null ? '—' : String(celda.cantidad)),
      ], [anchoEstado, anchoCelda, anchoCelda, anchoCelda, anchoCelda], false);
    });
  }

  dibujarFilaMatriz(doc, x, values, widths, encabezado) {
    const y = doc.y;
    const alto = encabezado ? 22 : 20;
    let cellX = x;

    values.forEach((value, index) => {
      doc.save().fillColor(encabezado ? COLORS.soft : COLORS.white)
        .rect(cellX, y, widths[index], alto).fill()
        .strokeColor(COLORS.line).lineWidth(0.55).rect(cellX, y, widths[index], alto).stroke().restore();
      doc.font(encabezado ? 'Helvetica-Bold' : 'Helvetica').fontSize(8).fillColor(COLORS.text)
        .text(String(value), cellX + 4, y + 6, {
          width: widths[index] - 8,
          align: index === 0 ? 'left' : 'right',
          lineBreak: false,
        });
      cellX += widths[index];
    });

    doc.y = y + alto;
  }

  agregarPiesPagina(doc) {
    const range = doc.bufferedPageRange();

    for (let index = range.start; index < range.start + range.count; index += 1) {
      doc.switchToPage(index);
      const x = doc.page.margins.left;
      const y = doc.page.height - doc.page.margins.bottom - 15;
      doc.font('Helvetica').fontSize(8).fillColor(COLORS.muted)
        .text('MONIPLA - Monitoreo de Chanchitos Blancos', x, y, { width: 260, lineBreak: false })
        .text(`Pagina ${index + 1} de ${range.count}`, doc.page.width - doc.page.margins.right - 105, y, {
          width: 105,
          align: 'right',
          lineBreak: false,
        });
    }
  }

  claveDetalle({ idEstadoMonitoreo, idEstadoPosicion }) {
    return `${idEstadoMonitoreo}:${idEstadoPosicion}`;
  }

  normalizarIdDetalle(value) {
    const parsed = Number(value);
    return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : null;
  }

  normalizarCantidadDetalle(value) {
    const parsed = Number(value);
    return Number.isSafeInteger(parsed) && parsed >= 0 ? parsed : null;
  }

  normalizarObservaciones(value) {
    const observacion = String(value ?? '').trim();
    return observacion ? observacion : 'Sin observaciones';
  }

  normalizarFecha(value) {
    const fecha = String(value ?? '').trim();
    return fecha || null;
  }

  esFechaValida(value) {
    if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;

    const [year, month, day] = value.split('-').map(Number);
    const fecha = new Date(Date.UTC(year, month - 1, day));
    return fecha.getUTCFullYear() === year
      && fecha.getUTCMonth() === month - 1
      && fecha.getUTCDate() === day;
  }

  resumenFiltros(filtros) {
    if (!filtros.fechaDesde && !filtros.fechaHasta) return 'Sin filtros de fecha';
    return `Desde: ${filtros.fechaDesde || 'inicio'} | Hasta: ${filtros.fechaHasta || 'hoy'}`;
  }

  fechaArchivo(fecha) {
    return fecha.toISOString().slice(0, 10).replace(/-/g, '');
  }

  formatearFecha(value) {
    if (!value) return '-';
    const fecha = value instanceof Date ? value : new Date(`${String(value).slice(0, 10)}T00:00:00Z`);
    return Number.isNaN(fecha.getTime()) ? this.valor(value, '-') : new Intl.DateTimeFormat('es-CL', {
      timeZone: 'UTC',
      dateStyle: 'short',
    }).format(fecha);
  }

  formatearFechaHora(value) {
    return new Intl.DateTimeFormat('es-CL', {
      dateStyle: 'short',
      timeStyle: 'short',
      timeZone: 'America/Santiago',
    }).format(value);
  }

  valor(value, fallback = '') {
    const texto = String(value ?? '').replace(/\s+/g, ' ').trim();
    return texto || fallback;
  }

  hayEspacio(doc, altura) {
    return doc.y + altura <= doc.page.height - doc.page.margins.bottom - 18;
  }

  anchoUtil(doc) {
    return doc.page.width - doc.page.margins.left - doc.page.margins.right;
  }

  buscarLogo() {
    const base = path.resolve(__dirname, '..');
    const logoPath = path.join(base, 'public', 'assets', 'logoatacama2026.jpg');
    return fs.existsSync(logoPath) ? logoPath : null;
  }
}

module.exports = ChanchitosPdfService;
