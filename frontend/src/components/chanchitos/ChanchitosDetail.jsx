const POSICIONES = [
  { id: 1, label: 'Bajo corteza' },
  { id: 2, label: 'Base de brote' },
  { id: 3, label: 'Hoja' },
  { id: 4, label: 'Racimo' },
];

function DetailBlock({ title, children }) {
  return <section className="rounded-lg border border-[#dbe5da] bg-[#fbfdf9] p-4"><h3 className="text-sm font-semibold text-[#35563b]">{title}</h3><dl className="mt-3 grid gap-x-5 gap-y-3 text-sm sm:grid-cols-2">{children}</dl></section>;
}

function DetailField({ label, value }) {
  return <div><dt className="text-xs font-medium uppercase tracking-wide text-[#718072]">{label}</dt><dd className="mt-1 text-[#1f2922]">{value || '-'}</dd></div>;
}

function ChanchitosDetail({ detail }) {
  const states = detail.matriz || [];
  const findCell = (stateId, positionId) => states.find((state) => state.idEstadoMonitoreo === stateId)?.posiciones.find((position) => position.idEstadoPosicion === positionId);

  return (
    <section className="space-y-4 border-t border-[#dbe5da] bg-[#f8fbf6] p-4 sm:p-5" aria-label={`Detalle del monitoreo ${detail.idMonitoreo}`}>
      <div className="grid gap-4 lg:grid-cols-2">
        <DetailBlock title="Identificación"><DetailField label="Fundo" value={detail.fundo} /><DetailField label="Productor / Campo" value={detail.campo} /><DetailField label="Variedad" value={detail.variedad} /><DetailField label="Cuartel" value={detail.cuartel} /><DetailField label="SDP" value={detail.sdp} /><DetailField label="CSG" value={detail.csg} /><DetailField label="Trazabilidad" value={detail.trazabilidad} /></DetailBlock>
        <DetailBlock title="Monitoreo"><DetailField label="Fecha" value={detail.fechaMonitoreo} /><DetailField label="Monitoreador" value={detail.monitoreador} /><DetailField label="Estado fenológico" value={detail.estadoFenologico} /><DetailField label="Cantidad de plantas" value={detail.cantPlantas} /><DetailField label="Total de bichos" value={detail.totalBichos} /><DetailField label="Posiciones con detección" value={detail.posicionesConDeteccion} /></DetailBlock>
        <DetailBlock title="Agroclima"><DetailField label="Estación" value={detail.agroclima?.estacion} /><DetailField label="Horas frío" value={detail.agroclima?.horasFrio} /><DetailField label="Días grado" value={detail.agroclima?.diasGrado} /><DetailField label="Fecha de corte" value={detail.agroclima?.fechaCorte} /></DetailBlock>
        <DetailBlock title="Observaciones"><div className="sm:col-span-2"><dt className="text-xs font-medium uppercase tracking-wide text-[#718072]">Registro</dt><dd className="mt-1 whitespace-pre-wrap text-[#1f2922]">{detail.observaciones === '-' ? 'Sin observaciones' : detail.observaciones}</dd></div></DetailBlock>
      </div>

      <section className="rounded-lg border border-[#dbe5da] bg-white p-4">
        <h3 className="text-sm font-semibold text-[#35563b]">Matriz de presión</h3>
        <div className="mt-3 overflow-x-auto">
          <table className="min-w-[620px] w-full text-left text-sm"><thead className="bg-[#315b39] text-white"><tr><th className="px-3 py-2 font-semibold">Posición</th>{states.map((state) => <th key={state.idEstadoMonitoreo} className="px-3 py-2 text-center font-semibold">{state.nombre}</th>)}</tr></thead><tbody>{POSICIONES.map((position) => <tr key={position.id} className="border-b border-[#e4ece2] last:border-0"><th className="px-3 py-3 font-medium text-[#1f2922]">{position.label}</th>{states.map((state) => { const cell = findCell(state.idEstadoMonitoreo, position.id); const classification = cell?.clasificacion; return <td key={state.idEstadoMonitoreo} className="px-3 py-2 text-center"><span className="inline-flex min-w-20 flex-col rounded-md px-2 py-1" style={{ backgroundColor: classification?.color || '#eeeeee' }}><strong className="text-[#1f2922]">{cell?.cantidad ?? 0}</strong><span className="text-xs text-[#425347]">{classification?.etiqueta || 'No aplica'}</span></span></td>; })}</tr>)}</tbody></table>
        </div>
      </section>

      {detail.imagenes?.length > 0 && <section className="rounded-lg border border-[#dbe5da] bg-white p-4"><h3 className="text-sm font-semibold text-[#35563b]">Imágenes de evidencia</h3><div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{detail.imagenes.map((image) => <a key={image.posicion} href={image.url} target="_blank" rel="noreferrer" className="overflow-hidden rounded-lg border border-[#dbe5da] bg-[#f4f7f2] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#39744a]"><img src={image.url} alt={`Evidencia ${image.posicion} del monitoreo ${detail.idMonitoreo}`} loading="lazy" className="aspect-[4/3] w-full object-cover" /></a>)}</div></section>}
    </section>
  );
}

export default ChanchitosDetail;
