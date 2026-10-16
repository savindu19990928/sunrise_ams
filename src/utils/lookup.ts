import type { Bill, BillStatus, Customer, ID, Lease, Room } from '../types';

export function mapById<T extends {id: ID;}>(items: T[]): Map<ID, T> {
  return new Map(items.map((item) => [item.id, item]));
}

export function customerName(customer: Customer | undefined): string {
  if (!customer) return '—';
  return `${customer.first_name} ${customer.last_name}`.trim();
}

export function leaseCustomerName(lease: Lease, customers: Map<ID, Customer>): string {
  return lease.customer_name ?? customerName(customers.get(lease.customer));
}

export function leaseRoomNumber(lease: Lease, rooms: Map<ID, Room>): string {
  return lease.room_number ?? rooms.get(lease.room)?.room_number ?? '—';
}

/** Deposit still held on a lease (supports the legacy `remaining_deposit` name). */
export function depositBalance(lease: Lease | undefined | null): number {
  if (!lease) return 0;
  return Math.max(0, Number(lease.current_deposit_balance ?? lease.remaining_deposit ?? 0));
}

/** Customer's minimum deposit threshold — deductions stop at or below it. */
export function depositThreshold(customer: Customer | undefined | null): number {
  if (!customer) return 0;
  return Math.max(0, Number(customer.minimum_deposit_threshold ?? 0) || 0);
}

/**
 * Threshold recorded on the lease. Falls back to the customer's value for
 * leases created before the threshold moved onto the lease.
 */
export function leaseThreshold(lease: Lease | undefined | null, customer?: Customer | null): number {
  if (lease && lease.minimum_deposit_threshold !== undefined && lease.minimum_deposit_threshold !== null) {
    return Math.max(0, Number(lease.minimum_deposit_threshold) || 0);
  }
  return depositThreshold(customer);
}

/**
 * Deduction the next bill will apply. Prefers the API's live value; otherwise
 * the monthly amount capped so the balance never drops below the threshold,
 * and 0 once the balance is at or below it (tenant pays full rent).
 */
export function nextDeduction(lease: Lease | undefined | null, threshold = 0): number {
  if (!lease) return 0;
  if (lease.current_applicable_deposit_deduction !== undefined && lease.current_applicable_deposit_deduction !== null) {
    return Math.max(0, Number(lease.current_applicable_deposit_deduction) || 0);
  }
  const balance = depositBalance(lease);
  if (balance <= threshold) return 0;
  return Math.min(Number(lease.monthly_deposit_deduction ?? 0), balance - threshold);
}

/**
 * Rent the tenant owes the business for a bill: rent less the deposit deduction.
 * Utilities are never part of it — tenants pay those directly to the supplier.
 */
export function billRentDue(bill: Bill): number {
  if (bill.net_rent !== undefined && bill.net_rent !== null && bill.net_rent !== '') {
    return Math.max(0, Number(bill.net_rent) || 0);
  }
  return Math.max(0, Number(bill.rent ?? 0) - Number(bill.deposit_deduction ?? 0));
}

/** Utility charges shown on a bill for reference only — settled with the supplier. */
export function billUtilities(bill: Bill): number {
  return Number(bill.electricity ?? 0) + Number(bill.water ?? 0);
}

/** Rent still owed on a bill. */
export function billOutstanding(bill: Bill): number {
  return Math.max(0, billRentDue(bill) - Number(bill.amount_paid ?? 0));
}

/**
 * Bills are not guaranteed to carry a `status` field — derive it from the
 * amounts whenever the API omits it so the UI never reads an undefined value.
 */
export function billStatus(bill: Bill): BillStatus {
  if (bill.status === 'paid' || bill.status === 'partial' || bill.status === 'unpaid') return bill.status;
  const total = billRentDue(bill);
  const paid = Number(bill.amount_paid ?? 0);
  if (total > 0 && paid >= total) return 'paid';
  if (paid > 0) return 'partial';
  return 'unpaid';
}