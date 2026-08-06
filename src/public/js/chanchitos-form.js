document.addEventListener('DOMContentLoaded', () => {
  const form = document.getElementById('chanchitos-form');
  const fundoSelect = document.getElementById('genFundo');
  const campoSelect = document.getElementById('genCampo');
  const variedadSelect = document.getElementById('genVariedad');
  const cuartelSelect = document.getElementById('idCatalogoSdp');
  const errorBox = document.getElementById('chanchitos-combos-error');
  const submitButton = document.getElementById('chanchitos-submit');

  if (!form || !fundoSelect || !campoSelect || !variedadSelect || !cuartelSelect) {
    return;
  }

  const selected = {
    campo: campoSelect.dataset.selected || '',
    variedad: variedadSelect.dataset.selected || '',
    cuartel: cuartelSelect.dataset.selected || '',
  };

  const showError = (message) => {
    errorBox.textContent = message;
    errorBox.hidden = false;
  };

  const clearError = () => {
    errorBox.textContent = '';
    errorBox.hidden = true;
  };

  const resetSelect = (select, placeholder) => {
    select.innerHTML = `<option value="">${placeholder}</option>`;
    select.disabled = true;
  };

  const setOptions = (select, items, placeholder, selectedValue = '') => {
    select.innerHTML = [
      `<option value="">${placeholder}</option>`,
      ...items.map((item) => (
        `<option value="${item.value}" ${String(item.value) === String(selectedValue) ? 'selected' : ''}>${item.label}</option>`
      )),
    ].join('');
    select.disabled = items.length === 0;
  };

  const fetchOptions = async (url) => {
    const response = await fetch(url, { headers: { Accept: 'application/json' } });

    if (!response.ok) {
      throw new Error('No fue posible cargar las opciones dependientes.');
    }

    const payload = await response.json();

    if (!payload.success) {
      throw new Error(payload.message || 'No fue posible cargar las opciones dependientes.');
    }

    return payload.data || [];
  };

  const loadCampos = async (selectedValue = '') => {
    resetSelect(campoSelect, 'Seleccione primero un fundo');
    resetSelect(variedadSelect, 'Seleccione primero un campo');
    resetSelect(cuartelSelect, 'Seleccione primero una variedad');

    if (!fundoSelect.value) {
      return;
    }

    campoSelect.innerHTML = '<option value="">Cargando campos...</option>';
    setOptions(
      campoSelect,
      await fetchOptions(`/monitoreos/api/campos/${encodeURIComponent(fundoSelect.value)}`),
      'Seleccione un campo',
      selectedValue
    );
  };

  const loadVariedades = async (selectedValue = '') => {
    resetSelect(variedadSelect, 'Seleccione primero un campo');
    resetSelect(cuartelSelect, 'Seleccione primero una variedad');

    if (!fundoSelect.value || !campoSelect.value) {
      return;
    }

    variedadSelect.innerHTML = '<option value="">Cargando variedades...</option>';
    setOptions(
      variedadSelect,
      await fetchOptions(`/monitoreos/api/variedades/${encodeURIComponent(fundoSelect.value)}/${encodeURIComponent(campoSelect.value)}`),
      'Seleccione una variedad',
      selectedValue
    );
  };

  const loadCuarteles = async (selectedValue = '') => {
    resetSelect(cuartelSelect, 'Seleccione primero una variedad');

    if (!fundoSelect.value || !campoSelect.value || !variedadSelect.value) {
      return;
    }

    cuartelSelect.innerHTML = '<option value="">Cargando cuarteles...</option>';
    setOptions(
      cuartelSelect,
      await fetchOptions(`/monitoreos/api/cuarteles/${encodeURIComponent(fundoSelect.value)}/${encodeURIComponent(campoSelect.value)}/${encodeURIComponent(variedadSelect.value)}`),
      'Seleccione un cuartel',
      selectedValue
    );
  };

  fundoSelect.addEventListener('change', () => loadCampos().catch((error) => showError(error.message)));
  campoSelect.addEventListener('change', () => loadVariedades().catch((error) => showError(error.message)));
  variedadSelect.addEventListener('change', () => loadCuarteles().catch((error) => showError(error.message)));

  form.addEventListener('submit', () => {
    clearError();

    if (submitButton) {
      submitButton.disabled = true;
      submitButton.textContent = 'Guardando...';
    }
  });

  (async () => {
    try {
      if (!fundoSelect.value) {
        return;
      }

      await loadCampos(selected.campo);

      if (!campoSelect.value) {
        return;
      }

      await loadVariedades(selected.variedad);

      if (variedadSelect.value) {
        await loadCuarteles(selected.cuartel);
      }
    } catch (error) {
      showError(error.message);
    }
  })();
});
