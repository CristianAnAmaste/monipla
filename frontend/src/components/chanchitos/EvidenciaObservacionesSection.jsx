function EvidenciaObservacionesSection({ values, onChange }) {
  return (
    <section className="rounded-xl border border-[#dbe5da] bg-white p-5 shadow-sm sm:p-6">
      <div className="mb-5">
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[#4e7f55]">04 · Observaciones</p>
        <h2 className="mt-1 text-lg font-semibold text-[#1f2922]">Observaciones</h2>
        <p className="mt-1 text-sm text-[#617064]">La carga de imágenes no forma parte del flujo vigente de Chanchitos.</p>
      </div>
      <label className="mb-1.5 block text-sm font-semibold text-[#314237]" htmlFor="observaciones">Observaciones relevantes</label>
      <textarea id="observaciones" name="observaciones" rows="4" value={values.observaciones} onChange={onChange} placeholder="Ingrese observaciones relevantes" className="w-full rounded-lg border border-[#cfdccf] bg-white px-3 py-2.5 text-sm text-[#1f2922] shadow-sm outline-none transition focus:border-[#39744a] focus:ring-2 focus:ring-[#b8d8b4]" />
    </section>
  );
}

export default EvidenciaObservacionesSection;
