import React, { useEffect, useState } from 'react';
import type { Room, RoomRepair } from '../../types';
import type { ApiError } from '../../utils/api';
import { toNumber, today } from '../../utils/format';
import { Field, Input, Select, Textarea } from '../ui/Field';
import { FormModal } from '../ui/FormModal';

interface RepairFormProps {
  open: boolean;
  repair: RoomRepair | null;
  rooms: Room[];
  pending: boolean;
  error: ApiError | null;
  onClose: () => void;
  onSubmit: (payload: Record<string, unknown>) => void;
}

export function RepairForm({ open, repair, rooms, pending, error, onClose, onSubmit }: RepairFormProps) {
  const [room, setRoom] = useState('');
  const [cost, setCost] = useState('');
  const [description, setDescription] = useState('');
  const [date, setDate] = useState(today());
  const [touched, setTouched] = useState(false);

  useEffect(() => {
    if (!open) return;
    setTouched(false);
    setRoom(repair ? String(repair.room) : '');
    setCost(repair ? String(repair.repair_cost ?? '') : '');
    setDescription(repair?.repair_description ?? '');
    setDate(repair?.repair_date ?? today());
  }, [open, repair]);

  const handleSubmit = () => {
    setTouched(true);
    if (!room || toNumber(cost) <= 0) return;
    onSubmit({
      room: toNumber(room),
      repair_cost: toNumber(cost),
      repair_description: description.trim(),
      repair_date: date
    });
  };

  return (
    <FormModal
      open={open}
      onClose={onClose}
      onSubmit={handleSubmit}
      title={repair ? `Edit repair · Room ${repair.room_number ?? repair.room}` : 'Log room repair'}
      description="Repair costs are deducted from profit and from a tenant's deposit refund when logged at move-out."
      submitLabel={repair ? 'Save changes' : 'Log repair'}
      pending={pending}
      error={error}>
      
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Room" htmlFor="repair_room" required error={touched && !room ? 'Select a room.' : undefined}>
          <Select id="repair_room" value={room} onChange={(event) => setRoom(event.target.value)}>
            <option value="">Select room…</option>
            {rooms.map((item) =>
            <option key={item.id} value={item.id}>
                Room {item.room_number} · {item.room_type}
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
        <Field label="Repair date" htmlFor="repair_date_field" className="sm:col-span-2">
          <Input id="repair_date_field" type="date" value={date} onChange={(event) => setDate(event.target.value)} />
        </Field>
      </div>
      <Field label="Description" htmlFor="repair_description_field">
        <Textarea
          id="repair_description_field"
          value={description}
          onChange={(event) => setDescription(event.target.value)}
          placeholder="Ceiling fan replacement" />
        
      </Field>
    </FormModal>);

}