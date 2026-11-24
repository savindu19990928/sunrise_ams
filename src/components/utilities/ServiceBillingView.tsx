import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import {
  BanknoteIcon,
  ClipboardListIcon,
  GaugeIcon,
  HistoryIcon,
  ReceiptTextIcon,
  SlidersHorizontalIcon,
  Trash2Icon,
  WalletIcon
} from 'lucide-react';
import type { Lease, NormalizedServiceRow, Room, ServiceKind, ServicePaymentResponse } from '../../types';
import { useAction } from '../../hooks/useAction';
import { useCrud } from '../../hooks/useCrud';
import { useCollection, useResource } from '../../hooks/useResource';
import { buildQuery } from '../../utils/api';
import { firstOfCurrentMonth, formatCurrency, formatDate, formatMonth, monthInputValue, titleCase, toNumber } from '../../utils/format';
import { mapById } from '../../utils/lookup';
import { notifyRemindersChanged } from '../../utils/reminders';
import {
  extractMonthlySummary,
  extractPreviousReadings,
  formatServicePaymentToast,
  SERVICE_CONFIG,
  serviceRemaining
} from '../../utils/serviceRecords';
import { formatUnits } from '../../utils/utilityUsage';
import { ApiErrorState } from '../ui/ApiErrorState';
import { Badge } from '../ui/Badge';
import { Button } from '../ui/Button';
import { Card, CardHeader } from '../ui/Card';
import { ConfirmDialog } from '../ui/ConfirmDialog';
import { type Column, DataTable } from '../ui/DataTable';
import { Field, Input } from '../ui/Field';
import { PageHeader } from '../ui/PageHeader';
import { BuildingBillModal } from './BuildingBillModal';
import { BuildingBillSummary } from './BuildingBillSummary';
import { BulkUnitPriceModal } from './BulkUnitPriceModal';
import { PreviousReadingsModal } from './PreviousReadingsModal';
import { RoomUtilityHistoryModal } from './RoomUtilityHistoryModal';
import { UnitPriceModal } from './UnitPriceModal';
import { UsageCell } from './UsageCell';
import { UtilityPaymentModal } from './UtilityPaymentModal';

interface ServiceBillingViewProps {
  kind: ServiceKind;
}

export function ServiceBillingView({ kind }: ServiceBillingViewProps) {
  const config = SERVICE_CONFIG[kind];
  const [searchParams, setSearchParams] = useSearchParams();
  const [month, setMonth] = useState(monthInputValue(firstOfCurrentMonth()));
  const [billOpen, setBillOpen] = useState(false);
  const [prevReadingsOpen, setPrevReadingsOpen] = useState(false);
  const [bulkPriceOpen, setBulkPriceOpen] = useState(false);
  const [pricing, setPricing] = useState<NormalizedServiceRow | null>(null);
  const [paying, setPaying] = useState<NormalizedServiceRow | null>(null);
  const [deleting, setDeleting] = useState<NormalizedServiceRow | null>(null);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [historyRoomId, setHistoryRoomId] = useState<number | null>(null);

  const summaryPath = month ? `${config.monthlySummaryPath}${buildQuery({ billing_month: month })}` : null;
  const prevReadingsPath =
    month && /^\d{4}-\d{2}$/.test(month) ? `${config.previousReadingsPath}${buildQuery({ billing_month: month })}` : null;

  const { data: rawSummary, loading, error, reload } = useResource<unknown>(summaryPath);
  const { data: rawPrevReadings, reload: reloadPrevReadings } = useResource<unknown>(prevReadingsPath);
  const { data: rooms, reload: reloadRooms } = useCollection<Room>('/api/rooms/');
  const { data: leases } = useCollection<Lease>('/api/leases/');

  const afterChange = useCallback(() => {
    reload();
    reloadPrevReadings();
    reloadRooms();
    notifyRemindersChanged();
  }, [reload, reloadPrevReadings, reloadRooms]);

  const billAction = useAction();
  const priceAction = useAction();
  const bulkPriceAction = useAction();
  const paymentAction = useAction();
  const creditAction = useAction();
  const [applyingId, setApplyingId] = useState<number | null>(null);

  const applyCredit = async (row: NormalizedServiceRow) => {
    setApplyingId(row.record_id);
    const result = await creditAction.run(
      config.applyCreditPath(row.record_id),
      {},
      `Advance ${config.lowerLabel} credit applied to Room ${row.room_number}.`
    );
    setApplyingId(null);
    if (result) afterChange();
  };

  const crud = useCrud(config.crudResource, {
    label: `${config.label} record`,
    onDone: () => {
      setDeleting(null);
      afterChange();
    }
  });

  useEffect(() => {
    const linkedMonth = searchParams.get('month');
    const openNew = searchParams.get('new') === '1';
    if (!linkedMonth && !openNew) return;
    if (linkedMonth && /^\d{4}-\d{2}$/.test(linkedMonth)) setMonth(linkedMonth);
    if (openNew) setBillOpen(true);
    searchParams.delete('month');
    searchParams.delete('new');
    setSearchParams(searchParams, { replace: true });
  }, [searchParams, setSearchParams]);

  // A month with no building bill yet comes back as 404 — treat it as empty, not an error.
  const notFound = error?.status === 404;
  const summary = useMemo(() => (notFound ? null : extractMonthlySummary(kind, rawSummary)), [kind, rawSummary, notFound]);
  const roomMap = useMemo(() => mapById(rooms), [rooms]);
  const rows = useMemo(() => {
    const base = summary?.rows ?? [];
    return base.map((row) => {
      if (row.room_credit_balance !== undefined && row.room_credit_balance !== null) return row;
      const room = roomMap.get(row.room_id);
      const roomCredit = kind === 'electricity' ? room?.electricity_credit_balance : room?.water_credit_balance;
      return roomCredit !== undefined ? { ...row, room_credit_balance: roomCredit } : row;
    });
  }, [summary, roomMap, kind]);

  const buildingBill = summary?.building_bill ?? null;
  const previousReadings = useMemo(() => extractPreviousReadings(kind, rawPrevReadings), [kind, rawPrevReadings]);
  const selectedMonth = `${month}-01`;
  const totalRoomsCost = rows.reduce((sum, row) => sum + toNumber(row.cost), 0);

  const openHistory = (roomId: number | null) => {
    setHistoryRoomId(roomId);
    setHistoryOpen(true);
  };

  const columns: Column<NormalizedServiceRow>[] = [
    {
      key: 'room',
      header: 'Room',
      primary: true,
      render: (row) => (
        <div className="min-w-0">
          <p className="font-medium text-ink">
            Room {row.room_number}
            {row.room_type && <span className="ml-1.5 text-[12px] font-normal text-ink-soft">{titleCase(row.room_type)}</span>}
          </p>
          <p className="truncate text-[12px] text-ink-muted">{row.customer_name || 'No tenant'}</p>
        </div>
      )
    },
    {
      key: 'usage',
      header: config.label,
      render: (row) => (
        <UsageCell
          units={row.units}
          month={selectedMonth}
          rate={row.unit_price}
          cost={row.cost}
          buildingRate={buildingBill?.unit_price}
          previousReading={row.previous_meter_reading}
          currentReading={row.meter_reading}
        />
      )
    },
    {
      key: 'total',
      header: 'Room bill',
      align: 'right',
      render: (row) => <span className="font-semibold text-ink">{formatCurrency(row.cost)}</span>
    },
    {
      key: 'supplier',
      header: `Paid to ${config.supplierShort}`,
      render: (row) => {
        const remaining = serviceRemaining(row);
        const paid = toNumber(row.total_paid);
        const credit = toNumber(row.room_credit_balance);
        return (
          <span className="flex flex-col items-start gap-0.5">
            {row.is_paid || remaining <= 0 ? (
              <Badge tone="success">Paid</Badge>
            ) : paid > 0 ? (
              <Badge tone="warn">{formatCurrency(remaining)} left</Badge>
            ) : (
              <Badge tone="danger">Unpaid</Badge>
            )}
            {row.billing_date && (
              <span className="text-[11px] text-ink-soft">Billed {formatDate(row.billing_date)}</span>
            )}
            {credit > 0 && (
              <span className="text-[11px] font-medium text-brand-700">
                {formatCurrency(credit)} {config.lowerLabel} credit
              </span>
            )}
          </span>
        );
      }
    }
  ];

  return (
    <div className="space-y-5">
      <PageHeader
        title={config.label}
        description={`Meter readings, per-unit rates, and payments sent directly to ${config.supplierName}.`}
        actions={
          <>
            <Link
              to={`/reports?type=recorrection-logs&category=${config.auditCategory}`}
              className="inline-flex h-9 items-center justify-center gap-1.5 rounded-lg border border-line bg-surface px-3 text-[13px] font-medium text-ink transition-colors duration-150 ease-out hover:bg-canvas"
            >
              <ClipboardListIcon className="h-4 w-4 text-ink-muted" aria-hidden="true" />
              Audit log
            </Link>
            <Button variant="secondary" icon={GaugeIcon} onClick={() => setPrevReadingsOpen(true)}>
              Previous readings
            </Button>
            <Button variant="secondary" icon={HistoryIcon} onClick={() => openHistory(null)}>
              Room history
            </Button>
            {rows.length > 0 && (
              <Button variant="secondary" icon={SlidersHorizontalIcon} onClick={() => setBulkPriceOpen(true)}>
                Custom rates
              </Button>
            )}
            <Button icon={ReceiptTextIcon} onClick={() => setBillOpen(true)}>
              Enter building bill
            </Button>
          </>
        }
      />

      <div className="flex flex-col gap-4 lg:flex-row lg:items-end">
        <div className="min-w-0 flex-1">
          <BuildingBillSummary
            kind={kind}
            month={selectedMonth}
            bill={buildingBill}
            roomsRecorded={rows.length}
            totalRoomsCost={totalRoomsCost}
            loading={loading}
            onEnter={() => setBillOpen(true)}
          />
        </div>
        <Field label="Billing month" htmlFor={`${kind}_month`} className="lg:w-48">
          <Input id={`${kind}_month`} type="month" value={month} onChange={(event) => setMonth(event.target.value)} />
        </Field>
      </div>

      <Card>
        <CardHeader
          title={`All rooms · ${formatMonth(selectedMonth)}`}
          actions={
            <Link
              to={config.paymentsRoute}
              className="text-[13px] font-medium text-brand-700 transition-colors duration-150 ease-out hover:text-brand-800"
            >
              View {config.lowerLabel} payments
            </Link>
          }
        />

        {error && !notFound ? (
          <ApiErrorState error={error} onRetry={reload} />
        ) : (
          <DataTable
            columns={columns}
            rows={rows}
            keyOf={(row) => row.record_id}
            loading={loading}
            emptyTitle={`No ${config.lowerLabel} data for ${formatMonth(selectedMonth)}`}
            emptyAction={
              <Button icon={ReceiptTextIcon} onClick={() => setBillOpen(true)}>
                Enter building {config.lowerLabel} bill
              </Button>
            }
            footer={
              rows.length ? (
                <span>
                  Room {config.lowerLabel} bills total:{' '}
                  <span className="font-semibold text-ink">{formatCurrency(totalRoomsCost)}</span>
                </span>
              ) : undefined
            }
            rowActions={(row) => (
              <>
                <Button variant="secondary" size="sm" icon={SlidersHorizontalIcon} onClick={() => setPricing(row)}>
                  Unit price
                </Button>
                {serviceRemaining(row) > 0 && toNumber(row.room_credit_balance) > 0 && (
                  <Button
                    variant="subtle"
                    size="sm"
                    icon={WalletIcon}
                    loading={creditAction.pending && applyingId === row.record_id}
                    onClick={() => applyCredit(row)}
                  >
                    Apply credit
                  </Button>
                )}
                <Button variant="secondary" size="sm" icon={BanknoteIcon} onClick={() => setPaying(row)}>
                  {serviceRemaining(row) > 0 ? 'Mark paid' : 'Add payment'}
                </Button>
                <Button variant="ghost" size="sm" icon={HistoryIcon} onClick={() => openHistory(row.room_id)}>
                  History
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  icon={Trash2Icon}
                  aria-label={`Delete Room ${row.room_number} ${config.lowerLabel} record`}
                  className="text-danger-600 hover:bg-danger-50 hover:text-danger-700"
                  onClick={() => setDeleting(row)}
                />
              </>
            )}
          />
        )}
      </Card>

      {(notFound || !buildingBill) && !rows.length && previousReadings.length > 0 && (
        <Card>
          <CardHeader
            title={`Previous ${config.lowerLabel} readings · before ${formatMonth(selectedMonth)}`}
            actions={
              <Button variant="secondary" size="sm" icon={GaugeIcon} onClick={() => setPrevReadingsOpen(true)}>
                View recent months
              </Button>
            }
          />
          <DataTable
            columns={[
              {
                key: 'room',
                header: 'Room',
                primary: true,
                render: (item) => (
                  <span className="font-medium text-ink">
                    Room {item.room_number}
                    {item.room_type && (
                      <span className="ml-1.5 text-[12px] font-normal text-ink-soft">{titleCase(item.room_type)}</span>
                    )}
                  </span>
                )
              },
              {
                key: 'reading',
                header: `Previous ${config.lowerLabel} meter`,
                render: (item) =>
                  item.previous_meter_reading !== null && item.previous_meter_reading !== undefined ? (
                    <span>
                      <span className="font-medium text-ink">{formatUnits(item.previous_meter_reading)}</span>
                      {item.last_billing_month && (
                        <span className="ml-1.5 text-[12px] text-ink-soft">
                          ({formatMonth(item.last_billing_month)})
                        </span>
                      )}
                    </span>
                  ) : (
                    <span className="text-ink-soft">—</span>
                  )
              }
            ]}
            rows={previousReadings}
            keyOf={(item) => item.room_id}
          />
        </Card>
      )}

      <BuildingBillModal
        kind={kind}
        open={billOpen}
        defaultMonth={month}
        rooms={rooms}
        leases={leases}
        existing={summary}
        pending={billAction.pending}
        error={billAction.error}
        onClose={() => {
          setBillOpen(false);
          billAction.setError(null);
        }}
        onSubmit={async (payload, billMonth) => {
          const result = await billAction.run(
            config.buildingBillPostPath,
            payload,
            `${config.label} calculated for ${formatMonth(`${billMonth}-01`)}.`
          );
          if (!result) return;
          setBillOpen(false);
          if (billMonth === month) afterChange();
          else {
            setMonth(billMonth);
            notifyRemindersChanged();
          }
        }}
      />

      <UnitPriceModal
        kind={kind}
        row={pricing}
        month={selectedMonth}
        buildingBill={buildingBill}
        pending={priceAction.pending}
        error={priceAction.error}
        onClose={() => {
          setPricing(null);
          priceAction.setError(null);
        }}
        onSubmit={async (row, payload) => {
          const result = await priceAction.run(
            config.setUnitPricePath(row.record_id),
            payload,
            `${config.label} unit price updated for Room ${row.room_number}.`
          );
          if (!result) return;
          setPricing(null);
          afterChange();
        }}
      />

      <UtilityPaymentModal
        kind={kind}
        row={paying}
        month={selectedMonth}
        pending={paymentAction.pending}
        error={paymentAction.error}
        onClose={() => {
          setPaying(null);
          paymentAction.setError(null);
        }}
        onSubmit={async (target, payload, excess) => {
          const recordId = target.recordId ?? paying?.record_id;
          if (!recordId) return;
          const result = await paymentAction.run<ServicePaymentResponse>(
            config.recordPaymentPath(recordId),
            payload,
            (res) => formatServicePaymentToast(kind, target.roomNumber, res, excess)
          );
          if (!result) return;
          setPaying(null);
          afterChange();
        }}
      />

      <RoomUtilityHistoryModal
        kind={kind}
        open={historyOpen}
        rooms={rooms}
        initialRoomId={historyRoomId}
        onClose={() => setHistoryOpen(false)}
      />

      <PreviousReadingsModal
        kind={kind}
        open={prevReadingsOpen}
        defaultMonth={month}
        onClose={() => setPrevReadingsOpen(false)}
      />

      <BulkUnitPriceModal
        kind={kind}
        open={bulkPriceOpen}
        month={selectedMonth}
        rows={rows}
        buildingBill={buildingBill}
        pending={bulkPriceAction.pending}
        error={bulkPriceAction.error}
        onClose={() => {
          setBulkPriceOpen(false);
          bulkPriceAction.setError(null);
        }}
        onSubmit={async (payload) => {
          const result = await bulkPriceAction.run(
            config.bulkUnitPricesPath,
            payload,
            `Custom ${config.lowerLabel} rates updated for ${formatMonth(selectedMonth)}.`
          );
          if (!result) return;
          setBulkPriceOpen(false);
          afterChange();
        }}
      />

      <ConfirmDialog
        open={Boolean(deleting)}
        title={`Delete ${config.lowerLabel} record?`}
        message={`Room ${deleting?.room_number ?? ''} · ${formatMonth(selectedMonth)} will be removed and won't be added to bills generated after this change.`}
        confirmLabel="Delete record"
        danger
        pending={crud.pending}
        onConfirm={() => deleting && crud.remove(deleting.record_id)}
        onClose={() => setDeleting(null)}
      />
    </div>
  );
}
