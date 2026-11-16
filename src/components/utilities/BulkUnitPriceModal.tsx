import React, { useEffect, useState } from 'react';
import type { BuildingUtilityBill, MonthlyUtilityRow } from '../../types';
import type { ApiError } from '../../utils/api';
import { formatCurrency, formatMonth, toNumber } from '../../utils/format';
import { Input } from '../ui/Field';
import { FormModal } from '../ui/FormModal';

interface BulkUnitPriceModalProps {
  open: boolean;
  month: string;
  rows: MonthlyUtilityRow[];
  buildingBill: BuildingUtilityBill | null;
  pending: boolean;
  error: ApiError | null;
  onClose: () => void;
  onSubmit: (payload: Record<string, unknown>) => void;
}

interface RateDraft {
  selected: boolean;
  useDefault: boolean;
  electricityRate: string;
  waterRate: string;
}

export function BulkUnitPriceModal({
  open,
  month,
  rows,
  buildingBill,
  pending,
  error,
  onClose,
  onSubmit
}: BulkUnitPriceModalProps) {
  const [drafts, setDrafts] = useState<Record<string, RateDraft>>({});
  const [touched, setTouched] = useState(false);

  useEffect(() => {
    if (!open) return;
    setTouched(false);
    const next: Record<string, RateDraft> = {};
    for (const row of rows) {
      const hasCustom =
      buildingBill &&
      (toNumber(row.electricity_unit_price) !== toNumber(buildingBill.electricity_unit_price) ||
      toNumber(row.water_unit_price) !== toNumber(buildingBill.water_unit_price));
      next[String(row.room_id)] = {
        selected: Boolean(hasCustom),
        useDefault: false,
        electricityRate: String(toNumber(row.electricity_unit_price)),
        waterRate: String(toNumber(row.water_unit_price))
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
        ...(draft.electricityRate !== '' ? { electricity_unit_price: toNumber(draft.electricityRate).toFixed(2) } : {}),
        ...(draft.waterRate !== '' ? { water_unit_price: toNumber(draft.waterRate).toFixed(2) } : {})
      };
    });

    onSubmit({
      billing_month: month,
      custom_rates: customRates
    });
  };

  return (
    <FormModal
      open={open}
      onClose={onClose}
      onSubmit={handleSubmit}
      title={`Custom rates · ${formatMonth(month)}`}
      submitLabel="Apply rates"
      pending={pending}
      error={error}
      size="lg">
      
      {buildingBill &&
      <div className="flex flex-wrap gap-4 rounded-lg border border-line bg-subtle px-3.5 py-2.5 text-[12px] text-ink-muted">
          <span>
            Default electricity:{' '}
            <strong className="text-ink">{formatCurrency(buildingBill.electricity_unit_price)} / unit</strong>
          </span>
          <span>
            Default water:{' '}
            <strong className="text-ink">{formatCurrency(buildingBill.water_unit_price)} / unit</strong>
          </span>
        </div>
      }

      {touched && selectedRows.length === 0 &&
      <p role="alert" className="text-[12px] text-danger-600">
          Select at least one room.
        </p>
      }

      <div className="overflow-x-auto rounded-lg border border-line">
        <table className="w-full min-w-[540px] text-[13px]">
          <thead className="bg-subtle text-left text-[12px] text-ink-muted">
            <tr>
              <th scope="col" className="px-3 py-2 font-medium">
                Select
              </th>
              <th scope="col" className="px-3 py-2 font-medium">
                Room
              </th>
              <th scope="col" className="px-3 py-2 font-medium">
                Electricity / unit
              </th>
              <th scope="col" className="px-3 py-2 font-medium">
                Water / unit
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
                electricityRate: String(toNumber(row.electricity_unit_price)),
                waterRate: String(toNumber(row.water_unit_price))
              };
              return (
                <tr key={row.room_id}>
                  <td className="px-3 py-2.5">
                    <input
                      type="checkbox"
                      aria-label={`Select Room ${row.room_number}`}
                      className="h-4 w-4 accent-brand-600"
                      checked={draft.selected}
                      onChange={(event) => update(row.room_id, { selected: event.target.checked })} />
                  </td>
                  <td className="px-3 py-2.5">
                    <p className="font-medium text-ink">Room {row.room_number}</p>
                    <p className="text-[12px] text-ink-soft">{row.customer_name || 'No tenant'}</p>
                  </td>
                  <td className="px-3 py-2.5">
                    <Input
                      aria-label={`Room ${row.room_number} electricity rate`}
                      type="number"
                      min="0"
                      step="0.01"
                      disabled={!draft.selected || draft.useDefault}
                      value={draft.electricityRate}
                      onChange={(event) => update(row.room_id, { electricityRate: event.target.value })}
                      className="w-28" />
                  </td>
                  <td className="px-3 py-2.5">
                    <Input
                      aria-label={`Room ${row.room_number} water rate`}
                      type="number"
                      min="0"
                      step="0.01"
                      disabled={!draft.selected || draft.useDefault}
                      value={draft.waterRate}
                      onChange={(event) => update(row.room_id, { waterRate: event.target.value })}
                      className="w-28" />
                  </td>
                  <td className="px-3 py-2.5">
                    <label className="inline-flex cursor-pointer items-center gap-1.5 text-[12px] text-ink-muted">
                      <input
                        type="checkbox"
                        className="h-3.5 w-3.5 accent-brand-600"
                        disabled={!draft.selected}
                        checked={draft.useDefault}
                        onChange={(event) => update(row.room_id, { useDefault: event.target.checked })} />
                      <span>Use default</span>
                    </label>
                  </td>
                </tr>);
            })}
          </tbody>
        </table>
      </div>
    </FormModal>);

}
