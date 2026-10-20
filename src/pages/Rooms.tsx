import React, { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { BedDoubleIcon, PlusIcon } from 'lucide-react';
import type { Customer, ID, Lease, Room } from '../types';
import { useCollection } from '../hooks/useResource';
import { useCrud } from '../hooks/useCrud';
import { RoomCard } from '../components/rooms/RoomCard';
import { RoomForm } from '../components/rooms/RoomForm';
import { ApiErrorState } from '../components/ui/ApiErrorState';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { ConfirmDialog } from '../components/ui/ConfirmDialog';
import { PageHeader } from '../components/ui/PageHeader';
import { Select } from '../components/ui/Field';
import { SearchInput } from '../components/ui/SearchInput';
import { EmptyState, LoadingState } from '../components/ui/States';
import { customerName, mapById, roomStatus } from '../utils/lookup';

export function Rooms() {
  const [searchParams, setSearchParams] = useSearchParams();
  const { data: rooms, loading, error, reload } = useCollection<Room>('/api/rooms/');
  const { data: leases, reload: reloadLeases } = useCollection<Lease>('/api/leases/');
  const { data: customers } = useCollection<Customer>('/api/customers/');
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Room | null>(null);
  const [deleting, setDeleting] = useState<Room | null>(null);
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState('all');

  const crud = useCrud<Room>('rooms', {
    label: 'Room',
    onDone: () => {
      reload();
      setFormOpen(false);
      setEditing(null);
      setDeleting(null);
    }
  });

  const leaseCrud = useCrud<Lease>('leases', { label: 'Active lease', onDone: reloadLeases });

  const customerMap = useMemo(() => mapById(customers), [customers]);

  const activeLeaseByRoom = useMemo(() => {
    const map = new Map<ID, Lease>();
    for (const lease of leases) {
      if (lease.is_active) {
        map.set(lease.room, lease);
      }
    }
    return map;
  }, [leases]);

  const activeRoomIds = useMemo(() => new Set<ID>(activeLeaseByRoom.keys()), [activeLeaseByRoom]);

  const activeLease = useMemo(
    () => (editing ? activeLeaseByRoom.get(editing.id) ?? null : null),
    [editing, activeLeaseByRoom]
  );

  const activeLeaseName = useMemo(() => {
    if (!activeLease) return null;
    return activeLease.customer_name ?? customerName(customerMap.get(activeLease.customer));
  }, [activeLease, customerMap]);

  const handleSubmit = async (payload: Record<string, unknown>, applyToActiveLease: boolean) => {
    if (!editing) {
      await crud.create(payload);
      return;
    }
    const saved = await crud.update(editing.id, payload);
    if (!saved || !applyToActiveLease || !activeLease) return;
    await leaseCrud.update(activeLease.id, {
      rent_fee: payload.base_rent_fee,
      monthly_deposit_deduction: payload.monthly_deposit_deduction
    });
  };

  useEffect(() => {
    if (searchParams.get('new') === '1') {
      setEditing(null);
      setFormOpen(true);
      searchParams.delete('new');
      setSearchParams(searchParams, { replace: true });
    }
  }, [searchParams, setSearchParams]);

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return rooms.filter((room) => {
      const matchesQuery =
        !needle ||
        String(room.room_number ?? '').toLowerCase().includes(needle) ||
        String(room.room_type ?? '').toLowerCase().includes(needle);
      const currentStatus = roomStatus(room, activeRoomIds);
      const matchesStatus = status === 'all' || currentStatus === status;
      return matchesQuery && matchesStatus;
    });
  }, [rooms, query, status, activeRoomIds]);

  const counts = useMemo(
    () => {
      const occupied = rooms.filter((room) => activeRoomIds.has(room.id)).length;
      return {
        total: rooms.length,
        occupied,
        vacant: rooms.length - occupied
      };
    },
    [rooms, activeRoomIds]
  );

  return (
    <div className="space-y-5">
      <PageHeader
        title="Rooms"
        description="Room configuration drives rent, deposits and the monthly deposit deduction applied to every bill."
        actions={
          <Button
            icon={PlusIcon}
            onClick={() => {
              setEditing(null);
              setFormOpen(true);
            }}>
            Add room
          </Button>
        }
      />

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-[13px] text-ink-muted">
          <span className="font-medium text-ink">{counts.total}</span> rooms · {counts.occupied} occupied ·{' '}
          {counts.vacant} vacant
        </p>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <SearchInput value={query} onChange={setQuery} placeholder="Search room or type" />
          <Select
            aria-label="Filter by status"
            value={status}
            onChange={(event) => setStatus(event.target.value)}
            className="sm:w-44">
            <option value="all">All statuses</option>
            <option value="vacant">Vacant</option>
            <option value="occupied">Occupied</option>
          </Select>
        </div>
      </div>

      {loading ?
      <Card>
          <LoadingState label="Loading rooms…" rows={5} />
        </Card> :
      error ?
      <Card>
          <ApiErrorState error={error} onRetry={reload} />
        </Card> :
      filtered.length === 0 ?
      <Card>
          <EmptyState
          icon={BedDoubleIcon}
          title={rooms.length ? 'No rooms match this filter' : 'No rooms yet'}
          description={
          rooms.length ?
          'Try a different search term or status filter.' :
          'Add your first room to start assigning leases and generating bills.'
          }
          action={
          rooms.length ? undefined :
          <Button
            icon={PlusIcon}
            onClick={() => {
              setEditing(null);
              setFormOpen(true);
            }}>
            
                  Add room
                </Button>

          } />
        
        </Card> :

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
        {filtered.map((room) => {
          const lease = activeLeaseByRoom.get(room.id);
          const tenant = lease ? (lease.customer_name ?? customerName(customerMap.get(lease.customer))) : null;
          return (
            <RoomCard
              key={room.id}
              room={room}
              status={roomStatus(room, activeRoomIds)}
              tenantName={tenant}
              onEdit={(next) => {
                setEditing(next);
                setFormOpen(true);
              }}
              onDelete={setDeleting}
            />
          );
        })}
      </div>
      }

      <RoomForm
        open={formOpen}
        room={editing}
        pending={crud.pending || leaseCrud.pending}
        error={crud.error}
        activeLeaseName={activeLeaseName}
        onClose={() => {
          setFormOpen(false);
          setEditing(null);
          crud.setError(null);
        }}
        onSubmit={handleSubmit} />
      

      <ConfirmDialog
        open={Boolean(deleting)}
        title={`Delete room ${deleting?.room_number ?? ''}?`}
        message="This removes the room configuration. Leases and bills already recorded against it are not deleted."
        confirmLabel="Delete room"
        danger
        pending={crud.pending}
        onConfirm={() => deleting && crud.remove(deleting.id)}
        onClose={() => setDeleting(null)} />
      
    </div>);

}