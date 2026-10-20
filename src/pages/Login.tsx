import React, { useState } from 'react';
import { Navigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Building2Icon, EyeIcon, EyeOffIcon, LockKeyholeIcon, WifiOffIcon } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { Footer } from '../components/layout/Footer';
import { Button } from '../components/ui/Button';
import { Field, Input } from '../components/ui/Field';
import { ThemeToggle } from '../components/ui/ThemeToggle';
import { ApiError } from '../utils/api';

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
    <div className="relative flex min-h-screen w-full flex-col bg-canvas">
      <div className="absolute right-4 top-4 z-10 sm:right-6 sm:top-6">
        <ThemeToggle />
      </div>
      <main className="flex flex-1 items-center justify-center px-4 py-10 sm:px-6">
        <motion.section
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.24, ease: [0.23, 1, 0.32, 1] }}
          className="w-full max-w-sm overflow-hidden rounded-2xl border border-line bg-surface shadow-pop"
          aria-labelledby="sign-in-title">
          
          <header className="flex items-center gap-3 border-b border-line px-6 py-5">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-600 text-white">
              <Building2Icon className="h-5 w-5" aria-hidden="true" />
            </span>
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold tracking-[-0.01em] text-ink">Sunrise Apartments</p>
              <p className="mt-0.5 truncate text-[12px] text-ink-soft">Accommodation Management System</p>
            </div>
          </header>

          <div className="px-6 py-7">
            <h1 id="sign-in-title" className="text-[22px] font-semibold tracking-[-0.03em] text-ink">
              Sign in
            </h1>

            <form className="mt-6 space-y-5" onSubmit={handleSubmit}>
              <Field label="Username" htmlFor="username" required>
                <Input
                  id="username"
                  name="username"
                  autoComplete="username"
                  autoFocus
                  value={username}
                  onChange={(event) => setUsername(event.target.value)}
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
                    className="pr-11"
                    required />
                  
                  <button
                    type="button"
                    onClick={() => setShowPassword((value) => !value)}
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                    className="absolute right-1.5 top-1.5 flex h-7 w-7 items-center justify-center rounded-md text-ink-soft transition-[background-color,color] duration-150 ease-out hover:bg-canvas hover:text-ink">
                    
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

                <LockKeyholeIcon className="mt-0.5 h-4 w-4 flex-none" aria-hidden="true" />
                }
                  <span>{error.message}</span>
                </div>
              }

              <Button type="submit" fullWidth loading={pending} size="lg">
                Sign in
              </Button>
            </form>
          </div>
        </motion.section>
      </main>
      <Footer className="pb-5 pt-0 sm:pb-6" />
    </div>);

}