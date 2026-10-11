import React, { useMemo, useState } from 'react';
import { PencilIcon, PlusIcon, Trash2Icon, WrenchIcon } from 'lucide-react';
import type { Customer, Lease, Room, RoomRepair } from '../types';
import { useCollection } from '../hooks/useResource';
import { useCrud } from '../hooks/useCrud';
import { RepairForm, type RepairLeaseOption } from '../components/repairs/RepairForm';
import { ApiErrorState } from '../components/ui/ApiErrorState';
import { Badge } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import { Card, CardHeader } from '../components/ui/Card';
import { ConfirmDialog } from '../components/ui/ConfirmDialog';
import { type Column, DataTable } from '../components/ui/DataTable';
import { Field, Input } from '../components/ui/Field';
import { PageHeader } from '../components/ui/PageHeader';
import { formatCurrency, formatDate, toNumber } from '../utils/format';
import { leaseCustomerName, leaseRoomNumber, mapById } from '../utils/lookup';

export function Repairs() {
  const { data: repairs, loading, error, reload } = useCollection<RoomRepair>('/api/repairs/');
  const { data: rooms } = useCollection<Room>('/api/rooms/');
  const { data: leases } = useCollection<Lease>('/api/leases/');
  const { data: customers } = useCollection<Customer>('/api/customers/');
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<RoomRepair | null>(null);
  const [deleting, setDeleting] = useState<RoomRepair | null>(null);
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');

  const crud = useCrud<RoomRepair>('repairs', {
    label: 'Repair',
    onDone: () => {
      reload();
      setFormOpen(false);
      setEditing(null);
      setDeleting(null);
    }
  });

  const roomMap = useMemo(() => mapById(rooms), [rooms]);
  const customerMap = useMemo(() => mapById(customers), [customers]);

  const leaseOptions = useMemo<RepairLeaseOption[]>(
    () =>
    leases.map((lease) => ({
      ...lease,
      customer_name: leaseCustomerName(lease, customerMap),
      room_number: leaseRoomNumber(lease, roomMap)
    })),
    [leases, customerMap, roomMap]
  );
  const leaseMap = useMemo(() => mapById(leaseOptions), [leaseOptions]);

  const decorated = useMemo(
    () =>
    repairs.map((repair) => {
      const lease = repair.lease !== undefined ? leaseMap.get(repair.lease) : undefined;
      const room = repair.room !== undefined ? roomMap.get(repair.room) : undefined;
      return {
        ...repair,
        customer_name: repair.customer_name ?? lease?.customer_name,
        room_number: repair.room_number ?? lease?.room_number ?? room?.room_number ?? '—'
      };
    }),
    [repairs, leaseMap, roomMap]
  );

  const filtered = useMemo(
    () =>
    decorated.filter((repair) => {
      const date = repair.repair_date ?? '';
      return (!from || date >= from) && (!to || date <= to);
    }),
    [decorated, from, to]
  );

  const total = filtered.reduce((sum, repair) => sum + toNumber(repair.repair_cost), 0);

  const columns: Column<RoomRepair>[] = [
  {
    key: 'room',
    header: 'Room',
    primary: true,
    render: (repair) =>
    <div>
          <span className="font-medium text-ink">Room {repair.room_number}</span>
          {repair.customer_name && <span className="ml-2 text-[12px] text-ink-soft">{repair.customer_name}</span>}
        </div>

  },
  {
    key: 'description',
    header: 'Description',
    render: (repair) => <span className="text-ink-muted">{repair.repair_description || '—'}</span>
  },
  {
    key: 'date',
    header: 'Date',
    render: (repair) => <span className="whitespace-nowrap text-ink-muted">{formatDate(repair.repair_date)}</span>
  },
  {
    key: 'cost',
    header: 'Cost',
    align: 'right',
    render: (repair) => <span className="font-semibold text-ink">{formatCurrency(repair.repair_cost)}</span>
  },
  {
    key: 'deposit',
    header: 'Deposit',
    render: (repair) =>
    repair.deducted_from_deposit ?
    <Badge tone="success">Deducted</Badge> :

    <Badge tone="warn">Due at move-out</Badge>

  }];


  return (
    <div className="space-y-5">
      <PageHeader
        title="Room repairs"
        description="Repairs are logged against a tenant's lease and automatically deducted from their remaining deposit when they leave the room."
        actions={
        <Button
          icon={PlusIcon}
          onClick={() => {
            setEditing(null);
            setFormOpen(true);
          }}>
          
            Log repair
          </Button>
        } />
      

      <Card>
        <CardHeader
          title={`${filtered.length} ${filtered.length === 1 ? 'repair' : 'repairs'}`}
          description={`Total cost in range: ${formatCurrency(total)}`}
          actions={
          <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
              <Field label="From" htmlFor="repairs_from" className="sm:w-40">
                <Input id="repairs_from" type="date" value={from} onChange={(event) => setFrom(event.target.value)} />
              </Field>
              <Field label="To" htmlFor="repairs_to" className="sm:w-40">
                <Input id="repairs_to" type="date" value={to} onChange={(event) => setTo(event.target.value)} />
              </Field>
            </div>
          } />
        
        {error ?
        <ApiErrorState error={error} onRetry={reload} /> :

        <DataTable
          columns={columns}
          rows={filtered}
          keyOf={(repair) => repair.id}
          loading={loading}
          emptyTitle={repairs.length ? 'No repairs in this range' : 'No repairs logged'}
          emptyDescription={
          repairs.length ? 'Clear the date filters to see all repairs.' : 'Log maintenance work to keep the profit report accurate.'
          }
          emptyAction={
          repairs.length ? undefined :
          <Button icon={WrenchIcon} onClick={() => setFormOpen(true)}>
                  Log repair
                </Button>

          }
          footer={
          filtered.length ?
          <span>
                  Total: <span className="font-semibold text-ink">{formatCurrency(total)}</span>
                </span> :
          undefined
          }
          rowActions={(repair) =>
          <>
                <Button
              variant="secondary"
              size="sm"
              icon={PencilIcon}
              onClick={() => {
                setEditing(repair);
                setFormOpen(true);
              }}>
              
                  Edit
                </Button>
                <Button
              variant="ghost"
              size="sm"
              icon={Trash2Icon}
              className="text-danger-600 hover:bg-danger-50 hover:text-danger-700"
              onClick={() => setDeleting(repair)}>
              
                  Delete
                </Button>
              </>
          } />

        }
      </Card>

      <RepairForm
        open={formOpen}
        repair={editing}
        leases={leaseOptions}
        pending={crud.pending}
        error={crud.error}
        onClose={() => {
          setFormOpen(false);
          setEditing(null);
          crud.setError(null);
        }}
        onSubmit={(payload) => editing ? crud.update(editing.id, payload) : crud.create(payload)} />
      

      <ConfirmDialog
        open={Boolean(deleting)}
        title="Delete repair record?"
        message={`${formatCurrency(deleting?.repair_cost ?? 0)} logged for room ${deleting?.room_number ?? ''} will be removed from repair and profit reports.`}
        confirmLabel="Delete repair"
        danger
        pending={crud.pending}
        onConfirm={() => deleting && crud.remove(deleting.id)}
        onClose={() => setDeleting(null)} />
      
    </div>);

}