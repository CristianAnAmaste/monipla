document.addEventListener('DOMContentLoaded', () => {
  const form = document.getElementById('monitoreo-resultados-form');
  const filasContainer = document.getElementById('resultados-filas-container');
  const payloadInput = document.getElementById('resultadosPayload');
  const addRowButton = document.getElementById('agregar-fila');
  const sinPlagasPanel = document.getElementById('sin-plagas-panel');
  const hallazgosPanel = document.getElementById('hallazgos-panel');
  const observacionResultadoInput = document.getElementById('observacionResultado');
  const totalsList = document.getElementById('total-por-plaga');
  const submitButton = document.getElementById('guardar-resultados');

  if (!form || !filasContainer || !payloadInput || !addRowButton) {
    return;
  }

  const readJson = (id, fallback) => {
    const node = document.getElementById(id);

    if (!node) {
      return fallback;
    }

    try {
      return JSON.parse(node.textContent);
    } catch (error) {
      return fallback;
    }
  };

  const opciones = readJson('resultados-opciones-json', {
    plagas: [],
    estadios: [],
    estados: [],
  });

  let state = readJson('resultados-values-json', {
    modoResultado: 'CON_PLAGAS',
    observacionResultado: '',
    resultados: [],
  });

  const getDefaultRow = () => ({
    idPlaga: '',
    idEstadio: '',
    idEstadoEjemplar: '',
    cantidad: '',
  });

  const ensureState = () => {
    if (state.modoResultado !== 'SIN_PLAGAS') {
      state.modoResultado = 'CON_PLAGAS';
    }

    if (!Array.isArray(state.resultados)) {
      state.resultados = [];
    }

    if (state.resultados.length === 0) {
      state.resultados = [getDefaultRow()];
    }

    state.resultados = state.resultados.map((fila) => ({
      idPlaga: fila.idPlaga || '',
      idEstadio: fila.idEstadio || '',
      idEstadoEjemplar: fila.idEstadoEjemplar || '',
      cantidad: fila.cantidad || '',
    }));
  };

  const escapeHtml = (value) => String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');

  const renderOptions = (items, selectedValue, placeholder) => {
    const options = [`<option value="">${escapeHtml(placeholder)}</option>`];

    items.forEach((item) => {
      const selected = String(item.value) === String(selectedValue) ? 'selected' : '';
      options.push(`<option value="${escapeHtml(item.value)}" ${selected}>${escapeHtml(item.label)}</option>`);
    });

    return options.join('');
  };

  const getSelectedMode = () => {
    const selectedMode = form.querySelector('input[name="modoResultado"]:checked');
    return selectedMode?.value || 'CON_PLAGAS';
  };

  const syncStateFromDom = () => {
    state.modoResultado = getSelectedMode();
    state.observacionResultado = observacionResultadoInput?.value.trim() || '';
    state.resultados = Array.from(filasContainer.querySelectorAll('[data-row-index]')).map((row) => ({
      idPlaga: row.querySelector('[data-field="idPlaga"]')?.value || '',
      idEstadio: row.querySelector('[data-field="idEstadio"]')?.value || '',
      idEstadoEjemplar: row.querySelector('[data-field="idEstadoEjemplar"]')?.value || '',
      cantidad: row.querySelector('[data-field="cantidad"]')?.value.trim() || '',
    }));
  };

  const getPlagaLabel = (idPlaga) => {
    const plaga = (opciones.plagas || []).find((item) => String(item.value) === String(idPlaga));
    return plaga ? plaga.label : 'Sin plaga seleccionada';
  };

  const updateTotals = () => {
    if (!totalsList) {
      return;
    }

    const totals = new Map();

    state.resultados.forEach((fila) => {
      if (!fila.idPlaga || !/^\d+$/.test(String(fila.cantidad || ''))) {
        return;
      }

      const cantidad = Number.parseInt(fila.cantidad, 10);

      if (cantidad <= 0) {
        return;
      }

      totals.set(fila.idPlaga, (totals.get(fila.idPlaga) || 0) + cantidad);
    });

    if (totals.size === 0) {
      totalsList.innerHTML = '<li>Sin cantidades ingresadas.</li>';
      return;
    }

    totalsList.innerHTML = Array.from(totals.entries())
      .map(([idPlaga, total]) => `<li>${escapeHtml(getPlagaLabel(idPlaga))}: ${total}</li>`)
      .join('');
  };

  const renderRows = () => {
    ensureState();

    filasContainer.innerHTML = state.resultados.map((fila, rowIndex) => `
      <tr data-row-index="${rowIndex}">
        <td>
          <select name="resultados[${rowIndex}][idPlaga]" data-field="idPlaga">
            ${renderOptions(opciones.plagas || [], fila.idPlaga, 'Seleccione plaga')}
          </select>
        </td>
        <td>
          <select name="resultados[${rowIndex}][idEstadio]" data-field="idEstadio">
            ${renderOptions(opciones.estadios || [], fila.idEstadio, 'Seleccione estadio')}
          </select>
        </td>
        <td>
          <select name="resultados[${rowIndex}][idEstadoEjemplar]" data-field="idEstadoEjemplar">
            ${renderOptions(opciones.estados || [], fila.idEstadoEjemplar, 'Seleccione estado')}
          </select>
        </td>
        <td>
          <input name="resultados[${rowIndex}][cantidad]" data-field="cantidad" type="number" min="0" step="1" value="${escapeHtml(fila.cantidad)}">
        </td>
        <td>
          <button class="button button-secondary button-small" type="button" data-action="remove-row" ${state.resultados.length === 1 ? 'disabled' : ''}>Quitar</button>
        </td>
      </tr>
    `).join('');

    updateTotals();
  };

  const renderMode = () => {
    const isSinPlagas = state.modoResultado === 'SIN_PLAGAS';

    if (sinPlagasPanel) {
      sinPlagasPanel.hidden = !isSinPlagas;
    }

    if (hallazgosPanel) {
      hallazgosPanel.hidden = isSinPlagas;
    }

    if (submitButton) {
      submitButton.textContent = isSinPlagas ? 'Guardar sin plagas' : 'Guardar resultados';
    }

    if (!isSinPlagas) {
      renderRows();
    }
  };

  const getCleanPayload = () => {
    syncStateFromDom();

    if (state.modoResultado === 'SIN_PLAGAS') {
      return {
        modoResultado: 'SIN_PLAGAS',
        observacionResultado: state.observacionResultado,
        resultados: [],
        plagas: [],
      };
    }

    return {
      modoResultado: 'CON_PLAGAS',
      observacionResultado: '',
      resultados: state.resultados.filter((fila) => (
        fila.idPlaga || fila.idEstadio || fila.idEstadoEjemplar || fila.cantidad
      )),
      plagas: [],
    };
  };

  filasContainer.addEventListener('input', () => {
    syncStateFromDom();
    updateTotals();
  });

  filasContainer.addEventListener('change', () => {
    syncStateFromDom();
    updateTotals();
  });

  filasContainer.addEventListener('click', (event) => {
    const button = event.target.closest('button[data-action="remove-row"]');

    if (!button) {
      return;
    }

    syncStateFromDom();

    const row = button.closest('[data-row-index]');
    const rowIndex = Number.parseInt(row?.dataset.rowIndex, 10);

    if (state.resultados.length > 1) {
      state.resultados.splice(rowIndex, 1);
    }

    renderRows();
  });

  addRowButton.addEventListener('click', () => {
    syncStateFromDom();
    state.resultados.push(getDefaultRow());
    renderRows();
  });

  form.querySelectorAll('input[name="modoResultado"]').forEach((input) => {
    input.addEventListener('change', () => {
      syncStateFromDom();
      renderMode();
    });
  });

  if (observacionResultadoInput) {
    observacionResultadoInput.addEventListener('input', syncStateFromDom);
  }

  form.addEventListener('submit', () => {
    payloadInput.value = JSON.stringify(getCleanPayload());
  });

  ensureState();
  renderMode();
});
