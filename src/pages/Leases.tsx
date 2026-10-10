import React, { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { ClipboardListIcon, LogOutIcon, PencilIcon, PlusIcon } from 'lucide-react';
import type { Customer, Lease, Room } from '../types';
import { useCollection } from '../hooks/useResource';
import { useCrud } from '../hooks/useCrud';
import { LeaseForm } from '../components/leases/LeaseForm';
import { TerminateLeaseModal } from '../components/leases/TerminateLeaseModal';
import { ApiErrorState } from '../components/ui/ApiErrorState';
import { Badge } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import { Card, CardHeader } from '../components/ui/Card';
import { type Column, DataTable } from '../components/ui/DataTable';
import { PageHeader } from '../components/ui/PageHeader';
import { Select } from '../components/ui/Field';
import { SearchInput } from '../components/ui/SearchInput';
import { formatCurrency, formatDate } from '../utils/format';
import { depositBalance, leaseCustomerName, leaseRoomNumber, mapById } from '../utils/lookup';

export function Leases() {
  const [searchParams, setSearchParams] = useSearchParams();
  const { data: leases, loading, error, reload } = useCollection<Lease>('/api/leases/');
  const { data: rooms, reload: reloadRooms } = useCollection<Room>('/api/rooms/');
  const { data: customers } = useCollection<Customer>('/api/customers/');
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Lease | null>(null);
  const [terminating, setTerminating] = useState<Lease | null>(null);
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState('active');

  const crud = useCrud<Lease>('leases', {
    label: 'Lease',
    onDone: () => {
      reload();
      reloadRooms();
      setFormOpen(false);
      setEditing(null);
    }
  });

  useEffect(() => {
    if (searchParams.get('new') === '1') {
      setEditing(null);
      setFormOpen(true);
      searchParams.delete('new');
      setSearchParams(searchParams, { replace: true });
    }
  }, [searchParams, setSearchParams]);

  const customerMap = useMemo(() => mapById(customers), [customers]);
  const roomMap = useMemo(() => mapById(rooms), [rooms]);
  const activeLeases = useMemo(() => leases.filter((lease) => lease.is_active), [leases]);

  const decorated = useMemo(
    () =>
    leases.map((lease) => ({
      ...lease,
      customer_name: leaseCustomerName(lease, customerMap),
      room_number: leaseRoomNumber(lease, roomMap)
    })),
    [leases, customerMap, roomMap]
  );

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return decorated.filter((lease) => {
      const matchesStatus =
      status === 'all' || (status === 'active' ? lease.is_active : !lease.is_active);
      const matchesQuery =
      !needle ||
      `${lease.customer_name} ${lease.room_number} ${lease.id}`.toLowerCase().includes(needle);
      return matchesStatus && matchesQuery;
    });
  }, [decorated, query, status]);

  const columns: Column<Lease>[] = [
  {
    key: 'customer',
    header: 'Tenant',
    primary: true,
    render: (lease) =>
    <div>
          <span className="font-medium text-ink">{lease.customer_name}</span>
          <span className="ml-2 text-[12px] text-ink-soft">Lease #{lease.id}</span>
        </div>

  },
  { key: 'room', header: 'Room', render: (lease) => <span className="text-ink">{lease.room_number}</span> },
  {
    key: 'period',
    header: 'Period',
    render: (lease) =>
    <span className="whitespace-nowrap text-ink-muted">
          {formatDate(lease.start_date)} → {lease.end_date ? formatDate(lease.end_date) : 'ongoing'}
        </span>

  },
  { key: 'rent', header: 'Rent', align: 'right', render: (lease) => formatCurrency(lease.rent_fee) },
  {
    key: 'deposit',
    header: 'Deposit left',
    align: 'right',
    render: (lease) =>
    <span className="whitespace-nowrap">
          <span className="font-medium text-ink">{formatCurrency(depositBalance(lease))}</span>
          <span className="ml-1 text-[12px] text-ink-soft">of {formatCurrency(lease.deposit_paid)}</span>
        </span>

  },
  {
    key: 'deduction',
    header: 'Monthly deduction',
    align: 'right',
    render: (lease) =>
    lease.is_active && depositBalance(lease) <= 0 ?
    <Badge tone="warn">Stopped · full rent</Badge> :

    formatCurrency(lease.monthly_deposit_deduction)

  },
  {
    key: 'status',
    header: 'Status',
    render: (lease) =>
    lease.is_active ?
    <Badge tone="success">Active</Badge> :

    <Badge>
            Terminated
            {typeof lease.final_deposit_refund === 'number' ?
      ` · refunded ${formatCurrency(lease.final_deposit_refund)}` :
      ''}
          </Badge>

  }];


  return (
    <div className="space-y-5">
      <PageHeader
        title="Leases"
        description="Assign a customer to a room, track the deposit balance, and terminate with a move-out repair cost."
        actions={
        <Button
          icon={PlusIcon}
          onClick={() => {
            setEditing(null);
            setFormOpen(true);
          }}>
          
            Assign room
          </Button>
        } />
      

      <Card>
        <CardHeader
          title={`${filtered.length} ${filtered.length === 1 ? 'lease' : 'leases'}`}
          description={`${activeLeases.length} currently active across ${rooms.length} rooms.`}
          actions={
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
              <SearchInput value={query} onChange={setQuery} placeholder="Search tenant or room" />
              <Select
              aria-label="Filter leases"
              value={status}
              onChange={(event) => setStatus(event.target.value)}
              className="sm:w-40">
              
                <option value="active">Active only</option>
                <option value="terminated">Terminated</option>
                <option value="all">All leases</option>
              </Select>
            </div>
          } />
        
        {error ?
        <ApiErrorState error={error} onRetry={reload} /> :

        <DataTable
          columns={columns}
          rows={filtered}
          keyOf={(lease) => lease.id}
          loading={loading}
          emptyTitle={leases.length ? 'No leases match this filter' : 'No leases yet'}
          emptyDescription={
          leases.length ?
          'Switch the status filter or clear your search.' :
          'Assign a customer to a vacant room to create the first lease.'
          }
          emptyAction={
          leases.length ? undefined :
          <Button icon={ClipboardListIcon} onClick={() => setFormOpen(true)}>
                  Assign room
                </Button>

          }
          rowActions={(lease) =>
          <>
                <Button
              variant="secondary"
              size="sm"
              icon={PencilIcon}
              onClick={() => {
                setEditing(lease);
                setFormOpen(true);
              }}>
              
                  Edit
                </Button>
                {lease.is_active &&
            <Button
              variant="ghost"
              size="sm"
              icon={LogOutIcon}
              className="text-danger-600 hover:bg-danger-50 hover:text-danger-700"
              onClick={() => setTerminating(lease)}>
              
                    Terminate
                  </Button>
            }
              </>
          } />

        }
      </Card>

      <LeaseForm
        open={formOpen}
        lease={editing}
        rooms={rooms}
        customers={customers}
        activeLeases={activeLeases}
        pending={crud.pending}
        error={crud.error}
        onClose={() => {
          setFormOpen(false);
          setEditing(null);
          crud.setError(null);
        }}
        onSubmit={(payload) => editing ? crud.update(editing.id, payload) : crud.create(payload)} />
      

      <TerminateLeaseModal
        open={Boolean(terminating)}
        lease={terminating}
        onClose={() => setTerminating(null)}
        onDone={() => {
          reload();
          reloadRooms();
        }} />
      
    </div>);

}