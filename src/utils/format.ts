export function formatCurrency(value: number | string | null | undefined): string {
  const n = toNumber(value);
  return `Rs ${n.toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  })}`;
}

export function formatCompactCurrency(value: number | string | null | undefined): string {
  const n = toNumber(value);
  if (Math.abs(n) >= 1_000_000) return `Rs ${(n / 1_000_000).toFixed(1)}M`;
  if (Math.abs(n) >= 10_000) return `Rs ${(n / 1000).toFixed(1)}K`;
  return formatCurrency(n);
}

export function toNumber(value: number | string | null | undefined): number {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string') {
    const parsed = Number.parseFloat(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return 0;
}

export function formatDate(value: string | null | undefined): string {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

export function formatMonth(value: string | null | undefined): string {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' });
}

export function toISODate(date: Date): string {
  const y = date.getFullYear();
  const m = `${date.getMonth() + 1}`.padStart(2, '0');
  const d = `${date.getDate()}`.padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function firstOfCurrentMonth(): string {
  const now = new Date();
  return toISODate(new Date(now.getFullYear(), now.getMonth(), 1));
}

export function today(): string {
  return toISODate(new Date());
}

export function firstOfMonth(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return toISODate(new Date(date.getFullYear(), date.getMonth(), 1));
}

export function monthInputValue(value: string | null | undefined): string {
  if (!value) return '';
  return value.slice(0, 7);
}

export function titleCase(value: string): string {
  return value.
  replace(/[_-]+/g, ' ').
  replace(/\b\w/g, (c) => c.toUpperCase()).
  trim();
}

export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).slice(0, 2);
  return parts.map((p) => p.charAt(0).toUpperCase()).join('') || '?';
}