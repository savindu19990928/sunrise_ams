import React, { useState } from 'react';
import { Navigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { BuildingIcon, EyeIcon, EyeOffIcon, LockIcon, WifiOffIcon } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { Footer } from '../components/layout/Footer';
import { Button } from '../components/ui/Button';
import { Field, Input } from '../components/ui/Field';
import { ApiError } from '../utils/api';

const highlights = [
'Rooms, customers and leases in one place',
'Consolidated monthly bills with deposit tracking',
'Overdue alerts and profit reporting'];


export function Login() {
  const { user, signIn } = useAuth();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);

  if (user) return <Navigate to="/" replace />;

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setPending(true);
    setError(null);
    try {
      await signIn(username.trim(), password);
    } catch (err) {
      setError(err instanceof ApiError ? err : new ApiError((err as Error).message, 0, 'http'));
    } finally {
      setPending(false);
    }
  };

  return (
    <div className="flex min-h-screen w-full flex-col bg-canvas">
      <div className="mx-auto flex w-full max-w-6xl flex-1 flex-col items-stretch justify-center gap-8 px-4 py-10 lg:flex-row lg:items-center lg:gap-16 lg:px-8">
        {/* Brand / context */}
        <div className="lg:flex-1">
          <div className="flex items-center gap-3">
            <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-brand-600 text-white">
              <BuildingIcon className="h-5 w-5" aria-hidden="true" />
            </span>
            <div>
              <p className="text-sm font-semibold text-ink">Sunrise Apartments AMS</p>
              <p className="text-[12px] text-ink-soft">Accommodation Management System</p>
            </div>
          </div>

          <h1 className="mt-7 max-w-lg text-3xl font-semibold leading-[1.15] tracking-[-0.02em] text-ink sm:text-4xl">
            Run the whole building from one admin portal.
          </h1>
          <p className="mt-3 max-w-md text-sm leading-relaxed text-ink-muted">
            Sign in with your staff credentials to manage rooms, leases, utility billing, payments and reports.
          </p>

          <ul className="mt-6 space-y-2.5">
            {highlights.map((item) =>
            <li key={item} className="flex items-start gap-2.5 text-[13px] text-ink-muted">
                <span className="mt-[7px] h-1.5 w-1.5 flex-none rounded-full bg-brand-500" aria-hidden="true" />
                {item}
              </li>
            )}
          </ul>
        </div>

        {/* Form */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.25, ease: [0.23, 1, 0.32, 1] }}
          className="w-full rounded-2xl border border-line bg-surface p-5 shadow-card sm:p-7 lg:w-[26rem] lg:flex-none">
          
          <h2 className="text-[17px] font-semibold text-ink">Staff sign in</h2>
          <p className="mt-1 text-[13px] text-ink-muted">Admin access only — there is no customer portal.</p>

          <form className="mt-5 space-y-4" onSubmit={handleSubmit}>
            <Field label="Username" htmlFor="username" required>
              <Input
                id="username"
                name="username"
                autoComplete="username"
                value={username}
                onChange={(event) => setUsername(event.target.value)}
                placeholder="Your username"
                required />
              
            </Field>

            <Field label="Password" htmlFor="password" required>
              <div className="relative">
                <Input
                  id="password"
                  name="password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  placeholder="••••••••"
                  className="pr-10"
                  required />
                
                <button
                  type="button"
                  onClick={() => setShowPassword((value) => !value)}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                  className="absolute right-1.5 top-1.5 flex h-7 w-7 items-center justify-center rounded-md text-ink-soft transition-colors duration-150 ease-out hover:bg-canvas hover:text-ink">
                  
                  {showPassword ? <EyeOffIcon className="h-4 w-4" /> : <EyeIcon className="h-4 w-4" />}
                </button>
              </div>
            </Field>

            {error &&
            <div
              role="alert"
              className="flex items-start gap-2.5 rounded-lg border border-danger-100 bg-danger-50 px-3 py-2.5 text-[13px] leading-relaxed text-danger-700">
              
                {error.kind === 'network' ?
              <WifiOffIcon className="mt-0.5 h-4 w-4 flex-none" aria-hidden="true" /> :

              <LockIcon className="mt-0.5 h-4 w-4 flex-none" aria-hidden="true" />
              }
                <span>{error.message}</span>
              </div>
            }

            <Button type="submit" fullWidth loading={pending} size="lg">
              Sign in
            </Button>
          </form>
        </motion.div>
      </div>
      <Footer />
    </div>);

}