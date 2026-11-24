import { useEffect, useState } from 'react';
import type { MoveOutRepair } from '../../types';
import type { ApiError } from '../../utils/api';
import { toNumber, today } from '../../utils/format';
import { Field, Input, Select, Textarea } from '../ui/Field';
import { FormModal } from '../ui/FormModal';
import type { RepairLeaseOption } from './RepairForm';

interface MoveOutRepairFormProps {
  open: boolean;
  repair: MoveOutRepair | null;
  leases: RepairLeaseOption[];
  pending: boolean;
  error: ApiError | null;
  onClose: () => void;
  onSubmit: (payload: Record<string, unknown>) => void;
}

export function MoveOutRepairForm({
  open,
  repair,
  leases,
  pending,
  error,
  onClose,
  onSubmit
}: MoveOutRepairFormProps) {
  const [lease, setLease] = useState('');
  const [cost, setCost] = useState('');
  const [description, setDescription] = useState('');
  const [date, setDate] = useState(today());
  const [deductImmediately, setDeductImmediately] = useState(false);
  const [touched, setTouched] = useState(false);

  useEffect(() => {
    if (!open) return;
    setTouched(false);
    setLease(repair?.lease !== undefined ? String(repair.lease) : '');
    setCost(repair ? String(repair.cost ?? '') : '');
    setDescription(repair?.description ?? '');
    setDate(repair?.date_recorded ?? today());
    setDeductImmediately(Boolean(repair?.deducted_from_deposit));
  }, [open, repair]);

  const sortedLeases = [...leases].sort((a, b) => Number(b.is_active) - Number(a.is_active) || b.id - a.id);

  const handleSubmit = () => {
    setTouched(true);
    if (!lease || toNumber(cost) <= 0 || !description.trim()) return;
    const payload: Record<string, unknown> = {
      lease: toNumber(lease),
      cost: toNumber(cost).toFixed(2),
      description: description.trim(),
      date_recorded: date
    };
    if (!repair) {
      payload.deduct_from_deposit = deductImmediately;
    }
    onSubmit(payload);
  };

  return (
    <FormModal
      open={open}
      onClose={onClose}
      onSubmit={handleSubmit}
      title={repair ? `Edit move-out repair · Room ${repair.room_number ?? '—'}` : 'Log move-out special repair'}
      description="Recorded separately from regular tenancy maintenance and deducted from the deposit at move-out."
      submitLabel={repair ? 'Save changes' : 'Save move-out repair'}
      pending={pending}
      error={error}
    >
      {repair?.deducted_from_deposit && (
        <p className="rounded-lg border border-warn-100 bg-warn-50 px-3 py-2.5 text-[13px] text-warn-700">
          This special move-out repair has already been deducted from the deposit.
        </p>
      )}
      <div className="grid gap-4 sm:grid-cols-2">
        <Field
          label="Tenant & room"
          htmlFor="mo_repair_lease"
          required
          className="sm:col-span-2"
          hint={sortedLeases.length ? undefined : 'No leases found.'}
          error={touched && !lease ? 'Select a lease.' : undefined}
        >
          <Select id="mo_repair_lease" value={lease} onChange={(event) => setLease(event.target.value)}>
            <option value="">Select lease…</option>
            {sortedLeases.map((item) => (
              <option key={item.id} value={item.id}>
                Room {item.room_number} · {item.customer_name}
                {item.is_active ? ' (active)' : ' (ended)'}
              </option>
            ))}
          </Select>
        </Field>
        <Field
          label="Special repair cost"
          htmlFor="mo_repair_cost"
          required
          error={touched && toNumber(cost) <= 0 ? 'Enter a cost greater than zero.' : undefined}
        >
          <Input
            id="mo_repair_cost"
            type="number"
            min="0"
            step="0.01"
            value={cost}
            onChange={(event) => setCost(event.target.value)}
            placeholder="2500"
          />
        </Field>
        <Field label="Date recorded" htmlFor="mo_repair_date" required>
          <Input id="mo_repair_date" type="date" value={date} onChange={(event) => setDate(event.target.value)} />
        </Field>
      </div>
      <Field
        label="Description"
        htmlFor="mo_repair_desc"
        required
        error={touched && !description.trim() ? 'Describe the special move-out repair.' : undefined}
      >
        <Textarea
          id="mo_repair_desc"
          value={description}
          onChange={(event) => setDescription(event.target.value)}
          placeholder="Wall repainting, door lock replacement…"
        />
      </Field>
      {!repair && (
        <label className="flex cursor-pointer items-start gap-2.5 rounded-lg border border-line bg-subtle px-3 py-2.5 text-[13px]">
          <input
            type="checkbox"
            className="mt-0.5 h-4 w-4 accent-brand-600"
            checked={deductImmediately}
            onChange={(event) => setDeductImmediately(event.target.checked)}
          />
          <span>
            <span className="block font-medium text-ink">Deduct from deposit immediately</span>
            <span className="block text-[12px] text-ink-soft">
              Leave unchecked to deduct automatically when the lease ends or is terminated.
            </span>
          </span>
        </label>
      )}
    </FormModal>
  );
}
