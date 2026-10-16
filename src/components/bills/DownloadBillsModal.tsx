import React, { useEffect, useMemo, useState } from 'react';
import { DownloadIcon, FileTextIcon } from 'lucide-react';
import { toast } from 'sonner';
import type { Bill } from '../../types';
import { type BillPdfSources, buildBillBundle, downloadBillsPdf } from '../../utils/billPdf';
import { formatCurrency, formatMonth, monthInputValue } from '../../utils/format';
import { billRentDue } from '../../utils/lookup';
import { Button } from '../ui/Button';
import { Field, Input } from '../ui/Field';
import { Modal } from '../ui/Modal';

interface DownloadBillsModalProps {
  open: boolean;
  onClose: () => void;
  bills: Bill[];
  sources: BillPdfSources;
  defaultMonth?: string;
}

type Scope = 'all' | 'selected';

export function DownloadBillsModal({ open, onClose, bills, sources, defaultMonth }: DownloadBillsModalProps) {
  const months = useMemo(() => {
    const unique = Array.from(new Set(bills.map((bill) => monthInputValue(bill.billing_month)).filter(Boolean)));
    return unique.sort().reverse();
  }, [bills]);

  const [month, setMonth] = useState('');
  const [scope, setScope] = useState<Scope>('all');
  const [selected, setSelected] = useState<number[]>([]);

  useEffect(() => {
    if (!open) return;
    setScope('all');
    setSelected([]);
    setMonth(defaultMonth || months[0] || new Date().toISOString().slice(0, 7));
  }, [open, defaultMonth, months]);

  const monthBills = useMemo(
    () =>
    bills.
    filter((bill) => monthInputValue(bill.billing_month) === month).
    sort((a, b) => (a.room_number ?? '').localeCompare(b.room_number ?? '', undefined, { numeric: true })),
    [bills, month]
  );

  useEffect(() => {
    setSelected([]);
  }, [month]);

  const chosen = scope === 'all' ? monthBills : monthBills.filter((bill) => selected.includes(bill.id));
  const total = chosen.reduce((sum, bill) => sum + billRentDue(bill), 0);

  const toggle = (id: number) =>
  setSelected((prev) => prev.includes(id) ? prev.filter((value) => value !== id) : [...prev, id]);

  const handleDownload = () => {
    if (!chosen.length) return;
    downloadBillsPdf(
      chosen.map((bill) => buildBillBundle(bill, sources)),
      month
    );
    toast.success(
      chosen.length === 1 ?
      `Bill for ${chosen[0].customer_name ?? 'tenant'} downloaded` :
      `${chosen.length} bills downloaded as one PDF`
    );
    onClose();
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Download bills"
      description="One PDF per tenant with rent, their own electricity and water, the deposit position and the last three months of utilities."
      size="md"
      footer={
      <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button icon={DownloadIcon} onClick={handleDownload} disabled={!chosen.length}>
            {chosen.length > 1 ? `Download ${chosen.length} bills` : 'Download PDF'}
          </Button>
        </>
      }>
      
      <div className="space-y-5">
        <Field label="Billing month" htmlFor="download_month" hint="Only months with generated bills can be downloaded.">
          <Input id="download_month" type="month" value={month} onChange={(event) => setMonth(event.target.value)} />
        </Field>

        <fieldset>
          <legend className="text-[13px] font-medium text-ink">Who to include</legend>
          <div className="mt-2 grid gap-2 sm:grid-cols-2">
            {(
            [
            { value: 'all', label: 'All customers', hint: `${monthBills.length} billed this month` },
            { value: 'selected', label: 'Selected customers', hint: 'Pick individual tenants' }] as
            const).
            map((option) =>
            <label
              key={option.value}
              className={`flex cursor-pointer items-start gap-2.5 rounded-lg border px-3 py-2.5 transition-colors duration-150 ease-out ${
              scope === option.value ? 'border-brand-600 bg-brand-50' : 'border-line bg-surface hover:bg-canvas'}`
              }>
              
                <input
                type="radio"
                name="download_scope"
                className="mt-0.5 h-4 w-4 accent-brand-600"
                checked={scope === option.value}
                onChange={() => setScope(option.value)} />
              
                <span className="min-w-0">
                  <span className="block text-[13px] font-medium text-ink">{option.label}</span>
                  <span className="block text-[12px] text-ink-soft">{option.hint}</span>
                </span>
              </label>
            )}
          </div>
        </fieldset>

        {scope === 'selected' &&
        <div className="rounded-xl border border-line">
            <div className="flex items-center justify-between gap-3 border-b border-line px-3 py-2">
              <p className="text-[12px] text-ink-muted">
                {selected.length} of {monthBills.length} selected
              </p>
              <div className="flex gap-1">
                <Button variant="ghost" size="sm" onClick={() => setSelected(monthBills.map((bill) => bill.id))}>
                  Select all
                </Button>
                <Button variant="ghost" size="sm" onClick={() => setSelected([])}>
                  Clear
                </Button>
              </div>
            </div>
            <div className="max-h-56 overflow-y-auto p-1.5">
              {monthBills.length === 0 ?
            <p className="px-2 py-3 text-[13px] text-ink-soft">No bills generated for this month yet.</p> :

            monthBills.map((bill) =>
            <label
              key={bill.id}
              className="flex cursor-pointer items-center gap-2.5 rounded-lg px-2 py-2 hover:bg-canvas">
              
                    <input
                type="checkbox"
                className="h-4 w-4 accent-brand-600"
                checked={selected.includes(bill.id)}
                onChange={() => toggle(bill.id)} />
              
                    <span className="min-w-0 flex-1 truncate text-[13px] text-ink">
                      {bill.customer_name ?? `Lease #${bill.lease}`}
                      <span className="ml-2 text-ink-soft">Room {bill.room_number ?? '—'}</span>
                    </span>
                    <span className="whitespace-nowrap text-[12px] text-ink-muted">{formatCurrency(billRentDue(bill))}</span>
                  </label>
            )
            }
            </div>
          </div>
        }

        <div className="flex items-center gap-2.5 rounded-lg bg-subtle px-3 py-2.5">
          <FileTextIcon className="h-4 w-4 flex-none text-ink-soft" aria-hidden="true" />
          <p className="text-[12px] leading-relaxed text-ink-muted">
            {chosen.length === 0 ?
            `Nothing to download for ${formatMonth(`${month}-01`)}.` :
            `${chosen.length} ${chosen.length === 1 ? 'bill' : 'bills'} for ${formatMonth(`${month}-01`)} totalling ${formatCurrency(total)}${
            chosen.length > 1 ? ' — a single PDF with one page per tenant.' : '.'}`
            }
          </p>
        </div>
      </div>
    </Modal>);

}