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
      { label: 'Registrar monitoreo', href: '/monitoreos/nuevo', icon: ClipboardPlus, routeType: 'legacy' },
      { label: 'Historial de monitoreo', href: '/monitoreos/historial', icon: History, routeType: 'legacy' },
      { label: 'Editar monitoreo', href: '/monitoreos/editar', icon: Pencil, routeType: 'legacy' },
    ],
  },
  {
    id: 'chanchitos',
    label: 'Monitoreo Chanchito Blanco',
    icon: Search,
    items: [
      {
        label: 'Registrar Chanchito',
        href: '/app/chanchitos/nuevo',
        authorizationHref: '/chanchitos/nuevo',
        icon: ClipboardPlus,
        routeType: 'react',
      },
      {
        label: 'Historial Chanchito',
        href: '/app/chanchitos/historial',
        authorizationHref: '/chanchitos/historial',
        icon: History,
        routeType: 'react',
      },
    ],
  },
];

export const homeNavigationItem = {
  label: 'Inicio',
  href: '/app',
  authorizationHref: '/home',
  icon: LayoutDashboard,
  routeType: 'react',
};

export const administrationNavigationItem = {
  label: 'Manejo de usuarios',
  href: '/usuarios',
  icon: Users,
  routeType: 'legacy',
};

export function isRouteActive(currentPath, href) {
  return currentPath === href || currentPath.startsWith(`${href}/`);
}

export function getAuthorizedNavigation(menu = []) {
  const itemsByHref = new Map(menu.map((item) => [item.href, item]));
  const authorize = (item) => {
    const authorizedItem = itemsByHref.get(item.authorizationHref || item.href);

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
