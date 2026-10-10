import React from 'react';
import { Bar, BarChart, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { formatCompactCurrency, formatCurrency } from '../../utils/format';

interface ProfitChartProps {
  data: Record<string, number>;
  label?: string;
}

export function ProfitChart({ data, label = 'Profit by room' }: ProfitChartProps) {
  const rows = Object.entries(data).
  map(([room, value]) => ({ room: `Room ${room}`, value: Number(value) })).
  sort((a, b) => b.value - a.value);

  if (!rows.length) return null;

  return (
    <div className="px-4 py-4 sm:px-5">
      <p className="text-[13px] font-medium text-ink-muted">{label}</p>
      <div className="mt-3 h-[280px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={rows} margin={{ top: 4, right: 8, bottom: 4, left: 8 }}>
            <XAxis
              dataKey="room"
              tick={{ fill: '#5a6674', fontSize: 12 }}
              axisLine={{ stroke: '#e4e9ee' }}
              tickLine={false}
              interval={0}
              angle={rows.length > 6 ? -30 : 0}
              textAnchor={rows.length > 6 ? 'end' : 'middle'}
              height={rows.length > 6 ? 56 : 32} />
            
            <YAxis
              tick={{ fill: '#8a95a2', fontSize: 12 }}
              axisLine={false}
              tickLine={false}
              width={72}
              tickFormatter={(value: number) => formatCompactCurrency(value)} />
            
            <Tooltip
              cursor={{ fill: 'rgba(21, 113, 99, 0.06)' }}
              contentStyle={{
                borderRadius: 10,
                border: '1px solid #e4e9ee',
                boxShadow: '0 10px 30px rgba(22,32,43,0.12)',
                fontSize: 13
              }}
              formatter={(value: number) => formatCurrency(value)} />
            
            <Bar dataKey="value" name="Amount" radius={[6, 6, 0, 0]} maxBarSize={56}>
              {rows.map((row) =>
              <Cell key={row.room} fill={row.value >= 0 ? '#22907a' : '#d64545'} />
              )}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>);

}