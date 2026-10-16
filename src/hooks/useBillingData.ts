import { useCallback, useMemo } from 'react';
import type { Bill, Customer, ID, Lease, Payment, Room } from '../types';
import { toNumber } from '../utils/format';
import { billRentDue, billStatus, leaseCustomerName, leaseRoomNumber, mapById } from '../utils/lookup';
import { useCollection } from './useResource';

/**
 * Bills joined with lease / customer / room context. Rent collected is summed
 * from lease payments only — utility supplier payments live in a separate ledger.
 */
export function useBillingData() {
  const bills = useCollection<Bill>('/api/bills/');
  const leases = useCollection<Lease>('/api/leases/');
  const customers = useCollection<Customer>('/api/customers/');
  const rooms = useCollection<Room>('/api/rooms/');
  const payments = useCollection<Payment>('/api/payments/');

  const leaseMap = useMemo(() => mapById(leases.data), [leases.data]);
  const customerMap = useMemo(() => mapById(customers.data), [customers.data]);
  const roomMap = useMemo(() => mapById(rooms.data), [rooms.data]);

  const paidByBill = useMemo(() => {
    const map = new Map<ID, number>();
    for (const payment of payments.data) {
      map.set(payment.bill, (map.get(payment.bill) ?? 0) + toNumber(payment.amount));
    }
    return map;
  }, [payments.data]);

  const decoratedBills = useMemo(
    () =>
    bills.data.map((bill) => {
      const lease = leaseMap.get(bill.lease);
      const rentPaid = paidByBill.get(bill.id) ?? (bill.is_paid ? billRentDue(bill) : 0);
      const withPaid: Bill = { ...bill, amount_paid: rentPaid, status: undefined };
      return {
        ...withPaid,
        status: billStatus(withPaid),
        customer_name: bill.customer_name ?? (lease ? leaseCustomerName(lease, customerMap) : undefined),
        room_number: bill.room_number ?? (lease ? leaseRoomNumber(lease, roomMap) : undefined)
      };
    }),
    [bills.data, leaseMap, customerMap, roomMap, paidByBill]
  );

  const reloadAll = useCallback(() => {
    bills.reload();
    leases.reload();
    customers.reload();
    rooms.reload();
    payments.reload();
  }, [bills, leases, customers, rooms, payments]);

  return {
    bills: decoratedBills,
    leases: leases.data,
    customers: customers.data,
    rooms: rooms.data,
    leaseMap,
    customerMap,
    roomMap,
    loading: bills.loading || payments.loading,
    error: bills.error ?? leases.error ?? null,
    reloadBills: reloadAll,
    reloadAll
  };
}