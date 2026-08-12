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

test('el menu mantiene activo Monitoreo Chanchito Blanco dentro del modulo', () => {
  const menu = new NavigationService().buildMenu({ rol: 'usuario' }, '/chanchitos/nuevo');

  assert.deepEqual(menu.find((item) => item.href === '/chanchitos/nuevo'), {
    label: 'Monitoreo Chanchito Blanco',
    href: '/chanchitos/nuevo',
    icon: 'CH',
    match: ['/chanchitos'],
    active: true,
  });
});
