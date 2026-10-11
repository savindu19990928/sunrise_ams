import React, { useEffect, useState } from 'react';
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
  missingUtilityRooms?: (month: string) => string[];
}

interface GenerateResponse {
  message?: string;
  bill_ids?: ID[];
}

export function GenerateBillsModal({ open, onClose, onDone, missingUtilityRooms }: GenerateBillsModalProps) {
  const [month, setMonth] = useState(monthInputValue(firstOfCurrentMonth()));
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);
  const [result, setResult] = useState<GenerateResponse | null>(null);

  useEffect(() => {
    if (!open) return;
    setMonth(monthInputValue(firstOfCurrentMonth()));
    setError(null);
    setResult(null);
  }, [open]);

  const billingMonth = month ? `${month}-01` : firstOfCurrentMonth();
  const missing = missingUtilityRooms?.(billingMonth) ?? [];

  const handleGenerate = async () => {
    setPending(true);
    setError(null);
    try {
      const response = await apiRequest<GenerateResponse>('/api/bills/generate_monthly/', {
        method: 'POST',
        body: { billing_month: billingMonth }
      });
      setResult(response ?? {});
      toast.success(response?.message ?? 'Bills generated.');
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
      description={
      result ? undefined : 'One bill per active lease: (rent − deposit deduction) + electricity + water. Leases whose deposit is at or below the customer\u2019s minimum threshold are billed the full rent.'
      }
      size="md"
      footer={
      result ?
      <Button onClick={onClose}>Done</Button> :

      <>
            <Button variant="secondary" onClick={onClose} disabled={pending}>
              Cancel
            </Button>
            <Button onClick={handleGenerate} loading={pending}>
              Generate bills
            </Button>
          </>

      }>
      
      {result ?
      <div className="flex flex-col items-center gap-3 py-4 text-center">
          <span className="flex h-11 w-11 items-center justify-center rounded-full bg-success-50 text-success-600">
            <CheckCircle2Icon className="h-5 w-5" aria-hidden="true" />
          </span>
          <p className="text-sm font-medium text-ink">{result.message ?? 'Bills generated.'}</p>
          <p className="text-[13px] text-ink-muted">
            {result.bill_ids?.length ?
          `Bill IDs: ${result.bill_ids.join(', ')}` :
          'No new bills were needed for this month.'}
          </p>
        </div> :

      <div className="space-y-4">
          {error &&
        <div role="alert" className="rounded-lg border border-danger-100 bg-danger-50 px-3 py-2.5 text-[13px] text-danger-700">
              {error.message}
            </div>
        }
          <Field label="Billing month" htmlFor="billing_month" required hint={`Sent as ${billingMonth}.`}>
            <Input id="billing_month" type="month" value={month} onChange={(event) => setMonth(event.target.value)} />
          </Field>

          {missing.length > 0 &&
        <div className="flex items-start gap-2.5 rounded-lg border border-warn-100 bg-warn-50 px-3 py-2.5 text-[13px] leading-relaxed text-warn-700">
              <InfoIcon className="mt-0.5 h-4 w-4 flex-none" aria-hidden="true" />
              <span>
                No utility record yet for {formatMonth(billingMonth)} in room{missing.length > 1 ? 's' : ''}{' '}
                <span className="font-semibold">{missing.join(', ')}</span>. Those bills will show zero utilities until
                you enter the readings.
              </span>
            </div>
        }

          <p className="text-[12px] leading-relaxed text-ink-soft">
            Running this twice for the same month will not duplicate bills for leases that already have one.
          </p>
        </div>
      }
    </Modal>);

}