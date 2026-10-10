import React from 'react';
import { twMerge } from 'tailwind-merge';

export type BadgeTone = 'neutral' | 'success' | 'warn' | 'danger' | 'brand';

const tones: Record<BadgeTone, string> = {
  neutral: 'bg-canvas text-ink-muted border-line',
  success: 'bg-success-50 text-success-700 border-success-100',
  warn: 'bg-warn-50 text-warn-700 border-warn-100',
  danger: 'bg-danger-50 text-danger-700 border-danger-100',
  brand: 'bg-brand-50 text-brand-700 border-brand-100'
};

interface BadgeProps {
  tone?: BadgeTone;
  children: React.ReactNode;
  className?: string;
}

export function Badge({ tone = 'neutral', children, className }: BadgeProps) {
  return (
    <span
      className={twMerge(
        'inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-[12px] font-medium',
        tones[tone],
        className
      )}>
      
      {children}
    </span>);

}