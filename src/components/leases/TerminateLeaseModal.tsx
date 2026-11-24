import { useEffect, useState } from 'react';
import {
  CheckCircle2Icon,
  DownloadIcon,
  ExternalLinkIcon,
  PlusIcon,
  PrinterIcon,
  Trash2Icon,
  WrenchIcon
} from 'lucide-react';
import { toast } from 'sonner';
import type { Lease, LeaveRoomResult, MoveOutRepair, RoomRepair } from '../../types';
import { ApiError, apiList, apiRequest } from '../../utils/api';
import { downloadClosingBillPdf, previewClosingBillPdf, printClosingBillPdf } from '../../utils/billPdf';
import { formatCurrency, formatDate, formatMonth, toNumber, today } from '../../utils/format';
import { depositBalance } from '../../utils/lookup';
import { Badge } from '../ui/Badge';
import { Button } from '../ui/Button';
import { Field, Input, Textarea } from '../ui/Field';
import { Modal } from '../ui/Modal';

interface MoveOutRepairDraft {
  key: string;
  cost: string;
  description: string;
}

interface TerminateLeaseModalProps {
  open: boolean;
  lease: Lease | null;
  mode?: 'terminate' | 'end-lease';
  /** Customer's minimum deposit threshold — shown for context only. */
  threshold?: number;
  onClose: () => void;
  onDone: () => void;
}

function makeDraft(): MoveOutRepairDraft {
  return { key: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`, cost: '', description: '' };
}

function rowText(item: Record<string, unknown>, keys: string[]): string {
  for (const k of keys) {
    if (item[k] !== undefined && item[k] !== null && item[k] !== '') return String(item[k]);
  }
  return '';
}

export function TerminateLeaseModal({
  open,
  lease,
  mode = 'terminate',
  threshold = 0,
  onClose,
  onDone
}: TerminateLeaseModalProps) {
  const [drafts, setDrafts] = useState<MoveOutRepairDraft[]>([makeDraft()]);
  const [forceClose, setForceClose] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);
  const [result, setResult] = useState<LeaveRoomResult | null>(null);
  const [loggedRegularRepairs, setLoggedRegularRepairs] = useState<RoomRepair[]>([]);
  const [loggedMoveOutRepairs, setLoggedMoveOutRepairs] = useState<MoveOutRepair[]>([]);
  const [repairsLoading, setRepairsLoading] = useState(false);
  const [repairsError, setRepairsError] = useState(false);

  useEffect(() => {
    if (!open) return;
    setDrafts([makeDraft()]);
    setForceClose(false);
    setError(null);
    setResult(null);
  }, [open, lease, mode]);

  // Pre-existing undeducted regular RoomRepairs and separate MoveOutRepairs
  // are both deducted automatically by the backend at lease end/termination.
  useEffect(() => {
    if (!open || !lease) return;
    let active = true;
    setRepairsLoading(true);
    setRepairsError(false);

    Promise.all([
      apiList<RoomRepair>('/api/repairs/').then((items) =>
        items.filter((item) => String(item.lease) === String(lease.id) && item.deducted_from_deposit !== true)
      ),
      apiList<MoveOutRepair>(`/api/move-out-repairs/?lease_id=${lease.id}&deducted_from_deposit=false`)
    ])
      .then(([regularItems, moveOutItems]) => {
        if (!active) return;
        setLoggedRegularRepairs(regularItems);
        setLoggedMoveOutRepairs(moveOutItems);
      })
      .catch(() => {
        if (!active) return;
        setLoggedRegularRepairs([]);
        setLoggedMoveOutRepairs([]);
        setRepairsError(true);
      })
      .finally(() => {
        if (active) setRepairsLoading(false);
      });

    return () => {
      active = false;
    };
  }, [open, lease]);

  const updateDraft = (key: string, patch: Partial<MoveOutRepairDraft>) =>
    setDrafts((prev) => prev.map((d) => (d.key === key ? { ...d, ...patch } : d)));

  const removeDraft = (key: string) =>
    setDrafts((prev) => (prev.length > 1 ? prev.filter((d) => d.key !== key) : prev));

  const remaining = depositBalance(lease);
  const regularTotal = loggedRegularRepairs.reduce((sum, item) => sum + toNumber(item.repair_cost), 0);
  const existingMoveOutTotal = loggedMoveOutRepairs.reduce((sum, item) => sum + toNumber(item.cost), 0);
  const newMoveOutTotal = drafts.reduce((sum, d) => sum + Math.max(0, toNumber(d.cost)), 0);
  const totalMoveOut = existingMoveOutTotal + newMoveOutTotal;
  const totalRepairs = regularTotal + totalMoveOut;
  const estimatedRefund = Math.max(0, remaining - totalRepairs);
  const estimatedOwed = Math.max(0, totalRepairs - remaining);

  const hasMissingDescription = drafts.some((d) => Math.max(0, toNumber(d.cost)) > 0 && !d.description.trim());
  const isBeforeEndDate = Boolean(mode === 'end-lease' && lease?.end_date && lease.end_date > today());
  const endDateBlocked = isBeforeEndDate && !forceClose;

  const handleSubmit = async () => {
    if (!lease || hasMissingDescription || endDateBlocked) return;
    setPending(true);
    setError(null);
    try {
      const validRepairs = drafts
        .map((d) => ({ cost: Math.max(0, toNumber(d.cost)), description: d.description.trim() }))
        .filter((r) => r.cost > 0);

      const body: Record<string, unknown> = {};
      if (validRepairs.length === 1) {
        body.move_out_repair_cost = validRepairs[0].cost;
        body.move_out_repair_description = validRepairs[0].description;
      } else if (validRepairs.length > 1) {
        body.move_out_repairs = validRepairs;
      }
      if (mode === 'end-lease' && forceClose) {
        body.force = true;
      }

      const endpoint =
        mode === 'end-lease' ? `/api/leases/${lease.id}/end-lease/` : `/api/leases/${lease.id}/terminate/`;
      const response = await apiRequest<LeaveRoomResult>(endpoint, {
        method: 'POST',
        body
      });
      setResult(response ?? {});
      toast.success(
        response?.message ??
          (mode === 'end-lease' ? 'Lease ended and closing bill generated.' : 'Lease terminated and closing bill generated.')
      );
      onDone();
    } catch (err) {
      const apiError = err instanceof ApiError ? err : new ApiError((err as Error).message, 0, 'http');
      setError(apiError);
      toast.error(apiError.message);
    } finally {
      setPending(false);
    }
  };

  const billData = result?.bill_data;
  const finalRefund = billData?.final_deposit_refund ?? billData?.deposit_refund ?? result?.final_deposit_refund ?? 0;
  const owed = toNumber(billData?.amount_owed_by_customer ?? result?.amount_owed_by_customer);
  const depositBefore = billData?.deposit_before_repairs ?? result?.deposit_before_repairs ?? remaining;
  const moveOutRepairCost = billData?.move_out_repair_cost ?? result?.move_out_repair_cost ?? 0;
  const regularRepairCost = billData?.regular_room_repair_cost ?? result?.regular_room_repair_cost ?? 0;
  const totalDeducted = billData?.total_repairs_deducted ?? result?.total_repairs_deducted ?? 0;

  const isEndReached = mode === 'end-lease' || result?.termination_type === 'end_date_reached';
  const modalTitle = result
    ? isEndReached
      ? 'Lease ended — Closing bill'
      : 'Lease terminated — Closing bill'
    : isEndReached
      ? `End lease at end date · #${lease?.id ?? ''}`
      : `Terminate lease #${lease?.id ?? ''}`;

  const unpaidRentBills = billData?.unpaid_bills ?? [];
  const unpaidElecBills = billData?.unpaid_electricity_bills ?? [];
  const unpaidWaterBills = billData?.unpaid_water_bills ?? [];

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={modalTitle}
      description={
        result
          ? `${result.customer_name ?? lease?.customer_name ?? 'Tenant'} · Room ${result.room_number ?? lease?.room_number ?? '—'}`
          : `${lease?.customer_name ?? 'Tenant'} · Room ${lease?.room_number ?? '—'} — special move-out repairs and regular tenancy repairs are deducted from the deposit to produce the closing bill.`
      }
      size={result ? 'lg' : 'md'}
      footer={
        result ? (
          <>
            <Button variant="secondary" icon={ExternalLinkIcon} onClick={() => previewClosingBillPdf(result)}>
              Preview PDF
            </Button>
            <Button variant="secondary" icon={PrinterIcon} onClick={() => printClosingBillPdf(result)}>
              Print
            </Button>
            <Button
              variant="secondary"
              icon={DownloadIcon}
              onClick={() => {
                downloadClosingBillPdf(result);
                toast.success('Closing bill PDF downloaded.');
              }}
            >
              Download closing bill
            </Button>
            <Button onClick={onClose}>Done</Button>
          </>
        ) : (
          <>
            <Button variant="secondary" onClick={onClose} disabled={pending}>
              Cancel
            </Button>
            <Button
              variant={isEndReached ? 'primary' : 'danger'}
              onClick={handleSubmit}
              loading={pending}
              disabled={repairsLoading || endDateBlocked}
            >
              {isEndReached ? 'End lease & issue closing bill' : 'Terminate lease & issue closing bill'}
            </Button>
          </>
        )
      }
    >
      {result ? (
        <div className="space-y-4 py-1">
          <div className="flex flex-col items-center gap-2 text-center">
            <span className="flex h-10 w-10 items-center justify-center rounded-full bg-success-50 text-success-600">
              <CheckCircle2Icon className="h-5 w-5" aria-hidden="true" />
            </span>
            <p className="text-[13px] text-ink-muted">
              {result.message ?? (isEndReached ? 'Lease ended at end date.' : 'Lease terminated.')}
              {result.lease_end_date && ` · End date: ${formatDate(result.lease_end_date)}`}
            </p>
          </div>

          <div className="rounded-xl border border-line bg-subtle px-4 py-4 text-center">
            <p className="text-[12px] text-ink-soft">Final deposit refund</p>
            <p className="mt-1 text-[30px] font-semibold tracking-[-0.02em] text-ink">
              {formatCurrency(finalRefund)}
            </p>
            {owed > 0 && (
              <p className="mt-1 text-[13px] font-medium text-danger-700">
                Customer still owes {formatCurrency(owed)} for repairs beyond the deposit
              </p>
            )}
          </div>

          <dl className="space-y-1.5 rounded-xl border border-line bg-surface px-4 py-3 text-[13px]">
            <div className="flex justify-between gap-4">
              <dt className="text-ink-muted">Deposit before repairs</dt>
              <dd className="font-medium text-ink">{formatCurrency(depositBefore)}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-ink-muted">Move-out special room repairs</dt>
              <dd className="font-medium text-ink">− {formatCurrency(moveOutRepairCost)}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-ink-muted">Regular tenancy repairs</dt>
              <dd className="font-medium text-ink">− {formatCurrency(regularRepairCost)}</dd>
            </div>
            <div className="flex justify-between gap-4 border-t border-line pt-1.5">
              <dt className="font-medium text-ink">Total repairs deducted</dt>
              <dd className="font-semibold text-ink">− {formatCurrency(totalDeducted)}</dd>
            </div>
          </dl>

          {((result.move_out_repairs && result.move_out_repairs.length > 0) ||
            (result.regular_room_repairs && result.regular_room_repairs.length > 0) ||
            (result.deducted_repairs && result.deducted_repairs.length > 0)) && (
            <div className="space-y-2">
              <h4 className="text-[13px] font-semibold text-ink">Repairs deducted from deposit</h4>
              <ul className="divide-y divide-line rounded-lg border border-line">
                {result.move_out_repairs?.length || result.regular_room_repairs?.length ? (
                  <>
                    {(result.move_out_repairs ?? []).map((item) => (
                      <li key={`mo-${item.id}`} className="flex items-start justify-between gap-4 px-3 py-2 text-[13px]">
                        <span className="min-w-0">
                          <span className="flex items-center gap-2">
                            <span className="font-medium text-ink">{item.description || 'Move-out repair'}</span>
                            <Badge tone="brand">Move-out special</Badge>
                          </span>
                          {item.date_recorded && (
                            <span className="text-[12px] text-ink-soft">{formatDate(item.date_recorded)}</span>
                          )}
                        </span>
                        <span className="whitespace-nowrap font-medium text-ink">{formatCurrency(item.cost)}</span>
                      </li>
                    ))}
                    {(result.regular_room_repairs ?? []).map((item) => (
                      <li key={`reg-${item.id}`} className="flex items-start justify-between gap-4 px-3 py-2 text-[13px]">
                        <span className="min-w-0">
                          <span className="flex items-center gap-2">
                            <span className="text-ink">{item.description || 'Room repair'}</span>
                            <Badge tone="neutral">Regular</Badge>
                          </span>
                          {item.date_logged && (
                            <span className="text-[12px] text-ink-soft">{formatDate(item.date_logged)}</span>
                          )}
                        </span>
                        <span className="whitespace-nowrap font-medium text-ink">{formatCurrency(item.cost)}</span>
                      </li>
                    ))}
                  </>
                ) : (
                  (result.deducted_repairs ?? []).map((item, idx) => (
                    <li key={`${item.id}-${idx}`} className="flex items-start justify-between gap-4 px-3 py-2 text-[13px]">
                      <span className="min-w-0">
                        <span className="flex items-center gap-2">
                          <span className="text-ink">{item.description || 'Repair'}</span>
                          {item.repair_category && (
                            <Badge tone={item.repair_category === 'move_out_repair' ? 'brand' : 'neutral'}>
                              {item.repair_category === 'move_out_repair' ? 'Move-out special' : 'Regular'}
                            </Badge>
                          )}
                        </span>
                        {(item.date_recorded ?? item.date_logged) && (
                          <span className="text-[12px] text-ink-soft">
                            {formatDate(item.date_recorded ?? item.date_logged)}
                          </span>
                        )}
                      </span>
                      <span className="whitespace-nowrap font-medium text-ink">{formatCurrency(item.cost)}</span>
                    </li>
                  ))
                )}
              </ul>
            </div>
          )}

          {billData && (
            <div className="space-y-3 rounded-xl border border-line bg-subtle p-4">
              <div className="flex items-baseline justify-between gap-3">
                <h4 className="text-[13px] font-semibold text-ink">Closing bill balances (3 separate recipients)</h4>
                <span className="text-[13px] font-semibold text-ink">
                  Total unpaid: {formatCurrency(billData.total_outstanding_fee ?? 0)}
                </span>
              </div>
              <dl className="grid gap-3 sm:grid-cols-3">
                <div className="rounded-lg border border-line bg-surface px-3 py-2">
                  <dt className="text-[11px] text-ink-soft">Property manager (rent)</dt>
                  <dd className="mt-0.5 text-sm font-semibold text-ink">
                    {formatCurrency(billData.payable_to_property_manager ?? 0)}
                  </dd>
                </div>
                <div className="rounded-lg border border-line bg-surface px-3 py-2">
                  <dt className="text-[11px] text-ink-soft">Electricity supplier (LECO)</dt>
                  <dd className="mt-0.5 text-sm font-semibold text-ink">
                    {formatCurrency(billData.payable_to_electricity_supplier ?? 0)}
                  </dd>
                </div>
                <div className="rounded-lg border border-line bg-surface px-3 py-2">
                  <dt className="text-[11px] text-ink-soft">Water supplier (NWSDB)</dt>
                  <dd className="mt-0.5 text-sm font-semibold text-ink">
                    {formatCurrency(billData.payable_to_water_supplier ?? 0)}
                  </dd>
                </div>
              </dl>

              {unpaidRentBills.length > 0 && (
                <div className="text-[12px]">
                  <p className="font-medium text-ink-muted">Unpaid rent bills ({unpaidRentBills.length})</p>
                  <ul className="mt-1 space-y-1">
                    {unpaidRentBills.map((b, idx) => (
                      <li key={idx} className="flex justify-between gap-3 text-ink">
                        <span>
                          {formatMonth(rowText(b, ['billing_month'])) || `Bill #${rowText(b, ['id', 'bill_id'])}`}
                        </span>
                        <span className="font-medium">
                          {formatCurrency(rowText(b, ['remaining_balance', 'total_amount_due', 'payable_to_property_manager']))}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {unpaidElecBills.length > 0 && (
                <div className="text-[12px]">
                  <p className="font-medium text-ink-muted">Unpaid electricity bills ({unpaidElecBills.length})</p>
                  <ul className="mt-1 space-y-1">
                    {unpaidElecBills.map((b, idx) => (
                      <li key={idx} className="flex justify-between gap-3 text-ink">
                        <span>
                          {formatMonth(rowText(b, ['billing_month'])) || formatDate(rowText(b, ['billing_date']))}
                        </span>
                        <span className="font-medium">
                          {formatCurrency(rowText(b, ['remaining_balance', 'electricity_cost']))}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {unpaidWaterBills.length > 0 && (
                <div className="text-[12px]">
                  <p className="font-medium text-ink-muted">Unpaid water bills ({unpaidWaterBills.length})</p>
                  <ul className="mt-1 space-y-1">
                    {unpaidWaterBills.map((b, idx) => (
                      <li key={idx} className="flex justify-between gap-3 text-ink">
                        <span>
                          {formatMonth(rowText(b, ['billing_month'])) || formatDate(rowText(b, ['billing_date']))}
                        </span>
                        <span className="font-medium">
                          {formatCurrency(rowText(b, ['remaining_balance', 'water_cost']))}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          {error && (
            <div role="alert" className="rounded-lg border border-danger-100 bg-danger-50 px-3 py-2.5 text-[13px] text-danger-700">
              {error.message}
            </div>
          )}

          <div className="grid gap-3 rounded-xl border border-line bg-subtle px-4 py-3 sm:grid-cols-4">
            <div>
              <p className="text-[12px] text-ink-soft">Remaining deposit</p>
              <p className="mt-0.5 text-sm font-semibold text-ink">{formatCurrency(remaining)}</p>
            </div>
            <div>
              <p className="text-[12px] text-ink-soft">Regular repairs</p>
              <p className="mt-0.5 text-sm font-semibold text-ink">− {formatCurrency(regularTotal)}</p>
            </div>
            <div>
              <p className="text-[12px] text-ink-soft">Move-out repairs</p>
              <p className="mt-0.5 text-sm font-semibold text-ink">− {formatCurrency(totalMoveOut)}</p>
            </div>
            <div>
              <p className="text-[12px] text-ink-soft">{estimatedOwed > 0 ? 'Customer owes' : 'Estimated refund'}</p>
              <p className={`mt-0.5 text-sm font-semibold ${estimatedOwed > 0 ? 'text-danger-700' : 'text-brand-700'}`}>
                {formatCurrency(estimatedOwed > 0 ? estimatedOwed : estimatedRefund)}
              </p>
            </div>
          </div>

          {isBeforeEndDate && (
            <div className="space-y-2 rounded-lg border border-warn-100 bg-warn-50 px-3.5 py-2.5 text-[13px] text-warn-700">
              <p>
                This lease&apos;s end date ({formatDate(lease?.end_date)}) has not been reached yet.
              </p>
              <label className="inline-flex cursor-pointer items-center gap-2 font-medium">
                <input
                  type="checkbox"
                  className="h-4 w-4 accent-brand-600"
                  checked={forceClose}
                  onChange={(event) => setForceClose(event.target.checked)}
                />
                <span>Force close at end-date endpoint before {formatDate(lease?.end_date)}</span>
              </label>
            </div>
          )}

          {loggedMoveOutRepairs.length > 0 && (
            <section aria-labelledby="logged-moveout-repairs-heading" className="space-y-2">
              <h3 id="logged-moveout-repairs-heading" className="text-[13px] font-semibold text-ink">
                Pre-recorded move-out special repairs
              </h3>
              <ul className="divide-y divide-line rounded-lg border border-line">
                {loggedMoveOutRepairs.map((item) => (
                  <li key={item.id} className="flex items-start justify-between gap-4 px-3 py-2 text-[13px]">
                    <span className="min-w-0">
                      <span className="block font-medium text-ink">{item.description || 'Move-out repair'}</span>
                      {item.date_recorded && <span className="text-[12px] text-ink-soft">{formatDate(item.date_recorded)}</span>}
                    </span>
                    <span className="whitespace-nowrap font-medium text-ink">{formatCurrency(item.cost)}</span>
                  </li>
                ))}
              </ul>
            </section>
          )}

          <section aria-labelledby="logged-repairs-heading" className="space-y-2">
            <h3 id="logged-repairs-heading" className="text-[13px] font-semibold text-ink">
              Regular repairs logged during this tenancy
            </h3>
            {repairsLoading ? (
              <p className="text-[13px] text-ink-soft">Checking repairs…</p>
            ) : repairsError ? (
              <p className="text-[13px] text-warn-700">
                Couldn&apos;t load logged repairs. Existing repairs will still be deducted when the lease closes.
              </p>
            ) : loggedRegularRepairs.length === 0 ? (
              <p className="text-[13px] text-ink-soft">No outstanding regular tenancy repairs on this lease.</p>
            ) : (
              <ul className="divide-y divide-line rounded-lg border border-line">
                {loggedRegularRepairs.map((item) => (
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
                ))}
              </ul>
            )}
          </section>

          <section className="space-y-3">
            <div className="flex items-center justify-between gap-3">
              <h3 className="text-[13px] font-semibold text-ink">
                New move-out special repairs (optional)
              </h3>
              <Button
                type="button"
                variant="secondary"
                size="sm"
                icon={PlusIcon}
                onClick={() => setDrafts((prev) => [...prev, makeDraft()])}
              >
                Add repair
              </Button>
            </div>
            <div className="space-y-3">
              {drafts.map((draft, index) => {
                const missingDesc = Math.max(0, toNumber(draft.cost)) > 0 && !draft.description.trim();
                return (
                  <div key={draft.key} className="grid gap-3 rounded-lg border border-line bg-subtle/40 p-3 sm:grid-cols-[150px_1fr_auto]">
                    <Field label="Move-out cost" htmlFor={`mo_cost_${index}`}>
                      <Input
                        id={`mo_cost_${index}`}
                        type="number"
                        min="0"
                        step="0.01"
                        value={draft.cost}
                        onChange={(event) => updateDraft(draft.key, { cost: event.target.value })}
                        placeholder="0.00"
                      />
                    </Field>
                    <Field
                      label="Special repair description"
                      htmlFor={`mo_desc_${index}`}
                      error={missingDesc ? 'Describe the move-out repair.' : undefined}
                    >
                      <Textarea
                        id={`mo_desc_${index}`}
                        value={draft.description}
                        onChange={(event) => updateDraft(draft.key, { description: event.target.value })}
                        placeholder="Wall repainting, door lock replacement…"
                      />
                    </Field>
                    {drafts.length > 1 && (
                      <div className="flex items-end pb-1">
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          icon={Trash2Icon}
                          aria-label="Remove repair row"
                          className="text-danger-600 hover:bg-danger-50 hover:text-danger-700"
                          onClick={() => removeDraft(draft.key)}
                        />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </section>

          <p className="text-[12px] leading-relaxed text-ink-soft">
            {threshold > 0
              ? `The ${formatCurrency(threshold)} minimum deposit held back for this lease is used for repairs first. `
              : ''}
            Move-out special repairs are stored separately, all undeducted repairs are taken from the deposit, and closing
            bill data is generated immediately. This cannot be undone.
          </p>
        </div>
      )}
    </Modal>
  );
}