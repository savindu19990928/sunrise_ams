import React, { useMemo, useState } from 'react';
import { BanknoteIcon, CheckCircle2Icon, RefreshCwIcon } from 'lucide-react';
import type { Bill, OverduePayment } from '../types';
import { useBillingData } from '../hooks/useBillingData';
import { useResource } from '../hooks/useResource';
import { RecordPaymentModal } from '../components/payments/RecordPaymentModal';
import { ApiErrorState } from '../components/ui/ApiErrorState';
import { Badge, type BadgeTone } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import { Card, CardHeader } from '../components/ui/Card';
import { type Column, DataTable } from '../components/ui/DataTable';
import { PageHeader } from '../components/ui/PageHeader';
import { formatCurrency, formatDate, toNumber } from '../utils/format';

function severity(days: number): BadgeTone {
  if (days >= 30) return 'danger';
  if (days >= 14) return 'warn';
  return 'neutral';
}

export function Overdue() {
  const { data, loading, error, reload } = useResource<OverduePayment[]>('/api/payments/overdue/');
  const { bills, reloadAll } = useBillingData();
  const [payingBill, setPayingBill] = useState<Bill | null>(null);
  const [paymentOpen, setPaymentOpen] = useState(false);

  const rows = useMemo(() => Array.isArray(data) ? data : [], [data]);

  const totals = useMemo(
    () => ({
      owed: rows.reduce((sum, row) => sum + toNumber(row.owed), 0),
      worst: rows.reduce((max, row) => Math.max(max, toNumber(row.days_overdue)), 0)
    }),
    [rows]
  );

  const columns: Column<OverduePayment>[] = [
  {
    key: 'customer',
    header: 'Tenant',
    primary: true,
    render: (row) =>
    <div>
          <span className="font-medium text-ink">{row.customer}</span>
          <span className="ml-2 text-[12px] text-ink-soft">Bill #{row.bill_id}</span>
        </div>

  },
  { key: 'room', header: 'Room', render: (row) => <span className="text-ink">{row.room}</span> },
  { key: 'due', header: 'Due date', render: (row) => <span className="whitespace-nowrap text-ink-muted">{formatDate(row.due_date)}</span> },
  {
    key: 'days',
    header: 'Days overdue',
    render: (row) => <Badge tone={severity(toNumber(row.days_overdue))}>{row.days_overdue} days</Badge>
  },
  {
    key: 'owed',
    header: 'Amount owed',
    align: 'right',
    render: (row) => <span className="font-semibold text-danger-600">{formatCurrency(row.owed)}</span>
  }];


  return (
    <div className="space-y-5">
      <PageHeader
        title="Overdue payments"
        description="Bills past their due date with an outstanding balance, straight from the server's overdue check."
        actions={
        <Button variant="secondary" icon={RefreshCwIcon} onClick={reload}>
            Refresh
          </Button>
        } />
      

      {/* The money at risk is the point of this screen, so it leads. */}
      <div className="grid gap-4 lg:grid-cols-3">
        <div className="rounded-xl border border-danger-100 bg-danger-50 p-5 lg:col-span-2">
          <p className="text-[13px] font-medium text-danger-700">Total outstanding past due</p>
          <p className="mt-1.5 text-[34px] font-semibold leading-tight tracking-[-0.02em] text-danger-700 sm:text-[40px]">
            {formatCurrency(totals.owed)}
          </p>
          <p className="mt-1.5 text-[13px] text-danger-700/80">
            {rows.length} overdue {rows.length === 1 ? 'bill' : 'bills'}
            {totals.worst > 0 ? ` · oldest is ${totals.worst} days past due` : ''}
          </p>
        </div>
        <div className="rounded-xl border border-line bg-surface p-5 shadow-card">
          <p className="text-[13px] text-ink-muted">Next step</p>
          <p className="mt-1.5 text-sm leading-relaxed text-ink">
            Follow up with the tenant, then record the payment against the bill to clear it from this list.
          </p>
          <Button
            className="mt-3"
            icon={BanknoteIcon}
            onClick={() => {
              setPayingBill(null);
              setPaymentOpen(true);
            }}>
            
            Record payment
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader title="Overdue bills" description="Sorted by how long they have been outstanding." />
        {error ?
        <ApiErrorState error={error} onRetry={reload} /> :

        <DataTable
          columns={columns}
          rows={rows}
          keyOf={(row) => row.bill_id}
          loading={loading}
          emptyTitle="Nothing overdue"
          emptyDescription="Every bill past its due date has been settled."
          rowActions={(row) =>
          <Button
            variant="secondary"
            size="sm"
            icon={BanknoteIcon}
            onClick={() => {
              const bill = bills.find((item) => item.id === row.bill_id) ?? null;
              setPayingBill(bill);
              setPaymentOpen(true);
            }}>
            
                Record payment
              </Button>
          }
          footer={
          rows.length ?
          <span className="flex items-center gap-1.5">
                  <CheckCircle2Icon className="h-3.5 w-3.5 text-ink-soft" aria-hidden="true" />
                  Recording a full payment removes the bill from this list automatically.
                </span> :
          undefined
          } />

        }
      </Card>

      <RecordPaymentModal
        open={paymentOpen}
        bills={bills}
        preselectedBillId={payingBill?.id ?? null}
        onClose={() => {
          setPaymentOpen(false);
          setPayingBill(null);
        }}
        onSaved={() => {
          reload();
          reloadAll();
        }} />
      
    </div>);

}