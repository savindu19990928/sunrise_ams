import React, { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { BanknoteIcon, Trash2Icon } from 'lucide-react';
import type { Payment } from '../types';
import { useBillingData } from '../hooks/useBillingData';
import { useCollection } from '../hooks/useResource';
import { useCrud } from '../hooks/useCrud';
import { RecordPaymentModal } from '../components/payments/RecordPaymentModal';
import { ApiErrorState } from '../components/ui/ApiErrorState';
import { Badge } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import { Card, CardHeader } from '../components/ui/Card';
import { ConfirmDialog } from '../components/ui/ConfirmDialog';
import { type Column, DataTable } from '../components/ui/DataTable';
import { Field, Input } from '../components/ui/Field';
import { PageHeader } from '../components/ui/PageHeader';
import { SearchInput } from '../components/ui/SearchInput';
import { firstOfCurrentMonth, formatCurrency, formatDate, titleCase, today, toNumber } from '../utils/format';
import { mapById } from '../utils/lookup';

export function Payments() {
  const [searchParams, setSearchParams] = useSearchParams();
  const { bills, reloadAll } = useBillingData();
  const { data: payments, loading, error, reload } = useCollection<Payment>('/api/payments/');
  const [paymentOpen, setPaymentOpen] = useState(false);
  const [deleting, setDeleting] = useState<Payment | null>(null);
  const [from, setFrom] = useState(firstOfCurrentMonth());
  const [to, setTo] = useState(today());
  const [query, setQuery] = useState('');

  const crud = useCrud<Payment>('payments', {
    label: 'Payment',
    onDone: () => {
      reload();
      reloadAll();
      setDeleting(null);
    }
  });

  useEffect(() => {
    if (searchParams.get('new') === '1') {
      setPaymentOpen(true);
      searchParams.delete('new');
      setSearchParams(searchParams, { replace: true });
    }
  }, [searchParams, setSearchParams]);

  const billMap = useMemo(() => mapById(bills), [bills]);

  const decorated = useMemo(
    () =>
    payments.map((payment) => {
      const bill = billMap.get(payment.bill);
      return {
        ...payment,
        customer_name: payment.customer_name ?? bill?.customer_name,
        room_number: payment.room_number ?? bill?.room_number
      };
    }),
    [payments, billMap]
  );

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return decorated.filter((payment) => {
      const date = payment.payment_date ?? '';
      const inRange = (!from || date >= from) && (!to || date <= to);
      const matchesQuery =
      !needle ||
      `${payment.customer_name ?? ''} ${payment.room_number ?? ''} ${payment.reference ?? ''} ${payment.bill}`.
      toLowerCase().
      includes(needle);
      return inRange && matchesQuery;
    });
  }, [decorated, from, to, query]);

  const total = filtered.reduce((sum, payment) => sum + toNumber(payment.amount), 0);

  const columns: Column<Payment>[] = [
  {
    key: 'customer',
    header: 'Tenant',
    primary: true,
    render: (payment) =>
    <div>
          <span className="font-medium text-ink">{payment.customer_name ?? `Bill #${payment.bill}`}</span>
          <span className="ml-2 text-[12px] text-ink-soft">Bill #{payment.bill}</span>
        </div>

  },
  { key: 'room', header: 'Room', render: (payment) => <span className="text-ink">{payment.room_number ?? '—'}</span> },
  {
    key: 'date',
    header: 'Paid on',
    render: (payment) => <span className="whitespace-nowrap text-ink-muted">{formatDate(payment.payment_date)}</span>
  },
  { key: 'method', header: 'Method', render: (payment) => <Badge>{titleCase(payment.method ?? 'cash')}</Badge> },
  { key: 'reference', header: 'Reference', render: (payment) => <span className="text-ink-muted">{payment.reference || '—'}</span> },
  {
    key: 'amount',
    header: 'Amount',
    align: 'right',
    render: (payment) => <span className="font-semibold text-ink">{formatCurrency(payment.amount)}</span>
  }];


  return (
    <div className="space-y-5">
      <PageHeader
        title="Payments"
        description="Every payment is recorded manually against a specific bill — there are no online payments."
        actions={
        <Button icon={BanknoteIcon} onClick={() => setPaymentOpen(true)}>
            Record payment
          </Button>
        } />
      

      <Card>
        <CardHeader
          title={`${filtered.length} ${filtered.length === 1 ? 'payment' : 'payments'}`}
          description={`Collected in range: ${formatCurrency(total)}`}
          actions={
          <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
              <SearchInput value={query} onChange={setQuery} placeholder="Search tenant or reference" />
              <Field label="From" htmlFor="payments_from" className="sm:w-40">
                <Input id="payments_from" type="date" value={from} onChange={(event) => setFrom(event.target.value)} />
              </Field>
              <Field label="To" htmlFor="payments_to" className="sm:w-40">
                <Input id="payments_to" type="date" value={to} onChange={(event) => setTo(event.target.value)} />
              </Field>
            </div>
          } />
        
        {error ?
        <ApiErrorState error={error} onRetry={reload} /> :

        <DataTable
          columns={columns}
          rows={filtered}
          keyOf={(payment) => payment.id}
          loading={loading}
          emptyTitle={payments.length ? 'No payments in this range' : 'No payments recorded yet'}
          emptyDescription={
          payments.length ?
          'Widen the date range or clear your search.' :
          'Record a payment against an outstanding bill to start tracking collections.'
          }
          emptyAction={
          payments.length ? undefined :
          <Button icon={BanknoteIcon} onClick={() => setPaymentOpen(true)}>
                  Record payment
                </Button>

          }
          footer={
          filtered.length ?
          <span>
                  Total collected: <span className="font-semibold text-ink">{formatCurrency(total)}</span>
                </span> :
          undefined
          }
          rowActions={(payment) =>
          <Button
            variant="ghost"
            size="sm"
            icon={Trash2Icon}
            className="text-danger-600 hover:bg-danger-50 hover:text-danger-700"
            onClick={() => setDeleting(payment)}>
            
                Delete
              </Button>
          } />

        }
      </Card>

      <RecordPaymentModal
        open={paymentOpen}
        bills={bills}
        onClose={() => setPaymentOpen(false)}
        onSaved={() => {
          reload();
          reloadAll();
        }} />
      

      <ConfirmDialog
        open={Boolean(deleting)}
        title="Delete this payment?"
        message={`${formatCurrency(deleting?.amount ?? 0)} recorded on ${formatDate(deleting?.payment_date)} will be removed and the bill balance recalculated.`}
        confirmLabel="Delete payment"
        danger
        pending={crud.pending}
        onConfirm={() => deleting && crud.remove(deleting.id)}
        onClose={() => setDeleting(null)} />
      
    </div>);

}