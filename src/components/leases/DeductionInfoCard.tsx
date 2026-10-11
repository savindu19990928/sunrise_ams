import React from 'react';
import { twMerge } from 'tailwind-merge';
import { formatCurrency } from '../../utils/format';

interface DeductionInfoCardProps {
  /** Amount the next bill deducts from the deposit (0 = stopped). */
  deduction: number;
  /** Customer's minimum deposit threshold. */
  threshold: number;
}

/** Compact card summarising a lease's monthly deposit deduction and its stop threshold. */
export function DeductionInfoCard({ deduction, threshold }: DeductionInfoCardProps) {
  const stopped = deduction <= 0;
  return (
    <div
      className={twMerge(
        'ml-auto inline-grid min-w-[176px] grid-cols-[auto_1fr] gap-x-3 gap-y-1 rounded-lg border px-3 py-2 text-left text-[12px]',
        stopped ? 'border-warn-100 bg-warn-50' : 'border-line bg-subtle'
      )}>
      
      <span className={stopped ? 'text-warn-700' : 'text-ink-muted'}>Next</span>
      <span className={twMerge('whitespace-nowrap text-right font-semibold', stopped ? 'text-warn-700' : 'text-ink')}>
        {stopped ? 'Stopped · full rent' : formatCurrency(deduction)}
      </span>
      <span className={stopped ? 'text-warn-700' : 'text-ink-muted'}>Threshold</span>
      <span className={twMerge('whitespace-nowrap text-right font-medium', stopped ? 'text-warn-700' : 'text-ink')}>
        {formatCurrency(threshold)}
      </span>
    </div>);

}