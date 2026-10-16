import type { jsPDF } from 'jspdf';
import type { Bill, Customer, ID, Lease, Room, UtilityRecord } from '../types';
import { formatCurrency, formatDate, formatMonth, monthInputValue, titleCase, toNumber } from './format';
import { billOutstanding, billRentDue, billStatus, billUtilities, customerName } from './lookup';
import { formatPerDay, formatUnits } from './utilityUsage';
import {
  addPage,
  BILL_THEME,
  BRAND_NAME,
  createDocument,
  previewPdf,
  printPdf,
  drawBrandHeader,
  drawFieldGrid,
  drawParagraph,
  drawSectionTitle,
  drawTable,
  drawTotalBand,
  savePdf,
  slugify,
  stampFooters } from
'./pdf';

/* ------------------------------------------------------------------ *
 * One consolidated bill per tenant: rent, that room's own electricity
 * and water meters, the deposit position, and the two preceding months
 * of utility usage so the tenant can sanity-check the jump.
 * ------------------------------------------------------------------ */

export interface UtilityHistoryRow {
  monthKey: string;
  electricity: number | null;
  water: number | null;
  /** Meter usage for the month — null when no utility record exists. */
  electricityUnits: number | null;
  waterUnits: number | null;
  /** Month-specific per-unit price applied to this room. */
  electricityRate: number | null;
  waterRate: number | null;
  isCurrent: boolean;
}

export interface BillPdfBundle {
  bill: Bill;
  lease?: Lease;
  customer?: Customer;
  room?: Room;
  history: UtilityHistoryRow[];
}

export interface BillPdfSources {
  leaseMap: Map<ID, Lease>;
  customerMap: Map<ID, Customer>;
  roomMap: Map<ID, Room>;
  utilities: UtilityRecord[];
}

function shiftMonth(monthKey: string, offset: number): string {
  const [year, month] = monthKey.split('-').map((part) => Number.parseInt(part, 10));
  if (!Number.isFinite(year) || !Number.isFinite(month)) return monthKey;
  const date = new Date(year, month - 1 + offset, 1);
  return `${date.getFullYear()}-${`${date.getMonth() + 1}`.padStart(2, '0')}`;
}

/** Joins a bill to its lease, tenant, room and three months of utility records. */
export function buildBillBundle(bill: Bill, sources: BillPdfSources): BillPdfBundle {
  const lease = sources.leaseMap.get(bill.lease);
  const customer = lease ? sources.customerMap.get(lease.customer) : undefined;
  const room = lease ? sources.roomMap.get(lease.room) : undefined;
  const currentMonth = monthInputValue(bill.billing_month);

  const history: UtilityHistoryRow[] = [0, -1, -2].map((offset) => {
    const monthKey = shiftMonth(currentMonth, offset);
    const record = sources.utilities.find(
      (item) => (lease ? item.room === lease.room : false) && monthInputValue(item.billing_month) === monthKey
    );
    const usage = {
      electricityUnits: record?.electricity_units !== undefined ? toNumber(record.electricity_units) : null,
      waterUnits: record?.water_units !== undefined ? toNumber(record.water_units) : null,
      electricityRate:
      record?.electricity_unit_price !== undefined && record.electricity_unit_price !== null ?
      toNumber(record.electricity_unit_price) :
      null,
      waterRate: record?.water_unit_price !== undefined && record.water_unit_price !== null ? toNumber(record.water_unit_price) : null
    };
    if (offset === 0) {
      return { monthKey, electricity: toNumber(bill.electricity), water: toNumber(bill.water), ...usage, isCurrent: true };
    }
    return {
      monthKey,
      electricity: record ? toNumber(record.electricity_cost) : null,
      water: record ? toNumber(record.water_cost) : null,
      ...usage,
      isCurrent: false
    };
  });

  return { bill, lease, customer, room, history };
}

function tenantName(bundle: BillPdfBundle): string {
  if (bundle.customer) return customerName(bundle.customer);
  return bundle.bill.customer_name ?? `Lease #${bundle.bill.lease}`;
}

function monthLabel(monthKey: string): string {
  return formatMonth(`${monthKey}-01`);
}

function renderBill(doc: jsPDF, bundle: BillPdfBundle): void {
  const { bill, lease, customer, room, history } = bundle;
  const outstanding = billOutstanding(bill);
  const roomNumber = room?.room_number ?? bill.room_number ?? '—';
  const depositDeduction = toNumber(bill.deposit_deduction);
  const remainingDeposit = toNumber(bill.remaining_deposit);
  const depositPaid = lease ? toNumber(lease.deposit_paid) : null;
  const primaryContact = customer?.immediate_contacts?.[0];
  const current = history.find((row) => row.isCurrent);
  const electricityRate = current?.electricityRate ?? toNumber(room?.electricity_unit_price);
  const waterRate = current?.waterRate ?? toNumber(room?.water_unit_price);
  const usageLabel = (units: number | null | undefined, rate: number) =>
  units === null || units === undefined ?
  rate ?
  ` — ${formatCurrency(rate)} / unit` :
  '' :
  ` — ${formatUnits(units)} units (${formatPerDay(units, bill.billing_month)}) × ${formatCurrency(rate)}`;

  let y = drawBrandHeader(doc, {
    documentTitle: 'Monthly bill',
    reference: `Bill #${bill.id}`,
    referenceNote: `Issued ${formatDate(new Date().toISOString())}`
  });

  y = drawFieldGrid(doc, y, [
  {
    label: 'Billed to',
    value: tenantName(bundle),
    note: customer?.nic_number ? `NIC ${customer.nic_number}` : undefined
  },
  { label: 'Room', value: roomNumber, note: room?.room_type || undefined },
  { label: 'Billing month', value: monthLabel(monthInputValue(bill.billing_month)) },
  { label: 'Payment due', value: formatDate(bill.due_date) },
  { label: 'Contact', value: customer?.phone || '—', note: customer?.email || undefined },
  { label: 'Status', value: titleCase(billStatus(bill)) },
  { label: 'Lease started', value: lease ? formatDate(lease.start_date) : '—' },
  {
    label: 'Immediate contact',
    value: primaryContact ? `${primaryContact.name} (${primaryContact.relation})` : '—',
    note: primaryContact?.mobile_number || undefined
  }]
  );

  y += 10;
  y = drawSectionTitle(doc, y, 'Rent for this month', 'Payable to Sunrise Apartments');
  y = drawTable(doc, {
    startY: y + 4,
    head: ['Description', 'Amount'],
    body: [
    [`Room rent — Room ${roomNumber}`, formatCurrency(bill.rent)],
    depositDeduction > 0 ?
    ['Less: monthly deposit deduction', `- ${formatCurrency(depositDeduction)}`] :
    ['Deposit deduction — stopped, minimum deposit reached', formatCurrency(0)]],

    rightAlign: [1],
    columnWidths: { 1: 130 }
  });

  y = drawTotalBand(
    doc,
    y + 12,
    'Rent payable this month',
    formatCurrency(billRentDue(bill)),
    depositDeduction > 0 ? 'Rent less deposit deduction' : 'Full rent'
  );

  y = drawTable(doc, {
    startY: y + 12,
    head: ['Rent payment position', 'Amount'],
    body: [
    ['Rent paid so far', formatCurrency(bill.amount_paid)],
    [outstanding > 0 ? 'Rent still outstanding' : 'Rent settled in full', formatCurrency(outstanding)]],

    rightAlign: [1],
    columnWidths: { 1: 130 },
    emphasiseLastRow: true,
    fontSize: 8.6
  });

  y = drawSectionTitle(doc, y + 22, 'Utilities for this month', 'Pay directly to the supplier — not included in rent payable');
  y = drawTable(doc, {
    startY: y + 4,
    head: ['Utility', 'Amount'],
    body: [
    [`Electricity${usageLabel(current?.electricityUnits, electricityRate)}`, formatCurrency(bill.electricity)],
    [`Water${usageLabel(current?.waterUnits, waterRate)}`, formatCurrency(bill.water)],
    ['Utilities total — pay to supplier', formatCurrency(billUtilities(bill))]],

    rightAlign: [1],
    columnWidths: { 1: 130 },
    emphasiseLastRow: true,
    fontSize: 8.6
  });

  y = drawSectionTitle(doc, y + 22, 'Deposit', 'Covers part of the rent each month until the balance reaches zero');
  y = drawTable(doc, {
    startY: y + 4,
    head: ['Deposit movement', 'Amount'],
    body: [
    ['Deposit originally paid', depositPaid === null ? '—' : formatCurrency(depositPaid)],
    ['Deducted this month', `- ${formatCurrency(depositDeduction)}`],
    ['Remaining deposit balance', formatCurrency(remainingDeposit)]],

    rightAlign: [1],
    columnWidths: { 1: 130 },
    emphasiseLastRow: true,
    fontSize: 8.6
  });

  y = drawSectionTitle(doc, y + 22, 'Utility history', 'Usage with average per day — this month and the previous two');
  y = drawTable(doc, {
    startY: y + 4,
    head: ['Month', 'Elec. units', 'Avg / day', 'Electricity', 'Water units', 'Avg / day', 'Water', 'Total'],
    body: history.map((row) => {
      const monthValue = `${row.monthKey}-01`;
      return [
      row.isCurrent ? `${monthLabel(row.monthKey)} (this bill)` : monthLabel(row.monthKey),
      row.electricityUnits === null ? '—' : formatUnits(row.electricityUnits),
      row.electricityUnits === null ? '—' : formatPerDay(row.electricityUnits, monthValue),
      row.electricity === null ? 'Not recorded' : formatCurrency(row.electricity),
      row.waterUnits === null ? '—' : formatUnits(row.waterUnits),
      row.waterUnits === null ? '—' : formatPerDay(row.waterUnits, monthValue),
      row.water === null ? 'Not recorded' : formatCurrency(row.water),
      row.electricity === null && row.water === null ? '—' : formatCurrency(toNumber(row.electricity) + toNumber(row.water))];

    }),
    rightAlign: [1, 2, 3, 4, 5, 6, 7],
    fontSize: 7.8
  });

  drawParagraph(
    doc,
    y + 20,
    `Electricity and water are charged on this room\u2019s own meter units at this month\u2019s per-unit price (the building bill divided by all rooms\u2019 usage, unless adjusted for this room). Utility bills are paid directly to the supplier. ${
    depositDeduction > 0 ?
    `${formatCurrency(depositDeduction)} of the rent is covered by the deposit this month; deductions stop once the deposit balance reaches zero, after which the full rent is payable.` :
    'The deposit balance has been used up, so no deduction applies and the full rent is payable.'} Any deposit remaining when the room is vacated is refunded after deducting repair costs.`

  );
}

function billFilename(bundle: BillPdfBundle): string {
  const month = monthInputValue(bundle.bill.billing_month);
  return `${slugify(`${BRAND_NAME} bill ${bundle.bill.id} ${tenantName(bundle)}`)}-${month}.pdf`;
}

function buildBillDocument(bundle: BillPdfBundle): jsPDF {
  const doc = createDocument('portrait', BILL_THEME);
  renderBill(doc, bundle);
  stampFooters(doc, `${BRAND_NAME} — bill #${bundle.bill.id} · ${tenantName(bundle)} · Room ${bundle.room?.room_number ?? bundle.bill.room_number ?? '—'}`);
  return doc;
}

/** Single tenant bill. */
export function downloadBillPdf(bundle: BillPdfBundle): void {
  savePdf(buildBillDocument(bundle), billFilename(bundle));
}

/** Opens the bill PDF in a new tab. */
export function previewBillPdf(bundle: BillPdfBundle): void {
  previewPdf(buildBillDocument(bundle), `${BRAND_NAME} — Bill #${bundle.bill.id}`);
}

/** Sends the bill PDF to the print dialog. */
export function printBillPdf(bundle: BillPdfBundle): void {
  printPdf(buildBillDocument(bundle), `${BRAND_NAME} — Bill #${bundle.bill.id}`);
}

/** One file, one page per tenant — for sending out a whole month at once. */
export function downloadBillsPdf(bundles: BillPdfBundle[], monthKey: string): void {
  if (!bundles.length) return;
  if (bundles.length === 1) {
    downloadBillPdf(bundles[0]);
    return;
  }

  const doc = createDocument('portrait', BILL_THEME);
  bundles.forEach((bundle, index) => {
    if (index > 0) addPage(doc);
    renderBill(doc, bundle);
  });
  stampFooters(doc, `${BRAND_NAME} — bills for ${monthLabel(monthKey)} · ${bundles.length} tenants`);
  savePdf(doc, `${slugify(`${BRAND_NAME} bills`)}-${monthKey}.pdf`);
}