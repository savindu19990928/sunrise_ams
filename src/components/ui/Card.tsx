import React from 'react';
import { twMerge } from 'tailwind-merge';

interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
}

export function Card({ className, children, ...rest }: CardProps) {
  return (
    <div
      className={twMerge('rounded-xl border border-line bg-surface shadow-card', className)}
      {...rest}>
      
      {children}
    </div>);

}

interface CardHeaderProps {
  title: string;
  description?: string;
  actions?: React.ReactNode;
  className?: string;
}

export function CardHeader({ title, description, actions, className }: CardHeaderProps) {
  return (
    <div
      className={twMerge(
        'flex flex-col gap-3 border-b border-line px-4 py-3.5 sm:flex-row sm:items-center sm:justify-between sm:px-5',
        className
      )}>
      
      <div className="min-w-0">
        <h2 className="truncate text-[15px] font-semibold text-ink">{title}</h2>
        {description && <p className="mt-0.5 text-[13px] text-ink-muted">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>);

}

export function CardBody({ className, children, ...rest }: CardProps) {
  return (
    <div className={twMerge('px-4 py-4 sm:px-5', className)} {...rest}>
      {children}
    </div>);

}