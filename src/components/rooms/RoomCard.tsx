import React from 'react';
import { PencilIcon, Trash2Icon } from 'lucide-react';
import type { Room } from '../../types';
import { formatCurrency, titleCase } from '../../utils/format';
import { Badge, type BadgeTone } from '../ui/Badge';
import { Button } from '../ui/Button';

const statusTone: Record<string, BadgeTone> = {
  occupied: 'brand',
  vacant: 'success',
  maintenance: 'warn'
};

interface RoomCardProps {
  room: Room;
  onEdit: (room: Room) => void;
  onDelete: (room: Room) => void;
}

export function RoomCard({ room, onEdit, onDelete }: RoomCardProps) {
  return (
    <article className="flex flex-col rounded-xl border border-line bg-surface p-4 shadow-card transition-[border-color] duration-150 ease-out hover:border-brand-200">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[11px] uppercase tracking-[0.08em] text-ink-soft">Room</p>
          <p className="text-[26px] font-semibold leading-tight tracking-[-0.02em] text-ink">{room.room_number}</p>
          <p className="mt-0.5 text-[13px] text-ink-muted">{room.room_type || 'Unspecified type'}</p>
        </div>
        <Badge tone={statusTone[room.status ?? 'vacant'] ?? 'neutral'}>{titleCase(room.status ?? 'vacant')}</Badge>
      </div>

      <dl className="mt-4 space-y-2 border-t border-line pt-3 text-[13px]">
        <div className="flex items-baseline justify-between gap-3">
          <dt className="text-ink-muted">Monthly rent</dt>
          <dd className="font-semibold text-ink">{formatCurrency(room.base_rent_fee)}</dd>
        </div>
        <div className="flex items-baseline justify-between gap-3">
          <dt className="text-ink-muted">Base deposit</dt>
          <dd className="text-ink">{formatCurrency(room.base_deposit)}</dd>
        </div>
        <div className="flex items-baseline justify-between gap-3">
          <dt className="text-ink-muted">Monthly deduction</dt>
          <dd className="text-ink">{formatCurrency(room.monthly_deposit_deduction)}</dd>
        </div>
        <div className="flex items-baseline justify-between gap-3">
          <dt className="text-ink-muted">Electricity / unit</dt>
          <dd className="text-ink">{room.electricity_unit_price ? formatCurrency(room.electricity_unit_price) : <span className="text-ink-soft">Not set</span>}</dd>
        </div>
        <div className="flex items-baseline justify-between gap-3">
          <dt className="text-ink-muted">Water / unit</dt>
          <dd className="text-ink">{room.water_unit_price ? formatCurrency(room.water_unit_price) : <span className="text-ink-soft">Not set</span>}</dd>
        </div>
      </dl>

      {room.notes && <p className="mt-3 text-[12px] leading-relaxed text-ink-soft">{room.notes}</p>}

      <div className="mt-4 flex gap-2 pt-1">
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