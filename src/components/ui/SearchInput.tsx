import React from 'react';
import { SearchIcon, XIcon } from 'lucide-react';
import { twMerge } from 'tailwind-merge';

interface SearchInputProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  label?: string;
  className?: string;
}

export function SearchInput({ value, onChange, placeholder = 'Search…', label = 'Search', className }: SearchInputProps) {
  return (
    <div className={twMerge('relative w-full sm:w-64', className)}>
      <SearchIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-soft" aria-hidden="true" />
      <input
        type="search"
        aria-label={label}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        className="h-10 w-full rounded-lg border border-line bg-surface pl-9 pr-9 text-sm text-ink placeholder:text-ink-soft transition-[border-color,box-shadow] duration-150 ease-out focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20" />
      
      {value &&
      <button
        type="button"
        onClick={() => onChange('')}
        aria-label="Clear search"
        className="absolute right-2 top-1/2 flex h-6 w-6 -translate-y-1/2 items-center justify-center rounded-md text-ink-soft transition-colors duration-150 ease-out hover:bg-canvas hover:text-ink">
        
          <XIcon className="h-3.5 w-3.5" />
        </button>
      }
    </div>);

}