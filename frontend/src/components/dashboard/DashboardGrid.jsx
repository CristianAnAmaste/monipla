import { Bug, Search, Users } from 'lucide-react';
import DashboardCard from './DashboardCard';

function DashboardGrid({ isAdmin }) {
  const cards = [
    {
      title: 'Monitoreo de Plagas',
      description: 'Registre, consulte y actualice los monitoreos de plagas realizados en terreno.',
      icon: Bug,
      accentClass: 'bg-[#e7f1e4] text-[#2f713b]',
      actions: [
        { label: 'Registrar monitoreo', href: '/monitoreos/nuevo' },
        { label: 'Ver historial', href: '/monitoreos/historial' },
        { label: 'Editar monitoreo', href: '/monitoreos/editar' },
      ],
    },
    {
      title: 'Chanchito Blanco',
      description: 'Acceda al registro y al historial específico de monitoreos de Chanchito Blanco.',
      icon: Search,
      accentClass: 'bg-[#f4ece1] text-[#8a5a2b]',
      actions: [
        { label: 'Registrar Chanchito', href: '/chanchitos/nuevo' },
        { label: 'Ver historial', href: '/chanchitos/historial' },
      ],
    },
  ];

  if (isAdmin) {
    cards.push({
      title: 'Administración',
      description: 'Gestione los usuarios con acceso al sistema interno de monitoreo.',
      icon: Users,
      accentClass: 'bg-[#e9eef5] text-[#3c5875]',
      actions: [{ label: 'Manejo de usuarios', href: '/usuarios' }],
    });
  }

  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
      {cards.map((card) => (
        <DashboardCard key={card.title} {...card} />
      ))}
    </div>
  );
}

export default DashboardGrid;
