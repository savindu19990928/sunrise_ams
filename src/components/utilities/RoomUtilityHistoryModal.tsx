import { useEffect, useMemo, useState } from 'react';
import type { NormalizedServiceRow, Room, ServiceKind } from '../../types';
import { useResource } from '../../hooks/useResource';
import { buildQuery } from '../../utils/api';
import { formatCurrency, formatMonth, toNumber } from '../../utils/format';
import {
  extractRoomHistory,
  extractSingleRoomPreviousReading,
  SERVICE_CONFIG,
  serviceRemaining
} from '../../utils/serviceRecords';
import { formatUnits } from '../../utils/utilityUsage';
import { ApiErrorState } from '../ui/ApiErrorState';
import { Badge } from '../ui/Badge';
import { type Column, DataTable } from '../ui/DataTable';
import { Field, Select } from '../ui/Field';
import { Modal } from '../ui/Modal';
import { UsageCell } from './UsageCell';

interface RoomUtilityHistoryModalProps {
  kind: ServiceKind;
  open: boolean;
  rooms: Room[];
  initialRoomId?: number | null;
  onClose: () => void;
}

export function RoomUtilityHistoryModal({
  kind,
  open,
  rooms,
  initialRoomId,
  onClose
}: RoomUtilityHistoryModalProps) {
  const config = SERVICE_CONFIG[kind];
  const [roomId, setRoomId] = useState('');

  useEffect(() => {
    if (open) setRoomId(initialRoomId ? String(initialRoomId) : '');
  }, [open, initialRoomId]);

  const path = open && roomId ? `${config.roomHistoryPath}${buildQuery({ room_id: roomId })}` : null;
  const prevPath = open && roomId ? config.roomPrevReadingsPath(roomId) : null;
  const { data: rawHistory, loading, error, reload } = useResource<unknown>(path);
  const { data: rawPrev } = useResource<unknown>(prevPath);

  const records = useMemo<NormalizedServiceRow[]>(
    () =>
      extractRoomHistory(kind, rawHistory).sort((a, b) => b.billing_month.localeCompare(a.billing_month)),
    [kind, rawHistory]
  );

  const prevData = useMemo(() => extractSingleRoomPreviousReading(kind, rawPrev), [kind, rawPrev]);
  const selectedRoom = rooms.find((room) => String(room.id) === roomId);

  const columns: Column<NormalizedServiceRow>[] = [
    {
      key: 'month',
      header: 'Month',
      primary: true,
      render: (record) => (
        <span className="whitespace-nowrap font-medium text-ink">{formatMonth(record.billing_month)}</span>
      )
    },
    {
      key: 'usage',
      header: config.label,
      render: (record) => (
        <UsageCell
          units={record.units}
          month={record.billing_month}
          rate={record.unit_price}
          cost={record.cost}
          previousReading={record.previous_meter_reading}
          currentReading={record.meter_reading}
        />
      )
    },
    {
      key: 'total',
      header: 'Room bill',
      align: 'right',
      render: (record) => <span className="font-semibold text-ink">{formatCurrency(record.cost)}</span>
    },
    {
      key: 'supplier',
      header: `Paid to ${config.supplierShort}`,
      render: (record) => {
        const remaining = serviceRemaining(record);
        const paid = toNumber(record.total_paid);
        if (record.is_paid || remaining <= 0) return <Badge tone="success">Paid</Badge>;
        if (paid > 0) return <Badge tone="warn">{formatCurrency(remaining)} left</Badge>;
        return <Badge tone="danger">Unpaid</Badge>;
      }
    }
  ];

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={
        selectedRoom
          ? `Room ${selectedRoom.room_number} ${config.lowerLabel} history`
          : `Room ${config.lowerLabel} history`
      }
      size="lg"
    >
      <div className="space-y-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <Field label="Room" htmlFor="history_room" className="sm:w-64">
            <Select id="history_room" value={roomId} onChange={(event) => setRoomId(event.target.value)}>
              <option value="">Select room…</option>
              {rooms.map((room) => (
                <option key={room.id} value={room.id}>
                  Room {room.room_number}
                </option>
              ))}
            </Select>
          </Field>

          {roomId && prevData && prevData.previous_meter_reading !== null && prevData.previous_meter_reading !== undefined && (
            <div className="rounded-lg border border-line bg-subtle px-3.5 py-2 text-[12px]">
              <span className="text-ink-soft">Latest {config.lowerLabel} meter: </span>
              <span className="font-semibold text-ink">{formatUnits(prevData.previous_meter_reading)}</span>
              {prevData.last_billing_month && (
                <span className="ml-1 text-ink-muted">({formatMonth(prevData.last_billing_month)})</span>
              )}
            </div>
          )}
        </div>

        {roomId && (
          error ? (
            <ApiErrorState error={error} onRetry={reload} />
          ) : (
            <div className="-mx-5 border-t border-line">
              <DataTable
                columns={columns}
                rows={records}
                keyOf={(record) => record.record_id}
                loading={loading}
                emptyTitle={`No ${config.lowerLabel} records for this room`}
                emptyDescription={`Records appear once a monthly building ${config.lowerLabel} bill includes this room's meter reading.`}
              />
            </div>
          )
        )}
      </div>
    </Modal>
  );
}
