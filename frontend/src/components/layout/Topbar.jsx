import { Menu } from 'lucide-react';

function Topbar({ onMenuOpen }) {
  return (
    <header className="flex min-h-16 items-center border-b border-[#dbe5da] bg-white px-4 sm:px-6 lg:px-8">
      <button
        type="button"
        className="mr-3 flex size-10 items-center justify-center rounded-lg text-[#214b2c] hover:bg-[#edf4eb] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#39744a] lg:hidden"
        onClick={onMenuOpen}
        aria-label="Abrir menú principal"
      >
        <Menu className="size-5" aria-hidden="true" />
      </button>
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#5e7a63]">Sistema interno</p>
        <h1 className="mt-0.5 text-lg font-semibold tracking-tight text-[#1f2922]">Panel principal</h1>
      </div>
    </header>
  );
}

export default Topbar;
