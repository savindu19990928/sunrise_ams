import React from 'react';
import { Loader2Icon } from 'lucide-react';
import { twMerge } from 'tailwind-merge';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'subtle';
type Size = 'sm' | 'md' | 'lg';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
  icon?: React.ComponentType<{className?: string;}>;
  fullWidth?: boolean;
}

const variants: Record<Variant, string> = {
  primary: 'bg-brand-600 text-white hover:bg-brand-700 border border-brand-600 hover:border-brand-700',
  secondary: 'bg-surface text-ink border border-line hover:bg-canvas',
  ghost: 'bg-transparent text-ink-muted border border-transparent hover:bg-canvas hover:text-ink',
  danger: 'bg-danger-600 text-white border border-danger-600 hover:bg-danger-700 hover:border-danger-700',
  subtle: 'bg-brand-50 text-brand-700 border border-brand-100 hover:bg-brand-100'
};

const sizes: Record<Size, string> = {
  sm: 'h-9 px-3 text-[13px] gap-1.5',
  md: 'h-10 px-4 text-sm gap-2',
  lg: 'h-11 px-5 text-sm gap-2'
};

export function Button({
  variant = 'primary',
  size = 'md',
  loading = false,
  icon: Icon,
  fullWidth = false,
  className,
  children,
  disabled,
  type = 'button',
  ...rest
}: ButtonProps) {
  return (
    <button
      type={type}
      disabled={disabled || loading}
      className={twMerge(
        'inline-flex items-center justify-center rounded-lg font-medium transition-[background-color,border-color,color,box-shadow] duration-150 ease-out disabled:cursor-not-allowed disabled:opacity-55 whitespace-nowrap',
        variants[variant],
        sizes[size],
        fullWidth && 'w-full',
        className
      )}
      {...rest}>
      
      {loading ?
      <Loader2Icon className="h-4 w-4 animate-spin" aria-hidden="true" /> :

      Icon && <Icon className="h-4 w-4" aria-hidden="true" />
      }
      {children}
    </button>);

}