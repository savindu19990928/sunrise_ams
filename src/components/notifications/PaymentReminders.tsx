import React from 'react';
import { BanknoteIcon, PhoneIcon, UserRoundIcon } from 'lucide-react';
import type { PaymentReminder } from '../../types/notifications';
import { formatCurrency, formatDate, formatMonth } from '../../utils/format';
import { Badge } from '../ui/Badge';
import { Button } from '../ui/Button';
import { Card, CardHeader } from '../ui/Card';
import { EmptyState } from '../ui/States';

interface PaymentRemindersProps {
  items: PaymentReminder[];
  onRecordPayment: (item: PaymentReminder) => void;
}

function DueBadge({ item }: {item: PaymentReminder;}) {
  if (item.is_overdue) return <Badge tone="danger">{item.days_overdue} days overdue</Badge>;
  if (item.days_until_due <= 0) return <Badge tone="warn">Due today</Badge>;
  return <Badge tone="neutral">Due in {item.days_until_due} days</Badge>;
}

export function PaymentReminders({ items, onRecordPayment }: PaymentRemindersProps) {
  return (
    <Card>
      <CardHeader title="Payments to collect" description="Unpaid and part-paid bills, most urgent first." />
      {items.length === 0 ?
      <EmptyState
        icon={BanknoteIcon}
        title="Nothing to collect"
        description="Every bill has been paid in full." /> :


      <ul className="divide-y divide-line">
          {items.map((item) => {
          const contacts = item.immediate_contacts ?? [];
          return (
            <li
              key={item.bill_id}
              className="flex flex-col gap-3 px-4 py-4 sm:px-5 md:flex-row md:items-center md:justify-between md:gap-6">
              
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                    <p className="font-medium text-ink">{item.customer_name}</p>
                    <span className="text-[13px] text-ink-muted">Room {item.room_number}</span>
                    <DueBadge item={item} />
                  </div>
                  <p className="mt-1 text-[13px] text-ink-muted">
                    Bill #{item.bill_id} · {formatMonth(item.billing_month)} · due {formatDate(item.due_date)}
                  </p>
                  <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[13px]">
                    {item.customer_phone &&
                  <a
                    href={`tel:${item.customer_phone}`}
                    className="inline-flex items-center gap-1.5 text-ink transition-colors duration-150 ease-out hover:text-brand-700">
                    
                        <PhoneIcon className="h-3.5 w-3.5 text-ink-soft" aria-hidden="true" />
                        {item.customer_phone}
                      </a>
                  }
                    {item.is_overdue &&
                  contacts.map((contact) =>
                  <span key={`${contact.name}-${contact.mobile_number}`} className="inline-flex items-center gap-1.5 text-ink-muted">
                          <UserRoundIcon className="h-3.5 w-3.5 text-ink-soft" aria-hidden="true" />
                          {contact.name} ({contact.relation}) ·{' '}
                          <a
                      href={`tel:${contact.mobile_number}`}
                      className="text-ink transition-colors duration-150 ease-out hover:text-brand-700">
                      
                            {contact.mobile_number}
                          </a>
                        </span>
                  )}
                  </div>
                </div>

                <div className="flex items-center justify-between gap-4 md:justify-end">
                  <div className="text-left md:text-right">
                    <p className={`text-[17px] font-semibold ${item.is_overdue ? 'text-danger-600' : 'text-ink'}`}>
                      {formatCurrency(item.outstanding_amount)}
                    </p>
                    <p className="text-[12px] text-ink-soft">
                      of {formatCurrency(item.total_amount_due)} · paid {formatCurrency(item.paid_amount)}
                    </p>
                  </div>
                  <Button variant="secondary" size="sm" icon={BanknoteIcon} onClick={() => onRecordPayment(item)}>
                    Record payment
                  </Button>
                </div>
              </li>);

        })}
        </ul>
      }
    </Card>);

}