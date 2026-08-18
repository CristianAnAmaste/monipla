import { ESTADOS_MONITOREO, POSICIONES_MONITOREO } from '../../utils/chanchitosValidation';

const positionLabels = {
  1: 'Bajo corteza',
  2: 'Base de brote',
  3: 'Hoja',
  4: 'Racimo',
};

const stateLabels = {
  1: 'Ovisaco',
  2: 'Ninfa',
  3: 'Adulto',
};

function PosicionesMonitoreoGrid({ values, errors, onChange }) {
  return (
    <section className="rounded-xl border border-[#dbe5da] bg-white p-5 shadow-sm sm:p-6">
      <div className="mb-5">
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[#4e7f55]">03 · Posiciones</p>
        <h2 className="mt-1 text-lg font-semibold text-[#1f2922]">Matriz de presión</h2>
        <p className="mt-1 text-sm text-[#617064]">Ingrese cantidades enteras. Los campos vacíos se registran como cero.</p>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[640px] border-separate border-spacing-0 text-sm">
          <thead>
            <tr className="text-left text-[#244b2e]">
              <th scope="col" className="border-b border-[#cfdccf] px-3 py-2 font-semibold">Posición</th>
              {ESTADOS_MONITOREO.map((estado) => (
                <th key={estado.id} scope="col" className="border-b border-[#cfdccf] px-3 py-2 font-semibold">
                  {stateLabels[estado.id] || estado.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {POSICIONES_MONITOREO.map((posicion) => (
              <tr key={posicion.id} className="align-top">
                <th scope="row" className="border-b border-[#e0e8df] px-3 py-3 text-left font-medium text-[#56685a]">
                  {positionLabels[posicion.id] || posicion.label}
                </th>
                {ESTADOS_MONITOREO.map((estado) => {
                  const name = `cantidad_${estado.id}_${posicion.id}`;
                  return (
                    <td key={name} className="border-b border-[#e0e8df] px-3 py-3">
                      <input id={name} name={name} type="number" inputMode="numeric" min="0" max="2147483647" step="1" value={values[name]} onChange={onChange} aria-invalid={Boolean(errors[name])} aria-describedby={errors[name] ? `${name}-error` : undefined} className="min-h-10 w-full rounded-lg border border-[#cfdccf] px-3 text-sm text-[#1f2922] outline-none transition focus:border-[#39744a] focus:ring-2 focus:ring-[#b8d8b4]" />
                      {errors[name] && <p id={`${name}-error`} className="mt-1 text-xs text-[#a52d24]">{errors[name]}</p>}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

export default PosicionesMonitoreoGrid;
