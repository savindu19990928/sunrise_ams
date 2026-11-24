import type { jsPDF } from 'jspdf';
import type { Bill, Customer, ElectricityRecord, ID, Lease, LeaveRoomResult, Room, WaterRecord } from '../types';
import { formatCurrency, formatDate, formatMonth, monthInputValue, titleCase, toNumber } from './format';
import {
  billDueDate,
  billElectricityRemaining,
  billOutstanding,
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
  const dueDateValue = billDueDate(bill);
  const leaseStart = bill.lease_start_date ?? lease?.start_date;
  const leaseEnd = bill.lease_end_date ?? lease?.end_date;
  const expectedEndRefund =
    bill.deposit_refund_at_end_date !== undefined && bill.deposit_refund_at_end_date !== null
      ? toNumber(bill.deposit_refund_at_end_date)
      : lease?.expected_deposit_refund_at_end_date !== undefined && lease?.expected_deposit_refund_at_end_date !== null
        ? toNumber(lease.expected_deposit_refund_at_end_date)
        : remainingDeposit;
  const moveOutRepairs = toNumber(bill.move_out_repair_cost);
  const regularRepairs = toNumber(bill.regular_room_repair_cost);
  const totalRoomRepairs = toNumber(bill.room_repair_cost);
  const hasClosingRepairs = moveOutRepairs > 0 || regularRepairs > 0 || totalRoomRepairs > 0;
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
      {
        label: 'Room payment due',
        value: formatDate(dueDateValue),
        note: bill.is_overdue && billOutstanding(bill) > 0 ? `${bill.days_overdue ?? 0} days overdue` : undefined
      },
      { label: 'Status', value: titleCase(billStatus(bill)) },
      {
        label: 'Lease period',
        value: leaseStart ? `${formatDate(leaseStart)} to ${leaseEnd ? formatDate(leaseEnd) : '—'}` : '—'
      }
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
    rightAlign: [1, 2],
    columnWidths: { 1: 85, 2: 85 },
    fontSize: 8.4
  });

  y = drawSectionTitle(doc, y + 16, 'Deposit', ' ');
  y = drawTable(doc, {
    startY: y + 4,
    head: ['Deposit movement', 'Amount'],
    body: [
      ['Deposit originally paid', depositPaid === null ? '—' : formatCurrency(depositPaid)],
      ['Deducted this month', `- ${formatCurrency(depositDeduction)}`],
      ['Remaining deposit balance', formatCurrency(remainingDeposit)],
      ['Expected deposit refund at lease end', formatCurrency(expectedEndRefund)]
    ],
    rightAlign: [1],
    columnWidths: { 1: 130 },
    emphasiseLastRow: true,
    fontSize: 8.6
  });

  if (hasClosingRepairs) {
    y = drawSectionTitle(doc, y + 16, 'Room repairs', 'Deducted at lease end / termination');
    y = drawTable(doc, {
      startY: y + 4,
      head: ['Repair category', 'Amount'],
      body: [
        ['Move-out special repairs', formatCurrency(moveOutRepairs)],
        ['Regular tenancy repairs', formatCurrency(regularRepairs)],
        ['Total room repair cost', formatCurrency(totalRoomRepairs || moveOutRepairs + regularRepairs)]
      ],
      rightAlign: [1],
      columnWidths: { 1: 130 },
      emphasiseLastRow: true,
      fontSize: 8.6
    });
  }

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

function buildClosingBillDocument(result: LeaveRoomResult): jsPDF {
  const billData = result.bill_data;
  const leaseId = result.lease_id ?? billData?.lease_id ?? '—';
  const roomNumber = result.room_number ?? '—';
  const customerNameText = result.customer_name ?? `Lease #${leaseId}`;
  const terminationType = billData?.termination_type ?? result.termination_type ?? 'terminated';
  const endDate = billData?.lease_end_date ?? result.lease_end_date;
  const startDate = billData?.lease_start_date;

  const depositBefore = toNumber(billData?.deposit_before_repairs ?? result.deposit_before_repairs);
  const moveOutCost = toNumber(billData?.move_out_repair_cost ?? result.move_out_repair_cost);
  const regularCost = toNumber(billData?.regular_room_repair_cost ?? result.regular_room_repair_cost);
  const totalRepairs = toNumber(
    billData?.total_repairs_deducted ?? billData?.room_repair_cost ?? result.total_repairs_deducted
  );
  const finalRefund = toNumber(
    billData?.final_deposit_refund ?? billData?.deposit_refund ?? result.final_deposit_refund
  );
  const owedByCustomer = toNumber(billData?.amount_owed_by_customer ?? result.amount_owed_by_customer);

  const payableManager = toNumber(billData?.payable_to_property_manager);
  const payableElec = toNumber(billData?.payable_to_electricity_supplier);
  const payableWater = toNumber(billData?.payable_to_water_supplier);
  const totalOutstanding = toNumber(
    billData?.total_outstanding_fee ?? payableManager + payableElec + payableWater
  );

  const supplierAccounts = getSupplierAccounts();
  const doc = createDocument('portrait', BILL_THEME);

  let y = drawBrandHeader(doc, {
    documentTitle: terminationType === 'end_date_reached' ? 'Lease end closing bill' : 'Lease termination closing bill',
    reference: `Lease #${leaseId}`,
    referenceNote: `Issued ${formatDate(new Date().toISOString())}`
  });

  y = drawFieldGrid(
    doc,
    y,
    [
      { label: 'Billed to', value: customerNameText },
      { label: 'Room', value: roomNumber },
      {
        label: 'Settlement type',
        value: terminationType === 'end_date_reached' ? 'End date reached' : 'Early termination'
      },
      {
        label: 'Lease period',
        value: startDate
          ? `${formatDate(startDate)} to ${endDate ? formatDate(endDate) : '—'}`
          : endDate
            ? `Ended ${formatDate(endDate)}`
            : '—'
      }
    ],
    2
  );

  y += 4;
  y = drawSectionTitle(doc, y, 'Deposit & room repairs settlement', ' ');
  const settlementRows: (string | number)[][] = [
    ['Deposit balance before repairs', formatCurrency(depositBefore)],
    ['Move-out special room repairs', `- ${formatCurrency(moveOutCost)}`],
    ['Regular tenancy repairs', `- ${formatCurrency(regularCost)}`],
    ['Total repairs deducted', `- ${formatCurrency(totalRepairs)}`]
  ];
  if (owedByCustomer > 0) {
    settlementRows.push(['Balance owed by customer for repairs', formatCurrency(owedByCustomer)]);
  }
  settlementRows.push(['Final deposit refund', formatCurrency(finalRefund)]);

  y = drawTable(doc, {
    startY: y + 4,
    head: ['Item', 'Amount'],
    body: settlementRows,
    rightAlign: [1],
    columnWidths: { 1: 140 },
    emphasiseLastRow: true
  });

  y = drawTotalBand(
    doc,
    y + 10,
    owedByCustomer > 0 ? 'Repair shortfall owed by customer' : 'Final deposit refund',
    formatCurrency(owedByCustomer > 0 ? owedByCustomer : finalRefund)
  );

  const repairRows: string[][] = [];
  if (result.move_out_repairs?.length || result.regular_room_repairs?.length) {
    for (const item of result.move_out_repairs ?? []) {
      repairRows.push([
        'Move-out special',
        item.description || 'Move-out repair',
        item.date_recorded ? formatDate(item.date_recorded) : '—',
        formatCurrency(item.cost)
      ]);
    }
    for (const item of result.regular_room_repairs ?? []) {
      repairRows.push([
        'Regular repair',
        item.description || 'Room repair',
        item.date_logged ? formatDate(item.date_logged) : '—',
        formatCurrency(item.cost)
      ]);
    }
  } else {
    for (const item of result.deducted_repairs ?? []) {
      repairRows.push([
        item.repair_category === 'move_out_repair' ? 'Move-out special' : 'Regular repair',
        item.description || 'Repair',
        item.date_recorded || item.date_logged ? formatDate(item.date_recorded ?? item.date_logged) : '—',
        formatCurrency(item.cost)
      ]);
    }
  }

  if (repairRows.length > 0) {
    y = drawSectionTitle(doc, y + 16, 'Deducted repairs itemization', ' ');
    y = drawTable(doc, {
      startY: y + 4,
      head: ['Category', 'Description', 'Date', 'Cost'],
      body: repairRows,
      rightAlign: [3],
      columnWidths: { 0: 95, 2: 75, 3: 85 },
      fontSize: 8.4
    });
  }

  y = drawSectionTitle(
    doc,
    y + 16,
    'Outstanding balances across recipients',
    'Rent goes to property manager; electricity & water go directly to suppliers'
  );
  y = drawTable(doc, {
    startY: y + 4,
    head: ['Recipient', 'Outstanding'],
    body: [
      ['Property manager (room rent)', formatCurrency(payableManager)],
      ['Electricity supplier (LECO)', formatCurrency(payableElec)],
      ['Water supplier (NWSDB)', formatCurrency(payableWater)],
      ['Total outstanding across all 3 recipients', formatCurrency(totalOutstanding)]
    ],
    rightAlign: [1],
    columnWidths: { 1: 140 },
    emphasiseLastRow: true,
    fontSize: 8.6
  });

  drawSupplierAccountsBox(doc, y + 14, [
    { label: 'LECO AC No.', value: supplierAccounts.electricityAccount || '—' },
    { label: 'NWSDB AC No.', value: supplierAccounts.waterAccount || '—' }
  ]);

  stampFooters(doc, `${BRAND_NAME} — closing bill · Lease #${leaseId} · Room ${roomNumber}`);
  return doc;
}

export function downloadClosingBillPdf(result: LeaveRoomResult): void {
  const leaseId = result.lease_id ?? result.bill_data?.lease_id ?? 'closing';
  const name = result.customer_name ?? `lease-${leaseId}`;
  savePdf(buildClosingBillDocument(result), slugify(`${BRAND_NAME} closing bill ${leaseId} ${name}`));
}

export function previewClosingBillPdf(result: LeaveRoomResult): void {
  const leaseId = result.lease_id ?? result.bill_data?.lease_id ?? '';
  previewPdf(buildClosingBillDocument(result), `${BRAND_NAME} — Closing Bill #${leaseId}`);
}

export function printClosingBillPdf(result: LeaveRoomResult): void {
  const leaseId = result.lease_id ?? result.bill_data?.lease_id ?? '';
  printPdf(buildClosingBillDocument(result), `${BRAND_NAME} — Closing Bill #${leaseId}`);
}
