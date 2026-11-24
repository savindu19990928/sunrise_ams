import { useEffect, useMemo, useState } from 'react';
import type { ID, NormalizedServiceRow, Room, ServiceKind } from '../../types';
import type { ApiError } from '../../utils/api';
import { formatCurrency, formatMonth, toNumber, today } from '../../utils/format';
import { SERVICE_CONFIG, serviceRemaining } from '../../utils/serviceRecords';
import { Field, Input, Select, Textarea } from '../ui/Field';
import { FormModal } from '../ui/FormModal';

export interface UtilityPaymentTarget {
  recordId?: ID;
  roomId?: ID;
  roomNumber: string;
}

interface UtilityPaymentModalProps {
  kind: ServiceKind;
  row: NormalizedServiceRow | null;
  open?: boolean;
  records?: NormalizedServiceRow[];
  rooms?: Room[];
  month?: string;
  pending: boolean;
  error: ApiError | null;
  onClose: () => void;
  onSubmit: (target: UtilityPaymentTarget, payload: Record<string, unknown>, excess: number) => void;
}

/** Records that the tenant paid their electricity or water bill directly to the supplier. */
export function UtilityPaymentModal({
  kind,
  row,
  open = false,
  records = [],
  rooms = [],
  month,
  pending,
  error,
  onClose,
  onSubmit
}: UtilityPaymentModalProps) {
  const config = SERVICE_CONFIG[kind];
  const otherService = kind === 'electricity' ? 'water' : 'electricity';
  const isOpen = Boolean(row) || open;

  const roomOptions = useMemo(() => {
    const unpaidByRoom = new Map<ID, { unpaidTotal: number; unpaidCount: number; totalCost: number; totalPaid: number; tenantName: string | null }>();
    for (const rec of records) {
      const prev = unpaidByRoom.get(rec.room_id) ?? {
        unpaidTotal: 0,
        unpaidCount: 0,
        totalCost: 0,
        totalPaid: 0,
        tenantName: null
      };
      const rem = serviceRemaining(rec);
      unpaidByRoom.set(rec.room_id, {
        unpaidTotal: prev.unpaidTotal + rem,
        unpaidCount: prev.unpaidCount + (rem > 0 ? 1 : 0),
        totalCost: prev.totalCost + toNumber(rec.cost),
        totalPaid: prev.totalPaid + toNumber(rec.total_paid),
        tenantName: prev.tenantName ?? rec.customer_name ?? null
      });
    }

    const baseRooms =
      rooms.length > 0
        ? rooms.map((r) => ({
            roomId: r.id,
            roomNumber: r.room_number,
            creditBalance: toNumber(kind === 'electricity' ? r.electricity_credit_balance : r.water_credit_balance)
          }))
        : Array.from(new Map(records.map((rec) => [rec.room_id, rec])).values()).map((rec) => ({
            roomId: rec.room_id,
            roomNumber: rec.room_number,
            creditBalance: toNumber(rec.room_credit_balance)
          }));

    return baseRooms
      .map((r) => {
        const stats = unpaidByRoom.get(r.roomId) ?? {
          unpaidTotal: 0,
          unpaidCount: 0,
          totalCost: 0,
          totalPaid: 0,
          tenantName: null
        };
        return { ...r, ...stats };
      })
      .sort((a, b) => {
        const aUnpaid = a.unpaidTotal > 0 ? 0 : 1;
        const bUnpaid = b.unpaidTotal > 0 ? 0 : 1;
        if (aUnpaid !== bUnpaid) return aUnpaid - bUnpaid;
        return String(a.roomNumber).localeCompare(String(b.roomNumber), undefined, { numeric: true });
      });
  }, [rooms, records, kind]);

  const [selectedRoomId, setSelectedRoomId] = useState('');
  const [amount, setAmount] = useState('');
  const [date, setDate] = useState(today());
  const [reference, setReference] = useState('');
  const [notes, setNotes] = useState('');
  const [touched, setTouched] = useState(false);

  const selectedRoomOption = useMemo(
    () => roomOptions.find((item) => String(item.roomId) === selectedRoomId) ?? null,
    [roomOptions, selectedRoomId]
  );

  const remaining = row ? serviceRemaining(row) : selectedRoomOption?.unpaidTotal ?? 0;

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
    const first = roomOptions[0];
    if (first) {
      setSelectedRoomId(String(first.roomId));
      setAmount(first.unpaidTotal > 0 ? String(first.unpaidTotal) : '');
    } else {
      setSelectedRoomId('');
      setAmount('');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, row]);

  const handleRoomChange = (nextId: string) => {
    setSelectedRoomId(nextId);
    const chosen = roomOptions.find((item) => String(item.roomId) === nextId);
    if (chosen) {
      setAmount(chosen.unpaidTotal > 0 ? String(chosen.unpaidTotal) : '');
    } else {
      setAmount('');
    }
  };

  const paid = toNumber(amount);
  const excess = Math.max(0, paid - remaining);
  const roomError = !row && !selectedRoomOption ? 'Select a room.' : undefined;
  const amountError = paid <= 0 ? 'Enter the amount the customer paid.' : undefined;
  const referenceError = !reference.trim() ? 'Enter the supplier receipt or transfer reference.' : undefined;

  const handleSubmit = () => {
    setTouched(true);
    if (amountError || referenceError || !date) return;
    if (row) {
      onSubmit(
        {
          recordId: row.record_id,
          roomId: row.room_id,
          roomNumber: row.room_number
        },
        {
          amount_paid: paid.toFixed(2),
          payment_date: date,
          receipt_reference: reference.trim(),
          notes: notes.trim()
        },
        excess
      );
      return;
    }
    if (!selectedRoomOption) return;
    onSubmit(
      {
        roomId: selectedRoomOption.roomId,
        roomNumber: selectedRoomOption.roomNumber
      },
      {
        room_id: selectedRoomOption.roomId,
        amount_paid: paid.toFixed(2),
        payment_date: date,
        receipt_reference: reference.trim(),
        notes: notes.trim()
      },
      excess
    );
  };

  const activeMonth = row?.billing_month || month;
  const targetRoomNumber = row?.room_number ?? selectedRoomOption?.roomNumber ?? '';

  return (
    <FormModal
      open={isOpen}
      onClose={onClose}
      onSubmit={handleSubmit}
      title={
        targetRoomNumber
          ? `${config.label} paid · Room ${targetRoomNumber}`
          : `Record ${config.lowerLabel} payment`
      }
      description={
        row
          ? `${row.customer_name || 'Tenant'} · ${formatMonth(activeMonth)} · Paid directly to ${config.supplierShort}`
          : `Paid directly to ${config.supplierName}`
      }
      submitLabel={`Record ${config.lowerLabel} payment`}
      pending={pending}
      error={error}
      size="sm"
    >
      {!row && (
        <Field
          label="Room"
          htmlFor="up_room"
          required
          error={touched ? roomError : undefined}
          hint={roomOptions.length ? undefined : 'No rooms available yet.'}
        >
          <Select id="up_room" value={selectedRoomId} onChange={(event) => handleRoomChange(event.target.value)}>
            <option value="">Select room…</option>
            {roomOptions.map((item) => (
              <option key={item.roomId} value={item.roomId}>
                Room {item.roomNumber}
                {item.tenantName ? ` (${item.tenantName})` : ''} ·{' '}
                {item.unpaidTotal > 0
                  ? `${formatCurrency(item.unpaidTotal)} unpaid (${item.unpaidCount} bill${item.unpaidCount === 1 ? '' : 's'})`
                  : 'Settled (advance credit)'}
              </option>
            ))}
          </Select>
        </Field>
      )}

      {row ? (
        <dl className="grid grid-cols-3 gap-3 rounded-xl border border-line bg-subtle px-4 py-3">
          <div>
            <dt className="text-[12px] text-ink-soft">This bill</dt>
            <dd className="mt-0.5 text-sm font-semibold text-ink">{formatCurrency(row.cost)}</dd>
          </div>
          <div>
            <dt className="text-[12px] text-ink-soft">Already paid</dt>
            <dd className="mt-0.5 text-sm font-semibold text-ink">{formatCurrency(row.total_paid)}</dd>
          </div>
          <div>
            <dt className="text-[12px] text-ink-soft">Remaining</dt>
            <dd className="mt-0.5 text-sm font-semibold text-brand-700">{formatCurrency(remaining)}</dd>
          </div>
        </dl>
      ) : (
        selectedRoomOption && (
          <dl className="grid grid-cols-3 gap-3 rounded-xl border border-line bg-subtle px-4 py-3">
            <div>
              <dt className="text-[12px] text-ink-soft">Total unpaid</dt>
              <dd className="mt-0.5 text-sm font-semibold text-brand-700">
                {formatCurrency(selectedRoomOption.unpaidTotal)}
              </dd>
            </div>
            <div>
              <dt className="text-[12px] text-ink-soft">Unpaid bills</dt>
              <dd className="mt-0.5 text-sm font-semibold text-ink">{selectedRoomOption.unpaidCount}</dd>
            </div>
            <div>
              <dt className="text-[12px] text-ink-soft">Room credit</dt>
              <dd className="mt-0.5 text-sm font-semibold text-ink">
                {formatCurrency(selectedRoomOption.creditBalance)}
              </dd>
            </div>
          </dl>
        )
      )}

      <p className="rounded-lg border border-brand-100 bg-brand-50 px-3 py-2 text-[12px] leading-relaxed text-brand-700">
        Payments settle this room&apos;s oldest unpaid {config.lowerLabel} bills first. Any excess cascades to newer{' '}
        {config.lowerLabel} bills and then into advance {config.lowerLabel}-only credit (separate from rent and{' '}
        {otherService}).
      </p>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field
          label={`Amount paid to ${config.supplierShort}`}
          htmlFor="up_amount"
          required
          error={touched ? amountError : undefined}
          hint={
            excess > 0
              ? `${formatCurrency(excess)} over this balance — cascades to other unpaid ${config.lowerLabel} bills or ${config.lowerLabel} advance credit.`
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
