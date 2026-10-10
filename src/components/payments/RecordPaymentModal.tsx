import React, { useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import type { Bill, ID, Payment, PaymentMethod } from '../../types';
import { ApiError, apiRequest } from '../../utils/api';
import { formatCurrency, formatMonth, toNumber, today } from '../../utils/format';
import { billOutstanding } from '../../utils/lookup';
import { Field, Input, Select } from '../ui/Field';
import { FormModal } from '../ui/FormModal';

interface RecordPaymentModalProps {
  open: boolean;
  bills: Bill[];
  preselectedBillId?: ID | null;
  onClose: () => void;
  onSaved: () => void;
}

const methods: {value: PaymentMethod;label: string;}[] = [
{ value: 'cash', label: 'Cash' },
{ value: 'bank_transfer', label: 'Bank transfer' },
{ value: 'cheque', label: 'Cheque' },
{ value: 'card', label: 'Card' }];


export function RecordPaymentModal({ open, bills, preselectedBillId, onClose, onSaved }: RecordPaymentModalProps) {
  const [billId, setBillId] = useState('');
  const [amount, setAmount] = useState('');
  const [date, setDate] = useState(today());
  const [method, setMethod] = useState<PaymentMethod>('cash');
  const [reference, setReference] = useState('');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);
  const [touched, setTouched] = useState(false);

  const outstandingBills = useMemo(() => {
    const withBalance = bills.filter(
      (bill) => billOutstanding(bill) > 0 || String(bill.id) === String(preselectedBillId)
    );
    // If the API does not expose paid amounts, fall back to every bill so a
    // payment can still be recorded against any of them.
    return withBalance.length ? withBalance : bills;
  }, [bills, preselectedBillId]);

  const selectedBill = bills.find((bill) => String(bill.id) === billId);

  useEffect(() => {
    if (!open) return;
    setTouched(false);
    setError(null);
    setDate(today());
    setMethod('cash');
    setReference('');
    const initial = preselectedBillId ? String(preselectedBillId) : outstandingBills[0] ? String(outstandingBills[0].id) : '';
    setBillId(initial);
    const bill = bills.find((item) => String(item.id) === initial);
    setAmount(bill ? String(billOutstanding(bill)) : '');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, preselectedBillId]);

  const handleBillChange = (value: string) => {
    setBillId(value);
    const bill = bills.find((item) => String(item.id) === value);
    setAmount(bill ? String(billOutstanding(bill)) : '');
  };

  const handleSubmit = async () => {
    setTouched(true);
    if (!billId || toNumber(amount) <= 0) return;
    setPending(true);
    setError(null);
    try {
      await apiRequest<Payment>('/api/payments/', {
        method: 'POST',
        body: {
          bill: toNumber(billId),
          amount: toNumber(amount),
          payment_date: date,
          method,
          reference: reference.trim()
        }
      });
      toast.success('Payment recorded.');
      onSaved();
      onClose();
    } catch (err) {
      const apiError = err instanceof ApiError ? err : new ApiError((err as Error).message, 0, 'http');
      setError(apiError);
      toast.error(apiError.message);
    } finally {
      setPending(false);
    }
  };

  const outstanding = selectedBill ? billOutstanding(selectedBill) : 0;
  const overpaying = selectedBill ? toNumber(amount) > outstanding : false;

  return (
    <FormModal
      open={open}
      onClose={onClose}
      onSubmit={handleSubmit}
      title="Record payment"
      description="Manual entry — payments are always recorded against a specific bill."
      submitLabel="Record payment"
      pending={pending}
      error={error}>
      
      <Field
        label="Bill"
        htmlFor="payment_bill"
        required
        error={touched && !billId ? 'Select a bill.' : undefined}
        hint={outstandingBills.length ? undefined : 'Every bill is fully settled.'}>
        
        <Select id="payment_bill" value={billId} onChange={(event) => handleBillChange(event.target.value)}>
          <option value="">Select bill…</option>
          {outstandingBills.map((bill) =>
          <option key={bill.id} value={bill.id}>
              #{bill.id} · {bill.customer_name ?? 'Tenant'} · Room {bill.room_number ?? '—'} ·{' '}
              {formatMonth(bill.billing_month)} · due {formatCurrency(billOutstanding(bill))}
            </option>
          )}
        </Select>
      </Field>

      {selectedBill &&
      <div className="grid gap-3 rounded-xl border border-line bg-subtle px-4 py-3 sm:grid-cols-3">
          <div>
            <p className="text-[11px] uppercase tracking-wide text-ink-soft">Total due</p>
            <p className="mt-0.5 text-sm font-semibold text-ink">{formatCurrency(selectedBill.total_due)}</p>
          </div>
          <div>
            <p className="text-[11px] uppercase tracking-wide text-ink-soft">Already paid</p>
            <p className="mt-0.5 text-sm font-semibold text-ink">{formatCurrency(selectedBill.amount_paid)}</p>
          </div>
          <div>
            <p className="text-[11px] uppercase tracking-wide text-ink-soft">Outstanding</p>
            <p className="mt-0.5 text-sm font-semibold text-brand-700">{formatCurrency(outstanding)}</p>
          </div>
        </div>
      }

      <div className="grid gap-4 sm:grid-cols-2">
        <Field
          label="Amount"
          htmlFor="payment_amount"
          required
          error={touched && toNumber(amount) <= 0 ? 'Enter an amount greater than zero.' : undefined}
          hint={overpaying ? 'This is more than the outstanding balance.' : undefined}>
          
          <Input
            id="payment_amount"
            type="number"
            min="0"
            step="0.01"
            value={amount}
            onChange={(event) => setAmount(event.target.value)} />
          
        </Field>
        <Field label="Payment date" htmlFor="payment_date" required>
          <Input id="payment_date" type="date" value={date} onChange={(event) => setDate(event.target.value)} />
        </Field>
        <Field label="Method" htmlFor="payment_method">
          <Select id="payment_method" value={method} onChange={(event) => setMethod(event.target.value as PaymentMethod)}>
            {methods.map((item) =>
            <option key={item.value} value={item.value}>
                {item.label}
              </option>
            )}
          </Select>
        </Field>
        <Field label="Reference" htmlFor="payment_reference" hint="Receipt or transfer reference (optional).">
          <Input
            id="payment_reference"
            value={reference}
            onChange={(event) => setReference(event.target.value)}
            placeholder="RCPT-1042" />
          
        </Field>
      </div>
    </FormModal>);

}