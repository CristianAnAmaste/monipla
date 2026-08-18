import { ESTADOS_MONITOREO, POSICIONES_MONITOREO } from '../../utils/chanchitosValidation';

function PosicionesMonitoreoGrid({ values, errors, onChange }) {
  return (
    <section className="rounded-xl border border-[#dbe5da] bg-white p-5 shadow-sm sm:p-6">
      <div className="mb-5">
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[#4e7f55]">03 · Posiciones</p>
        <h2 className="mt-1 text-lg font-semibold text-[#1f2922]">Matriz de monitoreo</h2>
        <p className="mt-1 text-sm text-[#617064]">Ingrese cantidades enteras. Los campos vacíos se registran como cero.</p>
      </div>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {ESTADOS_MONITOREO.map((estado) => (
          <fieldset key={estado.id} className="rounded-lg border border-[#e0e8df] p-4">
            <legend className="px-1 text-sm font-semibold text-[#244b2e]">{estado.label}</legend>
            <div className="mt-2 grid gap-3 sm:grid-cols-2">
              {POSICIONES_MONITOREO.map((posicion) => {
                const name = `cantidad_${estado.id}_${posicion.id}`;
                return (
                  <div key={name}>
                    <label className="mb-1 block text-xs font-medium text-[#56685a]" htmlFor={name}>{posicion.label}</label>
                    <input id={name} name={name} type="number" inputMode="numeric" min="0" max="2147483647" step="1" value={values[name]} onChange={onChange} aria-invalid={Boolean(errors[name])} aria-describedby={errors[name] ? `${name}-error` : undefined} className="min-h-10 w-full rounded-lg border border-[#cfdccf] px-3 text-sm text-[#1f2922] outline-none transition focus:border-[#39744a] focus:ring-2 focus:ring-[#b8d8b4]" />
                    {errors[name] && <p id={`${name}-error`} className="mt-1 text-xs text-[#a52d24]">{errors[name]}</p>}
                  </div>
                );
              })}
            </div>
          </fieldset>
        ))}
      </div>
    </section>
  );
}

export default PosicionesMonitoreoGrid;
