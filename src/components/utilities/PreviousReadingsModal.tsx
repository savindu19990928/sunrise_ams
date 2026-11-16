import React, { useMemo, useState } from 'react';
import type { RoomPreviousReading } from '../../types';
import { useCollection } from '../../hooks/useResource';
import { buildQuery } from '../../utils/api';
import { formatMonth, titleCase } from '../../utils/format';
import { formatUnits } from '../../utils/utilityUsage';
import { ApiErrorState } from '../ui/ApiErrorState';
import { type Column, DataTable } from '../ui/DataTable';
import { Field, Input } from '../ui/Field';
import { Modal } from '../ui/Modal';

interface PreviousReadingsModalProps {
  open: boolean;
  defaultMonth: string;
  onClose: () => void;
}

export function PreviousReadingsModal({ open, defaultMonth, onClose }: PreviousReadingsModalProps) {
  const [month, setMonth] = useState(defaultMonth);

  React.useEffect(() => {
    if (open) setMonth(defaultMonth);
  }, [open, defaultMonth]);

  const path =
  open && month && /^\d{4}-\d{2}$/.test(month) ?
  `/api/utilities/previous-readings/${buildQuery({ billing_month: month, months: 3 })}` :
  null;

  const { data: rows, loading, error, reload } = useCollection<RoomPreviousReading>(path);

  const sorted = useMemo(
    () => [...rows].sort((a, b) => String(a.room_number).localeCompare(String(b.room_number), undefined, { numeric: true })),
    [rows]
  );

  const columns: Column<RoomPreviousReading>[] = [
  {
    key: 'room',
    header: 'Room',
    primary: true,
    render: (item) =>
    <div>
          <p className="font-medium text-ink">
            Room {item.room_number}
            {item.room_type && <span className="ml-1.5 text-[12px] font-normal text-ink-soft">{titleCase(item.room_type)}</span>}
          </p>
        </div>
  },
  {
    key: 'electricity',
    header: 'Previous electricity meter',
    render: (item) =>
    item.previous_electricity_meter_reading !== null && item.previous_electricity_meter_reading !== undefined ?
    <div>
            <p className="font-medium text-ink">{formatUnits(item.previous_electricity_meter_reading)}</p>
            {item.last_electricity_billing_month &&
            <p className="text-[12px] text-ink-soft">Recorded {formatMonth(item.last_electricity_billing_month)}</p>
            }
          </div> :
    <span className="text-ink-soft">No prior reading</span>
  },
  {
    key: 'water',
    header: 'Previous water meter',
    render: (item) =>
    item.previous_water_meter_reading !== null && item.previous_water_meter_reading !== undefined ?
    <div>
            <p className="font-medium text-ink">{formatUnits(item.previous_water_meter_reading)}</p>
            {item.last_water_billing_month &&
            <p className="text-[12px] text-ink-soft">Recorded {formatMonth(item.last_water_billing_month)}</p>
            }
          </div> :
    <span className="text-ink-soft">No prior reading</span>
  },
  {
    key: 'recent',
    header: 'Recent months',
    render: (item) => {
      const list = item.previous_months ?? [];
      if (!list.length) return <span className="text-ink-soft">—</span>;
      return (
        <ul className="space-y-0.5 text-[12px] text-ink-muted">
          {list.slice(0, 3).map((entry) =>
          <li key={entry.utility_record_id ?? entry.billing_month}>
              {formatMonth(entry.billing_month)}: Elec {formatUnits(entry.electricity_meter_reading)} ({formatUnits(entry.electricity_units)} u) · Water {formatUnits(entry.water_meter_reading)} ({formatUnits(entry.water_units)} u)
            </li>
          )}
        </ul>);
    }
  }];

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Previous meter readings"
      size="lg">
      
      <div className="space-y-4">
        <Field label="Before billing month" htmlFor="prev_readings_month" className="sm:w-52">
          <Input
            id="prev_readings_month"
            type="month"
            value={month}
            onChange={(event) => setMonth(event.target.value)} />
        </Field>

        {error ?
        <ApiErrorState error={error} onRetry={reload} /> :
        <div className="-mx-5 border-t border-line">
            <DataTable
            columns={columns}
            rows={sorted}
            keyOf={(item) => item.room_id}
            loading={loading}
            emptyTitle="No previous meter readings found"
            emptyDescription="Prior readings will appear here once at least one monthly utility bill has been recorded." />
          </div>
        }
      </div>
    </Modal>);

}
