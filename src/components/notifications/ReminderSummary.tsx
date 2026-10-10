import React from 'react';
import type { NotificationSummary } from '../../types/notifications';
import { formatCurrency } from '../../utils/format';
import { pluralize } from '../../utils/reminders';

interface ReminderSummaryProps {
  summary: NotificationSummary | null;
  loading: boolean;
}

export function ReminderSummary({ summary, loading }: ReminderSummaryProps) {
  const value = (render: (s: NotificationSummary) => string) =>
  loading && !summary ?
  <span className="inline-block h-7 w-32 animate-pulse rounded-md bg-canvas align-middle" aria-hidden="true" /> :
  summary ?
  render(summary) :

  '—';


  return (
    <section
      aria-label="Reminder summary"
      className="grid overflow-hidden rounded-xl border border-line bg-surface shadow-card lg:grid-cols-[1.6fr_1fr_1fr]">
      
      {/* Money to collect is what this screen is mostly for, so it leads. */}
      <div className="p-5">
        <p className="text-[13px] font-medium text-ink-muted">Payments to collect</p>
        <p className="mt-1.5 text-[32px] font-semibold leading-tight tracking-[-0.02em] text-ink sm:text-[36px]">
          {value((s) => formatCurrency(s.total_payment_amount_to_collect))}
        </p>
        <p className="mt-1 text-[13px] text-ink-muted">
          {summary ?
          <>
              {pluralize(summary.payments_to_collect_count, 'bill')} outstanding
              {summary.overdue_payments_count > 0 &&
            <span className="font-medium text-danger-600"> · {summary.overdue_payments_count} overdue</span>
            }
            </> :

          '\u00a0'
          }
        </p>
      </div>

      <div className="border-t border-line p-5 lg:border-l lg:border-t-0">
        <p className="text-[13px] font-medium text-ink-muted">Repairs to do</p>
        <p className="mt-1.5 text-[22px] font-semibold leading-tight tracking-[-0.01em] text-ink">
          {value((s) => pluralize(s.repairs_pending_count, 'repair'))}
        </p>
        <p className="mt-1 text-[13px] text-ink-muted">
          {summary ? `Est. ${formatCurrency(summary.total_estimated_repair_cost)}` : '\u00a0'}
        </p>
      </div>

      <div className="border-t border-line p-5 lg:border-l lg:border-t-0">
        <p className="text-[13px] font-medium text-ink-muted">Utility bills to pay</p>
        <p className="mt-1.5 text-[22px] font-semibold leading-tight tracking-[-0.01em] text-ink">
          {value((s) => formatCurrency(s.total_utility_bills_to_pay))}
        </p>
        <p className="mt-1 text-[13px] text-ink-muted">
          {summary ?
          <>
              {pluralize(summary.unpaid_utility_bills_count, 'unpaid bill')}
              {summary.missing_utility_records_count > 0 &&
            <span className="font-medium text-warn-700">
                  {' '}
                  · {pluralize(summary.missing_utility_records_count, 'missing reading')}
                </span>
            }
            </> :

          '\u00a0'
          }
        </p>
      </div>
    </section>);

}