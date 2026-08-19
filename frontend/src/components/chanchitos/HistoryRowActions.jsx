import { useEffect, useRef, useState } from 'react';
import { Download, MoreVertical, Trash2 } from 'lucide-react';

function HistoryRowActions({ record, canDelete, onDelete, onOpenPanel }) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef(null);
  const triggerRef = useRef(null);
  const menuId = `chanchitos-actions-${record.idMonitoreo}`;

  useEffect(() => {
    if (!isOpen) return undefined;

    const closeWhenOutside = (event) => {
      if (!containerRef.current?.contains(event.target)) setIsOpen(false);
    };
    const closeWithEscape = (event) => {
      if (event.key !== 'Escape') return;
      setIsOpen(false);
      triggerRef.current?.focus();
    };

    document.addEventListener('pointerdown', closeWhenOutside);
    window.addEventListener('keydown', closeWithEscape);
    return () => {
      document.removeEventListener('pointerdown', closeWhenOutside);
      window.removeEventListener('keydown', closeWithEscape);
    };
  }, [isOpen]);

  const closeMenu = () => setIsOpen(false);

  return (
    <div ref={containerRef} className="relative" onClick={(event) => event.stopPropagation()}>
      <button
        ref={triggerRef}
        type="button"
        aria-label={`Más acciones para el monitoreo ${record.idMonitoreo}`}
        aria-haspopup="menu"
        aria-expanded={isOpen}
        aria-controls={isOpen ? menuId : undefined}
        onClick={() => setIsOpen((current) => !current)}
        className="inline-flex size-8 items-center justify-center rounded-md border border-[#b8cbb8] text-[#35563b] hover:bg-[#f2f7f0] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#39744a]"
      >
        <MoreVertical className="size-4" aria-hidden="true" />
      </button>
      {isOpen && <div id={menuId} role="menu" aria-label={`Acciones del monitoreo ${record.idMonitoreo}`} className="absolute right-0 z-20 mt-2 w-56 rounded-lg border border-[#dbe5da] bg-white p-1.5 shadow-lg">
        <a role="menuitem" href={`/chanchitos/${record.idMonitoreo}/pdf`} onClick={closeMenu} className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-sm font-medium text-[#35563b] hover:bg-[#f2f7f0] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#39744a]">
          <Download className="size-4" aria-hidden="true" />Descargar PDF individual
        </a>
        <button type="button" role="menuitem" onClick={() => { closeMenu(); onOpenPanel(record.idMonitoreo); }} className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm font-medium text-[#35563b] hover:bg-[#f2f7f0] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#39744a]">
          Abrir panel experimental
        </button>
        {canDelete && <button type="button" role="menuitem" onClick={() => { closeMenu(); onDelete(record); }} className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm font-medium text-[#9f3026] hover:bg-[#fff5f3] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#a43c31]">
          <Trash2 className="size-4" aria-hidden="true" />Eliminar monitoreo
        </button>}
      </div>}
    </div>
  );
}

export default HistoryRowActions;
