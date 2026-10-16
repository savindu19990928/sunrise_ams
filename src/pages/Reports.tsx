import React, { useMemo, useState } from 'react';
import { DownloadIcon, FileTextIcon, PlayIcon, TableIcon } from 'lucide-react';
import { toast } from 'sonner';
import type { Customer, ReportType } from '../types';
import { useCollection, useResource } from '../hooks/useResource';
import { ProfitChart } from '../components/reports/ProfitChart';
import { type ReportRow, ReportTable } from '../components/reports/ReportTable';
import { ApiErrorState } from '../components/ui/ApiErrorState';
import { Button } from '../components/ui/Button';
import { Card, CardHeader } from '../components/ui/Card';
import { Field, Input, Select } from '../components/ui/Field';
import { PageHeader } from '../components/ui/PageHeader';
import { EmptyState } from '../components/ui/States';
import { buildQuery } from '../utils/api';
import { firstOfCurrentMonth, formatCurrency, formatDate, titleCase, today } from '../utils/format';
import { customerName } from '../utils/lookup';
import { type ReportExport, downloadReportCsv, downloadReportPdf } from '../utils/reportPdf';
import { flattenReportRows } from '../utils/reportFormat';
import { withDailyAverages } from '../utils/utilityUsage';

interface ReportDefinition {
  type: ReportType;
  label: string;
  description: string;
  needsCustomer?: boolean;
}

const reports: ReportDefinition[] = [
{ type: 'room-data', label: 'Room data', description: 'Current configuration of every room: rent, deposit and monthly deduction.' },
{ type: 'customer-details', label: 'Customer details', description: 'Contact details with deposit paid and total payments in the period.' },
{ type: 'customer-payments', label: 'Customer payments', description: 'Every payment made by one specific customer.', needsCustomer: true },
{ type: 'all-payments', label: 'All payments', description: 'All payments recorded across the system in the period.' },
{ type: 'this-month-charges', label: 'Charges', description: 'Bills generated in the period with their full breakdown.' },
{ type: 'room-repairs', label: 'Room repairs', description: 'Repair costs broken down by room.' },
{ type: 'profits', label: 'Profits', description: 'Rent revenue less repair costs, with per-room profit. Utility payments to suppliers are excluded.' },
{
  type: 'utility-payments',
  label: 'Utility supplier payments',
  description: 'Utility bills tenants paid directly to suppliers, with receipts and still-unpaid room bills. Not business income.'
}];


const NUMERIC_STRING = /^-?\d+(\.\d+)?$/;

function findRows(payload: unknown): ReportRow[] {
  if (!payload) return [];
  if (Array.isArray(payload)) return payload as ReportRow[];
  if (typeof payload !== 'object') return [];
  const record = payload as Record<string, unknown>;
  if (Array.isArray(record.results)) return record.results as ReportRow[];
  for (const value of Object.values(record)) {
    if (Array.isArray(value) && value.every((item) => item && typeof item === 'object')) return value as ReportRow[];
  }
  return [];
}

function findBreakdown(payload: unknown): {label: string;data: Record<string, number>;} | null {
  if (!payload || typeof payload !== 'object') return null;
  const record = payload as Record<string, unknown>;
  for (const [key, value] of Object.entries(record)) {
    if (
    value &&
    typeof value === 'object' &&
    !Array.isArray(value) &&
    Object.values(value as Record<string, unknown>).every((item) => typeof item === 'number'))
    {
      const entries = Object.entries(value as Record<string, number>);
      if (entries.length) return { label: titleCase(key), data: value as Record<string, number> };
    }
  }
  return null;
}

function findTotals(payload: unknown): {key: string;value: number;}[] {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) return [];
  return Object.entries(payload as Record<string, unknown>).
  filter(
    ([key, value]) =>
    (typeof value === 'number' || typeof value === 'string' && NUMERIC_STRING.test(value)) &&
    /total|profit|revenue|repair|expense|utility/i.test(key) &&
    !/count/i.test(key)
  ).
  map(([key, value]) => ({ key, value: Number(value) }));
}

function findNote(payload: unknown): string | null {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) return null;
  const note = (payload as Record<string, unknown>).note;
  return typeof note === 'string' ? note : null;
}

function findUnpaidUtilities(payload: unknown): ReportRow[] {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) return [];
  const value = (payload as Record<string, unknown>).unpaid_utility_records;
  return Array.isArray(value) ? value as ReportRow[] : [];
}

export function Reports() {
  const [active, setActive] = useState<ReportType>('profits');
  const [startDate, setStartDate] = useState(firstOfCurrentMonth());
  const [endDate, setEndDate] = useState(today());
  const [customerId, setCustomerId] = useState('');

  const { data: customers } = useCollection<Customer>('/api/customers/');
  const definition = reports.find((report) => report.type === active) as ReportDefinition;

  const path = useMemo(() => {
    if (definition.needsCustomer && !customerId) return null;
    return `/api/reports/${active}/${buildQuery({
      start_date: startDate,
      end_date: endDate,
      customer_id: definition.needsCustomer ? customerId : undefined
    })}`;
  }, [active, startDate, endDate, customerId, definition]);

  const { data, loading, error, reload } = useResource<unknown>(path);

  // Average per-day usage is derived here and placed right after each usage column.
  const rows = useMemo(() => withDailyAverages(flattenReportRows(active, findRows(data))), [active, data]);
  const unpaidUtilities = useMemo(
    () => active === 'utility-payments' ? withDailyAverages(findUnpaidUtilities(data)) : [],
    [active, data]
  );
  const breakdown = useMemo(() => findBreakdown(data), [data]);
  const totals = useMemo(() => findTotals(data), [data]);
  const note = useMemo(() => findNote(data), [data]);
  const period = useMemo(() => {
    if (!data || typeof data !== 'object') return null;
    const value = (data as Record<string, unknown>).period;
    if (value && typeof value === 'object') return value as {start?: string;end?: string;};
    return null;
  }, [data]);

  const selectedCustomer = useMemo(
    () => customers.find((customer) => String(customer.id) === customerId),
    [customers, customerId]
  );

  const exportInput: ReportExport = useMemo(
    () => ({
      label: definition.label,
      description: definition.description,
      period: period ?? { start: startDate, end: endDate },
      totals,
      breakdown,
      rows,
      scopeLabel: definition.needsCustomer ? customerName(selectedCustomer) : 'Whole building'
    }),
    [definition, period, startDate, endDate, totals, breakdown, rows, selectedCustomer]
  );

  const canExport = Boolean(path) && !loading && !error && (rows.length > 0 || totals.length > 0 || Boolean(breakdown));

  return (
    <div className="space-y-5">
      <PageHeader
        title="Reports"
        description="Run any report for a date range, then download it as a branded PDF or a spreadsheet-ready CSV."
        actions={
        <>
            <Button
            variant="secondary"
            icon={TableIcon}
            disabled={!canExport}
            onClick={() => {
              downloadReportCsv(exportInput);
              toast.success(`${definition.label} report downloaded as CSV`);
            }}>
            
              CSV
            </Button>
            <Button
            variant="secondary"
            icon={DownloadIcon}
            disabled={!canExport}
            onClick={() => {
              downloadReportPdf(exportInput);
              toast.success(`${definition.label} report downloaded as PDF`);
            }}>
            
              PDF
            </Button>
            <Button icon={PlayIcon} onClick={reload} loading={loading}>
              Run report
            </Button>
          </>
        } />
      

      {/* Report picker */}
      <div className="-mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
        <div className="flex min-w-max gap-2 sm:flex-wrap">
          {reports.map((report) => {
            const isActive = report.type === active;
            return (
              <button
                key={report.type}
                type="button"
                onClick={() => setActive(report.type)}
                aria-pressed={isActive}
                className={`rounded-lg border px-3 py-2 text-[13px] font-medium transition-colors duration-150 ease-out ${
                isActive ?
                'border-brand-600 bg-brand-600 text-white' :
                'border-line bg-surface text-ink-muted hover:bg-canvas hover:text-ink'}`
                }>
                
                {report.label}
              </button>);

          })}
        </div>
      </div>

      <Card>
        <CardHeader
          title={definition.label}
          description={definition.description}
          actions={
          <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
              <Field label="Start date" htmlFor="report_start" className="sm:w-40">
                <Input id="report_start" type="date" value={startDate} onChange={(event) => setStartDate(event.target.value)} />
              </Field>
              <Field label="End date" htmlFor="report_end" className="sm:w-40">
                <Input id="report_end" type="date" value={endDate} onChange={(event) => setEndDate(event.target.value)} />
              </Field>
              {definition.needsCustomer &&
            <Field label="Customer" htmlFor="report_customer" className="sm:w-56" required>
                  <Select id="report_customer" value={customerId} onChange={(event) => setCustomerId(event.target.value)}>
                    <option value="">Select customer…</option>
                    {customers.map((customer) =>
                <option key={customer.id} value={customer.id}>
                        {customerName(customer)}
                      </option>
                )}
                  </Select>
                </Field>
            }
            </div>
          } />
        

        {!path ?
        <EmptyState
          icon={FileTextIcon}
          title="Select a customer"
          description="This report needs a customer before it can be generated." /> :

        error ?
        <ApiErrorState error={error} onRetry={reload} /> :

        <>
            {(period || totals.length > 0) && !loading &&
          <div className="flex flex-col gap-4 border-b border-line px-4 py-4 sm:flex-row sm:flex-wrap sm:items-end sm:px-5">
                {period &&
            <div>
                    <p className="text-[11px] uppercase tracking-wide text-ink-soft">Period</p>
                    <p className="mt-0.5 text-sm text-ink">
                      {formatDate(period.start)} → {formatDate(period.end)}
                    </p>
                  </div>
            }
                {totals.map((total, index) =>
            <div key={total.key} className={index === 0 ? 'sm:ml-auto' : undefined}>
                    <p className="text-[11px] uppercase tracking-wide text-ink-soft">{titleCase(total.key)}</p>
                    <p
                className={`mt-0.5 font-semibold tracking-[-0.02em] ${
                index === 0 ? 'text-[26px] leading-tight text-ink' : 'text-lg text-ink'} ${
                total.value < 0 ? 'text-danger-600' : ''}`}>
                
                      {formatCurrency(total.value)}
                    </p>
                  </div>
            )}
              </div>
          }

            {note && !loading &&
          <p className="border-b border-line bg-subtle px-4 py-2.5 text-[13px] text-ink-muted sm:px-5">{note}</p>
          }

            {breakdown && !loading && <ProfitChart data={breakdown.data} label={breakdown.label} />}

            <ReportTable
            rows={rows}
            loading={loading}
            emptyTitle="No rows for this period"
            emptyDescription="Try widening the date range, or check that data exists for these dates." />
          

            {active === 'utility-payments' && !loading && unpaidUtilities.length > 0 &&
          <div className="border-t border-line">
                <div className="px-4 pb-1 pt-4 sm:px-5">
                  <h3 className="text-[14px] font-semibold text-ink">Unpaid room utility bills</h3>
                  <p className="mt-0.5 text-[13px] text-ink-muted">
                    {unpaidUtilities.length} room bill{unpaidUtilities.length === 1 ? '' : 's'} not yet settled with the supplier.
                  </p>
                </div>
                <ReportTable rows={unpaidUtilities} />
              </div>
          }
          </>
        }
      </Card>
    </div>);

}