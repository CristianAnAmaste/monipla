function construirUrlPdfChanchitos(valores = {}) {
  const query = new URLSearchParams();
  ['fechaDesde', 'fechaHasta', 'genFundo', 'genCampo', 'genVariedad', 'idCatalogoSdp', 'idMonitoreador', 'idEstadoFenologico', 'deteccion'].forEach((nombre) => {
    const valor = String(valores[nombre] ?? '').trim();
    if (valor) query.set(nombre, valor);
  });
  const serializado = query.toString();
  return `/chanchitos/pdf/general${serializado ? `?${serializado}` : ''}`;
}

if (typeof module !== 'undefined') module.exports = { construirUrlPdfChanchitos };

if (typeof document !== 'undefined') document.addEventListener('DOMContentLoaded', () => {
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
