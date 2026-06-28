/**
 * Reusable line chart for historical price data.
 * Wraps Recharts LineChart with AgroPrice AI styling.
 */
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Legend
} from 'recharts'
import { formatPrice, formatDateShort } from '@utils/formatters'

export default function PriceLineChart({ data = [], dataKey = 'modal_price', color = '#22c55e' }) {
  if (!data.length) return <div className="h-64 flex items-center justify-center text-gray-400 text-sm">No price data</div>

  return (
    <ResponsiveContainer width="100%" height={280}>
      <LineChart data={data} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
        <XAxis
          dataKey="date"
          tickFormatter={formatDateShort}
          tick={{ fontSize: 11, fill: '#6b7280' }}
          tickLine={false}
        />
        <YAxis
          tickFormatter={formatPrice}
          tick={{ fontSize: 11, fill: '#6b7280' }}
          tickLine={false}
          axisLine={false}
          width={70}
        />
        <Tooltip
          formatter={(value) => [formatPrice(value), 'Price']}
          labelFormatter={formatDateShort}
          contentStyle={{ borderRadius: 8, border: '1px solid #e5e7eb', fontSize: 12 }}
        />
        <Line
          type="monotone"
          dataKey={dataKey}
          stroke={color}
          strokeWidth={2}
          dot={false}
          activeDot={{ r: 4 }}
        />
      </LineChart>
    </ResponsiveContainer>
  )
}
