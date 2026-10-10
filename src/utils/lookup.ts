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

/**
 * Deduction the next bill will apply: the fixed monthly amount while a
 * deposit balance remains (capped at that balance), otherwise 0 — at which
 * point the tenant pays the full rent.
 */
export function nextDeduction(lease: Lease | undefined | null): number {
  if (!lease) return 0;
  const balance = depositBalance(lease);
  if (balance <= 0) return 0;
  return Math.min(Number(lease.monthly_deposit_deduction ?? 0), balance);
}

export function billOutstanding(bill: Bill): number {
  return Math.max(0, Number(bill.total_due ?? 0) - Number(bill.amount_paid ?? 0));
}

/**
 * Bills are not guaranteed to carry a `status` field — derive it from the
 * amounts whenever the API omits it so the UI never reads an undefined value.
 */
export function billStatus(bill: Bill): BillStatus {
  if (bill.status === 'paid' || bill.status === 'partial' || bill.status === 'unpaid') return bill.status;
  const total = Number(bill.total_due ?? 0);
  const paid = Number(bill.amount_paid ?? 0);
  if (total > 0 && paid >= total) return 'paid';
  if (paid > 0) return 'partial';
  return 'unpaid';
}