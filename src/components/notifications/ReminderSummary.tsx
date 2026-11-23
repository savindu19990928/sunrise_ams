import type { ReactNode } from 'react';
import type { NotificationSummary } from '../../types/notifications';
import { formatCurrency } from '../../utils/format';
import { pluralize } from '../../utils/reminders';

interface ReminderSummaryProps {
  summary: NotificationSummary | null;
  loading: boolean;
  electricityCount?: number;
  electricityTotal?: number;
  missingElectricityCount?: number;
  waterCount?: number;
  waterTotal?: number;
  missingWaterCount?: number;
}

export function ReminderSummary({
  summary,
  loading,
  electricityCount = 0,
  electricityTotal = 0,
  missingElectricityCount = 0,
  waterCount = 0,
  waterTotal = 0,
  missingWaterCount = 0
}: ReminderSummaryProps) {
  const value = (render: (s: NotificationSummary | null) => string): ReactNode =>
    loading && !summary ? (
      <span className="inline-block h-7 w-32 animate-pulse rounded-md bg-canvas align-middle" aria-hidden="true" />
    ) : summary ? (
      render(summary)
    ) : (
      '—'
    );

  const unpaidElecCount = summary?.unpaid_electricity_bills_count ?? electricityCount;
  const elecAmount = summary?.total_electricity_bills_to_pay ?? electricityTotal;
  const missingElec = summary?.missing_electricity_records_count ?? missingElectricityCount;

  const unpaidWaterCount = summary?.unpaid_water_bills_count ?? waterCount;
  const waterAmount = summary?.total_water_bills_to_pay ?? waterTotal;
  const missingWater = summary?.missing_water_records_count ?? missingWaterCount;

  return (
    <section
      aria-label="Reminder summary"
      className="grid overflow-hidden rounded-xl border border-line bg-surface shadow-card sm:grid-cols-2 xl:grid-cols-[1.4fr_1fr_1fr_1fr]"
    >
      {/* Rent to collect is what this screen is mostly for, so it leads. */}
      <div className="p-5">
        <p className="text-[13px] font-medium text-ink-muted">Payments to collect</p>
        <p className="mt-1.5 text-[32px] font-semibold leading-tight tracking-[-0.02em] text-ink sm:text-[36px]">
          {value((s) => formatCurrency(s?.total_payment_amount_to_collect))}
        </p>
        <p className="mt-1 text-[13px] text-ink-muted">
          {summary ? (
            <>
              {pluralize(summary.payments_to_collect_count, 'bill')} outstanding
              {summary.overdue_payments_count > 0 && (
                <span className="font-medium text-danger-600"> · {summary.overdue_payments_count} overdue</span>
              )}
            </>
          ) : (
            '\u00a0'
          )}
        </p>
      </div>

      <div className="border-t border-line p-5 sm:border-l sm:border-t-0">
        <p className="text-[13px] font-medium text-ink-muted">Repairs to do</p>
        <p className="mt-1.5 text-[22px] font-semibold leading-tight tracking-[-0.01em] text-ink">
          {value((s) => pluralize(s?.repairs_pending_count ?? 0, 'repair'))}
        </p>
        <p className="mt-1 text-[13px] text-ink-muted">
          {summary ? `Est. ${formatCurrency(summary.total_estimated_repair_cost)}` : '\u00a0'}
        </p>
      </div>

      <div className="border-t border-line p-5 xl:border-l xl:border-t-0">
        <p className="text-[13px] font-medium text-ink-muted">Electricity bills to pay</p>
        <p className="mt-1.5 text-[22px] font-semibold leading-tight tracking-[-0.01em] text-ink">
          {value(() => formatCurrency(elecAmount))}
        </p>
        <p className="mt-1 text-[13px] text-ink-muted">
          {summary ? (
            <>
              {pluralize(unpaidElecCount, 'unpaid bill')}
              {missingElec > 0 && (
                <span className="font-medium text-warn-700"> · {pluralize(missingElec, 'missing reading')}</span>
              )}
            </>
          ) : (
            '\u00a0'
          )}
        </p>
      </div>

      <div className="border-t border-line p-5 sm:border-l xl:border-t-0">
        <p className="text-[13px] font-medium text-ink-muted">Water bills to pay</p>
        <p className="mt-1.5 text-[22px] font-semibold leading-tight tracking-[-0.01em] text-ink">
          {value(() => formatCurrency(waterAmount))}
        </p>
        <p className="mt-1 text-[13px] text-ink-muted">
          {summary ? (
            <>
              {pluralize(unpaidWaterCount, 'unpaid bill')}
              {missingWater > 0 && (
                <span className="font-medium text-warn-700"> · {pluralize(missingWater, 'missing reading')}</span>
              )}
            </>
          ) : (
            '\u00a0'
          )}
        </p>
      </div>
    </section>
  );
}
