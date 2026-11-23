import { useEffect, useState } from 'react';
import { CheckCircle2Icon, InfoIcon } from 'lucide-react';
import { toast } from 'sonner';
import type { ID } from '../../types';
import { ApiError, apiRequest } from '../../utils/api';
import { firstOfCurrentMonth, formatMonth, monthInputValue } from '../../utils/format';
import { Button } from '../ui/Button';
import { Field, Input } from '../ui/Field';
import { Modal } from '../ui/Modal';

interface GenerateBillsModalProps {
  open: boolean;
  onClose: () => void;
  onDone: () => void;
  missingServiceRooms?: (month: string) => { electricity: string[]; water: string[]; };
}

interface GenerateResponse {
  message?: string;
  bill_ids?: ID[];
}

export function GenerateBillsModal({ open, onClose, onDone, missingServiceRooms }: GenerateBillsModalProps) {
  const [month, setMonth] = useState(monthInputValue(firstOfCurrentMonth()));
  const [regenerate, setRegenerate] = useState(false);
  const [reason, setReason] = useState('');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);
  const [result, setResult] = useState<GenerateResponse | null>(null);

  useEffect(() => {
    if (!open) return;
    setMonth(monthInputValue(firstOfCurrentMonth()));
    setRegenerate(false);
    setReason('');
    setError(null);
    setResult(null);
  }, [open]);

  const billingMonth = month ? `${month}-01` : firstOfCurrentMonth();
  const missing = missingServiceRooms?.(billingMonth) ?? { electricity: [], water: [] };

  const handleGenerate = async () => {
    setPending(true);
    setError(null);
    try {
      const endpoint = regenerate ? '/api/bills/regenerate-monthly/' : '/api/bills/generate_monthly/';
      const body: Record<string, unknown> = { billing_month: billingMonth };
      if (regenerate && reason.trim()) body.reason = reason.trim();
      const response = await apiRequest<GenerateResponse>(endpoint, {
        method: 'POST',
        body
      });
      setResult(response ?? {});
      toast.success(response?.message ?? (regenerate ? 'Bills regenerated.' : 'Bills generated.'));
      onDone();
    } catch (err) {
      const apiError = err instanceof ApiError ? err : new ApiError((err as Error).message, 0, 'http');
      setError(apiError);
      toast.error(apiError.message);
    } finally {
      setPending(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={result ? 'Bills generated' : 'Generate monthly bills'}
      size="md"
      footer={
        result ? (
          <Button onClick={onClose}>Done</Button>
        ) : (
          <>
            <Button variant="secondary" onClick={onClose} disabled={pending}>
              Cancel
            </Button>
            <Button onClick={handleGenerate} loading={pending}>
              Generate bills
            </Button>
          </>
        )
      }
    >
      {result ? (
        <div className="flex flex-col items-center gap-3 py-4 text-center">
          <span className="flex h-11 w-11 items-center justify-center rounded-full bg-success-50 text-success-600">
            <CheckCircle2Icon className="h-5 w-5" aria-hidden="true" />
          </span>
          <p className="text-sm font-medium text-ink">{result.message ?? 'Bills generated.'}</p>
          <p className="text-[13px] text-ink-muted">
            {result.bill_ids?.length
              ? `Bill IDs: ${result.bill_ids.join(', ')}`
              : 'No new bills were needed for this month.'}
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {error && (
            <div role="alert" className="rounded-lg border border-danger-100 bg-danger-50 px-3 py-2.5 text-[13px] text-danger-700">
              {error.message}
            </div>
          )}
          <Field label="Billing month" htmlFor="billing_month" required>
            <Input id="billing_month" type="month" value={month} onChange={(event) => setMonth(event.target.value)} />
          </Field>

          <label className="flex cursor-pointer items-center gap-2.5 rounded-lg border border-line bg-subtle px-3 py-2.5">
            <input
              type="checkbox"
              className="h-4 w-4 accent-brand-600"
              checked={regenerate}
              onChange={(event) => setRegenerate(event.target.checked)}
            />
            <span className="text-[13px] font-medium text-ink">Regenerate / recorrect existing bills</span>
          </label>

          {regenerate && (
            <Field label="Recorrection reason" htmlFor="bill_recorrection_reason">
              <Input
                id="bill_recorrection_reason"
                value={reason}
                onChange={(event) => setReason(event.target.value)}
                placeholder="Reason"
              />
            </Field>
          )}

          {missing.electricity.length > 0 && (
            <div className="flex items-start gap-2.5 rounded-lg border border-warn-100 bg-warn-50 px-3 py-2.5 text-[13px] leading-relaxed text-warn-700">
              <InfoIcon className="mt-0.5 h-4 w-4 flex-none" aria-hidden="true" />
              <span>
                Missing electricity readings for {formatMonth(billingMonth)}: room
                {missing.electricity.length > 1 ? 's' : ''}{' '}
                <span className="font-semibold">{missing.electricity.join(', ')}</span>.
              </span>
            </div>
          )}

          {missing.water.length > 0 && (
            <div className="flex items-start gap-2.5 rounded-lg border border-warn-100 bg-warn-50 px-3 py-2.5 text-[13px] leading-relaxed text-warn-700">
              <InfoIcon className="mt-0.5 h-4 w-4 flex-none" aria-hidden="true" />
              <span>
                Missing water readings for {formatMonth(billingMonth)}: room
                {missing.water.length > 1 ? 's' : ''}{' '}
                <span className="font-semibold">{missing.water.join(', ')}</span>.
              </span>
            </div>
          )}
        </div>
      )}
    </Modal>
  );
}
