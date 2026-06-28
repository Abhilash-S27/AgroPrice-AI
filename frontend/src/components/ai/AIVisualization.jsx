/**
 * AIVisualization — Phase 3B mini intelligence components.
 *
 * All components are pure SVG/CSS — no Recharts dependency for inline use.
 * Designed to embed inside AI chat responses without lag.
 *
 * Exports:
 *   MiniSparkline        — 30-day price trend line
 *   VolatilityMeter      — horizontal CV bar
 *   ConfidenceGauge      — semi-circle arc
 *   RiskHeatBar          — gradient risk bar
 *   SeasonalPosition     — cycle position indicator
 *   MomentumArrow        — directional momentum indicator
 *   AIVisualizationStrip — combined row of all relevant visuals
 */

import { memo } from 'react'

// ── MiniSparkline ─────────────────────────────────────────────────────────────

function buildSparkPath(prices, w, h, pad = 6) {
  if (!prices || prices.length < 2) return ''
  const min   = Math.min(...prices)
  const max   = Math.max(...prices)
  const range = max - min || 1
  const xs = prices.map((_, i) => pad + (i / (prices.length - 1)) * (w - pad * 2))
  const ys = prices.map(p  => h - pad - ((p - min) / range) * (h - pad * 2))

  // Smooth cubic bezier — control points at 1/3 intervals
  let d = `M ${xs[0].toFixed(1)},${ys[0].toFixed(1)}`
  for (let i = 1; i < xs.length; i++) {
    const cpx1 = (xs[i - 1] + xs[i]) / 2
    const cpy1 = ys[i - 1]
    const cpx2 = (xs[i - 1] + xs[i]) / 2
    const cpy2 = ys[i]
    d += ` C ${cpx1.toFixed(1)},${cpy1.toFixed(1)} ${cpx2.toFixed(1)},${cpy2.toFixed(1)} ${xs[i].toFixed(1)},${ys[i].toFixed(1)}`
  }
  return d
}

export const MiniSparkline = memo(function MiniSparkline({
  prices = [],
  width  = 120,
  height = 40,
  className = '',
}) {
  if (!prices || prices.length < 2) return null

  const pad    = 6
  const first  = prices[0]
  const last   = prices[prices.length - 1]
  const rising = last >= first
  const color  = rising ? '#10b981' : '#ef4444'
  const min    = Math.min(...prices)
  const max    = Math.max(...prices)
  const range  = max - min || 1

  const xs = prices.map((_, i) => pad + (i / (prices.length - 1)) * (width - pad * 2))
  const ys = prices.map(p  => height - pad - ((p - min) / range) * (height - pad * 2))

  const linePath = buildSparkPath(prices, width, height, pad)

  // Smooth area — same bezier control points, then close at bottom
  let areaD = `M ${xs[0].toFixed(1)},${ys[0].toFixed(1)}`
  for (let i = 1; i < xs.length; i++) {
    const cpx1 = (xs[i - 1] + xs[i]) / 2
    areaD += ` C ${cpx1.toFixed(1)},${ys[i - 1].toFixed(1)} ${cpx1.toFixed(1)},${ys[i].toFixed(1)} ${xs[i].toFixed(1)},${ys[i].toFixed(1)}`
  }
  areaD += ` L ${(width - pad).toFixed(1)},${height} L ${pad},${height} Z`

  const gradId = `spark-fill-${rising ? 'up' : 'dn'}`
  const lx = xs[xs.length - 1]
  const ly = ys[ys.length - 1]

  const pctChange = ((last - first) / (first || 1) * 100)

  return (
    <div className={`flex flex-col gap-0.5 ${className}`}>
      <svg width="100%" height={height} viewBox={`0 0 ${width} ${height}`}
           preserveAspectRatio="none" style={{ overflow: 'visible', display: 'block' }}>
        <defs>
          <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%"   stopColor={color} stopOpacity="0.20" />
            <stop offset="100%" stopColor={color} stopOpacity="0.02" />
          </linearGradient>
        </defs>
        {/* Grid line at 50% */}
        <line
          x1={pad} y1={(height / 2).toFixed(1)}
          x2={width - pad} y2={(height / 2).toFixed(1)}
          stroke="#f3f4f6" strokeWidth="0.8"
        />
        <path d={areaD} fill={`url(#${gradId})`} />
        <path
          d={linePath} fill="none"
          stroke={color} strokeWidth="1.8"
          strokeLinecap="round" strokeLinejoin="round"
        />
        {/* Last price dot with halo */}
        <circle cx={lx.toFixed(1)} cy={ly.toFixed(1)} r="4.5" fill={color} opacity="0.15" />
        <circle cx={lx.toFixed(1)} cy={ly.toFixed(1)} r="2.5" fill={color} />
      </svg>
      <div className="flex justify-between items-center text-[8px] text-gray-400 px-1">
        <span>₹{min.toLocaleString('en-IN')}</span>
        <span className={`font-semibold ${rising ? 'text-emerald-600' : 'text-red-500'}`}>
          {rising ? '▲' : '▼'} {Math.abs(pctChange).toFixed(1)}% · 30d
        </span>
        <span>₹{max.toLocaleString('en-IN')}</span>
      </div>
    </div>
  )
})

// ── VolatilityMeter ───────────────────────────────────────────────────────────

export const VolatilityMeter = memo(function VolatilityMeter({ cv = 0, label, className = '' }) {
  const pct   = Math.min(100, cv)
  const color = cv >= 55 ? '#ef4444' : cv >= 35 ? '#f97316' : cv >= 20 ? '#f59e0b' : '#10b981'
  const lvl   = cv >= 55 ? 'Extreme' : cv >= 35 ? 'High' : cv >= 20 ? 'Moderate' : 'Stable'

  return (
    <div className={`${className}`}>
      <div className="flex justify-between items-center mb-1">
        <span className="text-[9px] font-bold text-gray-400 uppercase tracking-wide">
          {label ?? 'Volatility'}
        </span>
        <span className="text-[9px] font-bold" style={{ color }}>{lvl}</span>
      </div>
      <div className="h-1.5 rounded-full bg-gray-100 overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-500"
          style={{ width: `${pct}%`, backgroundColor: color }}
        />
      </div>
      <p className="text-[8px] text-gray-400 mt-0.5 text-right">CV {cv.toFixed(0)}%</p>
    </div>
  )
})

// ── ConfidenceGauge ───────────────────────────────────────────────────────────

export const ConfidenceGauge = memo(function ConfidenceGauge({ score = 0, label, className = '' }) {
  // Semi-circle: r=28, circumference ≈ 88
  const R = 28
  const C = Math.PI * R
  const pct     = Math.max(0, Math.min(100, score))
  const offset  = C * (1 - pct / 100)
  const color   = pct >= 70 ? '#10b981' : pct >= 50 ? '#f59e0b' : '#ef4444'
  const lvl     = pct >= 70 ? 'Excellent' : pct >= 50 ? 'Good' : pct >= 35 ? 'Moderate' : 'Low'

  return (
    <div className={`flex flex-col items-center ${className}`}>
      <svg viewBox="0 0 70 42" className="w-16">
        <path d={`M 7 38 A ${R} ${R} 0 0 1 63 38`}
              fill="none" stroke="#f3f4f6" strokeWidth="6" strokeLinecap="round" />
        <path d={`M 7 38 A ${R} ${R} 0 0 1 63 38`}
              fill="none" stroke={color} strokeWidth="6" strokeLinecap="round"
              strokeDasharray={C} strokeDashoffset={offset}
              style={{ transition: 'stroke-dashoffset 0.6s ease' }} />
        <text x="35" y="34" textAnchor="middle"
              style={{ font: '700 11px sans-serif', fill: '#111827' }}>
          {pct}
        </text>
      </svg>
      <p className="text-[9px] font-bold text-gray-400 uppercase tracking-wide -mt-1">
        {label ?? 'Confidence'}
      </p>
      <p className="text-[8px] font-semibold mt-0.5" style={{ color }}>{lvl}</p>
    </div>
  )
})

// ── RiskHeatBar ───────────────────────────────────────────────────────────────

export const RiskHeatBar = memo(function RiskHeatBar({ score = 0.5, className = '' }) {
  // score: 0 = no risk, 1 = extreme risk
  const pct = Math.round(score * 100)

  return (
    <div className={className}>
      <div className="flex justify-between items-center mb-1">
        <span className="text-[9px] font-bold text-gray-400 uppercase tracking-wide">Risk</span>
        <span className="text-[9px] font-bold text-gray-600">{pct}%</span>
      </div>
      <div className="h-1.5 rounded-full overflow-hidden"
           style={{ background: 'linear-gradient(to right, #10b981, #f59e0b, #ef4444)' }}>
        <div
          className="h-full w-0.5 bg-white rounded-full shadow-sm transition-all duration-500"
          style={{ marginLeft: `${Math.max(0, pct - 1)}%` }}
        />
      </div>
      <div className="flex justify-between text-[7px] text-gray-400 mt-0.5">
        <span>Low</span><span>High</span>
      </div>
    </div>
  )
})

// ── SeasonalPosition ──────────────────────────────────────────────────────────

export const SeasonalPosition = memo(function SeasonalPosition({
  vsNorm = 0,
  phase = 'normal',
  className = '',
}) {
  // Map vsNorm (-50 to +50) to 0-100 for bar
  const pct   = Math.round(Math.max(0, Math.min(100, 50 + vsNorm)))
  const color = phase === 'peak'   ? '#a855f7' :
                phase === 'trough' ? '#3b82f6' : '#6b7280'
  const label = phase === 'peak' ? 'Peak' : phase === 'trough' ? 'Trough' : 'Normal'

  return (
    <div className={className}>
      <div className="flex justify-between items-center mb-1">
        <span className="text-[9px] font-bold text-gray-400 uppercase tracking-wide">Season</span>
        <span className="text-[9px] font-bold" style={{ color }}>{label}</span>
      </div>
      <div className="relative h-1.5 rounded-full bg-gray-100">
        {/* Center line */}
        <div className="absolute top-0 bottom-0 w-px bg-gray-300" style={{ left: '50%' }} />
        <div
          className="absolute top-0 h-full w-2 -ml-1 rounded-full transition-all duration-500"
          style={{ left: `${pct}%`, backgroundColor: color }}
        />
      </div>
      <div className="flex justify-between text-[7px] text-gray-400 mt-0.5">
        <span>Trough</span>
        <span className="text-gray-500 font-medium">{vsNorm > 0 ? '+' : ''}{vsNorm.toFixed(0)}%</span>
        <span>Peak</span>
      </div>
    </div>
  )
})

// ── MomentumArrow ─────────────────────────────────────────────────────────────

export const MomentumArrow = memo(function MomentumArrow({ score = 0, className = '' }) {
  // score: momentum % (-100 to +100)
  const clamp  = Math.max(-45, Math.min(45, score * 1.5))
  const color  = score >  5 ? '#10b981' :
                 score < -5 ? '#ef4444' : '#9ca3af'
  const label  = score >  10 ? 'Strong Up' :
                 score >   3 ? 'Rising'    :
                 score < -10 ? 'Strong Dn' :
                 score <  -3 ? 'Falling'   : 'Neutral'

  // Arrow rotates: -45deg (down) to 0 (neutral) to +45deg (up)
  return (
    <div className={`flex flex-col items-center ${className}`}>
      <svg viewBox="0 0 40 40" className="w-10 h-10">
        <g transform={`translate(20,22) rotate(${-clamp})`}>
          <line x1="0" y1="12" x2="0" y2="-10" stroke={color} strokeWidth="2.5" strokeLinecap="round" />
          <polygon points="-5,0 5,0 0,-14" fill={color} />
        </g>
        <circle cx="20" cy="22" r="3" fill={color} opacity="0.3" />
      </svg>
      <p className="text-[8px] font-bold text-gray-500 -mt-1">{label}</p>
      <p className="text-[7px] text-gray-400">{score > 0 ? '+' : ''}{score.toFixed(1)}%</p>
    </div>
  )
})

// ── AIVisualizationStrip ──────────────────────────────────────────────────────

/**
 * Combined visualization strip shown inside AI responses.
 *
 * @param {object} agentInsights - The agent_insights dict from the done event
 */
export const AIVisualizationStrip = memo(function AIVisualizationStrip({
  agentInsights = {},
  className = '',
}) {
  const prices  = agentInsights.price_series_30d || []
  const trend   = agentInsights.trend?.details   || {}
  const risk    = agentInsights.risk?.details    || {}
  const seasonal = agentInsights.seasonal?.details || {}
  const rec     = agentInsights.recommendation?.details || {}

  const hasAny = prices.length > 1 || trend.momentum_score != null

  if (!hasAny) return null

  return (
    <div className={`mt-3 pt-3 border-t border-gray-100 ${className}`}>
      <p className="text-[9px] font-bold uppercase tracking-wider text-gray-400 mb-2.5">
        Market Intelligence Visuals
      </p>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {/* Sparkline */}
        {prices.length > 1 && (
          <div className="col-span-2 sm:col-span-2">
            <p className="text-[9px] font-bold text-gray-400 uppercase tracking-wide mb-1">30-Day Price</p>
            <MiniSparkline prices={prices} width={180} height={44} />
          </div>
        )}

        {/* Volatility */}
        {risk.volatility_cv != null && (
          <div>
            <VolatilityMeter cv={risk.volatility_cv} />
          </div>
        )}

        {/* Seasonal position */}
        {seasonal.current_vs_norm != null && (
          <div>
            <SeasonalPosition
              vsNorm={seasonal.current_vs_norm}
              phase={seasonal.current_phase || 'normal'}
            />
          </div>
        )}

        {/* Confidence gauge */}
        {rec.opportunity_score != null && (
          <div className="flex justify-center">
            <ConfidenceGauge
              score={Math.round(rec.opportunity_score * 100)}
              label="Opportunity"
            />
          </div>
        )}

        {/* Risk heat bar */}
        {risk.volatility_cv != null && (
          <div>
            <RiskHeatBar score={Math.min(1, risk.volatility_cv / 80)} />
          </div>
        )}
      </div>
    </div>
  )
})
