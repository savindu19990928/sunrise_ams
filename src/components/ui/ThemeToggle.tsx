import React from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { MonitorIcon, MoonIcon, SunIcon } from 'lucide-react';
import { twMerge } from 'tailwind-merge';
import { useTheme } from '../../contexts/ThemeContext';

export interface ThemeToggleProps {
  className?: string;
  variant?: 'button' | 'switch' | 'menu-item' | 'segmented';
  size?: 'sm' | 'md';
}

export function ThemeToggle({
  className,
  variant = 'button',
  size = 'md',
}: ThemeToggleProps) {
  const { theme, resolvedTheme, systemIsDark, isDark, toggleTheme, setTheme } = useTheme();

  const getLabel = () => {
    if (theme === 'system') {
      return `Theme: System (${resolvedTheme === 'dark' ? 'Dark' : 'Light'}) · Click to switch`;
    }
    if (theme === 'light') {
      return 'Theme: Light · Click to switch';
    }
    return 'Theme: Dark · Click to switch';
  };

  const label = getLabel();

  // Segmented control variant
  if (variant === 'segmented') {
    return (
      <div
        role="group"
        aria-label="Theme mode selector"
        className={twMerge(
          'inline-flex items-center rounded-xl border border-line bg-canvas p-1',
          className
        )}
      >
        <button
          type="button"
          onClick={() => setTheme('light')}
          aria-pressed={theme === 'light'}
          className={twMerge(
            'flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-all duration-150',
            theme === 'light'
              ? 'bg-surface text-ink shadow-sm ring-1 ring-line font-semibold'
              : 'text-ink-muted hover:text-ink hover:bg-surface/50'
          )}
        >
          <SunIcon className="h-3.5 w-3.5 text-warn-500" aria-hidden="true" />
          <span>Light</span>
        </button>

        <button
          type="button"
          onClick={() => setTheme('dark')}
          aria-pressed={theme === 'dark'}
          className={twMerge(
            'flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-all duration-150',
            theme === 'dark'
              ? 'bg-surface text-ink shadow-sm ring-1 ring-line font-semibold'
              : 'text-ink-muted hover:text-ink hover:bg-surface/50'
          )}
        >
          <MoonIcon className="h-3.5 w-3.5 text-brand-600 dark:text-brand-400" aria-hidden="true" />
          <span>Dark</span>
        </button>

        <button
          type="button"
          onClick={() => setTheme('system')}
          aria-pressed={theme === 'system'}
          title={`System default (matches OS: ${systemIsDark ? 'Dark' : 'Light'})`}
          className={twMerge(
            'flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-all duration-150',
            theme === 'system'
              ? 'bg-surface text-ink shadow-sm ring-1 ring-line font-semibold'
              : 'text-ink-muted hover:text-ink hover:bg-surface/50'
          )}
        >
          <MonitorIcon className="h-3.5 w-3.5 text-ink-muted" aria-hidden="true" />
          <span>System</span>
        </button>
      </div>
    );
  }

  // Dropdown menu item variant
  if (variant === 'menu-item') {
    return (
      <div className={twMerge('px-3 py-2.5', className)}>
        <div className="mb-2 flex items-center justify-between">
          <span className="text-xs font-semibold text-ink">Appearance</span>
          <span className="text-[11px] font-medium text-ink-muted capitalize">
            {theme === 'system' ? `System (${resolvedTheme})` : theme}
          </span>
        </div>
        <div className="grid grid-cols-3 gap-1 rounded-lg border border-line bg-canvas p-1">
          <button
            type="button"
            onClick={() => setTheme('light')}
            title="Light mode"
            aria-pressed={theme === 'light'}
            className={twMerge(
              'flex items-center justify-center gap-1.5 rounded-md py-1.5 text-xs font-medium transition-all duration-150',
              theme === 'light'
                ? 'bg-surface text-ink shadow-sm ring-1 ring-line font-semibold'
                : 'text-ink-muted hover:text-ink hover:bg-surface/50'
            )}
          >
            <SunIcon className="h-3.5 w-3.5 text-warn-500" aria-hidden="true" />
            <span>Light</span>
          </button>

          <button
            type="button"
            onClick={() => setTheme('dark')}
            title="Dark mode"
            aria-pressed={theme === 'dark'}
            className={twMerge(
              'flex items-center justify-center gap-1.5 rounded-md py-1.5 text-xs font-medium transition-all duration-150',
              theme === 'dark'
                ? 'bg-surface text-ink shadow-sm ring-1 ring-line font-semibold'
                : 'text-ink-muted hover:text-ink hover:bg-surface/50'
            )}
          >
            <MoonIcon className="h-3.5 w-3.5 text-brand-600 dark:text-brand-400" aria-hidden="true" />
            <span>Dark</span>
          </button>

          <button
            type="button"
            onClick={() => setTheme('system')}
            title={`System default (${systemIsDark ? 'Dark' : 'Light'})`}
            aria-pressed={theme === 'system'}
            className={twMerge(
              'flex items-center justify-center gap-1.5 rounded-md py-1.5 text-xs font-medium transition-all duration-150',
              theme === 'system'
                ? 'bg-surface text-ink shadow-sm ring-1 ring-line font-semibold'
                : 'text-ink-muted hover:text-ink hover:bg-surface/50'
            )}
          >
            <MonitorIcon className="h-3.5 w-3.5 text-ink-muted" aria-hidden="true" />
            <span>System</span>
          </button>
        </div>
      </div>
    );
  }

  // Switch pill variant
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
          {theme === 'system' ? (
            <MonitorIcon className="h-3.5 w-3.5" />
          ) : isDark ? (
            <MoonIcon className="h-3.5 w-3.5" />
          ) : (
            <SunIcon className="h-3.5 w-3.5 text-warn-500" />
          )}
        </span>
      </button>
    );
  }

  // Standard icon button (cycles: light -> dark -> system -> light)
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
          key={theme}
          initial={{ opacity: 0, rotate: -45, scale: 0.7 }}
          animate={{ opacity: 1, rotate: 0, scale: 1 }}
          exit={{ opacity: 0, rotate: 45, scale: 0.7 }}
          transition={{ duration: 0.18, ease: 'easeOut' }}
          className="flex items-center justify-center"
        >
          {theme === 'system' ? (
            <MonitorIcon className="h-4 w-4 text-brand-600 dark:text-brand-400" aria-hidden="true" />
          ) : theme === 'dark' ? (
            <MoonIcon className="h-4 w-4 text-brand-600 dark:text-brand-400" aria-hidden="true" />
          ) : (
            <SunIcon className="h-4 w-4 text-warn-500" aria-hidden="true" />
          )}
        </motion.div>
      </AnimatePresence>
    </button>
  );
}
