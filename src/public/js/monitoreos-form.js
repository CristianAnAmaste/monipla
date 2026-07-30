document.addEventListener('DOMContentLoaded', () => {
  const form = document.getElementById('monitoreo-form');
  const fundoSelect = document.getElementById('genFundo');
  const campoSelect = document.getElementById('genCampo');
  const variedadSelect = document.getElementById('genVariedad');
  const cuartelSelect = document.getElementById('idCatalogoSdp');
  const errorBox = document.getElementById('monitoreo-combos-error');
  const confirmacionInput = document.getElementById('confirmacionResumen');
  const modal = document.getElementById('monitoreo-confirmacion-modal');
  const modalError = document.getElementById('monitoreo-modal-error');
  const modalConfirmButton = document.getElementById('modal-confirmar-submit');
  const closeModalButtons = document.querySelectorAll('[data-close-modal="true"]');
  const trackedFields = form.querySelectorAll('select, input, textarea');

  if (!form || !fundoSelect || !campoSelect || !variedadSelect || !cuartelSelect) {
    return;
  }

  const selectedValues = {
    campo: campoSelect.dataset.selected || '',
    variedad: variedadSelect.dataset.selected || '',
    cuartel: cuartelSelect.dataset.selected || '',
  };

  const setOptions = (select, items, placeholder, selectedValue = '') => {
    const options = [`<option value="">${placeholder}</option>`];

    items.forEach((item) => {
      const isSelected = String(item.value) === String(selectedValue);
      options.push(
        `<option value="${item.value}" ${isSelected ? 'selected' : ''}>${item.label}</option>`
      );
    });

    select.innerHTML = options.join('');
    select.disabled = items.length === 0;
  };

  const resetSelect = (select, placeholder) => {
    select.innerHTML = `<option value="">${placeholder}</option>`;
    select.disabled = true;
  };

  const showError = (message) => {
    errorBox.textContent = message;
    errorBox.hidden = false;
  };

  const hideError = () => {
    errorBox.hidden = true;
    errorBox.textContent = '';
  };

  const showModalError = (message) => {
    if (!modalError) {
      showError(message);
      return;
    }

    modalError.textContent = message;
    modalError.hidden = false;
  };

  const hideModalError = () => {
    if (!modalError) {
      return;
    }

    modalError.hidden = true;
    modalError.textContent = '';
  };

  const fetchOptions = async (url) => {
    const response = await fetch(url, {
      headers: {
        Accept: 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error('No fue posible cargar las opciones dependientes.');
    }

    const payload = await response.json();

    if (!payload.success) {
      throw new Error(payload.message || 'No fue posible cargar las opciones dependientes.');
    }

    return payload.data || [];
  };

  const fetchResumenPrevio = async () => {
    const formData = new FormData(form);
    formData.set('confirmacionResumen', '0');

    const response = await fetch('/monitoreos/api/resumen-previo', {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(Object.fromEntries(formData.entries())),
    });

    const payload = await response.json();

    if (!response.ok || !payload.success) {
      const message = Array.isArray(payload.errors)
        ? payload.errors.join(' ')
        : payload.message || 'No fue posible generar el resumen previo.';

      throw new Error(message);
    }

    return payload.data;
  };

  const formatFecha = (value) => {
    if (!value) {
      return '-';
    }

    const [year, month, day] = value.split('-');

    if (!year || !month || !day) {
      return value;
    }

    return `${day}-${month}-${year}`;
  };

  const setResumenText = (key, value) => {
    const node = document.querySelector(`[data-resumen="${key}"]`);

    if (!node) {
      return;
    }

    node.textContent = value || '-';
  };

  const renderResumen = (resumen) => {
    setResumenText('fundo', resumen.ubicacion?.fundo);
    setResumenText('campo', resumen.ubicacion?.campo);
    setResumenText('variedad', resumen.ubicacion?.variedad);
    setResumenText('cuartel', resumen.ubicacion?.cuartel ? `Cuartel ${resumen.ubicacion.cuartel}` : '-');
    setResumenText('sdp', resumen.resolucion?.sdp);
    setResumenText('csg', resumen.resolucion?.csg);
    setResumenText('trazabilidad', resumen.resolucion?.trazabilidad);
    setResumenText('estructura', resumen.estructura);
    setResumenText('fechaSolicitudMuestra', formatFecha(resumen.fechas?.solicitudMuestra));
    setResumenText('fechaRecepcionMuestra', formatFecha(resumen.fechas?.recepcionMuestra));
    setResumenText('fechaRevisionMuestra', formatFecha(resumen.fechas?.revisionMuestra));
    setResumenText(
      'observacionGeneral',
      resumen.observacionGeneral || 'Sin observacion general registrada.'
    );
  };

  const openModal = () => {
    if (!modal) {
      return;
    }

    modal.classList.remove('is-hidden');
    modal.hidden = false;
    modal.setAttribute('aria-hidden', 'false');
    document.body.classList.add('has-modal-open');
  };

  const closeModal = () => {
    if (!modal) {
      return;
    }

    modal.classList.add('is-hidden');
    modal.hidden = true;
    modal.setAttribute('aria-hidden', 'true');
    document.body.classList.remove('has-modal-open');
    hideModalError();
  };

  const resetConfirmacion = () => {
    if (confirmacionInput) {
      confirmacionInput.value = '0';
    }
  };

  const loadCampos = async (selectedValue = '') => {
    const fundoId = fundoSelect.value;

    resetConfirmacion();

    resetSelect(campoSelect, 'Seleccione primero un fundo');
    resetSelect(variedadSelect, 'Seleccione primero un campo');
    resetSelect(cuartelSelect, 'Seleccione primero una variedad');

    if (!fundoId) {
      return;
    }

    campoSelect.innerHTML = '<option value="">Cargando campos...</option>';

    const campos = await fetchOptions(`/monitoreos/api/campos/${encodeURIComponent(fundoId)}`);
    setOptions(campoSelect, campos, 'Seleccione un campo', selectedValue);
  };

  const loadVariedades = async (selectedValue = '') => {
    const fundoId = fundoSelect.value;
    const campoId = campoSelect.value;

    resetConfirmacion();

    resetSelect(variedadSelect, 'Seleccione primero un campo');
    resetSelect(cuartelSelect, 'Seleccione primero una variedad');

    if (!fundoId || !campoId) {
      return;
    }

    variedadSelect.innerHTML = '<option value="">Cargando variedades...</option>';

    const variedades = await fetchOptions(
      `/monitoreos/api/variedades/${encodeURIComponent(fundoId)}/${encodeURIComponent(campoId)}`
    );

    setOptions(variedadSelect, variedades, 'Seleccione una variedad', selectedValue);
  };

  const loadCuarteles = async (selectedValue = '') => {
    const fundoId = fundoSelect.value;
    const campoId = campoSelect.value;
    const variedadId = variedadSelect.value;

    resetConfirmacion();

    resetSelect(cuartelSelect, 'Seleccione primero una variedad');

    if (!fundoId || !campoId || !variedadId) {
      return;
    }

    cuartelSelect.innerHTML = '<option value="">Cargando cuarteles...</option>';

    const cuarteles = await fetchOptions(
      `/monitoreos/api/cuarteles/${encodeURIComponent(fundoId)}/${encodeURIComponent(campoId)}/${encodeURIComponent(variedadId)}`
    );

    setOptions(cuartelSelect, cuarteles, 'Seleccione un cuartel', selectedValue);
  };

  const initialize = async () => {
    try {
      hideError();

      if (!fundoSelect.value) {
        return;
      }

      await loadCampos(selectedValues.campo);

      if (!campoSelect.value) {
        return;
      }

      await loadVariedades(selectedValues.variedad);

      if (!variedadSelect.value) {
        return;
      }

      await loadCuarteles(selectedValues.cuartel);
    } catch (error) {
      showError(error.message);
    }
  };

  fundoSelect.addEventListener('change', async () => {
    try {
      hideError();
      await loadCampos();
    } catch (error) {
      showError(error.message);
    }
  });

  campoSelect.addEventListener('change', async () => {
    try {
      hideError();
      await loadVariedades();
    } catch (error) {
      showError(error.message);
    }
  });

  variedadSelect.addEventListener('change', async () => {
    try {
      hideError();
      await loadCuarteles();
    } catch (error) {
      showError(error.message);
    }
  });

  closeModalButtons.forEach((button) => {
    button.addEventListener('click', closeModal);
  });

  trackedFields.forEach((field) => {
    field.addEventListener('change', resetConfirmacion);
    field.addEventListener('input', resetConfirmacion);
  });

  if (modal) {
    closeModal();

    modal.addEventListener('click', (event) => {
      if (event.target === modal) {
        closeModal();
      }
    });
  }

  if (modalConfirmButton) {
    modalConfirmButton.addEventListener('click', () => {
      if (confirmacionInput) {
        confirmacionInput.value = '1';
      }

      closeModal();
      form.submit();
    });
  }

  form.addEventListener('submit', async (event) => {
    if (confirmacionInput && confirmacionInput.value === '1') {
      return;
    }

    event.preventDefault();
    hideError();
    hideModalError();

    try {
      const resumen = await fetchResumenPrevio();
      renderResumen(resumen);
      openModal();
    } catch (error) {
      showError(error.message);
    }
  });

  initialize();
});
