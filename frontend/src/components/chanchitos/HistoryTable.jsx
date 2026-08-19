import { Fragment } from 'react';
import { Eye, LoaderCircle } from 'lucide-react';
import ChanchitosDetail from './ChanchitosDetail';
import HistoryRowActions from './HistoryRowActions';

function HistoryTable({ records, openDetailId, detailsById, canDelete, onToggleDetail, onDelete, onOpenPanel }) {
  const detailState = openDetailId
    ? { id: openDetailId, status: 'idle', data: null, error: null, ...detailsById[openDetailId] }
    : { id: null, status: 'idle', data: null, error: null };

  if (records.length === 0) {
    return <section className="rounded-xl border border-dashed border-[#b8cbb8] bg-white p-8 text-center"><h2 className="font-semibold text-[#1f2922]">No hay monitoreos para los filtros seleccionados</h2><p className="mt-2 text-sm text-[#617064]">Ajuste los filtros o vuelva a ver todos los registros.</p></section>;
  }

  return (
    <div className="overflow-x-auto rounded-xl border border-[#dbe5da] bg-white shadow-sm">
      <table className="min-w-[1050px] w-full text-left text-sm"><thead className="border-b border-[#dbe5da] bg-[#f1f6ef] text-[#35563b]"><tr>{['Fecha', 'Fundo / Productor', 'Variedad / Cuartel', 'SDP', 'Plantas', 'Total bichos', 'Monitoreador', 'Agroclima', 'Acción'].map((label) => <th key={label} className="px-4 py-3 font-semibold">{label}</th>)}</tr></thead><tbody>{records.map((record) => <Fragment key={record.idMonitoreo}>
        <tr key={record.idMonitoreo} className="border-b border-[#e4ece2] align-top last:border-0">
          <td className="px-4 py-3 font-medium text-[#1f2922]">{record.fechaMonitoreo}</td><td className="px-4 py-3"><strong className="block text-[#1f2922]">{record.fundo}</strong><span className="text-[#617064]">{record.campo}</span></td><td className="px-4 py-3"><strong className="block text-[#1f2922]">{record.variedad}</strong><span className="text-[#617064]">{record.cuartel}</span></td><td className="px-4 py-3 text-[#425347]">{record.sdp}</td><td className="px-4 py-3 text-[#425347]">{record.cantPlantas}</td><td className="px-4 py-3"><span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${record.tieneDeteccion ? 'bg-[#fff0ee] text-[#9f3026]' : 'bg-[#edf6ec] text-[#256133]'}`}>{record.totalBichos}</span></td><td className="px-4 py-3 text-[#425347]">{record.monitoreador}</td><td className="px-4 py-3"><strong className="block text-[#1f2922]">{record.agroclima?.tieneDatos ? `HF ${record.agroclima.horasFrio ?? '-'} · DG ${record.agroclima.diasGrado ?? '-'}` : 'Sin datos'}</strong>{record.agroclima?.estacion && <span className="text-[#617064]">{record.agroclima.estacion}</span>}</td>
          <td className="px-4 py-3"><div className="flex flex-wrap gap-2"><button type="button" onClick={() => onToggleDetail(record.idMonitoreo)} aria-label={`${detailState.id === record.idMonitoreo && detailState.status === 'ready' ? 'Ocultar' : 'Ver'} detalle del monitoreo ${record.idMonitoreo}`} aria-expanded={detailState.id === record.idMonitoreo && detailState.status === 'ready'} className="inline-flex items-center gap-1 rounded-md border border-[#b8cbb8] px-2.5 py-1.5 text-xs font-semibold text-[#35563b] hover:bg-[#f2f7f0] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#39744a]"><Eye className="size-3.5" aria-hidden="true" />{detailState.id === record.idMonitoreo && detailState.status === 'ready' ? 'Ocultar detalle' : 'Ver detalle'}</button><HistoryRowActions record={record} canDelete={canDelete} onDelete={onDelete} onOpenPanel={onOpenPanel} /></div></td>
        </tr>
        {detailState.id === record.idMonitoreo && <tr><td colSpan="9" className="p-0">{detailState.status === 'loading' ? <p className="flex items-center gap-2 bg-[#f8fbf6] px-4 py-5 text-sm text-[#617064]"><LoaderCircle className="size-4 animate-spin" aria-hidden="true" />Cargando detalle…</p> : detailState.status === 'error' ? <p className="bg-[#fff5f3] px-4 py-5 text-sm text-[#8e2e26]">{detailState.error}</p> : <ChanchitosDetail detail={detailState.data} />}</td></tr>}
      </Fragment>)}</tbody></table>
    </div>
  );
}

export default HistoryTable;
