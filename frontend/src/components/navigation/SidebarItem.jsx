import { isRouteActive } from '../../config/navigation';

function SidebarItem({ item, currentPath, nested = false, isCollapsed = false, onNavigate }) {
  const Icon = item.icon;
  const active = isRouteActive(currentPath, item.href);

  return (
    <a
      className={`group flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#a8d5a2] ${
        nested ? 'ml-3' : ''
      } ${
        active
          ? 'bg-[#3d6d44] text-white shadow-sm'
          : 'text-[#dcebdc] hover:bg-[#315b39] hover:text-white'
      }`}
      href={item.href}
      onClick={onNavigate}
      aria-current={active ? 'page' : undefined}
      tabIndex={isCollapsed ? -1 : undefined}
    >
      <Icon className="size-4 shrink-0" strokeWidth={1.9} aria-hidden="true" />
      <span className="min-w-0 leading-5">{item.label}</span>
    </a>
  );
}

export default SidebarItem;
