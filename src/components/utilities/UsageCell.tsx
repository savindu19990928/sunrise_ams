import React from 'react';
import { formatCurrency, toNumber } from '../../utils/format';
import { formatPerDay, formatUnits } from '../../utils/utilityUsage';

interface UsageCellProps {
  units: number | string | null | undefined;
  /** Billing month, used to derive the average per-day usage. */
  month: string | null | undefined;
  rate?: number | string | null;
  cost?: number | string | null;
  /** Shows a "custom" marker when the room's rate differs from the building rate. */
  buildingRate?: number | string | null;
}

/** Usage, average per day right beside it, then rate and cost underneath. */
export function UsageCell({ units, month, rate, cost, buildingRate }: UsageCellProps) {
  const isCustom =
  buildingRate !== undefined && buildingRate !== null && rate !== undefined && rate !== null && toNumber(rate) !== toNumber(buildingRate);

  return (
    <div className="min-w-0">
      <p className="whitespace-nowrap text-ink">
        <span className="font-medium">{formatUnits(units)} units</span>
        <span className="ml-1.5 text-[12px] text-ink-muted">· {formatPerDay(units, month)}</span>
      </p>
      <p className="mt-0.5 whitespace-nowrap text-[12px] text-ink-soft">
        {rate !== undefined && rate !== null ? `${formatCurrency(rate)} / unit` : 'Room default rate'}
        {isCustom && <span className="ml-1 font-medium text-brand-700">custom</span>}
        {cost !== undefined && cost !== null && <span className="text-ink-muted"> → {formatCurrency(cost)}</span>}
      </p>
    </div>);

}