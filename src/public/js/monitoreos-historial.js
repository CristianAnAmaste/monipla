(function () {
  const SELECTOR_BOTON_DETALLE = '[data-action="toggle-detalle"]';
  const SELECTOR_BOTON_ELIMINAR = '[data-action="confirmar-eliminacion"]';
  let detalleAbierto = null;
  let botonEliminarActivo = null;
  const detallesCargados = new Set();
  const modalEliminar = document.getElementById('historial-eliminar-modal');
  const formularioEliminar = document.getElementById('historial-eliminar-form');
  const confirmarEliminacion = document.getElementById('historial-confirmar-eliminacion');

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

  function setResumenEliminacion(nombre, valor) {
    const target = document.querySelector(`[data-delete-summary="${nombre}"]`);

    if (target) {
      target.textContent = valor || '-';
    }
  }

  function abrirModalEliminacion(button) {
    if (!modalEliminar || !formularioEliminar) {
      return;
    }

    const idMuestreo = String(button.dataset.idMuestreo || '').trim();

    if (!/^\d+$/.test(idMuestreo)) {
      return;
    }

    botonEliminarActivo = button;
    formularioEliminar.action = `/monitoreos/${encodeURIComponent(idMuestreo)}/eliminar`;
    setResumenEliminacion('numero', `N.º ${button.dataset.numeroMuestreo || '-'}`);
    setResumenEliminacion('fecha', button.dataset.fechaMonitoreo || '-');
    setResumenEliminacion('origen', `${button.dataset.fundo || '-'} / ${button.dataset.campo || '-'}`);
    setResumenEliminacion('ubicacion', `${button.dataset.variedad || '-'} / ${button.dataset.cuartel || '-'}`);
    setResumenEliminacion('sdp', button.dataset.sdp || '-');
    setResumenEliminacion('estado', button.dataset.estadoResultado || '-');

    if (confirmarEliminacion) {
      confirmarEliminacion.disabled = false;
      confirmarEliminacion.textContent = 'Eliminar monitoreo';
    }

    modalEliminar.classList.remove('is-hidden');
    modalEliminar.hidden = false;
    modalEliminar.setAttribute('aria-hidden', 'false');
    document.body.classList.add('has-modal-open');
    confirmarEliminacion?.focus();
  }

  function cerrarModalEliminacion() {
    if (!modalEliminar) {
      return;
    }

    modalEliminar.classList.add('is-hidden');
    modalEliminar.hidden = true;
    modalEliminar.setAttribute('aria-hidden', 'true');
    document.body.classList.remove('has-modal-open');
    botonEliminarActivo?.focus();
    botonEliminarActivo = null;
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

    if (button) {
      event.preventDefault();
      toggleDetalleMuestreo(button.dataset.idMuestreo);
      return;
    }

    const deleteButton = event.target.closest(SELECTOR_BOTON_ELIMINAR);

    if (deleteButton) {
      event.preventDefault();
      abrirModalEliminacion(deleteButton);
      return;
    }

    if (event.target.closest('[data-close-delete-modal="true"]')) {
      event.preventDefault();
      cerrarModalEliminacion();
    }
  });

  formularioEliminar?.addEventListener('submit', () => {
    if (confirmarEliminacion) {
      confirmarEliminacion.disabled = true;
      confirmarEliminacion.textContent = 'Eliminando...';
    }
  });

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && modalEliminar && !modalEliminar.hidden) {
      cerrarModalEliminacion();
    }
  });
}());
