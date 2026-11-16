import React from 'react';
import { PencilIcon, Trash2Icon } from 'lucide-react';
import type { Room, RoomStatus } from '../../types';
import { formatCurrency, titleCase, toNumber } from '../../utils/format';
import { Badge, type BadgeTone } from '../ui/Badge';
import { Button } from '../ui/Button';

const statusTone: Record<string, BadgeTone> = {
  occupied: 'brand',
  vacant: 'success',
  maintenance: 'warn'
};

interface RoomCardProps {
  room: Room;
  status?: RoomStatus;
  tenantName?: string | null;
  onEdit: (room: Room) => void;
  onDelete: (room: Room) => void;
}

export function RoomCard({ room, status, tenantName, onEdit, onDelete }: RoomCardProps) {
  const currentStatus: RoomStatus = status ?? room.status ?? 'vacant';
  const noteText = room.note ?? room.notes;
  const credit = toNumber(room.utility_credit_balance);

  return (
    <article className="flex flex-col rounded-xl border border-line bg-surface p-4 shadow-card transition-[border-color] duration-150 ease-out hover:border-brand-200">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[11px] uppercase tracking-[0.08em] text-ink-soft">Room</p>
          <p className="text-[26px] font-semibold leading-tight tracking-[-0.02em] text-ink">{room.room_number}</p>
          <p className="mt-0.5 text-[13px] text-ink-muted">
            {room.room_type ? titleCase(String(room.room_type)) : 'Unspecified type'}
            {tenantName && currentStatus === 'occupied' ? ` · Leased to ${tenantName}` : ''}
          </p>
        </div>
        <Badge tone={statusTone[currentStatus] ?? 'neutral'}>{titleCase(currentStatus)}</Badge>
      </div>

      {credit > 0 &&
      <p className="mt-3 border-t border-line pt-2.5 text-[12px] font-medium text-brand-700">
          Utility advance credit: {formatCurrency(credit)}
        </p>
      }

      {noteText && <p className="mt-3 border-t border-line pt-2.5 text-[12px] leading-relaxed text-ink-soft">{noteText}</p>}

      <div className="mt-auto flex gap-2 pt-4">
        <Button variant="secondary" size="sm" icon={PencilIcon} onClick={() => onEdit(room)}>
          Edit
        </Button>
        <Button
          variant="ghost"
          size="sm"
          icon={Trash2Icon}
          className="text-danger-600 hover:bg-danger-50 hover:text-danger-700"
          onClick={() => onDelete(room)}>
          
          Delete
        </Button>
      </div>
    </article>);

}
