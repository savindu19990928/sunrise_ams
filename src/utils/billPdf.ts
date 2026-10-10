import type { jsPDF } from 'jspdf';
import type { Bill, Customer, ID, Lease, Room, UtilityRecord } from '../types';
import { formatCurrency, formatDate, formatMonth, monthInputValue, titleCase, toNumber } from './format';
import { billOutstanding, billStatus, customerName } from './lookup';
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
    if (offset === 0) {
      return {
        monthKey,
        electricity: toNumber(bill.electricity),
        water: toNumber(bill.water),
        isCurrent: true
      };
    }
    const record = sources.utilities.find(
      (item) => (lease ? item.room === lease.room : false) && monthInputValue(item.billing_month) === monthKey
    );
    return {
      monthKey,
      electricity: record ? toNumber(record.electricity_cost) : null,
      water: record ? toNumber(record.water_cost) : null,
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
  const electricityRate = toNumber(room?.electricity_unit_price);
  const waterRate = toNumber(room?.water_unit_price);

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
  y = drawSectionTitle(doc, y, 'Charges for this month');
  y = drawTable(doc, {
    startY: y + 4,
    head: ['Description', 'Amount'],
    body: [
    [`Room rent — Room ${roomNumber}`, formatCurrency(bill.rent)],
    depositDeduction > 0 ?
    ['Less: monthly deposit deduction', `- ${formatCurrency(depositDeduction)}`] :
    ['Deposit deduction — stopped, deposit used up', formatCurrency(0)],
    [
    electricityRate ? `Electricity — room rate ${formatCurrency(electricityRate)} / unit` : 'Electricity — room meter',
    formatCurrency(bill.electricity)],

    [
    waterRate ? `Water — room rate ${formatCurrency(waterRate)} / unit` : 'Water — room meter',
    formatCurrency(bill.water)]],


    rightAlign: [1],
    columnWidths: { 1: 130 }
  });

  y = drawTotalBand(
    doc,
    y + 12,
    'Total payable this month',
    formatCurrency(bill.total_due),
    depositDeduction > 0 ? 'Rent less deposit deduction, plus electricity and water' : 'Full rent plus electricity and water'
  );

  y = drawTable(doc, {
    startY: y + 12,
    head: ['Payment position', 'Amount'],
    body: [
    ['Paid so far', formatCurrency(bill.amount_paid)],
    [outstanding > 0 ? 'Still outstanding' : 'Settled in full', formatCurrency(outstanding)]],

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

  y = drawSectionTitle(doc, y + 22, 'Utility history', 'This month and the previous two');
  y = drawTable(doc, {
    startY: y + 4,
    head: ['Month', 'Electricity', 'Water', 'Utilities total'],
    body: history.map((row) => [
    row.isCurrent ? `${monthLabel(row.monthKey)} (this bill)` : monthLabel(row.monthKey),
    row.electricity === null ? 'Not recorded' : formatCurrency(row.electricity),
    row.water === null ? 'Not recorded' : formatCurrency(row.water),
    row.electricity === null && row.water === null ?
    '—' :
    formatCurrency(toNumber(row.electricity) + toNumber(row.water))]
    ),
    rightAlign: [1, 2, 3],
    fontSize: 8.6
  });

  drawParagraph(
    doc,
    y + 20,
    `Electricity and water are charged on this room\u2019s own meter units at this room\u2019s unit prices. ${
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