import { useEffect, useMemo, useState } from 'react';
import type { NormalizedServiceRow, ServiceKind } from '../../types';
import type { ApiError } from '../../utils/api';
import { formatCurrency, formatMonth, toNumber, today } from '../../utils/format';
import { SERVICE_CONFIG, serviceRemaining } from '../../utils/serviceRecords';
import { Field, Input, Select, Textarea } from '../ui/Field';
import { FormModal } from '../ui/FormModal';

interface UtilityPaymentModalProps {
  kind: ServiceKind;
  row: NormalizedServiceRow | null;
  open?: boolean;
  records?: NormalizedServiceRow[];
  month?: string;
  pending: boolean;
  error: ApiError | null;
  onClose: () => void;
  onSubmit: (row: NormalizedServiceRow, payload: Record<string, unknown>, excess: number) => void;
}

/** Records that the tenant paid their electricity or water bill directly to the supplier. */
export function UtilityPaymentModal({
  kind,
  row,
  open = false,
  records = [],
  month,
  pending,
  error,
  onClose,
  onSubmit
}: UtilityPaymentModalProps) {
  const config = SERVICE_CONFIG[kind];
  const isOpen = Boolean(row) || open;

  const sortedRecords = useMemo(() => {
    const list = [...records];
    list.sort((a, b) => {
      const aUnpaid = serviceRemaining(a) > 0 ? 0 : 1;
      const bUnpaid = serviceRemaining(b) > 0 ? 0 : 1;
      if (aUnpaid !== bUnpaid) return aUnpaid - bUnpaid;
      const monthCmp = (b.billing_month ?? '').localeCompare(a.billing_month ?? '');
      if (monthCmp !== 0) return monthCmp;
      return String(a.room_number).localeCompare(String(b.room_number), undefined, { numeric: true });
    });
    return list;
  }, [records]);

  const [selectedRecordId, setSelectedRecordId] = useState('');
  const [amount, setAmount] = useState('');
  const [date, setDate] = useState(today());
  const [reference, setReference] = useState('');
  const [notes, setNotes] = useState('');
  const [touched, setTouched] = useState(false);

  const activeRow = useMemo(() => {
    if (row) return row;
    return sortedRecords.find((item) => String(item.record_id) === selectedRecordId) ?? null;
  }, [row, sortedRecords, selectedRecordId]);

  const remaining = activeRow ? serviceRemaining(activeRow) : 0;

  useEffect(() => {
    if (!isOpen) return;
    setTouched(false);
    setDate(today());
    setReference('');
    setNotes('');
    if (row) {
      const rem = serviceRemaining(row);
      setAmount(rem > 0 ? String(rem) : '');
      return;
    }
    const first = sortedRecords[0];
    if (first) {
      setSelectedRecordId(String(first.record_id));
      const rem = serviceRemaining(first);
      setAmount(rem > 0 ? String(rem) : '');
    } else {
      setSelectedRecordId('');
      setAmount('');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, row]);

  const handleRecordChange = (nextId: string) => {
    setSelectedRecordId(nextId);
    const chosen = sortedRecords.find((item) => String(item.record_id) === nextId);
    if (chosen) {
      const rem = serviceRemaining(chosen);
      setAmount(rem > 0 ? String(rem) : '');
    } else {
      setAmount('');
    }
  };

  const paid = toNumber(amount);
  const excess = Math.max(0, paid - remaining);
  const recordError = !row && !activeRow ? `Select a ${config.lowerLabel} bill.` : undefined;
  const amountError = paid <= 0 ? 'Enter the amount the customer paid.' : undefined;
  const referenceError = !reference.trim() ? 'Enter the supplier receipt or transfer reference.' : undefined;

  const handleSubmit = () => {
    setTouched(true);
    if (!activeRow || amountError || referenceError || !date) return;
    onSubmit(
      activeRow,
      {
        amount_paid: paid.toFixed(2),
        payment_date: date,
        receipt_reference: reference.trim(),
        notes: notes.trim()
      },
      excess
    );
  };

  const activeMonth = activeRow?.billing_month || month;

  return (
    <FormModal
      open={isOpen}
      onClose={onClose}
      onSubmit={handleSubmit}
      title={
        activeRow
          ? `${config.label} paid · Room ${activeRow.room_number}`
          : `Record ${config.lowerLabel} payment`
      }
      description={
        activeRow
          ? `${activeRow.customer_name || 'Tenant'} · ${formatMonth(activeMonth)} · Paid directly to ${config.supplierShort}`
          : `Paid directly to ${config.supplierName}`
      }
      submitLabel={`Record ${config.lowerLabel} payment`}
      pending={pending}
      error={error}
      size="sm"
    >
      {!row && (
        <Field
          label={`${config.label} bill`}
          htmlFor="up_record"
          required
          error={touched ? recordError : undefined}
          hint={
            sortedRecords.length
              ? undefined
              : `No ${config.lowerLabel} bills recorded yet. Enter a building ${config.lowerLabel} bill first.`
          }
        >
          <Select id="up_record" value={selectedRecordId} onChange={(event) => handleRecordChange(event.target.value)}>
            <option value="">Select room bill…</option>
            {sortedRecords.map((item) => {
              const rem = serviceRemaining(item);
              return (
                <option key={item.record_id} value={item.record_id}>
                  Room {item.room_number} · {formatMonth(item.billing_month)} ·{' '}
                  {rem > 0 ? `${formatCurrency(rem)} left` : 'Settled (advance)'}
                </option>
              );
            })}
          </Select>
        </Field>
      )}

      {activeRow && (
        <dl className="grid grid-cols-3 gap-3 rounded-xl border border-line bg-subtle px-4 py-3">
          <div>
            <dt className="text-[12px] text-ink-soft">Room bill</dt>
            <dd className="mt-0.5 text-sm font-semibold text-ink">{formatCurrency(activeRow.cost)}</dd>
          </div>
          <div>
            <dt className="text-[12px] text-ink-soft">Already paid</dt>
            <dd className="mt-0.5 text-sm font-semibold text-ink">{formatCurrency(activeRow.total_paid)}</dd>
          </div>
          <div>
            <dt className="text-[12px] text-ink-soft">Remaining</dt>
            <dd className="mt-0.5 text-sm font-semibold text-brand-700">{formatCurrency(remaining)}</dd>
          </div>
        </dl>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <Field
          label={`Amount paid to ${config.supplierShort}`}
          htmlFor="up_amount"
          required
          error={touched ? amountError : undefined}
          hint={
            excess > 0
              ? `${formatCurrency(excess)} over the bill — kept as advance ${config.lowerLabel} credit for this room.`
              : undefined
          }
        >
          <Input
            id="up_amount"
            type="number"
            min="0"
            step="0.01"
            value={amount}
            onChange={(event) => setAmount(event.target.value)}
          />
        </Field>
        <Field label="Payment date" htmlFor="up_date" required>
          <Input id="up_date" type="date" value={date} onChange={(event) => setDate(event.target.value)} />
        </Field>
      </div>
      <Field
        label={`${config.supplierShort} receipt reference`}
        htmlFor="up_reference"
        required
        error={touched ? referenceError : undefined}
      >
        <Input
          id="up_reference"
          value={reference}
          onChange={(event) => setReference(event.target.value)}
          placeholder={config.receiptPlaceholder}
        />
      </Field>
      <Field label="Notes" htmlFor="up_notes">
        <Textarea id="up_notes" value={notes} onChange={(event) => setNotes(event.target.value)} />
      </Field>
    </FormModal>
  );
}
