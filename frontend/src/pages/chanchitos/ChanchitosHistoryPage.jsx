import { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { RefreshCw } from 'lucide-react';
import { ApiClientError } from '../../api/apiClient';
import { eliminarMonitoreoChanchitos, obtenerDetalleChanchitos, obtenerHistorialChanchitos } from '../../api/chanchitosApi';
import ConfirmDeleteDialog from '../../components/chanchitos/ConfirmDeleteDialog';
import HistoryFilters from '../../components/chanchitos/HistoryFilters';
import HistoryTable from '../../components/chanchitos/HistoryTable';
import { useChanchitosCatalogos } from '../../hooks/useChanchitosCatalogos';

const initialFilters = {
  fechaDesde: '', fechaHasta: '', genFundo: '', genCampo: '', genVariedad: '', idCatalogoSdp: '',
  idMonitoreador: '', idEstadoFenologico: '', deteccion: '', pagina: 1, pageSize: 10,
};

function getErrorMessage(error, fallback) {
  if (error instanceof ApiClientError) {
    if (error.status === 401) return 'La sesión expiró. Redirigiendo al inicio de sesión.';
    if (error.status === 403) return 'No tiene permisos para realizar esta acción.';
    if (error.status === 404) return 'El monitoreo solicitado ya no existe.';
    if (error.status === 409) return error.payload?.message || 'La operación entró en conflicto con el estado actual.';
    if (error.status === 400) return error.payload?.errors?.join(' ') || error.payload?.message || 'Revise los filtros ingresados.';
  }
  return error.message || fallback;
}

function ChanchitosHistoryPage() {
  const [filters, setFilters] = useState(initialFilters);
  const [history, setHistory] = useState({ status: 'loading', data: null });
  const [error, setError] = useState(null);
  const [notice, setNotice] = useState(null);
  const [detailState, setDetailState] = useState({ id: null, status: 'idle', data: null, error: null });
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const catalogos = useChanchitosCatalogos();
  const historyControllerRef = useRef(null);
  const detailControllerRef = useRef(null);

  const loadHistory = useCallback(async (nextFilters) => {
    historyControllerRef.current?.abort();
    const controller = new AbortController();
    historyControllerRef.current = controller;
    setHistory({ status: 'loading', data: null });
    setError(null);
    setDetailState({ id: null, status: 'idle', data: null, error: null });
    try {
      const response = await obtenerHistorialChanchitos(nextFilters, controller.signal);
      if (historyControllerRef.current !== controller) return null;
      setHistory({ status: 'ready', data: response.data });
      setFilters(response.data.values);
      return response.data;
    } catch (requestError) {
      if (requestError.name === 'AbortError') return null;
      if (historyControllerRef.current !== controller) return null;
      if (requestError instanceof ApiClientError && requestError.status === 401) {
        window.location.assign('/login');
        return null;
      }
      setHistory({ status: 'error', data: null });
      setError(getErrorMessage(requestError, 'No fue posible cargar el historial de Chanchito Blanco.'));
      return null;
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => { loadHistory(initialFilters); }, 0);
    return () => {
      window.clearTimeout(timer);
      historyControllerRef.current?.abort();
      detailControllerRef.current?.abort();
    };
  }, [loadHistory]);

  const runCatalogRequest = async (operation) => {
    try {
      await operation();
    } catch (requestError) {
      if (requestError instanceof ApiClientError && requestError.status === 401) {
        window.location.assign('/login');
        return;
      }
      setError(getErrorMessage(requestError, 'No fue posible cargar los catálogos.'));
    }
  };

  const updateFilter = (event) => setFilters((current) => ({ ...current, [event.target.name]: event.target.value }));
  const handleFundoChange = (event) => {
    const genFundo = event.target.value;
    setFilters((current) => ({ ...current, genFundo, genCampo: '', genVariedad: '', idCatalogoSdp: '' }));
    catalogos.resetFromFundo();
    if (genFundo) runCatalogRequest(() => catalogos.loadCampos(genFundo));
  };
  const handleCampoChange = (event) => {
    const genCampo = event.target.value;
    setFilters((current) => ({ ...current, genCampo, genVariedad: '', idCatalogoSdp: '' }));
    catalogos.resetFromCampo();
    if (genCampo) runCatalogRequest(() => catalogos.loadVariedades(filters.genFundo, genCampo));
  };
  const handleVariedadChange = (event) => {
    const genVariedad = event.target.value;
    setFilters((current) => ({ ...current, genVariedad, idCatalogoSdp: '' }));
    catalogos.resetFromVariedad();
    if (genVariedad) runCatalogRequest(() => catalogos.loadCuarteles(filters.genFundo, filters.genCampo, genVariedad));
  };
  const submitFilters = (event) => {
    event.preventDefault();
    setNotice(null);
    loadHistory({ ...filters, pagina: 1 });
  };
  const clearFilters = () => {
    catalogos.resetFromFundo();
    setNotice(null);
    loadHistory(initialFilters);
  };

  const toggleDetail = async (idMonitoreo) => {
    if (detailState.id === idMonitoreo && detailState.status !== 'loading') {
      detailControllerRef.current?.abort();
      setDetailState({ id: null, status: 'idle', data: null, error: null });
      return;
    }
    detailControllerRef.current?.abort();
    const controller = new AbortController();
    detailControllerRef.current = controller;
    setDetailState({ id: idMonitoreo, status: 'loading', data: null, error: null });
    try {
      const response = await obtenerDetalleChanchitos(idMonitoreo, controller.signal);
      if (detailControllerRef.current === controller) setDetailState({ id: idMonitoreo, status: 'ready', data: response.data, error: null });
    } catch (requestError) {
      if (requestError.name === 'AbortError') return;
      if (requestError instanceof ApiClientError && requestError.status === 401) {
        window.location.assign('/login');
        return;
      }
      if (detailControllerRef.current === controller) setDetailState({ id: idMonitoreo, status: 'error', data: null, error: getErrorMessage(requestError, 'No fue posible cargar el detalle.') });
    }
  };

  const deleteMonitoreo = async () => {
    if (!deleteTarget || isDeleting) return;
    setIsDeleting(true);
    setError(null);
    try {
      await eliminarMonitoreoChanchitos(deleteTarget.idMonitoreo);
      setDeleteTarget(null);
      setNotice('Monitoreo de Chanchito Blanco eliminado correctamente.');
      await loadHistory(history.data?.values || filters);
    } catch (requestError) {
      if (requestError instanceof ApiClientError && requestError.status === 401) {
        window.location.assign('/login');
        return;
      }
      setError(getErrorMessage(requestError, 'No fue posible eliminar el monitoreo.'));
    } finally {
      setIsDeleting(false);
    }
  };

  const data = history.data;

  return (
    <div className="mx-auto w-full max-w-[1440px]">
      <header className="mb-7 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div><p className="text-sm font-semibold text-[#4e7f55]">MONITOREO DE CHANCHITO BLANCO</p><h1 className="mt-1 text-2xl font-semibold tracking-tight text-[#1f2922] sm:text-3xl">Historial</h1><p className="mt-2 max-w-2xl text-sm leading-6 text-[#617064]">Revise los monitoreos registrados, sus detecciones y el resumen agroclimático asociado.</p></div>
        <div className="flex flex-wrap gap-3"><a className="rounded-lg border border-[#b8cbb8] px-4 py-2 text-sm font-semibold text-[#35563b] hover:bg-[#f2f7f0]" href="/chanchitos/historial" data-route-type="legacy">Usar historial EJS</a><Link className="rounded-lg bg-[#2f713b] px-4 py-2 text-sm font-semibold text-white hover:bg-[#245c2f]" to="/app/chanchitos/nuevo">Registrar monitoreo</Link></div>
      </header>
      {notice && <div className="mb-5 rounded-lg border border-[#b9dcb9] bg-[#eff8ee] px-4 py-3 text-sm text-[#256133]" role="status">{notice}</div>}
      {error && <div className="mb-5 rounded-lg border border-[#f2c8c2] bg-[#fff5f3] px-4 py-3 text-sm text-[#8e2e26]" role="alert">{error}</div>}
      {history.status === 'error' ? <section className="rounded-xl border border-[#dbe5da] bg-white p-6"><button type="button" onClick={() => loadHistory(filters)} className="inline-flex items-center gap-2 rounded-lg bg-[#2f713b] px-4 py-2 text-sm font-semibold text-white hover:bg-[#245c2f]"><RefreshCw className="size-4" aria-hidden="true" />Reintentar</button></section> : <>
        <HistoryFilters filters={filters} options={data?.opciones || {}} catalogs={catalogos.catalogs} loading={catalogos.loading} onChange={updateFilter} onFundoChange={handleFundoChange} onCampoChange={handleCampoChange} onVariedadChange={handleVariedadChange} onSubmit={submitFilters} onClear={clearFilters} />
        {history.status === 'loading' ? <p className="mt-5 rounded-lg border border-[#dbe5da] bg-white px-4 py-3 text-sm text-[#617064]">Cargando historial…</p> : <section className="mt-5"><div className="mb-4 flex flex-wrap items-end justify-between gap-3"><div><h2 className="text-lg font-semibold text-[#1f2922]">Monitoreos encontrados</h2><p className="mt-1 text-sm text-[#617064]">{data.paginacion.totalRegistros} registros · Página {data.paginacion.pagina} de {data.paginacion.totalPaginas}</p></div><div className="grid grid-cols-2 gap-2 text-sm sm:grid-cols-4"><span className="rounded-lg bg-white px-3 py-2 text-[#425347] shadow-sm"><strong>{data.resumen.totalMonitoreos}</strong> monitoreos</span><span className="rounded-lg bg-white px-3 py-2 text-[#425347] shadow-sm"><strong>{data.resumen.totalPlantas}</strong> plantas</span><span className="rounded-lg bg-white px-3 py-2 text-[#425347] shadow-sm"><strong>{data.resumen.totalBichos}</strong> bichos</span><span className="rounded-lg bg-white px-3 py-2 text-[#425347] shadow-sm"><strong>{data.resumen.monitoreosConDeteccion}</strong> con detección</span></div></div>
          <HistoryTable records={data.registros} detailState={detailState} canDelete={data.puedeEliminar} onToggleDetail={toggleDetail} onDelete={setDeleteTarget} />
          {data.registros.length > 0 && <nav className="mt-5 flex items-center justify-between gap-3" aria-label="Paginación del historial"><button type="button" disabled={data.paginacion.pagina <= 1} onClick={() => loadHistory({ ...filters, pagina: data.paginacion.pagina - 1 })} className="rounded-lg border border-[#b8cbb8] px-4 py-2 text-sm font-semibold text-[#35563b] hover:bg-[#f2f7f0] disabled:cursor-not-allowed disabled:opacity-50">Anterior</button><span className="text-sm text-[#617064]">Página {data.paginacion.pagina} de {data.paginacion.totalPaginas}</span><button type="button" disabled={data.paginacion.pagina >= data.paginacion.totalPaginas} onClick={() => loadHistory({ ...filters, pagina: data.paginacion.pagina + 1 })} className="rounded-lg border border-[#b8cbb8] px-4 py-2 text-sm font-semibold text-[#35563b] hover:bg-[#f2f7f0] disabled:cursor-not-allowed disabled:opacity-50">Siguiente</button></nav>}
        </section>}
      </>}
      <ConfirmDeleteDialog record={deleteTarget} isDeleting={isDeleting} onCancel={() => { if (!isDeleting) setDeleteTarget(null); }} onConfirm={deleteMonitoreo} />
    </div>
  );
}

export default ChanchitosHistoryPage;
