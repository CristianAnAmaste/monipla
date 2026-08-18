document.addEventListener('DOMContentLoaded', () => {
  const form = document.getElementById('chanchitos-form');
  const fundoSelect = document.getElementById('genFundo');
  const campoSelect = document.getElementById('genCampo');
  const variedadSelect = document.getElementById('genVariedad');
  const cuartelSelect = document.getElementById('idCatalogoSdp');
  const errorBox = document.getElementById('chanchitos-combos-error');
  const submitButton = document.getElementById('chanchitos-submit');
  const imagenesInput = document.getElementById('imagenes');
  const imagenesCards = document.getElementById('imagenes-cards');
  const imagenesError = document.getElementById('imagenes-error');

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

  const tiposImagenPermitidos = new Set(['image/jpeg', 'image/png', 'image/webp']);
  const maximoBytesImagen = 10 * 1024 * 1024;
  const archivosSeleccionados = [null, null, null];
  const urlsPrevisualizacion = [null, null, null];
  let slotSeleccionado = 0;

  const formatoBytes = (bytes) => {
    if (bytes < 1024 * 1024) return `${Math.ceil(bytes / 1024)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const mostrarErrorImagenes = (mensaje = '') => {
    if (!imagenesError) return;
    imagenesError.textContent = mensaje;
    imagenesError.hidden = !mensaje;
  };

  const actualizarInputImagenes = () => {
    if (!imagenesInput) return;
    const transferencia = new DataTransfer();
    archivosSeleccionados.filter(Boolean).forEach((archivo) => transferencia.items.add(archivo));
    imagenesInput.files = transferencia.files;
  };

  const liberarPrevisualizacion = (slot) => {
    if (urlsPrevisualizacion[slot]) {
      URL.revokeObjectURL(urlsPrevisualizacion[slot]);
      urlsPrevisualizacion[slot] = null;
    }
  };

  const renderTarjetaImagen = (slot) => {
    if (!imagenesCards) return;
    const tarjeta = imagenesCards.querySelector(`[data-slot="${slot}"]`);
    if (!tarjeta) return;

    const archivo = archivosSeleccionados[slot];
    const preview = tarjeta.querySelector('[data-image]');
    const placeholder = tarjeta.querySelector('[data-placeholder]');
    const nombre = tarjeta.querySelector('[data-name]');
    const seleccionar = tarjeta.querySelector('[data-image-action="select"]');
    const cambiar = tarjeta.querySelector('[data-image-action="change"]');
    const quitar = tarjeta.querySelector('[data-image-action="remove"]');

    if (!archivo) {
      preview.hidden = true;
      preview.removeAttribute('src');
      placeholder.hidden = false;
      nombre.textContent = 'Sin archivo seleccionado';
      seleccionar.hidden = false;
      cambiar.hidden = true;
      quitar.hidden = true;
      return;
    }

    if (!urlsPrevisualizacion[slot]) {
      urlsPrevisualizacion[slot] = URL.createObjectURL(archivo);
    }
    preview.src = urlsPrevisualizacion[slot];
    preview.alt = `Vista previa de ${archivo.name}`;
    preview.hidden = false;
    placeholder.hidden = true;
    nombre.textContent = `${archivo.name} · ${formatoBytes(archivo.size)}`;
    seleccionar.hidden = true;
    cambiar.hidden = false;
    quitar.hidden = false;
  };

  const renderTarjetasImagen = () => [0, 1, 2].forEach(renderTarjetaImagen);

  const quitarImagen = (slot) => {
    liberarPrevisualizacion(slot);
    archivosSeleccionados[slot] = null;
    actualizarInputImagenes();
    mostrarErrorImagenes('');
    renderTarjetaImagen(slot);
  };

  const validarImagenes = (archivos) => {
    if (archivos.some((archivo) => !tiposImagenPermitidos.has(archivo.type))) {
      return 'La imagen debe ser JPEG, PNG o WebP.';
    }
    if (archivos.some((archivo) => archivo.size > maximoBytesImagen)) {
      return 'La imagen supera el máximo de 10 MB.';
    }
    return '';
  };

  const obtenerSlotsDisponibles = (slotInicial) => {
    const orden = [slotInicial, ...[0, 1, 2].filter((slot) => slot !== slotInicial && !archivosSeleccionados[slot])];
    return orden.filter((slot, index) => orden.indexOf(slot) === index);
  };

  if (imagenesInput && imagenesCards) {
    imagenesCards.addEventListener('click', (event) => {
      const boton = event.target.closest('[data-image-action]');
      if (!boton) return;
      const tarjeta = boton.closest('[data-slot]');
      const slot = Number(tarjeta.dataset.slot);

      if (boton.dataset.imageAction === 'remove') {
        quitarImagen(slot);
        return;
      }

      slotSeleccionado = slot;
      imagenesInput.click();
    });

    imagenesInput.addEventListener('change', () => {
      const nuevos = Array.from(imagenesInput.files || []);
      const error = validarImagenes(nuevos);
      const slotsDisponibles = obtenerSlotsDisponibles(slotSeleccionado);

      if (error) {
        mostrarErrorImagenes(error);
        imagenesInput.value = '';
      } else if (nuevos.length > slotsDisponibles.length) {
        mostrarErrorImagenes('Solo puedes adjuntar hasta tres imágenes.');
        imagenesInput.value = '';
      } else {
        nuevos.forEach((archivo, index) => {
          const slot = slotsDisponibles[index];
          liberarPrevisualizacion(slot);
          archivosSeleccionados[slot] = archivo;
        });
        imagenesInput.value = '';
        actualizarInputImagenes();
        mostrarErrorImagenes('');
        renderTarjetasImagen();
      }
    });

    window.addEventListener('beforeunload', () => urlsPrevisualizacion.forEach(liberarPrevisualizacion));
    renderTarjetasImagen();
  }

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
