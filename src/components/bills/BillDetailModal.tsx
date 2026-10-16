import React, { useMemo } from 'react';
import { BanknoteIcon, DownloadIcon, ExternalLinkIcon, PrinterIcon } from 'lucide-react';
import { toast } from 'sonner';
import type { Bill } from '../../types';
import {
  type BillPdfSources,
  buildBillBundle,
  downloadBillPdf,
  previewBillPdf,
  printBillPdf } from
'../../utils/billPdf';
import { formatCurrency, formatDate, formatMonth, titleCase, toNumber } from '../../utils/format';
import { billOutstanding, billRentDue, billStatus, billUtilities } from '../../utils/lookup';
import { BRAND_NAME, BRAND_TAGLINE } from '../../utils/pdf';
import { formatPerDay, formatUnits } from '../../utils/utilityUsage';
import { Badge, type BadgeTone } from '../ui/Badge';
import { Button } from '../ui/Button';
import { Modal } from '../ui/Modal';

const statusTone: Record<string, BadgeTone> = {
  paid: 'success',
  partial: 'warn',
  unpaid: 'danger'
};

interface BillDetailModalProps {
  bill: Bill | null;
  sources: BillPdfSources;
  onClose: () => void;
  onRecordPayment: (bill: Bill) => void;
}

function usageText(units: number | null | undefined, month: string): string {
  if (units === null || units === undefined) return '';
  return ` · ${formatUnits(units)} units · ${formatPerDay(units, month)}`;
}

function HistoryCell({ cost, units, month }: {cost: number | null;units: number | null;month: string;}) {
  if (cost === null) return <span className="text-ink-muted">Not recorded</span>;
  return (
    <>
      <span className="block text-ink">{formatCurrency(cost)}</span>
      {units !== null &&
      <span className="block whitespace-nowrap text-[11px] text-ink-muted">
          {formatUnits(units)} units · {formatPerDay(units, month)}
        </span>
      }
    </>);

}

function Line({ label, value, muted = false }: {label: string;value: string;muted?: boolean;}) {
  return (
    <div className="flex items-baseline justify-between gap-4 py-2">
      <dt className={muted ? 'text-[13px] text-ink-soft' : 'text-[13px] text-ink-muted'}>{label}</dt>
      <dd className={muted ? 'text-[13px] text-ink-soft' : 'text-sm text-ink'}>{value}</dd>
    </div>);

}

export function BillDetailModal({ bill, sources, onClose, onRecordPayment }: BillDetailModalProps) {
  const outstanding = bill ? billOutstanding(bill) : 0;
  const deduction = bill ? toNumber(bill.deposit_deduction) : 0;
  const bundle = useMemo(() => bill ? buildBillBundle(bill, sources) : null, [bill, sources]);
  const current = bundle?.history.find((row) => row.isCurrent);

  const handleDownload = () => {
    if (!bundle) return;
    downloadBillPdf(bundle);
    toast.success(`Bill #${bundle.bill.id} downloaded`);
  };

  const handlePreview = () => {
    if (bundle) previewBillPdf(bundle);
  };

  const handlePrint = () => {
    if (bundle) printBillPdf(bundle);
  };

  return (
    <Modal
      open={Boolean(bill)}
      onClose={onClose}
      title={bill ? `Bill #${bill.id}` : 'Bill'}
      description={bill ? `${bill.customer_name ?? 'Tenant'} · Room ${bill.room_number ?? '—'} · ${formatMonth(bill.billing_month)}` : undefined}
      size="md"
      footer={
      <>
          <Button variant="secondary" icon={ExternalLinkIcon} onClick={handlePreview}>
            Preview
          </Button>
          <Button variant="secondary" icon={PrinterIcon} onClick={handlePrint}>
            Print
          </Button>
          <Button variant="secondary" icon={DownloadIcon} onClick={handleDownload}>
            Download
          </Button>
          {bill && outstanding > 0 &&
        <Button icon={BanknoteIcon} onClick={() => onRecordPayment(bill)}>
              Record rent payment
            </Button>
        }
        </>
      }>
      
      {bill &&
      <div className="rounded-xl border border-bill-line bg-bill-paper p-4 sm:p-5">
          <div className="flex items-start justify-between gap-4 border-b border-bill-line pb-3">
            <div className="flex min-w-0 items-center gap-2.5">
              <span
              className="flex h-8 w-8 flex-none items-center justify-center rounded-lg bg-bill-accent text-sm font-bold text-white"
              aria-hidden="true">
              
                S
              </span>
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-ink">{BRAND_NAME}</p>
                <p className="truncate text-[11px] text-ink-muted">{BRAND_TAGLINE}</p>
              </div>
            </div>
            <div className="flex-none text-right">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-bill-accent">Monthly bill</p>
              <p className="text-sm font-semibold text-ink">#{bill.id}</p>
            </div>
          </div>

          <div className="mt-4 space-y-5">
            <div className="flex flex-wrap items-center gap-2">
              <Badge tone={statusTone[billStatus(bill)] ?? 'neutral'}>{titleCase(billStatus(bill))}</Badge>
              <span className="text-[13px] text-ink-muted">Due {formatDate(bill.due_date)}</span>
            </div>

            <div className="overflow-hidden rounded-xl border border-bill-line bg-white/60">
              <dl className="divide-y divide-bill-line px-4">
                <Line label="Room rent" value={formatCurrency(bill.rent)} />
                {deduction > 0 ?
              <Line label="Less deposit deduction" value={`− ${formatCurrency(deduction)}`} /> :

              <Line label="Deposit deduction — minimum deposit reached" value="None" muted />
              }
              </dl>
              <div className="flex items-baseline justify-between gap-4 border-t border-bill-line bg-bill-tint px-4 py-3">
                <p className="text-sm font-medium text-ink">Rent payable</p>
                <p className="text-[22px] font-semibold tracking-[-0.02em] text-bill-accent">
                  {formatCurrency(billRentDue(bill))}
                </p>
              </div>
            </div>

            <div className="rounded-xl border border-bill-line bg-white/60 px-4">
              <dl className="divide-y divide-bill-line">
                <Line label="Deposit balance after this bill" value={formatCurrency(bill.remaining_deposit)} />
                <Line label="Rent paid so far" value={formatCurrency(bill.amount_paid)} />
                <div className="flex items-baseline justify-between gap-4 py-2.5">
                  <dt className="text-sm font-medium text-ink">Rent outstanding</dt>
                  <dd className={`text-sm font-semibold ${outstanding > 0 ? 'text-danger-600' : 'text-success-600'}`}>
                    {formatCurrency(outstanding)}
                  </dd>
                </div>
              </dl>
            </div>

            <div>
              <div className="flex items-baseline justify-between gap-3">
                <h3 className="text-[13px] font-medium text-ink">Utilities this month</h3>
                <p className="text-[12px] text-ink-muted">Paid directly to the supplier</p>
              </div>
              <dl className="mt-1 divide-y divide-bill-line rounded-xl border border-bill-line bg-white/60 px-4">
                <Line label={`Electricity${usageText(current?.electricityUnits, bill.billing_month)}`} value={formatCurrency(bill.electricity)} />
                <Line label={`Water${usageText(current?.waterUnits, bill.billing_month)}`} value={formatCurrency(bill.water)} />
                <div className="flex items-baseline justify-between gap-4 py-2.5">
                  <dt className="text-sm font-medium text-ink">Pay to supplier</dt>
                  <dd className="text-sm font-semibold text-ink">{formatCurrency(billUtilities(bill))}</dd>
                </div>
              </dl>
            </div>

            {bundle &&
          <div>
                <div className="flex items-baseline justify-between gap-3">
                  <h3 className="text-[13px] font-medium text-ink">Utility history</h3>
                  <p className="text-[12px] text-ink-muted">Included in the PDF</p>
                </div>
                <table className="mt-2 w-full text-[13px]">
                  <thead>
                    <tr className="text-left text-[11px] uppercase tracking-wide text-bill-accent">
                      <th scope="col" className="pb-1 font-medium">
                        Month
                      </th>
                      <th scope="col" className="pb-1 text-right font-medium">
                        Electricity
                      </th>
                      <th scope="col" className="pb-1 text-right font-medium">
                        Water
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-bill-line">
                    {bundle.history.map((row) =>
                <tr key={row.monthKey}>
                        <td className={`py-1.5 ${row.isCurrent ? 'font-medium text-ink' : 'text-ink-muted'}`}>
                          {formatMonth(`${row.monthKey}-01`)}
                          {row.isCurrent && <span className="ml-1.5 text-[11px] text-ink-muted">this bill</span>}
                        </td>
                        <td className="py-1.5 text-right align-top">
                          <HistoryCell cost={row.electricity} units={row.electricityUnits} month={`${row.monthKey}-01`} />
                        </td>
                        <td className="py-1.5 text-right align-top">
                          <HistoryCell cost={row.water} units={row.waterUnits} month={`${row.monthKey}-01`} />
                        </td>
                      </tr>
                )}
                  </tbody>
                </table>
              </div>
          }

            <p className="text-[12px] leading-relaxed text-ink-muted">
              {deduction > 0 ?
            `${formatCurrency(deduction)} of this month's rent is covered by the deposit. Deductions stop once the deposit balance falls to the lease's minimum deposit threshold — from then on the full rent is payable.` :
            "The deposit balance has reached the lease's minimum deposit threshold, so no deduction applies and the full rent is payable."}
            </p>
          </div>
        </div>
      }
    </Modal>);

}