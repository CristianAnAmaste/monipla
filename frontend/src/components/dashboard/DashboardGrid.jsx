import { Bug, Search, Users } from 'lucide-react';
import DashboardCard from './DashboardCard';

function DashboardGrid({ navigation }) {
  const itemsFor = (groupId) => navigation.groups.find((group) => group.id === groupId)?.items || [];
  const cards = [
    {
      title: 'Monitoreo de Plagas',
      description: 'Registre, consulte y actualice los monitoreos de plagas realizados en terreno.',
      icon: Bug,
      accentClass: 'bg-[#e7f1e4] text-[#2f713b]',
      actions: itemsFor('monitoreos'),
    },
    {
      title: 'Chanchito Blanco',
      description: 'Acceda al registro y al historial específico de monitoreos de Chanchito Blanco.',
      icon: Search,
      accentClass: 'bg-[#f4ece1] text-[#8a5a2b]',
      actions: itemsFor('chanchitos'),
    },
  ];

  if (navigation.administration) {
    cards.push({
      title: 'Administración',
      description: 'Gestione los usuarios con acceso al sistema interno de monitoreo.',
      icon: Users,
      accentClass: 'bg-[#e9eef5] text-[#3c5875]',
      actions: [navigation.administration],
    });
  }

  const visibleCards = cards.filter((card) => card.actions.length > 0);

  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
      {visibleCards.map((card) => (
        <DashboardCard key={card.title} {...card} />
      ))}
    </div>
  );
}

export default DashboardGrid;
