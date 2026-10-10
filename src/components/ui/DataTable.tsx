import React from 'react';
import { twMerge } from 'tailwind-merge';
import { EmptyState, ErrorState, LoadingState } from './States';

export interface Column<T> {
  key: string;
  header: string;
  render: (row: T) => React.ReactNode;
  align?: 'left' | 'right';
  /** Used as the heading of the stacked card on small screens. */
  primary?: boolean;
  /** Hide this column in the desktop table (still shown in mobile cards). */
  mobileOnly?: boolean;
  className?: string;
}

interface DataTableProps<T> {
  columns: Column<T>[];
  rows: T[];
  keyOf: (row: T, index: number) => string | number;
  loading?: boolean;
  error?: string | null;
  onRetry?: () => void;
  emptyTitle?: string;
  emptyDescription?: string;
  emptyAction?: React.ReactNode;
  rowActions?: (row: T) => React.ReactNode;
  onRowClick?: (row: T) => void;
  footer?: React.ReactNode;
}

export function DataTable<T>({
  columns,
  rows,
  keyOf,
  loading,
  error,
  onRetry,
  emptyTitle = 'Nothing here yet',
  emptyDescription,
  emptyAction,
  rowActions,
  onRowClick,
  footer
}: DataTableProps<T>) {
  if (loading) return <LoadingState />;
  if (error) return <ErrorState message={error} onRetry={onRetry} />;
  if (!rows.length) return <EmptyState title={emptyTitle} description={emptyDescription} action={emptyAction} />;

  const desktopColumns = columns.filter((column) => !column.mobileOnly);
  const primary = columns.find((column) => column.primary) ?? columns[0];

  return (
    <div>
      {/* Desktop / tablet table */}
      <div className="hidden overflow-x-auto md:block">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="border-b border-line bg-subtle">
              {desktopColumns.map((column) =>
              <th
                key={column.key}
                scope="col"
                className={twMerge(
                  'whitespace-nowrap px-4 py-2.5 text-left text-[12px] font-semibold uppercase tracking-wide text-ink-soft',
                  column.align === 'right' && 'text-right',
                  column.className
                )}>
                
                  {column.header}
                </th>
              )}
              {rowActions &&
              <th scope="col" className="px-4 py-2.5 text-right text-[12px] font-semibold uppercase tracking-wide text-ink-soft">
                  Actions
                </th>
              }
            </tr>
          </thead>
          <tbody>
            {rows.map((row, index) =>
            <tr
              key={keyOf(row, index)}
              onClick={onRowClick ? () => onRowClick(row) : undefined}
              className={twMerge(
                'border-b border-line last:border-0',
                onRowClick && 'cursor-pointer transition-colors duration-150 ease-out hover:bg-subtle'
              )}>
              
                {desktopColumns.map((column) =>
              <td
                key={column.key}
                className={twMerge(
                  'px-4 py-3 align-middle text-ink',
                  column.align === 'right' && 'text-right',
                  column.className
                )}>
                
                    {column.render(row)}
                  </td>
              )}
                {rowActions &&
              <td className="px-4 py-3 text-right">
                    <div className="flex justify-end gap-1.5" onClick={(event) => event.stopPropagation()}>
                      {rowActions(row)}
                    </div>
                  </td>
              }
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Mobile stacked cards */}
      <ul className="divide-y divide-line md:hidden">
        {rows.map((row, index) =>
        <li key={keyOf(row, index)} className="px-4 py-3.5">
            <div
            role={onRowClick ? 'button' : undefined}
            tabIndex={onRowClick ? 0 : undefined}
            onClick={onRowClick ? () => onRowClick(row) : undefined}
            onKeyDown={
            onRowClick ?
            (event) => {
              if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault();
                onRowClick(row);
              }
            } :
            undefined
            }
            className={twMerge('w-full text-left', onRowClick && 'cursor-pointer')}>
            
              <div className="text-sm font-semibold text-ink">{primary.render(row)}</div>
              <dl className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1.5">
                {columns.
              filter((column) => column.key !== primary.key).
              map((column) =>
              <div key={column.key} className="min-w-0">
                      <dt className="text-[11px] uppercase tracking-wide text-ink-soft">{column.header}</dt>
                      <dd className="truncate text-[13px] text-ink">{column.render(row)}</dd>
                    </div>
              )}
              </dl>
            </div>
            {rowActions && <div className="mt-3 flex flex-wrap gap-1.5">{rowActions(row)}</div>}
          </li>
        )}
      </ul>

      {footer && <div className="border-t border-line bg-subtle px-4 py-3 text-[13px] text-ink-muted sm:px-5">{footer}</div>}
    </div>);

}