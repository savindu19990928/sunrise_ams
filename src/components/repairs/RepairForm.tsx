import React, { useEffect, useState } from 'react';
import type { Lease, RepairStatus, RoomRepair } from '../../types';
import type { ApiError } from '../../utils/api';
import { toNumber, today } from '../../utils/format';
import { Field, Input, Select, Textarea } from '../ui/Field';
import { FormModal } from '../ui/FormModal';

/** Lease with display names already resolved by the page. */
export interface RepairLeaseOption extends Lease {
  customer_name: string;
  room_number: string;
}

interface RepairFormProps {
  open: boolean;
  repair: RoomRepair | null;
  leases: RepairLeaseOption[];
  pending: boolean;
  error: ApiError | null;
  onClose: () => void;
  onSubmit: (payload: Record<string, unknown>) => void;
}

const statuses: {value: RepairStatus;label: string;}[] = [
{ value: 'pending', label: 'Pending' },
{ value: 'in_progress', label: 'In progress' },
{ value: 'completed', label: 'Completed' }];


export function RepairForm({ open, repair, leases, pending, error, onClose, onSubmit }: RepairFormProps) {
  const [lease, setLease] = useState('');
  const [cost, setCost] = useState('');
  const [description, setDescription] = useState('');
  const [date, setDate] = useState(today());
  const [status, setStatus] = useState<RepairStatus>('pending');
  const [touched, setTouched] = useState(false);

  useEffect(() => {
    if (!open) return;
    setTouched(false);
    setLease(repair?.lease !== undefined ? String(repair.lease) : '');
    setCost(repair ? String(repair.repair_cost ?? '') : '');
    setDescription(repair?.repair_description ?? '');
    setDate(repair?.repair_date ?? today());
    setStatus(repair?.status ?? 'pending');
  }, [open, repair]);

  // Active leases, plus the repair's own lease when editing a past one.
  const options = leases.filter((item) => item.is_active || String(item.id) === lease);

  const handleSubmit = () => {
    setTouched(true);
    if (!lease || toNumber(cost) <= 0 || !description.trim()) return;
    onSubmit({
      lease: toNumber(lease),
      repair_cost: toNumber(cost),
      repair_description: description.trim(),
      repair_date: date,
      status
    });
  };

  return (
    <FormModal
      open={open}
      onClose={onClose}
      onSubmit={handleSubmit}
      title={repair ? `Edit repair · Room ${repair.room_number ?? '—'}` : 'Log room repair'}
      description="Repairs are logged against a tenant's lease. Any not yet settled are deducted from their remaining deposit when they leave the room."
      submitLabel={repair ? 'Save changes' : 'Log repair'}
      pending={pending}
      error={error}>
      
      {repair?.deducted_from_deposit &&
      <p className="rounded-lg border border-warn-100 bg-warn-50 px-3 py-2.5 text-[13px] text-warn-700">
          This repair was already deducted from the tenant's deposit at move-out.
        </p>
      }
      <div className="grid gap-4 sm:grid-cols-2">
        <Field
          label="Tenant & room"
          htmlFor="repair_lease"
          required
          className="sm:col-span-2"
          hint={options.length ? undefined : 'No active leases — assign a room first.'}
          error={touched && !lease ? 'Select a lease.' : undefined}>
          
          <Select id="repair_lease" value={lease} onChange={(event) => setLease(event.target.value)}>
            <option value="">Select lease…</option>
            {options.map((item) =>
            <option key={item.id} value={item.id}>
                Room {item.room_number} · {item.customer_name}
                {item.is_active ? '' : ' (ended)'}
              </option>
            )}
          </Select>
        </Field>
        <Field
          label="Repair cost"
          htmlFor="repair_cost_field"
          required
          error={touched && toNumber(cost) <= 0 ? 'Enter a cost greater than zero.' : undefined}>
          
          <Input
            id="repair_cost_field"
            type="number"
            min="0"
            step="0.01"
            value={cost}
            onChange={(event) => setCost(event.target.value)}
            placeholder="7200" />
          
        </Field>
        <Field label="Date logged" htmlFor="repair_date_field">
          <Input id="repair_date_field" type="date" value={date} onChange={(event) => setDate(event.target.value)} />
        </Field>
        <Field label="Status" htmlFor="repair_status_field" className="sm:col-span-2">
          <Select id="repair_status_field" value={status} onChange={(event) => setStatus(event.target.value as RepairStatus)}>
            {statuses.map((item) =>
            <option key={item.value} value={item.value}>
                {item.label}
              </option>
            )}
          </Select>
        </Field>
      </div>
      <Field
        label="Description"
        htmlFor="repair_description_field"
        required
        error={touched && !description.trim() ? 'Describe the repair.' : undefined}>
        
        <Textarea
          id="repair_description_field"
          value={description}
          onChange={(event) => setDescription(event.target.value)}
          placeholder="Ceiling fan replacement" />
        
      </Field>
    </FormModal>);

}