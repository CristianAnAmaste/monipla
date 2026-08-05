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
  viable: '#e7f4eb',
  noViable: '#f8eeea',
  noViableText: '#85503f',
  white: '#ffffff',
};

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

class MonitoreoPdfService {
  constructor(options = {}) {
    this.logoPath = options.logoPath || this.buscarLogo();
  }

  async generarInforme(detalle, generatedAt = new Date()) {
    const matriz = this.construirMatrizResultados(detalle);

    return this.crearBuffer(async (doc) => {
      await this.agregarEncabezado(doc, detalle, generatedAt);
      this.agregarDatosCabecera(doc, detalle);
      this.agregarResponsables(doc, detalle);
      this.agregarAgroclima(doc, detalle.agroclima);
      this.agregarResultado(doc, detalle, matriz);
      this.agregarTotales(doc, detalle, matriz);
      await this.agregarEvidencias(doc, detalle);
      this.agregarPiesPagina(doc);
    }, matriz.layout);
  }

  async generarReporteGeneral(reporte, generatedAt = new Date()) {
    const catalogoPlagas = Array.isArray(reporte.catalogoPlagas) ? reporte.catalogoPlagas : [];
    const catalogoEstadios = Array.isArray(reporte.catalogoEstadios) ? reporte.catalogoEstadios : [];
    const monitoreos = Array.isArray(reporte.monitoreos) ? reporte.monitoreos : [];
    const bloques = monitoreos.map((detalle) => ({
      detalle,
      matriz: this.construirMatrizResultados(detalle, { catalogoPlagas, catalogoEstadios }),
    }));

    return this.crearBuffer(async (doc) => {
      await this.agregarEncabezadoReporteGeneral(doc, reporte.filtros, generatedAt);

      if (!bloques.length) {
        this.agregarTexto(doc, 'No se encontraron monitoreos para los filtros aplicados.');
      } else {
        bloques.forEach((bloque) => this.agregarBloqueReporteGeneral(doc, bloque.detalle, bloque.matriz));
      }

      this.agregarPiesPagina(doc);
    }, 'landscape', {
      Title: 'Reporte general de monitoreo de plagas',
      Subject: 'Reporte general de MONIPLA',
    });
  }

  crearBuffer(build, layout = 'portrait', info = {}) {
    return new Promise((resolve, reject) => {
      const doc = new PDFDocument({
        size: 'LETTER',
        layout,
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
          ...info,
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

  async agregarEncabezadoReporteGeneral(doc, filtros, generatedAt) {
    const x = doc.page.margins.left;
    const y = doc.y;
    const width = this.anchoUtil(doc);
    const logoWidth = 82;

    doc.save()
      .roundedRect(x, y, width, 72, 5)
      .fill(COLORS.header)
      .restore();

    if (this.logoPath) {
      try {
        const logoBuffer = await this.obtenerBufferImagen(this.logoPath);
        doc.image(logoBuffer, x + 12, y + 12, { fit: [logoWidth, 48] });
      } catch (_) {
        // El reporte no debe fallar si el logo no puede cargarse.
      }
    }

    const titleX = this.logoPath ? x + logoWidth + 18 : x + 14;
    doc.font('Helvetica-Bold')
      .fontSize(FONT.title)
      .fillColor(COLORS.primaryDark)
      .text('Reporte general de monitoreo de plagas', titleX, y + 12, {
        width: x + width - titleX - 12,
      });
    doc.font('Helvetica')
      .fontSize(9.5)
      .fillColor(COLORS.muted)
      .text(`MONIPLA - Fecha de generacion: ${this.formatearFechaHora(generatedAt)}`, titleX, y + 40, {
        width: x + width - titleX - 12,
      });
    doc.y = y + 82;

    this.agregarSeccion(doc, 'Filtros aplicados');
    const items = Array.isArray(filtros) && filtros.length > 0
      ? filtros
      : [['Filtros', 'Todos los monitoreos']];
    this.agregarResumenFiltrosReporte(doc, items);
  }

  agregarResumenFiltrosReporte(doc, items) {
    const x = doc.page.margins.left;
    const width = this.anchoUtil(doc);
    const gap = 14;
    const colWidth = (width - gap) / 2;
    const y = doc.y;

    for (let index = 0; index < items.length; index += 2) {
      const row = Math.floor(index / 2);
      const rowY = y + (row * 15);
      items.slice(index, index + 2).forEach(([label, value], itemIndex) => {
        const itemX = x + (itemIndex * (colWidth + gap));
        doc.font('Helvetica-Bold')
          .fontSize(7.5)
          .fillColor(COLORS.muted)
          .text(`${label}:`, itemX, rowY, { width: colWidth, lineBreak: false });
        const labelWidth = doc.widthOfString(`${label}:`);
        doc.font('Helvetica')
          .fillColor(COLORS.text)
          .text(this.valorReporte(value), itemX + labelWidth + 3, rowY, {
            width: colWidth - labelWidth - 3,
            lineBreak: false,
          });
      });
    }

    doc.y = y + (Math.ceil(items.length / 2) * 15) + 4;
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
      ['Tipo de muestra', info.nombreLugarMuestra || '-'],
    ], { incluirGuion: true });

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

  agregarResultado(doc, detalle, matriz) {
    const info = detalle.cabecera || {};

    this.agregarSeccion(doc, 'Resultado de plagas');

    if (detalle.estadoResultado === 'SIN_PLAGAS') {
      this.agregarTexto(doc, 'No se detectaron plagas en la muestra revisada.', { bold: true });
      if (info.observacionResultado) {
        this.agregarTexto(doc, `Observacion resultado: ${info.observacionResultado}`);
      }
      return;
    }

    if (detalle.estadoResultado !== 'CON_PLAGAS' || !matriz.filas.length) {
      this.agregarTexto(doc, 'El monitoreo no tiene resultados de plagas registrados.');
      return;
    }

    if (!matriz.estadios.length) {
      this.agregarTexto(doc, 'Hay plagas registradas, pero no existen conteos por estadio para construir la matriz.');
      return;
    }

    this.agregarMatrizResultados(doc, matriz);
  }

  agregarTotales(doc, detalle, matriz) {
    this.agregarSeccion(doc, 'Totales');

    if (detalle.estadoResultado === 'SIN_PLAGAS') {
      this.agregarTexto(doc, 'Total general: 0. Monitoreo registrado sin plagas.');
      return;
    }

    this.agregarBadges(doc, [
      ['Plagas detectadas', matriz.filas.length],
      ['Viables', matriz.totales.viable],
      ['No viables', matriz.totales.noViable],
      ['Total general', matriz.totales.general],
    ]);
  }

  agregarBloqueReporteGeneral(doc, detalle, matriz) {
    const x = doc.page.margins.left;
    const width = this.anchoUtil(doc);
    const anchoCabecera = Math.round(width * 0.36);
    const alturaObservacion = this.calcularAlturaObservacionGeneralReporte(doc, detalle, anchoCabecera);
    const alturaMinima = 224 + Math.max(0, alturaObservacion - 24);

    if (!this.hayEspacio(doc, alturaMinima) && doc.y > doc.page.margins.top + 4) {
      doc.addPage();
    }

    const y = doc.y;
    doc.save()
      .roundedRect(x, y, width, 24, 4)
      .fill(COLORS.soft)
      .restore();
    doc.font('Helvetica-Bold')
      .fontSize(10.5)
      .fillColor(COLORS.primaryDark)
      .text(`Monitoreo #${this.valorReporte(detalle.numeroMuestreo)} - ${this.valorReporte((detalle.cabecera || {}).fechaMonitoreo)}`, x + 8, y + 7, {
        width: width - 180,
      });
    doc.font('Helvetica-Bold')
      .fontSize(9)
      .fillColor(COLORS.text)
      .text(`Estado: ${this.valorReporte(detalle.estadoResultado)}`, x + width - 170, y + 7, {
        width: 162,
        align: 'right',
      });

    const top = y + 30;
    const gap = 10;
    const anchoMatriz = width - anchoCabecera - gap;
    const finCabecera = this.dibujarCabeceraReporteGeneral(doc, detalle, x, top, anchoCabecera);

    doc.y = top;
    const finMatriz = this.agregarMatrizResultados(doc, matriz, {
      x: x + anchoCabecera + gap,
      width: anchoMatriz,
      anchoPlaga: 112,
    });
    doc.y = Math.max(finCabecera, finMatriz) + 5;
    doc.y += 7;
  }

  dibujarCabeceraReporteGeneral(doc, detalle, x, y, width) {
    const info = detalle.cabecera || {};
    const items = [
      ['Fundo', info.fundo],
      ['Campo', info.campo],
      ['Variedad', info.variedad],
      ['Cuartel', info.cuartel],
      ['Muestrador', info.muestreador],
      ['Ingresado por', info.nombreUsuarioCreacion, { incluirGuion: true }],
      ['SDP', info.sdp],
      ['CSG', info.csg],
      ['Tipo de muestra', info.nombreLugarMuestra, { incluirGuion: true }],
      ['Estado fenologico', info.estadoFenologico],
      ['Trazabilidad', info.trazabilidad],
    ];
    const gap = 7;
    const colWidth = (width - gap) / 2;
    let bottom = y;

    items.forEach(([label, value, options = {}], index) => {
      const column = index % 2;
      const row = Math.floor(index / 2);
      const cellX = x + (column * (colWidth + gap));
      const cellY = y + (row * 27);
      doc.font('Helvetica-Bold')
        .fontSize(7)
        .fillColor(COLORS.muted)
        .text(`${label}:`, cellX, cellY, { width: colWidth, lineBreak: false });
      doc.font('Helvetica')
        .fontSize(8.3)
        .fillColor(COLORS.text)
        .text(
          options.incluirGuion ? (this.valor(value) || '-') : this.valorReporte(value),
          cellX,
          cellY + 9,
          { width: colWidth, lineGap: 0 }
        );
      bottom = Math.max(bottom, cellY + 23);
    });

    const observacion = this.valor(info.observacionGeneral) || 'Sin Observaciones';
    doc.font('Helvetica-Bold')
      .fontSize(7)
      .fillColor(COLORS.muted)
      .text('Observación general:', x, bottom + 3, { width });
    const observacionY = bottom + 12;
    const observacionHeight = doc.font('Helvetica')
      .fontSize(8.3)
      .heightOfString(observacion, { width, lineGap: 0 });
    doc.fillColor(COLORS.text)
      .text(observacion, x, observacionY, { width, lineGap: 0 });

    return observacionY + Math.max(12, observacionHeight);
  }

  calcularAlturaObservacionGeneralReporte(doc, detalle, width) {
    const observacion = this.valor((detalle.cabecera || {}).observacionGeneral) || 'Sin Observaciones';
    const alturaEtiqueta = doc.font('Helvetica-Bold')
      .fontSize(7)
      .heightOfString('Observación general:', { width, lineGap: 0 });
    const alturaTexto = doc.font('Helvetica')
      .fontSize(8.3)
      .heightOfString(observacion, { width, lineGap: 0 });

    return 3 + alturaEtiqueta + Math.max(12, alturaTexto);
  }

  valorReporte(value) {
    return this.valor(value) || '—';
  }

  construirMatrizResultados(detalle, options = {}) {
    const estadios = [];
    const estadiosPorClave = new Map();
    const filas = [];
    const filasPorClave = new Map();
    const totales = { viable: 0, noViable: 0, general: 0 };
    const plagas = Array.isArray(detalle.plagas) ? detalle.plagas : [];
    const catalogoPlagas = Array.isArray(options.catalogoPlagas) ? options.catalogoPlagas : [];
    const catalogoEstadios = Array.isArray(options.catalogoEstadios) ? options.catalogoEstadios : [];

    catalogoEstadios.forEach((estadio, indice) => {
      const clave = this.claveMatriz(estadio.value, estadio.label, indice);
      estadiosPorClave.set(clave, {
        clave,
        nombre: this.valor(estadio.label) || 'Estadio sin nombre',
        orden: this.ordenEstadio(estadio.value, indice),
      });
      estadios.push(estadiosPorClave.get(clave));
    });

    catalogoPlagas.forEach((plaga, indice) => {
      const clave = this.claveMatriz(plaga.value, plaga.label, indice);
      const fila = this.crearFilaMatriz(plaga, indice);
      filasPorClave.set(clave, fila);
      filas.push(fila);
    });

    plagas.forEach((plaga, indicePlaga) => {
      const clavePlaga = this.claveMatriz(plaga.idPlaga, plaga.nombrePlaga, indicePlaga);
      let fila = filasPorClave.get(clavePlaga);

      if (!fila) {
        fila = this.crearFilaMatriz(plaga, filas.length);
        filasPorClave.set(clavePlaga, fila);
        filas.push(fila);
      }

      fila.tieneResultado = true;
      fila.tipoRegistro = this.valor(plaga.tipoRegistro) || fila.tipoRegistro;
      fila.detalleTexto = this.valor(plaga.detalleTexto) || fila.detalleTexto;
      fila.observacion = this.valor(plaga.observacion) || fila.observacion;

      (Array.isArray(plaga.conteos) ? plaga.conteos : []).forEach((conteo, indiceConteo) => {
        const claveEstadio = this.claveMatriz(conteo.idEstadio, conteo.estadio, indiceConteo);
        let estadio = estadiosPorClave.get(claveEstadio);

        if (!estadio) {
          estadio = {
            clave: claveEstadio,
            nombre: this.valor(conteo.estadio) || 'Estadio sin nombre',
            orden: this.ordenEstadio(conteo.idEstadio, estadios.length),
          };
          estadiosPorClave.set(claveEstadio, estadio);
          estadios.push(estadio);
        }

        const estado = this.clasificarEstadoViabilidad(conteo.estado);
        const cantidad = this.numeroCantidad(conteo.cantidad);
        let celda = fila.estadios.get(claveEstadio);

        if (!celda) {
          celda = { viable: null, noViable: null };
          fila.estadios.set(claveEstadio, celda);
        }

        celda[estado] = (celda[estado] === null ? 0 : celda[estado]) + cantidad;
        fila[estado === 'viable' ? 'totalViable' : 'totalNoViable'] += cantidad;
        fila.totalGeneral += cantidad;
        totales[estado] += cantidad;
        totales.general += cantidad;
      });
    });

    estadios.sort((a, b) => a.orden - b.orden);
    if (catalogoPlagas.length > 0) {
      filas.sort((a, b) => a.orden - b.orden);
    }
    const layout = this.requiereHorizontal(estadios.length) ? 'landscape' : 'portrait';

    return {
      estadios,
      filas,
      totales,
      layout,
      estadoResultado: detalle.estadoResultado,
    };
  }

  crearFilaMatriz(plaga, indice) {
    return {
      plaga: this.valor(plaga.nombrePlaga || plaga.label) || 'Plaga sin nombre',
      estadios: new Map(),
      totalViable: 0,
      totalNoViable: 0,
      totalGeneral: 0,
      tipoRegistro: this.valor(plaga.tipoRegistro || plaga.tipo_registro),
      detalleTexto: this.valor(plaga.detalleTexto || plaga.detalle_texto),
      observacion: this.valor(plaga.observacion),
      tieneResultado: false,
      orden: this.ordenPlaga(plaga.idPlaga || plaga.value, indice),
    };
  }

  ordenPlaga(idPlaga, indice) {
    const orden = Number(idPlaga);
    return Number.isFinite(orden) ? orden : Number.MAX_SAFE_INTEGER + indice;
  }

  claveMatriz(id, nombre, indice) {
    const identificador = this.valor(id);
    return identificador ? `id:${identificador}` : `nombre:${this.valor(nombre)}:${indice}`;
  }

  clasificarEstadoViabilidad(estado) {
    const normalizado = this.valor(estado)
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase();

    return /^no\s*viable\b/.test(normalizado) ? 'noViable' : 'viable';
  }

  numeroCantidad(cantidad) {
    const numero = Number(cantidad);
    return Number.isFinite(numero) ? numero : 0;
  }

  ordenEstadio(idEstadio, indice) {
    const orden = Number(idEstadio);
    return Number.isFinite(orden) ? orden : Number.MAX_SAFE_INTEGER + indice;
  }

  requiereHorizontal(totalEstadios) {
    const anchoRetrato = 612 - 80;
    const anchoMinimo = 116 + 126 + (totalEstadios * 64);
    return anchoMinimo > anchoRetrato;
  }

  agregarMatrizResultados(doc, matriz, area = {}) {
    const diseno = this.obtenerDisenoMatriz(doc, matriz, area);
    this.dibujarEncabezadoMatriz(doc, matriz, diseno);

    matriz.filas.forEach((fila) => {
      const altura = this.alturaFilaMatriz(doc, fila, matriz, diseno);
      this.asegurarEspacioMatriz(doc, altura, matriz, diseno);
      this.dibujarFilaMatriz(doc, fila, matriz, diseno, false);
    });

    return doc.y;
  }

  obtenerDisenoMatriz(doc, matriz, area = {}) {
    const ancho = area.width || this.anchoUtil(doc);
    const mostrarTotalesEstado = matriz.estadios.length <= 8;
    const anchoTotales = mostrarTotalesEstado ? 126 : 52;
    const anchoPlaga = area.anchoPlaga || (doc.page.width > doc.page.height ? 136 : 116);
    const anchoEstadio = (ancho - anchoPlaga - anchoTotales) / matriz.estadios.length;

    return {
      x: area.x === undefined ? doc.page.margins.left : area.x,
      anchoPlaga,
      anchoEstadio,
      anchoSubcolumna: anchoEstadio / 2,
      anchoTotales,
      mostrarTotalesEstado,
      padding: 3,
      fontSize: anchoEstadio < 64 ? 7.2 : 8.2,
      headerFontSize: anchoEstadio < 64 ? 6.8 : 7.5,
    };
  }

  dibujarEncabezadoMatriz(doc, matriz, diseno) {
    const x = diseno.x;
    const altoSubencabezado = 19;
    const altoEncabezado = Math.max(24, ...matriz.estadios.map((estadio) => doc.font('Helvetica-Bold')
      .fontSize(diseno.headerFontSize)
      .heightOfString(estadio.nombre, { width: diseno.anchoEstadio - 6, align: 'center' }) + 6));
    const altoTotal = altoEncabezado + altoSubencabezado;

    this.ensureSpace(doc, altoTotal + 24);
    const y = doc.y;
    this.dibujarCeldaMatriz(doc, 'Plaga', x, y, diseno.anchoPlaga, altoTotal, {
      fill: COLORS.soft,
      bold: true,
      fontSize: diseno.headerFontSize,
      align: 'left',
    });

    let cellX = x + diseno.anchoPlaga;
    matriz.estadios.forEach((estadio) => {
      this.dibujarCeldaMatriz(doc, estadio.nombre, cellX, y, diseno.anchoEstadio, altoEncabezado, {
        fill: COLORS.soft,
        bold: true,
        fontSize: diseno.headerFontSize,
        align: 'center',
      });
      this.dibujarCeldaMatriz(doc, 'Viable', cellX, y + altoEncabezado, diseno.anchoSubcolumna, altoSubencabezado, {
        fill: COLORS.viable,
        bold: true,
        color: COLORS.primaryDark,
        fontSize: diseno.headerFontSize,
        align: 'center',
      });
      this.dibujarCeldaMatriz(doc, 'No viable', cellX + diseno.anchoSubcolumna, y + altoEncabezado, diseno.anchoSubcolumna, altoSubencabezado, {
        fill: COLORS.noViable,
        bold: true,
        color: COLORS.noViableText,
        fontSize: diseno.headerFontSize,
        align: 'center',
      });
      cellX += diseno.anchoEstadio;
    });

    if (diseno.mostrarTotalesEstado) {
      this.dibujarCeldaMatriz(doc, 'Total viable', cellX, y, 42, altoTotal, {
        fill: COLORS.viable,
        bold: true,
        color: COLORS.primaryDark,
        fontSize: diseno.headerFontSize,
        align: 'center',
      });
      this.dibujarCeldaMatriz(doc, 'Total no viable', cellX + 42, y, 42, altoTotal, {
        fill: COLORS.noViable,
        bold: true,
        color: COLORS.noViableText,
        fontSize: diseno.headerFontSize,
        align: 'center',
      });
      cellX += 84;
    }
    this.dibujarCeldaMatriz(doc, 'Total general', cellX, y, 42, altoTotal, {
      fill: COLORS.soft,
      bold: true,
      fontSize: diseno.headerFontSize,
      align: 'center',
    });
    doc.y = y + altoTotal;
  }

  asegurarEspacioMatriz(doc, alturaFila, matriz, diseno) {
    const fondo = doc.page.height - doc.page.margins.bottom - 10;
    if (doc.y + alturaFila > fondo) {
      doc.addPage();
      this.dibujarEncabezadoMatriz(doc, matriz, diseno);
    }
  }

  alturaFilaMatriz(doc, fila, matriz, diseno) {
    const alturaTexto = doc.font('Helvetica').fontSize(diseno.fontSize).heightOfString(fila.plaga, {
      width: diseno.anchoPlaga - (diseno.padding * 2),
      lineGap: 0,
    });
    return Math.max(21, alturaTexto + (diseno.padding * 2));
  }

  dibujarFilaMatriz(doc, fila, matriz, diseno, esTotal) {
    const altura = this.alturaFilaMatriz(doc, fila, matriz, diseno);
    const y = doc.y;
    const fill = esTotal ? COLORS.soft : COLORS.white;
    this.dibujarCeldaMatriz(doc, fila.plaga, diseno.x, y, diseno.anchoPlaga, altura, {
      fill,
      bold: esTotal,
      fontSize: diseno.fontSize,
      align: 'left',
    });

    let cellX = diseno.x + diseno.anchoPlaga;
    matriz.estadios.forEach((estadio) => {
      this.dibujarCeldaMatriz(doc, this.textoCeldaMatriz(fila, estadio.clave, 'viable'), cellX, y, diseno.anchoSubcolumna, altura, {
        fill,
        bold: esTotal,
        fontSize: diseno.fontSize,
        align: 'right',
      });
      this.dibujarCeldaMatriz(doc, this.textoCeldaMatriz(fila, estadio.clave, 'noViable'), cellX + diseno.anchoSubcolumna, y, diseno.anchoSubcolumna, altura, {
        fill,
        bold: esTotal,
        fontSize: diseno.fontSize,
        color: COLORS.noViableText,
        align: 'right',
      });
      cellX += diseno.anchoEstadio;
    });

    if (diseno.mostrarTotalesEstado) {
      this.dibujarCeldaMatriz(doc, this.textoTotalMatriz(fila, matriz, 'totalViable'), cellX, y, 42, altura, {
        fill: esTotal ? COLORS.viable : COLORS.white,
        bold: esTotal,
        fontSize: diseno.fontSize,
        color: COLORS.primaryDark,
        align: 'right',
      });
      this.dibujarCeldaMatriz(doc, this.textoTotalMatriz(fila, matriz, 'totalNoViable'), cellX + 42, y, 42, altura, {
        fill: esTotal ? COLORS.noViable : COLORS.white,
        bold: esTotal,
        fontSize: diseno.fontSize,
        color: COLORS.noViableText,
        align: 'right',
      });
      cellX += 84;
    }
    this.dibujarCeldaMatriz(doc, this.textoTotalMatriz(fila, matriz, 'totalGeneral'), cellX, y, 42, altura, {
      fill,
      bold: esTotal,
      fontSize: diseno.fontSize,
      align: 'right',
    });
    doc.y = y + altura;
  }

  valorCeldaMatriz(fila, claveEstadio, estado, porDefecto = null) {
    const celda = fila.estadios.get(claveEstadio);
    return celda && celda[estado] !== null ? celda[estado] : porDefecto;
  }

  textoCeldaMatriz(fila, claveEstadio, estado) {
    const cantidad = this.valorCeldaMatriz(fila, claveEstadio, estado);
    return cantidad === null ? '—' : this.formatearCantidad(cantidad);
  }

  textoTotalMatriz(fila, matriz, propiedad) {
    if (matriz.estadoResultado === 'PENDIENTE' && !fila.tieneResultado) {
      return '—';
    }

    return this.formatearCantidad(fila[propiedad]);
  }

  formatearCantidad(cantidad) {
    return new Intl.NumberFormat('es-CL', { maximumFractionDigits: 2 }).format(cantidad);
  }

  dibujarCeldaMatriz(doc, valor, x, y, ancho, alto, options = {}) {
    const padding = 3;
    const font = options.bold ? 'Helvetica-Bold' : 'Helvetica';
    const fontSize = options.fontSize || FONT.table;
    const color = options.color || COLORS.text;
    const text = this.valor(valor);
    const textHeight = doc.font(font).fontSize(fontSize).heightOfString(text, {
      width: ancho - (padding * 2),
      align: options.align || 'left',
      lineGap: 0,
    });

    doc.save()
      .fillColor(options.fill || COLORS.white)
      .rect(x, y, ancho, alto)
      .fill()
      .strokeColor(COLORS.line)
      .lineWidth(0.55)
      .rect(x, y, ancho, alto)
      .stroke()
      .restore();
    doc.font(font)
      .fontSize(fontSize)
      .fillColor(color)
      .text(text, x + padding, y + Math.max(padding, (alto - textHeight) / 2), {
        width: ancho - (padding * 2),
        align: options.align || 'left',
        lineGap: 0,
      });
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

  agregarKeyValuesEnColumnas(doc, rows, { incluirGuion = false } = {}) {
    const validRows = rows.filter((row) => (
      this.tieneValor(row[1]) || (incluirGuion && String(row[1] ?? '').trim() === '-')
    ));
    if (!validRows.length) return;

    const x = doc.page.margins.left;
    const width = this.anchoUtil(doc);
    const gap = 14;
    const colWidth = (width - gap) / 2;

    for (let index = 0; index < validRows.length; index += 2) {
      const pair = validRows.slice(index, index + 2);
      const heights = pair.map(([label, value]) => this.alturaKeyValue(
        doc,
        label,
        value,
        colWidth,
        incluirGuion
      ));
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
          .text(this.valorKeyValue(value, incluirGuion), colX, y + 10, {
            width: colWidth,
            lineGap: 0,
          });
      });

      doc.y = y + rowHeight + 2;
    }
  }

  alturaKeyValue(doc, label, value, width, incluirGuion = false) {
    const labelHeight = doc.font('Helvetica-Bold').fontSize(9).heightOfString(`${label}:`, {
      width,
      lineGap: 0,
    });
    const valueHeight = doc.font('Helvetica').fontSize(11).heightOfString(
      this.valorKeyValue(value, incluirGuion),
      {
      width,
      lineGap: 0,
      }
    );

    return labelHeight + valueHeight;
  }

  valorKeyValue(value, incluirGuion = false) {
    return incluirGuion && String(value ?? '').trim() === '-' ? '-' : this.valor(value);
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
