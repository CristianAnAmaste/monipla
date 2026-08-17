import {
  Bug,
  ClipboardPlus,
  History,
  LayoutDashboard,
  Pencil,
  Search,
  Users,
} from 'lucide-react';

export const navigationGroups = [
  {
    id: 'monitoreos',
    label: 'Monitoreo de Plagas',
    icon: Bug,
    items: [
      { label: 'Registrar monitoreo', href: '/monitoreos/nuevo', icon: ClipboardPlus },
      { label: 'Historial de monitoreo', href: '/monitoreos/historial', icon: History },
      { label: 'Editar monitoreo', href: '/monitoreos/editar', icon: Pencil },
    ],
  },
  {
    id: 'chanchitos',
    label: 'Monitoreo Chanchito Blanco',
    icon: Search,
    items: [
      { label: 'Registrar Chanchito', href: '/chanchitos/nuevo', icon: ClipboardPlus },
      { label: 'Historial Chanchito', href: '/chanchitos/historial', icon: History },
    ],
  },
];

export const homeNavigationItem = {
  label: 'Inicio',
  href: '/home',
  icon: LayoutDashboard,
};

export const administrationNavigationItem = {
  label: 'Manejo de usuarios',
  href: '/usuarios',
  icon: Users,
};

export function isRouteActive(currentPath, href) {
  return currentPath === href || currentPath.startsWith(`${href}/`);
}

export function getAuthorizedNavigation(menu = []) {
  const itemsByHref = new Map(menu.map((item) => [item.href, item]));
  const authorize = (item) => {
    const authorizedItem = itemsByHref.get(item.href);

    return authorizedItem ? { ...item, label: authorizedItem.label } : null;
  };

  return {
    home: authorize(homeNavigationItem),
    groups: navigationGroups
      .map((group) => ({
        ...group,
        items: group.items.map(authorize).filter(Boolean),
      }))
      .filter((group) => group.items.length > 0),
    administration: authorize(administrationNavigationItem),
    logout: itemsByHref.get('/logout') || null,
  };
}

export function getAuthorizedHrefs(menu = []) {
  return new Set(menu.map((item) => item.href));
}
