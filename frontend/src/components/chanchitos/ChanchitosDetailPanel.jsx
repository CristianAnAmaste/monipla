import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import ChanchitosDetail from './ChanchitosDetail';

const FOCUSABLE_SELECTOR = 'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

function ChanchitosDetailPanel({ isOpen, detailState, onClose }) {
  const panelRef = useRef(null);
  const closeButtonRef = useRef(null);

  useEffect(() => {
    if (!isOpen) return undefined;

    const previousFocus = document.activeElement;
    const appRoot = document.getElementById('root');
    const previousOverflow = document.body.style.overflow;
    const previousAriaHidden = appRoot?.getAttribute('aria-hidden');
    const previousInert = appRoot?.inert;
    document.body.style.overflow = 'hidden';
    if (appRoot) {
      appRoot.inert = true;
      appRoot.setAttribute('aria-hidden', 'true');
    }
    window.requestAnimationFrame(() => closeButtonRef.current?.focus());

    const onKeyDown = (event) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        onClose();
        return;
      }
      if (event.key !== 'Tab') return;

      const focusable = [...(panelRef.current?.querySelectorAll(FOCUSABLE_SELECTOR) || [])];
      if (focusable.length === 0) {
        event.preventDefault();
        return;
      }
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      document.body.style.overflow = previousOverflow;
      if (appRoot) {
        appRoot.inert = previousInert;
        if (previousAriaHidden === null) appRoot.removeAttribute('aria-hidden');
        else appRoot.setAttribute('aria-hidden', previousAriaHidden);
      }
      previousFocus?.focus?.();
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const content = detailState?.status === 'loading' || !detailState
    ? <p className="p-5 text-sm text-[#617064]">Cargando detalle…</p>
    : detailState.status === 'error'
      ? <p className="p-5 text-sm text-[#8e2e26]" role="alert">{detailState.error}</p>
      : <ChanchitosDetail detail={detailState.data} />;

  return createPortal(
    <div className="fixed inset-0 z-50" role="presentation">
      <button type="button" aria-label="Cerrar panel de detalle" onClick={onClose} className="absolute inset-0 cursor-default bg-[#102416]/60" />
      <aside ref={panelRef} className="absolute inset-y-0 right-0 flex w-full flex-col bg-[#f8fbf6] shadow-2xl md:w-[60vw] min-[1200px]:w-[56vw] min-[1200px]:min-w-[720px]" role="dialog" aria-modal="true" aria-labelledby="chanchitos-panel-title">
        <header className="flex shrink-0 items-center justify-between gap-4 border-b border-[#dbe5da] bg-white px-5 py-4">
          <div><p className="text-xs font-semibold uppercase tracking-[0.14em] text-[#4e7f55]">Vista experimental</p><h2 id="chanchitos-panel-title" className="mt-1 text-lg font-semibold text-[#1f2922]">Detalle del monitoreo</h2></div>
          <button ref={closeButtonRef} type="button" aria-label="Cerrar detalle" onClick={onClose} className="inline-flex size-10 items-center justify-center rounded-lg border border-[#b8cbb8] text-[#35563b] hover:bg-[#f2f7f0] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#39744a]"><X className="size-5" aria-hidden="true" /></button>
        </header>
        <div className="min-h-0 flex-1 overflow-y-auto">{content}</div>
      </aside>
    </div>,
    document.body,
  );
}

export default ChanchitosDetailPanel;
