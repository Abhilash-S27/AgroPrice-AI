/**
 * AIRelationshipMap — Phase 5.
 *
 * Visualizes cross-market crop relationships as an influence grid.
 * Shows relationship strength, type, direction, and contagion risk.
 *
 * Uses a relationship strength grid instead of a force graph
 * (no extra dependencies, purely CSS/SVG).
 */
import { useState, useEffect, memo } from 'react'
import { decisionService } from '@services/decisionService'

// ── Relationship type config ───────────────────────────────────────────────────

const REL_CFG = {
  complement: { color: 'bg-emerald-500', border: 'border-emerald-200', bg: 'bg-emerald-50', text: 'text-emerald-700', icon: '↔' },
  substitute: { color: 'bg-amber-400',   border: 'border-amber-200',   bg: 'bg-amber-50',   text: 'text-amber-700',   icon: '⇄' },
  seasonal:   { color: 'bg-purple-400',  border: 'border-purple-200',  bg: 'bg-purple-50',  text: 'text-purple-700',  icon: '🌊' },
  regional:   { color: 'bg-blue-400',    border: 'border-blue-200',    bg: 'bg-blue-50',    text: 'text-blue-700',    icon: '🗺' },
  storage:    { color: 'bg-teal-400',    border: 'border-teal-200',    bg: 'bg-teal-50',    text: 'text-teal-700',    icon: '🏪' },
  premium:    { color: 'bg-violet-400',  border: 'border-violet-200',  bg: 'bg-violet-50',  text: 'text-violet-700',  icon: '⭐' },
  spice:      { color: 'bg-orange-400',  border: 'border-orange-200',  bg: 'bg-orange-50',  text: 'text-orange-700',  icon: '🌶' },
}
const getFallback = () => ({ color: 'bg-gray-400', border: 'border-gray-200', bg: 'bg-gray-50', text: 'text-gray-600', icon: '↔' })
const getRel = (type) => REL_CFG[type] ?? getFallback()

const CONTAGION_CFG = {
  low:    { dot: 'bg-emerald-500', text: 'text-emerald-600', label: 'Low Contagion Risk' },
  medium: { dot: 'bg-amber-500',   text: 'text-amber-600',   label: 'Medium Contagion Risk' },
  high:   { dot: 'bg-red-500',     text: 'text-red-600',     label: 'High Contagion Risk' },
}

// ── Strength bar ──────────────────────────────────────────────────────────────

const StrengthBar = memo(function StrengthBar({ value, colorClass }) {
  const pct = Math.round(value * 100)
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1.5 rounded-full bg-gray-100 overflow-hidden">
        <div className={`h-full rounded-full ${colorClass}`} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-[9px] text-gray-400 shrink-0 w-7 text-right">{pct}%</span>
    </div>
  )
})

// ── Institutional fallback ─────────────────────────────────────────────────────

const RelationshipFallback = memo(function RelationshipFallback({ crop, isError }) {
  return (
    <div className="space-y-3">
      <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3.5">
        <div className="flex items-start gap-2.5 mb-2.5">
          <span className="text-amber-500 text-sm mt-0.5 shrink-0">⚠</span>
          <div>
            <p className="text-[11px] font-black text-amber-800 uppercase tracking-wide">
              {isError ? 'RELATIONSHIP ENGINE FAILED' : 'DIRECT MARKET RELATIONSHIPS SPARSE'}
            </p>
            <p className="text-[10px] text-amber-700 mt-0.5 leading-snug">
              {isError
                ? `Cross-market relationship data for ${crop ?? 'this crop'} could not be retrieved.`
                : `${crop ?? 'This crop'} has limited documented cross-market coupling in the South Indian relationship graph.`}
            </p>
          </div>
        </div>
        <div className="border-t border-amber-200 pt-2.5">
          <p className="text-[9px] font-black uppercase tracking-widest text-amber-700 mb-1">INTERPRETATION</p>
          <p className="text-[10px] text-amber-700 leading-snug">
            Sparse direct relationships do not indicate market isolation — price movements are more internally driven by local supply-demand dynamics than cross-crop correlation.
          </p>
        </div>
      </div>

      <div className="px-4 py-3 rounded-xl bg-gray-50 border border-gray-100">
        <p className="text-[9px] font-black uppercase tracking-widest text-gray-400 mb-2">GENERAL MARKET PRINCIPLES</p>
        <div className="space-y-1.5">
          {[
            'Regional transportation costs affect all South Indian crops simultaneously',
            'Monsoon and seasonal cycles create broad commodity correlation',
            'Cold storage availability influences price timing across comparable crops',
            'APMC mandi activity drives short-term price convergence across proximate markets',
          ].map((item, i) => (
            <p key={i} className="text-[10px] text-gray-600 flex items-start gap-1.5">
              <span className="text-gray-300 mt-0.5 shrink-0">·</span>
              {item}
            </p>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div className="px-3 py-2.5 rounded-xl bg-gray-50 border border-gray-100">
          <p className="text-[9px] font-black text-gray-400 uppercase tracking-wide mb-1">Substitutes</p>
          <p className="text-[10px] text-gray-400 italic">Not documented</p>
        </div>
        <div className="px-3 py-2.5 rounded-xl bg-gray-50 border border-gray-100">
          <p className="text-[9px] font-black text-gray-400 uppercase tracking-wide mb-1">Complements</p>
          <p className="text-[10px] text-gray-400 italic">Not documented</p>
        </div>
      </div>
    </div>
  )
})

// ── Main component ─────────────────────────────────────────────────────────────

export default function AIRelationshipMap({ crop }) {
  const [data,    setData]    = useState(null)
  const [loading, setLoading] = useState(false)
  const [error,   setError]   = useState(null)
  const [filter,  setFilter]  = useState('all')

  useEffect(() => {
    if (!crop) return
    setLoading(true)
    setError(null)
    decisionService.getRelationships(crop)
      .then(d => setData(d))
      .catch(() => setError('Relationship data unavailable'))
      .finally(() => setLoading(false))
  }, [crop])

  if (!crop) {
    return (
      <div className="text-center py-6 text-gray-400 text-[11px]">
        Select a crop to view cross-market relationships.
      </div>
    )
  }

  if (loading) {
    return (
      <div className="space-y-2 animate-pulse">
        {[1,2,3,4,5].map(i => <div key={i} className="h-12 bg-gray-100 rounded-xl" />)}
      </div>
    )
  }

  if (error || !data?.has_relationships) {
    return <RelationshipFallback crop={crop} isError={!!error} />
  }

  const influences = data.influences ?? []
  const relTypes   = [...new Set(influences.map(i => i.type))]
  const filtered   = filter === 'all' ? influences : influences.filter(i => i.type === filter)
  const contagion  = CONTAGION_CFG[data.contagion_risk ?? 'low']

  return (
    <div className="space-y-3">
      {/* Header stats */}
      <div className="grid grid-cols-3 gap-2">
        <div className="text-center px-2 py-1.5 rounded-lg bg-gray-50 border border-gray-100 transition-all duration-150 hover:shadow-sm hover:bg-white">
          <p className="text-base font-black text-gray-800 tabular-nums">{data.total_relationships}</p>
          <p className="text-[8px] text-gray-400 uppercase tracking-widest">Relationships</p>
        </div>
        <div className="text-center px-2 py-1.5 rounded-lg bg-gray-50 border border-gray-100 transition-all duration-150 hover:shadow-sm hover:bg-white">
          <p className="text-base font-black text-gray-800 tabular-nums">{Math.round((data.coupling_score ?? 0) * 100)}%</p>
          <p className="text-[8px] text-gray-400 uppercase tracking-widest">Coupling</p>
        </div>
        <div className={`text-center px-2 py-1.5 rounded-lg border ${
          data.contagion_risk === 'high' ? 'bg-red-50 border-red-200' :
          data.contagion_risk === 'medium' ? 'bg-amber-50 border-amber-200' :
          'bg-emerald-50 border-emerald-200'
        }`}>
          <div className={`w-2 h-2 rounded-full mx-auto mb-0.5 ${contagion.dot}`} />
          <p className={`text-[8px] font-bold uppercase ${contagion.text}`}>
            {data.contagion_risk} risk
          </p>
          <p className="text-[7px] text-gray-400">contagion</p>
        </div>
      </div>

      {/* Type filter pills */}
      <div className="flex items-center gap-1.5 flex-wrap">
        <button
          onClick={() => setFilter('all')}
          className={`text-[9px] font-bold px-2.5 py-1 rounded-full border transition-colors ${
            filter === 'all'
              ? 'bg-gray-900 border-gray-900 text-white'
              : 'bg-gray-50 border-gray-200 text-gray-500 hover:border-gray-400'
          }`}
        >
          All
        </button>
        {relTypes.map(t => {
          const cfg = getRel(t)
          return (
            <button
              key={t}
              onClick={() => setFilter(filter === t ? 'all' : t)}
              className={`text-[9px] font-bold px-2.5 py-1 rounded-full border transition-colors ${
                filter === t
                  ? `${cfg.bg} ${cfg.border} ${cfg.text}`
                  : 'bg-gray-50 border-gray-200 text-gray-500 hover:border-gray-400'
              }`}
            >
              {cfg.icon} {t}
            </button>
          )
        })}
      </div>

      {/* Relationship cards */}
      <div className="space-y-1.5">
        {filtered.map((inf, i) => {
          const cfg = getRel(inf.type)
          return (
            <div key={i} className={`rounded-lg border ${cfg.border} ${cfg.bg} px-3 py-2 transition-all duration-150 hover:shadow-sm`}>
              <div className="flex items-center gap-2.5">
                <span className={`text-sm shrink-0 ${cfg.text}`}>{cfg.icon}</span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2 mb-0.5">
                    <p className={`text-[10px] font-bold ${cfg.text}`}>{inf.crop}</p>
                    <span className={`text-[8px] font-bold px-1.5 py-0.5 rounded-full border ${cfg.border} ${cfg.text} ${cfg.bg} opacity-80`}>
                      {inf.type}
                    </span>
                  </div>
                  <p className="text-[9px] text-gray-500 leading-snug mb-1.5">{inf.description}</p>
                  <StrengthBar value={inf.strength} colorClass={cfg.color} />
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {/* Key groups */}
      {(data.substitutes?.length > 0 || data.complements?.length > 0) && (
        <div className="grid grid-cols-2 gap-2">
          {data.complements?.length > 0 && (
            <div className="px-3 py-2.5 rounded-xl bg-emerald-50 border border-emerald-200">
              <p className="text-[9px] font-black text-emerald-700 uppercase tracking-wide mb-1.5">Complements</p>
              {data.complements.map((c, i) => (
                <p key={i} className="text-[10px] text-emerald-600">↔ {c}</p>
              ))}
            </div>
          )}
          {data.substitutes?.length > 0 && (
            <div className="px-3 py-2.5 rounded-xl bg-amber-50 border border-amber-200">
              <p className="text-[9px] font-black text-amber-700 uppercase tracking-wide mb-1.5">Substitutes</p>
              {data.substitutes.map((c, i) => (
                <p key={i} className="text-[10px] text-amber-600">⇄ {c}</p>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
