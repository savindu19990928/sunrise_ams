import React from 'react';
import { Link } from 'react-router-dom';
import { CheckIcon, GaugeIcon, TriangleAlertIcon } from 'lucide-react';
import type { MissingUtilityReminder, UtilityBillReminder } from '../../types/notifications';
import { formatCurrency, formatDate, formatMonth } from '../../utils/format';
import { Badge } from '../ui/Badge';
import { Button } from '../ui/Button';
import { Card, CardHeader } from '../ui/Card';
import { EmptyState } from '../ui/States';

interface UtilityRemindersProps {
  bills: UtilityBillReminder[];
  missing: MissingUtilityReminder[];
  onMarkPaid: (item: UtilityBillReminder) => void;
}

export function UtilityReminders({ bills, missing, onMarkPaid }: UtilityRemindersProps) {
  const empty = bills.length === 0 && missing.length === 0;

  return (
    <Card>
      <CardHeader
        title="Utility bills to pay"
        description="Unpaid provider bills and rooms still missing this month's readings." />
      
      {empty ?
      <EmptyState
        icon={GaugeIcon}
        title="Utilities are up to date"
        description="Provider bills are paid and every occupied room has its readings." /> :


      <>
          {missing.length > 0 &&
        <div className="border-b border-line bg-warn-50 px-4 py-3 sm:px-5">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
                <div className="flex min-w-0 gap-2.5">
                  <TriangleAlertIcon className="mt-0.5 h-4 w-4 flex-none text-warn-600" aria-hidden="true" />
                  <div className="min-w-0">
                    <p className="text-[13px] font-medium text-warn-700">
                      {missing.length === 1 ? '1 room is' : `${missing.length} rooms are`} missing utility readings
                    </p>
                    <ul className="mt-1 space-y-0.5">
                      {missing.map((item) =>
                  <li key={`${item.room_number}-${item.billing_month}`} className="text-[13px] text-warn-700">
                          Room {item.room_number}
                          {item.customer_name ? ` (${item.customer_name})` : ''} · {formatMonth(item.billing_month)}
                        </li>
                  )}
                    </ul>
                  </div>
                </div>
                <Link
              to="/utilities"
              className="inline-flex h-9 flex-none items-center justify-center rounded-lg border border-warn-100 bg-surface px-3 text-[13px] font-medium text-warn-700 transition-colors duration-150 ease-out hover:bg-warn-100">
              
                  Record readings
                </Link>
              </div>
            </div>
        }

          {bills.length > 0 &&
        <ul className="divide-y divide-line">
              {bills.map((item) =>
          <li
            key={item.utility_record_id}
            className="flex flex-col gap-3 px-4 py-4 sm:px-5 md:flex-row md:items-center md:justify-between md:gap-6">
            
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                      <p className="font-medium text-ink">Room {item.room_number}</p>
                      <span className="text-[13px] text-ink-muted">{formatMonth(item.billing_month)}</span>
                      {item.is_overdue ?
                <Badge tone="danger">{item.days_overdue} days overdue</Badge> :

                <Badge tone="neutral">Due {formatDate(item.due_date)}</Badge>
                }
                    </div>
                    <p className="mt-1 text-[13px] text-ink-muted">
                      Electricity {formatCurrency(item.electricity_cost)} · Water {formatCurrency(item.water_cost)}
                    </p>
                  </div>

                  <div className="flex items-center justify-between gap-4 md:justify-end">
                    <p className={`text-[15px] font-semibold ${item.is_overdue ? 'text-danger-600' : 'text-ink'}`}>
                      {formatCurrency(item.total_cost)}
                    </p>
                    <Button variant="secondary" size="sm" icon={CheckIcon} onClick={() => onMarkPaid(item)}>
                      Mark paid
                    </Button>
                  </div>
                </li>
          )}
            </ul>
        }
        </>
      }
    </Card>);

}