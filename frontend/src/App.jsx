import { useEffect, useState } from 'react';
import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import AppShell from './components/layout/AppShell';
import DashboardPage from './pages/DashboardPage';
import NuevoMonitoreoChanchitosPage from './pages/chanchitos/NuevoMonitoreoChanchitosPage';

function App() {
  const location = useLocation();
  const [bootstrap, setBootstrap] = useState({ status: 'loading', data: null });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    const controller = new AbortController();

    async function loadBootstrap() {
      setBootstrap({ status: 'loading', data: null });

      try {
        const response = await fetch('/app/bootstrap', {
          credentials: 'include',
          signal: controller.signal,
        });

        if (response.status === 401) {
          window.location.assign('/login');
          return;
        }

        if (!response.ok) {
          throw new Error('BOOTSTRAP_ERROR');
        }

        const data = await response.json();
        if (!data || !data.user || !Array.isArray(data.menu)) {
          throw new Error('BOOTSTRAP_INVALIDO');
        }

        setBootstrap({ status: 'ready', data });
      } catch (error) {
        if (error.name !== 'AbortError') {
          setBootstrap({ status: 'error', data: null });
        }
      }
    }

    loadBootstrap();

    return () => controller.abort();
  }, [attempt]);

  if (bootstrap.status === 'loading') {
    return (
      <main className="flex min-h-svh items-center justify-center bg-[#f4f7f2] p-6">
        <p className="rounded-lg border border-[#dbe5da] bg-white px-4 py-3 text-sm text-[#425347] shadow-sm">Cargando aplicación…</p>
      </main>
    );
  }

  if (bootstrap.status === 'error') {
    return (
      <main className="flex min-h-svh items-center justify-center bg-[#f4f7f2] p-6">
        <section className="max-w-sm rounded-xl border border-[#dbe5da] bg-white p-6 text-center shadow-sm">
          <h1 className="text-lg font-semibold text-[#1f2922]">No fue posible cargar la aplicación</h1>
          <p className="mt-2 text-sm leading-6 text-[#617064]">Intente nuevamente en unos momentos.</p>
          <button
            type="button"
            className="mt-5 rounded-lg bg-[#2f713b] px-4 py-2 text-sm font-semibold text-white hover:bg-[#245c2f] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#39744a]"
            onClick={() => setAttempt((value) => value + 1)}
          >
            Reintentar
          </button>
        </section>
      </main>
    );
  }

  const { user, menu } = bootstrap.data;

  return (
    <AppShell user={user} menu={menu} currentPath={location.pathname}>
      <Routes>
        <Route path="/app" element={<DashboardPage user={user} menu={menu} />} />
        <Route path="/app/chanchitos/nuevo" element={<NuevoMonitoreoChanchitosPage />} />
        <Route path="/" element={<Navigate to="/app" replace />} />
        <Route path="*" element={<Navigate to="/app" replace />} />
      </Routes>
    </AppShell>
  );
}

export default App;
