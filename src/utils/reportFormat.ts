import { formatCurrency, formatDate, titleCase } from './format';

/**
 * Reports come back as loosely typed JSON, so column formatting is inferred
 * from the field name. Shared by the on-screen table and the PDF/CSV exports
 * so a downloaded report reads exactly like the one on screen.
 */

const currencyKeys = [
'cost',
'amount',
'rent',
'profit',
'total',
'deposit',
'payments',
'owed',
'water',
'electricity',
'fee',
'deduction',
'revenue',
'charge'];


const dateKeys = ['date', 'month', 'period'];

export function isCurrencyKey(key: string): boolean {
  const lower = key.toLowerCase();
  return currencyKeys.some((needle) => lower.includes(needle));
}

export function isDateKey(key: string): boolean {
  const lower = key.toLowerCase();
  return dateKeys.some((needle) => lower.includes(needle));
}

/** Plain-text rendering of a report cell, for PDF and CSV output. */
export function reportCellText(key: string, value: unknown): string {
  if (value === null || value === undefined || value === '') return '—';
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  if (typeof value === 'number') return isCurrencyKey(key) ? formatCurrency(value) : String(value);
  if (typeof value === 'string') {
    if (isDateKey(key) && /^\d{4}-\d{2}-\d{2}/.test(value)) return formatDate(value);
    if (isCurrencyKey(key) && /^-?\d+(\.\d+)?$/.test(value)) return formatCurrency(value);
    if (['status', 'method', 'room_type'].includes(key.toLowerCase())) return titleCase(value);
    return value;
  }
  if (Array.isArray(value)) return value.map((item) => String(item)).join(', ');
  return JSON.stringify(value);
}

/** Raw value for CSV so spreadsheets can still do arithmetic on numbers. */
export function reportCellRaw(key: string, value: unknown): string | number {
  if (value === null || value === undefined) return '';
  if (typeof value === 'number') return value;
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  if (typeof value === 'string') return value;
  if (Array.isArray(value)) return value.map((item) => String(item)).join(', ');
  return JSON.stringify(value);
}

export function reportColumnKeys(rows: Record<string, unknown>[]): string[] {
  const keys: string[] = [];
  for (const row of rows) {
    for (const key of Object.keys(row)) {
      if (!keys.includes(key)) keys.push(key);
    }
  }
  return keys;
}