import DashboardGrid from '../components/dashboard/DashboardGrid';
import { getAuthorizedHrefs } from '../config/navigation';

function DashboardPage({ user, menu }) {
  const name = user?.nombre?.trim() || 'usuario';
  const allowedHrefs = getAuthorizedHrefs(menu);

  return (
    <div className="mx-auto w-full max-w-6xl">
      <section className="mb-7 max-w-2xl">
        <p className="text-sm font-semibold text-[#4e7f55]">MONIPLA</p>
        <h2 className="mt-2 text-2xl font-semibold tracking-tight text-[#1f2922] sm:text-3xl">Hola, {name}</h2>
        <p className="mt-3 text-sm leading-6 text-[#617064] sm:text-base">
          Centralice las tareas principales de monitoreo agrícola y mantenga el registro de terreno al alcance.
        </p>
      </section>
      <DashboardGrid allowedHrefs={allowedHrefs} />
    </div>
  );
}

export default DashboardPage;
