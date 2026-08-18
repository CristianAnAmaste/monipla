function formatFileSize(bytes) {
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

function EvidenciaObservacionesSection({ values, onChange, images }) {
  const handleFileChange = (index, event) => {
    const [file] = event.target.files;
    if (images.replace(index, file)) event.target.value = '';
  };

  return (
    <section className="rounded-xl border border-[#dbe5da] bg-white p-5 shadow-sm sm:p-6">
      <div className="mb-5">
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[#4e7f55]">04 · Evidencia y observaciones</p>
        <h2 className="mt-1 text-lg font-semibold text-[#1f2922]">Evidencia y observaciones</h2>
        <p className="mt-1 text-sm text-[#617064]">Las imágenes son opcionales. JPG, PNG o WebP · Máximo 10 MB.</p>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        {images.items.map((item, index) => {
          const inputId = `evidencia-${index + 1}`;
          return (
            <article key={inputId} className="rounded-lg border border-[#e0e8df] bg-[#f8fbf7] p-3">
              <h3 className="text-sm font-semibold text-[#314237]">Evidencia {index + 1}</h3>
              <div className="mt-3 flex aspect-[4/3] items-center justify-center overflow-hidden rounded-md border border-dashed border-[#cfdccf] bg-white">
                {item ? <img src={item.previewUrl} alt={`Vista previa de evidencia ${index + 1}`} className="h-full w-full object-cover" /> : <span className="px-4 text-center text-xs text-[#617064]">Sin imagen seleccionada</span>}
              </div>
              <p className="mt-3 min-h-9 break-words text-xs text-[#56685a]">{item ? `${item.file.name} · ${formatFileSize(item.file.size)}` : 'JPG, PNG o WebP · Máximo 10 MB'}</p>
              <input id={inputId} type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" onChange={(event) => handleFileChange(index, event)} />
              <div className="mt-3 flex gap-2">
                <label htmlFor={inputId} className="cursor-pointer rounded-lg border border-[#39744a] px-3 py-2 text-xs font-semibold text-[#2f713b] transition hover:bg-[#eff8ee] focus-within:outline-none focus-within:ring-2 focus-within:ring-[#b8d8b4]">{item ? 'Cambiar' : 'Seleccionar'}</label>
                {item && <button type="button" onClick={() => images.remove(index)} className="rounded-lg px-3 py-2 text-xs font-semibold text-[#56685a] hover:bg-[#e9f0e7] focus:outline-none focus:ring-2 focus:ring-[#b8d8b4]">Quitar</button>}
              </div>
            </article>
          );
        })}
      </div>
      {images.error && <p className="mt-3 text-sm text-[#a52d24]" role="alert">{images.error}</p>}

      <label className="mb-1.5 mt-5 block text-sm font-semibold text-[#314237]" htmlFor="observaciones">Observaciones relevantes</label>
      <textarea id="observaciones" name="observaciones" rows="4" value={values.observaciones} onChange={onChange} placeholder="Ingrese observaciones relevantes" className="w-full rounded-lg border border-[#cfdccf] bg-white px-3 py-2.5 text-sm text-[#1f2922] shadow-sm outline-none transition focus:border-[#39744a] focus:ring-2 focus:ring-[#b8d8b4]" />
    </section>
  );
}

export default EvidenciaObservacionesSection;
