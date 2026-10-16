import React, { useEffect, useState } from 'react';
import { roomTypes } from '../../data/roomTypes';
import type { Room, RoomStatus, RoomType } from '../../types';
import { toNumber } from '../../utils/format';
import type { ApiError } from '../../utils/api';
import { Field, Input, Select, Textarea } from '../ui/Field';
import { FormModal } from '../ui/FormModal';

interface RoomFormProps {
  open: boolean;
  room: Room | null;
  pending: boolean;
  error: ApiError | null;
  /** Tenant currently leasing this room, if any — their lease can inherit the new amounts. */
  activeLeaseName?: string | null;
  onClose: () => void;
  onSubmit: (payload: Record<string, unknown>, applyToActiveLease: boolean) => void;
}

function normalizeRoomType(value: string | undefined): RoomType {
  const lower = String(value ?? '').toLowerCase();
  return roomTypes.some((type) => type.value === lower) ? lower as RoomType : 'single';
}

const statuses: RoomStatus[] = ['vacant', 'occupied', 'maintenance'];

interface FormState {
  room_number: string;
  room_type: RoomType;
  base_rent_fee: string;
  base_deposit: string;
  monthly_deposit_deduction: string;
  electricity_unit_price: string;
  water_unit_price: string;
  status: RoomStatus;
  notes: string;
}

const emptyState: FormState = {
  room_number: '',
  room_type: 'single',
  base_rent_fee: '',
  base_deposit: '',
  monthly_deposit_deduction: '',
  electricity_unit_price: '',
  water_unit_price: '',
  status: 'vacant',
  notes: ''
};

export function RoomForm({ open, room, pending, error, activeLeaseName, onClose, onSubmit }: RoomFormProps) {
  const [form, setForm] = useState<FormState>(emptyState);
  const [touched, setTouched] = useState(false);
  const [applyToLease, setApplyToLease] = useState(true);

  useEffect(() => {
    if (!open) return;
    setTouched(false);
    setApplyToLease(true);
    setForm(
      room ?
      {
        room_number: room.room_number ?? '',
        room_type: normalizeRoomType(room.room_type),
        base_rent_fee: String(room.base_rent_fee ?? ''),
        base_deposit: String(room.base_deposit ?? ''),
        monthly_deposit_deduction: String(room.monthly_deposit_deduction ?? ''),
        electricity_unit_price: String(room.electricity_unit_price ?? ''),
        water_unit_price: String(room.water_unit_price ?? ''),
        status: room.status ?? 'vacant',
        notes: room.notes ?? ''
      } :
      emptyState
    );
  }, [open, room]);

  const set = (key: keyof FormState) => (event: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
  setForm((prev) => ({ ...prev, [key]: event.target.value }));

  const missingNumber = touched && !form.room_number.trim();
  const missingRent = touched && !form.base_rent_fee;

  const handleSubmit = () => {
    setTouched(true);
    if (!form.room_number.trim() || !form.base_rent_fee) return;
    onSubmit(
      {
        room_number: form.room_number.trim(),
        room_type: form.room_type,
        base_rent_fee: toNumber(form.base_rent_fee),
        base_deposit: toNumber(form.base_deposit),
        monthly_deposit_deduction: toNumber(form.monthly_deposit_deduction),
        electricity_unit_price: form.electricity_unit_price === '' ? null : toNumber(form.electricity_unit_price),
        water_unit_price: form.water_unit_price === '' ? null : toNumber(form.water_unit_price),
        status: form.status,
        notes: form.notes.trim()
      },
      applyToLease
    );
  };

  return (
    <FormModal
      open={open}
      onClose={onClose}
      onSubmit={handleSubmit}
      title={room ? `Edit room ${room.room_number}` : 'Add room'}
      description="Base rent, base deposit and the monthly deduction are copied onto each new lease for this room."
      submitLabel={room ? 'Save changes' : 'Create room'}
      pending={pending}
      error={error}>
      
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Room number" htmlFor="room_number" required error={missingNumber ? 'Room number is required.' : undefined}>
          <Input id="room_number" value={form.room_number} onChange={set('room_number')} placeholder="103" />
        </Field>
        <Field label="Room type" htmlFor="room_type">
          <Select id="room_type" value={form.room_type} onChange={set('room_type')}>
            {roomTypes.map((type) =>
            <option key={type.value} value={type.value}>
                {type.label}
              </option>
            )}
          </Select>
        </Field>
        <Field label="Base rent fee" htmlFor="base_rent_fee" required error={missingRent ? 'Rent fee is required.' : undefined}>
          <Input id="base_rent_fee" type="number" min="0" step="0.01" value={form.base_rent_fee} onChange={set('base_rent_fee')} placeholder="18000" />
        </Field>
        <Field label="Base deposit" htmlFor="base_deposit" hint="Collected before the lease starts.">
          <Input id="base_deposit" type="number" min="0" step="0.01" value={form.base_deposit} onChange={set('base_deposit')} placeholder="36000" />
        </Field>
        <Field
          label="Monthly deposit deduction"
          htmlFor="monthly_deposit_deduction"
          hint="Taken off the rent each month until the deposit runs out.">
          
          <Input
            id="monthly_deposit_deduction"
            type="number"
            min="0"
            step="0.01"
            value={form.monthly_deposit_deduction}
            onChange={set('monthly_deposit_deduction')}
            placeholder="1500" />
          
        </Field>
        <Field
          label="Default electricity rate"
          htmlFor="electricity_unit_price"
          hint="Optional fallback. Monthly rates come from the building bill.">
          
          <Input
            id="electricity_unit_price"
            type="number"
            min="0"
            step="0.01"
            value={form.electricity_unit_price}
            onChange={set('electricity_unit_price')}
            placeholder="55" />
          
        </Field>
        <Field label="Default water rate" htmlFor="water_unit_price" hint="Optional fallback.">
          <Input
            id="water_unit_price"
            type="number"
            min="0"
            step="0.01"
            value={form.water_unit_price}
            onChange={set('water_unit_price')}
            placeholder="40" />
          
        </Field>
        <Field label="Status" htmlFor="status">
          <Select id="status" value={form.status} onChange={set('status')}>
            {statuses.map((status) =>
            <option key={status} value={status}>
                {status.charAt(0).toUpperCase() + status.slice(1)}
              </option>
            )}
          </Select>
        </Field>
      </div>
      <Field label="Notes" htmlFor="notes" hint="Optional — visible to staff only.">
        <Textarea id="notes" value={form.notes} onChange={set('notes')} placeholder="Bathroom re-tiling in progress" />
      </Field>

      {room && activeLeaseName &&
      <label className="flex cursor-pointer items-start gap-2.5 rounded-lg border border-line bg-subtle px-3 py-2.5">
          <input
          type="checkbox"
          className="mt-0.5 h-4 w-4 accent-brand-600"
          checked={applyToLease}
          onChange={(event) => setApplyToLease(event.target.checked)} />
        
          <span className="min-w-0">
            <span className="block text-[13px] font-medium text-ink">Apply to {activeLeaseName}&apos;s active lease</span>
            <span className="block text-[12px] leading-relaxed text-ink-muted">
              Updates the rent and monthly deposit deduction used on their next bill. The deposit they already paid is left
              untouched.
            </span>
          </span>
        </label>
      }
    </FormModal>);

}