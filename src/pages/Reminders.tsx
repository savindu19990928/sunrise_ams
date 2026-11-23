import { useMemo, useState } from 'react';
import { RefreshCwIcon } from 'lucide-react';
import { toast } from 'sonner';
import type { Bill } from '../types';
import type {
  NotificationsResponse,
  PaymentReminder,
  ReminderType,
  RepairReminder
} from '../types/notifications';
import { useBillingData } from '../hooks/useBillingData';
import { useResource } from '../hooks/useResource';
import { PaymentReminders } from '../components/notifications/PaymentReminders';
import { ReminderSummary } from '../components/notifications/ReminderSummary';
import { RepairReminders } from '../components/notifications/RepairReminders';
import { ServiceReminders } from '../components/notifications/ServiceReminders';
import { RecordPaymentModal } from '../components/payments/RecordPaymentModal';
import { ApiErrorState } from '../components/ui/ApiErrorState';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { ConfirmDialog } from '../components/ui/ConfirmDialog';
import { LoadingState } from '../components/ui/States';
import { ApiError, apiRequest } from '../utils/api';
import { toNumber } from '../utils/format';
import { notifyRemindersChanged } from '../utils/reminders';

type Filter = 'all' | ReminderType;

type PendingAction = { kind: 'repair'; item: RepairReminder; };

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
      electricityBills: data?.electricity_bills_to_pay ?? [],
      waterBills: data?.water_bills_to_pay ?? [],
      missingElectricity: data?.missing_electricity_records ?? [],
      missingWater: data?.missing_water_records ?? []
    }),
    [data]
  );

  const electricityTotal = useMemo(
    () =>
      lists.electricityBills.reduce(
        (sum, item) => sum + toNumber(item.remaining_balance ?? item.outstanding_amount ?? item.electricity_cost ?? item.total_cost),
        0
      ),
    [lists.electricityBills]
  );

  const waterTotal = useMemo(
    () =>
      lists.waterBills.reduce(
        (sum, item) => sum + toNumber(item.remaining_balance ?? item.outstanding_amount ?? item.water_cost ?? item.total_cost),
        0
      ),
    [lists.waterBills]
  );

  const tabs: { value: Filter; label: string; count: number; }[] = [
    {
      value: 'all',
      label: 'All',
      count:
        data?.summary?.total_action_items ??
        lists.payments.length +
          lists.repairs.length +
          lists.electricityBills.length +
          lists.missingElectricity.length +
          lists.waterBills.length +
          lists.missingWater.length
    },
    { value: 'payments', label: 'Payments', count: lists.payments.length },
    { value: 'repairs', label: 'Repairs', count: lists.repairs.length },
    { value: 'electricity', label: 'Electricity', count: lists.electricityBills.length + lists.missingElectricity.length },
    { value: 'water', label: 'Water', count: lists.waterBills.length + lists.missingWater.length }
  ];

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
      await apiRequest(`/api/repairs/${action.item.repair_id}/complete/`, { method: 'POST' });
      toast.success(`Repair in Room ${action.item.room_number} marked completed`);
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
            Everything that needs attention — rent payments to collect, repairs to finish, and electricity and water bills to pay.
          </p>
        </div>
        <Button variant="secondary" icon={RefreshCwIcon} onClick={refreshEverything} loading={loading && Boolean(data)}>
          Refresh
        </Button>
      </header>

      {error && !data ? (
        <Card>
          <ApiErrorState error={error} onRetry={reload} />
        </Card>
      ) : (
        <>
          <ReminderSummary
            summary={data?.summary ?? null}
            loading={loading}
            electricityCount={lists.electricityBills.length}
            electricityTotal={electricityTotal}
            missingElectricityCount={lists.missingElectricity.length}
            waterCount={lists.waterBills.length}
            waterTotal={waterTotal}
            missingWaterCount={lists.missingWater.length}
          />

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
                    active
                      ? 'border-brand-600 font-medium text-ink'
                      : 'border-transparent text-ink-muted hover:text-ink'
                  }`}
                >
                  {tab.label}
                  <span
                    className={`rounded-md px-1.5 py-px text-[11px] font-semibold ${
                      active ? 'bg-brand-50 text-brand-700' : 'bg-canvas text-ink-muted'
                    }`}
                  >
                    {tab.count}
                  </span>
                </button>
              );
            })}
          </div>

          {loading && !data ? (
            <Card>
              <LoadingState label="Loading reminders…" />
            </Card>
          ) : (
            <div className="space-y-5">
              {show('payments') && <PaymentReminders items={lists.payments} onRecordPayment={openPayment} />}
              {show('repairs') && (
                <RepairReminders items={lists.repairs} onComplete={(item) => setAction({ kind: 'repair', item })} />
              )}
              {show('electricity') && (
                <ServiceReminders
                  kind="electricity"
                  bills={lists.electricityBills}
                  missing={lists.missingElectricity}
                />
              )}
              {show('water') && (
                <ServiceReminders kind="water" bills={lists.waterBills} missing={lists.missingWater} />
              )}
            </div>
          )}
        </>
      )}

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
        }}
      />

      <ConfirmDialog
        open={Boolean(action)}
        title="Mark repair completed?"
        message={
          action ? `"${action.item.description}" in Room ${action.item.room_number} will be marked completed with today's date.` : ''
        }
        confirmLabel="Mark completed"
        pending={actionPending}
        onConfirm={confirmAction}
        onClose={() => {
          if (!actionPending) setAction(null);
        }}
      />
    </div>
  );
}
