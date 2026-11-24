import { useEffect, useState } from 'react';
import type { Lease } from '../../types';
import { useAction } from '../../hooks/useAction';
import { formatCurrency, formatDate } from '../../utils/format';
import { depositBalance } from '../../utils/lookup';
import { Field, Input } from '../ui/Field';
import { FormModal } from '../ui/FormModal';

interface ExtendLeaseModalProps {
  open: boolean;
  lease: Lease | null;
  onClose: () => void;
  onDone: () => void;
}

export function ExtendLeaseModal({ open, lease, onClose, onDone }: ExtendLeaseModalProps) {
  const [endDate, setEndDate] = useState('');
  const [touched, setTouched] = useState(false);
  const extendAction = useAction();

  useEffect(() => {
    if (!open) return;
    setTouched(false);
    extendAction.setError(null);
    setEndDate(lease?.end_date ?? '');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, lease]);

  const dateError = !endDate
    ? 'Select a new end date.'
    : lease?.start_date && endDate < lease.start_date
      ? 'End date must be on or after the lease start date.'
      : undefined;

  const handleSubmit = async () => {
    setTouched(true);
    if (!lease || dateError) return;
    const response = await extendAction.run<Lease>(
      `/api/leases/${lease.id}/extend/`,
      { end_date: endDate },
      (updated) => {
        const refund =
          updated?.expected_deposit_refund_at_end_date !== undefined &&
          updated?.expected_deposit_refund_at_end_date !== null
            ? ` Expected deposit refund at end date: ${formatCurrency(updated.expected_deposit_refund_at_end_date)}.`
            : '';
        return `Lease #${lease.id} extended to ${formatDate(endDate)}.${refund}`;
      }
    );
    if (!response) return;
    onDone();
    onClose();
  };

  return (
    <FormModal
      open={open}
      onClose={onClose}
      onSubmit={handleSubmit}
      title={lease ? `Extend lease #${lease.id}` : 'Extend lease'}
      description={
        lease ? `${lease.customer_name ?? 'Tenant'} · Room ${lease.room_number ?? '—'}` : undefined
      }
      submitLabel="Update end date"
      pending={extendAction.pending}
      error={extendAction.error}
      size="sm"
    >
      {lease && (
        <dl className="grid grid-cols-2 gap-3 rounded-xl border border-line bg-subtle px-4 py-3 text-[13px]">
          <div>
            <dt className="text-[12px] text-ink-soft">Current period</dt>
            <dd className="mt-0.5 font-medium text-ink">
              {formatDate(lease.start_date)} → {lease.end_date ? formatDate(lease.end_date) : '—'}
            </dd>
          </div>
          <div>
            <dt className="text-[12px] text-ink-soft">Remaining deposit</dt>
            <dd className="mt-0.5 font-semibold text-ink">{formatCurrency(depositBalance(lease))}</dd>
          </div>
          {lease.expected_deposit_refund_at_end_date !== undefined &&
            lease.expected_deposit_refund_at_end_date !== null && (
              <div className="col-span-2 border-t border-line pt-2">
                <dt className="text-[12px] text-ink-soft">Current expected refund at end date</dt>
                <dd className="mt-0.5 font-semibold text-brand-700">
                  {formatCurrency(lease.expected_deposit_refund_at_end_date)}
                </dd>
              </div>
            )}
        </dl>
      )}

      <Field
        label="New end date"
        htmlFor="extend_lease_end_date"
        required
        error={touched ? dateError : undefined}
      >
        <Input
          id="extend_lease_end_date"
          type="date"
          min={lease?.start_date || undefined}
          value={endDate}
          onChange={(event) => setEndDate(event.target.value)}
        />
      </Field>

      <p className="rounded-lg border border-brand-100 bg-brand-50 px-3 py-2.5 text-[12px] leading-relaxed text-brand-700">
        Extending a lease does not require any additional security deposit. Expected deposit refund at end date and
        generated bills will update automatically.
      </p>
    </FormModal>
  );
}
