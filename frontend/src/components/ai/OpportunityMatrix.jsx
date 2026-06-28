import { useMemo } from 'react'
import {
  ScatterChart, Scatter, XAxis, YAxis, ZAxis, Tooltip,
  ReferenceLine, ResponsiveContainer, Cell, Label,
} from 'recharts'
import Card from '@components/ui/Card'
import { usePairMatrix } from '@hooks/usePairMatrix'
import { useForecastCoverage } from '@hooks/useForecastCoverage'
import { cropShortName } from '@utils/constants'

/**
 * Market Opportunity Matrix — the signature visual.
 * X = Risk score, Y = Opportunity score (both computed server-side in the
 * pair matrix from volatility, momentum and continuity). Each point is a
 * crop at its home market; clicking selects it on the page.
 *
 * Quadrants: Safe Growth · High Risk High Reward · Stable Defensive · Weak Momentum
 */

const QUADRANT_TONES = {
  safe_growth:  '#10b981',
  high_high:    '#f59e0b',
  defensive:    '#3b82f6',
  weak:         '#9ca3af',
}

function quadrant(risk, opp) {
  if (opp >= 50 && risk < 50) return 'safe_growth'
  if (opp >= 50 && risk >= 50) return 'high_high'
  if (opp < 50 && risk < 50) return 'defensive'
  return 'weak'
}
const QUADRANT_LABELS = {
  safe_growth: 'Safe Growth', high_high: 'High Risk · High Reward',
  defensive: 'Stable Defensive', weak: 'Weak Momentum',
}

export default function OpportunityMatrix({ onSelectCrop }) {
  const { matrix } = usePairMatrix()
  const { forCrop } = useForecastCoverage()

  const points = useMemo(() => {
    if (!matrix) return []
    return matrix.crops.map(crop => {
      const home = forCrop(crop)?.state
      const cell = home ? matrix.cells?.[crop]?.[home] : null
      if (!cell) return null
      return {
        crop, state: home, x: cell.risk, y: cell.opportunity,
        z: Math.max(60, cell.continuity), reason: cell.reason,
        q: quadrant(cell.risk, cell.opportunity),
      }
    }).filter(Boolean)
  }, [matrix, forCrop])

  if (!points.length) return null

  return (
    <Card className="!p-0 overflow-hidden ai-fade-up">
      <div className="px-5 py-3.5 border-b border-gray-100 flex items-center gap-2.5">
        <div className="w-8 h-8 rounded-xl bg-primary-600 text-white flex items-center justify-center text-base">◬</div>
        <div>
          <p className="text-sm font-bold text-gray-900 leading-tight">Market Opportunity Matrix</p>
          <p className="text-[11px] text-gray-400">
            risk vs opportunity · every crop at its home market · click a point to open it
          </p>
        </div>
      </div>
      <div className="p-4">
        <ResponsiveContainer width="100%" height={340}>
          <ScatterChart margin={{ top: 18, right: 24, bottom: 14, left: 0 }}>
            <XAxis type="number" dataKey="x" domain={[0, 100]} tickCount={6}
                   tick={{ fontSize: 10, fill: '#9ca3af' }} stroke="#e5e7eb">
              <Label value="Risk →" position="insideBottomRight" offset={-6}
                     style={{ fontSize: 10, fill: '#9ca3af', fontWeight: 700 }} />
            </XAxis>
            <YAxis type="number" dataKey="y" domain={[0, 100]} tickCount={6}
                   tick={{ fontSize: 10, fill: '#9ca3af' }} stroke="#e5e7eb">
              <Label value="Opportunity →" angle={-90} position="insideLeft"
                     style={{ fontSize: 10, fill: '#9ca3af', fontWeight: 700 }} />
            </YAxis>
            <ZAxis type="number" dataKey="z" range={[70, 220]} />
            <ReferenceLine x={50} stroke="#e5e7eb" strokeDasharray="4 4" />
            <ReferenceLine y={50} stroke="#e5e7eb" strokeDasharray="4 4" />
            <Tooltip
              cursor={{ strokeDasharray: '3 3' }}
              content={({ payload }) => {
                const p = payload?.[0]?.payload
                if (!p) return null
                return (
                  <div className="bg-white border border-gray-200 rounded-xl shadow-lg p-3 max-w-[220px]">
                    <p className="text-xs font-bold text-gray-900">{cropShortName(p.crop)} · {p.state}</p>
                    <p className="text-[10px] font-semibold mt-0.5"
                       style={{ color: QUADRANT_TONES[p.q] }}>
                      {QUADRANT_LABELS[p.q]}
                    </p>
                    <p className="text-[10px] text-gray-500 mt-1">
                      risk {p.x} · opportunity {p.y}
                    </p>
                    <p className="text-[10px] text-gray-400 mt-0.5">{p.reason}</p>
                  </div>
                )
              }}
            />
            <Scatter data={points} onClick={(p) => onSelectCrop?.(p.crop)} cursor="pointer">
              {points.map(p => (
                <Cell key={p.crop} fill={QUADRANT_TONES[p.q]} fillOpacity={0.75}
                      stroke="white" strokeWidth={1.5} />
              ))}
            </Scatter>
          </ScatterChart>
        </ResponsiveContainer>
        <div className="flex flex-wrap gap-3 px-2 -mt-1">
          {Object.entries(QUADRANT_LABELS).map(([k, label]) => (
            <span key={k} className="inline-flex items-center gap-1.5 text-[10px] text-gray-500">
              <span className="w-2 h-2 rounded-full" style={{ background: QUADRANT_TONES[k] }} />
              {label}
            </span>
          ))}
        </div>
      </div>
    </Card>
  )
}
