import React, { useEffect, useState } from 'react';
import { roomTypes } from '../../data/roomTypes';
import type { Room, RoomType } from '../../types';
import type { ApiError } from '../../utils/api';
import { Field, Input, Select, Textarea } from '../ui/Field';
import { FormModal } from '../ui/FormModal';

interface RoomFormProps {
  open: boolean;
  room: Room | null;
  pending: boolean;
  error: ApiError | null;
  onClose: () => void;
  onSubmit: (payload: Record<string, unknown>) => void;
}

function normalizeRoomType(value: string | undefined): RoomType {
  const lower = String(value ?? '').toLowerCase();
  return roomTypes.some((type) => type.value === lower) ? lower as RoomType : 'single';
}

interface FormState {
  room_number: string;
  room_type: RoomType;
  note: string;
}

const emptyState: FormState = {
  room_number: '',
  room_type: 'single',
  note: ''
};

export function RoomForm({ open, room, pending, error, onClose, onSubmit }: RoomFormProps) {
  const [form, setForm] = useState<FormState>(emptyState);
  const [touched, setTouched] = useState(false);

  useEffect(() => {
    if (!open) return;
    setTouched(false);
    setForm(
      room ?
      {
        room_number: room.room_number ?? '',
        room_type: normalizeRoomType(room.room_type),
        note: room.note ?? room.notes ?? ''
      } :
      emptyState
    );
  }, [open, room]);

  const set = (key: keyof FormState) => (event: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
  setForm((prev) => ({ ...prev, [key]: event.target.value }));

  const missingNumber = touched && !form.room_number.trim();

  const handleSubmit = () => {
    setTouched(true);
    if (!form.room_number.trim()) return;
    onSubmit({
      room_number: form.room_number.trim(),
      room_type: form.room_type,
      note: form.note.trim()
    });
  };

  return (
    <FormModal
      open={open}
      onClose={onClose}
      onSubmit={handleSubmit}
      title={room ? `Edit room ${room.room_number}` : 'Add room'}
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
      </div>
      <Field label="Note" htmlFor="note">
        <Textarea id="note" value={form.note} onChange={set('note')} placeholder="Ground floor single room" />
      </Field>
    </FormModal>);

}
