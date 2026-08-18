import { useEffect, useRef, useState } from 'react';
import { ClipboardPlus, RefreshCw } from 'lucide-react';
import { ApiClientError } from '../../api/apiClient';
import { obtenerFormularioChanchitos } from '../../api/chanchitosApi';
import DatosMonitoreoSection from '../../components/chanchitos/DatosMonitoreoSection';
import DatosOrigenSection from '../../components/chanchitos/DatosOrigenSection';
import EvidenciaObservacionesSection from '../../components/chanchitos/EvidenciaObservacionesSection';
import PosicionesMonitoreoGrid from '../../components/chanchitos/PosicionesMonitoreoGrid';
import ResumenMonitoreo from '../../components/chanchitos/ResumenMonitoreo';
import { useChanchitosCatalogos } from '../../hooks/useChanchitosCatalogos';
import { useChanchitosForm } from '../../hooks/useChanchitosForm';
import { useChanchitosImages } from '../../hooks/useChanchitosImages';

function getRequestErrorMessage(error) {
  if (error instanceof ApiClientError) {
    if (error.status === 401) return 'La sesión expiró. Redirigiendo al inicio de sesión.';
    if (error.status === 403) return 'No tiene permisos para realizar esta acción.';
    if (error.status === 409) return 'La información cambió antes de guardarse. Revise el formulario e intente nuevamente.';
    if (error.status === 500) return 'No fue posible completar la operación. Intente nuevamente.';
  }

  return error.message || 'No fue posible completar la operación.';
}

function NuevoMonitoreoChanchitosPage() {
  const [formData, setFormData] = useState({ status: 'loading', data: null });
  const [requestError, setRequestError] = useState(null);
  const [retry, setRetry] = useState(0);
  const formRef = useRef(null);
  const catalogos = useChanchitosCatalogos();
  const form = useChanchitosForm();
  const images = useChanchitosImages();

  useEffect(() => {
    const controller = new AbortController();

    async function loadForm() {
      setFormData({ status: 'loading', data: null });
      setRequestError(null);

      try {
        const response = await obtenerFormularioChanchitos(controller.signal);
        setFormData({ status: 'ready', data: response.data });
      } catch (error) {
        if (error.name === 'AbortError') return;
        if (error instanceof ApiClientError && error.status === 401) {
          window.location.assign('/login');
          return;
        }
        setFormData({ status: 'error', data: null });
        setRequestError(getRequestErrorMessage(error));
      }
    }

    loadForm();
    return () => controller.abort();
  }, [retry]);

  useEffect(() => {
    if (!form.firstInvalidField) return;
    formRef.current?.elements.namedItem(form.firstInvalidField)?.focus();
  }, [form.firstInvalidField]);

  const runCatalogRequest = async (operation) => {
    try {
      await operation();
    } catch (error) {
      if (error instanceof ApiClientError && error.status === 401) {
        window.location.assign('/login');
        return;
      }
      setRequestError(getRequestErrorMessage(error));
    }
  };

  const handleFundoChange = (event) => {
    const genFundo = event.target.value;
    form.setManyValues({ genFundo, genCampo: '', genVariedad: '', idCatalogoSdp: '' });
    catalogos.resetFromFundo();
    if (genFundo) runCatalogRequest(() => catalogos.loadCampos(genFundo));
  };

  const handleCampoChange = (event) => {
    const genCampo = event.target.value;
    form.setManyValues({ genCampo, genVariedad: '', idCatalogoSdp: '' });
    catalogos.resetFromCampo();
    if (genCampo) runCatalogRequest(() => catalogos.loadVariedades(form.values.genFundo, genCampo));
  };

  const handleVariedadChange = (event) => {
    const genVariedad = event.target.value;
    form.setManyValues({ genVariedad, idCatalogoSdp: '' });
    catalogos.resetFromVariedad();
    if (genVariedad) runCatalogRequest(() => catalogos.loadCuarteles(form.values.genFundo, form.values.genCampo, genVariedad));
  };

  const handleChange = (event) => form.setFieldValue(event.target.name, event.target.value);

  const handleSubmit = async (event) => {
    event.preventDefault();
    setRequestError(null);

    try {
      const result = await form.submit(images.files);
      if (result?.success) images.clear();
    } catch (error) {
      if (error instanceof ApiClientError && error.status === 401) {
        window.location.assign('/login');
        return;
      }
      setRequestError(getRequestErrorMessage(error));
    }
  };

  if (formData.status === 'loading') {
    return <p className="rounded-lg border border-[#dbe5da] bg-white px-4 py-3 text-sm text-[#425347] shadow-sm">Cargando formulario…</p>;
  }

  if (formData.status === 'error') {
    return (
      <section className="max-w-lg rounded-xl border border-[#dbe5da] bg-white p-6 shadow-sm">
        <h1 className="text-lg font-semibold text-[#1f2922]">No fue posible cargar el formulario</h1>
        <p className="mt-2 text-sm text-[#617064]">{requestError}</p>
        <button type="button" className="mt-5 inline-flex items-center gap-2 rounded-lg bg-[#2f713b] px-4 py-2 text-sm font-semibold text-white hover:bg-[#245c2f]" onClick={() => setRetry((value) => value + 1)}><RefreshCw className="size-4" aria-hidden="true" />Reintentar</button>
      </section>
    );
  }

  const options = formData.data.opciones;

  return (
    <div className="mx-auto w-full max-w-6xl">
      <header className="mb-7 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm font-semibold text-[#4e7f55]">MONITOREO DE CHANCHITO BLANCO</p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight text-[#1f2922] sm:text-3xl">Nuevo monitoreo</h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-[#617064]">Registre la matriz completa de estados y posiciones para el cuartel seleccionado.</p>
        </div>
        <a className="text-sm font-semibold text-[#2f713b] hover:underline" href="/chanchitos/nuevo">Usar formulario EJS</a>
      </header>

      {requestError && <div className="mb-5 rounded-lg border border-[#f2c8c2] bg-[#fff5f3] px-4 py-3 text-sm text-[#8e2e26]" role="alert">{requestError}</div>}
      {form.generalErrors.length > 0 && <div className="mb-5 rounded-lg border border-[#f2c8c2] bg-[#fff5f3] px-4 py-3 text-sm text-[#8e2e26]" role="alert">{form.generalErrors.join(' ')}</div>}
      {form.success && <div className="mb-5 rounded-lg border border-[#b9dcb9] bg-[#eff8ee] px-4 py-3 text-sm text-[#256133]" role="status">Monitoreo guardado correctamente. ID: {form.success.idMonitoreo}.</div>}

      <form ref={formRef} className="space-y-5" onSubmit={handleSubmit} noValidate>
        <DatosOrigenSection values={form.values} fondos={options.fundos} catalogs={catalogos.catalogs} loading={catalogos.loading} errors={form.fieldErrors} onFundoChange={handleFundoChange} onCampoChange={handleCampoChange} onVariedadChange={handleVariedadChange} onCuartelChange={handleChange} />
        <DatosMonitoreoSection values={form.values} estadosFenologicos={options.estadosFenologicos} monitoreadores={options.monitoreadores} errors={form.fieldErrors} onChange={handleChange} />
        <PosicionesMonitoreoGrid values={form.values} errors={form.fieldErrors} onChange={handleChange} />
        <EvidenciaObservacionesSection values={form.values} onChange={handleChange} images={images} />
        <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_280px] lg:items-start">
          <div className="rounded-xl border border-[#dbe5da] bg-white p-5 shadow-sm sm:p-6">
            <h2 className="text-lg font-semibold text-[#1f2922]">Confirmar registro</h2>
            <p className="mt-1 text-sm text-[#617064]">La validación definitiva y el guardado transaccional se realizan en el servidor.</p>
            <div className="mt-5 flex flex-wrap gap-3">
              <a className="rounded-lg border border-[#b8cbb8] px-4 py-2 text-sm font-semibold text-[#35563b] hover:bg-[#f2f7f0]" href="/home">Cancelar</a>
              <button type="submit" disabled={form.isSubmitting} className="inline-flex items-center gap-2 rounded-lg bg-[#2f713b] px-4 py-2 text-sm font-semibold text-white hover:bg-[#245c2f] disabled:cursor-not-allowed disabled:opacity-60"><ClipboardPlus className="size-4" aria-hidden="true" />{form.isSubmitting ? 'Guardando…' : 'Guardar monitoreo'}</button>
            </div>
          </div>
          <ResumenMonitoreo values={form.values} options={options} catalogs={catalogos.catalogs} />
        </div>
      </form>
    </div>
  );
}

export default NuevoMonitoreoChanchitosPage;
