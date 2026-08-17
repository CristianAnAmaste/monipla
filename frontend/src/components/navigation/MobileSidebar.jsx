import { useEffect } from 'react';
import { X } from 'lucide-react';
import Sidebar from './Sidebar';

function MobileSidebar({ isOpen, onClose, user, menu, currentPath }) {
  useEffect(() => {
    if (!isOpen) {
      return undefined;
    }

    const previousOverflow = document.body.style.overflow;
    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };

    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onClose]);

  if (!isOpen) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 lg:hidden">
      <button
        type="button"
        className="absolute inset-0 cursor-default bg-[#0d2315]/55"
        onClick={onClose}
        aria-label="Cerrar menú móvil"
      />
      <div className="relative h-full w-[min(84vw,300px)] shadow-2xl">
        <Sidebar user={user} menu={menu} currentPath={currentPath} onNavigate={onClose} className="w-full shadow-none" />
        <button
          type="button"
          className="absolute right-3 top-3 flex size-9 items-center justify-center rounded-lg text-white hover:bg-[#315b39] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#a8d5a2]"
          onClick={onClose}
          aria-label="Cerrar menú"
        >
          <X className="size-5" aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}

export default MobileSidebar;
