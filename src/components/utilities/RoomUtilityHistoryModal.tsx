import React, { useEffect, useMemo, useState } from 'react';
import type { Room, RoomPreviousReading, RoomUtilityHistory, UtilityRecord } from '../../types';
import { useResource } from '../../hooks/useResource';
import { buildQuery } from '../../utils/api';
import { formatCurrency, formatMonth, toNumber } from '../../utils/format';
import { formatUnits } from '../../utils/utilityUsage';
import { ApiErrorState } from '../ui/ApiErrorState';
import { Badge } from '../ui/Badge';
import { type Column, DataTable } from '../ui/DataTable';
import { Field, Select } from '../ui/Field';
import { Modal } from '../ui/Modal';
import { UsageCell } from './UsageCell';

interface RoomUtilityHistoryModalProps {
  open: boolean;
  rooms: Room[];
  initialRoomId?: number | null;
  onClose: () => void;
}

export function RoomUtilityHistoryModal({ open, rooms, initialRoomId, onClose }: RoomUtilityHistoryModalProps) {
  const [roomId, setRoomId] = useState('');

  useEffect(() => {
    if (open) setRoomId(initialRoomId ? String(initialRoomId) : '');
  }, [open, initialRoomId]);

  const path = open && roomId ? `/api/utilities/room-history/${buildQuery({ room_id: roomId })}` : null;
  const prevPath = open && roomId ? `/api/rooms/${roomId}/previous-readings/` : null;
  const { data, loading, error, reload } = useResource<RoomUtilityHistory | UtilityRecord[]>(path);
  const { data: prevData } = useResource<RoomPreviousReading>(prevPath);

  const records = useMemo<UtilityRecord[]>(() => {
    if (!data) return [];
    const list = Array.isArray(data) ? data : data.utility_records ?? [];
    return [...list].sort((a, b) => b.billing_month.localeCompare(a.billing_month));
  }, [data]);

  const selectedRoom = rooms.find((room) => String(room.id) === roomId);

  const columns: Column<UtilityRecord>[] = [
  {
    key: 'month',
    header: 'Month',
    primary: true,
    render: (record) => <span className="whitespace-nowrap font-medium text-ink">{formatMonth(record.billing_month)}</span>
  },
  {
    key: 'electricity',
    header: 'Electricity',
    render: (record) =>
    <UsageCell
      units={record.electricity_units}
      month={record.billing_month}
      rate={record.electricity_unit_price}
      cost={record.electricity_cost}
      previousReading={record.previous_electricity_meter_reading}
      currentReading={record.electricity_meter_reading} />


  },
  {
    key: 'water',
    header: 'Water',
    render: (record) =>
    <UsageCell
      units={record.water_units}
      month={record.billing_month}
      rate={record.water_unit_price}
      cost={record.water_cost}
      previousReading={record.previous_water_meter_reading}
      currentReading={record.water_meter_reading} />

  },
  {
    key: 'total',
    header: 'Room bill',
    align: 'right',
    render: (record) =>
    <span className="font-semibold text-ink">
          {formatCurrency(record.total_cost ?? toNumber(record.electricity_cost) + toNumber(record.water_cost))}
        </span>

  },
  {
    key: 'supplier',
    header: 'Supplier',
    render: (record) => record.is_paid ? <Badge tone="success">Paid</Badge> : <Badge tone="warn">Unpaid</Badge>
  }];


  return (
    <Modal
      open={open}
      onClose={onClose}
      title={selectedRoom ? `Room ${selectedRoom.room_number} utility history` : 'Room utility history'}
      size="lg">
      
      <div className="space-y-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <Field label="Room" htmlFor="history_room" className="sm:w-64">
            <Select id="history_room" value={roomId} onChange={(event) => setRoomId(event.target.value)}>
              <option value="">Select room…</option>
              {rooms.map((room) =>
              <option key={room.id} value={room.id}>
                  Room {room.room_number}
                </option>
              )}
            </Select>
          </Field>

          {roomId && prevData && (prevData.previous_electricity_meter_reading !== null || prevData.previous_water_meter_reading !== null) &&
          <div className="flex flex-wrap gap-4 rounded-lg border border-line bg-subtle px-3.5 py-2 text-[12px]">
              <div>
                <span className="text-ink-soft">Latest electricity meter: </span>
                <span className="font-semibold text-ink">
                  {prevData.previous_electricity_meter_reading !== null && prevData.previous_electricity_meter_reading !== undefined ?
                  formatUnits(prevData.previous_electricity_meter_reading) :
                  '—'}
                </span>
                {prevData.last_electricity_billing_month &&
                <span className="ml-1 text-ink-muted">({formatMonth(prevData.last_electricity_billing_month)})</span>
                }
              </div>
              <div>
                <span className="text-ink-soft">Latest water meter: </span>
                <span className="font-semibold text-ink">
                  {prevData.previous_water_meter_reading !== null && prevData.previous_water_meter_reading !== undefined ?
                  formatUnits(prevData.previous_water_meter_reading) :
                  '—'}
                </span>
                {prevData.last_water_billing_month &&
                <span className="ml-1 text-ink-muted">({formatMonth(prevData.last_water_billing_month)})</span>
                }
              </div>
            </div>
          }
        </div>
        {roomId && (
        error ?
        <ApiErrorState error={error} onRetry={reload} /> :

        <div className="-mx-5 border-t border-line">
              <DataTable
            columns={columns}
            rows={records}
            keyOf={(record) => record.id}
            loading={loading}
            emptyTitle="No utility records for this room"
            emptyDescription="Records appear once a building bill includes this room's meter readings." />
          
            </div>)
        }
      </div>
    </Modal>);

}
