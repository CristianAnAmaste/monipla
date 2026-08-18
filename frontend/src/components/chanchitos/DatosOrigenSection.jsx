function SelectField({ id, label, value, options, placeholder, disabled, loading, error, onChange }) {
  return (
    <div>
      <label className="mb-1.5 block text-sm font-semibold text-[#314237]" htmlFor={id}>{label} <span aria-hidden="true">*</span></label>
      <select
        id={id}
        name={id}
        value={value}
        disabled={disabled}
        onChange={onChange}
        aria-invalid={Boolean(error)}
        aria-describedby={error ? `${id}-error` : undefined}
        className="min-h-11 w-full rounded-lg border border-[#cfdccf] bg-white px-3 text-sm text-[#1f2922] shadow-sm outline-none transition focus:border-[#39744a] focus:ring-2 focus:ring-[#b8d8b4] disabled:cursor-not-allowed disabled:bg-[#f1f5f0]"
      >
        <option value="">{loading ? 'Cargando opciones…' : placeholder}</option>
        {options.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
      </select>
      {error && <p id={`${id}-error`} className="mt-1 text-xs text-[#a52d24]">{error}</p>}
    </div>
  );
}

function DatosOrigenSection({ values, fondos, catalogs, loading, errors, onFundoChange, onCampoChange, onVariedadChange, onCuartelChange }) {
  return (
    <section className="rounded-xl border border-[#dbe5da] bg-white p-5 shadow-sm sm:p-6">
      <div className="mb-5">
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[#4e7f55]">01 · Origen</p>
        <h2 className="mt-1 text-lg font-semibold text-[#1f2922]">Origen del monitoreo</h2>
        <p className="mt-1 text-sm text-[#617064]">La selección se valida nuevamente contra el catálogo SDP al guardar.</p>
      </div>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <SelectField id="genFundo" label="Fundo" value={values.genFundo} options={fondos} placeholder="Seleccione un fundo" error={errors.genFundo} onChange={onFundoChange} />
        <SelectField id="genCampo" label="Campo / Productor" value={values.genCampo} options={catalogs.campos} placeholder="Seleccione primero un fundo" disabled={!values.genFundo} loading={loading.campos} error={errors.genCampo} onChange={onCampoChange} />
        <SelectField id="genVariedad" label="Variedad" value={values.genVariedad} options={catalogs.variedades} placeholder="Seleccione primero un campo" disabled={!values.genCampo} loading={loading.variedades} error={errors.genVariedad} onChange={onVariedadChange} />
        <SelectField id="idCatalogoSdp" label="Cuartel" value={values.idCatalogoSdp} options={catalogs.cuarteles} placeholder="Seleccione primero una variedad" disabled={!values.genVariedad} loading={loading.cuarteles} error={errors.idCatalogoSdp} onChange={onCuartelChange} />
      </div>
      <p className="mt-4 rounded-lg bg-[#f2f7f0] px-3 py-2 text-xs leading-5 text-[#4b6250]">
        SDP, CSG y trazabilidad se resuelven de forma canónica en el servidor al guardar el monitoreo.
      </p>
    </section>
  );
}

export default DatosOrigenSection;
