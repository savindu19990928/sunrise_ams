import React, { useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { BellIcon } from 'lucide-react';
import type { NotificationsResponse } from '../../types/notifications';
import { useResource } from '../../hooks/useResource';
import { onRemindersChanged } from '../../utils/reminders';

/** Bell in the top bar showing how many action items are waiting. */
export function ReminderBell() {
  const location = useLocation();
  const { data, reload } = useResource<NotificationsResponse>('/api/notifications/', [location.pathname]);

  useEffect(() => onRemindersChanged(reload), [reload]);

  const count = data?.summary?.total_action_items ?? 0;
  const overdue = data?.summary?.overdue_payments_count ?? 0;
  const label = count > 0 ? `Reminders, ${count} action ${count === 1 ? 'item' : 'items'}` : 'Reminders';

  return (
    <Link
      to="/reminders"
      aria-label={label}
      title={label}
      className="relative flex h-9 w-9 items-center justify-center rounded-lg border border-line text-ink-muted transition-colors duration-150 ease-out hover:bg-canvas hover:text-ink">
      
      <BellIcon className="h-4 w-4" aria-hidden="true" />
      {count > 0 &&
      <span
        className={`absolute -right-1.5 -top-1.5 flex h-[18px] min-w-[18px] items-center justify-center rounded-full border-2 border-surface px-1 text-[10px] font-semibold leading-none text-white ${
        overdue > 0 ? 'bg-danger-600' : 'bg-brand-600'}`
        }
        aria-hidden="true">
        
          {count > 99 ? '99+' : count}
        </span>
      }
    </Link>);

}