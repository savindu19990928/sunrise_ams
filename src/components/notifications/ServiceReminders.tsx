import { Link } from 'react-router-dom';
import { CheckIcon, DropletIcon, TriangleAlertIcon, ZapIcon } from 'lucide-react';
import type { ServiceKind } from '../../types';
import type { ElectricityBillReminder, MissingServiceReminder, WaterBillReminder } from '../../types/notifications';
import { formatCurrency, formatDate, formatMonth, monthInputValue } from '../../utils/format';
import { SERVICE_CONFIG } from '../../utils/serviceRecords';
import { Badge } from '../ui/Badge';
import { Card, CardHeader } from '../ui/Card';
import { EmptyState } from '../ui/States';

interface ServiceRemindersProps {
  kind: ServiceKind;
  bills: (ElectricityBillReminder | WaterBillReminder)[];
  missing: MissingServiceReminder[];
}

function reminderRecordId(item: ElectricityBillReminder | WaterBillReminder, index: number): number {
  if ('electricity_record_id' in item && item.electricity_record_id !== undefined) return item.electricity_record_id;
  if ('water_record_id' in item && item.water_record_id !== undefined) return item.water_record_id;
  return item.id ?? index;
}

function reminderBilledCost(item: ElectricityBillReminder | WaterBillReminder): string | number {
  if ('electricity_cost' in item && item.electricity_cost !== undefined) return item.electricity_cost;
  if ('water_cost' in item && item.water_cost !== undefined) return item.water_cost;
  return item.total_cost ?? 0;
}

/** Payments are recorded on the Electricity or Water pages with the customer's supplier receipt. */
export function ServiceReminders({ kind, bills, missing }: ServiceRemindersProps) {
  const config = SERVICE_CONFIG[kind];
  const empty = bills.length === 0 && missing.length === 0;
  const EmptyIcon = kind === 'electricity' ? ZapIcon : DropletIcon;

  return (
    <Card>
      <CardHeader
        title={`${config.label} bills to pay`}
        description={`Room ${config.lowerLabel} bills tenants haven't confirmed paying to ${config.supplierName}, and rooms missing ${config.lowerLabel} readings.`}
      />

      {empty ? (
        <EmptyState
          icon={EmptyIcon}
          title={`${config.label} is up to date`}
          description={`${config.supplierShort} bills are paid and every occupied room has its ${config.lowerLabel} reading.`}
        />
      ) : (
        <>
          {missing.length > 0 && (
            <div className="border-b border-line bg-warn-50 px-4 py-3 sm:px-5">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
                <div className="flex min-w-0 gap-2.5">
                  <TriangleAlertIcon className="mt-0.5 h-4 w-4 flex-none text-warn-600" aria-hidden="true" />
                  <div className="min-w-0">
                    <p className="text-[13px] font-medium text-warn-700">
                      {missing.length === 1 ? '1 room is' : `${missing.length} rooms are`} missing {config.lowerLabel}{' '}
                      readings
                    </p>
                    <ul className="mt-1 space-y-0.5">
                      {missing.map((item) => (
                        <li key={`${item.room_number}-${item.billing_month}`} className="text-[13px] text-warn-700">
                          Room {item.room_number}
                          {item.customer_name ? ` (${item.customer_name})` : ''} · {formatMonth(item.billing_month)}
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
                <Link
                  to={`${config.route}?new=1`}
                  className="inline-flex h-9 flex-none items-center justify-center rounded-lg border border-warn-100 bg-surface px-3 text-[13px] font-medium text-warn-700 transition-colors duration-150 ease-out hover:bg-warn-100"
                >
                  Record readings
                </Link>
              </div>
            </div>
          )}

          {bills.length > 0 && (
            <ul className="divide-y divide-line">
              {bills.map((item, index) => {
                const billedCost = reminderBilledCost(item);
                const remaining = item.remaining_balance ?? item.outstanding_amount ?? billedCost;
                const key = reminderRecordId(item, index);
                return (
                  <li
                    key={key}
                    className="flex flex-col gap-3 px-4 py-4 sm:px-5 md:flex-row md:items-center md:justify-between md:gap-6"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                        <p className="font-medium text-ink">Room {item.room_number}</p>
                        {item.customer_name && <span className="text-[13px] text-ink-muted">{item.customer_name}</span>}
                        <span className="text-[13px] text-ink-muted">{formatMonth(item.billing_month)}</span>
                        {item.is_overdue ? (
                          <Badge tone="danger">{item.days_overdue ?? 0} days overdue</Badge>
                        ) : (
                          <Badge tone="neutral">Due {formatDate(item.due_date)}</Badge>
                        )}
                      </div>
                      <p className="mt-1 text-[13px] text-ink-muted">
                        Billed {formatCurrency(billedCost)} · Pay directly to {config.supplierShort}
                      </p>
                    </div>

                    <div className="flex items-center justify-between gap-4 md:justify-end">
                      <p className={`text-[15px] font-semibold ${item.is_overdue ? 'text-danger-600' : 'text-ink'}`}>
                        {formatCurrency(remaining)}
                      </p>
                      <Link
                        to={`${config.route}?month=${monthInputValue(item.billing_month)}`}
                        className="inline-flex h-9 flex-none items-center justify-center gap-1.5 rounded-lg border border-line bg-surface px-3 text-[13px] font-medium text-ink transition-colors duration-150 ease-out hover:bg-canvas"
                      >
                        <CheckIcon className="h-4 w-4" aria-hidden="true" />
                        Record payment
                      </Link>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </>
      )}
    </Card>
  );
}
