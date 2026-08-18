function construirUrlPdfChanchitos(valores = {}) {
  const query = new URLSearchParams();
  ['fechaDesde', 'fechaHasta', 'genFundo', 'genCampo', 'genVariedad', 'idCatalogoSdp', 'idMonitoreador', 'idEstadoFenologico', 'deteccion'].forEach((nombre) => {
    const valor = String(valores[nombre] ?? '').trim();
    if (valor) query.set(nombre, valor);
  });
  const serializado = query.toString();
  return `/chanchitos/pdf/general${serializado ? `?${serializado}` : ''}`;
}

function construirUrlDetalleParcialChanchitos(idMonitoreo) {
  const id = String(idMonitoreo ?? '').trim();
  return /^\d+$/.test(id)
    ? `/chanchitos/${encodeURIComponent(id)}/detalle-parcial`
    : null;
}

function construirUrlEliminarChanchitos(idMonitoreo) {
  const id = String(idMonitoreo ?? '').trim();
  return /^\d+$/.test(id)
    ? `/chanchitos/${encodeURIComponent(id)}/eliminar`
    : null;
}

if (typeof module !== 'undefined') {
  module.exports = {
    construirUrlPdfChanchitos,
    construirUrlDetalleParcialChanchitos,
    construirUrlEliminarChanchitos,
  };
}

if (typeof document !== 'undefined') document.addEventListener('DOMContentLoaded', () => {
  const SELECTOR_BOTON_DETALLE = '[data-action="toggle-detalle"]';
  const SELECTOR_BOTON_ELIMINAR = '[data-action="confirmar-eliminacion"]';
  const detallesCargados = new Set();
  let detalleAbierto = null;
  let botonEliminarActivo = null;
  const modalEliminar = document.getElementById('chanchitos-eliminar-modal');
  const formularioEliminar = document.getElementById('chanchitos-eliminar-form');
  const confirmarEliminacion = document.getElementById('chanchitos-confirmar-eliminacion');
  let botonEvidenciaActivo = null;

  const crearModalEvidencia = () => {
    const existente = document.getElementById('chanchitos-evidence-modal');
    if (existente) return existente;

    const modal = document.createElement('div');
    modal.id = 'chanchitos-evidence-modal';
    modal.className = 'modal-shell chanchitos-evidence-modal is-hidden';
    modal.hidden = true;
    modal.setAttribute('role', 'dialog');
    modal.setAttribute('aria-modal', 'true');
    modal.setAttribute('aria-hidden', 'true');
    modal.setAttribute('aria-labelledby', 'chanchitos-evidence-modal-title');
    modal.innerHTML = `
      <div class="modal-backdrop" data-close-chanchitos-evidence-modal="true"></div>
      <div class="modal-card" role="document">
        <header class="modal-header">
          <div>
            <h2 id="chanchitos-evidence-modal-title">Imagen de evidencia</h2>
            <p data-chanchitos-evidence-description></p>
          </div>
          <button class="modal-close" type="button" data-close-chanchitos-evidence-modal="true" aria-label="Cerrar imagen ampliada">×</button>
        </header>
        <img class="chanchitos-evidence-modal-image" alt="">
      </div>
    `;
    document.body.appendChild(modal);
    return modal;
  };

  const modalEvidencia = crearModalEvidencia();
  const imagenEvidencia = modalEvidencia.querySelector('.chanchitos-evidence-modal-image');
  const descripcionEvidencia = modalEvidencia.querySelector('[data-chanchitos-evidence-description]');
  const cerrarEvidencia = () => {
    if (modalEvidencia.hidden) return;
    modalEvidencia.classList.add('is-hidden');
    modalEvidencia.hidden = true;
    modalEvidencia.setAttribute('aria-hidden', 'true');
    imagenEvidencia.removeAttribute('src');
    document.body.classList.remove('has-modal-open');
    botonEvidenciaActivo?.focus();
    botonEvidenciaActivo = null;
  };
  const abrirEvidencia = (trigger) => {
    const url = trigger.getAttribute('href');
    if (!url) return;

    botonEvidenciaActivo = trigger;
    const descripcion = trigger.dataset.evidenceLabel || 'Imagen de evidencia del monitoreo';
    imagenEvidencia.src = url;
    imagenEvidencia.alt = descripcion;
    descripcionEvidencia.textContent = descripcion;
    modalEvidencia.classList.remove('is-hidden');
    modalEvidencia.hidden = false;
    modalEvidencia.setAttribute('aria-hidden', 'false');
    document.body.classList.add('has-modal-open');
    modalEvidencia.querySelector('[data-close-chanchitos-evidence-modal="true"]:not(.modal-backdrop)')?.focus();
  };

  const obtenerElementosDetalle = (idMonitoreo) => ({
    row: document.querySelector(`[data-detail-row="${idMonitoreo}"]`),
    container: document.querySelector(`[data-detail-container="${idMonitoreo}"]`),
    button: document.querySelector(`${SELECTOR_BOTON_DETALLE}[data-id-monitoreo="${idMonitoreo}"]`),
  });
  const mostrarLoading = (container) => {
    container.innerHTML = '<div class="detalle-loading" role="status">Cargando detalle...</div>';
  };
  const mostrarError = (container) => {
    container.innerHTML = '<div class="detalle-error" role="alert">No se pudo cargar el detalle del monitoreo.</div>';
  };
  const cerrarDetalleActual = () => {
    if (!detalleAbierto) return;
    const actual = obtenerElementosDetalle(detalleAbierto);
    if (actual.row) actual.row.hidden = true;
    if (actual.button) {
      actual.button.textContent = 'Ver detalle';
      actual.button.setAttribute('aria-expanded', 'false');
    }
    detalleAbierto = null;
  };
  const cargarDetalle = async (idMonitoreo, container) => {
    if (detallesCargados.has(idMonitoreo)) return;
    const url = construirUrlDetalleParcialChanchitos(idMonitoreo);
    if (!url) throw new Error('ID_MONITOREO_INVALIDO');

    mostrarLoading(container);
    const response = await fetch(url, {
      method: 'GET',
      headers: { Accept: 'text/html' },
    });
    if (!response.ok) throw new Error(`HTTP_${response.status}`);

    container.innerHTML = await response.text();
    detallesCargados.add(idMonitoreo);
  };
  const toggleDetalle = async (button) => {
    const idMonitoreo = String(button.dataset.idMonitoreo || '').trim();
    if (!/^\d+$/.test(idMonitoreo)) return;

    const elementos = obtenerElementosDetalle(idMonitoreo);
    if (!elementos.row || !elementos.container) return;
    if (detalleAbierto === idMonitoreo && !elementos.row.hidden) {
      cerrarDetalleActual();
      return;
    }

    cerrarDetalleActual();
    detalleAbierto = idMonitoreo;
    elementos.row.hidden = false;
    button.textContent = 'Ocultar detalle';
    button.setAttribute('aria-expanded', 'true');

    try {
      await cargarDetalle(idMonitoreo, elementos.container);
    } catch (error) {
      console.error('[MONIPLA][CHANCHITOS][DETALLE][FRONTEND_ERROR]', {
        idMonitoreo,
        error: error.message,
      });
      mostrarError(elementos.container);
    }
  };

  const setResumenEliminacion = (nombre, valor) => {
    const target = document.querySelector(`[data-chanchitos-delete-summary="${nombre}"]`);
    if (target) target.textContent = valor || '-';
  };
  const abrirModalEliminacion = (button) => {
    if (!modalEliminar || !formularioEliminar) return;
    const idMonitoreo = String(button.dataset.idMonitoreo || '').trim();
    const url = construirUrlEliminarChanchitos(idMonitoreo);
    if (!url) return;

    botonEliminarActivo = button;
    formularioEliminar.action = url;
    setResumenEliminacion('id', `#${idMonitoreo}`);
    setResumenEliminacion('fecha', button.dataset.fechaMonitoreo);
    setResumenEliminacion('origen', `${button.dataset.fundo || '-'} / ${button.dataset.campo || '-'}`);
    setResumenEliminacion('ubicacion', `${button.dataset.variedad || '-'} / ${button.dataset.cuartel || '-'}`);
    setResumenEliminacion('sdp', button.dataset.sdp);
    setResumenEliminacion('plantas', button.dataset.cantPlantas);
    setResumenEliminacion('bichos', button.dataset.totalBichos);
    setResumenEliminacion('monitoreador', button.dataset.monitoreador);
    if (confirmarEliminacion) {
      confirmarEliminacion.disabled = false;
      confirmarEliminacion.textContent = 'Eliminar monitoreo';
    }
    modalEliminar.classList.remove('is-hidden');
    modalEliminar.hidden = false;
    modalEliminar.setAttribute('aria-hidden', 'false');
    document.body.classList.add('has-modal-open');
    confirmarEliminacion?.focus();
  };
  const cerrarModalEliminacion = () => {
    if (!modalEliminar) return;
    modalEliminar.classList.add('is-hidden');
    modalEliminar.hidden = true;
    modalEliminar.setAttribute('aria-hidden', 'true');
    document.body.classList.remove('has-modal-open');
    botonEliminarActivo?.focus();
    botonEliminarActivo = null;
  };

  document.addEventListener('click', (event) => {
    const button = event.target.closest(SELECTOR_BOTON_DETALLE);
    if (button) {
      event.preventDefault();
      toggleDetalle(button);
      return;
    }

    const evidenceTrigger = event.target.closest('[data-chanchitos-evidence="true"]');
    if (evidenceTrigger) {
      event.preventDefault();
      abrirEvidencia(evidenceTrigger);
      return;
    }

    const deleteButton = event.target.closest(SELECTOR_BOTON_ELIMINAR);
    if (deleteButton) {
      event.preventDefault();
      abrirModalEliminacion(deleteButton);
      return;
    }

    if (event.target.closest('[data-close-chanchitos-delete-modal="true"]')) {
      event.preventDefault();
      cerrarModalEliminacion();
      return;
    }

    if (event.target.closest('[data-close-chanchitos-evidence-modal="true"]')) {
      event.preventDefault();
      cerrarEvidencia();
    }
  });

  formularioEliminar?.addEventListener('submit', () => {
    if (confirmarEliminacion) {
      confirmarEliminacion.disabled = true;
      confirmarEliminacion.textContent = 'Eliminando...';
    }
  });

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && !modalEvidencia.hidden) {
      cerrarEvidencia();
      return;
    }

    if (event.key === 'Escape' && modalEliminar && !modalEliminar.hidden) {
      cerrarModalEliminacion();
    }
  });

  const form = document.getElementById('chanchitos-history-form');
  const fundo = document.getElementById('genFundo');
  const campo = document.getElementById('genCampo');
  const variedad = document.getElementById('genVariedad');
  const cuartel = document.getElementById('idCatalogoSdp');
  const pdf = document.getElementById('chanchitos-pdf-general');
  if (!form || !fundo || !campo || !variedad || !cuartel) return;

  const reset = (select, message) => { select.innerHTML = `<option value="">${message}</option>`; select.disabled = true; };
  const cargar = async (url) => {
    const response = await fetch(url, { headers: { Accept: 'application/json' } });
    const payload = await response.json();
    if (!response.ok || !payload.success) throw new Error(payload.message || 'No fue posible cargar las opciones.');
    return payload.data || [];
  };
  const opciones = (select, items, message, selected = '') => {
    select.innerHTML = [`<option value="">${message}</option>`, ...items.map((item) => `<option value="${item.value}" ${String(item.value) === String(selected) ? 'selected' : ''}>${item.label}</option>`)].join('');
    select.disabled = false;
  };
  const cargarCampos = async (selected = '') => {
    reset(campo, 'Seleccione primero un fundo'); reset(variedad, 'Seleccione primero un campo'); reset(cuartel, 'Seleccione primero una variedad');
    if (!fundo.value) return;
    opciones(campo, await cargar(`/monitoreos/api/campos/${encodeURIComponent(fundo.value)}`), 'Todos', selected);
  };
  const cargarVariedades = async (selected = '') => {
    reset(variedad, 'Seleccione primero un campo'); reset(cuartel, 'Seleccione primero una variedad');
    if (!fundo.value || !campo.value) return;
    opciones(variedad, await cargar(`/monitoreos/api/variedades/${encodeURIComponent(fundo.value)}/${encodeURIComponent(campo.value)}`), 'Todas', selected);
  };
  const cargarCuarteles = async (selected = '') => {
    reset(cuartel, 'Seleccione primero una variedad');
    if (!fundo.value || !campo.value || !variedad.value) return;
    opciones(cuartel, await cargar(`/monitoreos/api/cuarteles/${encodeURIComponent(fundo.value)}/${encodeURIComponent(campo.value)}/${encodeURIComponent(variedad.value)}`), 'Todos', selected);
  };
  fundo.addEventListener('change', () => cargarCampos().catch(() => reset(campo, 'No fue posible cargar campos')));
  campo.addEventListener('change', () => cargarVariedades().catch(() => reset(variedad, 'No fue posible cargar variedades')));
  variedad.addEventListener('change', () => cargarCuarteles().catch(() => reset(cuartel, 'No fue posible cargar cuarteles')));
  form.addEventListener('submit', () => { const pagina = document.createElement('input'); pagina.type = 'hidden'; pagina.name = 'pagina'; pagina.value = '1'; form.appendChild(pagina); });
  if (pdf) pdf.addEventListener('click', (event) => {
    event.preventDefault();
    const valores = Object.fromEntries(new FormData(form).entries());
    const url = construirUrlPdfChanchitos(valores);
    pdf.textContent = 'Generando PDF...';
    pdf.classList.add('is-disabled');
    pdf.setAttribute('aria-disabled', 'true');
    window.location.assign(url);
    setTimeout(() => {
      pdf.textContent = 'Descargar PDF general';
      pdf.classList.remove('is-disabled');
      pdf.removeAttribute('aria-disabled');
    }, 3000);
  });
  (async () => { try { if (!fundo.value) return; await cargarCampos(campo.dataset.selected); if (!campo.value) return; await cargarVariedades(variedad.dataset.selected); if (variedad.value) await cargarCuarteles(cuartel.dataset.selected); } catch (_) {} })();
});
