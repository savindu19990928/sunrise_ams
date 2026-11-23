import { useEffect, useState } from 'react';
import type { NormalizedBuildingServiceBill, NormalizedServiceRow, ServiceKind } from '../../types';
import type { ApiError } from '../../utils/api';
import { formatCurrency, toNumber } from '../../utils/format';
import { SERVICE_CONFIG } from '../../utils/serviceRecords';
import { formatUnits } from '../../utils/utilityUsage';
import { Button } from '../ui/Button';
import { Field, Input } from '../ui/Field';
import { FormModal } from '../ui/FormModal';

interface UnitPriceModalProps {
  kind: ServiceKind;
  row: NormalizedServiceRow | null;
  month: string;
  buildingBill: NormalizedBuildingServiceBill | null;
  pending: boolean;
  error: ApiError | null;
  onClose: () => void;
  onSubmit: (row: NormalizedServiceRow, payload: Record<string, unknown>) => void;
}

export function UnitPriceModal({
  kind,
  row,
  buildingBill,
  pending,
  error,
  onClose,
  onSubmit
}: UnitPriceModalProps) {
  const config = SERVICE_CONFIG[kind];
  const [rate, setRate] = useState('');
  const [useDefault, setUseDefault] = useState(false);
  const [reason, setReason] = useState('');
  const [touched, setTouched] = useState(false);

  useEffect(() => {
    if (!row) return;
    setTouched(false);
    setUseDefault(false);
    setRate(String(toNumber(row.unit_price)));
    setReason('');
  }, [row]);

  const newCost = toNumber(row?.units) * toNumber(rate);
  const invalid = (value: string) => (value === '' || toNumber(value) < 0 ? 'Enter a price of 0 or more.' : undefined);

  const handleSubmit = () => {
    setTouched(true);
    if (!row) return;
    const reasonPart = reason.trim() ? { reason: reason.trim() } : {};
    if (useDefault) {
      onSubmit(row, { use_default: true, ...reasonPart });
      return;
    }
    if (invalid(rate)) return;
    onSubmit(row, {
      [config.unitPriceKey]: toNumber(rate).toFixed(2),
      ...reasonPart
    });
  };

  return (
    <FormModal
      open={Boolean(row)}
      onClose={onClose}
      onSubmit={handleSubmit}
      title={row ? `${config.label} unit price · Room ${row.room_number}` : `${config.label} unit price`}
      submitLabel="Save price"
      pending={pending}
      error={error}
      size="sm"
    >
      <Field
        label={`${config.label} / unit`}
        htmlFor="up_rate"
        error={touched && !useDefault ? invalid(rate) : undefined}
        hint={buildingBill ? `Default ${formatCurrency(buildingBill.unit_price)}` : undefined}
      >
        <Input
          id="up_rate"
          type="number"
          min="0"
          step="0.01"
          value={rate}
          onChange={(event) => {
            setUseDefault(false);
            setRate(event.target.value);
          }}
        />
      </Field>

      {buildingBill && (
        <Button
          variant="ghost"
          size="sm"
          onClick={() => {
            setUseDefault(true);
            setRate(String(toNumber(buildingBill.unit_price)));
          }}
        >
          Reset to default rate
        </Button>
      )}

      <Field label="Reason (optional)" htmlFor="up_reason">
        <Input
          id="up_reason"
          value={reason}
          onChange={(event) => setReason(event.target.value)}
          placeholder="Optional audit log note"
        />
      </Field>

      {row && (
        <dl className="rounded-lg border border-line bg-subtle px-3 py-1 text-[13px]">
          <div className="flex items-baseline justify-between gap-3 py-1.5">
            <dt className="text-ink-muted">
              {config.label} · {formatUnits(row.units)} × {formatCurrency(rate)}
            </dt>
            <dd className="font-semibold text-ink">{formatCurrency(newCost)}</dd>
          </div>
        </dl>
      )}
    </FormModal>
  );
}
