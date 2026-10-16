import React, { useEffect, useState } from 'react';
import type { BuildingUtilityBill, MonthlyUtilityRow } from '../../types';
import type { ApiError } from '../../utils/api';
import { formatCurrency, formatMonth, toNumber } from '../../utils/format';
import { formatUnits } from '../../utils/utilityUsage';
import { Button } from '../ui/Button';
import { Field, Input } from '../ui/Field';
import { FormModal } from '../ui/FormModal';

interface UnitPriceModalProps {
  row: MonthlyUtilityRow | null;
  month: string;
  buildingBill: BuildingUtilityBill | null;
  pending: boolean;
  error: ApiError | null;
  onClose: () => void;
  onSubmit: (row: MonthlyUtilityRow, payload: Record<string, unknown>) => void;
}

export function UnitPriceModal({ row, month, buildingBill, pending, error, onClose, onSubmit }: UnitPriceModalProps) {
  const [electricity, setElectricity] = useState('');
  const [water, setWater] = useState('');
  const [touched, setTouched] = useState(false);

  useEffect(() => {
    if (!row) return;
    setTouched(false);
    setElectricity(String(toNumber(row.electricity_unit_price)));
    setWater(String(toNumber(row.water_unit_price)));
  }, [row]);

  const electricityCost = toNumber(row?.electricity_units) * toNumber(electricity);
  const waterCost = toNumber(row?.water_units) * toNumber(water);
  const invalid = (value: string) => value === '' || toNumber(value) < 0 ? 'Enter a price of 0 or more.' : undefined;

  const handleSubmit = () => {
    setTouched(true);
    if (!row || invalid(electricity) || invalid(water)) return;
    onSubmit(row, {
      electricity_unit_price: toNumber(electricity).toFixed(2),
      water_unit_price: toNumber(water).toFixed(2)
    });
  };

  return (
    <FormModal
      open={Boolean(row)}
      onClose={onClose}
      onSubmit={handleSubmit}
      title={row ? `Per-unit price · Room ${row.room_number}` : 'Per-unit price'}
      description={`Override this room's rates for ${formatMonth(month)}. Other rooms keep the building rate.`}
      submitLabel="Save prices"
      pending={pending}
      error={error}
      size="sm">
      
      <div className="grid gap-4 sm:grid-cols-2">
        <Field
          label="Electricity / unit"
          htmlFor="up_electricity"
          error={touched ? invalid(electricity) : undefined}
          hint={buildingBill ? `Building rate ${formatCurrency(buildingBill.electricity_unit_price)}` : undefined}>
          
          <Input
            id="up_electricity"
            type="number"
            min="0"
            step="0.01"
            value={electricity}
            onChange={(event) => setElectricity(event.target.value)} />
          
        </Field>
        <Field
          label="Water / unit"
          htmlFor="up_water"
          error={touched ? invalid(water) : undefined}
          hint={buildingBill ? `Building rate ${formatCurrency(buildingBill.water_unit_price)}` : undefined}>
          
          <Input id="up_water" type="number" min="0" step="0.01" value={water} onChange={(event) => setWater(event.target.value)} />
        </Field>
      </div>

      {buildingBill &&
      <Button
        variant="ghost"
        size="sm"
        onClick={() => {
          setElectricity(String(toNumber(buildingBill.electricity_unit_price)));
          setWater(String(toNumber(buildingBill.water_unit_price)));
        }}>
        
          Reset to building rates
        </Button>
      }

      {row &&
      <dl className="rounded-lg border border-line bg-subtle px-3 py-1 text-[13px]">
          <div className="flex items-baseline justify-between gap-3 py-1.5">
            <dt className="text-ink-muted">
              Electricity · {formatUnits(row.electricity_units)} × {formatCurrency(electricity)}
            </dt>
            <dd className="text-ink">{formatCurrency(electricityCost)}</dd>
          </div>
          <div className="flex items-baseline justify-between gap-3 py-1.5">
            <dt className="text-ink-muted">
              Water · {formatUnits(row.water_units)} × {formatCurrency(water)}
            </dt>
            <dd className="text-ink">{formatCurrency(waterCost)}</dd>
          </div>
          <div className="flex items-baseline justify-between gap-3 border-t border-line py-2">
            <dt className="font-medium text-ink">New room bill</dt>
            <dd className="font-semibold text-ink">{formatCurrency(electricityCost + waterCost)}</dd>
          </div>
        </dl>
      }
    </FormModal>);

}