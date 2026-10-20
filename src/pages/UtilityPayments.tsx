import React, { useMemo, useState } from 'react';
import { InfoIcon } from 'lucide-react';
import type { BuildingUtilityBill, UtilityPayment } from '../types';
import { useCollection } from '../hooks/useResource';
import { ApiErrorState } from '../components/ui/ApiErrorState';
import { Badge } from '../components/ui/Badge';
import { Card, CardHeader } from '../components/ui/Card';
import { type Column, DataTable } from '../components/ui/DataTable';
import { Field, Input } from '../components/ui/Field';
import { PageHeader } from '../components/ui/PageHeader';
import { SearchInput } from '../components/ui/SearchInput';
import { formatCurrency, formatDate, formatMonth, monthInputValue, toNumber } from '../utils/format';

export function UtilityPayments() {
  const { data: payments, loading, error, reload } = useCollection<UtilityPayment>('/api/utility-payments/');
  const { data: buildingBills } = useCollection<BuildingUtilityBill>('/api/building-utilities/');
  const [month, setMonth] = useState('');
  const [query, setQuery] = useState('');

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return payments.
      filter((payment) => !month || monthInputValue(payment.billing_month) === month).
      filter(
        (payment) =>
          !needle || `${payment.room_number ?? ''} ${payment.receipt_reference ?? ''} ${payment.notes ?? ''}`.toLowerCase().includes(needle)
      ).
      sort((a, b) => b.payment_date.localeCompare(a.payment_date));
  }, [payments, month, query]);

  const totalPaid = filtered.reduce((sum, payment) => sum + toNumber(payment.amount_paid), 0);
  const monthBill = month ? buildingBills.find((bill) => monthInputValue(bill.billing_month) === month) : undefined;
  const monthBillTotal = monthBill ? toNumber(monthBill.total_electricity_bill) + toNumber(monthBill.total_water_bill) : null;

  const columns: Column<UtilityPayment>[] = [
    {
      key: 'room',
      header: 'Room',
      primary: true,
      render: (payment) => <span className="font-medium text-ink">Room {payment.room_number ?? `#${payment.utility_record}`}</span>
    },
    {
      key: 'month',
      header: 'Billing month',
      render: (payment) => <span className="text-ink-muted">{formatMonth(payment.billing_month)}</span>
    },
    {
      key: 'date',
      header: 'Paid on',
      render: (payment) => <span className="whitespace-nowrap text-ink">{formatDate(payment.payment_date)}</span>
    },
    {
      key: 'reference',
      header: 'Supplier receipt',
      render: (payment) =>
        payment.receipt_reference === 'ADVANCE-CREDIT' || payment.receipt_reference === 'CREDIT-APPLIED' ?
          <Badge tone="brand">Covered by advance credit</Badge> :
          payment.receipt_reference ?
            <span className="font-mono text-[12px] text-ink">{payment.receipt_reference}</span> :

            <span className="text-ink-soft">—</span>

    },
    {
      key: 'notes',
      header: 'Notes',
      className: 'max-w-[260px]',
      render: (payment) => <span className="line-clamp-2 text-ink-muted">{payment.notes || '—'}</span>
    },
    {
      key: 'amount',
      header: 'Amount',
      align: 'right',
      render: (payment) => <span className="font-semibold text-ink">{formatCurrency(payment.amount_paid)}</span>
    }];


  return (
    <div className="space-y-5">
      <PageHeader
        title="Supplier payments"
        description="Utility bills tenants paid directly to the electricity and water suppliers." />


      {/* <div className="flex items-start gap-2.5 rounded-xl border border-brand-100 bg-brand-50 px-4 py-3 text-[13px] leading-relaxed text-brand-700">
        <InfoIcon className="mt-0.5 h-4 w-4 flex-none" aria-hidden="true" />
        <span>
          These payments go to the supplier, not the business. They are kept apart from rent payments and excluded from
          revenue and profit reports. When a customer pays more than their bill, the extra becomes room credit and is
          applied to later months automatically.
        </span>
      </div> */}

      <Card>
        <CardHeader
          title={month ? `Payments for ${formatMonth(`${month}-01`)}` : 'All supplier payments'}
          description={`${filtered.length} payment${filtered.length === 1 ? '' : 's'} · ${formatCurrency(totalPaid)} paid${monthBillTotal !== null ? ` of ${formatCurrency(monthBillTotal)} building bill` : ''}`
          }
          actions={
            <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
              <SearchInput value={query} onChange={setQuery} placeholder="Search room or receipt" />
              <Field label="Billing month" htmlFor="supplier_month" className="sm:w-44">
                <Input id="supplier_month" type="month" value={month} onChange={(event) => setMonth(event.target.value)} />
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
            emptyTitle={payments.length ? 'No payments match this filter' : 'No supplier payments yet'}
            emptyDescription={
              payments.length ?
                'Clear the month or search to see every payment.' :
                'Record a payment from a room row on the Utilities page once the tenant has paid the supplier.'
            }
            footer={
              filtered.length ?
                <span>
                  Total paid to suppliers: <span className="font-semibold text-ink">{formatCurrency(totalPaid)}</span>
                </span> :
                undefined
            } />

        }
      </Card>
    </div>);

}