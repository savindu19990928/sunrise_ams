import React from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { MoonIcon, SunIcon } from 'lucide-react';
import { twMerge } from 'tailwind-merge';
import { useTheme } from '../../contexts/ThemeContext';

interface ThemeToggleProps {
  className?: string;
  variant?: 'button' | 'switch' | 'menu-item';
  size?: 'sm' | 'md';
}

export function ThemeToggle({
  className,
  variant = 'button',
  size = 'md'
}: ThemeToggleProps) {
  const { isDark, toggleTheme } = useTheme();

  const label = isDark ? 'Switch to light mode' : 'Switch to dark mode';

  if (variant === 'menu-item') {
    return (
      <button
        type="button"
        role="menuitem"
        onClick={toggleTheme}
        className={twMerge(
          'flex w-full items-center justify-between px-3 py-2.5 text-left text-sm text-ink-muted transition-colors duration-150 ease-out hover:bg-canvas hover:text-ink',
          className
        )}
      >
        <span className="flex items-center gap-2">
          {isDark ? (
            <SunIcon className="h-4 w-4 text-warn-500" aria-hidden="true" />
          ) : (
            <MoonIcon className="h-4 w-4 text-brand-600" aria-hidden="true" />
          )}
          <span>{isDark ? 'Dark theme' : 'Light theme'}</span>
        </span>

        {/* Mini Pill Switch */}
        <span
          className={twMerge(
            'relative inline-flex h-5 w-9 shrink-0 items-center rounded-full border border-line transition-colors duration-200 ease-in-out',
            isDark ? 'bg-brand-600 border-brand-600' : 'bg-canvas'
          )}
          aria-hidden="true"
        >
          <span
            className={twMerge(
              'inline-block h-3.5 w-3.5 transform rounded-full bg-surface shadow-sm transition-transform duration-200 ease-in-out',
              isDark ? 'translate-x-4 bg-white' : 'translate-x-0.5 bg-ink'
            )}
          />
        </span>
      </button>
    );
  }

  if (variant === 'switch') {
    return (
      <button
        type="button"
        role="switch"
        aria-checked={isDark}
        aria-label={label}
        title={label}
        onClick={toggleTheme}
        className={twMerge(
          'relative inline-flex h-7 w-13 shrink-0 cursor-pointer items-center rounded-full border border-line bg-surface p-0.5 transition-colors duration-200 ease-in-out hover:border-brand-500/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/20',
          className
        )}
      >
        <span
          className={twMerge(
            'pointer-events-none relative flex h-5.5 w-5.5 items-center justify-center rounded-full shadow-sm transition-transform duration-200 ease-in-out',
            isDark
              ? 'translate-x-6 bg-brand-600 text-white'
              : 'translate-x-0.5 bg-canvas text-ink'
          )}
        >
          {isDark ? (
            <SunIcon className="h-3.5 w-3.5" />
          ) : (
            <MoonIcon className="h-3.5 w-3.5 text-ink-muted" />
          )}
        </span>
      </button>
    );
  }

  // Standard icon button
  const sizeClasses = size === 'sm' ? 'h-8 w-8' : 'h-9 w-9';

  return (
    <button
      type="button"
      onClick={toggleTheme}
      aria-label={label}
      title={label}
      className={twMerge(
        'relative flex items-center justify-center rounded-lg border border-line bg-surface text-ink-muted transition-colors duration-150 ease-out hover:bg-canvas hover:text-ink active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/20',
        sizeClasses,
        className
      )}
    >
      <AnimatePresence mode="wait" initial={false}>
        <motion.div
          key={isDark ? 'dark' : 'light'}
          initial={{ opacity: 0, rotate: -45, scale: 0.7 }}
          animate={{ opacity: 1, rotate: 0, scale: 1 }}
          exit={{ opacity: 0, rotate: 45, scale: 0.7 }}
          transition={{ duration: 0.18, ease: 'easeOut' }}
          className="flex items-center justify-center"
        >
          {isDark ? (
            <SunIcon className="h-4 w-4 text-warn-500" aria-hidden="true" />
          ) : (
            <MoonIcon className="h-4 w-4 text-ink-muted group-hover:text-ink" aria-hidden="true" />
          )}
        </motion.div>
      </AnimatePresence>
    </button>
  );
}
