class DashboardService {
  buildCards(usuario) {
    const cards = [
      {
        title: 'Registrar Monitoreo',
        description: 'Ingreso de nuevos registros de monitoreo en terreno.',
        href: '/monitoreos/nuevo',
        mark: 'RM',
      },
      {
        title: 'Monitoreo Chanchito Blanco',
        description: 'Registro de monitoreo de Chanchito Blanco.',
        href: '/chanchitos/nuevo',
        mark: 'CH',
      },
      {
        title: 'Historial de Monitoreo',
        description: 'Consulta organizada de registros capturados.',
        href: '/monitoreos/historial',
        mark: 'HM',
      },
      {
        title: 'Editar Monitoreo',
        description: 'Actualizacion de informacion registrada previamente.',
        href: '/monitoreos/editar',
        mark: 'EM',
      },
    ];

    if (usuario && usuario.rol === 'admin') {
      cards.push({
        title: 'Administracion de Usuarios',
        description: 'Gestion de cuentas, roles, sedes y estados de acceso.',
        href: '/usuarios',
        mark: 'AU',
      });
    }

    return cards;
  }
}

module.exports = DashboardService;
