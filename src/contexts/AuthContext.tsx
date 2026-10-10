import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { AuthUser } from '../types';
import { getAccessToken, getStoredUser, login as apiLogin, logout as apiLogout, setStoredUser } from '../utils/api';

interface AuthContextValue {
  user: AuthUser | null;
  ready: boolean;
  signIn: (username: string, password: string) => Promise<AuthUser>;
  signOut: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: {children: React.ReactNode;}) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const stored = getStoredUser();
    if (stored && getAccessToken()) setUser(stored);
    setReady(true);
  }, []);

  useEffect(() => {
    const handleUnauthorized = () => {
      setUser(null);
      setStoredUser(null);
    };
    window.addEventListener('ams:unauthorized', handleUnauthorized);
    return () => window.removeEventListener('ams:unauthorized', handleUnauthorized);
  }, []);

  const signIn = useCallback(async (username: string, password: string) => {
    const next = await apiLogin(username, password);
    setUser(next);
    return next;
  }, []);

  const signOut = useCallback(() => {
    apiLogout();
    setUser(null);
  }, []);

  const value = useMemo(() => ({ user, ready, signIn, signOut }), [user, ready, signIn, signOut]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used inside an AuthProvider');
  return context;
}