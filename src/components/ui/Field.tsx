import React from 'react';
import { twMerge } from 'tailwind-merge';

const controlClass =
'w-full rounded-lg border border-line bg-surface px-3 text-sm text-ink placeholder:text-ink-soft transition-[border-color,box-shadow] duration-150 ease-out focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20 disabled:bg-canvas disabled:text-ink-soft';

interface FieldProps {
  label: string;
  htmlFor?: string;
  hint?: string;
  error?: string;
  required?: boolean;
  className?: string;
  children: React.ReactNode;
}

export function Field({ label, htmlFor, hint, error, required, className, children }: FieldProps) {
  return (
    <div className={twMerge('flex flex-col gap-1.5', className)}>
      <label htmlFor={htmlFor} className="text-[13px] font-medium text-ink-muted">
        {label}
        {required && <span className="ml-0.5 text-danger-500">*</span>}
      </label>
      {children}
      {error ?
      <p className="text-[12px] text-danger-600">{error}</p> :
      hint ?
      <p className="text-[12px] text-ink-soft">{hint}</p> :
      null}
    </div>);

}

export const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  function Input({ className, ...rest }, ref) {
    return <input ref={ref} className={twMerge(controlClass, 'h-10', className)} {...rest} />;
  }
);

export const Select = React.forwardRef<HTMLSelectElement, React.SelectHTMLAttributes<HTMLSelectElement>>(
  function Select({ className, children, ...rest }, ref) {
    return (
      <select ref={ref} className={twMerge(controlClass, 'h-10 pr-8 appearance-none bg-no-repeat', className)}
      style={{
        backgroundImage:
        "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='%235a6674' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpolyline points='6 9 12 15 18 9'/%3E%3C/svg%3E\")",
        backgroundPosition: 'right 0.65rem center'
      }}
      {...rest}>
        
        {children}
      </select>);

  }
);

export const Textarea = React.forwardRef<HTMLTextAreaElement, React.TextareaHTMLAttributes<HTMLTextAreaElement>>(
  function Textarea({ className, rows = 3, ...rest }, ref) {
    return <textarea ref={ref} rows={rows} className={twMerge(controlClass, 'py-2 leading-relaxed', className)} {...rest} />;
  }
);