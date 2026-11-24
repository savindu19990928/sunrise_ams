import type { jsPDF } from 'jspdf';
import type { Bill, Customer, ElectricityRecord, ID, Lease, Room, WaterRecord } from '../types';
import { formatCurrency, formatDate, formatMonth, monthInputValue, titleCase, toNumber } from './format';
import {
  billElectricityRemaining,
  billRentDue,
  billStatus,
  billWaterRemaining,
  customerName
} from './lookup';
import { formatPerDay, formatUnits } from './utilityUsage';
import {
  addPage,
  BILL_THEME,
  BRAND_NAME,
  createDocument,
  drawBrandHeader,
  drawFieldGrid,
  drawSectionTitle,
  drawSupplierAccountsBox,
  drawTable,
  drawTotalBand,
  previewPdf,
  printPdf,
  savePdf,
  slugify,
  stampFooters
} from './pdf';
import { getSupplierAccounts } from './supplierAccounts';

/* ------------------------------------------------------------------ *
 * One consolidated bill per tenant: rent payable to the property
 * manager, that room's own electricity (CEB) and water (NWSDB) meters
 * paid separately to each supplier, the deposit position, and the two
 * preceding months of electricity and water usage.
 * ------------------------------------------------------------------ */

export interface ServiceHistoryRow {
  monthKey: string;
  electricity: number | null;
  water: number | null;
  /** Meter usage for the month — null when no record exists. */
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
  history: ServiceHistoryRow[];
}

export interface BillPdfSources {
  leaseMap: Map<ID, Lease>;
  customerMap: Map<ID, Customer>;
  roomMap: Map<ID, Room>;
  electricityRecords: ElectricityRecord[];
  waterRecords: WaterRecord[];
}

function shiftMonth(monthKey: string, offset: number): string {
  const [year, month] = monthKey.split('-').map((part) => Number.parseInt(part, 10));
  if (!Number.isFinite(year) || !Number.isFinite(month)) return monthKey;
  const date = new Date(year, month - 1 + offset, 1);
  return `${date.getFullYear()}-${`${date.getMonth() + 1}`.padStart(2, '0')}`;
}

/** Joins a bill to its lease, tenant, room and three months of separate electricity and water records. */
export function buildBillBundle(bill: Bill, sources: BillPdfSources): BillPdfBundle {
  const lease = sources.leaseMap.get(bill.lease);
  const customer = lease ? sources.customerMap.get(lease.customer) : undefined;
  const room = lease ? sources.roomMap.get(lease.room) : undefined;
  const currentMonth = monthInputValue(bill.billing_month);

  const history: ServiceHistoryRow[] = [0, -1, -2].map((offset) => {
    const monthKey = shiftMonth(currentMonth, offset);
    const elecRecord = sources.electricityRecords.find(
      (item) => (lease ? item.room === lease.room : false) && monthInputValue(item.billing_month) === monthKey
    );
    const waterRecord = sources.waterRecords.find(
      (item) => (lease ? item.room === lease.room : false) && monthInputValue(item.billing_month) === monthKey
    );
    const usage = {
      electricityUnits: elecRecord?.electricity_units !== undefined ? toNumber(elecRecord.electricity_units) : null,
      waterUnits: waterRecord?.water_units !== undefined ? toNumber(waterRecord.water_units) : null,
      electricityRate:
        elecRecord?.electricity_unit_price !== undefined && elecRecord.electricity_unit_price !== null
          ? toNumber(elecRecord.electricity_unit_price)
          : null,
      waterRate:
        waterRecord?.water_unit_price !== undefined && waterRecord.water_unit_price !== null
          ? toNumber(waterRecord.water_unit_price)
          : null
    };
    if (offset === 0) {
      return {
        monthKey,
        electricity: toNumber(bill.electricity),
        water: toNumber(bill.water),
        ...usage,
        isCurrent: true
      };
    }
    return {
      monthKey,
      electricity: elecRecord ? toNumber(elecRecord.electricity_cost) : null,
      water: waterRecord ? toNumber(waterRecord.water_cost) : null,
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
  const roomNumber = room?.room_number ?? bill.room_number ?? '—';
  const depositDeduction = toNumber(bill.deposit_deduction);
  const remainingDeposit = toNumber(bill.remaining_deposit);
  const depositPaid = lease ? toNumber(lease.deposit_paid) : null;
  const supplierAccounts = getSupplierAccounts();
  const current = history.find((row) => row.isCurrent);
  const electricityRate = current?.electricityRate ?? 0;
  const waterRate = current?.waterRate ?? 0;
  const usageLabel = (units: number | null | undefined, rate: number) =>
    units === null || units === undefined
      ? rate
        ? ` — ${formatCurrency(rate)} / unit`
        : ''
      : ` — ${formatUnits(units)} units (${formatPerDay(units, bill.billing_month)}) × ${formatCurrency(rate)}`;

  let y = drawBrandHeader(doc, {
    documentTitle: 'Monthly bill',
    reference: `Bill #${bill.id}`,
    referenceNote: `Issued ${formatDate(new Date().toISOString())}`
  });

  y = drawFieldGrid(
    doc,
    y,
    [
      {
        label: 'Billed to',
        value: tenantName(bundle),
        note: customer?.nic_number ? `NIC ${customer.nic_number}` : undefined
      },
      { label: 'Room', value: roomNumber, note: room?.room_type || undefined },
      { label: 'Billing month', value: monthLabel(monthInputValue(bill.billing_month)) },
      { label: 'Payment due', value: formatDate(bill.due_date) },
      { label: 'Status', value: titleCase(billStatus(bill)) },
      { label: 'Lease started', value: lease ? formatDate(lease.start_date) : '—' }
    ],
    3
  );

  y += 4;
  y = drawSectionTitle(doc, y, 'Rent for this month', ' ');
  y = drawTable(doc, {
    startY: y + 4,
    head: ['Description', 'Amount'],
    body: [
      [`Room rent`, formatCurrency(bill.rent)],
      depositDeduction > 0
        ? ['Monthly deposit deduction', `- ${formatCurrency(depositDeduction)}`]
        : ['Deposit deduction — stopped, minimum deposit reached', formatCurrency(0)]
    ],
    rightAlign: [1],
    columnWidths: { 1: 130 }
  });

  y = drawTotalBand(
    doc,
    y + 10,
    'Rent payable this month',
    formatCurrency(billRentDue(bill))
  );

  y = drawSectionTitle(
    doc,
    y + 16,
    'Electricity & water for this month',
    'Paid separately and directly to each supplier — not included in rent payable'
  );
  y = drawTable(doc, {
    startY: y + 4,
    head: ['Utility', 'Billed', 'Remaining'],
    body: [
      [
        `Electricity${usageLabel(current?.electricityUnits, electricityRate)}`,
        formatCurrency(bill.electricity),
        formatCurrency(billElectricityRemaining(bill))
      ],
      [
        `Water${usageLabel(current?.waterUnits, waterRate)}`,
        formatCurrency(bill.water),
        formatCurrency(billWaterRemaining(bill))
      ]
    ],
    rightAlign: [2, 3],
    columnWidths: { 1: 125, 2: 85, 3: 85 },
    fontSize: 8.4
  });

  y = drawSectionTitle(doc, y + 16, 'Deposit', ' ');
  y = drawTable(doc, {
    startY: y + 4,
    head: ['Deposit movement', 'Amount'],
    body: [
      ['Deposit originally paid', depositPaid === null ? '—' : formatCurrency(depositPaid)],
      ['Deducted this month', `- ${formatCurrency(depositDeduction)}`],
      ['Remaining deposit balance', formatCurrency(remainingDeposit)]
    ],
    rightAlign: [1],
    columnWidths: { 1: 130 },
    emphasiseLastRow: true,
    fontSize: 8.6
  });

  y = drawSectionTitle(doc, y + 16, 'Electricity & water history', ' ');
  y = drawTable(doc, {
    startY: y + 4,
    head: ['Month', 'Elec. units', 'Avg / day', 'Electricity', 'Water units', 'Avg / day', 'Water'],
    body: history.map((row) => {
      const monthValue = `${row.monthKey}-01`;
      return [
        row.isCurrent ? `${monthLabel(row.monthKey)} (this bill)` : monthLabel(row.monthKey),
        row.electricityUnits === null ? '—' : formatUnits(row.electricityUnits),
        row.electricityUnits === null ? '—' : formatPerDay(row.electricityUnits, monthValue),
        row.electricity === null ? 'Not recorded' : formatCurrency(row.electricity),
        row.waterUnits === null ? '—' : formatUnits(row.waterUnits),
        row.waterUnits === null ? '—' : formatPerDay(row.waterUnits, monthValue),
        row.water === null ? 'Not recorded' : formatCurrency(row.water)
      ];
    }),
    rightAlign: [1, 2, 3, 4, 5, 6],
    fontSize: 7.8
  });

  drawSupplierAccountsBox(doc, y + 14, [
    { label: 'LECO AC No.', value: supplierAccounts.electricityAccount || '—' },
    { label: 'NWSDB AC No.', value: supplierAccounts.waterAccount || '—' }
  ]);

  // drawParagraph(
  //   doc,
  //   y + 20,
  //   `Electricity and water are charged on this room\u2019s own meter units at this month\u2019s per-unit price (the building bill divided by all rooms\u2019 usage, unless adjusted for this room). Electricity bills are paid directly to CEB and water bills are paid directly to NWSDB; any advance credit applies strictly to that same service. ${
  //     depositDeduction > 0
  //       ? `${formatCurrency(depositDeduction)} of the rent is covered by the deposit this month; deductions stop once the deposit balance falls to the lease\u2019s minimum deposit threshold, after which the full rent is payable.`
  //       : 'The deposit balance has reached the lease\u2019s minimum deposit threshold, so no deduction applies and the full rent is payable.'
  //   } Any deposit remaining when the room is vacated is refunded after deducting repair costs.`
  // );
}

function billFilename(bundle: BillPdfBundle): string {
  const month = monthInputValue(bundle.bill.billing_month);
  return `${slugify(`${BRAND_NAME} bill ${bundle.bill.id} ${tenantName(bundle)}`)}-${month}.pdf`;
}

function buildBillDocument(bundle: BillPdfBundle): jsPDF {
  const doc = createDocument('portrait', BILL_THEME);
  renderBill(doc, bundle);
  stampFooters(
    doc,
    `${BRAND_NAME} — bill #${bundle.bill.id} · ${tenantName(bundle)} · Room ${bundle.room?.room_number ?? bundle.bill.room_number ?? '—'}`
  );
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
