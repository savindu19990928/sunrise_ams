import React, { useEffect, useState } from 'react';
import type { Room, UtilityRecord } from '../../types';
import type { ApiError } from '../../utils/api';
import { firstOfCurrentMonth, formatCurrency, monthInputValue, toNumber } from '../../utils/format';
import { Field, Input, Select } from '../ui/Field';
import { FormModal } from '../ui/FormModal';

interface UtilityFormProps {
  open: boolean;
  record: UtilityRecord | null;
  rooms: Room[];
  defaultMonth?: string;
  pending: boolean;
  error: ApiError | null;
  onClose: () => void;
  onSubmit: (payload: Record<string, unknown>) => void;
}

export function UtilityForm({
  open,
  record,
  rooms,
  defaultMonth,
  pending,
  error,
  onClose,
  onSubmit
}: UtilityFormProps) {
  const [room, setRoom] = useState('');
  const [month, setMonth] = useState(monthInputValue(defaultMonth ?? firstOfCurrentMonth()));
  const [electricityUnits, setElectricityUnits] = useState('');
  const [waterUnits, setWaterUnits] = useState('');
  const [touched, setTouched] = useState(false);

  useEffect(() => {
    if (!open) return;
    setTouched(false);
    setRoom(record ? String(record.room) : '');
    setMonth(monthInputValue(record?.billing_month ?? defaultMonth ?? firstOfCurrentMonth()));
    setElectricityUnits(record?.electricity_units !== undefined ? String(record.electricity_units) : '');
    setWaterUnits(record?.water_units !== undefined ? String(record.water_units) : '');
  }, [open, record, defaultMonth]);

  const selectedRoom = rooms.find((item) => String(item.id) === room);
  const electricityRate = toNumber(selectedRoom?.electricity_unit_price);
  const waterRate = toNumber(selectedRoom?.water_unit_price);
  const electricityCost = toNumber(electricityUnits) * electricityRate;
  const waterCost = toNumber(waterUnits) * waterRate;
  const missingRates = Boolean(selectedRoom) && (!electricityRate || !waterRate);

  const handleSubmit = () => {
    setTouched(true);
    if (!room || !month) return;
    onSubmit({
      room: toNumber(room),
      billing_month: `${month}-01`,
      electricity_units: toNumber(electricityUnits),
      water_units: toNumber(waterUnits)
    });
  };

  return (
    <FormModal
      open={open}
      onClose={onClose}
      onSubmit={handleSubmit}
      title={record ? `Edit utilities · Room ${record.room_number ?? record.room}` : 'Enter room utilities'}
      description="Enter this month's meter units. Costs are calculated with the room's own electricity and water rates."
      submitLabel={record ? 'Save changes' : 'Save utilities'}
      pending={pending}
      error={error}>
      
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Room" htmlFor="utility_room" required error={touched && !room ? 'Select a room.' : undefined}>
          <Select id="utility_room" value={room} onChange={(event) => setRoom(event.target.value)}>
            <option value="">Select room…</option>
            {rooms.map((item) =>
            <option key={item.id} value={item.id}>
                Room {item.room_number} · {item.room_type}
              </option>
            )}
          </Select>
        </Field>
        <Field label="Billing month" htmlFor="utility_month" required hint={`Stored as ${month || 'YYYY-MM'}-01.`}>
          <Input id="utility_month" type="month" value={month} onChange={(event) => setMonth(event.target.value)} />
        </Field>
        <Field
          label="Electricity units"
          htmlFor="utility_electricity"
          hint={selectedRoom ? `${formatCurrency(electricityRate)} per unit for this room` : undefined}>
          
          <Input
            id="utility_electricity"
            type="number"
            min="0"
            step="0.01"
            value={electricityUnits}
            onChange={(event) => setElectricityUnits(event.target.value)}
            placeholder="42" />
          
        </Field>
        <Field
          label="Water units"
          htmlFor="utility_water"
          hint={selectedRoom ? `${formatCurrency(waterRate)} per unit for this room` : undefined}>
          
          <Input
            id="utility_water"
            type="number"
            min="0"
            step="0.01"
            value={waterUnits}
            onChange={(event) => setWaterUnits(event.target.value)}
            placeholder="18" />
          
        </Field>
      </div>

      {missingRates &&
      <p className="rounded-lg border border-warn-100 bg-warn-50 px-3 py-2.5 text-[13px] text-warn-700">
          Room {selectedRoom?.room_number} has no {!electricityRate && !waterRate ? 'unit prices' : !electricityRate ? 'electricity unit price' : 'water unit price'} set.
          Add {!electricityRate && !waterRate ? 'them' : 'it'} on the Rooms page so costs aren&apos;t billed at zero.
        </p>
      }

      <dl className="rounded-lg border border-line bg-subtle px-3 py-1 text-[13px]">
        <div className="flex items-baseline justify-between gap-3 py-1.5">
          <dt className="text-ink-muted">
            Electricity · {toNumber(electricityUnits)} × {formatCurrency(electricityRate)}
          </dt>
          <dd className="text-ink">{formatCurrency(electricityCost)}</dd>
        </div>
        <div className="flex items-baseline justify-between gap-3 py-1.5">
          <dt className="text-ink-muted">
            Water · {toNumber(waterUnits)} × {formatCurrency(waterRate)}
          </dt>
          <dd className="text-ink">{formatCurrency(waterCost)}</dd>
        </div>
        <div className="flex items-baseline justify-between gap-3 border-t border-line py-2">
          <dt className="font-medium text-ink">Added to this month&apos;s bill</dt>
          <dd className="font-semibold text-ink">{formatCurrency(electricityCost + waterCost)}</dd>
        </div>
      </dl>
    </FormModal>);

}