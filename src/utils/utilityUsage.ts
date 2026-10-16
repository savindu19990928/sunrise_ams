import { toNumber } from './format';

/**
 * Average-per-day usage is always derived on the client: the month's units
 * divided by the number of days in that billing month.
 */

/** Days in the month of a `YYYY-MM` or `YYYY-MM-DD` value. Falls back to 30. */
export function daysInMonth(month: string | null | undefined): number {
  if (!month) return 30;
  const [year, monthIndex] = month.slice(0, 7).split('-').map((part) => Number.parseInt(part, 10));
  if (!Number.isFinite(year) || !Number.isFinite(monthIndex)) return 30;
  return new Date(year, monthIndex, 0).getDate();
}

export function averagePerDay(units: number | string | null | undefined, month: string | null | undefined): number {
  return toNumber(units) / daysInMonth(month);
}

export function formatUnits(value: number | string | null | undefined): string {
  const n = toNumber(value);
  return n.toLocaleString('en-US', { maximumFractionDigits: 2 });
}

/** "1.45 / day" */
export function formatPerDay(units: number | string | null | undefined, month: string | null | undefined): string {
  return `${averagePerDay(units, month).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} / day`;
}

/**
 * Supplier-stated usage minus the sum of room meters. Positive means the supplier
 * billed more units than the rooms recorded (common-area use, losses, meter drift).
 */
export function usageDifference(
supplierUnits: number | string | null | undefined,
meterUnits: number | string | null | undefined)
: number | null {
  if (supplierUnits === null || supplierUnits === undefined || supplierUnits === '') return null;
  return toNumber(supplierUnits) - toNumber(meterUnits);
}

/** "+15 units (7.0%)" style label for a usage difference. */
export function formatDifference(difference: number | null, supplierUnits?: number | string | null): string {
  if (difference === null) return 'Supplier usage not entered';
  if (Math.abs(difference) < 0.005) return 'Matches room meters';
  const sign = difference > 0 ? '+' : '−';
  const supplier = toNumber(supplierUnits);
  const pct = supplier > 0 ? ` (${(Math.abs(difference) / supplier * 100).toFixed(1)}%)` : '';
  return `${sign}${formatUnits(Math.abs(difference))} units${pct}`;
}

/** What is still owed to the supplier for a room's utility bill. */
export function utilityRemaining(record: {
  remaining_balance?: number | string;
  total_cost?: number | string;
  total_bill?: number | string;
  total_utility_paid?: number | string;
  is_paid?: boolean;
}): number {
  if (record.is_paid) return 0;
  if (record.remaining_balance !== undefined && record.remaining_balance !== null && record.remaining_balance !== '') {
    return Math.max(0, toNumber(record.remaining_balance));
  }
  return Math.max(0, toNumber(record.total_cost ?? record.total_bill) - toNumber(record.total_utility_paid));
}

type Row = Record<string, unknown>;

const usageKeys = ['electricity_units', 'water_units'];

/**
 * For report rows that carry usage and a billing month, inserts
 * `<utility>_avg_per_day` immediately after each usage column.
 */
export function withDailyAverages(rows: Row[]): Row[] {
  return rows.map((row) => {
    const month = typeof row.billing_month === 'string' ? row.billing_month : null;
    if (!month || !usageKeys.some((key) => key in row)) return row;
    const out: Row = {};
    for (const [key, value] of Object.entries(row)) {
      out[key] = value;
      if (usageKeys.includes(key) && value !== null && value !== undefined && value !== '') {
        const prefix = key.replace('_units', '');
        out[`${prefix}_avg_units_per_day`] = Number(averagePerDay(value as number | string, month).toFixed(2));
      }
    }
    return out;
  });
}