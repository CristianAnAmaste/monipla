import { useState } from 'react';

function SelectField({ id, label, value, onChange, children, disabled = false }) {
  return (
    <label className="grid gap-1.5 text-sm font-medium text-[#35563b]" htmlFor={id}>
      {label}
      <select
        id={id}
        name={id}
        value={value || ''}
        disabled={disabled}
        onChange={onChange}
        className="min-h-10 rounded-lg border border-[#cbd9c8] bg-white px-3 text-sm text-[#1f2922] shadow-sm outline-none focus:border-[#39744a] focus-visible:ring-2 focus-visible:ring-[#a8d5a2] disabled:cursor-not-allowed disabled:bg-[#f4f7f2]"
      >
        {children}
      </select>
    </label>
  );
}

function HistoryFilters({ filters, options, catalogs, loading, onChange, onFundoChange, onCampoChange, onVariedadChange, onSubmit, onClear }) {
  const [showAdvanced, setShowAdvanced] = useState(false);
  const inputClassName = 'min-h-10 rounded-lg border border-[#cbd9c8] bg-white px-3 text-sm text-[#1f2922] shadow-sm outline-none focus:border-[#39744a] focus-visible:ring-2 focus-visible:ring-[#a8d5a2]';
  const advancedFilterKeys = ['genCampo', 'genVariedad', 'idCatalogoSdp', 'idMonitoreador', 'idEstadoFenologico'];
  const activeAdvancedCount = advancedFilterKeys.filter((key) => Boolean(filters[key])).length;

  const handleClear = () => {
    setShowAdvanced(false);
    onClear();
  };

  return (
    <section className="rounded-xl border border-[#dbe5da] bg-white p-5 shadow-sm sm:p-6" aria-labelledby="history-filters-title">
      <div className="mb-5 flex flex-wrap items-baseline justify-between gap-2">
        <div>
          <h2 id="history-filters-title" className="text-lg font-semibold text-[#1f2922]">Filtros</h2>
          <p className="mt-1 text-sm text-[#617064]">Refine los monitoreos que desea revisar.</p>
        </div>
      </div>
      <form className="space-y-4" onSubmit={onSubmit} noValidate>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <label className="grid gap-1.5 text-sm font-medium text-[#35563b]" htmlFor="fechaDesde">Fecha desde<input className={inputClassName} id="fechaDesde" name="fechaDesde" type="date" value={filters.fechaDesde || ''} onChange={onChange} /></label>
          <label className="grid gap-1.5 text-sm font-medium text-[#35563b]" htmlFor="fechaHasta">Fecha hasta<input className={inputClassName} id="fechaHasta" name="fechaHasta" type="date" value={filters.fechaHasta || ''} onChange={onChange} /></label>
          <SelectField id="genFundo" label="Fundo" value={filters.genFundo} onChange={onFundoChange}>
            <option value="">Todos</option>{(options.fundos || []).map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
          </SelectField>
          <SelectField id="deteccion" label="Detección" value={filters.deteccion} onChange={onChange}>
            <option value="">Todos</option><option value="CON_DETECCION">Solo con detección</option><option value="SIN_DETECCION">Sin detección</option>
          </SelectField>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <button type="button" aria-expanded={showAdvanced} aria-controls="history-advanced-filters" className="rounded-lg border border-[#b8cbb8] px-4 py-2 text-sm font-semibold text-[#35563b] hover:bg-[#f2f7f0] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#39744a]" onClick={() => setShowAdvanced((current) => !current)}>
            Más filtros{activeAdvancedCount > 0 ? ` (${activeAdvancedCount})` : ''}
          </button>
          <button type="button" className="rounded-lg border border-[#b8cbb8] px-4 py-2 text-sm font-semibold text-[#35563b] hover:bg-[#f2f7f0] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#39744a]" onClick={handleClear}>Limpiar</button>
          <button type="submit" className="rounded-lg bg-[#2f713b] px-4 py-2 text-sm font-semibold text-white hover:bg-[#245c2f] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#39744a]">Filtrar</button>
        </div>
        {showAdvanced && <div id="history-advanced-filters" className="grid gap-4 border-t border-[#e5ece3] pt-4 sm:grid-cols-2 xl:grid-cols-5">
          <SelectField id="genCampo" label="Productor / Campo" value={filters.genCampo} onChange={onCampoChange} disabled={!filters.genFundo || loading.campos}>
            <option value="">{loading.campos ? 'Cargando campos…' : 'Todos'}</option>{catalogs.campos.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
          </SelectField>
          <SelectField id="genVariedad" label="Variedad" value={filters.genVariedad} onChange={onVariedadChange} disabled={!filters.genCampo || loading.variedades}>
            <option value="">{loading.variedades ? 'Cargando variedades…' : 'Todos'}</option>{catalogs.variedades.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
          </SelectField>
          <SelectField id="idCatalogoSdp" label="Cuartel" value={filters.idCatalogoSdp} onChange={onChange} disabled={!filters.genVariedad || loading.cuarteles}>
            <option value="">{loading.cuarteles ? 'Cargando cuarteles…' : 'Todos'}</option>{catalogs.cuarteles.map((item) => <option key={item.value} value={item.idCatalogoSdp ?? item.value}>{item.label}</option>)}
          </SelectField>
          <SelectField id="idMonitoreador" label="Monitoreador" value={filters.idMonitoreador} onChange={onChange}>
            <option value="">Todos</option>{(options.monitoreadores || []).map((item) => <option key={item.id_monitoreador} value={item.id_monitoreador}>{item.nombre_monitoreador}</option>)}
          </SelectField>
          <SelectField id="idEstadoFenologico" label="Estado fenológico" value={filters.idEstadoFenologico} onChange={onChange}>
            <option value="">Todos</option>{(options.estadosFenologicos || []).map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
          </SelectField>
        </div>}
      </form>
    </section>
  );
}

export default HistoryFilters;
