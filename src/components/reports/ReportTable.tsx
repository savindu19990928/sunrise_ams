import React, { useMemo } from 'react';
import { formatCurrency, formatDate, titleCase } from '../../utils/format';
import { isCurrencyKey, isDateKey, reportColumnKeys } from '../../utils/reportFormat';
import { Badge } from '../ui/Badge';
import { type Column, DataTable } from '../ui/DataTable';

export type ReportRow = Record<string, unknown>;

function renderValue(key: string, value: unknown): React.ReactNode {
  if (value === null || value === undefined || value === '') return <span className="text-ink-soft">—</span>;
  if (typeof value === 'boolean') return <Badge tone={value ? 'success' : 'neutral'}>{value ? 'Yes' : 'No'}</Badge>;
  if (typeof value === 'number') {
    return isCurrencyKey(key) ? formatCurrency(value) : String(value);
  }
  if (typeof value === 'string') {
    if (isDateKey(key) && /^\d{4}-\d{2}-\d{2}/.test(value)) return formatDate(value);
    if (isCurrencyKey(key) && /^-?\d+(\.\d+)?$/.test(value)) return formatCurrency(value);
    if (['status', 'method', 'room_type'].includes(key.toLowerCase())) {
      return <Badge tone={value === 'paid' ? 'success' : value === 'unpaid' ? 'danger' : 'neutral'}>{titleCase(value)}</Badge>;
    }
    return value;
  }
  if (Array.isArray(value)) return value.map((item) => String(item)).join(', ');
  return JSON.stringify(value);
}

interface ReportTableProps {
  rows: ReportRow[];
  loading?: boolean;
  emptyTitle?: string;
  emptyDescription?: string;
}

/** Renders any JSON report payload as a readable, responsive table. */
export function ReportTable({ rows, loading, emptyTitle = 'No data for this period', emptyDescription }: ReportTableProps) {
  const columns = useMemo<Column<ReportRow>[]>(() => {
    const keys = reportColumnKeys(rows);
    return keys.map((key, index) => ({
      key,
      header: titleCase(key),
      primary: index === 0,
      align: rows.some((row) => typeof row[key] === 'number') && isCurrencyKey(key) ? 'right' : 'left',
      render: (row) => renderValue(key, row[key])
    }));
  }, [rows]);

  return (
    <DataTable
      columns={columns.length ? columns : [{ key: 'empty', header: '—', render: () => null }]}
      rows={rows}
      keyOf={(_row, index) => index}
      loading={loading}
      emptyTitle={emptyTitle}
      emptyDescription={emptyDescription} />);


}