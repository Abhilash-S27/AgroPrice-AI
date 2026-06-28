/**
 * AIProbabilityPanel — Phase 5 (Institutional Intelligence Pass).
 *
 * Probabilistic price outlook panel.
 * Institutional empty state: calibration threshold diagnostic with indeterminate bars.
 * Panel controls: Basis toggle (always visible, show/hide analytical basis).
 */
import { useState, useEffect, memo } from 'react'
import { decisionService } from '@services/decisionService'

// ── Probability bar ────────────────────────────────────────────────────────────

const ProbBar = memo(function ProbBar({ label, value, color, sublabel }) {
  const pct = Math.round(value * 100)
  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <p className="text-[10px] font-semibold text-gray-600">{label}</p>
        <p className={`text-[11px] font-black tabular-nums ${color}`}>{pct}%</p>
      </div>
      <div className="h-2 rounded-full bg-gray-100 overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-700 ease-out ${color.replace('text-', 'bg-')}`}
          style={{ width: `${pct}%` }}
        />
      </div>
      {sublabel && <p className="text-[8px] text-gray-400 mt-0.5">{sublabel}</p>}
    </div>
  )
})

// ── Gauge arc (SVG) ────────────────────────────────────────────────────────────

const GaugeArc = memo(function GaugeArc({ value, color }) {
  const pct   = Math.min(1, Math.max(0, value))
  const angle = pct * 180
  const r = 38, cx = 50, cy = 52

  const arcEnd  = { x: cx + r * Math.sin(pct * Math.PI), y: cy - r * Math.cos(pct * Math.PI) }
  const largeArc = pct > 0.5 ? 1 : 0
  const needleX  = cx + r * Math.sin(angle * Math.PI / 180)
  const needleY  = cy - r * Math.cos(angle * Math.PI / 180)

  const colorMap = {
    'text-emerald-500': '#10b981',
    'text-amber-500':   '#f59e0b',
    'text-red-500':     '#ef4444',
    'text-blue-500':    '#3b82f6',
  }
  const hex = colorMap[color] ?? '#94a3b8'

  return (
    <svg viewBox="0 0 100 58" className="w-full max-w-[120px] mx-auto">
      <path d="M 12 52 A 38 38 0 0 1 88 52" fill="none" stroke="#e5e7eb" strokeWidth="6" strokeLinecap="round" />
      {pct > 0.005 && (
        <path
          d={`M 12 52 A 38 38 0 ${largeArc} 1 ${arcEnd.x.toFixed(2)} ${arcEnd.y.toFixed(2)}`}
          fill="none" stroke={hex} strokeWidth="6" strokeLinecap="round"
        />
      )}
      <line x1={cx} y1={cy} x2={needleX.toFixed(2)} y2={needleY.toFixed(2)} stroke={hex} strokeWidth="2" strokeLinecap="round" />
      <circle cx={cx} cy={cy} r="3" fill={hex} />
    </svg>
  )
})

// ── Institutional fallback ─────────────────────────────────────────────────────

const ProbabilityFallback = memo(function ProbabilityFallback({ crop, state, isError, onRetry }) {
  return (
    <div className="space-y-3">
      <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3.5">
        <div className="flex items-start gap-2.5 mb-2.5">
          <span className="text-amber-500 text-sm mt-0.5 shrink-0">⚠</span>
          <div className="flex-1">
            <p className="text-[11px] font-black text-amber-800 uppercase tracking-wide">
              {isError ? 'PROBABILITY ENGINE FAILED' : 'BELOW CALIBRATION THRESHOLD'}
            </p>
            <p className="text-[10px] text-amber-700 mt-0.5 leading-snug">
              {isError
                ? 'The heuristic probability engine encountered an error computing directional estimates.'
                : `Market signals for ${crop ?? 'this crop'} in ${state ?? 'this state'} are insufficient to emit calibrated probability values.`}
            </p>
          </div>
          {isError && onRetry && (
            <button onClick={onRetry} className="shrink-0 text-[9px] font-bold px-2.5 py-1 rounded-full border border-amber-400 text-amber-700 bg-amber-100 hover:bg-amber-200 transition-colors">
              ↻ Retry
            </button>
          )}
        </div>
        <div className="border-t border-amber-200 pt-2.5">
          <p className="text-[9px] font-black uppercase tracking-widest text-amber-700 mb-1">INTERPRETATION</p>
          <p className="text-[10px] text-amber-700 leading-snug">
            Directional ambiguity is itself a market signal — it indicates a transitional phase with no established momentum vector.
          </p>
        </div>
      </div>

      {/* Indeterminate bars — show uncertainty structure */}
      <div className="px-3 py-2.5 rounded-lg bg-gray-50 border border-gray-100 space-y-2.5">
        <p className="text-[8px] font-black uppercase tracking-widest text-gray-400">DIRECTIONAL PROBABILITY</p>
        {[
          { label: 'Upside Continuation',   note: 'indeterminate' },
          { label: 'Downside Continuation', note: 'indeterminate' },
          { label: 'Sideways / Flat',       note: 'indeterminate' },
        ].map(({ label, note }) => (
          <div key={label}>
            <div className="flex items-center justify-between mb-1">
              <p className="text-[10px] font-semibold text-gray-400">{label}</p>
              <p className="text-[9px] text-gray-400 italic">{note}</p>
            </div>
            <div className="h-2 rounded-full bg-gray-200 overflow-hidden">
              <div className="h-full rounded-full bg-gray-300/50" style={{ width: '33%' }} />
            </div>
          </div>
        ))}
      </div>

      <div className="px-4 py-2.5 rounded-xl border border-gray-100 bg-white">
        <p className="text-[9px] font-black uppercase tracking-wide text-gray-400 mb-0.5">SUGGESTED ACTION</p>
        <p className="text-[10px] text-gray-500 leading-snug">
          Select a Tier-A crop (Tomato, Onion, Potato, Banana) with 5+ years of continuous AGMARKNET data to enable calibrated directional probabilities.
        </p>
      </div>
    </div>
  )
})

// ── Outlook config ─────────────────────────────────────────────────────────────

const OUTLOOK_CFG = {
  'bullish':                { text: 'text-emerald-600', bg: 'bg-emerald-50', border: 'border-emerald-200', icon: '↑' },
  'bullish-with-volatility':{ text: 'text-amber-600',   bg: 'bg-amber-50',   border: 'border-amber-200',   icon: '↑⚡' },
  'bearish':                { text: 'text-red-600',      bg: 'bg-red-50',     border: 'border-red-200',     icon: '↓' },
  'bearish-with-volatility':{ text: 'text-red-700',      bg: 'bg-red-50',     border: 'border-red-200',     icon: '↓⚡' },
  'sideways-consolidation': { text: 'text-blue-600',     bg: 'bg-blue-50',    border: 'border-blue-200',    icon: '→' },
  'highly-volatile':        { text: 'text-orange-700',   bg: 'bg-orange-50',  border: 'border-orange-200',  icon: '⚡' },
  'reversal-likely':        { text: 'text-purple-700',   bg: 'bg-purple-50',  border: 'border-purple-200',  icon: '↩' },
  'uncertain':              { text: 'text-gray-500',     bg: 'bg-gray-50',    border: 'border-gray-200',    icon: '?' },
}

// ── Main component ─────────────────────────────────────────────────────────────

export default function AIProbabilityPanel({ crop, state }) {
  const [data,       setData]       = useState(null)
  const [loading,    setLoading]    = useState(false)
  const [error,      setError]      = useState(null)
  const [showBasis,  setShowBasis]  = useState(true)
  const [retryCount, setRetryCount] = useState(0)

  useEffect(() => {
    if (!crop || !state) return
    setLoading(true)
    setError(null)
    decisionService.getProbability(crop, state)
      .then(d => setData(d))
      .catch(() => setError('Probability engine failed'))
      .finally(() => setLoading(false))
  }, [crop, state, retryCount])

  if (!crop || !state) {
    return (
      <div className="text-center py-6 text-gray-400 text-[11px]">
        Select a crop and state for probabilistic outlook.
      </div>
    )
  }

  const showFallback = !loading && (error || !data?.has_data || !data?.probability)

  return (
    <div className="space-y-3">

      {/* ── Controls — always visible when crop+state selected ── */}
      <div className="flex items-center justify-end">
        <button
          onClick={() => setShowBasis(b => !b)}
          disabled={showFallback || loading}
          className={`text-[9px] font-bold px-2.5 py-1 rounded-full border transition-all duration-150 ease-in-out ${
            showFallback || loading
              ? 'border-gray-100 text-gray-300 bg-gray-50 cursor-not-allowed'
              : showBasis
                ? 'bg-gray-900 border-gray-900 text-white shadow-sm'
                : 'bg-gray-50 border-gray-200 text-gray-500 hover:border-gray-400 hover:bg-white hover:shadow-sm'
          }`}
        >
          Basis
        </button>
      </div>

      {/* ── Content area ──────────────────────────────────────── */}
      {loading ? (
        <div className="space-y-3 animate-pulse">
          <div className="h-16 bg-gray-100 rounded-xl" />
          <div className="h-4 bg-gray-100 rounded-xl" />
          <div className="h-4 bg-gray-100 rounded-xl w-5/6" />
          <div className="h-4 bg-gray-100 rounded-xl w-4/6" />
        </div>
      ) : showFallback ? (
        <ProbabilityFallback crop={crop} state={state} isError={!!error} onRetry={() => setRetryCount(c => c + 1)} />
      ) : (
        <ProbabilityData data={data} showBasis={showBasis} />
      )}
    </div>
  )
}

// ── Data content ───────────────────────────────────────────────────────────────

function ProbabilityData({ data, showBasis }) {
  const p     = data.probability
  const up    = p.upside_probability    ?? 0
  const dn    = p.downside_probability  ?? 0
  const side  = p.sideways_probability  ?? 0
  const shock = p.volatility_shock_prob ?? 0
  const rev   = p.reversal_probability  ?? 0
  const ci    = p.confidence_interval_pct ?? 0
  const label = p.risk_adjusted_outlook ?? 'uncertain'
  const oc    = OUTLOOK_CFG[label] ?? OUTLOOK_CFG['uncertain']

  return (
    <div className="space-y-3">
      {/* Outlook label */}
      <div className={`rounded-lg border ${oc.border} ${oc.bg} px-4 py-2.5 transition-all duration-150`}>
        <p className="text-[8px] font-black uppercase tracking-widest text-gray-400 mb-1">RISK-ADJUSTED OUTLOOK</p>
        <div className="flex items-center gap-2">
          <span className={`text-base font-black ${oc.text}`}>{oc.icon}</span>
          <div className="flex-1 min-w-0">
            <p className={`text-[11px] font-black ${oc.text} leading-tight`}>
              {label.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}
            </p>
            {p.outlook_headline && (
              <p className="text-[9px] text-gray-500 mt-0.5 leading-snug">{p.outlook_headline}</p>
            )}
          </div>
        </div>
      </div>

      {/* Directional probabilities */}
      <div className="px-3 py-2.5 rounded-lg bg-gray-50 border border-gray-100 space-y-2.5">
        <p className="text-[8px] font-black uppercase tracking-widest text-gray-400">DIRECTIONAL PROBABILITY</p>
        <ProbBar label="Upside Continuation"   value={up}   color="text-emerald-500" sublabel="Price continues rising" />
        <ProbBar label="Downside Continuation" value={dn}   color="text-red-500"     sublabel="Price continues falling" />
        <ProbBar label="Sideways / Flat"        value={side} color="text-blue-400"    sublabel="Price consolidates" />
      </div>

      {/* Shock & reversal gauges */}
      <div className="grid grid-cols-2 gap-2">
        <div className="px-3 py-2.5 rounded-lg bg-gray-50 border border-gray-100 text-center hover:shadow-sm transition-all duration-150">
          <p className="text-[8px] font-black uppercase tracking-widest text-gray-400 mb-1">SHOCK RISK</p>
          <GaugeArc value={shock} color={shock >= 0.50 ? 'text-red-500' : shock >= 0.30 ? 'text-amber-500' : 'text-emerald-500'} />
          <p className={`text-base font-black tabular-nums ${shock >= 0.50 ? 'text-red-600' : shock >= 0.30 ? 'text-amber-600' : 'text-emerald-600'}`}>
            {Math.round(shock * 100)}%
          </p>
          <p className="text-[8px] text-gray-400 mt-0.5">Volatility spike / crash</p>
        </div>
        <div className="px-3 py-2.5 rounded-lg bg-gray-50 border border-gray-100 text-center hover:shadow-sm transition-all duration-150">
          <p className="text-[8px] font-black uppercase tracking-widest text-gray-400 mb-1">REVERSAL RISK</p>
          <GaugeArc value={rev} color={rev >= 0.50 ? 'text-red-500' : rev >= 0.30 ? 'text-amber-500' : 'text-blue-500'} />
          <p className={`text-base font-black tabular-nums ${rev >= 0.50 ? 'text-red-600' : rev >= 0.30 ? 'text-amber-600' : 'text-blue-600'}`}>
            {Math.round(rev * 100)}%
          </p>
          <p className="text-[8px] text-gray-400 mt-0.5">Trend direction change</p>
        </div>
      </div>

      {/* Confidence interval */}
      <div className="px-3 py-2.5 rounded-lg border border-gray-100 bg-white">
        <div className="flex items-center justify-between mb-2">
          <div>
            <p className="text-[8px] font-black uppercase tracking-widest text-gray-400 mb-0.5">30-DAY PRICE RANGE</p>
            <p className="text-[11px] font-black text-gray-800 tabular-nums">±{ci.toFixed(0)}%</p>
          </div>
          <p className="text-[8px] text-gray-400 text-right">Estimated range<br/>from current price</p>
        </div>
        <div className="h-1.5 rounded-full bg-gradient-to-r from-red-200 via-gray-100 to-emerald-200 relative">
          <div className="absolute inset-y-0 left-1/2 w-px bg-gray-500/40 rounded-full" />
        </div>
        <div className="flex justify-between mt-1">
          <span className="text-[8px] text-red-400 tabular-nums">-{ci.toFixed(0)}%</span>
          <span className="text-[8px] text-gray-400">current</span>
          <span className="text-[8px] text-emerald-500 tabular-nums">+{ci.toFixed(0)}%</span>
        </div>
      </div>

      {/* Probability basis — toggled via control */}
      {showBasis && p.probability_basis?.length > 0 && (
        <div className="px-4 py-3 rounded-xl bg-gray-50 border border-gray-100">
          <p className="text-[9px] font-black uppercase tracking-widest text-gray-400 mb-2">ANALYTICAL BASIS</p>
          <div className="space-y-1">
            {p.probability_basis.map((b, i) => (
              <p key={i} className="text-[10px] text-gray-600 flex items-start gap-1.5">
                <span className="text-gray-300 mt-0.5 shrink-0">·</span>
                {b}
              </p>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
