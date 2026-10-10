import React, { useState } from 'react';
import { Outlet } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { Footer } from './Footer';
import { Sidebar } from './Sidebar';
import { Topbar } from './Topbar';

export function AppShell() {
  const { user } = useAuth();
  const [navOpen, setNavOpen] = useState(false);

  return (
    <div className="flex min-h-screen w-full bg-canvas">
      <Sidebar
        isSuperuser={Boolean(user?.is_superuser)}
        mobileOpen={navOpen}
        onClose={() => setNavOpen(false)} />
      
      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar onOpenNav={() => setNavOpen(true)} />
        <main className="mx-auto w-full max-w-[1500px] flex-1 px-4 py-5 sm:px-6 sm:py-6 lg:px-8">
          <Outlet />
        </main>
        <Footer className="border-t border-line" />
      </div>
    </div>);

}