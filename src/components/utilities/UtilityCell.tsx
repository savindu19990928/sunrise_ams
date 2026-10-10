import React from 'react';
import { formatCurrency } from '../../utils/format';

interface UtilityCellProps {
  cost: number;
  units?: number;
  rate?: number;
}

/** Cost with the units × room rate that produced it underneath. */
export function UtilityCell({ cost, units, rate }: UtilityCellProps) {
  return (
    <div className="whitespace-nowrap">
      <p className="text-ink">{formatCurrency(cost)}</p>
      {units !== undefined &&
      <p className="text-[12px] text-ink-soft">
          {units} units{rate ? ` × ${formatCurrency(rate)}` : ''}
        </p>
      }
    </div>);

}