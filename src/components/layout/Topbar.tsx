import React, { useEffect, useRef, useState } from 'react';
import { ChevronDownIcon, LogOutIcon, MenuIcon } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { initials } from '../../utils/format';
import { ThemeToggle } from '../ui/ThemeToggle';
import { ReminderBell } from './ReminderBell';

interface TopbarProps {
  onOpenNav: () => void;
}

export function Topbar({ onOpenNav }: TopbarProps) {
  const { user, signOut } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!menuOpen) return;
    const handleClick = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) setMenuOpen(false);
    };
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setMenuOpen(false);
    };
    document.addEventListener('mousedown', handleClick);
    document.addEventListener('keydown', handleKey);
    return () => {
      document.removeEventListener('mousedown', handleClick);
      document.removeEventListener('keydown', handleKey);
    };
  }, [menuOpen]);

  const name = user?.username ?? 'admin';

  return (
    <header className="sticky top-0 z-30 flex h-14 flex-none items-center justify-between gap-3 border-b border-line bg-surface/95 px-4 backdrop-blur sm:px-6">
      <div className="flex min-w-0 items-center gap-2">
        <button
          type="button"
          onClick={onOpenNav}
          aria-label="Open navigation"
          className="flex h-9 w-9 items-center justify-center rounded-lg text-ink-muted transition-colors duration-150 ease-out hover:bg-canvas hover:text-ink lg:hidden">
          
          <MenuIcon className="h-5 w-5" />
        </button>
        <p className="truncate text-[13px] text-ink-muted">
          Admin portal · <span className="text-ink">Sunrise Apartments</span>
        </p>
      </div>

      <div className="flex items-center gap-2 sm:gap-3">
        <ThemeToggle />
        <ReminderBell />
        <div className="relative" ref={menuRef}>
          <button
            type="button"
            onClick={() => setMenuOpen((open) => !open)}
            aria-haspopup="menu"
            aria-expanded={menuOpen}
            className="flex items-center gap-2 rounded-lg border border-line px-2 py-1.5 text-sm text-ink transition-colors duration-150 ease-out hover:bg-canvas">
            
            <span className="flex h-6 w-6 items-center justify-center rounded-md bg-brand-600 text-[11px] font-semibold text-white">
              {initials(name)}
            </span>
            <span className="hidden max-w-[9rem] truncate sm:inline">{name}</span>
            <ChevronDownIcon className="h-3.5 w-3.5 text-ink-soft" aria-hidden="true" />
          </button>

          {menuOpen &&
          <div
            role="menu"
            className="absolute right-0 top-[calc(100%+6px)] w-56 overflow-hidden rounded-xl border border-line bg-surface shadow-pop">
            
              <div className="border-b border-line px-3 py-2.5">
                <p className="truncate text-sm font-medium text-ink">{name}</p>
                <p className="mt-0.5 text-[12px] text-ink-soft">
                  {user?.is_superuser ? 'Superuser' : 'Staff member'}
                </p>
              </div>
              <div className="border-b border-line">
                <ThemeToggle variant="menu-item" />
              </div>
              <button
              type="button"
              role="menuitem"
              onClick={signOut}
              className="flex w-full items-center gap-2 px-3 py-2.5 text-left text-sm text-ink-muted transition-colors duration-150 ease-out hover:bg-canvas hover:text-ink">
              
                <LogOutIcon className="h-4 w-4" aria-hidden="true" />
                Sign out
              </button>
            </div>
          }
        </div>
      </div>
    </header>);

}