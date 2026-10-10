import { useCallback, useMemo } from 'react';
import type { Bill, Customer, Lease, Room } from '../types';
import { billStatus, leaseCustomerName, leaseRoomNumber, mapById } from '../utils/lookup';
import { useCollection } from './useResource';

/**
 * Bills joined with lease / customer / room context so every billing screen can
 * show who a bill belongs to, whether or not the API denormalizes those fields.
 */
export function useBillingData() {
  const bills = useCollection<Bill>('/api/bills/');
  const leases = useCollection<Lease>('/api/leases/');
  const customers = useCollection<Customer>('/api/customers/');
  const rooms = useCollection<Room>('/api/rooms/');

  const leaseMap = useMemo(() => mapById(leases.data), [leases.data]);
  const customerMap = useMemo(() => mapById(customers.data), [customers.data]);
  const roomMap = useMemo(() => mapById(rooms.data), [rooms.data]);

  const decoratedBills = useMemo(
    () =>
    bills.data.map((bill) => {
      const lease = leaseMap.get(bill.lease);
      return {
        ...bill,
        status: billStatus(bill),
        customer_name: bill.customer_name ?? (lease ? leaseCustomerName(lease, customerMap) : undefined),
        room_number: bill.room_number ?? (lease ? leaseRoomNumber(lease, roomMap) : undefined)
      };
    }),
    [bills.data, leaseMap, customerMap, roomMap]
  );

  const reloadAll = useCallback(() => {
    bills.reload();
    leases.reload();
    customers.reload();
    rooms.reload();
  }, [bills, leases, customers, rooms]);

  return {
    bills: decoratedBills,
    leases: leases.data,
    customers: customers.data,
    rooms: rooms.data,
    leaseMap,
    customerMap,
    roomMap,
    loading: bills.loading,
    error: bills.error ?? leases.error ?? null,
    reloadBills: bills.reload,
    reloadAll
  };
}