import { Link } from 'react-router-dom';
import { Leaf, LogOut } from 'lucide-react';
import { getAuthorizedNavigation } from '../../config/navigation';
import UserProfile from '../layout/UserProfile';
import SidebarGroup from './SidebarGroup';
import SidebarItem from './SidebarItem';

function Sidebar({ user, menu, currentPath, onNavigate, className = '' }) {
  const navigation = getAuthorizedNavigation(menu);

  return (
    <aside className={`flex h-full min-h-0 w-[270px] flex-col bg-[#173d26] text-white ${className}`} aria-label="Menú principal">
      <Link
        className="flex items-center gap-3 border-b border-[#315b39] px-5 py-5 text-white focus-visible:outline-2 focus-visible:outline-offset-[-4px] focus-visible:outline-[#a8d5a2]"
        to="/app"
        onClick={onNavigate}
        aria-label="Monitoreo de Plagas, ir al inicio"
      >
        <span className="flex size-9 items-center justify-center rounded-lg bg-[#76a96b] text-[#153620]">
          <Leaf className="size-5" strokeWidth={2.1} aria-hidden="true" />
        </span>
        <span className="min-w-0 text-sm font-semibold leading-tight tracking-wide">Monitoreo de Plagas</span>
      </Link>

      <nav className="min-h-0 flex-1 space-y-1 overflow-y-auto px-3 py-4" aria-label="Navegación principal">
        {navigation.home && <SidebarItem item={navigation.home} currentPath={currentPath} onNavigate={onNavigate} />}
        {navigation.home && navigation.groups.length > 0 && <div className="my-3 border-t border-[#315b39]" />}
        {navigation.groups.map((group) => (
          <SidebarGroup key={group.id} group={group} currentPath={currentPath} onNavigate={onNavigate} />
        ))}
        {navigation.administration && (
          <>
            <div className="my-3 border-t border-[#315b39]" />
            <SidebarItem item={navigation.administration} currentPath={currentPath} onNavigate={onNavigate} />
          </>
        )}
      </nav>

      <div className="shrink-0 border-t border-[#315b39] p-3">
        <UserProfile user={user} />
        {navigation.logout && (
          <a
            className="mt-2 flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-[#e7c8b0] transition-colors hover:bg-[#315b39] hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#a8d5a2]"
            href={navigation.logout.href}
            onClick={onNavigate}
          >
            <LogOut className="size-4" strokeWidth={1.9} aria-hidden="true" />
            {navigation.logout.label}
          </a>
        )}
      </div>
    </aside>
  );
}

export default Sidebar;
