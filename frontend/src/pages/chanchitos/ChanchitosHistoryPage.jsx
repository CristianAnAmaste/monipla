import { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Download, RefreshCw } from 'lucide-react';
import { ApiClientError } from '../../api/apiClient';
import { descargarPdfGeneralChanchitos, eliminarMonitoreoChanchitos, obtenerDetalleChanchitos, obtenerHistorialChanchitos } from '../../api/chanchitosApi';
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
  const [openDetailId, setOpenDetailId] = useState(null);
  const [detailsById, setDetailsById] = useState({});
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);
  const catalogos = useChanchitosCatalogos();
  const historyControllerRef = useRef(null);
  const historyRequestSequenceRef = useRef(0);
  const detailControllerRef = useRef(null);
  const detailRequestIdRef = useRef(null);
  const pdfRequestRef = useRef(false);

  const closeOpenDetail = useCallback(() => {
    detailControllerRef.current?.abort();
    detailControllerRef.current = null;
    detailRequestIdRef.current = null;
    setOpenDetailId(null);
  }, []);

  const loadHistory = useCallback(async (nextFilters) => {
    const sequence = historyRequestSequenceRef.current + 1;
    const requestId = `react-chanchitos-historial-${sequence}`;
    historyRequestSequenceRef.current = sequence;
    historyControllerRef.current?.abort();
    closeOpenDetail();
    const controller = new AbortController();
    historyControllerRef.current = controller;
    setHistory((current) => ({ status: 'loading', data: current.data }));
    setError(null);
    try {
      const response = await obtenerHistorialChanchitos(nextFilters, controller.signal, requestId);
      if (historyRequestSequenceRef.current !== sequence || historyControllerRef.current !== controller) return null;
      setHistory({ status: 'ready', data: response.data });
      setFilters(response.data.values);
      return response.data;
    } catch (requestError) {
      if (historyRequestSequenceRef.current !== sequence || historyControllerRef.current !== controller) return null;
      if (requestError.name === 'AbortError') return null;
      if (requestError instanceof ApiClientError && requestError.status === 401) {
        window.location.assign('/login');
        return null;
      }
      setHistory((current) => ({ status: 'error', data: current.data }));
      setError(getErrorMessage(requestError, 'No fue posible cargar el historial de Chanchito Blanco.'));
      return null;
    } finally {
      if (historyRequestSequenceRef.current === sequence && historyControllerRef.current === controller) {
        historyControllerRef.current = null;
      }
    }
  }, [closeOpenDetail]);

  useEffect(() => {
    const timer = window.setTimeout(() => { loadHistory(initialFilters); }, 0);
    return () => {
      window.clearTimeout(timer);
      historyRequestSequenceRef.current += 1;
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
  const handlePageSizeChange = (event) => {
    setNotice(null);
    loadHistory({ ...filters, pageSize: event.target.value, pagina: 1 });
  };
  const exportPdfGeneral = async () => {
    if (pdfRequestRef.current) return;

    pdfRequestRef.current = true;
    setIsGeneratingPdf(true);
    setError(null);
    const startedAt = performance.now();
    try {
      const pdf = await descargarPdfGeneralChanchitos(history.data?.values || filters);
      const url = URL.createObjectURL(pdf.blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = pdf.filename;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 0);
      setNotice(`PDF general generado en ${((performance.now() - startedAt) / 1000).toFixed(1)} s.`);
    } catch (requestError) {
      if (requestError instanceof ApiClientError && requestError.status === 401) {
        window.location.assign('/login');
        return;
      }
      setError(getErrorMessage(requestError, 'No fue posible generar el PDF general de Chanchitos.'));
    } finally {
      pdfRequestRef.current = false;
      setIsGeneratingPdf(false);
    }
  };

  const loadDetail = async (idMonitoreo) => {
    if (detailsById[idMonitoreo]?.status === 'ready') return;
    if (detailsById[idMonitoreo]?.status === 'loading' && detailRequestIdRef.current === idMonitoreo) return;
    detailControllerRef.current?.abort();
    detailControllerRef.current = null;
    const controller = new AbortController();
    detailControllerRef.current = controller;
    detailRequestIdRef.current = idMonitoreo;
    setDetailsById((current) => ({
      ...current,
      [idMonitoreo]: { status: 'loading', data: null, error: null },
    }));
    try {
      const response = await obtenerDetalleChanchitos(idMonitoreo, controller.signal);
      if (detailControllerRef.current === controller) {
        setDetailsById((current) => ({
          ...current,
          [idMonitoreo]: { status: 'ready', data: response.data, error: null },
        }));
      }
    } catch (requestError) {
      if (requestError.name === 'AbortError') return;
      if (requestError instanceof ApiClientError && requestError.status === 401) {
        window.location.assign('/login');
        return;
      }
      if (detailControllerRef.current === controller) {
        setDetailsById((current) => ({
          ...current,
          [idMonitoreo]: { status: 'error', data: null, error: getErrorMessage(requestError, 'No fue posible cargar el detalle.') },
        }));
      }
    } finally {
      if (detailControllerRef.current === controller) {
        detailControllerRef.current = null;
        detailRequestIdRef.current = null;
      }
    }
  };

  const toggleDetail = (idMonitoreo) => {
    if (openDetailId === idMonitoreo) {
      setOpenDetailId(null);
      return;
    }
    setOpenDetailId(idMonitoreo);
    loadDetail(idMonitoreo);
  };

  const deleteMonitoreo = async () => {
    if (!deleteTarget || isDeleting) return;
    const deletingId = deleteTarget.idMonitoreo;
    closeOpenDetail();
    setIsDeleting(true);
    setError(null);
    try {
      await eliminarMonitoreoChanchitos(deletingId);
      setDeleteTarget(null);
      setDetailsById((current) => {
        const next = { ...current };
        delete next[deletingId];
        return next;
      });
      setNotice('Monitoreo de Chanchito Blanco eliminado correctamente.');
      const currentValues = history.data?.values || filters;
      const isLastRecordOnPage = history.data?.registros?.length === 1;
      const currentPage = Number(currentValues.pagina) || 1;
      await loadHistory({
        ...currentValues,
        pagina: isLastRecordOnPage && currentPage > 1 ? currentPage - 1 : currentPage,
      });
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
        <div className="flex flex-wrap gap-3"><button type="button" disabled={isGeneratingPdf} onClick={exportPdfGeneral} className="inline-flex items-center gap-2 rounded-lg border border-[#b8cbb8] px-4 py-2 text-sm font-semibold text-[#35563b] hover:bg-[#f2f7f0] disabled:cursor-not-allowed disabled:opacity-60 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#39744a]"><Download className="size-4" aria-hidden="true" />{isGeneratingPdf ? 'Generando PDF…' : 'Exportar PDF general'}</button><a className="rounded-lg border border-[#b8cbb8] px-4 py-2 text-sm font-semibold text-[#35563b] hover:bg-[#f2f7f0]" href="/chanchitos/historial" data-route-type="legacy">Usar historial EJS</a><Link className="rounded-lg bg-[#2f713b] px-4 py-2 text-sm font-semibold text-white hover:bg-[#245c2f]" to="/app/chanchitos/nuevo">Registrar monitoreo</Link></div>
      </header>
      {notice && <div className="mb-5 rounded-lg border border-[#b9dcb9] bg-[#eff8ee] px-4 py-3 text-sm text-[#256133]" role="status">{notice}</div>}
      {error && <div className="mb-5 rounded-lg border border-[#f2c8c2] bg-[#fff5f3] px-4 py-3 text-sm text-[#8e2e26]" role="alert">{error}</div>}
      {history.status === 'error' ? <section className="rounded-xl border border-[#dbe5da] bg-white p-6"><button type="button" onClick={() => loadHistory(filters)} className="inline-flex items-center gap-2 rounded-lg bg-[#2f713b] px-4 py-2 text-sm font-semibold text-white hover:bg-[#245c2f]"><RefreshCw className="size-4" aria-hidden="true" />Reintentar</button></section> : <>
        <HistoryFilters filters={filters} options={data?.opciones || {}} catalogs={catalogos.catalogs} loading={catalogos.loading} onChange={updateFilter} onFundoChange={handleFundoChange} onCampoChange={handleCampoChange} onVariedadChange={handleVariedadChange} onSubmit={submitFilters} onClear={clearFilters} />
        {history.status === 'loading' ? <p className="mt-5 rounded-lg border border-[#dbe5da] bg-white px-4 py-3 text-sm text-[#617064]">Cargando historial…</p> : <section className="mt-5"><div className="mb-4 flex flex-wrap items-end justify-between gap-3"><div><h2 className="text-lg font-semibold text-[#1f2922]">Monitoreos encontrados</h2><p className="mt-1 text-sm text-[#617064]">{data.paginacion.totalRegistros} registros · Página {data.paginacion.pagina} de {data.paginacion.totalPaginas}</p></div><div className="grid grid-cols-2 gap-2 text-sm sm:grid-cols-4"><span className="rounded-lg bg-white px-3 py-2 text-[#425347] shadow-sm"><strong>{data.resumen.totalMonitoreos}</strong> monitoreos</span><span className="rounded-lg bg-white px-3 py-2 text-[#425347] shadow-sm"><strong>{data.resumen.totalPlantas}</strong> plantas</span><span className="rounded-lg bg-white px-3 py-2 text-[#425347] shadow-sm"><strong>{data.resumen.totalBichos}</strong> insectos</span><span className="rounded-lg bg-white px-3 py-2 text-[#425347] shadow-sm"><strong>{data.resumen.monitoreosConDeteccion}</strong> con detección</span></div></div>
          <HistoryTable records={data.registros} openDetailId={openDetailId} detailsById={detailsById} canDelete={data.puedeEliminar} onToggleDetail={toggleDetail} onDelete={setDeleteTarget} />
          {data.registros.length > 0 && <div className="mt-5 flex justify-end"><label className="flex items-center gap-2 text-sm font-medium text-[#35563b]" htmlFor="history-page-size">Resultados por página<select id="history-page-size" value={filters.pageSize} onChange={handlePageSizeChange} className="min-h-10 rounded-lg border border-[#cbd9c8] bg-white px-3 text-sm text-[#1f2922] shadow-sm outline-none focus:border-[#39744a] focus-visible:ring-2 focus-visible:ring-[#a8d5a2]">{[10, 25, 50].map((size) => <option key={size} value={size}>{size}</option>)}</select></label></div>}
          {data.registros.length > 0 && <nav className="mt-5 flex items-center justify-between gap-3" aria-label="Paginación del historial"><button type="button" disabled={data.paginacion.pagina <= 1} onClick={() => loadHistory({ ...filters, pagina: data.paginacion.pagina - 1 })} className="rounded-lg border border-[#b8cbb8] px-4 py-2 text-sm font-semibold text-[#35563b] hover:bg-[#f2f7f0] disabled:cursor-not-allowed disabled:opacity-50">Anterior</button><span className="text-sm text-[#617064]">Página {data.paginacion.pagina} de {data.paginacion.totalPaginas}</span><button type="button" disabled={data.paginacion.pagina >= data.paginacion.totalPaginas} onClick={() => loadHistory({ ...filters, pagina: data.paginacion.pagina + 1 })} className="rounded-lg border border-[#b8cbb8] px-4 py-2 text-sm font-semibold text-[#35563b] hover:bg-[#f2f7f0] disabled:cursor-not-allowed disabled:opacity-50">Siguiente</button></nav>}
        </section>}
      </>}
      <ConfirmDeleteDialog record={deleteTarget} isDeleting={isDeleting} onCancel={() => { if (!isDeleting) setDeleteTarget(null); }} onConfirm={deleteMonitoreo} />
    </div>
  );
}

export default ChanchitosHistoryPage;
