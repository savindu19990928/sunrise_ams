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
  previousReading?: number | string | null;
  currentReading?: number | string | null;
}

/** Usage, meter readings, average per day, then rate and cost underneath. */
export function UsageCell({
  units,
  month,
  rate,
  cost,
  buildingRate,
  previousReading,
  currentReading
}: UsageCellProps) {
  const isCustom =
  buildingRate !== undefined && buildingRate !== null && rate !== undefined && rate !== null && toNumber(rate) !== toNumber(buildingRate);
  const hasReadings =
  previousReading !== undefined &&
  previousReading !== null &&
  previousReading !== '' &&
  currentReading !== undefined &&
  currentReading !== null &&
  currentReading !== '';

  return (
    <div className="min-w-0">
      <p className="whitespace-nowrap text-ink">
        <span className="font-medium">{formatUnits(units)} units</span>
        <span className="ml-1.5 text-[12px] text-ink-muted">· {formatPerDay(units, month)}</span>
      </p>
      {hasReadings &&
      <p className="mt-0.5 whitespace-nowrap text-[11px] text-ink-soft">
          Meter {formatUnits(previousReading)} → {formatUnits(currentReading)}
        </p>
      }
      <p className="mt-0.5 whitespace-nowrap text-[12px] text-ink-soft">
        {rate !== undefined && rate !== null ? `${formatCurrency(rate)} / unit` : 'Monthly default rate'}
        {isCustom && <span className="ml-1 font-medium text-brand-700">custom</span>}
        {cost !== undefined && cost !== null && <span className="text-ink-muted"> → {formatCurrency(cost)}</span>}
      </p>
    </div>);

}
