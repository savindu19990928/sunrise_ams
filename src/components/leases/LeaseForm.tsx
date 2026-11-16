import React, { useEffect, useMemo, useState } from 'react';
import type { Customer, Lease, Room } from '../../types';
import type { ApiError } from '../../utils/api';
import { formatCurrency, titleCase, toNumber, today } from '../../utils/format';
import { customerName } from '../../utils/lookup';
import { Field, Input, Select } from '../ui/Field';
import { FormModal } from '../ui/FormModal';

interface LeaseFormProps {
  open: boolean;
  lease: Lease | null;
  rooms: Room[];
  customers: Customer[];
  activeLeases: Lease[];
  pending: boolean;
  error: ApiError | null;
  onClose: () => void;
  onSubmit: (payload: Record<string, unknown>) => void;
}

interface FormState {
  customer: string;
  room: string;
  start_date: string;
  base_rent_fee: string;
  base_deposit: string;
  minimum_deposit_threshold: string;
  rent_fee: string;
}

const emptyState: FormState = {
  customer: '',
  room: '',
  start_date: today(),
  base_rent_fee: '',
  base_deposit: '',
  minimum_deposit_threshold: '',
  rent_fee: ''
};

function asInput(value: number | string | null | undefined): string {
  return value === undefined || value === null || value === '' ? '' : String(toNumber(value));
}

export function LeaseForm({
  open,
  lease,
  rooms,
  customers,
  activeLeases,
  pending,
  error,
  onClose,
  onSubmit
}: LeaseFormProps) {
  const [form, setForm] = useState<FormState>(emptyState);
  const [touched, setTouched] = useState(false);

  useEffect(() => {
    if (!open) return;
    setTouched(false);
    if (!lease) {
      setForm({ ...emptyState, start_date: today() });
      return;
    }
    setForm({
      customer: String(lease.customer),
      room: String(lease.room),
      start_date: lease.start_date ?? today(),
      base_rent_fee: asInput(lease.base_rent_fee ?? lease.rent_fee),
      base_deposit: asInput(lease.base_deposit ?? lease.deposit_paid),
      minimum_deposit_threshold: asInput(lease.minimum_deposit_threshold),
      rent_fee: asInput(lease.rent_fee)
    });
    // Only re-seed when the dialog opens or the lease changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, lease]);

  const takenRoomIds = useMemo(
    () => new Set(activeLeases.filter((item) => item.id !== lease?.id).map((item) => item.room)),
    [activeLeases, lease]
  );
  const takenCustomerIds = useMemo(
    () => new Set(activeLeases.filter((item) => item.id !== lease?.id).map((item) => item.customer)),
    [activeLeases, lease]
  );

  const availableRooms = rooms.filter((room) => !takenRoomIds.has(room.id));
  const availableCustomers = customers.filter((customer) => !takenCustomerIds.has(customer.id));

  const handleRoomChange = (roomId: string) => {
    setForm((prev) => ({ ...prev, room: roomId }));
  };

  const handleCustomerChange = (customerId: string) => {
    setForm((prev) => ({ ...prev, customer: customerId }));
  };

  const set = (key: keyof FormState) => (event: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
  setForm((prev) => ({ ...prev, [key]: event.target.value }));

  const baseRent = toNumber(form.base_rent_fee);
  const monthlyRent = form.rent_fee === '' ? baseRent : toNumber(form.rent_fee);
  const derivedDeduction = Math.max(0, baseRent - monthlyRent);
  const depositPaid = toNumber(form.base_deposit);
  const threshold = toNumber(form.minimum_deposit_threshold);
  const deductible = Math.max(0, depositPaid - threshold);
  const monthsCovered = derivedDeduction > 0 ? Math.ceil(deductible / derivedDeduction) : 0;

  const handleSubmit = () => {
    setTouched(true);
    if (!form.customer || !form.room || !form.start_date) return;
    const payload: Record<string, unknown> = {
      customer: toNumber(form.customer),
      room: toNumber(form.room),
      start_date: form.start_date,
      base_rent_fee: baseRent.toFixed(2),
      base_deposit: depositPaid.toFixed(2),
      minimum_deposit_threshold: threshold.toFixed(2),
      deposit_paid: depositPaid,
      rent_fee: monthlyRent,
      monthly_deposit_deduction: derivedDeduction
    };
    if (!lease) {
      payload.current_deposit_balance = depositPaid;
      payload.is_active = true;
    }
    onSubmit(payload);
  };

  return (
    <FormModal
      open={open}
      onClose={onClose}
      onSubmit={handleSubmit}
      title={lease ? `Edit lease #${lease.id}` : 'Assign room to customer'}
      submitLabel={lease ? 'Save changes' : 'Create lease'}
      pending={pending}
      error={error}>
      
      <div className="grid gap-4 sm:grid-cols-2">
        <Field
          label="Customer"
          htmlFor="lease_customer"
          required
          error={touched && !form.customer ? 'Select a customer.' : undefined}>
          
          <Select id="lease_customer" value={form.customer} onChange={(event) => handleCustomerChange(event.target.value)}>
            <option value="">Select customer…</option>
            {availableCustomers.map((customer) =>
            <option key={customer.id} value={customer.id}>
                {customerName(customer)} · {customer.nic_number}
              </option>
            )}
          </Select>
        </Field>
        <Field
          label="Room"
          htmlFor="lease_room"
          required
          hint={availableRooms.length ? undefined : 'No rooms are free right now.'}
          error={touched && !form.room ? 'Select a room.' : undefined}>
          
          <Select id="lease_room" value={form.room} onChange={(event) => handleRoomChange(event.target.value)}>
            <option value="">Select room…</option>
            {availableRooms.map((room) =>
            <option key={room.id} value={room.id}>
                Room {room.room_number} · {titleCase(String(room.room_type ?? ''))}
              </option>
            )}
          </Select>
        </Field>
        <Field label="Start date" htmlFor="lease_start" required>
          <Input id="lease_start" type="date" value={form.start_date} onChange={set('start_date')} />
        </Field>
      </div>

      <fieldset className="border-t border-line pt-4">
        <legend className="pr-2 text-[13px] font-medium text-ink">Agreement &amp; rent terms</legend>
        <div className="mt-2 grid gap-4 sm:grid-cols-2">
          <Field label="Base rent fee" htmlFor="lease_base_rent">
            <Input id="lease_base_rent" type="number" min="0" step="0.01" value={form.base_rent_fee} onChange={set('base_rent_fee')} />
          </Field>
          <Field
            label="Monthly rent fee"
            htmlFor="lease_rent"
            hint={`Monthly deduction: ${formatCurrency(derivedDeduction)}`}>
            <Input id="lease_rent" type="number" min="0" step="0.01" value={form.rent_fee} onChange={set('rent_fee')} />
          </Field>
          <Field label="Base deposit" htmlFor="lease_base_deposit">
            <Input
              id="lease_base_deposit"
              type="number"
              min="0"
              step="0.01"
              value={form.base_deposit}
              onChange={set('base_deposit')} />
            
          </Field>
          <Field label="Minimum deposit threshold" htmlFor="lease_threshold">
            <Input
              id="lease_threshold"
              type="number"
              min="0"
              step="0.01"
              value={form.minimum_deposit_threshold}
              onChange={set('minimum_deposit_threshold')} />
            
          </Field>
        </div>
      </fieldset>

      {monthsCovered > 0 &&
      <p className="rounded-lg border border-brand-100 bg-brand-50 px-3 py-2.5 text-[13px] leading-relaxed text-brand-700">
          Tenant pays{' '}
          <span className="font-semibold">
            {formatCurrency(monthlyRent)}
          </span>{' '}
          rent per month (deducting <span className="font-semibold">{formatCurrency(derivedDeduction)}</span> from the{' '}
          <span className="font-semibold">{formatCurrency(depositPaid)}</span> deposit) for about{' '}
          <span className="font-semibold">{monthsCovered} months</span>. Once the deposit reaches the lease threshold of{' '}
          <span className="font-semibold">{formatCurrency(threshold)}</span> the deduction stops and the full base rent
          of <span className="font-semibold">{formatCurrency(baseRent)}</span> applies. The threshold amount is kept to
          cover repairs at move-out.
        </p>
      }
      {form.customer && depositPaid > 0 && deductible <= 0 &&
      <p className="rounded-lg border border-warn-100 bg-warn-50 px-3 py-2.5 text-[13px] leading-relaxed text-warn-700">
          The deposit is at or below the lease&apos;s minimum threshold of {formatCurrency(threshold)}, so no monthly
          deduction will be taken — the full rent applies from the first bill.
        </p>
      }
    </FormModal>);

}