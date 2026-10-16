import React from 'react';
import { ReceiptTextIcon } from 'lucide-react';
import type { BuildingUtilityBill } from '../../types';
import { formatCurrency, formatDate, formatMonth } from '../../utils/format';
import { formatDifference, formatUnits, usageDifference } from '../../utils/utilityUsage';
import { Button } from '../ui/Button';

interface BuildingBillSummaryProps {
  month: string;
  bill: BuildingUtilityBill | null;
  roomsRecorded: number;
  totalRoomsCost: number;
  loading: boolean;
  onEnter: () => void;
}

function UtilityRate({
  label,
  rate,
  bill,
  units,
  supplierUnits






}: {label: string;rate: number | string;bill: number | string;units: number | string;supplierUnits?: number | string | null;}) {
  // Calculated here from the recorded supplier usage and the sum of room meters.
  const difference = usageDifference(supplierUnits, units);
  const tone = difference === null ? 'text-ink-soft' : Math.abs(difference) < 0.005 ? 'text-success-700' : 'text-warn-700';
  return (
    <div className="min-w-0">
      <p className="text-[13px] text-ink-muted">{label} price per unit</p>
      <p className="mt-1 text-[26px] font-semibold leading-tight tracking-[-0.02em] text-ink">{formatCurrency(rate)}</p>
      <p className="mt-1 text-[12px] text-ink-soft">
        {formatCurrency(bill)} supplier bill ÷ {formatUnits(units)} metered units
      </p>
      <dl className="mt-3 grid grid-cols-3 gap-2 border-t border-line pt-2.5 text-[12px]">
        <div className="min-w-0">
          <dt className="text-ink-soft">Supplier</dt>
          <dd className="truncate font-medium text-ink">
            {supplierUnits === null || supplierUnits === undefined ? '—' : `${formatUnits(supplierUnits)} u`}
          </dd>
        </div>
        <div className="min-w-0">
          <dt className="text-ink-soft">Room meters</dt>
          <dd className="truncate font-medium text-ink">{formatUnits(units)} u</dd>
        </div>
        <div className="min-w-0">
          <dt className="text-ink-soft">Difference</dt>
          <dd className={`truncate font-medium ${tone}`}>
            {difference === null ? 'Not entered' : formatDifference(difference, supplierUnits)}
          </dd>
        </div>
      </dl>
    </div>);

}

/** The month's building bill and the per-unit prices it produced. */
export function BuildingBillSummary({ month, bill, roomsRecorded, totalRoomsCost, loading, onEnter }: BuildingBillSummaryProps) {
  if (loading) {
    return <div className="h-[170px] animate-pulse rounded-xl border border-line bg-surface shadow-card" aria-hidden="true" />;
  }

  if (!bill) {
    return (
      <div className="flex flex-col gap-3 rounded-xl border border-dashed border-line bg-surface px-5 py-5 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <p className="text-sm font-medium text-ink">No building bill entered for {formatMonth(month)}</p>
          <p className="mt-0.5 text-[13px] text-ink-muted">
            Enter the supplier totals and each room&apos;s usage to calculate this month&apos;s per-unit prices.
          </p>
        </div>
        <Button icon={ReceiptTextIcon} onClick={onEnter} className="flex-none">
          Enter building bill
        </Button>
      </div>);

  }

  return (
    <section
      aria-label={`Building utility bill for ${formatMonth(month)}`}
      className="grid gap-5 rounded-xl border border-line bg-surface px-5 py-4 shadow-card sm:grid-cols-2 lg:grid-cols-[1fr_1fr_auto] lg:items-end">
      
      <UtilityRate
        label="Electricity"
        rate={bill.electricity_unit_price}
        bill={bill.total_electricity_bill}
        units={bill.total_electricity_units}
        supplierUnits={bill.supplier_electricity_units} />
      
      <UtilityRate
        label="Water"
        rate={bill.water_unit_price}
        bill={bill.total_water_bill}
        units={bill.total_water_units}
        supplierUnits={bill.supplier_water_units} />
      
      <dl className="grid grid-cols-2 gap-x-6 gap-y-1 border-t border-line pt-3 text-[13px] sm:col-span-2 lg:col-span-1 lg:border-l lg:border-t-0 lg:pl-6 lg:pt-0">
        <dt className="text-ink-muted">Rooms billed</dt>
        <dd className="text-right font-medium text-ink">{roomsRecorded}</dd>
        <dt className="text-ink-muted">Room bills total</dt>
        <dd className="whitespace-nowrap text-right font-medium text-ink">{formatCurrency(totalRoomsCost)}</dd>
        <dt className="text-ink-muted">Supplier due</dt>
        <dd className="whitespace-nowrap text-right font-medium text-ink">{formatDate(bill.due_date)}</dd>
      </dl>
    </section>);

}