import { memo } from 'react'
import {
  ComposedChart,
  Line,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ReferenceLine,
  ReferenceArea,
  ReferenceDot,
  ResponsiveContainer,
} from 'recharts'
import { formatPrice, formatDateShort, formatDateLong } from '@utils/formatters'

/**
 * Merges historical price rows and forecast points into a single Recharts dataset.
 *
 * Row shape:
 *   Historical:    { date, price, predicted: null, lower: null, upper: null }
 *   Bridge point:  { date, price, predicted: price, lower: null, upper: null }
 *   Forecast:      { date, price: null, predicted, lower, upper }
 *
 * The bridge point (last historical row) carries both `price` and `predicted` at
 * the same value so the two lines connect seamlessly at the transition.
 * `lower`/`upper` are null on the bridge so the confidence band only opens from
 * the first true forecast date.
 */
function buildChartData(history, forecast) {
  if (!forecast?.forecast?.length) return []

  const histRows = (history ?? []).map(d => ({
    date:      d.date,
    price:     d.modal_price,
    predicted: null,
    lower:     null,
    upper:     null,
  }))

  // Bridge: last historical row connects the two lines without widening the band
  if (histRows.length > 0) {
    const last = histRows[histRows.length - 1]
    last.predicted = last.price
  }

  const fcRows = forecast.forecast.map(d => ({
    date:      d.date,
    price:     null,
    predicted: d.predicted_price,
    lower:     d.lower_bound > 0 ? d.lower_bound : 0,
    upper:     d.upper_bound,
  }))

  return [...histRows, ...fcRows]
}

function CustomTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null

  const row    = payload[0]?.payload ?? {}
  const isFc   = row.price === null && row.predicted !== null
  const isHist = row.price !== null

  return (
    <div className="rounded-lg px-3 py-2.5 text-xs min-w-[150px]"
         style={{ background: 'rgba(10,14,28,0.95)', border: '1px solid rgba(255,255,255,0.12)', boxShadow: '0 8px 32px rgba(0,0,0,0.50)' }}>
      <p className="font-semibold mb-1.5" style={{ color: 'rgba(255,255,255,0.90)' }}>{formatDateLong(label)}</p>
      {isHist && !isFc && (
        <p style={{ color: 'rgba(255,255,255,0.65)' }}>
          <span className="inline-block w-2.5 h-2.5 rounded-full bg-gray-400 mr-1.5 align-middle" />
          Price: <strong style={{ color: 'rgba(255,255,255,0.90)' }}>{formatPrice(row.price)}/qtl</strong>
        </p>
      )}
      {isFc && (
        <>
          <p className="text-emerald-600 mb-0.5">
            <span className="inline-block w-2.5 h-2.5 rounded-full bg-emerald-500 mr-1.5 align-middle" />
            Forecast: <strong>{formatPrice(row.predicted)}/qtl</strong>
          </p>
          <p className="text-[11px]" style={{ color: 'rgba(255,255,255,0.45)' }}>
            80% range: {formatPrice(row.lower)} – {formatPrice(row.upper)}/qtl
          </p>
        </>
      )}
      {/* Bridge point: show historical label */}
      {row.price !== null && row.predicted !== null && (
        <p className="text-[11px] mt-0.5" style={{ color: 'rgba(255,255,255,0.40)' }}>Forecast starts here</p>
      )}
    </div>
  )
}

function yAxisFormatter(v) {
  if (v >= 1000) return `₹${(v / 1000).toFixed(1)}k`
  return `₹${v}`
}

/**
 * `annotations` (Phase 5, optional): AI markers placed on real data points.
 *   [{ date: 'YYYY-MM-DD', kind: 'spike'|'crash', label: string }]
 * Dates outside the plotted window are ignored automatically.
 *
 * Memoized (Phase 6): recharts re-renders are the page's most expensive
 * paints — the chart only re-renders when its actual inputs change.
 */
function ForecastChart({ history = [], forecast = null, annotations = [] }) {
  const data              = buildChartData(history, forecast)
  const forecastStartDate = forecast?.forecast?.[0]?.date
  const lastDate          = data.length ? data[data.length - 1].date : null

  // resolve each annotation to an actual plotted point (price at that date)
  const marks = (annotations ?? [])
    .map(a => {
      const row = data.find(d => d.date === a.date && d.price != null)
      return row ? { ...a, y: row.price } : null
    })
    .filter(Boolean)

  if (!data.length) {
    return (
      <div className="h-72 flex items-center justify-center text-gray-400 text-sm">
        No data to display
      </div>
    )
  }

  return (
    <ResponsiveContainer width="100%" height={340}>
      <ComposedChart data={data} margin={{ top: 12, right: 24, left: 4, bottom: 4 }}>
        <defs>
          {/* Green gradient fill for the confidence band */}
          <linearGradient id="confBandFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%"   stopColor="#22c55e" stopOpacity={0.22} />
            <stop offset="100%" stopColor="#22c55e" stopOpacity={0.04} />
          </linearGradient>
        </defs>

        <CartesianGrid
          strokeDasharray="3 3"
          stroke="rgba(255,255,255,0.07)"
          vertical={false}
        />

        <XAxis
          dataKey="date"
          tickFormatter={formatDateShort}
          tick={{ fontSize: 11, fill: '#9ca3af' }}
          tickLine={false}
          axisLine={false}
          minTickGap={48}
        />
        <YAxis
          tickFormatter={yAxisFormatter}
          tick={{ fontSize: 11, fill: '#9ca3af' }}
          tickLine={false}
          axisLine={false}
          width={58}
          domain={['auto', 'auto']}
        />

        <Tooltip content={<CustomTooltip />} cursor={{ stroke: '#d1d5db', strokeWidth: 1 }} />

        <Legend
          iconType="plainline"
          wrapperStyle={{ fontSize: 12, paddingTop: 14 }}
          payload={[
            { value: 'Historical price',    type: 'line',  color: '#9ca3af' },
            { value: 'Forecast (Prophet)',  type: 'line',  color: '#22c55e' },
            { value: '80% confidence band', type: 'rect',  color: '#bbf7d0' },
          ]}
        />

        {/* Future-region shading — the AI projection zone */}
        {forecastStartDate && lastDate && (
          <ReferenceArea
            x1={forecastStartDate}
            x2={lastDate}
            fill="rgba(52,211,153,0.06)"
            fillOpacity={1}
            strokeOpacity={0}
          />
        )}

        {/* Vertical marker at forecast start */}
        {forecastStartDate && (
          <ReferenceLine
            x={forecastStartDate}
            stroke="#d1d5db"
            strokeDasharray="5 3"
            strokeWidth={1.5}
            label={{
              value: '← Forecast starts',
              position: 'insideTopRight',
              fontSize: 10,
              fill: '#9ca3af',
              dy: -4,
            }}
          />
        )}

        {/* AI anomaly annotations on real historical points */}
        {marks.map((m, i) => (
          <ReferenceDot
            key={i}
            x={m.date}
            y={m.y}
            r={5}
            fill={m.kind === 'spike' ? '#f59e0b' : '#8b5cf6'}
            stroke="white"
            strokeWidth={2}
            label={{
              value: m.label,
              position: 'top',
              fontSize: 9,
              fill: m.kind === 'spike' ? '#b45309' : '#6d28d9',
              fontWeight: 700,
            }}
          />
        ))}

        {/* Confidence band — upper fill (green gradient from upper → 0) */}
        <Area
          type="monotone"
          dataKey="upper"
          stroke="none"
          fill="url(#confBandFill)"
          fillOpacity={1}
          legendType="none"
          activeDot={false}
          isAnimationActive={true}
          animationDuration={800}
          connectNulls={false}
        />
        {/* Confidence band — lower fill (dark, masks area below lower bound) */}
        <Area
          type="monotone"
          dataKey="lower"
          stroke="none"
          fill="#04070f"
          fillOpacity={1}
          legendType="none"
          activeDot={false}
          isAnimationActive={false}
          connectNulls={false}
        />

        {/* Historical price line — gray, solid */}
        <Line
          type="monotone"
          dataKey="price"
          stroke="#9ca3af"
          strokeWidth={1.5}
          dot={false}
          activeDot={{ r: 3.5, fill: '#6b7280', strokeWidth: 0 }}
          name="Historical price"
          connectNulls={false}
          isAnimationActive={true}
          animationDuration={600}
        />

        {/* Forecast line — green, dashed */}
        <Line
          type="monotone"
          dataKey="predicted"
          stroke="#22c55e"
          strokeWidth={2.5}
          dot={false}
          activeDot={{ r: 4, fill: '#22c55e', strokeWidth: 0 }}
          strokeDasharray="6 3"
          name="Forecast (Prophet)"
          connectNulls={false}
          isAnimationActive={true}
          animationDuration={800}
        />
      </ComposedChart>
    </ResponsiveContainer>
  )
}

export default memo(ForecastChart)
