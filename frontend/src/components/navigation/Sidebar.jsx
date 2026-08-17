import { Leaf, LogOut } from 'lucide-react';
import {
  administrationNavigationItem,
  homeNavigationItem,
  navigationGroups,
} from '../../config/navigation';
import UserProfile from '../layout/UserProfile';
import SidebarGroup from './SidebarGroup';
import SidebarItem from './SidebarItem';

function Sidebar({ user, currentPath, onNavigate, className = '' }) {
  const isAdmin = user?.rol === 'admin';

  return (
    <aside className={`flex h-full min-h-0 w-[270px] flex-col bg-[#173d26] text-white ${className}`} aria-label="Menú principal">
      <a
        className="flex items-center gap-3 border-b border-[#315b39] px-5 py-5 text-white focus-visible:outline-2 focus-visible:outline-offset-[-4px] focus-visible:outline-[#a8d5a2]"
        href="/home"
        onClick={onNavigate}
        aria-label="Monitoreo de Plagas, ir al inicio"
      >
        <span className="flex size-9 items-center justify-center rounded-lg bg-[#76a96b] text-[#153620]">
          <Leaf className="size-5" strokeWidth={2.1} aria-hidden="true" />
        </span>
        <span className="min-w-0 text-sm font-semibold leading-tight tracking-wide">Monitoreo de Plagas</span>
      </a>

      <nav className="min-h-0 flex-1 space-y-1 overflow-y-auto px-3 py-4" aria-label="Navegación principal">
        <SidebarItem item={homeNavigationItem} currentPath={currentPath} onNavigate={onNavigate} />
        <div className="my-3 border-t border-[#315b39]" />
        {navigationGroups.map((group) => (
          <SidebarGroup key={group.id} group={group} currentPath={currentPath} onNavigate={onNavigate} />
        ))}
        {isAdmin && (
          <>
            <div className="my-3 border-t border-[#315b39]" />
            <SidebarItem item={administrationNavigationItem} currentPath={currentPath} onNavigate={onNavigate} />
          </>
        )}
      </nav>

      <div className="shrink-0 border-t border-[#315b39] p-3">
        <UserProfile user={user} />
        <a
          className="mt-2 flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-[#e7c8b0] transition-colors hover:bg-[#315b39] hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#a8d5a2]"
          href="/logout"
          onClick={onNavigate}
        >
          <LogOut className="size-4" strokeWidth={1.9} aria-hidden="true" />
          Cerrar sesión
        </a>
      </div>
    </aside>
  );
}

export default Sidebar;
