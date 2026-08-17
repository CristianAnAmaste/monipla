import { useState } from 'react';
import MobileSidebar from '../navigation/MobileSidebar';
import Sidebar from '../navigation/Sidebar';
import Topbar from './Topbar';

function AppShell({ user, currentPath, children }) {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  return (
    <div className="min-h-svh bg-[#f4f7f2] lg:pl-[270px]">
      <div className="fixed inset-y-0 left-0 z-30 hidden lg:block">
        <Sidebar user={user} currentPath={currentPath} />
      </div>
      <MobileSidebar
        isOpen={isMobileMenuOpen}
        onClose={() => setIsMobileMenuOpen(false)}
        user={user}
        currentPath={currentPath}
      />
      <div className="flex min-h-svh flex-col">
        <Topbar onMenuOpen={() => setIsMobileMenuOpen(true)} />
        <main className="flex-1 px-4 py-7 sm:px-6 lg:px-8 lg:py-9">{children}</main>
      </div>
    </div>
  );
}

export default AppShell;
