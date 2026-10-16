import React, { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { BanknoteIcon, DownloadIcon, EyeIcon, ReceiptTextIcon, SparklesIcon, Trash2Icon } from 'lucide-react';
import { toast } from 'sonner';
import type { Bill, UtilityRecord } from '../types';
import { useBillingData } from '../hooks/useBillingData';
import { useCollection } from '../hooks/useResource';
import { useCrud } from '../hooks/useCrud';
import { BillDetailModal } from '../components/bills/BillDetailModal';
import { DownloadBillsModal } from '../components/bills/DownloadBillsModal';
import { GenerateBillsModal } from '../components/bills/GenerateBillsModal';
import { RecordPaymentModal } from '../components/payments/RecordPaymentModal';
import { ApiErrorState } from '../components/ui/ApiErrorState';
import { Badge, type BadgeTone } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import { Card, CardHeader } from '../components/ui/Card';
import { ConfirmDialog } from '../components/ui/ConfirmDialog';
import { type Column, DataTable } from '../components/ui/DataTable';
import { Field, Input, Select } from '../components/ui/Field';
import { PageHeader } from '../components/ui/PageHeader';
import { SearchInput } from '../components/ui/SearchInput';
import { type BillPdfSources, buildBillBundle, downloadBillPdf } from '../utils/billPdf';
import { formatCurrency, formatDate, formatMonth, monthInputValue, titleCase, toNumber } from '../utils/format';
import { billOutstanding, billRentDue, billStatus, billUtilities } from '../utils/lookup';

const statusTone: Record<string, BadgeTone> = { paid: 'success', partial: 'warn', unpaid: 'danger' };

export function Bills() {
  const [searchParams, setSearchParams] = useSearchParams();
  const { bills, leases, rooms, leaseMap, customerMap, roomMap, loading, error, reloadAll } = useBillingData();
  const { data: utilities } = useCollection<UtilityRecord>('/api/utilities/');
  const [generateOpen, setGenerateOpen] = useState(false);
  const [downloadOpen, setDownloadOpen] = useState(false);
  const [detail, setDetail] = useState<Bill | null>(null);
  const [payingBill, setPayingBill] = useState<Bill | null>(null);
  const [paymentOpen, setPaymentOpen] = useState(false);
  const [deleting, setDeleting] = useState<Bill | null>(null);
  const [month, setMonth] = useState('');
  const [status, setStatus] = useState('all');
  const [query, setQuery] = useState('');

  const crud = useCrud<Bill>('bills', {
    label: 'Bill',
    onDone: () => {
      reloadAll();
      setDeleting(null);
    }
  });

  useEffect(() => {
    if (searchParams.get('generate') === '1') {
      setGenerateOpen(true);
      searchParams.delete('generate');
      setSearchParams(searchParams, { replace: true });
    }
  }, [searchParams, setSearchParams]);

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return bills.filter((bill) => {
      const matchesMonth = !month || monthInputValue(bill.billing_month) === month;
      const matchesStatus = status === 'all' || billStatus(bill) === status;
      const matchesQuery =
      !needle || `${bill.customer_name ?? ''} ${bill.room_number ?? ''} ${bill.id}`.toLowerCase().includes(needle);
      return matchesMonth && matchesStatus && matchesQuery;
    });
  }, [bills, month, status, query]);

  const totals = useMemo(
    () => ({
      billed: filtered.reduce((sum, bill) => sum + billRentDue(bill), 0),
      collected: filtered.reduce((sum, bill) => sum + toNumber(bill.amount_paid), 0),
      outstanding: filtered.reduce((sum, bill) => sum + billOutstanding(bill), 0)
    }),
    [filtered]
  );

  const pdfSources: BillPdfSources = useMemo(
    () => ({ leaseMap, customerMap, roomMap, utilities }),
    [leaseMap, customerMap, roomMap, utilities]
  );

  const downloadOne = (bill: Bill) => {
    downloadBillPdf(buildBillBundle(bill, pdfSources));
    toast.success(`Bill #${bill.id} downloaded`);
  };

  const missingUtilityRooms = (billingMonth: string) => {
    const monthKey = monthInputValue(billingMonth);
    const covered = new Set(
      utilities.filter((record) => monthInputValue(record.billing_month) === monthKey).map((record) => record.room)
    );
    return leases.
    filter((lease) => lease.is_active && !covered.has(lease.room)).
    map((lease) => lease.room_number ?? roomMap.get(lease.room)?.room_number ?? `#${lease.room}`);
  };

  const columns: Column<Bill>[] = [
  {
    key: 'bill',
    header: 'Bill',
    primary: true,
    render: (bill) =>
    <div>
          <span className="font-medium text-ink">{bill.customer_name ?? `Lease #${bill.lease}`}</span>
          <span className="ml-2 text-[12px] text-ink-soft">#{bill.id}</span>
        </div>

  },
  { key: 'room', header: 'Room', render: (bill) => <span className="text-ink">{bill.room_number ?? '—'}</span> },
  { key: 'month', header: 'Month', render: (bill) => <span className="whitespace-nowrap text-ink-muted">{formatMonth(bill.billing_month)}</span> },
  { key: 'due', header: 'Due date', render: (bill) => <span className="whitespace-nowrap text-ink-muted">{formatDate(bill.due_date)}</span> },
  {
    key: 'total',
    header: 'Rent due',
    align: 'right',
    render: (bill) =>
    <span className="whitespace-nowrap">
          <span className="block font-semibold text-ink">{formatCurrency(billRentDue(bill))}</span>
          {toNumber(bill.deposit_deduction) > 0 &&
      <span className="block text-[12px] text-ink-soft">
              {formatCurrency(bill.rent)} − {formatCurrency(bill.deposit_deduction)} deposit
            </span>
      }
        </span>

  },
  {
    key: 'utilities',
    header: 'Utilities',
    align: 'right',
    render: (bill) =>
    <span className="whitespace-nowrap">
          <span className="block text-ink-muted">{formatCurrency(billUtilities(bill))}</span>
          <span className="block text-[12px] text-ink-soft">paid to supplier</span>
        </span>

  },
  {
    key: 'outstanding',
    header: 'Rent outstanding',
    align: 'right',
    render: (bill) => {
      const value = billOutstanding(bill);
      return <span className={value > 0 ? 'font-medium text-danger-600' : 'text-success-600'}>{formatCurrency(value)}</span>;
    }
  },
  {
    key: 'status',
    header: 'Status',
    render: (bill) => {
      const value = billStatus(bill);
      return <Badge tone={statusTone[value] ?? 'neutral'}>{titleCase(value)}</Badge>;
    }
  }];


  return (
    <div className="space-y-5">
      <PageHeader
        title="Bills"
        description="One bill per lease each month. Tenants pay rent less the deposit deduction here; electricity and water are shown for reference and paid directly to the supplier."
        actions={
        <>
            <Button
            variant="secondary"
            icon={BanknoteIcon}
            onClick={() => {
              setPayingBill(null);
              setPaymentOpen(true);
            }}>
            
              Record rent payment
            </Button>
            <Button variant="secondary" icon={DownloadIcon} onClick={() => setDownloadOpen(true)} disabled={!bills.length}>
              Download bills
            </Button>
            <Button icon={SparklesIcon} onClick={() => setGenerateOpen(true)}>
              Generate monthly bills
            </Button>
          </>
        } />
      

      <div className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-xl border border-line bg-surface p-4 shadow-card">
          <p className="text-[13px] text-ink-muted">Rent billed</p>
          <p className="mt-1.5 text-[22px] font-semibold tracking-[-0.02em] text-ink">{formatCurrency(totals.billed)}</p>
        </div>
        <div className="rounded-xl border border-line bg-surface p-4 shadow-card">
          <p className="text-[13px] text-ink-muted">Rent collected</p>
          <p className="mt-1.5 text-[22px] font-semibold tracking-[-0.02em] text-success-600">
            {formatCurrency(totals.collected)}
          </p>
        </div>
        <div className="rounded-xl border border-line bg-surface p-4 shadow-card">
          <p className="text-[13px] text-ink-muted">Rent outstanding</p>
          <p className="mt-1.5 text-[22px] font-semibold tracking-[-0.02em] text-danger-600">
            {formatCurrency(totals.outstanding)}
          </p>
        </div>
      </div>

      <Card>
        <CardHeader
          title={`${filtered.length} ${filtered.length === 1 ? 'bill' : 'bills'}`}
          description={`${rooms.length} rooms · ${leases.filter((lease) => lease.is_active).length} active leases`}
          actions={
          <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
              <SearchInput value={query} onChange={setQuery} placeholder="Search tenant or room" />
              <Field label="Month" htmlFor="bills_month" className="sm:w-40">
                <Input id="bills_month" type="month" value={month} onChange={(event) => setMonth(event.target.value)} />
              </Field>
              <Field label="Status" htmlFor="bills_status" className="sm:w-36">
                <Select id="bills_status" value={status} onChange={(event) => setStatus(event.target.value)}>
                  <option value="all">All</option>
                  <option value="unpaid">Unpaid</option>
                  <option value="partial">Partial</option>
                  <option value="paid">Paid</option>
                </Select>
              </Field>
            </div>
          } />
        
        {error ?
        <ApiErrorState error={error} onRetry={reloadAll} /> :

        <DataTable
          columns={columns}
          rows={filtered}
          keyOf={(bill) => bill.id}
          loading={loading}
          onRowClick={setDetail}
          emptyTitle={bills.length ? 'No bills match these filters' : 'No bills yet'}
          emptyDescription={
          bills.length ?
          'Clear the month or status filter to see more.' :
          'Enter utilities for the month, then generate bills for all active leases.'
          }
          emptyAction={
          bills.length ? undefined :
          <Button icon={ReceiptTextIcon} onClick={() => setGenerateOpen(true)}>
                  Generate monthly bills
                </Button>

          }
          rowActions={(bill) =>
          <>
                <Button variant="secondary" size="sm" icon={EyeIcon} onClick={() => setDetail(bill)}>
                  View
                </Button>
                <Button variant="ghost" size="sm" icon={DownloadIcon} onClick={() => downloadOne(bill)}>
                  PDF
                </Button>
                {billOutstanding(bill) > 0 &&
            <Button
              variant="ghost"
              size="sm"
              icon={BanknoteIcon}
              className="text-brand-700 hover:bg-brand-50"
              onClick={() => {
                setPayingBill(bill);
                setPaymentOpen(true);
              }}>
              
                    Pay
                  </Button>
            }
                <Button
              variant="ghost"
              size="sm"
              icon={Trash2Icon}
              className="text-danger-600 hover:bg-danger-50 hover:text-danger-700"
              onClick={() => setDeleting(bill)}>
              
                  Delete
                </Button>
              </>
          } />

        }
      </Card>

      <GenerateBillsModal
        open={generateOpen}
        onClose={() => setGenerateOpen(false)}
        onDone={reloadAll}
        missingUtilityRooms={missingUtilityRooms} />
      

      <DownloadBillsModal
        open={downloadOpen}
        onClose={() => setDownloadOpen(false)}
        bills={bills}
        sources={pdfSources}
        defaultMonth={month || undefined} />
      

      <BillDetailModal
        bill={detail}
        sources={pdfSources}
        onClose={() => setDetail(null)}
        onRecordPayment={(bill) => {
          setDetail(null);
          setPayingBill(bill);
          setPaymentOpen(true);
        }} />
      

      <RecordPaymentModal
        open={paymentOpen}
        bills={bills}
        preselectedBillId={payingBill?.id ?? null}
        onClose={() => {
          setPaymentOpen(false);
          setPayingBill(null);
        }}
        onSaved={reloadAll} />
      

      <ConfirmDialog
        open={Boolean(deleting)}
        title={`Delete bill #${deleting?.id ?? ''}?`}
        message="Payments already recorded against this bill may prevent deletion on the server."
        confirmLabel="Delete bill"
        danger
        pending={crud.pending}
        onConfirm={() => deleting && crud.remove(deleting.id)}
        onClose={() => setDeleting(null)} />
      
    </div>);

}