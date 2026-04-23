class NavigationService {
  buildMenu(usuario, currentPath = '') {
    if (!usuario) {
      return [];
    }

    const items = [
      {
        label: 'Inicio',
        href: '/home',
        icon: 'IN',
        match: ['/home'],
      },
      {
        label: 'Registrar Monitoreo',
        href: '/monitoreos/nuevo',
        icon: 'RM',
        match: ['/monitoreos/nuevo'],
      },
      {
        label: 'Historial de Monitoreo',
        href: '/monitoreos/historial',
        icon: 'HM',
        match: ['/monitoreos/historial'],
      },
      {
        label: 'Editar Monitoreo',
        href: '/monitoreos/editar',
        icon: 'EM',
        match: ['/monitoreos/editar'],
      },
    ];

    if (usuario.rol === 'admin') {
      items.push({
        label: 'Administracion de Usuarios',
        href: '/usuarios',
        icon: 'AU',
        match: ['/usuarios'],
      });
    }

    items.push({
      label: 'Cerrar sesion',
      href: '/logout',
      icon: 'CS',
      match: ['/logout'],
      type: 'logout',
    });

    return items.map((item) => ({
      ...item,
      active: item.match.some((path) => currentPath === path || currentPath.startsWith(`${path}/`)),
    }));
  }
}

module.exports = NavigationService;
