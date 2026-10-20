import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

export type ThemeMode = 'light' | 'dark' | 'system';
export type Theme = ThemeMode;
export type ResolvedTheme = 'light' | 'dark';

export interface ThemeContextValue {
  /** The chosen theme mode: 'light', 'dark', or 'system' */
  theme: ThemeMode;
  /** The effective resolved theme: 'light' or 'dark' */
  resolvedTheme: ResolvedTheme;
  /** True when the active resolved theme is 'dark' */
  isDark: boolean;
  /** True when the user's OS is recognized as dark mode */
  systemIsDark: boolean;
  /** Cycle theme: light -> dark -> system */
  toggleTheme: () => void;
  /** Set explicit theme mode */
  setTheme: (theme: ThemeMode) => void;
}

const STORAGE_KEY = 'sunrise_ams_theme';

/**
 * Safely inspects operating system dark mode preference.
 * If media queries are unsupported, fail, or the OS theme cannot be recognized,
 * returns false so light mode is used as the safe fallback.
 */
export function getSystemIsDark(): boolean {
  try {
    if (typeof window !== 'undefined' && typeof window.matchMedia === 'function') {
      const mq = window.matchMedia('(prefers-color-scheme: dark)');
      if (mq && typeof mq.matches === 'boolean') {
        return mq.matches;
      }
    }
  } catch {
    // If it cannot recognise the OS theme, fallback to light mode
  }
  return false;
}

function getInitialTheme(): ThemeMode {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved === 'light' || saved === 'dark' || saved === 'system') {
      return saved;
    }
  } catch {
    // ignore storage errors
  }
  // Default to system mode when no preference has been saved
  return 'system';
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<ThemeMode>(getInitialTheme);
  const [systemIsDark, setSystemIsDark] = useState<boolean>(getSystemIsDark);

  // Listen to OS theme changes in real time
  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return;

    let mq: MediaQueryList;
    try {
      mq = window.matchMedia('(prefers-color-scheme: dark)');
    } catch {
      return;
    }
    if (!mq) return;

    const handleChange = (event: MediaQueryListEvent | MediaQueryList) => {
      try {
        const matches = typeof event.matches === 'boolean' ? event.matches : getSystemIsDark();
        setSystemIsDark(matches);
      } catch {
        setSystemIsDark(false);
      }
    };

    if (typeof mq.addEventListener === 'function') {
      mq.addEventListener('change', handleChange);
      return () => mq.removeEventListener('change', handleChange);
    }

    const legacyMq = mq as unknown as {
      addListener?: (cb: (e: MediaQueryListEvent | MediaQueryList) => void) => void;
      removeListener?: (cb: (e: MediaQueryListEvent | MediaQueryList) => void) => void;
    };

    if (typeof legacyMq.addListener === 'function') {
      legacyMq.addListener(handleChange);
      return () => legacyMq.removeListener?.(handleChange);
    }
  }, []);

  // Compute resolved theme: follows OS when 'system', otherwise explicit mode
  const resolvedTheme: ResolvedTheme = useMemo(() => {
    if (theme === 'system') {
      return systemIsDark ? 'dark' : 'light';
    }
    return theme;
  }, [theme, systemIsDark]);

  const isDark = resolvedTheme === 'dark';

  const applyTheme = useCallback((currentResolved: ResolvedTheme) => {
    const root = document.documentElement;
    if (currentResolved === 'dark') {
      root.classList.add('dark');
      root.style.colorScheme = 'dark';
    } else {
      root.classList.remove('dark');
      root.style.colorScheme = 'light';
    }
  }, []);

  useEffect(() => {
    applyTheme(resolvedTheme);
  }, [resolvedTheme, applyTheme]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, theme);
    } catch {
      // ignore
    }
  }, [theme]);

  const setTheme = useCallback((next: ThemeMode) => {
    setThemeState(next);
  }, []);

  const toggleTheme = useCallback(() => {
    setThemeState((prev) => {
      if (prev === 'light') return 'dark';
      if (prev === 'dark') return 'system';
      return 'light';
    });
  }, []);

  const value = useMemo(
    () => ({
      theme,
      resolvedTheme,
      isDark,
      systemIsDark,
      toggleTheme,
      setTheme,
    }),
    [theme, resolvedTheme, isDark, systemIsDark, toggleTheme, setTheme]
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeContextValue {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
}
