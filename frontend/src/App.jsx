import AppShell from './components/layout/AppShell';
import DashboardPage from './pages/DashboardPage';

const mockUser = {
  nombre: 'Cristian Yanez',
  rol: 'admin',
  sede: 'Copiapo',
};

function App({ user = mockUser }) {
  const currentPath = '/home';

  return (
    <AppShell user={user} currentPath={currentPath}>
      <DashboardPage user={user} />
    </AppShell>
  );
}

export default App;
