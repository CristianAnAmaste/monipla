const test = require('node:test');
const assert = require('node:assert/strict');
const DashboardService = require('../src/services/dashboard.service');
const NavigationService = require('../src/services/navigation.service');

test('el dashboard incluye el acceso a Monitoreo Chanchito Blanco', () => {
  const cards = new DashboardService().buildCards({ rol: 'usuario' });

  assert.deepEqual(cards.find((card) => card.href === '/chanchitos/nuevo'), {
    title: 'Monitoreo Chanchito Blanco',
    description: 'Registro de monitoreo de Chanchito Blanco.',
    href: '/chanchitos/nuevo',
    mark: 'CH',
  });
});

test('el menu separa el registro y el historial de Chanchito Blanco', () => {
  const menu = new NavigationService().buildMenu({ rol: 'usuario' }, '/chanchitos/nuevo');

  assert.deepEqual(menu.find((item) => item.href === '/chanchitos/nuevo'), {
    label: 'Monitoreo Chanchito Blanco',
    href: '/chanchitos/nuevo',
    icon: 'CH',
    match: ['/chanchitos/nuevo', '/chanchitos/pdf/general'],
    active: true,
  });
  assert.equal(menu.find((item) => item.href === '/chanchitos/historial').active, false);
  assert.equal(new NavigationService().buildMenu({ rol: 'usuario' }, '/chanchitos/439')
    .find((item) => item.href === '/chanchitos/historial').active, true);
});
