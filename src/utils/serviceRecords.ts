import type {
  ID,
  NormalizedBuildingServiceBill,
  NormalizedPreviousMonthItem,
  NormalizedPreviousReading,
  NormalizedMonthlyServiceSummary,
  NormalizedServicePayment,
  NormalizedServiceRow,
  ServiceKind,
  ServicePaymentResponse
} from '../types';
import { formatCurrency, formatMonth, toNumber } from './format';

export interface ServiceConfig {
  kind: ServiceKind;
  label: string;
  lowerLabel: string;
  supplierName: string;
  supplierShort: string;
  route: string;
  paymentsRoute: string;
  crudResource: 'electricity' | 'water';
  recordsPath: string;
  monthlySummaryPath: string;
  previousReadingsPath: string;
  buildingBillPostPath: string;
  buildingBillsListPath: string;
  roomHistoryPath: string;
  bulkUnitPricesPath: string;
  paymentsPath: string;
  recordRoomPaymentPath: string;
  roomPrevReadingsPath: (roomId: ID | string) => string;
  setUnitPricePath: (id: ID) => string;
  recordPaymentPath: (id: ID) => string;
  applyCreditPath: (id: ID) => string;
  totalBillKey: 'total_electricity_bill' | 'total_water_bill';
  supplierUnitsKey: 'supplier_electricity_units' | 'supplier_water_units';
  meterReadingKey: 'electricity_meter_reading' | 'water_meter_reading';
  unitPriceKey: 'electricity_unit_price' | 'water_unit_price';
  receiptPlaceholder: string;
  auditCategory: ServiceKind;
}

export const SERVICE_CONFIG: Record<ServiceKind, ServiceConfig> = {
  electricity: {
    kind: 'electricity',
    label: 'Electricity',
    lowerLabel: 'electricity',
    supplierName: 'Electricity supplier (CEB)',
    supplierShort: 'CEB',
    route: '/electricity',
    paymentsRoute: '/electricity-payments',
    crudResource: 'electricity',
    recordsPath: '/api/electricity/',
    monthlySummaryPath: '/api/electricity/monthly-summary/',
    previousReadingsPath: '/api/electricity/previous-readings/',
    buildingBillPostPath: '/api/electricity/building-bill/',
    buildingBillsListPath: '/api/building-electricity/',
    roomHistoryPath: '/api/electricity/room-history/',
    bulkUnitPricesPath: '/api/electricity/set-unit-prices/',
    paymentsPath: '/api/electricity-payments/',
    recordRoomPaymentPath: '/api/electricity/record-payment/',
    roomPrevReadingsPath: (roomId) => `/api/rooms/${roomId}/previous-electricity-readings/`,
    setUnitPricePath: (id) => `/api/electricity/${id}/set-unit-prices/`,
    recordPaymentPath: (id) => `/api/electricity/${id}/record-payment/`,
    applyCreditPath: (id) => `/api/electricity/${id}/apply-credit/`,
    totalBillKey: 'total_electricity_bill',
    supplierUnitsKey: 'supplier_electricity_units',
    meterReadingKey: 'electricity_meter_reading',
    unitPriceKey: 'electricity_unit_price',
    receiptPlaceholder: 'CEB-ONLINE-TXN-998822',
    auditCategory: 'electricity'
  },
  water: {
    kind: 'water',
    label: 'Water',
    lowerLabel: 'water',
    supplierName: 'Water supplier (NWSDB)',
    supplierShort: 'NWSDB',
    route: '/water',
    paymentsRoute: '/water-payments',
    crudResource: 'water',
    recordsPath: '/api/water/',
    monthlySummaryPath: '/api/water/monthly-summary/',
    previousReadingsPath: '/api/water/previous-readings/',
    buildingBillPostPath: '/api/water/building-bill/',
    buildingBillsListPath: '/api/building-water/',
    roomHistoryPath: '/api/water/room-history/',
    bulkUnitPricesPath: '/api/water/set-unit-prices/',
    paymentsPath: '/api/water-payments/',
    recordRoomPaymentPath: '/api/water/record-payment/',
    roomPrevReadingsPath: (roomId) => `/api/rooms/${roomId}/previous-water-readings/`,
    setUnitPricePath: (id) => `/api/water/${id}/set-unit-prices/`,
    recordPaymentPath: (id) => `/api/water/${id}/record-payment/`,
    applyCreditPath: (id) => `/api/water/${id}/apply-credit/`,
    totalBillKey: 'total_water_bill',
    supplierUnitsKey: 'supplier_water_units',
    meterReadingKey: 'water_meter_reading',
    unitPriceKey: 'water_unit_price',
    receiptPlaceholder: 'NWSDB-ONLINE-TXN-441022',
    auditCategory: 'water'
  }
};

type Json = Record<string, unknown>;

function isRecord(value: unknown): value is Json {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function firstDefined(...values: unknown[]): unknown {
  for (const value of values) {
    if (value !== undefined && value !== null && value !== '') return value;
  }
  return undefined;
}

function asArray(raw: unknown, preferredKeys: string[]): Json[] {
  if (Array.isArray(raw)) return raw.filter(isRecord);
  if (!isRecord(raw)) return [];
  for (const key of preferredKeys) {
    if (Array.isArray(raw[key])) return (raw[key] as unknown[]).filter(isRecord);
  }
  return [];
}

export function normalizeBuildingBill(kind: ServiceKind, raw: unknown): NormalizedBuildingServiceBill | null {
  if (!isRecord(raw)) return null;
  const id = Number(firstDefined(raw.id) ?? 0);
  const billing_month = String(firstDefined(raw.billing_month) ?? '');
  const billing_date = (firstDefined(raw.billing_date) as string | null | undefined) ?? null;
  const total_bill = firstDefined(raw[`total_${kind}_bill`], raw.total_bill) as number | string | undefined;
  const total_units = firstDefined(raw[`total_${kind}_units`], raw.total_units) as number | string | undefined;
  const supplier_units = firstDefined(raw[`supplier_${kind}_units`], raw.supplier_units) as number | string | undefined;
  const units_difference = firstDefined(raw[`${kind}_units_difference`], raw.units_difference) as number | string | undefined;
  const unit_price = firstDefined(
    raw[`${kind}_unit_price`],
    raw[`default_${kind}_unit_price`],
    raw.unit_price
  ) as number | string | undefined;

  return {
    id,
    billing_month,
    billing_date,
    total_bill: total_bill ?? 0,
    total_units: total_units ?? 0,
    supplier_units: supplier_units ?? null,
    units_difference: units_difference ?? null,
    unit_price: unit_price ?? 0
  };
}

export function normalizeServiceRow(kind: ServiceKind, raw: unknown, fallbackMonth = ''): NormalizedServiceRow {
  const item = isRecord(raw) ? raw : {};
  const recordId = Number(firstDefined(item[`${kind}_record_id`], item.record_id, item.id) ?? 0);
  const roomId = Number(firstDefined(item.room_id, item.room) ?? 0);
  const roomNumber = String(firstDefined(item.room_number) ?? (roomId ? String(roomId) : '—'));

  return {
    record_id: recordId,
    room_id: roomId,
    room_number: roomNumber,
    room_type: typeof item.room_type === 'string' ? item.room_type : undefined,
    customer_name: typeof item.customer_name === 'string' ? item.customer_name : null,
    billing_month: String(firstDefined(item.billing_month, fallbackMonth) ?? ''),
    billing_date: (firstDefined(item.billing_date) as string | null | undefined) ?? null,
    previous_meter_reading: firstDefined(
      item[`previous_${kind}_meter_reading`],
      item.previous_meter_reading
    ) as number | string | undefined,
    meter_reading: firstDefined(
      item[`${kind}_meter_reading`],
      item.meter_reading
    ) as number | string | undefined,
    units: (firstDefined(item[`${kind}_units`], item.units) as number | string | undefined) ?? 0,
    unit_price: (firstDefined(item[`${kind}_unit_price`], item.unit_price) as number | string | null | undefined) ?? null,
    cost: (firstDefined(item[`${kind}_cost`], item.total_cost, item.total_bill, item.cost) as number | string | undefined) ?? 0,
    total_paid: firstDefined(
      item[`total_${kind}_paid`],
      item[`${kind}_paid`],
      item.total_paid,
      item.already_paid,
      item.net_paid
    ) as number | string | undefined,
    remaining_balance: firstDefined(
      item.remaining_balance,
      item[`${kind}_remaining_balance`]
    ) as number | string | undefined,
    room_credit_balance: firstDefined(
      item[`room_${kind}_credit_balance`],
      item[`${kind}_credit_balance`],
      item.room_credit_balance
    ) as number | string | undefined,
    is_paid: Boolean(item.is_paid)
  };
}

export function extractMonthlySummary(kind: ServiceKind, raw: unknown): NormalizedMonthlyServiceSummary | null {
  if (!isRecord(raw)) return null;
  const billingMonth = String(firstDefined(raw.billing_month) ?? '');
  const rawBuildingBill =
    raw[`building_${kind}_bill`] ??
    raw.building_bill ??
    raw[`building_${kind}`] ??
    null;
  const buildingBill = normalizeBuildingBill(kind, rawBuildingBill);
  const rawRows = asArray(raw, [
    `rooms_${kind}_data`,
    `${kind}_records`,
    `rooms_${kind}_records`,
    'rooms_data',
    'records',
    'results'
  ]);
  const rows = rawRows.map((row) => normalizeServiceRow(kind, row, billingMonth));

  return {
    billing_month: billingMonth,
    building_bill: buildingBill,
    rooms_count: typeof raw.rooms_count === 'number' ? raw.rooms_count : rows.length,
    total_rooms_cost: firstDefined(
      raw[`total_rooms_${kind}_cost`],
      raw.total_rooms_cost
    ) as number | string | undefined,
    rows
  };
}

export function extractRoomHistory(kind: ServiceKind, raw: unknown): NormalizedServiceRow[] {
  const list = asArray(raw, [`${kind}_records`, 'records', 'results']);
  return list.map((item) => normalizeServiceRow(kind, item));
}

function normalizePreviousMonthItem(kind: ServiceKind, raw: Json): NormalizedPreviousMonthItem {
  return {
    record_id: Number(firstDefined(raw[`${kind}_record_id`], raw.record_id, raw.id) ?? 0) || undefined,
    billing_month: String(firstDefined(raw.billing_month) ?? ''),
    previous_meter_reading: (firstDefined(raw[`previous_${kind}_meter_reading`], raw.previous_meter_reading) as number | string | undefined) ?? 0,
    meter_reading: (firstDefined(raw[`${kind}_meter_reading`], raw.meter_reading) as number | string | undefined) ?? 0,
    units: (firstDefined(raw[`${kind}_units`], raw.units) as number | string | undefined) ?? 0
  };
}

export function normalizePreviousReading(kind: ServiceKind, raw: Json): NormalizedPreviousReading {
  const rawMonths = Array.isArray(raw.previous_months) ? raw.previous_months.filter(isRecord) : [];
  return {
    room_id: Number(firstDefined(raw.room_id, raw.room, raw.id) ?? 0),
    room_number: String(firstDefined(raw.room_number) ?? ''),
    room_type: typeof raw.room_type === 'string' ? raw.room_type : undefined,
    billing_month: typeof raw.billing_month === 'string' ? raw.billing_month : undefined,
    last_billing_month: (firstDefined(raw[`last_${kind}_billing_month`], raw.last_billing_month) as string | null | undefined) ?? null,
    previous_meter_reading: (firstDefined(raw[`previous_${kind}_meter_reading`], raw.previous_meter_reading) as number | string | null | undefined) ?? null,
    previous_months: rawMonths.map((entry) => normalizePreviousMonthItem(kind, entry))
  };
}

export function extractPreviousReadings(kind: ServiceKind, raw: unknown): NormalizedPreviousReading[] {
  const list = asArray(raw, ['results', 'rooms']);
  return list.map((item) => normalizePreviousReading(kind, item));
}

export function extractSingleRoomPreviousReading(kind: ServiceKind, raw: unknown): NormalizedPreviousReading | null {
  if (Array.isArray(raw)) {
    const first = raw.find(isRecord);
    return first ? normalizePreviousReading(kind, first) : null;
  }
  if (!isRecord(raw)) return null;
  return normalizePreviousReading(kind, raw);
}

export function normalizeServicePayment(kind: ServiceKind, raw: unknown): NormalizedServicePayment {
  const item = isRecord(raw) ? raw : {};
  const recordIdRaw = firstDefined(item[`${kind}_record`], item[`${kind}_record_id`], item.record_id);
  return {
    id: Number(firstDefined(item.id, item.payment_id) ?? 0),
    record_id: recordIdRaw !== undefined ? Number(recordIdRaw) : undefined,
    room_number: typeof item.room_number === 'string' ? item.room_number : undefined,
    billing_month: typeof item.billing_month === 'string' ? item.billing_month : undefined,
    amount_paid: (item.amount_paid as number | string | undefined) ?? 0,
    payment_date: String(item.payment_date ?? ''),
    paid_to_supplier: typeof item.paid_to_supplier === 'boolean' ? item.paid_to_supplier : undefined,
    receipt_reference: typeof item.receipt_reference === 'string' ? item.receipt_reference : undefined,
    notes: typeof item.notes === 'string' ? item.notes : undefined,
    created_at: typeof item.created_at === 'string' ? item.created_at : undefined
  };
}

const ADVANCE_CREDIT_REFS = new Set([
  'ADVANCE-ELECTRICITY-CREDIT',
  'ADVANCE-WATER-CREDIT',
  'ADVANCE-CREDIT',
  'CREDIT-APPLIED',
  'ELECTRICITY-CREDIT-APPLIED',
  'WATER-CREDIT-APPLIED'
]);

export function isAdvanceCreditReference(reference: string | null | undefined): boolean {
  if (!reference) return false;
  return ADVANCE_CREDIT_REFS.has(reference.trim().toUpperCase());
}

/** What is still owed to the supplier for a room's electricity or water bill. */
export function serviceRemaining(row: {
  remaining_balance?: number | string;
  cost?: number | string;
  total_paid?: number | string;
  is_paid?: boolean;
}): number {
  if (row.is_paid) return 0;
  if (row.remaining_balance !== undefined && row.remaining_balance !== null && row.remaining_balance !== '') {
    return Math.max(0, toNumber(row.remaining_balance));
  }
  return Math.max(0, toNumber(row.cost) - toNumber(row.total_paid));
}

/** Builds a descriptive toast showing FIFO bill allocations and room-only advance credit from the API response. */
export function formatServicePaymentToast(
  kind: ServiceKind,
  roomNumber: string,
  response: ServicePaymentResponse | null | undefined,
  fallbackExcess = 0
): string {
  const config = SERVICE_CONFIG[kind];
  if (response?.message && response.message.trim()) {
    return response.message;
  }
  const parts: string[] = [`${config.label} payment recorded to ${config.supplierShort} for Room ${roomNumber}.`];
  const allocations = Array.isArray(response?.allocations) ? response.allocations : [];
  if (allocations.length > 0) {
    const summary = allocations
      .map((item) => {
        const applied = item.applied_amount ?? item.amount_applied;
        const month = item.billing_month ? formatMonth(item.billing_month) : '';
        return applied !== undefined ? `${month ? `${month}: ` : ''}${formatCurrency(applied)}` : month;
      })
      .filter(Boolean)
      .join(', ');
    if (summary) parts.push(`Allocated (oldest unpaid first): ${summary}.`);
  }
  const excess = response?.excess_credit_added !== undefined ? toNumber(response.excess_credit_added) : fallbackExcess;
  const creditBalance =
    kind === 'electricity'
      ? response?.room_electricity_credit_balance
      : response?.room_water_credit_balance;
  if (excess > 0) {
    parts.push(`${formatCurrency(excess)} added to Room ${roomNumber} ${config.lowerLabel} credit.`);
  } else if (creditBalance !== undefined && toNumber(creditBalance) > 0) {
    parts.push(`Room ${config.lowerLabel} credit: ${formatCurrency(creditBalance)}.`);
  }
  return parts.join(' ');
}
