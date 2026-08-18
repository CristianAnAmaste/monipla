import { ESTADOS_MONITOREO, POSICIONES_MONITOREO } from '../../utils/chanchitosValidation';

function findLabel(items, value, idKey = 'value', labelKey = 'label') {
  return items.find((item) => String(item[idKey]) === String(value))?.[labelKey] || 'Sin seleccionar';
}

function ResumenMonitoreo({ values, options, catalogs }) {
  const total = ESTADOS_MONITOREO.reduce(
    (sum, estado) => sum + POSICIONES_MONITOREO.reduce(
      (rowTotal, posicion) => rowTotal + (Number(values[`cantidad_${estado.id}_${posicion.id}`]) || 0),
      0
    ),
    0
  );

  return (
    <aside className="rounded-xl border border-[#dbe5da] bg-[#f7faf6] p-5">
      <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[#4e7f55]">05 · Resumen</p>
      <h2 className="mt-1 text-base font-semibold text-[#1f2922]">Confirmación rápida</h2>
      <dl className="mt-4 space-y-2 text-sm">
        <div className="flex justify-between gap-4"><dt className="text-[#617064]">Fundo</dt><dd className="text-right font-medium text-[#1f2922]">{findLabel(options.fundos, values.genFundo)}</dd></div>
        <div className="flex justify-between gap-4"><dt className="text-[#617064]">Cuartel</dt><dd className="text-right font-medium text-[#1f2922]">{findLabel(catalogs.cuarteles, values.idCatalogoSdp)}</dd></div>
        <div className="flex justify-between gap-4"><dt className="text-[#617064]">Fecha</dt><dd className="text-right font-medium text-[#1f2922]">{values.fechaMonitoreo || 'Sin seleccionar'}</dd></div>
        <div className="flex justify-between gap-4"><dt className="text-[#617064]">Plantas</dt><dd className="text-right font-medium text-[#1f2922]">{values.cantPlantas || 'Sin seleccionar'}</dd></div>
        <div className="flex justify-between gap-4 border-t border-[#dbe5da] pt-2"><dt className="font-semibold text-[#314237]">Total matriz</dt><dd className="font-semibold text-[#244b2e]">{total}</dd></div>
      </dl>
    </aside>
  );
}

export default ResumenMonitoreo;
