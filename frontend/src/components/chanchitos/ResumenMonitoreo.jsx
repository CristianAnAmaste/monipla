import { ESTADOS_MONITOREO, POSICIONES_MONITOREO } from '../../utils/chanchitosValidation';

function findLabel(items = [], value, idKey = 'value', labelKey = 'label') {
  return items.find((item) => String(item[idKey]) === String(value))?.[labelKey] || 'Sin seleccionar';
}

function SummaryBlock({ title, rows, onEdit }) {
  return (
    <section className="rounded-lg border border-[#dbe5da] bg-[#f7faf6] p-4">
      <div className="flex items-center justify-between gap-3">
        <h3 className="font-semibold text-[#314237]">{title}</h3>
        <button type="button" onClick={onEdit} className="text-sm font-semibold text-[#2f713b] hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#39744a]">Corregir</button>
      </div>
      <dl className="mt-3 space-y-2 text-sm">
        {rows.map(([label, value]) => <div key={label} className="flex justify-between gap-4"><dt className="text-[#617064]">{label}</dt><dd className="max-w-[60%] text-right font-medium text-[#1f2922]">{value}</dd></div>)}
      </dl>
    </section>
  );
}

function ResumenMonitoreo({ values, options, catalogs, imageCount, onEditStep }) {
  const total = ESTADOS_MONITOREO.reduce(
    (sum, estado) => sum + POSICIONES_MONITOREO.reduce(
      (rowTotal, posicion) => rowTotal + (Number(values[`cantidad_${estado.id}_${posicion.id}`]) || 0),
      0
    ),
    0
  );
  const originRows = [
    ['Fundo', findLabel(options.fundos, values.genFundo)],
    ['Campo / Productor', findLabel(catalogs.campos, values.genCampo)],
    ['Variedad', findLabel(catalogs.variedades, values.genVariedad)],
    ['Cuartel', findLabel(catalogs.cuarteles, values.idCatalogoSdp)],
  ];
  const dataRows = [
    ['Fecha', values.fechaMonitoreo || 'Sin seleccionar'],
    ['Monitoreador', findLabel(options.monitoreadores, values.idMonitoreador, 'id_monitoreador', 'nombre_monitoreador')],
    ['Estado fenológico', findLabel(options.estadosFenologicos, values.idEstadoFenologico)],
    ['Cantidad de plantas', values.cantPlantas || 'Sin seleccionar'],
  ];

  return (
    <section className="space-y-4 rounded-xl border border-[#dbe5da] bg-white p-5 shadow-sm sm:p-6">
      <div><p className="text-xs font-semibold uppercase tracking-[0.14em] text-[#4e7f55]">05 · Revisión</p><h2 className="mt-1 text-lg font-semibold text-[#1f2922]">Revise antes de guardar</h2><p className="mt-1 text-sm text-[#617064]">Puede volver a una etapa completada para corregir la información.</p></div>
      <div className="grid gap-4 lg:grid-cols-2">
        <SummaryBlock title="Origen" rows={originRows} onEdit={() => onEditStep(1)} />
        <SummaryBlock title="Datos" rows={dataRows} onEdit={() => onEditStep(2)} />
        <SummaryBlock title="Matriz de presión" rows={[["Total de registros", total], ['Valores', '12 posiciones registradas']]} onEdit={() => onEditStep(3)} />
        <SummaryBlock title="Evidencias y observaciones" rows={[["Imágenes adjuntas", `${imageCount} de 3`], ['Observaciones', values.observaciones || 'Sin observaciones']]} onEdit={() => onEditStep(4)} />
      </div>
    </section>
  );
}

export default ResumenMonitoreo;
