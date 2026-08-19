import { useEffect } from 'react';

function ConfirmDeleteDialog({ record, isDeleting, onCancel, onConfirm }) {
  useEffect(() => {
    const onKeyDown = (event) => { if (event.key === 'Escape' && !isDeleting) onCancel(); };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isDeleting, onCancel]);

  if (!record) return null;

  return <div className="fixed inset-0 z-50 grid place-items-center p-4" role="presentation"><button type="button" className="absolute inset-0 cursor-default bg-[#102416]/60" aria-label="Cerrar confirmación" disabled={isDeleting} onClick={onCancel} /><section className="relative z-10 w-full max-w-lg rounded-xl border border-[#dbe5da] bg-white p-6 shadow-xl" role="dialog" aria-modal="true" aria-labelledby="delete-history-title"><p className="text-sm font-semibold text-[#a43c31]">ACCIÓN IRREVERSIBLE</p><h2 id="delete-history-title" className="mt-1 text-xl font-semibold text-[#1f2922]">¿Eliminar este monitoreo?</h2><p className="mt-3 text-sm leading-6 text-[#617064]">Se eliminará el monitoreo #{record.idMonitoreo} de {record.fundo}, junto con sus detalles asociados.</p><div className="mt-6 flex justify-end gap-3"><button type="button" disabled={isDeleting} onClick={onCancel} className="rounded-lg border border-[#b8cbb8] px-4 py-2 text-sm font-semibold text-[#35563b] hover:bg-[#f2f7f0]">Cancelar</button><button type="button" disabled={isDeleting} onClick={onConfirm} className="rounded-lg bg-[#a43c31] px-4 py-2 text-sm font-semibold text-white hover:bg-[#842b23] disabled:cursor-not-allowed disabled:opacity-60">{isDeleting ? 'Eliminando…' : 'Eliminar monitoreo'}</button></div></section></div>;
}

export default ConfirmDeleteDialog;
