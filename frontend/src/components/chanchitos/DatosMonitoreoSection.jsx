function InputField({ id, label, error, children }) {
  return (
    <div>
      <label className="mb-1.5 block text-sm font-semibold text-[#314237]" htmlFor={id}>{label} <span aria-hidden="true">*</span></label>
      {children}
      {error && <p id={`${id}-error`} className="mt-1 text-xs text-[#a52d24]">{error}</p>}
    </div>
  );
}

const inputClass = 'min-h-11 w-full rounded-lg border border-[#cfdccf] bg-white px-3 text-sm text-[#1f2922] shadow-sm outline-none transition focus:border-[#39744a] focus:ring-2 focus:ring-[#b8d8b4]';

function DatosMonitoreoSection({ values, estadosFenologicos, monitoreadores, errors, onChange }) {
  return (
    <section className="rounded-xl border border-[#dbe5da] bg-white p-5 shadow-sm sm:p-6">
      <div className="mb-5">
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[#4e7f55]">02 · Datos</p>
        <h2 className="mt-1 text-lg font-semibold text-[#1f2922]">Datos del monitoreo</h2>
      </div>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <InputField id="fechaMonitoreo" label="Fecha de monitoreo" error={errors.fechaMonitoreo}>
          <input id="fechaMonitoreo" name="fechaMonitoreo" type="date" value={values.fechaMonitoreo} onChange={onChange} aria-invalid={Boolean(errors.fechaMonitoreo)} aria-describedby={errors.fechaMonitoreo ? 'fechaMonitoreo-error' : undefined} className={inputClass} />
        </InputField>
        <InputField id="idMonitoreador" label="Monitoreador" error={errors.idMonitoreador}>
          <select id="idMonitoreador" name="idMonitoreador" value={values.idMonitoreador} onChange={onChange} aria-invalid={Boolean(errors.idMonitoreador)} aria-describedby={errors.idMonitoreador ? 'idMonitoreador-error' : undefined} className={inputClass}>
            <option value="">Seleccione un monitoreador</option>
            {monitoreadores.map((item) => <option key={item.id_monitoreador} value={item.id_monitoreador}>{item.nombre_monitoreador}</option>)}
          </select>
        </InputField>
        <InputField id="idEstadoFenologico" label="Estado fenológico" error={errors.idEstadoFenologico}>
          <select id="idEstadoFenologico" name="idEstadoFenologico" value={values.idEstadoFenologico} onChange={onChange} aria-invalid={Boolean(errors.idEstadoFenologico)} aria-describedby={errors.idEstadoFenologico ? 'idEstadoFenologico-error' : undefined} className={inputClass}>
            <option value="">Seleccione un estado fenológico</option>
            {estadosFenologicos.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
          </select>
        </InputField>
        <InputField id="cantPlantas" label="Cantidad de plantas" error={errors.cantPlantas}>
          <input id="cantPlantas" name="cantPlantas" type="number" min="1" step="1" value={values.cantPlantas} onChange={onChange} aria-invalid={Boolean(errors.cantPlantas)} aria-describedby={errors.cantPlantas ? 'cantPlantas-error' : undefined} className={inputClass} />
        </InputField>
      </div>
    </section>
  );
}

export default DatosMonitoreoSection;
