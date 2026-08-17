import { useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { isRouteActive } from '../../config/navigation';
import SidebarItem from './SidebarItem';

function SidebarGroup({ group, currentPath, onNavigate }) {
  const hasActiveItem = group.items.some((item) => isRouteActive(currentPath, item.href));
  const [isOpen, setIsOpen] = useState(hasActiveItem);
  const Icon = group.icon;
  const contentId = `navigation-group-${group.id}`;

  return (
    <section>
      <button
        type="button"
        className={`flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#a8d5a2] ${
          hasActiveItem || isOpen
            ? 'bg-[#315b39] text-white'
            : 'text-[#dcebdc] hover:bg-[#315b39] hover:text-white'
        }`}
        onClick={() => setIsOpen((open) => !open)}
        aria-expanded={isOpen}
        aria-controls={contentId}
      >
        <Icon className="size-4 shrink-0" strokeWidth={1.9} aria-hidden="true" />
        <span className="min-w-0 flex-1 leading-5">{group.label}</span>
        <ChevronDown
          className={`size-4 shrink-0 transition-transform duration-150 ${isOpen ? 'rotate-180' : ''}`}
          aria-hidden="true"
        />
      </button>
      <div
        id={contentId}
        className={`grid transition-[grid-template-rows,opacity] duration-150 ease-out ${
          isOpen ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'
        }`}
      >
        <div className="overflow-hidden pt-1">
          <div className="space-y-0.5 border-l border-[#61866a] py-1">
            {group.items.map((item) => (
              <SidebarItem
                key={item.href}
                item={item}
                currentPath={currentPath}
                nested
                isCollapsed={!isOpen}
                onNavigate={onNavigate}
              />
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

export default SidebarGroup;
