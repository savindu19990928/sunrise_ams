import React, { useEffect, useMemo, useState } from 'react';
import type { Customer, Lease, Room } from '../../types';
import type { ApiError } from '../../utils/api';
import { formatCurrency, toNumber, today } from '../../utils/format';
import { customerName, depositThreshold } from '../../utils/lookup';
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
  deposit_paid: string;
  rent_fee: string;
  monthly_deposit_deduction: string;
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
  const [form, setForm] = useState<FormState>({
    customer: '',
    room: '',
    start_date: today(),
    deposit_paid: '',
    rent_fee: '',
    monthly_deposit_deduction: ''
  });
  const [touched, setTouched] = useState(false);

  useEffect(() => {
    if (!open) return;
    setTouched(false);
    setForm({
      customer: lease ? String(lease.customer) : '',
      room: lease ? String(lease.room) : '',
      start_date: lease?.start_date ?? today(),
      deposit_paid: lease ? String(lease.deposit_paid ?? '') : '',
      rent_fee: lease ? String(lease.rent_fee ?? '') : '',
      monthly_deposit_deduction: lease ? String(lease.monthly_deposit_deduction ?? '') : ''
    });
  }, [open, lease]);

  const takenRoomIds = useMemo(
    () => new Set(activeLeases.filter((item) => item.id !== lease?.id).map((item) => item.room)),
    [activeLeases, lease]
  );
  const takenCustomerIds = useMemo(
    () => new Set(activeLeases.filter((item) => item.id !== lease?.id).map((item) => item.customer)),
    [activeLeases, lease]
  );

  const availableRooms = rooms.filter((room) => !takenRoomIds.has(room.id) && room.status !== 'maintenance');
  const availableCustomers = customers.filter((customer) => !takenCustomerIds.has(customer.id));

  const handleRoomChange = (roomId: string) => {
    const room = rooms.find((item) => String(item.id) === roomId);
    setForm((prev) => ({
      ...prev,
      room: roomId,
      rent_fee: room ? String(room.base_rent_fee ?? '') : prev.rent_fee,
      deposit_paid: room && !lease ? String(room.base_deposit ?? '') : prev.deposit_paid,
      monthly_deposit_deduction: room ? String(room.monthly_deposit_deduction ?? '') : prev.monthly_deposit_deduction
    }));
  };

  const set = (key: keyof FormState) => (event: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
  setForm((prev) => ({ ...prev, [key]: event.target.value }));

  const selectedCustomer = customers.find((item) => String(item.id) === form.customer);
  const threshold = depositThreshold(selectedCustomer);
  const deductible = Math.max(0, toNumber(form.deposit_paid) - threshold);
  const monthsCovered =
  toNumber(form.monthly_deposit_deduction) > 0 ? Math.ceil(deductible / toNumber(form.monthly_deposit_deduction)) : 0;

  const handleSubmit = () => {
    setTouched(true);
    if (!form.customer || !form.room || !form.start_date) return;
    const payload: Record<string, unknown> = {
      customer: toNumber(form.customer),
      room: toNumber(form.room),
      start_date: form.start_date,
      deposit_paid: toNumber(form.deposit_paid),
      rent_fee: toNumber(form.rent_fee),
      monthly_deposit_deduction: toNumber(form.monthly_deposit_deduction)
    };
    if (!lease) {
      payload.current_deposit_balance = toNumber(form.deposit_paid);
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
      description="The deposit is collected up front. Each month the tenant pays rent minus the deduction until the deposit falls to the customer's minimum threshold, then the full rent."
      submitLabel={lease ? 'Save changes' : 'Create lease'}
      pending={pending}
      error={error}>
      
      <div className="grid gap-4 sm:grid-cols-2">
        <Field
          label="Customer"
          htmlFor="lease_customer"
          required
          error={touched && !form.customer ? 'Select a customer.' : undefined}>
          
          <Select id="lease_customer" value={form.customer} onChange={set('customer')}>
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
                Room {room.room_number} · {room.room_type} · {formatCurrency(room.base_rent_fee)}
              </option>
            )}
          </Select>
        </Field>
        <Field label="Start date" htmlFor="lease_start" required>
          <Input id="lease_start" type="date" value={form.start_date} onChange={set('start_date')} />
        </Field>
        <Field label="Deposit paid" htmlFor="lease_deposit">
          <Input id="lease_deposit" type="number" min="0" step="0.01" value={form.deposit_paid} onChange={set('deposit_paid')} />
        </Field>
        <Field label="Monthly rent fee" htmlFor="lease_rent">
          <Input id="lease_rent" type="number" min="0" step="0.01" value={form.rent_fee} onChange={set('rent_fee')} />
        </Field>
        <Field label="Monthly deposit deduction" htmlFor="lease_deduction">
          <Input
            id="lease_deduction"
            type="number"
            min="0"
            step="0.01"
            value={form.monthly_deposit_deduction}
            onChange={set('monthly_deposit_deduction')} />
          
        </Field>
      </div>

      {monthsCovered > 0 &&
      <p className="rounded-lg border border-brand-100 bg-brand-50 px-3 py-2.5 text-[13px] leading-relaxed text-brand-700">
          Tenant pays{' '}
          <span className="font-semibold">
            {formatCurrency(Math.max(0, toNumber(form.rent_fee) - toNumber(form.monthly_deposit_deduction)))}
          </span>{' '}
          rent for about <span className="font-semibold">{monthsCovered} months</span>. Once the deposit reaches the
          customer's threshold of <span className="font-semibold">{formatCurrency(threshold)}</span> the deduction stops
          and the full rent of <span className="font-semibold">{formatCurrency(form.rent_fee)}</span> applies. The
          threshold amount is kept to cover repairs at move-out.
        </p>
      }
      {form.customer && toNumber(form.deposit_paid) > 0 && deductible <= 0 &&
      <p className="rounded-lg border border-warn-100 bg-warn-50 px-3 py-2.5 text-[13px] leading-relaxed text-warn-700">
          The deposit is at or below this customer's minimum threshold of {formatCurrency(threshold)}, so no monthly
          deduction will be taken — the full rent applies from the first bill.
        </p>
      }
    </FormModal>);

}