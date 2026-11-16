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
'charge',
'balance',
'due',
'paid',
'price',
'adjustment',
'difference'];


const dateKeys = ['date', 'month', 'period', 'created_at'];

export function isCurrencyKey(key: string): boolean {
  const lower = key.toLowerCase();
  // Usage columns (units, per-day averages), meter readings, and counts are quantities, not money.
  if (/units|per_day|count|_id$|reading/.test(lower)) return false;
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
      return [{
        ...base,
        room: null,
        room_type: null,
        base_rent_fee: null,
        base_deposit: null,
        minimum_deposit_threshold: null,
        current_deposit: null,
        total_payments: null
      }];
    }
    return leases.map((lease) => ({
      ...base,
      room: lease.room ?? null,
      room_type: lease.room_type ?? null,
      base_rent_fee: lease.base_rent_fee ?? null,
      base_deposit: lease.base_deposit ?? lease.deposit_paid ?? null,
      minimum_deposit_threshold: lease.minimum_deposit_threshold ?? null,
      current_deposit: lease.current_deposit ?? null,
      total_payments: lease.total_payments ?? null
    }));
  });
}

/** Generic fallback: lift one level of nested objects into prefixed columns and drop duplicate derived columns. */
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
    // Deposit paid is always the same as Base deposit; omit duplicate columns.
    if ('base_deposit' in flat) {
      delete flat.deposit_paid;
      delete flat.initial_deposit;
    }
    // Monthly deduction = Base rent fee - Monthly rent fee; omit redundant column when both are present.
    if ('base_rent_fee' in flat && 'rent_fee' in flat) {
      delete flat.monthly_deposit_deduction;
    }
    if ('total_cost' in flat && 'total_bill' in flat) {
      delete flat.total_bill;
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