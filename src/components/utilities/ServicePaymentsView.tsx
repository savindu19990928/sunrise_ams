import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { BanknoteIcon } from 'lucide-react';
import type { NormalizedServicePayment, NormalizedServiceRow, Room, ServiceKind } from '../../types';
import { useAction } from '../../hooks/useAction';
import { useCollection } from '../../hooks/useResource';
import { formatCurrency, formatDate, formatMonth, monthInputValue, toNumber } from '../../utils/format';
import { mapById } from '../../utils/lookup';
import { notifyRemindersChanged } from '../../utils/reminders';
import {
  isAdvanceCreditReference,
  normalizeBuildingBill,
  normalizeServicePayment,
  normalizeServiceRow,
  SERVICE_CONFIG
} from '../../utils/serviceRecords';
import { ApiErrorState } from '../ui/ApiErrorState';
import { Badge } from '../ui/Badge';
import { Button } from '../ui/Button';
import { Card, CardHeader } from '../ui/Card';
import { type Column, DataTable } from '../ui/DataTable';
import { Field, Input } from '../ui/Field';
import { PageHeader } from '../ui/PageHeader';
import { SearchInput } from '../ui/SearchInput';
import { UtilityPaymentModal } from './UtilityPaymentModal';

interface ServicePaymentsViewProps {
  kind: ServiceKind;
}

export function ServicePaymentsView({ kind }: ServicePaymentsViewProps) {
  const config = SERVICE_CONFIG[kind];
  const [searchParams, setSearchParams] = useSearchParams();
  const { data: rawPayments, loading, error, reload } = useCollection<unknown>(config.paymentsPath);
  const { data: rawBuildingBills, reload: reloadBuildingBills } = useCollection<unknown>(config.buildingBillsListPath);
  const { data: rawRecords, reload: reloadRecords } = useCollection<unknown>(config.recordsPath);
  const { data: rooms } = useCollection<Room>('/api/rooms/');
  const [month, setMonth] = useState('');
  const [query, setQuery] = useState('');
  const [modalOpen, setModalOpen] = useState(false);

  const paymentAction = useAction();

  useEffect(() => {
    if (searchParams.get('new') === '1') {
      setModalOpen(true);
      searchParams.delete('new');
      setSearchParams(searchParams, { replace: true });
    }
  }, [searchParams, setSearchParams]);

  const roomMap = useMemo(() => mapById(rooms), [rooms]);

  const records = useMemo<NormalizedServiceRow[]>(
    () =>
      rawRecords.map((item) => {
        const row = normalizeServiceRow(kind, item);
        const room = roomMap.get(row.room_id);
        return room && (!row.room_number || row.room_number === String(row.room_id))
          ? { ...row, room_number: room.room_number }
          : row;
      }),
    [kind, rawRecords, roomMap]
  );

  const recordMap = useMemo(() => new Map(records.map((r) => [r.record_id, r])), [records]);

  const payments = useMemo<NormalizedServicePayment[]>(
    () =>
      rawPayments.map((item) => {
        const payment = normalizeServicePayment(kind, item);
        const linked = payment.record_id ? recordMap.get(payment.record_id) : undefined;
        return {
          ...payment,
          room_number: payment.room_number ?? linked?.room_number,
          billing_month: payment.billing_month ?? linked?.billing_month
        };
      }),
    [kind, rawPayments, recordMap]
  );

  const buildingBills = useMemo(
    () =>
      rawBuildingBills
        .map((item) => normalizeBuildingBill(kind, item))
        .filter((item): item is NonNullable<typeof item> => Boolean(item)),
    [kind, rawBuildingBills]
  );

  const afterPayment = useCallback(() => {
    reload();
    reloadRecords();
    reloadBuildingBills();
    notifyRemindersChanged();
  }, [reload, reloadRecords, reloadBuildingBills]);

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return payments
      .filter((payment) => !month || monthInputValue(payment.billing_month) === month)
      .filter(
        (payment) =>
          !needle ||
          `${payment.room_number ?? ''} ${payment.receipt_reference ?? ''} ${payment.notes ?? ''}`
            .toLowerCase()
            .includes(needle)
      )
      .sort((a, b) => b.payment_date.localeCompare(a.payment_date) || b.id - a.id);
  }, [payments, month, query]);

  const totalPaid = filtered.reduce((sum, payment) => sum + toNumber(payment.amount_paid), 0);
  const monthBill = month ? buildingBills.find((bill) => monthInputValue(bill.billing_month) === month) : undefined;
  const monthBillTotal = monthBill ? toNumber(monthBill.total_bill) : null;

  const columns: Column<NormalizedServicePayment>[] = [
    {
      key: 'room',
      header: 'Room',
      primary: true,
      render: (payment) => (
        <span className="font-medium text-ink">
          Room {payment.room_number ?? `#${payment.record_id ?? payment.id}`}
        </span>
      )
    },
    {
      key: 'month',
      header: 'Billing month',
      render: (payment) => <span className="text-ink-muted">{formatMonth(payment.billing_month)}</span>
    },
    {
      key: 'date',
      header: 'Paid on',
      render: (payment) => <span className="whitespace-nowrap text-ink">{formatDate(payment.payment_date)}</span>
    },
    {
      key: 'reference',
      header: `${config.supplierShort} receipt`,
      render: (payment) =>
        isAdvanceCreditReference(payment.receipt_reference) ? (
          <Badge tone="brand">Covered by advance credit</Badge>
        ) : payment.receipt_reference ? (
          <span className="font-mono text-[12px] text-ink">{payment.receipt_reference}</span>
        ) : (
          <span className="text-ink-soft">—</span>
        )
    },
    {
      key: 'notes',
      header: 'Notes',
      className: 'max-w-[260px]',
      render: (payment) => <span className="line-clamp-2 text-ink-muted">{payment.notes || '—'}</span>
    },
    {
      key: 'amount',
      header: 'Amount',
      align: 'right',
      render: (payment) => <span className="font-semibold text-ink">{formatCurrency(payment.amount_paid)}</span>
    }
  ];

  return (
    <div className="space-y-5">
      <PageHeader
        title={`${config.label} payments`}
        description={`${config.label} bills tenants paid directly to ${config.supplierName}. Kept separate from rent and excluded from accommodation income.`}
        actions={
          <>
            <Link
              to={config.route}
              className="inline-flex h-9 items-center justify-center rounded-lg border border-line bg-surface px-3 text-[13px] font-medium text-ink transition-colors duration-150 ease-out hover:bg-canvas"
            >
              {config.label} bills
            </Link>
            <Button icon={BanknoteIcon} onClick={() => setModalOpen(true)}>
              Record {config.lowerLabel} payment
            </Button>
          </>
        }
      />

      <Card>
        <CardHeader
          title={month ? `${config.label} payments for ${formatMonth(`${month}-01`)}` : `All ${config.lowerLabel} payments`}
          description={`${filtered.length} payment${filtered.length === 1 ? '' : 's'} · ${formatCurrency(totalPaid)} paid${
            monthBillTotal !== null ? ` of ${formatCurrency(monthBillTotal)} building bill` : ''
          }`}
          actions={
            <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
              <SearchInput value={query} onChange={setQuery} placeholder="Search room or receipt" />
              <Field label="Billing month" htmlFor={`${kind}_payment_month`} className="sm:w-44">
                <Input
                  id={`${kind}_payment_month`}
                  type="month"
                  value={month}
                  onChange={(event) => setMonth(event.target.value)}
                />
              </Field>
            </div>
          }
        />

        {error ? (
          <ApiErrorState error={error} onRetry={reload} />
        ) : (
          <DataTable
            columns={columns}
            rows={filtered}
            keyOf={(payment) => payment.id}
            loading={loading}
            emptyTitle={payments.length ? 'No payments match this filter' : `No ${config.lowerLabel} payments yet`}
            emptyDescription={
              payments.length
                ? 'Clear the month or search to see every payment.'
                : `Record a payment here or from the ${config.label} page once the tenant has paid ${config.supplierShort}.`
            }
            emptyAction={
              payments.length ? undefined : (
                <Button icon={BanknoteIcon} onClick={() => setModalOpen(true)}>
                  Record {config.lowerLabel} payment
                </Button>
              )
            }
            footer={
              filtered.length ? (
                <span>
                  Total paid to {config.supplierShort}:{' '}
                  <span className="font-semibold text-ink">{formatCurrency(totalPaid)}</span>
                </span>
              ) : undefined
            }
          />
        )}
      </Card>

      <UtilityPaymentModal
        kind={kind}
        row={null}
        open={modalOpen}
        records={records}
        pending={paymentAction.pending}
        error={paymentAction.error}
        onClose={() => {
          setModalOpen(false);
          paymentAction.setError(null);
        }}
        onSubmit={async (selectedRow, payload, excess) => {
          const result = await paymentAction.run(
            config.recordPaymentPath(selectedRow.record_id),
            payload,
            excess > 0
              ? `${config.label} payment recorded to ${config.supplierShort}. ${formatCurrency(excess)} kept as advance ${config.lowerLabel} credit for Room ${selectedRow.room_number}.`
              : `${config.label} payment recorded to ${config.supplierShort} for Room ${selectedRow.room_number}.`
          );
          if (!result) return;
          setModalOpen(false);
          afterPayment();
        }}
      />
    </div>
  );
}
