import React, { useState } from 'react';
import { CheckCircle2Icon, ShieldCheckIcon } from 'lucide-react';
import { toast } from 'sonner';
import { ApiError, apiRequest } from '../utils/api';
import { Button } from '../components/ui/Button';
import { Card, CardHeader } from '../components/ui/Card';
import { Field, Input } from '../components/ui/Field';
import { PageHeader } from '../components/ui/PageHeader';

interface FormState {
  username: string;
  email: string;
  first_name: string;
  last_name: string;
  password: string;
  confirm: string;
}

const emptyState: FormState = {
  username: '',
  email: '',
  first_name: '',
  last_name: '',
  password: '',
  confirm: ''
};

export function Staff() {
  const [form, setForm] = useState<FormState>(emptyState);
  const [touched, setTouched] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);
  const [created, setCreated] = useState<string[]>([]);

  const set = (key: keyof FormState) => (event: React.ChangeEvent<HTMLInputElement>) =>
  setForm((prev) => ({ ...prev, [key]: event.target.value }));

  const mismatch = Boolean(form.confirm) && form.password !== form.confirm;
  const tooShort = Boolean(form.password) && form.password.length < 8;

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setTouched(true);
    if (!form.username.trim() || !form.password || mismatch || tooShort) return;
    setPending(true);
    setError(null);
    try {
      const response = await apiRequest<{message?: string;}>('/api/staff/', {
        method: 'POST',
        body: {
          username: form.username.trim(),
          password: form.password,
          email: form.email.trim(),
          first_name: form.first_name.trim(),
          last_name: form.last_name.trim()
        }
      });
      toast.success(response?.message ?? 'Staff user created successfully.');
      setCreated((prev) => [form.username.trim(), ...prev]);
      setForm(emptyState);
      setTouched(false);
    } catch (err) {
      const apiError = err instanceof ApiError ? err : new ApiError((err as Error).message, 0, 'http');
      setError(apiError);
      toast.error(apiError.message);
    } finally {
      setPending(false);
    }
  };

  return (
    <div className="space-y-5">
      <PageHeader
        title="Staff accounts"
        description="Create additional admin logins. Only superusers can access this endpoint." />
      

      <div className="grid gap-4 lg:grid-cols-[minmax(0,32rem)_1fr] lg:items-start">
        <Card>
          <CardHeader title="Create staff user" description="The new account can sign in immediately with these credentials." />
          <form className="space-y-4 px-4 py-4 sm:px-5" onSubmit={handleSubmit} noValidate>
            {error &&
            <div role="alert" className="rounded-lg border border-danger-100 bg-danger-50 px-3 py-2.5 text-[13px] leading-relaxed text-danger-700">
                {error.message}
              </div>
            }

            <Field
              label="Username"
              htmlFor="staff_username"
              required
              error={touched && !form.username.trim() ? 'Username is required.' : undefined}>
              
              <Input id="staff_username" value={form.username} onChange={set('username')} placeholder="new_staff" autoComplete="off" />
            </Field>

            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="First name" htmlFor="staff_first">
                <Input id="staff_first" value={form.first_name} onChange={set('first_name')} placeholder="John" />
              </Field>
              <Field label="Last name" htmlFor="staff_last">
                <Input id="staff_last" value={form.last_name} onChange={set('last_name')} placeholder="Doe" />
              </Field>
            </div>

            <Field label="Email" htmlFor="staff_email">
              <Input id="staff_email" type="email" value={form.email} onChange={set('email')} placeholder="staff@example.com" />
            </Field>

            <div className="grid gap-4 sm:grid-cols-2">
              <Field
                label="Password"
                htmlFor="staff_password"
                required
                hint="At least 8 characters."
                error={touched && (!form.password || tooShort) ? 'Use at least 8 characters.' : undefined}>
                
                <Input
                  id="staff_password"
                  type="password"
                  value={form.password}
                  onChange={set('password')}
                  autoComplete="new-password" />
                
              </Field>
              <Field
                label="Confirm password"
                htmlFor="staff_confirm"
                required
                error={mismatch ? 'Passwords do not match.' : undefined}>
                
                <Input
                  id="staff_confirm"
                  type="password"
                  value={form.confirm}
                  onChange={set('confirm')}
                  autoComplete="new-password" />
                
              </Field>
            </div>

            <Button type="submit" loading={pending} icon={ShieldCheckIcon}>
              Create staff user
            </Button>
          </form>
        </Card>

        <div className="space-y-4">
          <Card className="p-4 sm:p-5">
            <h2 className="text-[15px] font-semibold text-ink">Access rules</h2>
            <ul className="mt-3 space-y-2.5 text-[13px] leading-relaxed text-ink-muted">
              <li>Staff accounts can manage rooms, customers, leases, utilities, bills and payments.</li>
              <li>Only superusers can create new staff accounts or see this screen.</li>
              <li>There is no tenant-facing portal — every action here is performed by your team.</li>
            </ul>
          </Card>

          {created.length > 0 &&
          <Card className="p-4 sm:p-5">
              <h2 className="text-[15px] font-semibold text-ink">Created in this session</h2>
              <ul className="mt-3 space-y-2">
                {created.map((username) =>
              <li key={username} className="flex items-center gap-2 text-[13px] text-ink">
                    <CheckCircle2Icon className="h-4 w-4 text-success-600" aria-hidden="true" />
                    {username}
                  </li>
              )}
              </ul>
            </Card>
          }
        </div>
      </div>
    </div>);

}