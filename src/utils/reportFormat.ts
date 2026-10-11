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

type Row = Record<string, unknown>;

function isPlainObject(value: unknown): value is Row {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function fullName(person: Row): string {
  return [person.first_name, person.last_name].filter(Boolean).join(' ') || String(person.name ?? '');
}

/** Customer details come back as { customer: {...}, leases: [...] } — one row per lease. */
function flattenCustomerDetails(rows: Row[]): Row[] {
  return rows.flatMap((row) => {
    const customer = isPlainObject(row.customer) ? row.customer : row;
    const contacts = Array.isArray(customer.immediate_contacts) ? customer.immediate_contacts as Row[] : [];
    const base: Row = {
      customer: fullName(customer),
      nic_number: customer.nic_number ?? null,
      phone: customer.phone ?? null,
      email: customer.email ?? null,
      address: customer.address ?? null,
      emergency_contacts: contacts.length ?
      contacts.
      map((c) => `${c.name ?? ''}${c.relation ? ` (${c.relation})` : ''}${c.mobile_number ? ` · ${c.mobile_number}` : ''}`).
      join('; ') :
      null
    };
    const leases = Array.isArray(row.leases) ? row.leases as Row[] : [];
    if (!leases.length) {
      return [{ ...base, room: null, deposit_paid: null, current_deposit: null, total_payments: null }];
    }
    return leases.map((lease) => ({
      ...base,
      room: lease.room ?? null,
      deposit_paid: lease.deposit_paid ?? null,
      current_deposit: lease.current_deposit ?? null,
      total_payments: lease.total_payments ?? null
    }));
  });
}

/** Generic fallback: lift one level of nested objects into prefixed columns. */
function flattenGeneric(rows: Row[]): Row[] {
  return rows.map((row) => {
    const flat: Row = {};
    for (const [key, value] of Object.entries(row)) {
      if (isPlainObject(value)) {
        for (const [subKey, subValue] of Object.entries(value)) {
          if (isPlainObject(subValue) || Array.isArray(subValue) && subValue.some(isPlainObject)) continue;
          flat[`${key}_${subKey}`] = subValue;
        }
      } else if (Array.isArray(value) && value.some(isPlainObject)) {
        flat[key] = `${value.length} item${value.length === 1 ? '' : 's'}`;
      } else {
        flat[key] = value;
      }
    }
    return flat;
  });
}

/** Turns nested report payload rows into flat, table-ready rows. */
export function flattenReportRows(type: string, rows: Row[]): Row[] {
  if (type === 'customer-details') return flattenCustomerDetails(rows);
  return flattenGeneric(rows);
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