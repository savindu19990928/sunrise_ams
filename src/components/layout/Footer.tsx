import React from 'react';

export function Footer({ className = '' }: {className?: string;}) {
  return (
    <footer className={`px-4 py-4 text-center text-[12px] text-ink-soft sm:px-6 ${className}`}>
      Made By{' '}
      <a
        href="https://www.devrious.lk"
        target="_blank"
        rel="noopener noreferrer"
        className="font-medium text-ink-muted underline-offset-2 transition-colors duration-150 ease-out hover:text-brand-700 hover:underline">
        
        Devrious
      </a>
    </footer>);

}