import React, { useEffect, useState } from 'react';
import { CheckCircle2Icon, WrenchIcon } from 'lucide-react';
import { toast } from 'sonner';
import type { Lease, LeaveRoomResult, RoomRepair } from '../../types';
import { ApiError, apiList, apiRequest } from '../../utils/api';
import { formatCurrency, formatDate, toNumber } from '../../utils/format';
import { depositBalance } from '../../utils/lookup';
import { Button } from '../ui/Button';
import { Field, Input, Textarea } from '../ui/Field';
import { Modal } from '../ui/Modal';

interface TerminateLeaseModalProps {
  open: boolean;
  lease: Lease | null;
  /** Customer's minimum deposit threshold — shown for context only. */
  threshold?: number;
  onClose: () => void;
  onDone: () => void;
}

export function TerminateLeaseModal({ open, lease, threshold = 0, onClose, onDone }: TerminateLeaseModalProps) {
  const [repairCost, setRepairCost] = useState('');
  const [description, setDescription] = useState('');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);
  const [result, setResult] = useState<LeaveRoomResult | null>(null);
  const [loggedRepairs, setLoggedRepairs] = useState<RoomRepair[]>([]);
  const [repairsLoading, setRepairsLoading] = useState(false);
  const [repairsError, setRepairsError] = useState(false);

  useEffect(() => {
    if (!open) return;
    setRepairCost('');
    setDescription('');
    setError(null);
    setResult(null);
  }, [open, lease]);

  // Repairs already logged against this lease and not yet taken from the deposit
  // are deducted automatically by the server when the tenant leaves.
  useEffect(() => {
    if (!open || !lease) return;
    let active = true;
    setRepairsLoading(true);
    setRepairsError(false);
    apiList<RoomRepair>('/api/repairs/').
    then((items) => {
      if (!active) return;
      setLoggedRepairs(
        items.filter((item) => String(item.lease) === String(lease.id) && item.deducted_from_deposit !== true)
      );
    }).
    catch(() => {
      if (!active) return;
      setLoggedRepairs([]);
      setRepairsError(true);
    }).
    finally(() => {
      if (active) setRepairsLoading(false);
    });
    return () => {
      active = false;
    };
  }, [open, lease]);

  const remaining = depositBalance(lease);
  const loggedTotal = loggedRepairs.reduce((sum, item) => sum + toNumber(item.repair_cost), 0);
  const moveOutCost = Math.max(0, toNumber(repairCost));
  const totalRepairs = loggedTotal + moveOutCost;
  const estimatedRefund = Math.max(0, remaining - totalRepairs);
  const estimatedOwed = Math.max(0, totalRepairs - remaining);
  const descriptionMissing = moveOutCost > 0 && !description.trim();

  const handleSubmit = async () => {
    if (!lease || descriptionMissing) return;
    setPending(true);
    setError(null);
    try {
      const body: Record<string, unknown> = {};
      if (moveOutCost > 0) {
        body.repair_cost = moveOutCost;
        body.repair_description = description.trim();
      }
      const response = await apiRequest<LeaveRoomResult>(`/api/leases/${lease.id}/terminate/`, {
        method: 'POST',
        body
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

  const owed = result ? toNumber(result.amount_owed_by_customer) : 0;

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={result ? 'Lease terminated' : `Terminate lease #${lease?.id ?? ''}`}
      description={
      result ?
      undefined :
      `${lease?.customer_name ?? 'Tenant'} · Room ${lease?.room_number ?? '—'} — all repairs are deducted from the remaining deposit before the refund.`
      }
      size="md"
      footer={
      result ?
      <Button onClick={onClose}>Done</Button> :

      <>
            <Button variant="secondary" onClick={onClose} disabled={pending}>
              Cancel
            </Button>
            <Button variant="danger" onClick={handleSubmit} loading={pending} disabled={repairsLoading}>
              Terminate lease
            </Button>
          </>

      }>
      
      {result ?
      <div className="space-y-4 py-2">
          <div className="flex flex-col items-center gap-3 text-center">
            <span className="flex h-11 w-11 items-center justify-center rounded-full bg-success-50 text-success-600">
              <CheckCircle2Icon className="h-5 w-5" aria-hidden="true" />
            </span>
            <p className="text-[13px] text-ink-muted">{result.message ?? 'Lease terminated.'}</p>
          </div>

          <div className="rounded-xl border border-line bg-subtle px-4 py-4 text-center">
            <p className="text-[12px] text-ink-soft">Final deposit refund</p>
            <p className="mt-1 text-[30px] font-semibold tracking-[-0.02em] text-ink">
              {formatCurrency(result.final_deposit_refund ?? 0)}
            </p>
            {owed > 0 &&
          <p className="mt-1 text-[13px] font-medium text-danger-700">
                Customer still owes {formatCurrency(owed)} for repairs
              </p>
          }
          </div>

          <dl className="space-y-1.5 text-[13px]">
            <div className="flex justify-between gap-4">
              <dt className="text-ink-muted">Deposit before repairs</dt>
              <dd className="font-medium text-ink">{formatCurrency(result.deposit_before_repairs ?? remaining)}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-ink-muted">Repairs deducted</dt>
              <dd className="font-medium text-ink">− {formatCurrency(result.total_repairs_deducted ?? 0)}</dd>
            </div>
          </dl>

          {result.deducted_repairs && result.deducted_repairs.length > 0 &&
        <ul className="divide-y divide-line rounded-lg border border-line">
              {result.deducted_repairs.map((item) =>
          <li key={item.id} className="flex items-start justify-between gap-4 px-3 py-2 text-[13px]">
                  <span className="min-w-0">
                    <span className="block text-ink">{item.description || 'Repair'}</span>
                    {item.date_logged && <span className="text-[12px] text-ink-soft">{formatDate(item.date_logged)}</span>}
                  </span>
                  <span className="whitespace-nowrap font-medium text-ink">{formatCurrency(item.cost)}</span>
                </li>
          )}
            </ul>
        }
        </div> :

      <div className="space-y-4">
          {error &&
        <div role="alert" className="rounded-lg border border-danger-100 bg-danger-50 px-3 py-2.5 text-[13px] text-danger-700">
              {error.message}
            </div>
        }

          <div className="grid gap-3 rounded-xl border border-line bg-subtle px-4 py-3 sm:grid-cols-3">
            <div>
              <p className="text-[12px] text-ink-soft">Remaining deposit</p>
              <p className="mt-0.5 text-sm font-semibold text-ink">{formatCurrency(remaining)}</p>
            </div>
            <div>
              <p className="text-[12px] text-ink-soft">All repairs</p>
              <p className="mt-0.5 text-sm font-semibold text-ink">− {formatCurrency(totalRepairs)}</p>
            </div>
            <div>
              <p className="text-[12px] text-ink-soft">{estimatedOwed > 0 ? 'Customer owes' : 'Estimated refund'}</p>
              <p className={`mt-0.5 text-sm font-semibold ${estimatedOwed > 0 ? 'text-danger-700' : 'text-brand-700'}`}>
                {formatCurrency(estimatedOwed > 0 ? estimatedOwed : estimatedRefund)}
              </p>
            </div>
          </div>

          <section aria-labelledby="logged-repairs-heading" className="space-y-2">
            <h3 id="logged-repairs-heading" className="text-[13px] font-semibold text-ink">
              Repairs logged during this tenancy
            </h3>
            {repairsLoading ?
          <p className="text-[13px] text-ink-soft">Checking repairs…</p> :
          repairsError ?
          <p className="text-[13px] text-warn-700">
                Couldn't load logged repairs. The server will still deduct them when the lease is terminated.
              </p> :
          loggedRepairs.length === 0 ?
          <p className="text-[13px] text-ink-soft">No outstanding repairs on this lease.</p> :

          <ul className="divide-y divide-line rounded-lg border border-line">
                {loggedRepairs.map((item) =>
            <li key={item.id} className="flex items-start justify-between gap-4 px-3 py-2 text-[13px]">
                    <span className="flex min-w-0 items-start gap-2">
                      <WrenchIcon className="mt-0.5 h-3.5 w-3.5 shrink-0 text-ink-soft" aria-hidden="true" />
                      <span className="min-w-0">
                        <span className="block text-ink">{item.repair_description || 'Repair'}</span>
                        <span className="text-[12px] text-ink-soft">{formatDate(item.repair_date)}</span>
                      </span>
                    </span>
                    <span className="whitespace-nowrap font-medium text-ink">{formatCurrency(item.repair_cost)}</span>
                  </li>
            )}
              </ul>
          }
          </section>

          <div className="grid gap-4 sm:grid-cols-[160px_1fr]">
            <Field label="Move-out repair cost" htmlFor="repair_cost" hint="Optional — new damage found today.">
              <Input
              id="repair_cost"
              type="number"
              min="0"
              step="0.01"
              value={repairCost}
              onChange={(event) => setRepairCost(event.target.value)}
              placeholder="0.00" />
            
            </Field>
            <Field
            label="Repair description"
            htmlFor="repair_description"
            error={descriptionMissing ? 'Describe the move-out repair.' : undefined}>
            
              <Textarea
              id="repair_description"
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              placeholder="Wall painting, door lock replacement…" />
            
            </Field>
          </div>
          <p className="text-[12px] leading-relaxed text-ink-soft">
            {threshold > 0 ? `The ${formatCurrency(threshold)} minimum deposit held back for this customer is used for repairs first. ` : ''}
            The server deducts every repair from the remaining deposit, marks them as settled and ends the lease. This
            cannot be undone from the portal.
          </p>
        </div>
      }
    </Modal>);

}