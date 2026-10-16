import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { BanknoteIcon, HistoryIcon, ReceiptTextIcon, SlidersHorizontalIcon, Trash2Icon, WalletIcon } from 'lucide-react';
import type { Lease, MonthlyUtilityRow, MonthlyUtilitySummary, Room } from '../types';
import { useAction } from '../hooks/useAction';
import { useCrud } from '../hooks/useCrud';
import { useCollection, useResource } from '../hooks/useResource';
import { BuildingBillModal } from '../components/utilities/BuildingBillModal';
import { BuildingBillSummary } from '../components/utilities/BuildingBillSummary';
import { RoomUtilityHistoryModal } from '../components/utilities/RoomUtilityHistoryModal';
import { UnitPriceModal } from '../components/utilities/UnitPriceModal';
import { UsageCell } from '../components/utilities/UsageCell';
import { UtilityPaymentModal } from '../components/utilities/UtilityPaymentModal';
import { ApiErrorState } from '../components/ui/ApiErrorState';
import { Badge } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import { Card, CardHeader } from '../components/ui/Card';
import { ConfirmDialog } from '../components/ui/ConfirmDialog';
import { type Column, DataTable } from '../components/ui/DataTable';
import { Field, Input } from '../components/ui/Field';
import { PageHeader } from '../components/ui/PageHeader';
import { buildQuery } from '../utils/api';
import { firstOfCurrentMonth, formatCurrency, formatDate, formatMonth, monthInputValue, titleCase, toNumber } from '../utils/format';
import { notifyRemindersChanged } from '../utils/reminders';
import { utilityRemaining } from '../utils/utilityUsage';

export function Utilities() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [month, setMonth] = useState(monthInputValue(firstOfCurrentMonth()));
  const [billOpen, setBillOpen] = useState(false);
  const [pricing, setPricing] = useState<MonthlyUtilityRow | null>(null);
  const [paying, setPaying] = useState<MonthlyUtilityRow | null>(null);
  const [deleting, setDeleting] = useState<MonthlyUtilityRow | null>(null);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [historyRoomId, setHistoryRoomId] = useState<number | null>(null);

  const summaryPath = month ? `/api/utilities/monthly-summary/${buildQuery({ billing_month: month })}` : null;
  const { data: summary, loading, error, reload } = useResource<MonthlyUtilitySummary>(summaryPath);
  const { data: rooms } = useCollection<Room>('/api/rooms/');
  const { data: leases } = useCollection<Lease>('/api/leases/');

  const afterChange = useCallback(() => {
    reload();
    notifyRemindersChanged();
  }, [reload]);

  const billAction = useAction();
  const priceAction = useAction();
  const paymentAction = useAction();
  const creditAction = useAction();
  const [applyingId, setApplyingId] = useState<number | null>(null);

  const applyCredit = async (row: MonthlyUtilityRow) => {
    setApplyingId(row.utility_record_id);
    const result = await creditAction.run(
      `/api/utilities/${row.utility_record_id}/apply-credit/`,
      {},
      `Advance credit applied to Room ${row.room_number}.`
    );
    setApplyingId(null);
    if (result) afterChange();
  };
  const crud = useCrud('utilities', {
    label: 'Utility record',
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
  const rows = useMemo(() => notFound ? [] : summary?.rooms_utility_data ?? [], [summary, notFound]);
  const buildingBill = notFound ? null : summary?.building_utility_bill ?? null;
  const selectedMonth = `${month}-01`;
  const totalRoomsCost = rows.reduce((sum, row) => sum + toNumber(row.total_cost ?? row.total_bill), 0);

  const openHistory = (roomId: number | null) => {
    setHistoryRoomId(roomId);
    setHistoryOpen(true);
  };

  const columns: Column<MonthlyUtilityRow>[] = [
  {
    key: 'room',
    header: 'Room',
    primary: true,
    render: (row) =>
    <div className="min-w-0">
          <p className="font-medium text-ink">
            Room {row.room_number}
            {row.room_type && <span className="ml-1.5 text-[12px] font-normal text-ink-soft">{titleCase(row.room_type)}</span>}
          </p>
          <p className="truncate text-[12px] text-ink-muted">{row.customer_name || 'No tenant'}</p>
        </div>

  },
  {
    key: 'electricity',
    header: 'Electricity',
    render: (row) =>
    <UsageCell
      units={row.electricity_units}
      month={selectedMonth}
      rate={row.electricity_unit_price}
      cost={row.electricity_cost}
      buildingRate={buildingBill?.electricity_unit_price} />


  },
  {
    key: 'water',
    header: 'Water',
    render: (row) =>
    <UsageCell
      units={row.water_units}
      month={selectedMonth}
      rate={row.water_unit_price}
      cost={row.water_cost}
      buildingRate={buildingBill?.water_unit_price} />


  },
  {
    key: 'total',
    header: 'Room bill',
    align: 'right',
    render: (row) => <span className="font-semibold text-ink">{formatCurrency(row.total_cost ?? row.total_bill)}</span>
  },
  {
    key: 'supplier',
    header: 'Paid to supplier',
    render: (row) => {
      const remaining = utilityRemaining(row);
      const paid = toNumber(row.total_utility_paid);
      const credit = toNumber(row.room_credit_balance);
      return (
        <span className="flex flex-col items-start gap-0.5">
            {row.is_paid || remaining <= 0 ?
          <Badge tone="success">Paid</Badge> :
          paid > 0 ?
          <Badge tone="warn">{formatCurrency(remaining)} left</Badge> :

          <Badge tone="danger">Unpaid</Badge>
          }
            {!row.is_paid && remaining > 0 && row.due_date &&
          <span className="text-[11px] text-ink-soft">Due {formatDate(row.due_date)}</span>
          }
            {credit > 0 && <span className="text-[11px] font-medium text-brand-700">{formatCurrency(credit)} credit</span>}
          </span>);

    }
  }];


  return (
    <div className="space-y-5">
      <PageHeader
        title="Utilities"
        description="Enter the month's supplier bill, its stated usage and each room's meters. Tenants pay their room bill to the supplier; mark it paid when they tell you. Overpayments become credit for future months."
        actions={
        <>
            <Button variant="secondary" icon={HistoryIcon} onClick={() => openHistory(null)}>
              Room history
            </Button>
            <Button icon={ReceiptTextIcon} onClick={() => setBillOpen(true)}>
              Enter building bill
            </Button>
          </>
        } />
      

      <div className="flex flex-col gap-4 lg:flex-row lg:items-end">
        <div className="min-w-0 flex-1">
          <BuildingBillSummary
            month={selectedMonth}
            bill={buildingBill}
            roomsRecorded={rows.length}
            totalRoomsCost={totalRoomsCost}
            loading={loading}
            onEnter={() => setBillOpen(true)} />
          
        </div>
        <Field label="Billing month" htmlFor="utilities_month" className="lg:w-48">
          <Input id="utilities_month" type="month" value={month} onChange={(event) => setMonth(event.target.value)} />
        </Field>
      </div>

      <Card>
        <CardHeader
          title={`All rooms · ${formatMonth(selectedMonth)}`}
          description="Usage with average per day, the per-unit price applied, and each room's bill." />
        
        {error && !notFound ?
        <ApiErrorState error={error} onRetry={reload} /> :

        <DataTable
          columns={columns}
          rows={rows}
          keyOf={(row) => row.utility_record_id}
          loading={loading}
          emptyTitle={`No utility data for ${formatMonth(selectedMonth)}`}
          emptyDescription="Enter the building bill with each room's usage to create the room bills."
          emptyAction={
          <Button icon={ReceiptTextIcon} onClick={() => setBillOpen(true)}>
                Enter building bill
              </Button>
          }
          footer={
          rows.length ?
          <span>
                  Room bills total: <span className="font-semibold text-ink">{formatCurrency(totalRoomsCost)}</span>
                </span> :
          undefined
          }
          rowActions={(row) =>
          <>
                <Button variant="secondary" size="sm" icon={SlidersHorizontalIcon} onClick={() => setPricing(row)}>
                  Unit price
                </Button>
                {utilityRemaining(row) > 0 && toNumber(row.room_credit_balance) > 0 &&
            <Button
              variant="subtle"
              size="sm"
              icon={WalletIcon}
              loading={creditAction.pending && applyingId === row.utility_record_id}
              onClick={() => applyCredit(row)}>
              
                    Apply credit
                  </Button>
            }
                <Button variant="secondary" size="sm" icon={BanknoteIcon} onClick={() => setPaying(row)}>
                  {utilityRemaining(row) > 0 ? 'Mark paid' : 'Add payment'}
                </Button>
                <Button variant="ghost" size="sm" icon={HistoryIcon} onClick={() => openHistory(row.room_id)}>
                  History
                </Button>
                <Button
              variant="ghost"
              size="sm"
              icon={Trash2Icon}
              aria-label={`Delete Room ${row.room_number} utility record`}
              className="text-danger-600 hover:bg-danger-50 hover:text-danger-700"
              onClick={() => setDeleting(row)} />
            
              </>
          } />

        }
      </Card>

      <BuildingBillModal
        open={billOpen}
        defaultMonth={month}
        rooms={rooms}
        leases={leases}
        existing={notFound ? null : summary}
        pending={billAction.pending}
        error={billAction.error}
        onClose={() => {
          setBillOpen(false);
          billAction.setError(null);
        }}
        onSubmit={async (payload, billMonth) => {
          const result = await billAction.run('/api/utilities/building-bill/', payload, `Utilities calculated for ${formatMonth(`${billMonth}-01`)}.`);
          if (!result) return;
          setBillOpen(false);
          if (billMonth === month) afterChange();else
          {
            setMonth(billMonth);
            notifyRemindersChanged();
          }
        }} />
      

      <UnitPriceModal
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
            `/api/utilities/${row.utility_record_id}/set-unit-prices/`,
            payload,
            `Unit prices updated for Room ${row.room_number}.`
          );
          if (!result) return;
          setPricing(null);
          afterChange();
        }} />
      

      <UtilityPaymentModal
        row={paying}
        month={selectedMonth}
        pending={paymentAction.pending}
        error={paymentAction.error}
        onClose={() => {
          setPaying(null);
          paymentAction.setError(null);
        }}
        onSubmit={async (row, payload, excess) => {
          const result = await paymentAction.run(
            `/api/utilities/${row.utility_record_id}/record-payment/`,
            payload,
            excess > 0 ?
            `Supplier payment recorded. ${formatCurrency(excess)} kept as advance credit for Room ${row.room_number}.` :
            `Supplier payment recorded for Room ${row.room_number}.`
          );
          if (!result) return;
          setPaying(null);
          afterChange();
        }} />
      

      <RoomUtilityHistoryModal
        open={historyOpen}
        rooms={rooms}
        initialRoomId={historyRoomId}
        onClose={() => setHistoryOpen(false)} />
      

      <ConfirmDialog
        open={Boolean(deleting)}
        title="Delete utility record?"
        message={`Room ${deleting?.room_number ?? ''} · ${formatMonth(selectedMonth)} will be removed and won't be added to bills generated after this change.`}
        confirmLabel="Delete record"
        danger
        pending={crud.pending}
        onConfirm={() => deleting && crud.remove(deleting.utility_record_id)}
        onClose={() => setDeleting(null)} />
      
    </div>);

}