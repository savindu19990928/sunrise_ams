import { useEffect, useState } from 'react';
import type { NormalizedBuildingServiceBill, NormalizedServiceRow, ServiceKind } from '../../types';
import type { ApiError } from '../../utils/api';
import { formatCurrency, formatMonth, toNumber } from '../../utils/format';
import { SERVICE_CONFIG } from '../../utils/serviceRecords';
import { Field, Input } from '../ui/Field';
import { FormModal } from '../ui/FormModal';

interface BulkUnitPriceModalProps {
  kind: ServiceKind;
  open: boolean;
  month: string;
  rows: NormalizedServiceRow[];
  buildingBill: NormalizedBuildingServiceBill | null;
  pending: boolean;
  error: ApiError | null;
  onClose: () => void;
  onSubmit: (payload: Record<string, unknown>) => void;
}

interface RateDraft {
  selected: boolean;
  useDefault: boolean;
  rate: string;
}

export function BulkUnitPriceModal({
  kind,
  open,
  month,
  rows,
  buildingBill,
  pending,
  error,
  onClose,
  onSubmit
}: BulkUnitPriceModalProps) {
  const config = SERVICE_CONFIG[kind];
  const [drafts, setDrafts] = useState<Record<string, RateDraft>>({});
  const [reason, setReason] = useState('');
  const [touched, setTouched] = useState(false);

  useEffect(() => {
    if (!open) return;
    setTouched(false);
    setReason('');
    const next: Record<string, RateDraft> = {};
    for (const row of rows) {
      const hasCustom = Boolean(
        buildingBill && row.unit_price !== null && toNumber(row.unit_price) !== toNumber(buildingBill.unit_price)
      );
      next[String(row.room_id)] = {
        selected: hasCustom,
        useDefault: false,
        rate: String(toNumber(row.unit_price))
      };
    }
    setDrafts(next);
  }, [open, rows, buildingBill]);

  const update = (roomId: number, patch: Partial<RateDraft>) =>
    setDrafts((prev) => ({
      ...prev,
      [String(roomId)]: { ...prev[String(roomId)], ...patch }
    }));

  const selectedRows = rows.filter((row) => drafts[String(row.room_id)]?.selected);

  const handleSubmit = () => {
    setTouched(true);
    if (!selectedRows.length) return;
    const customRates = selectedRows.map((row) => {
      const draft = drafts[String(row.room_id)];
      if (draft.useDefault) {
        return { room_number: row.room_number, use_default: true };
      }
      return {
        room_number: row.room_number,
        ...(draft.rate !== '' ? { [config.unitPriceKey]: toNumber(draft.rate).toFixed(2) } : {})
      };
    });

    onSubmit({
      billing_month: month,
      ...(reason.trim() ? { reason: reason.trim() } : {}),
      custom_rates: customRates
    });
  };

  return (
    <FormModal
      open={open}
      onClose={onClose}
      onSubmit={handleSubmit}
      title={`Custom ${config.lowerLabel} rates · ${formatMonth(month)}`}
      submitLabel="Apply rates"
      pending={pending}
      error={error}
      size="lg"
    >
      {buildingBill && (
        <div className="flex flex-wrap gap-4 rounded-lg border border-line bg-subtle px-3.5 py-2.5 text-[12px] text-ink-muted">
          <span>
            Default {config.lowerLabel}:{' '}
            <strong className="text-ink">{formatCurrency(buildingBill.unit_price)} / unit</strong>
          </span>
        </div>
      )}

      {touched && selectedRows.length === 0 && (
        <p role="alert" className="text-[12px] text-danger-600">
          Select at least one room.
        </p>
      )}

      <div className="overflow-x-auto rounded-lg border border-line">
        <table className="w-full min-w-[460px] text-[13px]">
          <thead className="bg-subtle text-left text-[12px] text-ink-muted">
            <tr>
              <th scope="col" className="px-3 py-2 font-medium">
                Select
              </th>
              <th scope="col" className="px-3 py-2 font-medium">
                Room
              </th>
              <th scope="col" className="px-3 py-2 font-medium">
                {config.label} / unit
              </th>
              <th scope="col" className="px-3 py-2 font-medium">
                Mode
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {rows.map((row) => {
              const draft = drafts[String(row.room_id)] ?? {
                selected: false,
                useDefault: false,
                rate: String(toNumber(row.unit_price))
              };
              return (
                <tr key={row.room_id}>
                  <td className="px-3 py-2.5">
                    <input
                      type="checkbox"
                      aria-label={`Select Room ${row.room_number}`}
                      className="h-4 w-4 accent-brand-600"
                      checked={draft.selected}
                      onChange={(event) => update(row.room_id, { selected: event.target.checked })}
                    />
                  </td>
                  <td className="px-3 py-2.5">
                    <p className="font-medium text-ink">Room {row.room_number}</p>
                    <p className="text-[12px] text-ink-soft">{row.customer_name || 'No tenant'}</p>
                  </td>
                  <td className="px-3 py-2.5">
                    <Input
                      aria-label={`Room ${roomLabel(row)} ${config.lowerLabel} rate`}
                      type="number"
                      min="0"
                      step="0.01"
                      disabled={!draft.selected || draft.useDefault}
                      value={draft.rate}
                      onChange={(event) => update(row.room_id, { rate: event.target.value })}
                      className="w-32"
                    />
                  </td>
                  <td className="px-3 py-2.5">
                    <label className="inline-flex cursor-pointer items-center gap-1.5 text-[12px] text-ink-muted">
                      <input
                        type="checkbox"
                        className="h-3.5 w-3.5 accent-brand-600"
                        disabled={!draft.selected}
                        checked={draft.useDefault}
                        onChange={(event) => update(row.room_id, { useDefault: event.target.checked })}
                      />
                      <span>Use default</span>
                    </label>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <Field label="Reason (optional)" htmlFor="bulk_rate_reason">
        <Input
          id="bulk_rate_reason"
          value={reason}
          onChange={(event) => setReason(event.target.value)}
          placeholder="Optional audit log note"
        />
      </Field>
    </FormModal>
  );
}

function roomLabel(row: NormalizedServiceRow): string {
  return row.room_number;
}
