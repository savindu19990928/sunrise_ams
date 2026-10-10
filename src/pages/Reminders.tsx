import React, { useMemo, useState } from 'react';
import { RefreshCwIcon } from 'lucide-react';
import { toast } from 'sonner';
import type { Bill } from '../types';
import type {
  NotificationsResponse,
  PaymentReminder,
  RepairReminder,
  ReminderType,
  UtilityBillReminder } from
'../types/notifications';
import { useBillingData } from '../hooks/useBillingData';
import { useResource } from '../hooks/useResource';
import { PaymentReminders } from '../components/notifications/PaymentReminders';
import { ReminderSummary } from '../components/notifications/ReminderSummary';
import { RepairReminders } from '../components/notifications/RepairReminders';
import { UtilityReminders } from '../components/notifications/UtilityReminders';
import { RecordPaymentModal } from '../components/payments/RecordPaymentModal';
import { ApiErrorState } from '../components/ui/ApiErrorState';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { ConfirmDialog } from '../components/ui/ConfirmDialog';
import { LoadingState } from '../components/ui/States';
import { ApiError, apiRequest } from '../utils/api';
import { formatMonth } from '../utils/format';
import { notifyRemindersChanged } from '../utils/reminders';

type Filter = 'all' | ReminderType;

type PendingAction =
{kind: 'repair';item: RepairReminder;} |
{kind: 'utility';item: UtilityBillReminder;};

export function Reminders() {
  const { data, loading, error, reload } = useResource<NotificationsResponse>('/api/notifications/');
  const { bills, reloadAll } = useBillingData();
  const [filter, setFilter] = useState<Filter>('all');
  const [payingBill, setPayingBill] = useState<Bill | null>(null);
  const [paymentOpen, setPaymentOpen] = useState(false);
  const [action, setAction] = useState<PendingAction | null>(null);
  const [actionPending, setActionPending] = useState(false);

  const lists = useMemo(
    () => ({
      payments: data?.payments_to_collect ?? [],
      repairs: data?.repairs_to_do ?? [],
      utilityBills: data?.utility_bills_to_pay ?? [],
      missing: data?.missing_utility_records ?? []
    }),
    [data]
  );

  const tabs: {value: Filter;label: string;count: number;}[] = [
  {
    value: 'all',
    label: 'All',
    count:
    data?.summary?.total_action_items ??
    lists.payments.length + lists.repairs.length + lists.utilityBills.length + lists.missing.length
  },
  { value: 'payments', label: 'Payments', count: lists.payments.length },
  { value: 'repairs', label: 'Repairs', count: lists.repairs.length },
  { value: 'utilities', label: 'Utilities', count: lists.utilityBills.length + lists.missing.length }];


  const refreshEverything = () => {
    reload();
    notifyRemindersChanged();
  };

  const openPayment = (item: PaymentReminder) => {
    setPayingBill(bills.find((bill) => bill.id === item.bill_id) ?? null);
    setPaymentOpen(true);
  };

  const confirmAction = async () => {
    if (!action) return;
    setActionPending(true);
    try {
      if (action.kind === 'repair') {
        await apiRequest(`/api/repairs/${action.item.repair_id}/complete/`, { method: 'POST' });
        toast.success(`Repair in Room ${action.item.room_number} marked completed`);
      } else {
        await apiRequest(`/api/utilities/${action.item.utility_record_id}/mark_paid/`, { method: 'POST' });
        toast.success(`Room ${action.item.room_number} utility bill marked paid`);
      }
      setAction(null);
      refreshEverything();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Could not update this reminder. Please try again.');
    } finally {
      setActionPending(false);
    }
  };

  const show = (type: ReminderType) => filter === 'all' || filter === type;

  return (
    <div className="space-y-5">
      <header className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div className="min-w-0">
          <h1 className="text-xl font-semibold tracking-[-0.01em] text-ink sm:text-2xl">Reminders</h1>
          <p className="mt-1 max-w-2xl text-[13px] leading-relaxed text-ink-muted sm:text-sm">
            Everything that needs attention — payments to collect, repairs to finish and utility bills to pay.
          </p>
        </div>
        <Button variant="secondary" icon={RefreshCwIcon} onClick={refreshEverything} loading={loading && Boolean(data)}>
          Refresh
        </Button>
      </header>

      {error && !data ?
      <Card>
          <ApiErrorState error={error} onRetry={reload} />
        </Card> :

      <>
          <ReminderSummary summary={data?.summary ?? null} loading={loading} />

          <div role="tablist" aria-label="Filter reminders" className="flex gap-1 overflow-x-auto border-b border-line">
            {tabs.map((tab) => {
            const active = filter === tab.value;
            return (
              <button
                key={tab.value}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => setFilter(tab.value)}
                className={`-mb-px flex flex-none items-center gap-2 border-b-2 px-3 py-2.5 text-sm transition-colors duration-150 ease-out ${
                active ?
                'border-brand-600 font-medium text-ink' :
                'border-transparent text-ink-muted hover:text-ink'}`
                }>
                
                  {tab.label}
                  <span
                  className={`rounded-md px-1.5 py-px text-[11px] font-semibold ${
                  active ? 'bg-brand-50 text-brand-700' : 'bg-canvas text-ink-muted'}`
                  }>
                  
                    {tab.count}
                  </span>
                </button>);

          })}
          </div>

          {loading && !data ?
        <Card>
              <LoadingState label="Loading reminders…" />
            </Card> :

        <div className="space-y-5">
              {show('payments') && <PaymentReminders items={lists.payments} onRecordPayment={openPayment} />}
              {show('repairs') &&
          <RepairReminders items={lists.repairs} onComplete={(item) => setAction({ kind: 'repair', item })} />
          }
              {show('utilities') &&
          <UtilityReminders
            bills={lists.utilityBills}
            missing={lists.missing}
            onMarkPaid={(item) => setAction({ kind: 'utility', item })} />

          }
            </div>
        }
        </>
      }

      <RecordPaymentModal
        open={paymentOpen}
        bills={bills}
        preselectedBillId={payingBill?.id ?? null}
        onClose={() => {
          setPaymentOpen(false);
          setPayingBill(null);
        }}
        onSaved={() => {
          refreshEverything();
          reloadAll();
        }} />
      

      <ConfirmDialog
        open={Boolean(action)}
        title={action?.kind === 'repair' ? 'Mark repair completed?' : 'Mark utility bill paid?'}
        message={
        action?.kind === 'repair' ?
        `"${action.item.description}" in Room ${action.item.room_number} will be marked completed with today's date.` :
        action ?
        `Room ${action.item.room_number}'s ${formatMonth(action.item.billing_month)} utility bill will be marked as paid to the provider.` :
        ''
        }
        confirmLabel={action?.kind === 'repair' ? 'Mark completed' : 'Mark paid'}
        pending={actionPending}
        onConfirm={confirmAction}
        onClose={() => {
          if (!actionPending) setAction(null);
        }} />
      
    </div>);

}