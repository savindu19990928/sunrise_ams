import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowUpRightIcon } from 'lucide-react';
import { twMerge } from 'tailwind-merge';

type Tone = 'neutral' | 'brand' | 'warn' | 'danger' | 'success';

const iconTones: Record<Tone, string> = {
  neutral: 'bg-canvas text-ink-muted',
  brand: 'bg-brand-50 text-brand-600',
  warn: 'bg-warn-50 text-warn-600',
  danger: 'bg-danger-50 text-danger-600',
  success: 'bg-success-50 text-success-600'
};

interface StatCardProps {
  label: string;
  value: string;
  hint?: string;
  icon: React.ComponentType<{className?: string;}>;
  tone?: Tone;
  to?: string;
  featured?: boolean;
  loading?: boolean;
}

export function StatCard({
  label,
  value,
  hint,
  icon: Icon,
  tone = 'neutral',
  to,
  featured = false,
  loading = false
}: StatCardProps) {
  const body =
  <>
      <div className="flex items-start justify-between gap-3">
        <p className="text-[13px] font-medium text-ink-muted">{label}</p>
        <span className={twMerge('flex h-8 w-8 flex-none items-center justify-center rounded-lg', iconTones[tone])}>
          <Icon className="h-4 w-4" aria-hidden="true" />
        </span>
      </div>
      {loading ?
    <div className={twMerge('mt-3 h-8 w-24 animate-pulse rounded-md bg-canvas', featured && 'h-10 w-36')} /> :

    <p
      className={twMerge(
        'mt-2 font-semibold tracking-[-0.02em] text-ink',
        featured ? 'text-[30px] leading-tight sm:text-[36px]' : 'text-[22px] leading-tight sm:text-[26px]'
      )}>
      
          {value}
        </p>
    }
      {hint &&
    <p className="mt-1.5 flex items-center gap-1 text-[12px] text-ink-soft">
          {hint}
          {to && <ArrowUpRightIcon className="h-3 w-3" aria-hidden="true" />}
        </p>
    }
    </>;


  const className = twMerge(
    'block rounded-xl border border-line bg-surface p-4 shadow-card transition-[border-color,box-shadow] duration-150 ease-out',
    featured && 'sm:p-5',
    to && 'hover:border-brand-200 hover:shadow-pop'
  );

  if (to) {
    return (
      <Link to={to} className={className}>
        {body}
      </Link>);

  }
  return <div className={className}>{body}</div>;
}