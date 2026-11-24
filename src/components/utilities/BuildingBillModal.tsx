import { useEffect, useMemo, useState } from 'react';
import type { ID, Lease, NormalizedMonthlyServiceSummary, Room, ServiceKind } from '../../types';
import { type ApiError, apiRequest, buildQuery } from '../../utils/api';
import { formatCurrency, formatDate, formatMonth, toNumber, today } from '../../utils/format';
import { extractMonthlySummary, extractPreviousReadings, SERVICE_CONFIG } from '../../utils/serviceRecords';
import { formatDifference, formatPerDay, formatUnits, usageDifference } from '../../utils/utilityUsage';
import { Field, Input } from '../ui/Field';
import { FormModal } from '../ui/FormModal';

interface BuildingBillModalProps {
  kind: ServiceKind;
  open: boolean;
  /** `YYYY-MM` */
  defaultMonth: string;
  rooms: Room[];
  leases: Lease[];
  /** Existing data for the default month, used to prefill when re-entering. */
  existing: NormalizedMonthlyServiceSummary | null;
  pending: boolean;
  error: ApiError | null;
  onClose: () => void;
  onSubmit: (payload: Record<string, unknown>, month: string) => void;
}

function DifferenceLine({ supplier, meters, difference }: { supplier: string; meters: number; difference: number | null; }) {
  const tone =
    difference === null ? 'text-ink-soft' : Math.abs(difference) < 0.005 ? 'text-success-700' : 'text-warn-700';
  return (
    <p className="mt-2 border-t border-line pt-2 text-[12px] text-ink-muted">
      Supplier {supplier === '' ? '—' : formatUnits(supplier)} · rooms {formatUnits(meters)} ·{' '}
      <span className={`font-medium ${tone}`}>{formatDifference(difference, supplier)}</span>
    </p>
  );
}

interface RoomReadingDraft {
  currReading: string;
  customRateEnabled: boolean;
  customRate: string;
}

const emptyDraft: RoomReadingDraft = {
  currReading: '',
  customRateEnabled: false,
  customRate: ''
};

function asReadingString(value: number | string | null | undefined): string {
  if (value === null || value === undefined || value === '') return '';
  return String(toNumber(value));
}

function seedFromSummary(summary: NormalizedMonthlyServiceSummary | null): Record<string, RoomReadingDraft> {
  const next: Record<string, RoomReadingDraft> = {};
  const bill = summary?.building_bill;
  for (const row of summary?.rows ?? []) {
    const hasCustom = Boolean(bill && row.unit_price !== null && toNumber(row.unit_price) !== toNumber(bill.unit_price));
    next[String(row.room_id)] = {
      currReading: asReadingString(row.meter_reading),
      customRateEnabled: hasCustom,
      customRate: hasCustom ? asReadingString(row.unit_price) : ''
    };
  }
  return next;
}

export function BuildingBillModal({
  kind,
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
  const config = SERVICE_CONFIG[kind];
  const [billingDate, setBillingDate] = useState('');
  const [activeSummary, setActiveSummary] = useState<NormalizedMonthlyServiceSummary | null>(existing);
  const [totalBill, setTotalBill] = useState('');
  const [supplierUnits, setSupplierUnits] = useState('');
  const [reason, setReason] = useState('');
  const [readings, setReadings] = useState<Record<string, RoomReadingDraft>>({});
  const [prevMap, setPrevMap] = useState<Record<string, number>>({});
  const [prevReadingsLoading, setPrevReadingsLoading] = useState(false);
  const [touched, setTouched] = useState(false);

  const month = /^\d{4}-\d{2}-\d{2}$/.test(billingDate) ? billingDate.slice(0, 7) : '';

  const applySummaryHeader = (summary: NormalizedMonthlyServiceSummary | null) => {
    const bill = summary?.building_bill;
    setActiveSummary(summary);
    setTotalBill(bill ? String(toNumber(bill.total_bill)) : '');
    setSupplierUnits(
      bill?.supplier_units !== undefined && bill?.supplier_units !== null
        ? String(toNumber(bill.supplier_units))
        : ''
    );
    setReason('');
  };

  useEffect(() => {
    if (!open) return;
    setTouched(false);
    const currentDay = today();
    const initialDate =
      existing?.building_bill?.billing_date ||
      (currentDay.startsWith(defaultMonth) ? currentDay : `${defaultMonth}-01`);
    setBillingDate(initialDate);
    applySummaryHeader(existing);
    setReadings(seedFromSummary(existing));
    const seededPrev: Record<string, number> = {};
    for (const row of existing?.rows ?? []) {
      seededPrev[String(row.room_id)] = toNumber(row.previous_meter_reading);
    }
    setPrevMap(seededPrev);
  }, [open, defaultMonth, existing]);

  useEffect(() => {
    if (!open || !month || !/^\d{4}-\d{2}$/.test(month)) return;
    const controller = new AbortController();
    setPrevReadingsLoading(true);

    const summaryPromise =
      month === defaultMonth
        ? Promise.resolve(existing)
        : apiRequest<unknown>(`${config.monthlySummaryPath}${buildQuery({ billing_month: month })}`, {
            signal: controller.signal
          })
            .then((raw) => extractMonthlySummary(kind, raw))
            .catch(() => null);

    const prevPromise = apiRequest<unknown>(`${config.previousReadingsPath}${buildQuery({ billing_month: month })}`, {
      signal: controller.signal
    })
      .then((raw) => extractPreviousReadings(kind, raw))
      .catch(() => []);

    Promise.all([summaryPromise, prevPromise])
      .then(([monthSummary, prevList]) => {
        if (controller.signal.aborted) return;

        if (month !== defaultMonth) {
          applySummaryHeader(monthSummary);
          setReadings(seedFromSummary(monthSummary));
        }

        const nextPrev: Record<string, number> = {};
        for (const row of monthSummary?.rows ?? []) {
          nextPrev[String(row.room_id)] = toNumber(row.previous_meter_reading);
        }
        for (const item of prevList) {
          const key = String(item.room_id);
          if (!(key in nextPrev)) {
            nextPrev[key] = toNumber(item.previous_meter_reading);
          }
        }
        setPrevMap(nextPrev);
      })
      .finally(() => {
        if (!controller.signal.aborted) setPrevReadingsLoading(false);
      });

    return () => controller.abort();
  }, [open, month, defaultMonth, existing, kind, config.monthlySummaryPath, config.previousReadingsPath]);

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
        prevReading: number;
        units: number;
        invalid: boolean;
      }
    >();
    let totalUnits = 0;

    for (const room of sortedRooms) {
      const draft = readings[String(room.id)] ?? emptyDraft;
      const prevReading = prevMap[String(room.id)] ?? 0;
      const included = draft.currReading !== '';
      const units = included ? toNumber(draft.currReading) - prevReading : 0;
      const invalid = included && units < 0;

      if (included && !invalid) {
        totalUnits += units;
      }

      map.set(room.id, { included, prevReading, units, invalid });
    }

    return { map, totalUnits };
  }, [sortedRooms, readings, prevMap]);

  const defaultRate =
    roomCalculations.totalUnits > 0 ? toNumber(totalBill) / roomCalculations.totalUnits : 0;

  const updateRoom = (roomId: ID, patch: Partial<RoomReadingDraft>) =>
    setReadings((prev) => ({
      ...prev,
      [String(roomId)]: { ...emptyDraft, ...prev[String(roomId)], ...patch }
    }));

  const billError = (value: string) =>
    value === '' ? 'Required.' : toNumber(value) < 0 ? 'Cannot be negative.' : undefined;
  const optionalReadingError = (value: string) =>
    value !== '' && toNumber(value) < 0 ? 'Cannot be negative.' : undefined;
  const usageError = toNumber(totalBill) > 0 && roomCalculations.totalUnits === 0;
  const hasReadingErrors = Array.from(roomCalculations.map.values()).some((calc) => calc.invalid);
  const includedCount = Array.from(roomCalculations.map.values()).filter((calc) => calc.included).length;

  const difference = usageDifference(supplierUnits, roomCalculations.totalUnits);

  const handleSubmit = () => {
    setTouched(true);
    if (
      !month ||
      billError(totalBill) ||
      optionalReadingError(supplierUnits) ||
      usageError ||
      hasReadingErrors ||
      includedCount === 0
    ) {
      return;
    }

    const roomReadings = sortedRooms
      .filter((room) => roomCalculations.map.get(room.id)?.included)
      .map((room) => {
        const draft = readings[String(room.id)] ?? emptyDraft;
        const entry: Record<string, unknown> = {
          room_number: room.room_number,
          [config.meterReadingKey]: toNumber(draft.currReading)
        };
        if (draft.customRateEnabled && draft.customRate !== '') {
          entry[config.unitPriceKey] = toNumber(draft.customRate);
        }
        return entry;
      });

    const payload: Record<string, unknown> = {
      billing_date: billingDate,
      [config.totalBillKey]: toNumber(totalBill),
      ...(supplierUnits !== '' ? { [config.supplierUnitsKey]: toNumber(supplierUnits) } : {}),
      ...(activeSummary?.building_bill && reason.trim() ? { reason: reason.trim() } : {}),
      room_readings: roomReadings
    };

    onSubmit(payload, month);
  };

  const noUsage = touched && includedCount === 0;
  const existingBillingDate = activeSummary?.building_bill?.billing_date;
  const dateError = touched && !month ? 'Select an exact billing date.' : undefined;

  return (
    <FormModal
      open={open}
      onClose={onClose}
      onSubmit={handleSubmit}
      title={
        activeSummary?.building_bill
          ? `Update building ${config.lowerLabel} bill`
          : `Enter building ${config.lowerLabel} bill`
      }
      submitLabel="Calculate & save"
      pending={pending}
      error={error}
      size="lg"
    >
      <div className="grid gap-4 sm:grid-cols-3">
        <Field
          label="Billing date"
          htmlFor="bb_date"
          required
          error={dateError}
          hint={
            existingBillingDate && existingBillingDate !== billingDate
              ? `Existing bill dated ${formatDate(existingBillingDate)}`
              : undefined
          }
        >
          <Input id="bb_date" type="date" value={billingDate} onChange={(event) => setBillingDate(event.target.value)} />
        </Field>
        <Field
          label={`Total ${config.lowerLabel} bill`}
          htmlFor="bb_total"
          required
          error={touched ? billError(totalBill) : undefined}
        >
          <Input
            id="bb_total"
            type="number"
            min="0"
            step="0.01"
            value={totalBill}
            onChange={(event) => setTotalBill(event.target.value)}
            placeholder={kind === 'electricity' ? '24000' : '12000'}
          />
        </Field>
        <Field
          label={`Supplier ${config.lowerLabel} units`}
          htmlFor="bb_supplier_units"
          error={touched ? optionalReadingError(supplierUnits) : undefined}
        >
          <Input
            id="bb_supplier_units"
            type="number"
            min="0"
            step="0.01"
            value={supplierUnits}
            onChange={(event) => setSupplierUnits(event.target.value)}
            placeholder={kind === 'electricity' ? '215' : '108'}
          />
        </Field>
      </div>

      {activeSummary?.building_bill && (
        <Field label="Recorrection reason" htmlFor="bb_reason" hint="Optional note recorded in the bill recorrection audit log.">
          <Input
            id="bb_reason"
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            placeholder={`Corrected ${config.lowerLabel} bill total or meter readings`}
          />
        </Field>
      )}

      <div className="rounded-lg border border-line bg-subtle px-3.5 py-3">
        <p className="text-[12px] text-ink-muted">Default {config.lowerLabel} rate</p>
        <p className="mt-0.5 text-lg font-semibold tracking-[-0.01em] text-ink">
          {formatCurrency(defaultRate)} <span className="text-[13px] font-normal text-ink-muted">/ unit</span>
        </p>
        <p className={`text-[12px] ${usageError && touched ? 'text-danger-600' : 'text-ink-soft'}`}>
          {formatCurrency(totalBill)} ÷ {formatUnits(roomCalculations.totalUnits)} units
        </p>
        <DifferenceLine supplier={supplierUnits} meters={roomCalculations.totalUnits} difference={difference} />
      </div>

      <div>
        <div className="flex items-baseline justify-between gap-3">
          <h3 className="text-[13px] font-medium text-ink">
            Room {config.lowerLabel} meter readings · {formatMonth(`${month}-01`)}
            {prevReadingsLoading && <span className="ml-2 text-[12px] font-normal text-ink-soft">Loading…</span>}
          </h3>
        </div>
        {noUsage && (
          <p role="alert" className="mt-2 text-[12px] text-danger-600">
            Enter a {config.lowerLabel} meter reading for at least one room.
          </p>
        )}
        <div className="mt-2 overflow-x-auto rounded-lg border border-line">
          <table className="w-full min-w-[540px] text-[13px]">
            <thead className="bg-subtle text-left text-[12px] text-ink-muted">
              <tr>
                <th scope="col" className="px-3 py-2 font-medium">
                  Room
                </th>
                <th scope="col" className="px-3 py-2 font-medium">
                  {config.label} meter reading
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
                  prevReading: 0,
                  units: 0,
                  invalid: false
                };
                const roomRate =
                  draft.customRateEnabled && draft.customRate !== ''
                    ? toNumber(draft.customRate)
                    : defaultRate;
                const estimate =
                  draft.currReading !== '' && !calc.invalid ? calc.units * roomRate : 0;

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
                        aria-label={`Room ${room.room_number} ${config.lowerLabel} meter reading`}
                        type="number"
                        min="0"
                        step="0.01"
                        placeholder={String(calc.prevReading)}
                        value={draft.currReading}
                        onChange={(event) => updateRoom(room.id, { currReading: event.target.value })}
                        className="w-32"
                      />
                      <p className="mt-1 text-[11px] text-ink-soft">
                        Prev: {formatUnits(calc.prevReading)}
                      </p>
                      {draft.currReading !== '' && (
                        calc.invalid ? (
                          <p className="mt-0.5 text-[11px] text-danger-600">
                            Below previous ({formatUnits(calc.prevReading)})
                          </p>
                        ) : (
                          <p className="mt-0.5 text-[11px] text-ink-muted">
                            {formatUnits(calc.units)} units · {formatPerDay(calc.units, month)}
                          </p>
                        )
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
                              customRate:
                                event.target.checked && draft.customRate === ''
                                  ? defaultRate.toFixed(2)
                                  : draft.customRate
                            })
                          }
                        />
                        <span>Custom</span>
                      </label>
                      {draft.customRateEnabled && (
                        <div className="mt-1.5">
                          <Input
                            aria-label={`Room ${room.room_number} custom ${config.lowerLabel} rate`}
                            type="number"
                            min="0"
                            step="0.01"
                            placeholder="Rate / unit"
                            value={draft.customRate}
                            onChange={(event) => updateRoom(room.id, { customRate: event.target.value })}
                            className="w-28"
                          />
                        </div>
                      )}
                    </td>
                    <td className="px-3 py-2.5 text-right align-top font-medium text-ink">
                      {!calc.included ? (
                        <span className="font-normal text-ink-soft">—</span>
                      ) : (
                        formatCurrency(estimate)
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </FormModal>
  );
}
