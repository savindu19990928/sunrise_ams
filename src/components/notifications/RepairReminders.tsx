import React from 'react';
import { CheckIcon, WrenchIcon } from 'lucide-react';
import type { RepairReminder } from '../../types/notifications';
import { formatCurrency, formatDate, titleCase } from '../../utils/format';
import { Badge } from '../ui/Badge';
import { Button } from '../ui/Button';
import { Card, CardHeader } from '../ui/Card';
import { EmptyState } from '../ui/States';

interface RepairRemindersProps {
  items: RepairReminder[];
  onComplete: (item: RepairReminder) => void;
}

export function RepairReminders({ items, onComplete }: RepairRemindersProps) {
  return (
    <Card>
      <CardHeader title="Repairs to do" description="Pending and in-progress room repairs." />
      {items.length === 0 ?
      <EmptyState icon={WrenchIcon} title="No open repairs" description="Every logged repair has been completed." /> :

      <ul className="divide-y divide-line">
          {items.map((item) =>
        <li
          key={item.repair_id}
          className="flex flex-col gap-3 px-4 py-4 sm:px-5 md:flex-row md:items-center md:justify-between md:gap-6">
          
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                  <p className="font-medium text-ink">{item.description}</p>
                  <Badge tone={item.status === 'in_progress' ? 'brand' : 'warn'}>{titleCase(item.status)}</Badge>
                </div>
                <p className="mt-1 text-[13px] text-ink-muted">
                  Room {item.room_number}
                  {item.customer_name ? ` · ${item.customer_name}` : ''}
                  {item.customer_phone ? ` · ${item.customer_phone}` : ''}
                </p>
                <p className="mt-0.5 text-[12px] text-ink-soft">
                  Logged {formatDate(item.date_logged)} · waiting {item.days_pending}{' '}
                  {item.days_pending === 1 ? 'day' : 'days'}
                </p>
              </div>

              <div className="flex items-center justify-between gap-4 md:justify-end">
                <div className="text-left md:text-right">
                  <p className="text-[15px] font-semibold text-ink">{formatCurrency(item.cost)}</p>
                  <p className="text-[12px] text-ink-soft">Estimated cost</p>
                </div>
                <Button variant="secondary" size="sm" icon={CheckIcon} onClick={() => onComplete(item)}>
                  Mark completed
                </Button>
              </div>
            </li>
        )}
        </ul>
      }
    </Card>);

}