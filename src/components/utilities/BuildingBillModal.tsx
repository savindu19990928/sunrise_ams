import React, { useEffect, useMemo, useState } from 'react';
import type { ID, Lease, MonthlyUtilitySummary, Room } from '../../types';
import type { ApiError } from '../../utils/api';
import { formatCurrency, formatMonth, toNumber } from '../../utils/format';
import { formatDifference, formatPerDay, formatUnits, usageDifference } from '../../utils/utilityUsage';
import { Field, Input } from '../ui/Field';
import { FormModal } from '../ui/FormModal';

interface BuildingBillModalProps {
  open: boolean;
  /** `YYYY-MM` */
  defaultMonth: string;
  rooms: Room[];
  leases: Lease[];
  /** Existing data for the default month, used to prefill when re-entering. */
  existing: MonthlyUtilitySummary | null;
  pending: boolean;
  error: ApiError | null;
  onClose: () => void;
  onSubmit: (payload: Record<string, unknown>, month: string) => void;
}

function DifferenceLine({ supplier, meters, difference }: {supplier: string;meters: number;difference: number | null;}) {
  const tone =
  difference === null ? 'text-ink-soft' : Math.abs(difference) < 0.005 ? 'text-success-700' : 'text-warn-700';
  return (
    <p className="mt-2 border-t border-line pt-2 text-[12px] text-ink-muted">
      Supplier {supplier === '' ? '—' : `${formatUnits(supplier)} units`} · meters {formatUnits(meters)} units ·{' '}
      <span className={`font-medium ${tone}`}>{formatDifference(difference, supplier)}</span>
    </p>);

}

interface UsageDraft {
  electricity: string;
  water: string;
}

export function BuildingBillModal({
  open,
  defaultMonth,
  rooms,
  leases,
  existing,
  pending,
  error,
  onClose,
  onSubmit
}: BuildingBillModalProps) {
  const [month, setMonth] = useState(defaultMonth);
  const [dueDate, setDueDate] = useState('');
  const [electricityBill, setElectricityBill] = useState('');
  const [waterBill, setWaterBill] = useState('');
  const [supplierElectricity, setSupplierElectricity] = useState('');
  const [supplierWater, setSupplierWater] = useState('');
  const [usages, setUsages] = useState<Record<string, UsageDraft>>({});
  const [touched, setTouched] = useState(false);

  useEffect(() => {
    if (!open) return;
    setTouched(false);
    setMonth(defaultMonth);
    const bill = existing?.building_utility_bill;
    setElectricityBill(bill ? String(toNumber(bill.total_electricity_bill)) : '');
    setWaterBill(bill ? String(toNumber(bill.total_water_bill)) : '');
    setSupplierElectricity(
      bill?.supplier_electricity_units !== undefined && bill?.supplier_electricity_units !== null ?
      String(toNumber(bill.supplier_electricity_units)) :
      ''
    );
    setSupplierWater(
      bill?.supplier_water_units !== undefined && bill?.supplier_water_units !== null ? String(toNumber(bill.supplier_water_units)) : ''
    );
    setDueDate(bill?.due_date ?? `${defaultMonth}-25`);
    const next: Record<string, UsageDraft> = {};
    for (const row of existing?.rooms_utility_data ?? []) {
      next[String(row.room_id)] = {
        electricity: String(toNumber(row.electricity_units)),
        water: String(toNumber(row.water_units))
      };
    }
    setUsages(next);
  }, [open, defaultMonth, existing]);

  const occupiedRoomIds = useMemo(
    () => new Set<ID>(leases.filter((lease) => lease.is_active).map((lease) => lease.room)),
    [leases]
  );

  const sortedRooms = useMemo(
    () =>
    [...rooms].sort((a, b) => {
      const occupied = Number(occupiedRoomIds.has(b.id)) - Number(occupiedRoomIds.has(a.id));
      return occupied || a.room_number.localeCompare(b.room_number, undefined, { numeric: true });
    }),
    [rooms, occupiedRoomIds]
  );

  const totals = useMemo(() => {
    let electricity = 0;
    let water = 0;
    for (const usage of Object.values(usages)) {
      electricity += toNumber(usage.electricity);
      water += toNumber(usage.water);
    }
    return { electricity, water };
  }, [usages]);

  const electricityRate = totals.electricity > 0 ? toNumber(electricityBill) / totals.electricity : 0;
  const waterRate = totals.water > 0 ? toNumber(waterBill) / totals.water : 0;

  const setUsage = (roomId: ID, key: keyof UsageDraft, value: string) =>
  setUsages((prev) => ({
    ...prev,
    [String(roomId)]: { electricity: '', water: '', ...prev[String(roomId)], [key]: value }
  }));

  const billError = (value: string) => value === '' ? 'Enter the supplier amount (0 if none).' : toNumber(value) < 0 ? 'Cannot be negative.' : undefined;
  const unitsError = (value: string) =>
  value === '' ? 'Enter the units on the supplier bill.' : toNumber(value) < 0 ? 'Cannot be negative.' : undefined;
  const electricityUsageError = toNumber(electricityBill) > 0 && totals.electricity === 0;
  const waterUsageError = toNumber(waterBill) > 0 && totals.water === 0;
  const electricityDifference = usageDifference(supplierElectricity, totals.electricity);
  const waterDifference = usageDifference(supplierWater, totals.water);

  const handleSubmit = () => {
    setTouched(true);
    if (
    !month ||
    billError(electricityBill) ||
    billError(waterBill) ||
    unitsError(supplierElectricity) ||
    unitsError(supplierWater) ||
    electricityUsageError ||
    waterUsageError)

    return;
    const roomUsages = sortedRooms.
    filter((room) => {
      const usage = usages[String(room.id)];
      return usage && (usage.electricity !== '' || usage.water !== '');
    }).
    map((room) => ({
      room_number: room.room_number,
      electricity_units: toNumber(usages[String(room.id)].electricity),
      water_units: toNumber(usages[String(room.id)].water)
    }));
    if (!roomUsages.length) return;
    onSubmit(
      {
        billing_month: `${month}-01`,
        total_electricity_bill: toNumber(electricityBill),
        total_water_bill: toNumber(waterBill),
        supplier_electricity_units: toNumber(supplierElectricity),
        supplier_water_units: toNumber(supplierWater),
        due_date: dueDate || undefined,
        room_usages: roomUsages
      },
      month
    );
  };

  const noUsage = touched && totals.electricity === 0 && totals.water === 0;

  return (
    <FormModal
      open={open}
      onClose={onClose}
      onSubmit={handleSubmit}
      title="Enter building utility bill"
      description="Enter this month's supplier bills with the usage they state, then each room's meter usage. The per-unit price is the bill divided by the rooms' combined usage; the difference shows units the room meters didn't capture."
      submitLabel="Calculate & save"
      pending={pending}
      error={error}
      size="lg">
      
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Field label="Billing month" htmlFor="bb_month" required>
          <Input id="bb_month" type="month" value={month} onChange={(event) => setMonth(event.target.value)} />
        </Field>
        <Field label="Supplier due date" htmlFor="bb_due">
          <Input id="bb_due" type="date" value={dueDate} onChange={(event) => setDueDate(event.target.value)} />
        </Field>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Field
          label="Total electricity bill"
          htmlFor="bb_electricity"
          required
          error={touched ? billError(electricityBill) : undefined}>
          
          <Input
            id="bb_electricity"
            type="number"
            min="0"
            step="0.01"
            value={electricityBill}
            onChange={(event) => setElectricityBill(event.target.value)}
            placeholder="24000" />
          
        </Field>
        <Field
          label="Supplier electricity units"
          htmlFor="bb_supplier_electricity"
          required
          error={touched ? unitsError(supplierElectricity) : undefined}>
          
          <Input
            id="bb_supplier_electricity"
            type="number"
            min="0"
            step="0.01"
            value={supplierElectricity}
            onChange={(event) => setSupplierElectricity(event.target.value)}
            placeholder="215" />
          
        </Field>
        <Field label="Total water bill" htmlFor="bb_water" required error={touched ? billError(waterBill) : undefined}>
          <Input
            id="bb_water"
            type="number"
            min="0"
            step="0.01"
            value={waterBill}
            onChange={(event) => setWaterBill(event.target.value)}
            placeholder="12000" />
          
        </Field>
        <Field
          label="Supplier water units"
          htmlFor="bb_supplier_water"
          required
          error={touched ? unitsError(supplierWater) : undefined}>
          
          <Input
            id="bb_supplier_water"
            type="number"
            min="0"
            step="0.01"
            value={supplierWater}
            onChange={(event) => setSupplierWater(event.target.value)}
            placeholder="108" />
          
        </Field>
      </div>

      <div className="grid gap-px overflow-hidden rounded-lg border border-line bg-line sm:grid-cols-2">
        <div className="bg-subtle px-3.5 py-3">
          <p className="text-[12px] text-ink-muted">Electricity price this month</p>
          <p className="mt-0.5 text-lg font-semibold tracking-[-0.01em] text-ink">
            {formatCurrency(electricityRate)} <span className="text-[13px] font-normal text-ink-muted">/ unit</span>
          </p>
          <p className={`text-[12px] ${electricityUsageError && touched ? 'text-danger-600' : 'text-ink-soft'}`}>
            {formatCurrency(electricityBill)} ÷ {formatUnits(totals.electricity)} metered units
          </p>
          <DifferenceLine supplier={supplierElectricity} meters={totals.electricity} difference={electricityDifference} />
        </div>
        <div className="bg-subtle px-3.5 py-3">
          <p className="text-[12px] text-ink-muted">Water price this month</p>
          <p className="mt-0.5 text-lg font-semibold tracking-[-0.01em] text-ink">
            {formatCurrency(waterRate)} <span className="text-[13px] font-normal text-ink-muted">/ unit</span>
          </p>
          <p className={`text-[12px] ${waterUsageError && touched ? 'text-danger-600' : 'text-ink-soft'}`}>
            {formatCurrency(waterBill)} ÷ {formatUnits(totals.water)} metered units
          </p>
          <DifferenceLine supplier={supplierWater} meters={totals.water} difference={waterDifference} />
        </div>
      </div>

      <div>
        <div className="flex items-baseline justify-between gap-3">
          <h3 className="text-[13px] font-medium text-ink">Room usage · {formatMonth(`${month}-01`)}</h3>
          <p className="text-[12px] text-ink-muted">Leave a room blank to skip it</p>
        </div>
        {noUsage &&
        <p role="alert" className="mt-2 text-[12px] text-danger-600">
            Enter usage for at least one room.
          </p>
        }
        <div className="mt-2 overflow-x-auto rounded-lg border border-line">
          <table className="w-full min-w-[560px] text-[13px]">
            <thead className="bg-subtle text-left text-[12px] text-ink-muted">
              <tr>
                <th scope="col" className="px-3 py-2 font-medium">
                  Room
                </th>
                <th scope="col" className="px-3 py-2 font-medium">
                  Electricity units
                </th>
                <th scope="col" className="px-3 py-2 font-medium">
                  Water units
                </th>
                <th scope="col" className="px-3 py-2 text-right font-medium">
                  Room bill
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {sortedRooms.map((room) => {
                const usage = usages[String(room.id)] ?? { electricity: '', water: '' };
                const estimate = toNumber(usage.electricity) * electricityRate + toNumber(usage.water) * waterRate;
                return (
                  <tr key={room.id}>
                    <td className="px-3 py-2 align-top">
                      <p className="font-medium text-ink">Room {room.room_number}</p>
                      <p className="text-[12px] text-ink-soft">
                        {occupiedRoomIds.has(room.id) ? 'Occupied' : 'Vacant'}
                      </p>
                    </td>
                    <td className="px-3 py-2 align-top">
                      <Input
                        aria-label={`Room ${room.room_number} electricity units`}
                        type="number"
                        min="0"
                        step="0.01"
                        value={usage.electricity}
                        onChange={(event) => setUsage(room.id, 'electricity', event.target.value)}
                        className="w-28" />
                      
                      {usage.electricity !== '' &&
                      <p className="mt-1 text-[11px] text-ink-muted">{formatPerDay(usage.electricity, month)}</p>
                      }
                    </td>
                    <td className="px-3 py-2 align-top">
                      <Input
                        aria-label={`Room ${room.room_number} water units`}
                        type="number"
                        min="0"
                        step="0.01"
                        value={usage.water}
                        onChange={(event) => setUsage(room.id, 'water', event.target.value)}
                        className="w-28" />
                      
                      {usage.water !== '' &&
                      <p className="mt-1 text-[11px] text-ink-muted">{formatPerDay(usage.water, month)}</p>
                      }
                    </td>
                    <td className="px-3 py-2 text-right align-top font-medium text-ink">
                      {usage.electricity === '' && usage.water === '' ?
                      <span className="font-normal text-ink-soft">—</span> :

                      formatCurrency(estimate)
                      }
                    </td>
                  </tr>);

              })}
            </tbody>
          </table>
        </div>
      </div>

      <p className="text-[12px] leading-relaxed text-ink-muted">
        Each tenant pays their room bill directly to the utility supplier — these amounts are never recorded as income.
        Any advance credit a room has from earlier overpayments is applied to its new bill automatically. You can
        override any room&apos;s per-unit price afterwards.
      </p>
    </FormModal>);

}