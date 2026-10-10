import React, { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowRightIcon,
  BanknoteIcon,
  BedDoubleIcon,
  ClipboardListIcon,
  GaugeIcon,
  ReceiptTextIcon,
  SparklesIcon,
  UserPlusIcon } from
'lucide-react';
import type { OverduePayment, Payment } from '../types';
import { useAuth } from '../contexts/AuthContext';
import { useBillingData } from '../hooks/useBillingData';
import { useCollection, useResource } from '../hooks/useResource';
import { ApiErrorState } from '../components/ui/ApiErrorState';
import { Badge } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import { Card, CardHeader } from '../components/ui/Card';
import { type Column, DataTable } from '../components/ui/DataTable';
import { PageHeader } from '../components/ui/PageHeader';
import { StatCard } from '../components/ui/StatCard';
import {
  firstOfCurrentMonth,
  formatCurrency,
  formatDate,
  formatMonth,
  monthInputValue,
  titleCase,
  toNumber } from
'../utils/format';
import { billOutstanding, billStatus, depositBalance } from '../utils/lookup';

const quickActions = [
{ label: 'Add customer', to: '/customers?new=1', icon: UserPlusIcon },
{ label: 'Assign room', to: '/leases?new=1', icon: ClipboardListIcon },
{ label: 'Enter utilities', to: '/utilities?new=1', icon: GaugeIcon },
{ label: 'Generate bills', to: '/bills?generate=1', icon: SparklesIcon },
{ label: 'Record payment', to: '/payments?new=1', icon: BanknoteIcon }];


export function Dashboard() {
  const { user } = useAuth();
  const { bills, leases, rooms, loading, error, reloadAll } = useBillingData();
  const { data: overdue } = useResource<OverduePayment[]>('/api/payments/overdue/');
  const { data: payments } = useCollection<Payment>('/api/payments/');
  const [monthKey] = useState(monthInputValue(firstOfCurrentMonth()));

  const overdueRows = useMemo(() => Array.isArray(overdue) ? overdue : [], [overdue]);

  const stats = useMemo(() => {
    const monthBills = bills.filter((bill) => monthInputValue(bill.billing_month) === monthKey);
    const collectedThisMonth = payments.
    filter((payment) => (payment.payment_date ?? '') >= firstOfCurrentMonth()).
    reduce((sum, payment) => sum + toNumber(payment.amount), 0);
    const occupied = rooms.filter((room) => room.status === 'occupied').length;
    return {
      overdueTotal: overdueRows.reduce((sum, row) => sum + toNumber(row.owed), 0),
      overdueCount: overdueRows.length,
      activeLeases: leases.filter((lease) => lease.is_active).length,
      occupancy: rooms.length ? Math.round(occupied / rooms.length * 100) : 0,
      occupied,
      monthBillCount: monthBills.length,
      monthBilled: monthBills.reduce((sum, bill) => sum + toNumber(bill.total_due), 0),
      monthOutstanding: monthBills.reduce((sum, bill) => sum + billOutstanding(bill), 0),
      collectedThisMonth,
      depositsHeld: leases.
      filter((lease) => lease.is_active).
      reduce((sum, lease) => sum + depositBalance(lease), 0)
    };
  }, [bills, leases, rooms, payments, overdueRows, monthKey]);

  const recentBills = useMemo(
    () =>
    [...bills].
    sort((a, b) => (b.billing_month ?? '').localeCompare(a.billing_month ?? '') || b.id - a.id).
    slice(0, 6),
    [bills]
  );

  const billColumns: Column<(typeof recentBills)[number]>[] = [
  {
    key: 'tenant',
    header: 'Tenant',
    primary: true,
    render: (bill) =>
    <div>
          <span className="font-medium text-ink">{bill.customer_name ?? `Lease #${bill.lease}`}</span>
          <span className="ml-2 text-[12px] text-ink-soft">Room {bill.room_number ?? '—'}</span>
        </div>

  },
  { key: 'month', header: 'Month', render: (bill) => <span className="whitespace-nowrap text-ink-muted">{formatMonth(bill.billing_month)}</span> },
  { key: 'due', header: 'Due', render: (bill) => <span className="whitespace-nowrap text-ink-muted">{formatDate(bill.due_date)}</span> },
  { key: 'total', header: 'Total', align: 'right', render: (bill) => <span className="font-medium text-ink">{formatCurrency(bill.total_due)}</span> },
  {
    key: 'status',
    header: 'Status',
    render: (bill) => {
      const value = billStatus(bill);
      return (
        <Badge tone={value === 'paid' ? 'success' : value === 'partial' ? 'warn' : 'danger'}>{titleCase(value)}</Badge>);

    }
  }];


  return (
    <div className="space-y-5">
      <PageHeader
        title={`Welcome back, ${user?.username ?? 'admin'}`}
        description={`Billing period ${formatMonth(firstOfCurrentMonth())} · ${stats.activeLeases} active leases across ${rooms.length} rooms.`} />
      

      {error ?
      <Card>
          <ApiErrorState error={error} onRetry={reloadAll} />
        </Card> :

      <>
          {/* Money at risk leads, quick actions sit beside it. */}
          <div className="grid gap-4 lg:grid-cols-3">
            <Link
            to="/overdue"
            className="group rounded-xl border border-line bg-surface p-5 shadow-card transition-[border-color,box-shadow] duration-150 ease-out hover:border-danger-100 hover:shadow-pop lg:col-span-2">
            
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-[13px] font-medium text-ink-muted">Overdue balance</p>
                  {loading ?
                <div className="mt-2 h-10 w-48 animate-pulse rounded-md bg-canvas" /> :

                <p className="mt-1.5 text-[34px] font-semibold leading-tight tracking-[-0.02em] text-ink sm:text-[42px]">
                      {formatCurrency(stats.overdueTotal)}
                    </p>
                }
                  <p className="mt-2 text-[13px] text-ink-muted">
                    {stats.overdueCount} overdue {stats.overdueCount === 1 ? 'bill' : 'bills'} ·{' '}
                    {formatCurrency(stats.monthOutstanding)} still unpaid this month
                  </p>
                </div>
                <span className="flex h-9 w-9 flex-none items-center justify-center rounded-lg bg-danger-50 text-danger-600 transition-transform duration-150 ease-out group-hover:translate-x-0.5">
                  <ArrowRightIcon className="h-4 w-4" aria-hidden="true" />
                </span>
              </div>
            </Link>

            <Card className="p-4 sm:p-5">
              <h2 className="text-[13px] font-semibold uppercase tracking-[0.06em] text-ink-soft">Quick actions</h2>
              <ul className="mt-3 space-y-1.5">
                {quickActions.map((action) =>
              <li key={action.to}>
                    <Link
                  to={action.to}
                  className="flex items-center gap-2.5 rounded-lg px-2 py-2 text-sm text-ink-muted transition-colors duration-150 ease-out hover:bg-canvas hover:text-ink">
                  
                      <action.icon className="h-4 w-4 text-brand-600" aria-hidden="true" />
                      {action.label}
                    </Link>
                  </li>
              )}
              </ul>
            </Card>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard
            label="Active leases"
            value={String(stats.activeLeases)}
            hint={`${stats.occupied} of ${rooms.length} rooms occupied`}
            icon={ClipboardListIcon}
            tone="brand"
            to="/leases"
            loading={loading} />
          
            <StatCard
            label="Occupancy"
            value={`${stats.occupancy}%`}
            hint="View rooms"
            icon={BedDoubleIcon}
            to="/rooms"
            loading={loading} />
          
            <StatCard
            label={`Bills · ${formatMonth(firstOfCurrentMonth())}`}
            value={String(stats.monthBillCount)}
            hint={`${formatCurrency(stats.monthBilled)} billed`}
            icon={ReceiptTextIcon}
            to="/bills"
            loading={loading} />
          
            <StatCard
            label="Collected this month"
            value={formatCurrency(stats.collectedThisMonth)}
            hint="View payments"
            icon={BanknoteIcon}
            tone="success"
            to="/payments"
            loading={loading} />
          
          </div>

          <div className="grid gap-4 xl:grid-cols-3">
            <Card className="xl:col-span-2">
              <CardHeader
              title="Latest bills"
              description="Most recent consolidated bills across all leases."
              actions={
              <Link
                to="/bills"
                className="text-[13px] font-medium text-brand-700 transition-colors duration-150 ease-out hover:text-brand-800">
                
                    View all bills
                  </Link>
              } />
            
              <DataTable
              columns={billColumns}
              rows={recentBills}
              keyOf={(bill) => bill.id}
              loading={loading}
              emptyTitle="No bills generated yet"
              emptyDescription="Enter utilities for the month, then generate bills for all active leases."
              emptyAction={
              <Link to="/bills?generate=1">
                    <Button icon={SparklesIcon}>Generate monthly bills</Button>
                  </Link>
              } />
            
            </Card>

            <Card>
              <CardHeader title="Deposit balances" description="Held against active leases." />
              <div className="px-4 py-4 sm:px-5">
                <p className="text-[26px] font-semibold tracking-[-0.02em] text-ink">{formatCurrency(stats.depositsHeld)}</p>
                <p className="mt-1 text-[13px] text-ink-muted">
                  Reduced by each month&apos;s deduction until it reaches zero; any balance is refunded, less repairs, at move-out.
                </p>
                <ul className="mt-4 space-y-2.5 border-t border-line pt-3">
                  {leases.
                filter((lease) => lease.is_active).
                slice(0, 5).
                map((lease) => {
                  const paid = toNumber(lease.deposit_paid) || 1;
                  const remaining = depositBalance(lease);
                  const pct = Math.max(0, Math.min(100, Math.round(remaining / paid * 100)));
                  return (
                    <li key={lease.id}>
                          <div className="flex items-baseline justify-between gap-3 text-[13px]">
                            <span className="truncate text-ink">
                              {lease.customer_name ?? `Lease #${lease.id}`}
                              <span className="ml-1.5 text-ink-soft">Room {lease.room_number ?? '—'}</span>
                            </span>
                            <span className="whitespace-nowrap font-medium text-ink">{formatCurrency(remaining)}</span>
                          </div>
                          <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-canvas">
                            <div className="h-full rounded-full bg-brand-500" style={{ width: `${pct}%` }} />
                          </div>
                        </li>);

                })}
                  {!leases.filter((lease) => lease.is_active).length &&
                <li className="text-[13px] text-ink-soft">No active leases yet.</li>
                }
                </ul>
              </div>
            </Card>
          </div>
        </>
      }
    </div>);

}