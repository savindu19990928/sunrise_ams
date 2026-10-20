import React from 'react';

interface PageHeaderProps {
  title: string;
  description?: string;
  subtitle?: string;
  actions?: React.ReactNode;
}

export function PageHeader({ title, description, subtitle, actions }: PageHeaderProps) {
  const desc = description ?? subtitle;
  return (
    <header className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
      <div className="min-w-0">
        <h1 className="text-xl font-semibold tracking-[-0.01em] text-ink sm:text-2xl">{title}</h1>
        {desc && <p className="mt-1 max-w-2xl text-[13px] leading-relaxed text-ink-muted sm:text-sm">{desc}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </header>
  );
}