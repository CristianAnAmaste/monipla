document.addEventListener('DOMContentLoaded', () => {
  const fundoSelect = document.getElementById('genFundo');
  const campoSelect = document.getElementById('genCampo');
  const variedadSelect = document.getElementById('genVariedad');
  const cuartelSelect = document.getElementById('genCuartel');
  const errorBox = document.getElementById('monitoreo-combos-error');

  if (!fundoSelect || !campoSelect || !variedadSelect || !cuartelSelect) {
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

  const loadCampos = async (selectedValue = '') => {
    const fundoId = fundoSelect.value;

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

  initialize();
});
