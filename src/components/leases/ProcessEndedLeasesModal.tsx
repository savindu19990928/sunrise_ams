import { useEffect, useMemo, useState } from 'react';
import { CalendarCheck2Icon, CheckCircle2Icon, DownloadIcon } from 'lucide-react';
import { toast } from 'sonner';
import type { ID, Lease, ProcessEndedLeasesResult } from '../../types';
import { useAction } from '../../hooks/useAction';
import { downloadClosingBillPdf } from '../../utils/billPdf';
import { formatCurrency, formatDate, toNumber, today } from '../../utils/format';
import { depositBalance } from '../../utils/lookup';
import { Button } from '../ui/Button';
import { Field, Input } from '../ui/Field';
import { Modal } from '../ui/Modal';

interface ProcessEndedLeasesModalProps {
  open: boolean;
  leases: Lease[];
  onClose: () => void;
  onDone: () => void;
}

interface RepairInput {
  cost: string;
  description: string;
}

export function ProcessEndedLeasesModal({ open, leases, onClose, onDone }: ProcessEndedLeasesModalProps) {
  const [asOfDate, setAsOfDate] = useState(today());
  const [repairsByLease, setRepairsByLease] = useState<Record<string, RepairInput>>({});
  const [result, setResult] = useState<ProcessEndedLeasesResult | null>(null);
  const processAction = useAction();

  useEffect(() => {
    if (!open) return;
    setAsOfDate(today());
    setRepairsByLease({});
    setResult(null);
    processAction.setError(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const matchingLeases = useMemo(
    () =>
      leases.filter(
        (lease) => lease.is_active && Boolean(lease.end_date) && (!asOfDate || (lease.end_date ?? '') <= asOfDate)
      ),
    [leases, asOfDate]
  );

  const updateRepair = (leaseId: ID, patch: Partial<RepairInput>) =>
    setRepairsByLease((prev) => {
      const existing = prev[String(leaseId)] ?? { cost: '', description: '' };
      return {
        ...prev,
        [String(leaseId)]: { ...existing, ...patch }
      };
    });

  const missingDescriptions = matchingLeases.some((lease) => {
    const entry = repairsByLease[String(lease.id)];
    return entry && toNumber(entry.cost) > 0 && !entry.description.trim();
  });

  const handleSubmit = async () => {
    if (!asOfDate || missingDescriptions) return;
    const leaseRepairs = matchingLeases
      .map((lease) => {
        const entry = repairsByLease[String(lease.id)];
        const cost = toNumber(entry?.cost);
        if (cost <= 0) return null;
        return {
          lease_id: lease.id,
          move_out_repair_cost: cost.toFixed(2),
          move_out_repair_description: entry.description.trim()
        };
      })
      .filter((item): item is NonNullable<typeof item> => Boolean(item));

    const body: Record<string, unknown> = { as_of_date: asOfDate };
    if (leaseRepairs.length > 0) body.lease_repairs = leaseRepairs;

    const response = await processAction.run<ProcessEndedLeasesResult>(
      '/api/leases/process-ended/',
      body,
      (res) => `Ended ${res?.ended_count ?? 0} expired lease(s).`
    );
    if (!response) return;
    setResult(response);
    onDone();
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={result ? 'Ended leases processed' : 'Process ended leases'}
      description={
        result
          ? `${result.ended_count ?? 0} lease(s) closed as of ${formatDate(result.as_of_date ?? asOfDate)}.`
          : 'Close all active leases whose end date has arrived, deduct move-out special repairs and regular repairs, and generate closing bill data.'
      }
      size="lg"
      footer={
        result ? (
          <Button onClick={onClose}>Done</Button>
        ) : (
          <>
            <Button variant="secondary" onClick={onClose} disabled={processAction.pending}>
              Cancel
            </Button>
            <Button
              icon={CalendarCheck2Icon}
              onClick={handleSubmit}
              loading={processAction.pending}
              disabled={!asOfDate || matchingLeases.length === 0 || missingDescriptions}
            >
              Process {matchingLeases.length} ended lease{matchingLeases.length === 1 ? '' : 's'}
            </Button>
          </>
        )
      }
    >
      {result ? (
        <div className="space-y-3 py-1">
          <div className="flex items-center gap-2 rounded-lg border border-success-100 bg-success-50 px-3.5 py-2.5 text-[13px] text-success-700">
            <CheckCircle2Icon className="h-4 w-4 flex-none" aria-hidden="true" />
            <span>
              {result.ended_count ?? 0} lease{result.ended_count === 1 ? '' : 's'} closed and settled.
            </span>
          </div>
          {(result.ended_leases ?? []).map((item, idx) => {
            const bill = item.bill_data;
            const refund = bill?.final_deposit_refund ?? bill?.deposit_refund ?? item.final_deposit_refund ?? 0;
            const moveOutCost = bill?.move_out_repair_cost ?? item.move_out_repair_cost ?? 0;
            const regularCost = bill?.regular_room_repair_cost ?? item.regular_room_repair_cost ?? 0;
            const outstanding = bill?.total_outstanding_fee ?? 0;
            return (
              <div key={item.lease_id ?? idx} className="rounded-xl border border-line bg-surface p-3.5">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="font-medium text-ink">
                      Room {item.room_number ?? '—'} · {item.customer_name ?? `Lease #${item.lease_id ?? ''}`}
                    </p>
                    <p className="text-[12px] text-ink-soft">
                      End date {formatDate(item.lease_end_date ?? bill?.lease_end_date)} · Move-out repairs{' '}
                      {formatCurrency(moveOutCost)} · Regular repairs {formatCurrency(regularCost)}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="text-right text-[12px]">
                      <p className="font-semibold text-ink">Refund: {formatCurrency(refund)}</p>
                      <p className="text-ink-muted">Outstanding bills: {formatCurrency(outstanding)}</p>
                    </div>
                    <Button
                      variant="secondary"
                      size="sm"
                      icon={DownloadIcon}
                      onClick={() => {
                        downloadClosingBillPdf(item);
                        toast.success(`Closing bill PDF downloaded for Room ${item.room_number ?? ''}.`);
                      }}
                    >
                      Closing bill PDF
                    </Button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="space-y-4">
          {processAction.error && (
            <div role="alert" className="rounded-lg border border-danger-100 bg-danger-50 px-3 py-2.5 text-[13px] text-danger-700">
              {processAction.error.message}
            </div>
          )}

          <Field label="As of date" htmlFor="process_ended_as_of" required className="sm:w-52">
            <Input
              id="process_ended_as_of"
              type="date"
              value={asOfDate}
              onChange={(event) => setAsOfDate(event.target.value)}
            />
          </Field>

          {matchingLeases.length === 0 ? (
            <p className="rounded-lg border border-line bg-subtle px-4 py-4 text-[13px] text-ink-muted">
              No active leases have reached their end date on or before {formatDate(asOfDate)}.
            </p>
          ) : (
            <div className="space-y-2.5">
              <p className="text-[13px] font-medium text-ink">
                {matchingLeases.length} active lease{matchingLeases.length === 1 ? '' : 's'} with end date &le;{' '}
                {formatDate(asOfDate)} (optional special move-out repair per room)
              </p>
              <div className="space-y-2.5">
                {matchingLeases.map((lease) => {
                  const entry = repairsByLease[String(lease.id)] ?? { cost: '', description: '' };
                  const needsDesc = toNumber(entry.cost) > 0 && !entry.description.trim();
                  return (
                    <div key={lease.id} className="rounded-lg border border-line bg-subtle/50 p-3">
                      <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2 text-[13px]">
                        <span className="font-medium text-ink">
                          Room {lease.room_number ?? '—'} · {lease.customer_name ?? `Lease #${lease.id}`}
                        </span>
                        <span className="text-[12px] text-ink-muted">
                          Ended {formatDate(lease.end_date)} · Deposit {formatCurrency(depositBalance(lease))}
                        </span>
                      </div>
                      <div className="grid gap-3 sm:grid-cols-[150px_1fr]">
                        <Field label="Move-out cost" htmlFor={`pe_cost_${lease.id}`}>
                          <Input
                            id={`pe_cost_${lease.id}`}
                            type="number"
                            min="0"
                            step="0.01"
                            value={entry.cost}
                            onChange={(event) => updateRepair(lease.id, { cost: event.target.value })}
                            placeholder="0.00"
                          />
                        </Field>
                        <Field
                          label="Special repair description"
                          htmlFor={`pe_desc_${lease.id}`}
                          error={needsDesc ? 'Enter a description.' : undefined}
                        >
                          <Input
                            id={`pe_desc_${lease.id}`}
                            value={entry.description}
                            onChange={(event) => updateRepair(lease.id, { description: event.target.value })}
                            placeholder="Optional move-out repair note"
                          />
                        </Field>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}
    </Modal>
  );
}
