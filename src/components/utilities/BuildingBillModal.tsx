import React, { useEffect, useMemo, useState } from 'react';
import type { ID, Lease, MonthlyUtilitySummary, Room, RoomPreviousReading } from '../../types';
import { type ApiError, apiList, apiRequest, buildQuery } from '../../utils/api';
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
      Meter {supplier === '' ? '—' : `${formatUnits(supplier)}`} · rooms {formatUnits(meters)} ·{' '}
      <span className={`font-medium ${tone}`}>{formatDifference(difference, supplier)}</span>
    </p>);

}

interface RoomReadingDraft {
  currElectricity: string;
  currWater: string;
  customRateEnabled: boolean;
  customElectricityRate: string;
  customWaterRate: string;
}

const emptyDraft: RoomReadingDraft = {
  currElectricity: '',
  currWater: '',
  customRateEnabled: false,
  customElectricityRate: '',
  customWaterRate: ''
};

function asReadingString(value: number | string | null | undefined): string {
  if (value === null || value === undefined || value === '') return '';
  return String(toNumber(value));
}

function seedFromSummary(summary: MonthlyUtilitySummary | null): Record<string, RoomReadingDraft> {
  const next: Record<string, RoomReadingDraft> = {};
  const bill = summary?.building_utility_bill;
  for (const row of summary?.rooms_utility_data ?? []) {
    const hasCustomElec = bill && toNumber(row.electricity_unit_price) !== toNumber(bill.electricity_unit_price);
    const hasCustomWater = bill && toNumber(row.water_unit_price) !== toNumber(bill.water_unit_price);
    const customRateEnabled = Boolean(hasCustomElec || hasCustomWater);
    next[String(row.room_id)] = {
      currElectricity: asReadingString(row.electricity_meter_reading),
      currWater: asReadingString(row.water_meter_reading),
      customRateEnabled,
      customElectricityRate: customRateEnabled ? asReadingString(row.electricity_unit_price) : '',
      customWaterRate: customRateEnabled ? asReadingString(row.water_unit_price) : ''
    };
  }
  return next;
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
  const [activeSummary, setActiveSummary] = useState<MonthlyUtilitySummary | null>(existing);
  const [dueDate, setDueDate] = useState('');
  const [electricityBill, setElectricityBill] = useState('');
  const [waterBill, setWaterBill] = useState('');
  const [buildingElectricityReading, setBuildingElectricityReading] = useState('');
  const [buildingWaterReading, setBuildingWaterReading] = useState('');
  const [readings, setReadings] = useState<Record<string, RoomReadingDraft>>({});
  const [prevMap, setPrevMap] = useState<Record<string, {elec: number;water: number;}>>({});
  const [prevReadingsLoading, setPrevReadingsLoading] = useState(false);
  const [touched, setTouched] = useState(false);

  const applySummaryHeader = (summary: MonthlyUtilitySummary | null, targetMonth: string) => {
    const bill = summary?.building_utility_bill;
    setActiveSummary(summary);
    setElectricityBill(bill ? String(toNumber(bill.total_electricity_bill)) : '');
    setWaterBill(bill ? String(toNumber(bill.total_water_bill)) : '');
    setBuildingElectricityReading(
      bill?.supplier_electricity_units !== undefined && bill?.supplier_electricity_units !== null ?
      String(toNumber(bill.supplier_electricity_units)) :
      ''
    );
    setBuildingWaterReading(
      bill?.supplier_water_units !== undefined && bill?.supplier_water_units !== null ?
      String(toNumber(bill.supplier_water_units)) :
      ''
    );
    setDueDate(bill?.due_date ?? `${targetMonth}-25`);
  };

  // Seed initial state when the modal opens.
  useEffect(() => {
    if (!open) return;
    setTouched(false);
    setMonth(defaultMonth);
    applySummaryHeader(existing, defaultMonth);
    setReadings(seedFromSummary(existing));
    const seededPrev: Record<string, {elec: number;water: number;}> = {};
    for (const row of existing?.rooms_utility_data ?? []) {
      seededPrev[String(row.room_id)] = {
        elec: toNumber(row.previous_electricity_meter_reading),
        water: toNumber(row.previous_water_meter_reading)
      };
    }
    setPrevMap(seededPrev);
  }, [open, defaultMonth, existing]);

  // Fetch previous months' meter readings whenever open & month changes; fallback to 0 on failure.
  useEffect(() => {
    if (!open || !month || !/^\d{4}-\d{2}$/.test(month)) return;
    const controller = new AbortController();
    setPrevReadingsLoading(true);

    const summaryPromise =
    month === defaultMonth ?
    Promise.resolve(existing) :
    apiRequest<MonthlyUtilitySummary>(`/api/utilities/monthly-summary/${buildQuery({ billing_month: month })}`, {
      signal: controller.signal
    }).catch(() => null);

    const prevPromise = apiList<RoomPreviousReading>(
      `/api/utilities/previous-readings/${buildQuery({ billing_month: month })}`,
      { signal: controller.signal }
    ).catch(() => [] as RoomPreviousReading[]);

    Promise.all([summaryPromise, prevPromise]).
    then(([monthSummary, prevList]) => {
      if (controller.signal.aborted) return;

      if (month !== defaultMonth) {
        applySummaryHeader(monthSummary, month);
        setReadings(seedFromSummary(monthSummary));
      }

      const nextPrev: Record<string, {elec: number;water: number;}> = {};
      for (const row of monthSummary?.rooms_utility_data ?? []) {
        nextPrev[String(row.room_id)] = {
          elec: toNumber(row.previous_electricity_meter_reading),
          water: toNumber(row.previous_water_meter_reading)
        };
      }
      for (const item of prevList) {
        const key = String(item.room_id);
        const existingPrev = nextPrev[key];
        nextPrev[key] = {
          elec: existingPrev ? existingPrev.elec : toNumber(item.previous_electricity_meter_reading),
          water: existingPrev ? existingPrev.water : toNumber(item.previous_water_meter_reading)
        };
      }
      setPrevMap(nextPrev);
    }).
    finally(() => {
      if (!controller.signal.aborted) setPrevReadingsLoading(false);
    });

    return () => controller.abort();
  }, [open, month, defaultMonth, existing]);

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

  const roomCalculations = useMemo(() => {
    const map = new Map<
      ID,
      {
        included: boolean;
        prevElec: number;
        prevWater: number;
        elecUnits: number;
        waterUnits: number;
        elecInvalid: boolean;
        waterInvalid: boolean;
      }>();
    let totalElec = 0;
    let totalWater = 0;

    for (const room of sortedRooms) {
      const draft = readings[String(room.id)] ?? emptyDraft;
      const prev = prevMap[String(room.id)] ?? { elec: 0, water: 0 };
      const included = draft.currElectricity !== '' || draft.currWater !== '';
      const hasElec = draft.currElectricity !== '';
      const hasWater = draft.currWater !== '';
      const elecUnits = hasElec ? toNumber(draft.currElectricity) - prev.elec : 0;
      const waterUnits = hasWater ? toNumber(draft.currWater) - prev.water : 0;
      const elecInvalid = hasElec && elecUnits < 0;
      const waterInvalid = hasWater && waterUnits < 0;

      if (included) {
        if (!elecInvalid && hasElec) totalElec += elecUnits;
        if (!waterInvalid && hasWater) totalWater += waterUnits;
      }

      map.set(room.id, {
        included,
        prevElec: prev.elec,
        prevWater: prev.water,
        elecUnits,
        waterUnits,
        elecInvalid,
        waterInvalid
      });
    }

    return { map, totalElec, totalWater };
  }, [sortedRooms, readings, prevMap]);

  const defaultElectricityRate =
  roomCalculations.totalElec > 0 ? toNumber(electricityBill) / roomCalculations.totalElec : 0;
  const defaultWaterRate =
  roomCalculations.totalWater > 0 ? toNumber(waterBill) / roomCalculations.totalWater : 0;

  const updateRoom = (roomId: ID, patch: Partial<RoomReadingDraft>) =>
  setReadings((prev) => ({
    ...prev,
    [String(roomId)]: { ...emptyDraft, ...prev[String(roomId)], ...patch }
  }));

  const billError = (value: string) =>
  value === '' ? 'Required.' : toNumber(value) < 0 ? 'Cannot be negative.' : undefined;
  const optionalReadingError = (value: string) =>
  value !== '' && toNumber(value) < 0 ? 'Cannot be negative.' : undefined;
  const electricityUsageError = toNumber(electricityBill) > 0 && roomCalculations.totalElec === 0;
  const waterUsageError = toNumber(waterBill) > 0 && roomCalculations.totalWater === 0;
  const hasReadingErrors = Array.from(roomCalculations.map.values()).some(
    (calc) => calc.elecInvalid || calc.waterInvalid
  );
  const includedCount = Array.from(roomCalculations.map.values()).filter((calc) => calc.included).length;

  const electricityDifference = usageDifference(buildingElectricityReading, roomCalculations.totalElec);
  const waterDifference = usageDifference(buildingWaterReading, roomCalculations.totalWater);

  const handleSubmit = () => {
    setTouched(true);
    if (
    !month ||
    billError(electricityBill) ||
    billError(waterBill) ||
    optionalReadingError(buildingElectricityReading) ||
    optionalReadingError(buildingWaterReading) ||
    electricityUsageError ||
    waterUsageError ||
    hasReadingErrors ||
    includedCount === 0)
    {
      return;
    }

    const roomReadings = sortedRooms.
    filter((room) => roomCalculations.map.get(room.id)?.included).
    map((room) => {
      const draft = readings[String(room.id)] ?? emptyDraft;
      const calc = roomCalculations.map.get(room.id);
      const entry: Record<string, unknown> = {
        room_number: room.room_number,
        electricity_meter_reading: draft.currElectricity !== '' ? toNumber(draft.currElectricity) : calc?.prevElec ?? 0,
        water_meter_reading: draft.currWater !== '' ? toNumber(draft.currWater) : calc?.prevWater ?? 0
      };
      if (draft.customRateEnabled) {
        if (draft.customElectricityRate !== '') {
          entry.electricity_unit_price = toNumber(draft.customElectricityRate);
        }
        if (draft.customWaterRate !== '') {
          entry.water_unit_price = toNumber(draft.customWaterRate);
        }
      }
      return entry;
    });

    const payload: Record<string, unknown> = {
      billing_month: `${month}-01`,
      total_electricity_bill: toNumber(electricityBill),
      total_water_bill: toNumber(waterBill),
      due_date: dueDate || undefined,
      ...(buildingElectricityReading !== '' ? { supplier_electricity_units: toNumber(buildingElectricityReading) } : {}),
      ...(buildingWaterReading !== '' ? { supplier_water_units: toNumber(buildingWaterReading) } : {}),
      room_readings: roomReadings
    };

    onSubmit(payload, month);
  };

  const noUsage = touched && includedCount === 0;

  return (
    <FormModal
      open={open}
      onClose={onClose}
      onSubmit={handleSubmit}
      title={activeSummary?.building_utility_bill ? 'Update building utility bill' : 'Enter building utility bill'}
      submitLabel="Calculate & save"
      pending={pending}
      error={error}
      size="lg">
      
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Billing month" htmlFor="bb_month" required>
          <Input id="bb_month" type="month" value={month} onChange={(event) => setMonth(event.target.value)} />
        </Field>
        <Field label="Due date" htmlFor="bb_due">
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
          label="Electricity meter reading"
          htmlFor="bb_supplier_electricity"
          error={touched ? optionalReadingError(buildingElectricityReading) : undefined}>
          
          <Input
            id="bb_supplier_electricity"
            type="number"
            min="0"
            step="0.01"
            value={buildingElectricityReading}
            onChange={(event) => setBuildingElectricityReading(event.target.value)}
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
          label="Water meter reading"
          htmlFor="bb_supplier_water"
          error={touched ? optionalReadingError(buildingWaterReading) : undefined}>
          
          <Input
            id="bb_supplier_water"
            type="number"
            min="0"
            step="0.01"
            value={buildingWaterReading}
            onChange={(event) => setBuildingWaterReading(event.target.value)}
            placeholder="108" />
          
        </Field>
      </div>

      <div className="grid gap-px overflow-hidden rounded-lg border border-line bg-line sm:grid-cols-2">
        <div className="bg-subtle px-3.5 py-3">
          <p className="text-[12px] text-ink-muted">Default electricity rate</p>
          <p className="mt-0.5 text-lg font-semibold tracking-[-0.01em] text-ink">
            {formatCurrency(defaultElectricityRate)} <span className="text-[13px] font-normal text-ink-muted">/ unit</span>
          </p>
          <p className={`text-[12px] ${electricityUsageError && touched ? 'text-danger-600' : 'text-ink-soft'}`}>
            {formatCurrency(electricityBill)} ÷ {formatUnits(roomCalculations.totalElec)} units
          </p>
          <DifferenceLine supplier={buildingElectricityReading} meters={roomCalculations.totalElec} difference={electricityDifference} />
        </div>
        <div className="bg-subtle px-3.5 py-3">
          <p className="text-[12px] text-ink-muted">Default water rate</p>
          <p className="mt-0.5 text-lg font-semibold tracking-[-0.01em] text-ink">
            {formatCurrency(defaultWaterRate)} <span className="text-[13px] font-normal text-ink-muted">/ unit</span>
          </p>
          <p className={`text-[12px] ${waterUsageError && touched ? 'text-danger-600' : 'text-ink-soft'}`}>
            {formatCurrency(waterBill)} ÷ {formatUnits(roomCalculations.totalWater)} units
          </p>
          <DifferenceLine supplier={buildingWaterReading} meters={roomCalculations.totalWater} difference={waterDifference} />
        </div>
      </div>

      <div>
        <div className="flex items-baseline justify-between gap-3">
          <h3 className="text-[13px] font-medium text-ink">
            Room meter readings · {formatMonth(`${month}-01`)}
            {prevReadingsLoading && <span className="ml-2 text-[12px] font-normal text-ink-soft">Loading…</span>}
          </h3>
        </div>
        {noUsage &&
        <p role="alert" className="mt-2 text-[12px] text-danger-600">
            Enter meter readings for at least one room.
          </p>
        }
        <div className="mt-2 overflow-x-auto rounded-lg border border-line">
          <table className="w-full min-w-[620px] text-[13px]">
            <thead className="bg-subtle text-left text-[12px] text-ink-muted">
              <tr>
                <th scope="col" className="px-3 py-2 font-medium">
                  Room
                </th>
                <th scope="col" className="px-3 py-2 font-medium">
                  Electricity meter reading
                </th>
                <th scope="col" className="px-3 py-2 font-medium">
                  Water meter reading
                </th>
                <th scope="col" className="px-3 py-2 font-medium">
                  Rate
                </th>
                <th scope="col" className="px-3 py-2 text-right font-medium">
                  Room bill
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {sortedRooms.map((room) => {
                const draft = readings[String(room.id)] ?? emptyDraft;
                const calc = roomCalculations.map.get(room.id) ?? {
                  included: false,
                  prevElec: 0,
                  prevWater: 0,
                  elecUnits: 0,
                  waterUnits: 0,
                  elecInvalid: false,
                  waterInvalid: false
                };
                const roomElecRate =
                draft.customRateEnabled && draft.customElectricityRate !== '' ?
                toNumber(draft.customElectricityRate) :
                defaultElectricityRate;
                const roomWaterRate =
                draft.customRateEnabled && draft.customWaterRate !== '' ?
                toNumber(draft.customWaterRate) :
                defaultWaterRate;
                const estimate =
                (draft.currElectricity !== '' && !calc.elecInvalid ? calc.elecUnits * roomElecRate : 0) +
                (draft.currWater !== '' && !calc.waterInvalid ? calc.waterUnits * roomWaterRate : 0);

                return (
                  <tr key={room.id}>
                    <td className="px-3 py-2.5 align-top">
                      <p className="font-medium text-ink">Room {room.room_number}</p>
                      <p className="text-[12px] text-ink-soft">
                        {occupiedRoomIds.has(room.id) ? 'Occupied' : 'Vacant'}
                      </p>
                    </td>
                    <td className="px-3 py-2.5 align-top">
                      <Input
                        aria-label={`Room ${room.room_number} electricity meter reading`}
                        type="number"
                        min="0"
                        step="0.01"
                        placeholder={String(calc.prevElec)}
                        value={draft.currElectricity}
                        onChange={(event) => updateRoom(room.id, { currElectricity: event.target.value })}
                        className="w-28" />
                      <p className="mt-1 text-[11px] text-ink-soft">
                        Prev: {formatUnits(calc.prevElec)}
                      </p>
                      {draft.currElectricity !== '' && (
                        calc.elecInvalid ?
                        <p className="mt-0.5 text-[11px] text-danger-600">Below previous ({formatUnits(calc.prevElec)})</p> :
                        <p className="mt-0.5 text-[11px] text-ink-muted">
                          {formatUnits(calc.elecUnits)} units · {formatPerDay(calc.elecUnits, month)}
                        </p>
                      )}
                    </td>
                    <td className="px-3 py-2.5 align-top">
                      <Input
                        aria-label={`Room ${room.room_number} water meter reading`}
                        type="number"
                        min="0"
                        step="0.01"
                        placeholder={String(calc.prevWater)}
                        value={draft.currWater}
                        onChange={(event) => updateRoom(room.id, { currWater: event.target.value })}
                        className="w-28" />
                      <p className="mt-1 text-[11px] text-ink-soft">
                        Prev: {formatUnits(calc.prevWater)}
                      </p>
                      {draft.currWater !== '' && (
                        calc.waterInvalid ?
                        <p className="mt-0.5 text-[11px] text-danger-600">Below previous ({formatUnits(calc.prevWater)})</p> :
                        <p className="mt-0.5 text-[11px] text-ink-muted">
                          {formatUnits(calc.waterUnits)} units · {formatPerDay(calc.waterUnits, month)}
                        </p>
                      )}
                    </td>
                    <td className="px-3 py-2.5 align-top">
                      <label className="inline-flex cursor-pointer items-center gap-1.5 text-[12px] text-ink-muted">
                        <input
                          type="checkbox"
                          className="h-3.5 w-3.5 accent-brand-600"
                          checked={draft.customRateEnabled}
                          onChange={(event) =>
                            updateRoom(room.id, {
                              customRateEnabled: event.target.checked,
                              customElectricityRate:
                                event.target.checked && draft.customElectricityRate === '' ?
                                defaultElectricityRate.toFixed(2) :
                                draft.customElectricityRate,
                              customWaterRate:
                                event.target.checked && draft.customWaterRate === '' ?
                                defaultWaterRate.toFixed(2) :
                                draft.customWaterRate
                            })
                          } />
                        <span>Custom</span>
                      </label>
                      {draft.customRateEnabled &&
                      <div className="mt-1.5 flex flex-col gap-1">
                          <Input
                            aria-label={`Room ${room.room_number} custom electricity rate`}
                            type="number"
                            min="0"
                            step="0.01"
                            placeholder="Elec rate"
                            value={draft.customElectricityRate}
                            onChange={(event) => updateRoom(room.id, { customElectricityRate: event.target.value })}
                            className="w-24" />
                          <Input
                            aria-label={`Room ${room.room_number} custom water rate`}
                            type="number"
                            min="0"
                            step="0.01"
                            placeholder="Water rate"
                            value={draft.customWaterRate}
                            onChange={(event) => updateRoom(room.id, { customWaterRate: event.target.value })}
                            className="w-24" />
                        </div>
                      }
                    </td>
                    <td className="px-3 py-2.5 text-right align-top font-medium text-ink">
                      {!calc.included ?
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
    </FormModal>);

}
