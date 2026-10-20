import React from 'react';
import { Bar, BarChart, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { useTheme } from '../../contexts/ThemeContext';
import { formatCompactCurrency, formatCurrency } from '../../utils/format';

interface ProfitChartProps {
  data: Record<string, number>;
  label?: string;
}

export function ProfitChart({ data, label = 'Profit by room' }: ProfitChartProps) {
  const { isDark } = useTheme();
  const rows = Object.entries(data)
    .map(([room, value]) => ({ room: `Room ${room}`, value: Number(value) }))
    .sort((a, b) => b.value - a.value);

  if (!rows.length) return null;

  const tickColor = isDark ? '#94a3b8' : '#5a6674';
  const axisLineColor = isDark ? '#243040' : '#e4e9ee';
  const tooltipBg = isDark ? '#141b24' : '#ffffff';
  const tooltipBorder = isDark ? '#243040' : '#e4e9ee';
  const tooltipColor = isDark ? '#f1f5f9' : '#16202b';
  const positiveBar = isDark ? '#33a68d' : '#22907a';
  const negativeBar = isDark ? '#ef4444' : '#d64545';
  const cursorFill = isDark ? 'rgba(51, 166, 141, 0.12)' : 'rgba(21, 113, 99, 0.06)';

  return (
    <div className="px-4 py-4 sm:px-5">
      <p className="text-[13px] font-medium text-ink-muted">{label}</p>
      <div className="mt-3 h-[280px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={rows} margin={{ top: 4, right: 8, bottom: 4, left: 8 }}>
            <XAxis
              dataKey="room"
              tick={{ fill: tickColor, fontSize: 12 }}
              axisLine={{ stroke: axisLineColor }}
              tickLine={false}
              interval={0}
              angle={rows.length > 6 ? -30 : 0}
              textAnchor={rows.length > 6 ? 'end' : 'middle'}
              height={rows.length > 6 ? 56 : 32}
            />
            <YAxis
              tick={{ fill: isDark ? '#64748b' : '#8a95a2', fontSize: 12 }}
              axisLine={false}
              tickLine={false}
              width={72}
              tickFormatter={(value: number) => formatCompactCurrency(value)}
            />
            <Tooltip
              cursor={{ fill: cursorFill }}
              contentStyle={{
                backgroundColor: tooltipBg,
                borderRadius: 10,
                border: `1px solid ${tooltipBorder}`,
                boxShadow: isDark
                  ? '0 10px 30px rgba(0, 0, 0, 0.6)'
                  : '0 10px 30px rgba(22, 32, 43, 0.12)',
                fontSize: 13,
                color: tooltipColor
              }}
              formatter={(value: number) => formatCurrency(value)}
            />
            <Bar dataKey="value" name="Amount" radius={[6, 6, 0, 0]} maxBarSize={56}>
              {rows.map((row) => (
                <Cell key={row.room} fill={row.value >= 0 ? positiveBar : negativeBar} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}