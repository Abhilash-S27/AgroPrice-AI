import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Cell
} from 'recharts'
import { formatPrice } from '@utils/formatters'
import { CROP_COLORS } from '@utils/constants'

export default function CropBarChart({ data = [], dataKey = 'avg_price' }) {
  if (!data.length) return <div className="h-48 flex items-center justify-center text-gray-400 text-sm">No data</div>

  return (
    <ResponsiveContainer width="100%" height={220}>
      <BarChart data={data} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
        <XAxis dataKey="crop" tick={{ fontSize: 11, fill: '#6b7280' }} tickLine={false} />
        <YAxis tickFormatter={formatPrice} tick={{ fontSize: 11, fill: '#6b7280' }} tickLine={false} axisLine={false} width={70} />
        <Tooltip
          formatter={(value) => [formatPrice(value), 'Avg Price']}
          contentStyle={{ borderRadius: 8, border: '1px solid #e5e7eb', fontSize: 12 }}
        />
        <Bar dataKey={dataKey} radius={[4, 4, 0, 0]}>
          {data.map((entry, i) => (
            <Cell key={i} fill={CROP_COLORS[i % CROP_COLORS.length]} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  )
}
