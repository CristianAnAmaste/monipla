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
  const validationPanel = document.getElementById('resultados-validacion-panel');
  const validationList = document.getElementById('resultados-validacion-lista');
  const imageInputs = Array.from(document.querySelectorAll('[data-image-input]'));
  const removeImageButtons = Array.from(document.querySelectorAll('[data-action="remove-image"]'));
  const imageObjectUrls = new Map();
  const allowedImageTypes = new Set(['image/jpeg', 'image/png', 'image/webp']);
  const maxOriginalImageBytes = 8 * 1024 * 1024;

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

  const formatBytes = (bytes) => {
    if (!Number.isFinite(bytes)) {
      return '';
    }

    if (bytes >= 1024 * 1024) {
      return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
    }

    return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  };

  const getSelectedMode = () => {
    const selectedMode = form.querySelector('input[name="modoResultado"]:checked');
    return selectedMode?.value || 'CON_PLAGAS';
  };

  const syncStateFromDom = () => {
    state.modoResultado = getSelectedMode();
    state.observacionResultado = observacionResultadoInput?.value.trim() || '';
    state.resultados = Array.from(filasContainer.querySelectorAll('[data-row-index]')).map((row, rowIndex) => ({
      numeroFila: rowIndex + 1,
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

  const optionValues = {
    plagas: new Set((opciones.plagas || []).map((item) => String(item.value))),
    estadios: new Set((opciones.estadios || []).map((item) => String(item.value))),
    estados: new Set((opciones.estados || []).map((item) => String(item.value))),
  };

  const isRowEmpty = (fila) => !fila.idPlaga
    && !fila.idEstadio
    && !fila.idEstadoEjemplar
    && !String(fila.cantidad || '').trim();

  const validateCantidad = (cantidad) => {
    const rawValue = String(cantidad || '').trim();

    if (!rawValue) {
      return 'debe ingresar una cantidad.';
    }

    if (!/^\d+$/.test(rawValue)) {
      return 'la cantidad debe ser un entero positivo.';
    }

    if (Number.parseInt(rawValue, 10) <= 0) {
      return 'la cantidad debe ser mayor a 0 o elimine la fila.';
    }

    return '';
  };

  const validateRows = () => {
    const errors = [];
    const validRows = [];
    const seenKeys = new Map();

    state.resultados.forEach((fila, rowIndex) => {
      const rowNumber = rowIndex + 1;
      const rowErrors = [];
      const invalidFields = [];

      if (isRowEmpty(fila)) {
        return;
      }

      if (!fila.idPlaga) {
        rowErrors.push(`Fila ${rowNumber}: seleccione una plaga o elimine la fila.`);
        invalidFields.push('idPlaga');
      } else if (!optionValues.plagas.has(String(fila.idPlaga))) {
        rowErrors.push(`Fila ${rowNumber}: la plaga seleccionada no esta disponible.`);
        invalidFields.push('idPlaga');
      }

      if (!fila.idEstadio) {
        rowErrors.push(`Fila ${rowNumber}: debe seleccionar un estadio.`);
        invalidFields.push('idEstadio');
      } else if (!optionValues.estadios.has(String(fila.idEstadio))) {
        rowErrors.push(`Fila ${rowNumber}: el estadio seleccionado no esta disponible.`);
        invalidFields.push('idEstadio');
      }

      if (!fila.idEstadoEjemplar) {
        rowErrors.push(`Fila ${rowNumber}: debe seleccionar un estado.`);
        invalidFields.push('idEstadoEjemplar');
      } else if (!optionValues.estados.has(String(fila.idEstadoEjemplar))) {
        rowErrors.push(`Fila ${rowNumber}: el estado seleccionado no esta disponible.`);
        invalidFields.push('idEstadoEjemplar');
      }

      const cantidadError = validateCantidad(fila.cantidad);

      if (cantidadError) {
        rowErrors.push(`Fila ${rowNumber}: ${cantidadError}`);
        invalidFields.push('cantidad');
      }

      if (rowErrors.length === 0) {
        const key = `${fila.idPlaga}:${fila.idEstadio}:${fila.idEstadoEjemplar}`;

        if (seenKeys.has(key)) {
          rowErrors.push(`Fila ${rowNumber}: ya existe un conteo para esta misma plaga, estadio y estado.`);
          invalidFields.push('idPlaga', 'idEstadio', 'idEstadoEjemplar');
        } else {
          seenKeys.set(key, rowNumber);
          validRows.push({
            ...fila,
            cantidad: String(Number.parseInt(fila.cantidad, 10)),
          });
        }
      }

      rowErrors.forEach((message) => {
        errors.push({
          rowIndex,
          fields: Array.from(new Set(invalidFields)),
          message,
        });
      });
    });

    if (validRows.length === 0 && errors.length === 0) {
      errors.push({
        rowIndex: 0,
        fields: [],
        message: 'Debe ingresar al menos una fila completa de hallazgo.',
      });
    }

    return {
      errors,
      validRows,
      filasConDatos: state.resultados.filter((fila) => !isRowEmpty(fila)).length,
    };
  };

  const clearRowErrors = () => {
    filasContainer.querySelectorAll('.resultado-row-error').forEach((row) => {
      row.classList.remove('resultado-row-error');
      row.querySelectorAll('.campo-error').forEach((field) => field.classList.remove('campo-error'));
      row.querySelectorAll('.mensaje-error-fila').forEach((message) => message.remove());
    });
  };

  const renderValidationErrors = (errors) => {
    clearRowErrors();

    if (!validationPanel || !validationList) {
      return;
    }

    if (errors.length === 0) {
      validationPanel.hidden = true;
      validationList.innerHTML = '';
      return;
    }

    validationPanel.hidden = false;
    validationList.innerHTML = errors
      .map((error) => `<li>${escapeHtml(error.message)}</li>`)
      .join('');

    errors.forEach((error) => {
      const row = filasContainer.querySelector(`[data-row-index="${error.rowIndex}"]`);

      if (!row) {
        return;
      }

      row.classList.add('resultado-row-error');

      error.fields.forEach((fieldName) => {
        const field = row.querySelector(`[data-field="${fieldName}"]`);

        if (field) {
          field.classList.add('campo-error');
        }
      });

      const lastCell = row.querySelector('td:last-child');

      if (lastCell && !lastCell.querySelector('.mensaje-error-fila')) {
        const message = document.createElement('p');
        message.className = 'mensaje-error-fila';
        message.textContent = error.message;
        lastCell.appendChild(message);
      }
    });
  };

  const clearImageErrors = () => {
    document.querySelectorAll('.evidencia-card-error').forEach((card) => {
      card.classList.remove('evidencia-card-error');
      card.querySelectorAll('.campo-error').forEach((field) => field.classList.remove('campo-error'));
      card.querySelectorAll('.mensaje-error-fila').forEach((message) => message.remove());
    });
  };

  const markImageError = (slot, message) => {
    const card = document.querySelector(`[data-evidencia-slot="${slot}"]`);
    const input = document.querySelector(`[data-image-input="${slot}"]`);

    if (!card) {
      return;
    }

    card.classList.add('evidencia-card-error');

    if (input) {
      input.classList.add('campo-error');
    }

    const errorNode = document.createElement('p');
    errorNode.className = 'mensaje-error-fila';
    errorNode.textContent = message;
    card.appendChild(errorNode);
  };

  const renderImagePreview = (input) => {
    const slot = input.dataset.imageInput;
    const preview = document.querySelector(`[data-image-preview="${slot}"]`);
    const meta = document.querySelector(`[data-image-meta="${slot}"]`);
    const removeButton = document.querySelector(`[data-action="remove-image"][data-slot="${slot}"]`);
    const file = input.files && input.files[0];

    if (imageObjectUrls.has(slot)) {
      URL.revokeObjectURL(imageObjectUrls.get(slot));
      imageObjectUrls.delete(slot);
    }

    if (!file) {
      if (preview) {
        preview.innerHTML = '<span>Sin imagen seleccionada</span>';
      }

      if (meta) {
        meta.textContent = '';
      }

      if (removeButton) {
        removeButton.disabled = true;
      }

      return;
    }

    const objectUrl = URL.createObjectURL(file);
    imageObjectUrls.set(slot, objectUrl);

    if (preview) {
      preview.innerHTML = `<img src="${objectUrl}" alt="Vista previa evidencia ${escapeHtml(slot)}">`;
    }

    if (meta) {
      meta.textContent = `${file.name} - ${formatBytes(file.size)}`;
    }

    if (removeButton) {
      removeButton.disabled = false;
    }
  };

  const clearImageInput = (slot) => {
    const input = document.querySelector(`[data-image-input="${slot}"]`);

    if (input) {
      input.value = '';
      renderImagePreview(input);
    }
  };

  const validateImages = () => {
    const errors = [];
    let totalImages = 0;

    imageInputs.forEach((input) => {
      const slot = input.dataset.imageInput;
      const file = input.files && input.files[0];
      const card = document.querySelector(`[data-evidencia-slot="${slot}"]`);
      const comment = card?.querySelector('textarea')?.value.trim() || '';

      if (comment.length > 400) {
        errors.push({
          message: `Evidencia ${slot}: el comentario no puede superar los 400 caracteres.`,
          slot,
        });
      }

      if (!file) {
        return;
      }

      totalImages += 1;

      if (!allowedImageTypes.has(file.type)) {
        errors.push({
          message: `Evidencia ${slot}: solo se permiten imagenes JPG, PNG o WebP.`,
          slot,
        });
      }

      if (file.size > maxOriginalImageBytes) {
        errors.push({
          message: `Evidencia ${slot}: la imagen supera el maximo de 8 MB permitido.`,
          slot,
        });
      }
    });

    if (totalImages > 3) {
      errors.push({
        message: 'Puede adjuntar hasta 3 imagenes de evidencia.',
        slot: null,
      });
    }

    return {
      errors,
      totalImages,
    };
  };

  const renderImageErrors = (errors) => {
    clearImageErrors();
    errors.forEach((error) => {
      if (error.slot) {
        markImageError(error.slot, error.message);
      }
    });
  };

  const focusFirstInvalidField = (errors) => {
    const firstError = errors.find((error) => error.fields.length > 0) || errors[0];

    if (!firstError) {
      return;
    }

    const row = filasContainer.querySelector(`[data-row-index="${firstError.rowIndex}"]`);
    const fieldName = firstError.fields[0];
    const field = fieldName ? row?.querySelector(`[data-field="${fieldName}"]`) : row?.querySelector('select, input');

    if (field) {
      field.focus();
    }
  };

  const updateTotals = () => {
    if (!totalsList) {
      return;
    }

    const totals = new Map();
    const validation = validateRows();

    validation.validRows.forEach((fila) => {
      const cantidad = Number.parseInt(fila.cantidad, 10);
      totals.set(fila.idPlaga, (totals.get(fila.idPlaga) || 0) + cantidad);
    });

    const hasIncompleteRows = validation.filasConDatos > validation.validRows.length;

    if (totals.size === 0) {
      totalsList.innerHTML = hasIncompleteRows
        ? '<li>Sin filas completas para totalizar.</li><li>Hay filas incompletas que no se incluyen en el total.</li>'
        : '<li>Sin cantidades ingresadas.</li>';
      return;
    }

    const totalItems = Array.from(totals.entries())
      .map(([idPlaga, total]) => `<li>${escapeHtml(getPlagaLabel(idPlaga))}: ${total}</li>`)
      .join('');

    totalsList.innerHTML = hasIncompleteRows
      ? `${totalItems}<li>Hay filas incompletas que no se incluyen en el total.</li>`
      : totalItems;
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

    const validation = validateRows();

    return {
      modoResultado: 'CON_PLAGAS',
      observacionResultado: '',
      resultados: validation.validRows,
      plagas: [],
    };
  };

  filasContainer.addEventListener('input', () => {
    syncStateFromDom();
    renderValidationErrors([]);
    updateTotals();
  });

  filasContainer.addEventListener('change', () => {
    syncStateFromDom();
    renderValidationErrors([]);
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

  imageInputs.forEach((input) => {
    input.addEventListener('change', () => {
      clearImageErrors();
      renderValidationErrors([]);
      renderImagePreview(input);

      const validation = validateImages();
      if (validation.errors.length > 0) {
        renderValidationErrors(validation.errors);
        renderImageErrors(validation.errors);
      }
    });
  });

  removeImageButtons.forEach((button) => {
    button.addEventListener('click', () => {
      clearImageInput(button.dataset.slot);
      clearImageErrors();
      renderValidationErrors([]);
    });
  });

  form.addEventListener('submit', (event) => {
    syncStateFromDom();
    const imageValidation = validateImages();

    if (state.modoResultado === 'CON_PLAGAS') {
      const validation = validateRows();
      const allErrors = [...validation.errors, ...imageValidation.errors];

      console.info('[MONIPLA][RESULTADOS][FRONT_VALIDACION]', {
        totalFilas: state.resultados.length,
        filasConDatos: validation.filasConDatos,
        filasValidas: validation.validRows.length,
        filasInvalidas: validation.errors.length,
        imagenes: imageValidation.totalImages,
      });

      if (allErrors.length > 0) {
        event.preventDefault();
        renderValidationErrors(allErrors);
        renderImageErrors(imageValidation.errors);
        updateTotals();
        focusFirstInvalidField(validation.errors);
        return;
      }
    } else if (imageValidation.errors.length > 0) {
      event.preventDefault();
      renderValidationErrors(imageValidation.errors);
      renderImageErrors(imageValidation.errors);
      const firstError = imageValidation.errors.find((error) => error.slot);
      const input = firstError ? document.querySelector(`[data-image-input="${firstError.slot}"]`) : null;

      if (input) {
        input.focus();
      }

      return;
    }

    renderValidationErrors([]);
    renderImageErrors([]);
    payloadInput.value = JSON.stringify(getCleanPayload());
  });

  ensureState();
  renderMode();
});
