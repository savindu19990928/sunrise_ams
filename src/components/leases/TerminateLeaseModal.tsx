import React, { useEffect, useState } from 'react';
import { CheckCircle2Icon } from 'lucide-react';
import { toast } from 'sonner';
import type { Lease } from '../../types';
import { ApiError, apiRequest } from '../../utils/api';
import { formatCurrency, toNumber } from '../../utils/format';
import { depositBalance } from '../../utils/lookup';
import { Button } from '../ui/Button';
import { Field, Input, Textarea } from '../ui/Field';
import { Modal } from '../ui/Modal';

interface TerminateLeaseModalProps {
  open: boolean;
  lease: Lease | null;
  onClose: () => void;
  onDone: () => void;
}

interface TerminateResponse {
  message?: string;
  final_deposit_refund?: number;
}

export function TerminateLeaseModal({ open, lease, onClose, onDone }: TerminateLeaseModalProps) {
  const [repairCost, setRepairCost] = useState('');
  const [description, setDescription] = useState('');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);
  const [result, setResult] = useState<TerminateResponse | null>(null);

  useEffect(() => {
    if (!open) return;
    setRepairCost('');
    setDescription('');
    setError(null);
    setResult(null);
  }, [open, lease]);

  const remaining = depositBalance(lease);
  const estimatedRefund = Math.max(0, remaining - toNumber(repairCost));

  const handleSubmit = async () => {
    if (!lease) return;
    setPending(true);
    setError(null);
    try {
      const response = await apiRequest<TerminateResponse>(`/api/leases/${lease.id}/terminate/`, {
        method: 'POST',
        body: {
          repair_cost: toNumber(repairCost),
          repair_description: description.trim()
        }
      });
      setResult(response ?? {});
      toast.success('Lease terminated.');
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
      title={result ? 'Lease terminated' : `Terminate lease #${lease?.id ?? ''}`}
      description={
      result ?
      undefined :
      `${lease?.customer_name ?? 'Tenant'} · Room ${lease?.room_number ?? '—'} — log any move-out repair so the refund is calculated correctly.`
      }
      size="md"
      footer={
      result ?
      <Button onClick={onClose}>Done</Button> :

      <>
            <Button variant="secondary" onClick={onClose} disabled={pending}>
              Cancel
            </Button>
            <Button variant="danger" onClick={handleSubmit} loading={pending}>
              Terminate lease
            </Button>
          </>

      }>
      
      {result ?
      <div className="flex flex-col items-center gap-3 py-4 text-center">
          <span className="flex h-11 w-11 items-center justify-center rounded-full bg-success-50 text-success-600">
            <CheckCircle2Icon className="h-5 w-5" aria-hidden="true" />
          </span>
          <p className="text-[13px] text-ink-muted">{result.message ?? 'Lease terminated.'}</p>
          <div className="w-full rounded-xl border border-line bg-subtle px-4 py-4">
            <p className="text-[12px] uppercase tracking-wide text-ink-soft">Final deposit refund</p>
            <p className="mt-1 text-[30px] font-semibold tracking-[-0.02em] text-ink">
              {formatCurrency(result.final_deposit_refund ?? 0)}
            </p>
          </div>
          <p className="text-[12px] leading-relaxed text-ink-soft">
            The room is released and any repair cost you entered has been recorded against it.
          </p>
        </div> :

      <div className="space-y-4">
          {error &&
        <div role="alert" className="rounded-lg border border-danger-100 bg-danger-50 px-3 py-2.5 text-[13px] text-danger-700">
              {error.message}
            </div>
        }

          <div className="grid gap-3 rounded-xl border border-line bg-subtle px-4 py-3 sm:grid-cols-3">
            <div>
              <p className="text-[11px] uppercase tracking-wide text-ink-soft">Remaining deposit</p>
              <p className="mt-0.5 text-sm font-semibold text-ink">{formatCurrency(remaining)}</p>
            </div>
            <div>
              <p className="text-[11px] uppercase tracking-wide text-ink-soft">Repair cost</p>
              <p className="mt-0.5 text-sm font-semibold text-ink">− {formatCurrency(repairCost || 0)}</p>
            </div>
            <div>
              <p className="text-[11px] uppercase tracking-wide text-ink-soft">Estimated refund</p>
              <p className="mt-0.5 text-sm font-semibold text-brand-700">{formatCurrency(estimatedRefund)}</p>
            </div>
          </div>

          <Field label="Repair cost" htmlFor="repair_cost" hint="Leave at 0 if there is nothing to repair.">
            <Input
            id="repair_cost"
            type="number"
            min="0"
            step="0.01"
            value={repairCost}
            onChange={(event) => setRepairCost(event.target.value)}
            placeholder="0.00" />
          
          </Field>
          <Field label="Repair description" htmlFor="repair_description">
            <Textarea
            id="repair_description"
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            placeholder="Wall painting, door lock replacement…" />
          
          </Field>
          <p className="text-[12px] leading-relaxed text-ink-soft">
            The server recalculates the deposit refund and marks the lease inactive. This cannot be undone from the portal.
          </p>
        </div>
      }
    </Modal>);

}