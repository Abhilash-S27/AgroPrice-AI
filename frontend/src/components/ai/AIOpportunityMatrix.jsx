/**
 * AIOpportunityMatrix — Phase 5.
 *
 * Multi-crop 7-dimensional opportunity scoring matrix.
 * Shows: opportunity, stability, risk, confidence, timing, seasonal, quality scores.
 *
 * Data source: /api/decision/opportunities?max_crops=12
 */
import { useState, useEffect, memo } from 'react'
import { decisionService } from '@services/decisionService'

// ── Dimension bar ─────────────────────────────────────────────────────────────

const DimBar = memo(function DimBar({ value, color }) {
  const pct = Math.round((value ?? 0) * 100)
  return (
    <div className="flex items-center gap-1.5">
      <div className="flex-1 h-1.5 rounded-full bg-gray-100 overflow-hidden">
        <div className={`h-full rounded-full ${color} transition-all duration-500 ease-out`} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-[8px] text-gray-400 w-5 text-right tabular-nums">{pct}</span>
    </div>
  )
})

// ── Single entry row ──────────────────────────────────────────────────────────

const MatrixRow = memo(function MatrixRow({ entry, rank, expanded, onToggle }) {
  const overall = Math.round((entry.overall_rank ?? 0) * 100)
  const opp     = Math.round((entry.opportunity_score ?? 0) * 100)
  const risk    = Math.round((entry.risk_score ?? 0) * 100)

  const color      = overall >= 65 ? 'text-emerald-600' : overall >= 40 ? 'text-amber-600' : 'text-red-600'
  const ring       = overall >= 65 ? 'border-emerald-200 bg-emerald-50' : overall >= 40 ? 'border-amber-100 bg-amber-50/40' : 'border-red-100 bg-red-50/30'
  const rankLabel  = overall >= 65 ? 'STRONG' : overall >= 40 ? 'FAIR' : 'WEAK'
  const rankBadge  = overall >= 65 ? 'bg-emerald-100 text-emerald-700 border-emerald-200' : overall >= 40 ? 'bg-amber-100 text-amber-700 border-amber-200' : 'bg-red-100 text-red-700 border-red-200'

  return (
    <div className={`rounded-xl border ${ring} overflow-hidden`}>
      <button
        className="w-full text-left px-3.5 py-2.5 flex items-center gap-2.5"
        onClick={onToggle}
      >
        <span className="text-[9px] text-gray-300 w-4 shrink-0">#{rank}</span>
        <div className="flex-1 min-w-0">
          <p className="text-[11px] font-bold text-gray-800">{entry.crop}</p>
          <p className="text-[9px] text-gray-400">{entry.state}</p>
        </div>
        <div className="w-20 shrink-0">
          <DimBar value={entry.opportunity_score} color="bg-emerald-500" />
          <p className="text-[8px] text-gray-400 mt-0.5">opp</p>
        </div>
        <div className="text-right shrink-0">
          <p className={`text-lg font-black ${color} tabular-nums`}>{overall}</p>
          <span className={`text-[7px] font-black uppercase px-1.5 py-0.5 rounded border ${rankBadge}`}>{rankLabel}</span>
        </div>
        <span className="text-[9px] text-gray-400">{expanded ? '▴' : '▾'}</span>
      </button>

      {expanded && (
        <div className="px-4 pb-3 border-t border-gray-100 space-y-2 pt-2.5">
          {/* 7 dimensions */}
          {[
            { key: 'opportunity_score',  label: 'Opportunity',   color: 'bg-emerald-500' },
            { key: 'stability_score',    label: 'Stability',     color: 'bg-blue-400' },
            { key: 'confidence_score',   label: 'Confidence',    color: 'bg-teal-400' },
            { key: 'timing_score',       label: 'Timing',        color: 'bg-purple-400' },
            { key: 'seasonal_score',     label: 'Seasonal',      color: 'bg-violet-400' },
            { key: 'market_quality',     label: 'Market Quality',color: 'bg-indigo-400' },
            { key: 'risk_score',         label: 'Risk (lower=safer)', color: 'bg-red-400' },
          ].map(d => (
            <div key={d.key}>
              <div className="flex items-center justify-between mb-0.5">
                <span className="text-[9px] text-gray-400">{d.label}</span>
              </div>
              <DimBar value={entry[d.key]} color={d.color} />
            </div>
          ))}
          {/* Additional context rows */}
          {entry.recommendation && (
            <p className="text-[9px] text-gray-500 pt-1 border-t border-gray-50">
              Recommendation: {entry.recommendation}
            </p>
          )}
        </div>
      )}
    </div>
  )
})

// ── Institutional fallback ─────────────────────────────────────────────────────

const DIMS = ['Opportunity', 'Stability', 'Confidence', 'Timing', 'Seasonal', 'Market Quality', 'Risk']

const MatrixFallback = memo(function MatrixFallback({ isError, onRetry }) {
  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3.5">
        <div className="flex items-start gap-2.5">
          <span className="text-amber-500 text-sm mt-0.5 shrink-0">⚠</span>
          <div className="flex-1">
            <p className="text-[11px] font-black text-amber-800 uppercase tracking-wide">
              {isError ? 'OPPORTUNITY MATRIX FAILED' : 'SCORING THRESHOLD NOT MET'}
            </p>
            <p className="text-[10px] text-amber-700 mt-1 leading-snug">
              {isError
                ? 'The 7-dimensional scoring engine could not retrieve cross-crop opportunity data.'
                : 'Insufficient crops in the dataset meet the minimum scoring threshold for cross-crop matrix ranking.'}
            </p>
          </div>
          {isError && onRetry && (
            <button
              onClick={onRetry}
              className="shrink-0 text-[9px] font-bold px-2.5 py-1 rounded-full border border-amber-400 text-amber-700 bg-amber-100 hover:bg-amber-200 transition-colors"
            >
              ↻ Retry
            </button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-3 gap-2">
        {[['0', 'Crops Scored'], ['—', 'Top Pick'], ['—', 'Highest Risk']].map(([val, label]) => (
          <div key={label} className="text-center px-3 py-2 rounded-xl bg-gray-50 border border-gray-100">
            <p className="text-lg font-black text-gray-300">{val}</p>
            <p className="text-[9px] text-gray-400">{label}</p>
          </div>
        ))}
      </div>

      <div className="px-4 py-3 rounded-xl bg-gray-50 border border-gray-100">
        <p className="text-[9px] font-black uppercase tracking-widest text-gray-400 mb-2">SCORING DIMENSIONS (UNAVAILABLE)</p>
        <div className="space-y-1.5">
          {DIMS.map(d => (
            <div key={d} className="flex items-center gap-2">
              <p className="text-[9px] text-gray-400 w-28 shrink-0">{d}</p>
              <div className="flex-1 h-1.5 rounded-full bg-gray-200" />
              <span className="text-[8px] text-gray-300 w-5 text-right">—</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
})

// ── Category tabs ─────────────────────────────────────────────────────────────

const VIEWS = [
  { key: 'top_opportunities',  label: 'Opportunities', color: 'text-emerald-600' },
  { key: 'best_stability',     label: 'Stability',     color: 'text-blue-600' },
  { key: 'highest_momentum',   label: 'Momentum',      color: 'text-purple-600' },
  { key: 'best_seasonal',      label: 'Seasonal',      color: 'text-violet-600' },
  { key: 'most_dangerous',     label: 'Risky',         color: 'text-red-600' },
]

// ── Main component ─────────────────────────────────────────────────────────────

export default function AIOpportunityMatrix({ maxCrops = 12 }) {
  const [data,       setData]       = useState(null)
  const [loading,    setLoading]    = useState(false)
  const [error,      setError]      = useState(null)
  const [view,       setView]       = useState('top_opportunities')
  const [expanded,   setExpanded]   = useState(null)
  const [retryCount, setRetryCount] = useState(0)
  const [entryShow,  setEntryShow]  = useState(true)

  const handleViewChange = (key) => {
    if (key === view) return
    setEntryShow(false)
    setTimeout(() => {
      setView(key)
      setExpanded(null)
      requestAnimationFrame(() => setEntryShow(true))
    }, 100)
  }

  useEffect(() => {
    setLoading(true)
    setError(null)
    decisionService.getOpportunities(maxCrops)
      .then(d => setData(d))
      .catch(() => setError('Opportunity matrix unavailable'))
      .finally(() => setLoading(false))
  }, [maxCrops, retryCount])

  if (loading) {
    return (
      <div className="space-y-2 animate-pulse">
        <div className="flex gap-1.5 mb-3">
          {[1,2,3,4,5].map(i => <div key={i} className="h-6 w-20 bg-gray-100 rounded-full" />)}
        </div>
        {[1,2,3,4,5].map(i => <div key={i} className="h-12 bg-gray-50 rounded-xl" />)}
      </div>
    )
  }

  if (error || !data?.matrix) {
    return <MatrixFallback isError={!!error} onRetry={() => setRetryCount(c => c + 1)} />
  }

  const m       = data.matrix
  const entries = m[view] ?? []
  const viewCfg = VIEWS.find(v => v.key === view)

  return (
    <div className="space-y-4">
      {/* Summary stats */}
      <div className="grid grid-cols-3 gap-2">
        <div className="text-center px-3 py-2 rounded-xl bg-gray-50 border border-gray-100">
          <p className="text-lg font-black text-gray-800">{data.crops_scored}</p>
          <p className="text-[9px] text-gray-400">Crops Scored</p>
        </div>
        <div className="text-center px-3 py-2 rounded-xl bg-emerald-50 border border-emerald-200">
          <p className="text-lg font-black text-emerald-700">
            {m.top_opportunities?.[0]?.crop ?? '—'}
          </p>
          <p className="text-[9px] text-emerald-500">Top Pick</p>
        </div>
        <div className="text-center px-3 py-2 rounded-xl bg-red-50 border border-red-200">
          <p className="text-lg font-black text-red-700">
            {m.most_dangerous?.[0]?.crop ?? '—'}
          </p>
          <p className="text-[9px] text-red-400">Highest Risk</p>
        </div>
      </div>

      {/* View tabs */}
      <div className="flex items-center gap-1.5 flex-wrap">
        {VIEWS.map(v => (
          <button
            key={v.key}
            onClick={() => handleViewChange(v.key)}
            className={`text-[9px] font-bold px-2.5 py-1 rounded-full border transition-colors ${
              view === v.key
                ? `bg-gray-900 border-gray-900 text-white`
                : `bg-gray-50 border-gray-200 ${v.color} hover:border-gray-400`
            }`}
          >
            {v.label}
          </button>
        ))}
      </div>

      {/* Entry list */}
      {entries.length === 0 ? (
        <p className="text-[11px] text-gray-400 text-center py-4">No entries in this category.</p>
      ) : (
        <div className="space-y-1.5" style={{ opacity: entryShow ? 1 : 0, transition: 'opacity 120ms ease-out' }}>
          {entries.map((entry, i) => (
            <MatrixRow
              key={`${entry.crop}-${entry.state}`}
              entry={entry}
              rank={i + 1}
              expanded={expanded === i}
              onToggle={() => setExpanded(expanded === i ? null : i)}
            />
          ))}
        </div>
      )}

      {data.generated_at && (
        <p className="text-[9px] text-gray-300 text-right">
          {new Date(data.generated_at).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
        </p>
      )}
    </div>
  )
}
