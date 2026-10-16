import React, { useEffect, useState } from 'react';
import { InfoIcon } from 'lucide-react';
import type { MonthlyUtilityRow } from '../../types';
import type { ApiError } from '../../utils/api';
import { formatCurrency, formatMonth, toNumber, today } from '../../utils/format';
import { utilityRemaining } from '../../utils/utilityUsage';
import { Field, Input, Textarea } from '../ui/Field';
import { FormModal } from '../ui/FormModal';

interface UtilityPaymentModalProps {
  row: MonthlyUtilityRow | null;
  month: string;
  pending: boolean;
  error: ApiError | null;
  onClose: () => void;
  onSubmit: (row: MonthlyUtilityRow, payload: Record<string, unknown>, excess: number) => void;
}

/** Records that the tenant has told staff they paid their utility bill to the supplier. */
export function UtilityPaymentModal({ row, month, pending, error, onClose, onSubmit }: UtilityPaymentModalProps) {
  const [amount, setAmount] = useState('');
  const [date, setDate] = useState(today());
  const [reference, setReference] = useState('');
  const [notes, setNotes] = useState('');
  const [touched, setTouched] = useState(false);

  const remaining = row ? utilityRemaining(row) : 0;
  const credit = toNumber(row?.room_credit_balance);

  useEffect(() => {
    if (!row) return;
    setTouched(false);
    setAmount(String(utilityRemaining(row)));
    setDate(today());
    setReference('');
    setNotes('');
  }, [row]);

  const paid = toNumber(amount);
  const excess = Math.max(0, paid - remaining);
  const amountError = paid <= 0 ? 'Enter the amount the customer paid.' : undefined;
  const referenceError = !reference.trim() ? 'Enter the supplier receipt or transfer reference.' : undefined;

  const handleSubmit = () => {
    setTouched(true);
    if (!row || amountError || referenceError || !date) return;
    onSubmit(
      row,
      {
        amount_paid: paid.toFixed(2),
        payment_date: date,
        receipt_reference: reference.trim(),
        notes: notes.trim()
      },
      excess
    );
  };

  return (
    <FormModal
      open={Boolean(row)}
      onClose={onClose}
      onSubmit={handleSubmit}
      title={row ? `Utilities paid · Room ${row.room_number}` : 'Utilities paid'}
      description={row ? `${row.customer_name || 'Tenant'} · ${formatMonth(month)}` : undefined}
      submitLabel="Record supplier payment"
      pending={pending}
      error={error}
      size="sm">
      
      {row &&
      <dl className="grid grid-cols-3 gap-3 rounded-xl border border-line bg-subtle px-4 py-3">
          <div>
            <dt className="text-[12px] text-ink-soft">Room bill</dt>
            <dd className="mt-0.5 text-sm font-semibold text-ink">{formatCurrency(row.total_cost ?? row.total_bill)}</dd>
          </div>
          <div>
            <dt className="text-[12px] text-ink-soft">Already paid</dt>
            <dd className="mt-0.5 text-sm font-semibold text-ink">{formatCurrency(row.total_utility_paid)}</dd>
          </div>
          <div>
            <dt className="text-[12px] text-ink-soft">Remaining</dt>
            <dd className="mt-0.5 text-sm font-semibold text-brand-700">{formatCurrency(remaining)}</dd>
          </div>
        </dl>
      }

      <div className="grid gap-4 sm:grid-cols-2">
        <Field
          label="Amount paid to supplier"
          htmlFor="up_amount"
          required
          error={touched ? amountError : undefined}
          hint={excess > 0 ? `${formatCurrency(excess)} over the bill — kept as advance credit.` : undefined}>
          
          <Input id="up_amount" type="number" min="0" step="0.01" value={amount} onChange={(event) => setAmount(event.target.value)} />
        </Field>
        <Field label="Payment date" htmlFor="up_date" required>
          <Input id="up_date" type="date" value={date} onChange={(event) => setDate(event.target.value)} />
        </Field>
      </div>
      <Field
        label="Supplier receipt reference"
        htmlFor="up_reference"
        required
        error={touched ? referenceError : undefined}
        hint="CEB / Water Board receipt or bank transfer ID the customer gave you.">
        
        <Input id="up_reference" value={reference} onChange={(event) => setReference(event.target.value)} placeholder="CEB-ONLINE-TXN-998822" />
      </Field>
      <Field label="Notes" htmlFor="up_notes">
        <Textarea id="up_notes" value={notes} onChange={(event) => setNotes(event.target.value)} />
      </Field>

      <div className="flex items-start gap-2.5 rounded-lg border border-brand-100 bg-brand-50 px-3 py-2.5 text-[13px] leading-relaxed text-brand-700">
        <InfoIcon className="mt-0.5 h-4 w-4 flex-none" aria-hidden="true" />
        <span>
          Recorded in the utility ledger only — never as rent or income.
          {excess > 0 ?
          ` The extra ${formatCurrency(excess)} is added to Room ${row?.room_number}'s credit and used on its next utility bills.` :
          credit > 0 ?
          ` Room ${row?.room_number} already holds ${formatCurrency(credit)} advance credit.` :
          ''}
        </span>
      </div>
    </FormModal>);

}