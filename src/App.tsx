import React from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { Toaster } from 'sonner';
import { AppShell } from './components/layout/AppShell';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { ThemeProvider, useTheme } from './contexts/ThemeContext';
import { Bills } from './pages/Bills';
import { Customers } from './pages/Customers';
import { Dashboard } from './pages/Dashboard';
import { Leases } from './pages/Leases';
import { Login } from './pages/Login';
import { Overdue } from './pages/Overdue';
import { Payments } from './pages/Payments';
import { Reminders } from './pages/Reminders';
import { Repairs } from './pages/Repairs';
import { Reports } from './pages/Reports';
import { Rooms } from './pages/Rooms';
import { Staff } from './pages/Staff';
import { Utilities } from './pages/Utilities';
import { UtilityPayments } from './pages/UtilityPayments';

function RequireAuth({ children }: {children: React.ReactNode;}) {
  const { user, ready } = useAuth();
  if (!ready) {
    return (
      <div className="flex min-h-screen w-full items-center justify-center bg-canvas text-sm text-ink-muted">
        Loading portal…
      </div>);

  }
  if (!user) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

function RequireSuperuser({ children }: {children: React.ReactNode;}) {
  const { user } = useAuth();
  if (!user?.is_superuser) return <Navigate to="/" replace />;
  return <>{children}</>;
}

function ThemedToaster() {
  const { isDark } = useTheme();
  return <Toaster position="top-right" richColors closeButton theme={isDark ? 'dark' : 'light'} />;
}

export function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <BrowserRouter>
          <ThemedToaster />
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route
              element={
                <RequireAuth>
                  <AppShell />
                </RequireAuth>
              }>
              <Route path="/" element={<Dashboard />} />
              <Route path="/reminders" element={<Reminders />} />
              <Route path="/rooms" element={<Rooms />} />
              <Route path="/customers" element={<Customers />} />
              <Route path="/leases" element={<Leases />} />
              <Route path="/utilities" element={<Utilities />} />
              <Route path="/utility-payments" element={<UtilityPayments />} />
              <Route path="/bills" element={<Bills />} />
              <Route path="/payments" element={<Payments />} />
              <Route path="/overdue" element={<Overdue />} />
              <Route path="/repairs" element={<Repairs />} />
              <Route path="/reports" element={<Reports />} />
              <Route
                path="/staff"
                element={
                  <RequireSuperuser>
                    <Staff />
                  </RequireSuperuser>
                }
              />
            </Route>
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </ThemeProvider>
  );
}