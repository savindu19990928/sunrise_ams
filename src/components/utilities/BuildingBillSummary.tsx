import { ReceiptTextIcon } from 'lucide-react';
import type { NormalizedBuildingServiceBill, ServiceKind } from '../../types';
import { formatCurrency, formatDate, formatMonth } from '../../utils/format';
import { SERVICE_CONFIG } from '../../utils/serviceRecords';
import { formatDifference, formatUnits, usageDifference } from '../../utils/utilityUsage';
import { Button } from '../ui/Button';

interface BuildingBillSummaryProps {
  kind: ServiceKind;
  month: string;
  bill: NormalizedBuildingServiceBill | null;
  roomsRecorded: number;
  totalRoomsCost: number;
  loading: boolean;
  onEnter: () => void;
}

/** The month's building electricity or water bill and the per-unit price it produced. */
export function BuildingBillSummary({
  kind,
  month,
  bill,
  roomsRecorded,
  totalRoomsCost,
  loading,
  onEnter
}: BuildingBillSummaryProps) {
  const config = SERVICE_CONFIG[kind];

  if (loading) {
    return <div className="h-[154px] animate-pulse rounded-xl border border-line bg-surface shadow-card" aria-hidden="true" />;
  }

  if (!bill) {
    return (
      <div className="flex flex-col gap-3 rounded-xl border border-dashed border-line bg-surface px-5 py-5 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <p className="text-sm font-medium text-ink">
            No building {config.lowerLabel} bill for {formatMonth(month)}
          </p>
          <p className="mt-0.5 text-[12px] text-ink-soft">
            Enter the monthly {config.supplierShort} total and each room&apos;s {config.lowerLabel} meter reading to calculate bills.
          </p>
        </div>
        <Button icon={ReceiptTextIcon} onClick={onEnter} className="flex-none">
          Enter building {config.lowerLabel} bill
        </Button>
      </div>
    );
  }

  const difference =
    bill.units_difference !== undefined && bill.units_difference !== null && bill.units_difference !== ''
      ? Number(bill.units_difference)
      : usageDifference(bill.supplier_units, bill.total_units);
  const tone =
    difference === null ? 'text-ink-soft' : Math.abs(difference) < 0.005 ? 'text-success-700' : 'text-warn-700';

  return (
    <section
      aria-label={`Building ${config.lowerLabel} bill for ${formatMonth(month)}`}
      className="grid gap-5 rounded-xl border border-line bg-surface px-5 py-4 shadow-card sm:grid-cols-[1fr_auto] sm:items-end"
    >
      <div className="min-w-0">
        <p className="text-[13px] text-ink-muted">{config.label} price per unit</p>
        <p className="mt-1 text-[26px] font-semibold leading-tight tracking-[-0.02em] text-ink">
          {formatCurrency(bill.unit_price)}
        </p>
        <p className="mt-1 text-[12px] text-ink-soft">
          {formatCurrency(bill.total_bill)} supplier bill ÷ {formatUnits(bill.total_units)} metered units
        </p>
        <dl className="mt-3 grid max-w-lg grid-cols-3 gap-2 border-t border-line pt-2.5 text-[12px]">
          <div className="min-w-0">
            <dt className="text-ink-soft">Supplier units</dt>
            <dd className="truncate font-medium text-ink">
              {bill.supplier_units === null || bill.supplier_units === undefined ? '—' : formatUnits(bill.supplier_units)}
            </dd>
          </div>
          <div className="min-w-0">
            <dt className="text-ink-soft">Room units</dt>
            <dd className="truncate font-medium text-ink">{formatUnits(bill.total_units)} u</dd>
          </div>
          <div className="min-w-0">
            <dt className="text-ink-soft">Difference</dt>
            <dd className={`truncate font-medium ${tone}`}>
              {difference === null ? '—' : formatDifference(difference, bill.supplier_units)}
            </dd>
          </div>
        </dl>
      </div>

      <dl className="grid grid-cols-2 gap-x-6 gap-y-1 border-t border-line pt-3 text-[13px] sm:border-l sm:border-t-0 sm:pl-6 sm:pt-0">
        <dt className="text-ink-muted">Rooms billed</dt>
        <dd className="text-right font-medium text-ink">{roomsRecorded}</dd>
        <dt className="text-ink-muted">Room bills total</dt>
        <dd className="whitespace-nowrap text-right font-medium text-ink">{formatCurrency(totalRoomsCost)}</dd>
        <dt className="text-ink-muted">Billing date</dt>
        <dd className="whitespace-nowrap text-right font-medium text-ink">{formatDate(bill.billing_date || bill.billing_month)}</dd>
      </dl>
    </section>
  );
}
