import { useState } from 'react'
import Card from '@components/ui/Card'
import { usePairMatrix } from '@hooks/usePairMatrix'
import { cropShortName } from '@utils/constants'

/**
 * Interactive crop×state AI heatmaps.
 * Metrics come from /api/ai/pair-matrix; every cell carries its own
 * AI reasoning string shown on hover.
 */

// legend = [label shown on the green end, label shown on the red end]
const METRICS = {
  volatility:  { label: 'Volatility',  field: 'cv',          invert: true,
                 legend: ['steady', 'turbulent'], fmt: v => `${v.toFixed(0)}%` },
  confidence:  { label: 'Confidence',  field: 'confidence',  invert: false,
                 legend: ['dependable', 'weak data'], fmt: v => `${v}` },
  momentum:    { label: 'Momentum',    field: 'momentum',    invert: false, signed: true,
                 legend: ['rising', 'falling'], fmt: v => `${v > 0 ? '+' : ''}${v.toFixed(0)}%` },
  opportunity: { label: 'Opportunity', field: 'opportunity', invert: false,
                 legend: ['strong', 'weak'], fmt: v => `${v}` },
  risk:        { label: 'Risk',        field: 'risk',        invert: true,
                 legend: ['safe', 'exposed'], fmt: v => `${v}` },
  seasonal:    { label: 'Continuity',  field: 'continuity',  invert: false,
                 legend: ['continuous', 'sparse'], fmt: v => `${v.toFixed(0)}%` },
}

// green→amber→red ramp (inverted metrics flip it)
function cellColor(value, { invert, signed }) {
  if (value == null) return 'rgba(255,255,255,0.04)'
  let t // 0 = good(green), 1 = bad(red)
  if (signed) t = 1 - Math.max(0, Math.min(1, (value + 30) / 60))
  else {
    t = Math.max(0, Math.min(1, value / 100))
    if (!invert) t = 1 - t
  }
  const stops = [[16, 185, 129], [251, 191, 36], [248, 113, 113]]
  const seg = t < 0.5 ? 0 : 1
  const k = (t - seg * 0.5) * 2
  const [r1, g1, b1] = stops[seg]
  const [r2, g2, b2] = stops[seg + 1]
  const mix = (a, b) => Math.round(a + (b - a) * k)
  return `rgba(${mix(r1, r2)}, ${mix(g1, g2)}, ${mix(b1, b2)}, 0.82)`
}

export default function MarketHeatmap() {
  const { matrix } = usePairMatrix()
  const [metricKey, setMetricKey] = useState('opportunity')
  const metric = METRICS[metricKey]

  if (!matrix) return null

  return (
    <Card className="!p-0 overflow-hidden ai-fade-up">
      <div className="px-5 py-3.5 border-b border-gray-100 flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-primary-600 text-white flex items-center justify-center text-base">▦</div>
          <div>
            <p className="text-sm font-bold text-gray-900 leading-tight">AI Market Heatmap</p>
            <p className="text-[11px] text-gray-400">27 crops × 5 states · hover a cell for AI reasoning</p>
          </div>
        </div>
        <div className="flex gap-1 flex-wrap">
          {Object.entries(METRICS).map(([k, m]) => (
            <button key={k} onClick={() => setMetricKey(k)}
              className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-colors ${
                metricKey === k ? 'bg-primary-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}>
              {m.label}
            </button>
          ))}
        </div>
      </div>

      <div className="p-4 overflow-x-auto">
        {/* min-width keeps cells readable on narrow screens — the container
            scrolls horizontally instead of crushing the grid */}
        <table className="w-full min-w-[520px] border-separate" style={{ borderSpacing: 2 }}>
          <thead>
            <tr>
              <th className="text-left text-[10px] font-bold text-gray-400 uppercase tracking-wide pr-2 pb-1">Crop</th>
              {matrix.states.map(s => (
                <th key={s} className="text-[10px] font-bold text-gray-400 pb-1 min-w-[64px]">
                  {s.replace('Andhra Pradesh', 'AP').replace('Tamil Nadu', 'TN')}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {matrix.crops.map(crop => (
              <tr key={crop}>
                <td className="text-[10px] font-semibold text-gray-600 pr-2 whitespace-nowrap">
                  {cropShortName(crop)}
                </td>
                {matrix.states.map(s => {
                  const cell = matrix.cells?.[crop]?.[s]
                  const v = cell ? cell[metric.field] : null
                  return (
                    <td key={s}
                      title={cell ? `${cropShortName(crop)} · ${s}\n${metric.label}: ${v != null ? metric.fmt(v) : '—'}\n${cell.reason}` : `${cropShortName(crop)} · ${s}: no data`}
                      className="text-center text-[10px] font-bold rounded cursor-default py-1.5 transition-transform hover:scale-105"
                      style={{ background: cellColor(v, metric),
                               color: v == null ? '#d1d5db' : 'rgba(0,0,0,0.65)' }}>
                      {v != null ? metric.fmt(v) : '·'}
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
        <div className="flex items-center gap-2 mt-2 px-1">
          <span className="text-[10px] text-gray-400">{metric.legend[0]}</span>
          <div className="h-1.5 flex-1 max-w-[160px] rounded-full"
               style={{ background: 'linear-gradient(to right, rgba(16,185,129,0.82), rgba(251,191,36,0.82), rgba(248,113,113,0.82))' }} />
          <span className="text-[10px] text-gray-400">{metric.legend[1]}</span>
        </div>
      </div>
    </Card>
  )
}
