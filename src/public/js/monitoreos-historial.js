(function () {
  const SELECTOR_BOTON_DETALLE = '[data-action="toggle-detalle"]';
  let detalleAbierto = null;
  const detallesCargados = new Set();

  function obtenerElementos(idMuestreo) {
    return {
      row: document.querySelector(`[data-detail-row="${idMuestreo}"]`),
      container: document.querySelector(`[data-detail-container="${idMuestreo}"]`),
      button: document.querySelector(`${SELECTOR_BOTON_DETALLE}[data-id-muestreo="${idMuestreo}"]`),
    };
  }

  function cerrarDetalleActual() {
    if (!detalleAbierto) {
      return;
    }

    const actual = obtenerElementos(detalleAbierto);

    if (actual.row) {
      actual.row.hidden = true;
    }

    if (actual.button) {
      actual.button.textContent = 'Ver detalle';
      actual.button.removeAttribute('aria-expanded');
    }

    detalleAbierto = null;
  }

  function mostrarLoading(container) {
    container.innerHTML = '<div class="detalle-loading">Cargando detalle...</div>';
  }

  function mostrarError(container) {
    container.innerHTML = '<div class="detalle-error" role="alert">No se pudo cargar el detalle del monitoreo.</div>';
  }

  async function cargarDetalleMuestreo(idMuestreo, container) {
    if (detallesCargados.has(idMuestreo)) {
      return;
    }

    mostrarLoading(container);

    const response = await fetch(`/monitoreos/${encodeURIComponent(idMuestreo)}/detalle-parcial`, {
      method: 'GET',
      headers: {
        Accept: 'text/html',
      },
    });

    if (!response.ok) {
      throw new Error(`HTTP_${response.status}`);
    }

    container.innerHTML = await response.text();
    detallesCargados.add(idMuestreo);
  }

  async function toggleDetalleMuestreo(idMuestreo) {
    const elementos = obtenerElementos(idMuestreo);

    if (!elementos.row || !elementos.container || !elementos.button) {
      return;
    }

    if (detalleAbierto === idMuestreo && !elementos.row.hidden) {
      cerrarDetalleActual();
      return;
    }

    cerrarDetalleActual();

    detalleAbierto = idMuestreo;
    elementos.row.hidden = false;
    elementos.button.textContent = 'Ocultar detalle';
    elementos.button.setAttribute('aria-expanded', 'true');

    try {
      await cargarDetalleMuestreo(idMuestreo, elementos.container);
    } catch (error) {
      console.error('[MONIPLA][DETALLE][FRONTEND_ERROR]', {
        idMuestreo,
        error: error.message,
      });
      mostrarError(elementos.container);
    }
  }

  document.addEventListener('click', (event) => {
    const button = event.target.closest(SELECTOR_BOTON_DETALLE);

    if (!button) {
      return;
    }

    event.preventDefault();
    toggleDetalleMuestreo(button.dataset.idMuestreo);
  });
}());
