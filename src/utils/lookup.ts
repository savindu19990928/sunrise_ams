import type { Bill, BillStatus, Customer, ID, Lease, Room, RoomStatus } from '../types';

export function mapById<T extends { id: ID; }>(items: T[]): Map<ID, T> {
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
 * Threshold recorded on the lease.
 */
export function leaseThreshold(lease: Lease | undefined | null): number {
  if (lease && lease.minimum_deposit_threshold !== undefined && lease.minimum_deposit_threshold !== null) {
    return Math.max(0, Number(lease.minimum_deposit_threshold) || 0);
  }
  return 0;
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
 * Rent the tenant owes the property manager for a bill: rent less the deposit deduction.
 * Electricity and water are paid separately and directly to their respective suppliers.
 */
export function billRentDue(bill: Bill): number {
  if (bill.net_rent !== undefined && bill.net_rent !== null && bill.net_rent !== '') {
    return Math.max(0, Number(bill.net_rent) || 0);
  }
  return Math.max(0, Number(bill.rent ?? 0) - Number(bill.deposit_deduction ?? 0));
}

/** Electricity balance still payable directly to the electricity supplier (CEB). */
export function billElectricityRemaining(bill: Bill): number {
  const direct = bill.payable_to_electricity_supplier ?? bill.electricity_remaining_balance;
  if (direct !== undefined && direct !== null && direct !== '') {
    return Math.max(0, Number(direct) || 0);
  }
  return Math.max(0, Number(bill.electricity ?? 0) - Number(bill.electricity_paid ?? 0));
}

/** Water balance still payable directly to the water supplier (NWSDB). */
export function billWaterRemaining(bill: Bill): number {
  const direct = bill.payable_to_water_supplier ?? bill.water_remaining_balance;
  if (direct !== undefined && direct !== null && direct !== '') {
    return Math.max(0, Number(direct) || 0);
  }
  return Math.max(0, Number(bill.water ?? 0) - Number(bill.water_paid ?? 0));
}

/** Rent still owed on a bill to the property manager. */
export function billOutstanding(bill: Bill): number {
  if (bill.remaining_balance !== undefined && bill.remaining_balance !== null && bill.remaining_balance !== '') {
    return Math.max(0, Number(bill.remaining_balance) || 0);
  }
  return Math.max(0, billRentDue(bill) - Number(bill.amount_paid ?? 0));
}

/** Effective room rent payment due date (lease start day in the billing month). */
export function billDueDate(bill: Bill): string {
  return bill.room_payment_due_date || bill.due_date || '';
}

/**
 * Bills are not guaranteed to carry a `status` field — derive it from the
 * API status / overdue flag / amounts so the UI never reads an undefined value.
 */
export function billStatus(bill: Bill): BillStatus {
  if (
    bill.payment_status === 'paid' ||
    bill.payment_status === 'partial' ||
    bill.payment_status === 'unpaid' ||
    bill.payment_status === 'overdue'
  ) {
    return bill.payment_status;
  }
  if (bill.status === 'paid' || bill.status === 'partial' || bill.status === 'unpaid' || bill.status === 'overdue') {
    return bill.status;
  }
  const total = billRentDue(bill);
  const paid = Number(bill.amount_paid ?? 0);
  if (total > 0 && paid >= total) return 'paid';
  if (bill.is_overdue) return 'overdue';
  if (paid > 0) return 'partial';
  return 'unpaid';
}

/**
 * Rooms do not carry a `status` field on the API — occupancy is derived from
 * whether there is an active lease assigned to the room.
 */
export function roomStatus(room: Room | ID, activeLeasesOrIds: Lease[] | Set<ID>): RoomStatus {
  const id = typeof room === 'number' ? room : room.id;
  if (activeLeasesOrIds instanceof Set) {
    return activeLeasesOrIds.has(id) ? 'occupied' : 'vacant';
  }
  return activeLeasesOrIds.some((lease) => lease.room === id && lease.is_active) ? 'occupied' : 'vacant';
}
