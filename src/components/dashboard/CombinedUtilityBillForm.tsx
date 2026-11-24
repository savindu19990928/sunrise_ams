import { type FormEvent, useEffect, useMemo, useState } from 'react';
import { ChevronDownIcon, ChevronUpIcon, SparklesIcon } from 'lucide-react';
import { toast } from 'sonner';
import type { ID, Lease, NormalizedMonthlyServiceSummary, Room } from '../../types';
import { ApiError, apiRequest, buildQuery } from '../../utils/api';
import { formatCurrency, formatDate, formatMonth, toNumber, today } from '../../utils/format';
import { notifyRemindersChanged } from '../../utils/reminders';
import { extractMonthlySummary, extractPreviousReadings, SERVICE_CONFIG } from '../../utils/serviceRecords';
import { formatDifference, formatPerDay, formatUnits, usageDifference } from '../../utils/utilityUsage';
import { Button } from '../ui/Button';
import { Card, CardHeader } from '../ui/Card';
import { Field, Input } from '../ui/Field';

interface CombinedUtilityBillFormProps {
  rooms: Room[];
  leases: Lease[];
  onGenerated: () => void;
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

export function CombinedUtilityBillForm({ rooms, leases, onGenerated }: CombinedUtilityBillFormProps) {
  const [expanded, setExpanded] = useState(true);
  const [electricityBillingDate, setElectricityBillingDate] = useState(today());
  const [waterBillingDate, setWaterBillingDate] = useState(today());
  const [electricityBill, setElectricityBill] = useState('');
  const [supplierElectricityUnits, setSupplierElectricityUnits] = useState('');
  const [waterBill, setWaterBill] = useState('');
  const [supplierWaterUnits, setSupplierWaterUnits] = useState('');
  const [reason, setReason] = useState('');
  const [generateRentBills, setGenerateRentBills] = useState(false);

  const [readings, setReadings] = useState<Record<string, RoomReadingDraft>>({});
  const [prevMap, setPrevMap] = useState<Record<string, { elec: number; water: number; }>>({});
  const [existingElec, setExistingElec] = useState<NormalizedMonthlyServiceSummary | null>(null);
  const [existingWater, setExistingWater] = useState<NormalizedMonthlyServiceSummary | null>(null);
  const [loadingElec, setLoadingElec] = useState(false);
  const [loadingWater, setLoadingWater] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [touched, setTouched] = useState(false);
  const [reloadTick, setReloadTick] = useState(0);

  const elecMonth = /^\d{4}-\d{2}-\d{2}$/.test(electricityBillingDate) ? electricityBillingDate.slice(0, 7) : '';
  const waterMonth = /^\d{4}-\d{2}-\d{2}$/.test(waterBillingDate) ? waterBillingDate.slice(0, 7) : '';
  const loadingMonth = loadingElec || loadingWater;

  useEffect(() => {
    if (!elecMonth || !/^\d{4}-\d{2}$/.test(elecMonth)) return;
    const controller = new AbortController();
    setLoadingElec(true);
    setError(null);
    setTouched(false);

    const elecConfig = SERVICE_CONFIG.electricity;

    const elecSummaryPromise = apiRequest<unknown>(
      `${elecConfig.monthlySummaryPath}${buildQuery({ billing_month: elecMonth })}`,
      { signal: controller.signal }
    )
      .then((raw) => extractMonthlySummary('electricity', raw))
      .catch(() => null);

    const elecPrevPromise = apiRequest<unknown>(
      `${elecConfig.previousReadingsPath}${buildQuery({ billing_month: elecMonth })}`,
      { signal: controller.signal }
    )
      .then((raw) => extractPreviousReadings('electricity', raw))
      .catch(() => []);

    Promise.all([elecSummaryPromise, elecPrevPromise])
      .then(([elecSummary, elecPrevList]) => {
        if (controller.signal.aborted) return;

        setExistingElec(elecSummary);
        const elecBill = elecSummary?.building_bill ?? null;
        setElectricityBill(elecBill ? String(toNumber(elecBill.total_bill)) : '');
        setSupplierElectricityUnits(
          elecBill?.supplier_units !== undefined && elecBill?.supplier_units !== null
            ? String(toNumber(elecBill.supplier_units))
            : ''
        );
        setReason('');

        const byRoom = new Map((elecSummary?.rows ?? []).map((r) => [String(r.room_id), r]));
        setReadings((prev) => {
          const next: Record<string, RoomReadingDraft> = {};
          const keys = new Set([...Object.keys(prev), ...Array.from(byRoom.keys())]);
          for (const key of keys) {
            const existingDraft = prev[key] ?? emptyDraft;
            const row = byRoom.get(key);
            const hasCustom = Boolean(
              row && elecBill && row.unit_price !== null && toNumber(row.unit_price) !== toNumber(elecBill.unit_price)
            );
            const hasWaterCustom = existingDraft.customWaterRate !== '';
            next[key] = {
              ...existingDraft,
              currElectricity: row ? asReadingString(row.meter_reading) : '',
              customElectricityRate: hasCustom && row ? asReadingString(row.unit_price) : '',
              customRateEnabled: hasCustom || hasWaterCustom
            };
          }
          return next;
        });

        setPrevMap((prev) => {
          const next = { ...prev };
          const seen = new Set<string>();
          for (const row of elecSummary?.rows ?? []) {
            const key = String(row.room_id);
            seen.add(key);
            next[key] = { elec: toNumber(row.previous_meter_reading), water: next[key]?.water ?? 0 };
          }
          for (const item of elecPrevList) {
            const key = String(item.room_id);
            if (!seen.has(key)) {
              seen.add(key);
              next[key] = { elec: toNumber(item.previous_meter_reading), water: next[key]?.water ?? 0 };
            }
          }
          for (const key of Object.keys(next)) {
            if (!seen.has(key)) next[key] = { elec: 0, water: next[key]?.water ?? 0 };
          }
          return next;
        });
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoadingElec(false);
      });

    return () => controller.abort();
  }, [elecMonth, reloadTick]);

  useEffect(() => {
    if (!waterMonth || !/^\d{4}-\d{2}$/.test(waterMonth)) return;
    const controller = new AbortController();
    setLoadingWater(true);
    setError(null);
    setTouched(false);

    const waterConfig = SERVICE_CONFIG.water;

    const waterSummaryPromise = apiRequest<unknown>(
      `${waterConfig.monthlySummaryPath}${buildQuery({ billing_month: waterMonth })}`,
      { signal: controller.signal }
    )
      .then((raw) => extractMonthlySummary('water', raw))
      .catch(() => null);

    const waterPrevPromise = apiRequest<unknown>(
      `${waterConfig.previousReadingsPath}${buildQuery({ billing_month: waterMonth })}`,
      { signal: controller.signal }
    )
      .then((raw) => extractPreviousReadings('water', raw))
      .catch(() => []);

    Promise.all([waterSummaryPromise, waterPrevPromise])
      .then(([waterSummary, waterPrevList]) => {
        if (controller.signal.aborted) return;

        setExistingWater(waterSummary);
        const wBill = waterSummary?.building_bill ?? null;
        setWaterBill(wBill ? String(toNumber(wBill.total_bill)) : '');
        setSupplierWaterUnits(
          wBill?.supplier_units !== undefined && wBill?.supplier_units !== null
            ? String(toNumber(wBill.supplier_units))
            : ''
        );
        setReason('');

        const byRoom = new Map((waterSummary?.rows ?? []).map((r) => [String(r.room_id), r]));
        setReadings((prev) => {
          const next: Record<string, RoomReadingDraft> = {};
          const keys = new Set([...Object.keys(prev), ...Array.from(byRoom.keys())]);
          for (const key of keys) {
            const existingDraft = prev[key] ?? emptyDraft;
            const row = byRoom.get(key);
            const hasCustom = Boolean(
              row && wBill && row.unit_price !== null && toNumber(row.unit_price) !== toNumber(wBill.unit_price)
            );
            const hasElecCustom = existingDraft.customElectricityRate !== '';
            next[key] = {
              ...existingDraft,
              currWater: row ? asReadingString(row.meter_reading) : '',
              customWaterRate: hasCustom && row ? asReadingString(row.unit_price) : '',
              customRateEnabled: hasCustom || hasElecCustom
            };
          }
          return next;
        });

        setPrevMap((prev) => {
          const next = { ...prev };
          const seen = new Set<string>();
          for (const row of waterSummary?.rows ?? []) {
            const key = String(row.room_id);
            seen.add(key);
            next[key] = { elec: next[key]?.elec ?? 0, water: toNumber(row.previous_meter_reading) };
          }
          for (const item of waterPrevList) {
            const key = String(item.room_id);
            if (!seen.has(key)) {
              seen.add(key);
              next[key] = { elec: next[key]?.elec ?? 0, water: toNumber(item.previous_meter_reading) };
            }
          }
          for (const key of Object.keys(next)) {
            if (!seen.has(key)) next[key] = { elec: next[key]?.elec ?? 0, water: 0 };
          }
          return next;
        });
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoadingWater(false);
      });

    return () => controller.abort();
  }, [waterMonth, reloadTick]);

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
        hasElec: boolean;
        hasWater: boolean;
        prevElec: number;
        prevWater: number;
        elecUnits: number;
        waterUnits: number;
        elecInvalid: boolean;
        waterInvalid: boolean;
      }
    >();
    let totalElecUnits = 0;
    let totalWaterUnits = 0;
    let elecCount = 0;
    let waterCount = 0;

    for (const room of sortedRooms) {
      const draft = readings[String(room.id)] ?? emptyDraft;
      const prev = prevMap[String(room.id)] ?? { elec: 0, water: 0 };
      const hasElec = draft.currElectricity !== '';
      const hasWater = draft.currWater !== '';
      const elecUnits = hasElec ? toNumber(draft.currElectricity) - prev.elec : 0;
      const waterUnits = hasWater ? toNumber(draft.currWater) - prev.water : 0;
      const elecInvalid = hasElec && elecUnits < 0;
      const waterInvalid = hasWater && waterUnits < 0;

      if (hasElec) {
        elecCount += 1;
        if (!elecInvalid) totalElecUnits += elecUnits;
      }
      if (hasWater) {
        waterCount += 1;
        if (!waterInvalid) totalWaterUnits += waterUnits;
      }

      map.set(room.id, {
        hasElec,
        hasWater,
        prevElec: prev.elec,
        prevWater: prev.water,
        elecUnits,
        waterUnits,
        elecInvalid,
        waterInvalid
      });
    }

    return { map, totalElecUnits, totalWaterUnits, elecCount, waterCount };
  }, [sortedRooms, readings, prevMap]);

  const defaultElectricityRate =
    roomCalculations.totalElecUnits > 0 ? toNumber(electricityBill) / roomCalculations.totalElecUnits : 0;
  const defaultWaterRate =
    roomCalculations.totalWaterUnits > 0 ? toNumber(waterBill) / roomCalculations.totalWaterUnits : 0;

  const updateRoom = (roomId: ID, patch: Partial<RoomReadingDraft>) =>
    setReadings((prev) => ({
      ...prev,
      [String(roomId)]: { ...emptyDraft, ...prev[String(roomId)], ...patch }
    }));

  const billError = (value: string) =>
    value === '' ? 'Required.' : toNumber(value) < 0 ? 'Cannot be negative.' : undefined;
  const optionalReadingError = (value: string) =>
    value !== '' && toNumber(value) < 0 ? 'Cannot be negative.' : undefined;

  const electricityUsageError = toNumber(electricityBill) > 0 && roomCalculations.totalElecUnits === 0;
  const waterUsageError = toNumber(waterBill) > 0 && roomCalculations.totalWaterUnits === 0;
  const hasReadingErrors = Array.from(roomCalculations.map.values()).some(
    (calc) => calc.elecInvalid || calc.waterInvalid
  );

  const elecDifference = usageDifference(supplierElectricityUnits, roomCalculations.totalElecUnits);
  const waterDifference = usageDifference(supplierWaterUnits, roomCalculations.totalWaterUnits);
  const hasExisting = Boolean(existingElec?.building_bill || existingWater?.building_bill);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setTouched(true);
    setError(null);

    if (
      !elecMonth ||
      !waterMonth ||
      billError(electricityBill) ||
      billError(waterBill) ||
      optionalReadingError(supplierElectricityUnits) ||
      optionalReadingError(supplierWaterUnits) ||
      electricityUsageError ||
      waterUsageError ||
      hasReadingErrors ||
      roomCalculations.elecCount === 0 ||
      roomCalculations.waterCount === 0
    ) {
      return;
    }

    const elecBillingMonth = `${elecMonth}-01`;
    const waterBillingMonth = `${waterMonth}-01`;
    const rentBillingMonth = `${(elecMonth || waterMonth)}-01`;

    const elecReadings = sortedRooms
      .filter((room) => roomCalculations.map.get(room.id)?.hasElec)
      .map((room) => {
        const draft = readings[String(room.id)] ?? emptyDraft;
        const entry: Record<string, unknown> = {
          room_number: room.room_number,
          electricity_meter_reading: toNumber(draft.currElectricity)
        };
        if (draft.customRateEnabled && draft.customElectricityRate !== '') {
          entry.electricity_unit_price = toNumber(draft.customElectricityRate);
        }
        return entry;
      });

    const waterReadings = sortedRooms
      .filter((room) => roomCalculations.map.get(room.id)?.hasWater)
      .map((room) => {
        const draft = readings[String(room.id)] ?? emptyDraft;
        const entry: Record<string, unknown> = {
          room_number: room.room_number,
          water_meter_reading: toNumber(draft.currWater)
        };
        if (draft.customRateEnabled && draft.customWaterRate !== '') {
          entry.water_unit_price = toNumber(draft.customWaterRate);
        }
        return entry;
      });

    const trimmedReason = reason.trim();

    const elecPayload: Record<string, unknown> = {
      billing_date: electricityBillingDate,
      total_electricity_bill: toNumber(electricityBill),
      ...(supplierElectricityUnits !== '' ? { supplier_electricity_units: toNumber(supplierElectricityUnits) } : {}),
      ...(existingElec?.building_bill && trimmedReason ? { reason: trimmedReason } : {}),
      room_readings: elecReadings
    };

    const waterPayload: Record<string, unknown> = {
      billing_date: waterBillingDate,
      total_water_bill: toNumber(waterBill),
      ...(supplierWaterUnits !== '' ? { supplier_water_units: toNumber(supplierWaterUnits) } : {}),
      ...(existingWater?.building_bill && trimmedReason ? { reason: trimmedReason } : {}),
      room_readings: waterReadings
    };

    setPending(true);
    try {
      await apiRequest(SERVICE_CONFIG.electricity.buildingBillPostPath, {
        method: 'POST',
        body: elecPayload
      });

      try {
        await apiRequest(SERVICE_CONFIG.water.buildingBillPostPath, {
          method: 'POST',
          body: waterPayload
        });
      } catch (waterErr) {
        const msg = waterErr instanceof ApiError ? waterErr.message : (waterErr as Error).message;
        const partialMessage = `Electricity bills saved, but water bills failed: ${msg}`;
        setError(partialMessage);
        toast.error(partialMessage);
        setReloadTick((tick) => tick + 1);
        notifyRemindersChanged();
        onGenerated();
        return;
      }

      if (generateRentBills) {
        try {
          await apiRequest('/api/bills/generate_monthly/', {
            method: 'POST',
            body: { billing_month: rentBillingMonth }
          });
        } catch (rentErr) {
          const msg = rentErr instanceof ApiError ? rentErr.message : (rentErr as Error).message;
          const rentMessage = `Electricity & water bills saved, but monthly rent bill generation failed: ${msg}`;
          setError(rentMessage);
          toast.error(rentMessage);
          setReloadTick((tick) => tick + 1);
          notifyRemindersChanged();
          onGenerated();
          return;
        }
      }

      const periodSummary =
        elecBillingMonth === waterBillingMonth
          ? formatMonth(elecBillingMonth)
          : `${formatMonth(elecBillingMonth)} (elec) & ${formatMonth(waterBillingMonth)} (water)`;

      toast.success(
        generateRentBills
          ? `Electricity, water, and rent bills generated for ${periodSummary}.`
          : `Electricity and water bills generated for ${periodSummary}.`
      );
      setReloadTick((tick) => tick + 1);
      notifyRemindersChanged();
      onGenerated();
    } catch (elecErr) {
      const msg = elecErr instanceof ApiError ? elecErr.message : (elecErr as Error).message;
      setError(msg);
      toast.error(msg);
    } finally {
      setPending(false);
    }
  };

  const existingElecDate = existingElec?.building_bill?.billing_date;
  const existingWaterDate = existingWater?.building_bill?.billing_date;
  const readingsHeading =
    elecMonth && waterMonth && elecMonth !== waterMonth
      ? `Elec: ${formatMonth(`${elecMonth}-01`)} · Water: ${formatMonth(`${waterMonth}-01`)}`
      : formatMonth(`${(elecMonth || waterMonth)}-01`);

  return (
    <Card>
      <CardHeader
        title="Generate electricity & water bills"
        description="Enter exact billing dates, supplier totals, and room meter readings to generate both electricity (LECO) and water (NWSDB) bills at once."
        actions={
          <Button
            type="button"
            variant="ghost"
            size="sm"
            icon={expanded ? ChevronUpIcon : ChevronDownIcon}
            onClick={() => setExpanded((prev) => !prev)}
          >
            {expanded ? 'Hide form' : 'Show form'}
          </Button>
        }
      />

      {expanded && (
        <form onSubmit={handleSubmit} className="space-y-4 px-4 py-4 sm:px-5" noValidate>
          {error && (
            <div role="alert" className="rounded-lg border border-danger-100 bg-danger-50 px-3 py-2.5 text-[13px] text-danger-700">
              {error}
            </div>
          )}

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <Field
              label="Electricity billing date"
              htmlFor="dash_elec_date"
              required
              error={touched && !elecMonth ? 'Select electricity billing date.' : undefined}
              hint={
                existingElecDate && existingElecDate !== electricityBillingDate
                  ? `Existing bill dated ${formatDate(existingElecDate)}`
                  : undefined
              }
            >
              <Input
                id="dash_elec_date"
                type="date"
                value={electricityBillingDate}
                onChange={(event) => setElectricityBillingDate(event.target.value)}
              />
            </Field>
            <Field
              label="Total electricity bill"
              htmlFor="dash_elec_bill"
              required
              error={touched ? billError(electricityBill) : undefined}
            >
              <Input
                id="dash_elec_bill"
                type="number"
                min="0"
                step="0.01"
                value={electricityBill}
                onChange={(event) => setElectricityBill(event.target.value)}
                placeholder="24000"
              />
            </Field>
            <Field
              label="Supplier elec. units"
              htmlFor="dash_elec_units"
              error={touched ? optionalReadingError(supplierElectricityUnits) : undefined}
            >
              <Input
                id="dash_elec_units"
                type="number"
                min="0"
                step="0.01"
                value={supplierElectricityUnits}
                onChange={(event) => setSupplierElectricityUnits(event.target.value)}
                placeholder="215"
              />
            </Field>
            <Field
              label="Water billing date"
              htmlFor="dash_water_date"
              required
              error={touched && !waterMonth ? 'Select water billing date.' : undefined}
              hint={
                existingWaterDate && existingWaterDate !== waterBillingDate
                  ? `Existing bill dated ${formatDate(existingWaterDate)}`
                  : undefined
              }
            >
              <Input
                id="dash_water_date"
                type="date"
                value={waterBillingDate}
                onChange={(event) => setWaterBillingDate(event.target.value)}
              />
            </Field>
            <Field
              label="Total water bill"
              htmlFor="dash_water_bill"
              required
              error={touched ? billError(waterBill) : undefined}
            >
              <Input
                id="dash_water_bill"
                type="number"
                min="0"
                step="0.01"
                value={waterBill}
                onChange={(event) => setWaterBill(event.target.value)}
                placeholder="12000"
              />
            </Field>
            <Field
              label="Supplier water units"
              htmlFor="dash_water_units"
              error={touched ? optionalReadingError(supplierWaterUnits) : undefined}
            >
              <Input
                id="dash_water_units"
                type="number"
                min="0"
                step="0.01"
                value={supplierWaterUnits}
                onChange={(event) => setSupplierWaterUnits(event.target.value)}
                placeholder="108"
              />
            </Field>
          </div>

          {hasExisting && (
            <Field
              label="Recorrection reason"
              htmlFor="dash_bill_reason"
              hint="Existing bills found for this month. Optional note recorded in the audit log."
            >
              <Input
                id="dash_bill_reason"
                value={reason}
                onChange={(event) => setReason(event.target.value)}
                placeholder="Updated monthly supplier bill or meter readings"
              />
            </Field>
          )}

          <div className="grid gap-px overflow-hidden rounded-lg border border-line bg-line sm:grid-cols-2">
            <div className="bg-subtle px-3.5 py-3">
              <p className="text-[12px] text-ink-muted">Default electricity rate</p>
              <p className="mt-0.5 text-lg font-semibold tracking-[-0.01em] text-ink">
                {formatCurrency(defaultElectricityRate)} <span className="text-[13px] font-normal text-ink-muted">/ unit</span>
              </p>
              <p className={`text-[12px] ${electricityUsageError && touched ? 'text-danger-600' : 'text-ink-soft'}`}>
                {formatCurrency(electricityBill)} ÷ {formatUnits(roomCalculations.totalElecUnits)} units
              </p>
              <DifferenceLine
                supplier={supplierElectricityUnits}
                meters={roomCalculations.totalElecUnits}
                difference={elecDifference}
              />
            </div>
            <div className="bg-subtle px-3.5 py-3">
              <p className="text-[12px] text-ink-muted">Default water rate</p>
              <p className="mt-0.5 text-lg font-semibold tracking-[-0.01em] text-ink">
                {formatCurrency(defaultWaterRate)} <span className="text-[13px] font-normal text-ink-muted">/ unit</span>
              </p>
              <p className={`text-[12px] ${waterUsageError && touched ? 'text-danger-600' : 'text-ink-soft'}`}>
                {formatCurrency(waterBill)} ÷ {formatUnits(roomCalculations.totalWaterUnits)} units
              </p>
              <DifferenceLine
                supplier={supplierWaterUnits}
                meters={roomCalculations.totalWaterUnits}
                difference={waterDifference}
              />
            </div>
          </div>

          <div>
            <div className="flex items-baseline justify-between gap-3">
              <h3 className="text-[13px] font-medium text-ink">
                Room meter readings · {readingsHeading}
                {loadingMonth && <span className="ml-2 text-[12px] font-normal text-ink-soft">Loading…</span>}
              </h3>
            </div>
            {touched && (roomCalculations.elecCount === 0 || roomCalculations.waterCount === 0) && (
              <p role="alert" className="mt-2 text-[12px] text-danger-600">
                Enter at least one room&apos;s electricity reading and at least one room&apos;s water reading.
              </p>
            )}
            <div className="mt-2 max-h-[360px] overflow-auto rounded-lg border border-line">
              <table className="w-full min-w-[680px] text-[13px]">
                <thead className="sticky top-0 bg-subtle text-left text-[12px] text-ink-muted">
                  <tr>
                    <th scope="col" className="px-3 py-2 font-medium">
                      Room
                    </th>
                    <th scope="col" className="px-3 py-2 font-medium">
                      Electricity meter
                    </th>
                    <th scope="col" className="px-3 py-2 font-medium">
                      Water meter
                    </th>
                    <th scope="col" className="px-3 py-2 font-medium">
                      Custom rates
                    </th>
                    <th scope="col" className="px-3 py-2 text-right font-medium">
                      Estimated bills
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {sortedRooms.map((room) => {
                    const draft = readings[String(room.id)] ?? emptyDraft;
                    const calc = roomCalculations.map.get(room.id) ?? {
                      hasElec: false,
                      hasWater: false,
                      prevElec: 0,
                      prevWater: 0,
                      elecUnits: 0,
                      waterUnits: 0,
                      elecInvalid: false,
                      waterInvalid: false
                    };
                    const roomElecRate =
                      draft.customRateEnabled && draft.customElectricityRate !== ''
                        ? toNumber(draft.customElectricityRate)
                        : defaultElectricityRate;
                    const roomWaterRate =
                      draft.customRateEnabled && draft.customWaterRate !== ''
                        ? toNumber(draft.customWaterRate)
                        : defaultWaterRate;
                    const elecEstimate = calc.hasElec && !calc.elecInvalid ? calc.elecUnits * roomElecRate : null;
                    const waterEstimate = calc.hasWater && !calc.waterInvalid ? calc.waterUnits * roomWaterRate : null;

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
                            className="w-28"
                          />
                          <p className="mt-1 text-[11px] text-ink-soft">Prev: {formatUnits(calc.prevElec)}</p>
                          {calc.hasElec && (
                            calc.elecInvalid ? (
                              <p className="mt-0.5 text-[11px] text-danger-600">
                                Below previous ({formatUnits(calc.prevElec)})
                              </p>
                            ) : (
                              <p className="mt-0.5 text-[11px] text-ink-muted">
                                {formatUnits(calc.elecUnits)} units · {formatPerDay(calc.elecUnits, elecMonth)}
                              </p>
                            )
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
                            className="w-28"
                          />
                          <p className="mt-1 text-[11px] text-ink-soft">Prev: {formatUnits(calc.prevWater)}</p>
                          {calc.hasWater && (
                            calc.waterInvalid ? (
                              <p className="mt-0.5 text-[11px] text-danger-600">
                                Below previous ({formatUnits(calc.prevWater)})
                              </p>
                            ) : (
                              <p className="mt-0.5 text-[11px] text-ink-muted">
                                {formatUnits(calc.waterUnits)} units · {formatPerDay(calc.waterUnits, waterMonth)}
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
                                  customElectricityRate:
                                    event.target.checked && draft.customElectricityRate === ''
                                      ? defaultElectricityRate.toFixed(2)
                                      : draft.customElectricityRate,
                                  customWaterRate:
                                    event.target.checked && draft.customWaterRate === ''
                                      ? defaultWaterRate.toFixed(2)
                                      : draft.customWaterRate
                                })
                              }
                            />
                            <span>Custom</span>
                          </label>
                          {draft.customRateEnabled && (
                            <div className="mt-1.5 flex flex-col gap-1">
                              <Input
                                aria-label={`Room ${room.room_number} custom electricity rate`}
                                type="number"
                                min="0"
                                step="0.01"
                                placeholder="Elec rate"
                                value={draft.customElectricityRate}
                                onChange={(event) => updateRoom(room.id, { customElectricityRate: event.target.value })}
                                className="w-24"
                              />
                              <Input
                                aria-label={`Room ${room.room_number} custom water rate`}
                                type="number"
                                min="0"
                                step="0.01"
                                placeholder="Water rate"
                                value={draft.customWaterRate}
                                onChange={(event) => updateRoom(room.id, { customWaterRate: event.target.value })}
                                className="w-24"
                              />
                            </div>
                          )}
                        </td>
                        <td className="px-3 py-2.5 text-right align-top text-[12px]">
                          <p className="text-ink-muted">
                            Elec:{' '}
                            <span className="font-medium text-ink">
                              {elecEstimate === null ? '—' : formatCurrency(elecEstimate)}
                            </span>
                          </p>
                          <p className="mt-0.5 text-ink-muted">
                            Water:{' '}
                            <span className="font-medium text-ink">
                              {waterEstimate === null ? '—' : formatCurrency(waterEstimate)}
                            </span>
                          </p>
                        </td>
                      </tr>
                    );
                  })}
                  {sortedRooms.length === 0 && (
                    <tr>
                      <td colSpan={5} className="px-3 py-6 text-center text-[13px] text-ink-soft">
                        No rooms configured yet. Add rooms first to enter meter readings.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <div className="flex flex-col gap-3 border-t border-line pt-4 sm:flex-row sm:items-center sm:justify-between">
            <label className="inline-flex cursor-pointer items-center gap-2 text-[13px] text-ink">
              <input
                type="checkbox"
                className="h-4 w-4 accent-brand-600"
                checked={generateRentBills}
                onChange={(event) => setGenerateRentBills(event.target.checked)}
              />
              <span>
                Also generate {formatMonth(`${(elecMonth || waterMonth)}-01`)} room rent bills for active leases
              </span>
            </label>
            <Button type="submit" icon={SparklesIcon} loading={pending} disabled={sortedRooms.length === 0}>
              Generate electricity &amp; water bills
            </Button>
          </div>
        </form>
      )}
    </Card>
  );
}
