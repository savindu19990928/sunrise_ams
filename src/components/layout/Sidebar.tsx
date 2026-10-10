import React from 'react';
import { NavLink } from 'react-router-dom';
import { BuildingIcon, XIcon } from 'lucide-react';
import { twMerge } from 'tailwind-merge';
import { navSections } from '../../data/navigation';

interface SidebarProps {
  isSuperuser: boolean;
  mobileOpen: boolean;
  onClose: () => void;
}

function NavItems({ isSuperuser, onNavigate }: {isSuperuser: boolean;onNavigate?: () => void;}) {
  return (
    <nav className="flex-1 overflow-y-auto px-3 pb-6" aria-label="Main navigation">
      {navSections.map((section) => {
        const items = section.items.filter((item) => !item.superuserOnly || isSuperuser);
        if (!items.length) return null;
        return (
          <div key={section.label} className="mt-5 first:mt-2">
            <p className="px-2.5 pb-1.5 text-[11px] font-semibold uppercase tracking-[0.08em] text-ink-soft">
              {section.label}
            </p>
            <ul className="space-y-0.5">
              {items.map((item) =>
              <li key={item.to}>
                  <NavLink
                  to={item.to}
                  end={item.to === '/'}
                  onClick={onNavigate}
                  className={({ isActive }) =>
                  twMerge(
                    'flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm transition-colors duration-150 ease-out',
                    isActive ?
                    'bg-brand-50 font-medium text-brand-700' :
                    'text-ink-muted hover:bg-canvas hover:text-ink'
                  )
                  }>
                  
                    <item.icon className="h-4 w-4 flex-none" aria-hidden="true" />
                    <span className="truncate">{item.label}</span>
                  </NavLink>
                </li>
              )}
            </ul>
          </div>);

      })}
    </nav>);

}

function Brand() {
  return (
    <div className="flex items-center gap-2.5 px-5 py-4">
      <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand-600 text-white">
        <BuildingIcon className="h-5 w-5" aria-hidden="true" />
      </span>
      <div className="min-w-0">
        <p className="truncate text-sm font-semibold text-ink">Sunrise Apartments AMS</p>
        <p className="truncate text-[11px] text-ink-soft">Accommodation management</p>
      </div>
    </div>);

}

export function Sidebar({ isSuperuser, mobileOpen, onClose }: SidebarProps) {
  return (
    <>
      {/* Desktop */}
      <aside className="hidden w-64 flex-none border-r border-line bg-surface lg:flex lg:flex-col">
        <Brand />
        <NavItems isSuperuser={isSuperuser} />
      </aside>

      {/* Mobile drawer */}
      {mobileOpen &&
      <div className="fixed inset-0 z-40 lg:hidden">
          <div className="absolute inset-0 bg-ink/35" onClick={onClose} aria-hidden="true" />
          <aside className="relative flex h-full w-[17rem] max-w-[82%] flex-col border-r border-line bg-surface shadow-pop">
            <div className="flex items-center justify-between">
              <Brand />
              <button
              type="button"
              onClick={onClose}
              aria-label="Close navigation"
              className="mr-3 flex h-8 w-8 items-center justify-center rounded-lg text-ink-soft transition-colors duration-150 ease-out hover:bg-canvas hover:text-ink">
              
                <XIcon className="h-4 w-4" />
              </button>
            </div>
            <NavItems isSuperuser={isSuperuser} onNavigate={onClose} />
          </aside>
        </div>
      }
    </>);

}