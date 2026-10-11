import React, { useEffect, useState } from 'react';
import type { Customer, ImmediateContactDraft } from '../../types';
import type { ApiError } from '../../utils/api';
import { newContactDraft } from '../../utils/contacts';
import { Field, Input, Textarea } from '../ui/Field';
import { FormModal } from '../ui/FormModal';
import { ImmediateContactsEditor, contactRowErrors } from './ImmediateContactsEditor';

interface CustomerFormProps {
  open: boolean;
  customer: Customer | null;
  pending: boolean;
  error: ApiError | null;
  onClose: () => void;
  onSubmit: (payload: Record<string, unknown>, contacts: ImmediateContactDraft[]) => void;
}

interface FormState {
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
  nic_number: string;
  address: string;
  minimum_deposit_threshold: string;
}

const emptyState: FormState = {
  first_name: '',
  last_name: '',
  email: '',
  phone: '',
  nic_number: '',
  address: '',
  minimum_deposit_threshold: ''
};

function thresholdError(value: string): string | undefined {
  if (value.trim() === '') return 'Minimum deposit threshold is required.';
  const amount = Number(value);
  if (!Number.isFinite(amount) || amount < 0) return 'Enter an amount of 0 or more.';
  return undefined;
}

export function CustomerForm({ open, customer, pending, error, onClose, onSubmit }: CustomerFormProps) {
  const [form, setForm] = useState<FormState>(emptyState);
  const [touched, setTouched] = useState(false);
  const [contacts, setContacts] = useState<ImmediateContactDraft[]>([]);

  useEffect(() => {
    if (!open) return;
    setTouched(false);
    setContacts((customer?.immediate_contacts ?? []).map((contact) => newContactDraft(contact)));
    setForm(
      customer ?
      {
        first_name: customer.first_name ?? '',
        last_name: customer.last_name ?? '',
        email: customer.email ?? '',
        phone: customer.phone ?? '',
        nic_number: customer.nic_number ?? '',
        address: customer.address ?? '',
        minimum_deposit_threshold:
        customer.minimum_deposit_threshold === undefined || customer.minimum_deposit_threshold === null ?
        '' :
        String(Number(customer.minimum_deposit_threshold))
      } :
      emptyState
    );
  }, [open, customer]);

  const set = (key: keyof FormState) => (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
  setForm((prev) => ({ ...prev, [key]: event.target.value }));

  const handleSubmit = () => {
    setTouched(true);
    if (!form.first_name.trim() || !form.last_name.trim() || !form.nic_number.trim()) return;
    if (thresholdError(form.minimum_deposit_threshold)) return;
    if (contacts.some((draft) => Object.values(contactRowErrors(draft)).some(Boolean))) return;
    onSubmit(
      {
        first_name: form.first_name.trim(),
        last_name: form.last_name.trim(),
        email: form.email.trim(),
        phone: form.phone.trim(),
        nic_number: form.nic_number.trim(),
        address: form.address.trim(),
        minimum_deposit_threshold: Number(form.minimum_deposit_threshold).toFixed(2)
      },
      contacts
    );
  };

  return (
    <FormModal
      open={open}
      onClose={onClose}
      onSubmit={handleSubmit}
      title={customer ? `Edit ${customer.first_name} ${customer.last_name}` : 'Add customer'}
      description="Customer records are reused across leases, bills and payment history."
      submitLabel={customer ? 'Save changes' : 'Create customer'}
      pending={pending}
      error={error}>
      
      <div className="grid gap-4 sm:grid-cols-2">
        <Field
          label="First name"
          htmlFor="first_name"
          required
          error={touched && !form.first_name.trim() ? 'First name is required.' : undefined}>
          
          <Input id="first_name" value={form.first_name} onChange={set('first_name')} placeholder="Nimal" />
        </Field>
        <Field
          label="Last name"
          htmlFor="last_name"
          required
          error={touched && !form.last_name.trim() ? 'Last name is required.' : undefined}>
          
          <Input id="last_name" value={form.last_name} onChange={set('last_name')} placeholder="Perera" />
        </Field>
        <Field
          label="NIC number"
          htmlFor="nic_number"
          required
          error={touched && !form.nic_number.trim() ? 'NIC number is required.' : undefined}>
          
          <Input id="nic_number" value={form.nic_number} onChange={set('nic_number')} placeholder="911234567V" />
        </Field>
        <Field label="Phone" htmlFor="phone">
          <Input id="phone" type="tel" value={form.phone} onChange={set('phone')} placeholder="077 412 8890" />
        </Field>
        <Field label="Email" htmlFor="email" className="sm:col-span-2">
          <Input id="email" type="email" value={form.email} onChange={set('email')} placeholder="name@example.com" />
        </Field>
      </div>
      <Field label="Address" htmlFor="address">
        <Textarea id="address" value={form.address} onChange={set('address')} placeholder="42 Galle Road, Colombo 04" />
      </Field>
      <Field
        label="Minimum deposit threshold"
        htmlFor="minimum_deposit_threshold"
        required
        hint="Monthly deposit deductions stop once the remaining deposit is at or below this amount. The rest is held until move-out to cover repairs."
        error={touched ? thresholdError(form.minimum_deposit_threshold) : undefined}>
        
        <Input
          id="minimum_deposit_threshold"
          type="number"
          min="0"
          step="0.01"
          value={form.minimum_deposit_threshold}
          onChange={set('minimum_deposit_threshold')}
          placeholder="10000" />
        
      </Field>
      <ImmediateContactsEditor contacts={contacts} touched={touched} onChange={setContacts} />
    </FormModal>);

}