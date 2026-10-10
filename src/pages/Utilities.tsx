import React, { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { GaugeIcon, PencilIcon, PlusIcon, Trash2Icon } from 'lucide-react';
import type { Lease, Room, UtilityRecord } from '../types';
import { useCollection } from '../hooks/useResource';
import { useCrud } from '../hooks/useCrud';
import { UtilityCell } from '../components/utilities/UtilityCell';
import { UtilityForm } from '../components/utilities/UtilityForm';
import { ApiErrorState } from '../components/ui/ApiErrorState';
import { Button } from '../components/ui/Button';
import { Card, CardHeader } from '../components/ui/Card';
import { ConfirmDialog } from '../components/ui/ConfirmDialog';
import { type Column, DataTable } from '../components/ui/DataTable';
import { Field, Input } from '../components/ui/Field';
import { PageHeader } from '../components/ui/PageHeader';
import { firstOfCurrentMonth, formatCurrency, formatMonth, monthInputValue, toNumber } from '../utils/format';
import { mapById } from '../utils/lookup';

export function Utilities() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [month, setMonth] = useState(monthInputValue(firstOfCurrentMonth()));
  const { data: records, loading, error, reload } = useCollection<UtilityRecord>('/api/utilities/');
  const { data: rooms } = useCollection<Room>('/api/rooms/');
  const { data: leases } = useCollection<Lease>('/api/leases/');
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<UtilityRecord | null>(null);
  const [deleting, setDeleting] = useState<UtilityRecord | null>(null);

  const crud = useCrud<UtilityRecord>('utilities', {
    label: 'Utility record',
    onDone: () => {
      reload();
      setFormOpen(false);
      setEditing(null);
      setDeleting(null);
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

  const roomMap = useMemo(() => mapById(rooms), [rooms]);
  const selectedMonth = `${month}-01`;

  const monthRecords = useMemo(
    () =>
    records.
    filter((record) => monthInputValue(record.billing_month) === month).
    map((record) => ({
      ...record,
      room_number: record.room_number ?? roomMap.get(record.room)?.room_number ?? `#${record.room}`
    })),
    [records, month, roomMap]
  );

  const missingRooms = useMemo(() => {
    const covered = new Set(monthRecords.map((record) => record.room));
    return leases.
    filter((lease) => lease.is_active && !covered.has(lease.room)).
    map((lease) => roomMap.get(lease.room)?.room_number ?? `#${lease.room}`);
  }, [leases, monthRecords, roomMap]);

  const totals = useMemo(
    () => ({
      electricity: monthRecords.reduce((sum, record) => sum + toNumber(record.electricity_cost), 0),
      water: monthRecords.reduce((sum, record) => sum + toNumber(record.water_cost), 0)
    }),
    [monthRecords]
  );

  const columns: Column<UtilityRecord>[] = [
  {
    key: 'room',
    header: 'Room',
    primary: true,
    render: (record) => <span className="font-medium text-ink">Room {record.room_number}</span>
  },
  { key: 'month', header: 'Billing month', render: (record) => <span className="text-ink-muted">{formatMonth(record.billing_month)}</span> },
  {
    key: 'electricity',
    header: 'Electricity',
    align: 'right',
    render: (record) =>
    <UtilityCell
      cost={record.electricity_cost}
      units={record.electricity_units}
      rate={roomMap.get(record.room)?.electricity_unit_price} />


  },
  {
    key: 'water',
    header: 'Water',
    align: 'right',
    render: (record) =>
    <UtilityCell cost={record.water_cost} units={record.water_units} rate={roomMap.get(record.room)?.water_unit_price} />

  },
  {
    key: 'total',
    header: 'Total',
    align: 'right',
    render: (record) =>
    <span className="font-semibold text-ink">
          {formatCurrency(toNumber(record.electricity_cost) + toNumber(record.water_cost))}
        </span>

  }];


  return (
    <div className="space-y-5">
      <PageHeader
        title="Utilities"
        description="Enter each room's monthly meter units. Costs use that room's own electricity and water rates and flow into the monthly bill."
        actions={
        <Button
          icon={PlusIcon}
          onClick={() => {
            setEditing(null);
            setFormOpen(true);
          }}>
          
            Enter utilities
          </Button>
        } />
      

      <div className="grid gap-4 lg:grid-cols-[1fr_auto] lg:items-end">
        <div className="grid gap-4 sm:grid-cols-3">
          <div className="rounded-xl border border-line bg-surface p-4 shadow-card">
            <p className="text-[13px] text-ink-muted">Electricity · {formatMonth(selectedMonth)}</p>
            <p className="mt-1.5 text-[22px] font-semibold tracking-[-0.02em] text-ink">{formatCurrency(totals.electricity)}</p>
          </div>
          <div className="rounded-xl border border-line bg-surface p-4 shadow-card">
            <p className="text-[13px] text-ink-muted">Water · {formatMonth(selectedMonth)}</p>
            <p className="mt-1.5 text-[22px] font-semibold tracking-[-0.02em] text-ink">{formatCurrency(totals.water)}</p>
          </div>
          <div className="rounded-xl border border-line bg-surface p-4 shadow-card">
            <p className="text-[13px] text-ink-muted">Rooms recorded</p>
            <p className="mt-1.5 text-[22px] font-semibold tracking-[-0.02em] text-ink">
              {monthRecords.length}
              <span className="ml-1 text-[13px] font-normal text-ink-soft">of {rooms.length}</span>
            </p>
          </div>
        </div>
        <Field label="Filter month" htmlFor="utilities_month" className="lg:w-48">
          <Input id="utilities_month" type="month" value={month} onChange={(event) => setMonth(event.target.value)} />
        </Field>
      </div>

      {missingRooms.length > 0 &&
      <div className="rounded-xl border border-warn-100 bg-warn-50 px-4 py-3 text-[13px] leading-relaxed text-warn-700">
          Missing readings for {formatMonth(selectedMonth)} in occupied room{missingRooms.length > 1 ? 's' : ''}{' '}
          <span className="font-semibold">{missingRooms.join(', ')}</span>. Enter them before generating bills.
        </div>
      }

      <Card>
        <CardHeader
          title={`Utility records · ${formatMonth(selectedMonth)}`}
          description={`${monthRecords.length} record${monthRecords.length === 1 ? '' : 's'} for this month.`} />
        
        {error ?
        <ApiErrorState error={error} onRetry={reload} /> :

        <DataTable
          columns={columns}
          rows={monthRecords}
          keyOf={(record) => record.id}
          loading={loading}
          emptyTitle="No utility records for this month"
          emptyDescription="Enter electricity and water units per room so bills include them."
          emptyAction={
          <Button
            icon={GaugeIcon}
            onClick={() => {
              setEditing(null);
              setFormOpen(true);
            }}>
            
                Enter utilities
              </Button>
          }
          footer={
          monthRecords.length ?
          <span>
                  Month total:{' '}
                  <span className="font-semibold text-ink">{formatCurrency(totals.electricity + totals.water)}</span>
                </span> :
          undefined
          }
          rowActions={(record) =>
          <>
                <Button
              variant="secondary"
              size="sm"
              icon={PencilIcon}
              onClick={() => {
                setEditing(record);
                setFormOpen(true);
              }}>
              
                  Edit
                </Button>
                <Button
              variant="ghost"
              size="sm"
              icon={Trash2Icon}
              className="text-danger-600 hover:bg-danger-50 hover:text-danger-700"
              onClick={() => setDeleting(record)}>
              
                  Delete
                </Button>
              </>
          } />

        }
      </Card>

      <UtilityForm
        open={formOpen}
        record={editing}
        rooms={rooms}
        defaultMonth={selectedMonth}
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
        title="Delete utility record?"
        message={`Room ${deleting?.room_number ?? ''} · ${formatMonth(deleting?.billing_month)} will no longer contribute utilities to bills generated after this change.`}
        confirmLabel="Delete record"
        danger
        pending={crud.pending}
        onConfirm={() => deleting && crud.remove(deleting.id)}
        onClose={() => setDeleting(null)} />
      
    </div>);

}