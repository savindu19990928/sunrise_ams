import React from 'react';
import { AlertTriangleIcon, InboxIcon, Loader2Icon, RefreshCwIcon } from 'lucide-react';
import { Button } from './Button';

export function LoadingState({ label = 'Loading…', rows = 4 }: {label?: string;rows?: number;}) {
  return (
    <div className="px-4 py-6 sm:px-5" role="status" aria-live="polite">
      <div className="mb-4 flex items-center gap-2 text-[13px] text-ink-muted">
        <Loader2Icon className="h-4 w-4 animate-spin" aria-hidden="true" />
        {label}
      </div>
      <div className="space-y-2.5">
        {Array.from({ length: rows }).map((_, index) =>
        <div
          key={index}
          className="h-10 animate-pulse rounded-lg bg-canvas"
          style={{ opacity: 1 - index * 0.12 }} />

        )}
      </div>
    </div>);

}

export function ErrorState({
  message,
  onRetry,
  action




}: {message: string;onRetry?: () => void;action?: React.ReactNode;}) {
  return (
    <div className="flex flex-col items-start gap-3 px-4 py-8 sm:items-center sm:px-5 sm:text-center" role="alert">
      <span className="flex h-10 w-10 items-center justify-center rounded-full bg-danger-50 text-danger-600">
        <AlertTriangleIcon className="h-5 w-5" aria-hidden="true" />
      </span>
      <div className="max-w-xl">
        <h3 className="text-[15px] font-semibold text-ink">Something went wrong</h3>
        <p className="mt-1 text-[13px] leading-relaxed text-ink-muted">{message}</p>
      </div>
      <div className="flex flex-wrap gap-2">
        {onRetry &&
        <Button variant="secondary" size="sm" icon={RefreshCwIcon} onClick={onRetry}>
            Try again
          </Button>
        }
        {action}
      </div>
    </div>);

}

export function EmptyState({
  title,
  description,
  action,
  icon: Icon = InboxIcon





}: {title: string;description?: string;action?: React.ReactNode;icon?: React.ComponentType<{className?: string;}>;}) {
  return (
    <div className="flex flex-col items-center gap-3 px-4 py-12 text-center sm:px-5">
      <span className="flex h-11 w-11 items-center justify-center rounded-full bg-canvas text-ink-soft">
        <Icon className="h-5 w-5" />
      </span>
      <div className="max-w-md">
        <h3 className="text-[15px] font-semibold text-ink">{title}</h3>
        {description && <p className="mt-1 text-[13px] leading-relaxed text-ink-muted">{description}</p>}
      </div>
      {action}
    </div>);

}