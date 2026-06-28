/**
 * AIMarketBriefing — proactive AI market briefing panel.
 *
 * Loads on mount (proactive insights) + optional per-crop deep briefing.
 * Phase 2B — Agentic AI.
 */
import { useState, useEffect, useCallback } from 'react'
import { briefingService } from '@services/briefingService'
import { TIER1_CROPS, SOUTH_INDIAN_STATES } from '@utils/constants'
import AIRiskCard from './AIRiskCard'
import AIRecommendationCard from './AIRecommendationCard'
import { Spinner } from '@components/ui/Loader'

// Proactive insight pill
function InsightPill({ label, value, sub, color = 'emerald' }) {
  const cls = {
    emerald: 'bg-emerald-50 border-emerald-200 text-emerald-700',
    red:     'bg-red-50     border-red-200     text-red-700',
    blue:    'bg-blue-50    border-blue-200    text-blue-700',
    amber:   'bg-amber-50   border-amber-200   text-amber-700',
    purple:  'bg-purple-50  border-purple-200  text-purple-700',
  }[color] || 'bg-gray-50 border-gray-200 text-gray-700'

  return (
    <div className={`flex-1 min-w-[140px] p-3 rounded-xl border ${cls}`}>
      <p className="text-[9px] font-bold uppercase tracking-widest opacity-60 mb-0.5">{label}</p>
      <p className="text-sm font-bold truncate">{value || '—'}</p>
      {sub && <p className="text-[10px] opacity-70 mt-0.5 truncate">{sub}</p>}
    </div>
  )
}

// Trend direction arrow
function TrendArrow({ score }) {
  if (score >= 0.6) return <span className="text-emerald-500 font-bold">↑</span>
  if (score <= 0.4) return <span className="text-red-500 font-bold">↓</span>
  return <span className="text-gray-400">→</span>
}

export default function AIMarketBriefing({ className = '' }) {
  const [proactive, setProactive]   = useState(null)
  const [proLoading, setProLoading] = useState(true)
  const [proError, setProError]     = useState(null)

  const [selectedCrop,  setCrop]    = useState(TIER1_CROPS[0] || 'Tomato')
  const [selectedState, setState]   = useState(SOUTH_INDIAN_STATES[0] || 'Karnataka')
  const [briefing,  setBriefing]    = useState(null)
  const [bLoading,  setBLoading]    = useState(false)
  const [expanded,  setExpanded]    = useState(false)

  // Load proactive insights on mount
  useEffect(() => {
    briefingService.getProactiveInsights()
      .then(setProactive)
      .catch(e => setProError(e.message || 'Failed to load'))
      .finally(() => setProLoading(false))
  }, [])

  const loadBriefing = useCallback(async () => {
    setBLoading(true)
    setBriefing(null)
    setExpanded(true)
    try {
      const b = await briefingService.getMarketBriefing(selectedCrop, selectedState)
      setBriefing(b)
    } catch {
      setBriefing(null)
    } finally {
      setBLoading(false)
    }
  }, [selectedCrop, selectedState])

  return (
    <div className={`rounded-2xl border border-gray-100 bg-white shadow-sm hover:shadow-md transition-shadow duration-200 overflow-hidden ${className}`}>
      {/* Header */}
      <div className="px-5 py-3.5 border-b border-gray-100 flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-xl bg-gradient-to-br from-blue-600 to-primary-600 text-white flex items-center justify-center text-xs font-bold">
            AI
          </div>
          <div>
            <p className="text-sm font-semibold text-gray-900">Market Briefing</p>
            <p className="text-[10px] text-gray-400">Multi-agent · Proactive signals</p>
          </div>
        </div>
        <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-blue-50 border border-blue-200 text-blue-700 font-semibold">
          Agentic AI
        </span>
      </div>

      {/* Proactive cross-crop signals */}
      <div className="px-4 py-3.5">
        {proLoading ? (
          <div className="flex items-center gap-2">
            <Spinner size="sm" className="w-3.5 h-3.5 text-gray-400" />
            <p className="text-xs text-gray-400">Computing cross-crop intelligence…</p>
          </div>
        ) : proError ? (
          <p className="text-xs text-red-500">{proError}</p>
        ) : proactive ? (
          <div>
            <p className="text-[9px] font-bold text-gray-400 uppercase tracking-widest mb-2">
              Proactive Signals · Today
            </p>
            <div className="flex flex-wrap gap-1.5">
              {proactive.top_opportunity && (
                <InsightPill
                  label="Top Opportunity"
                  value={proactive.top_opportunity.crop}
                  sub={proactive.top_opportunity.state}
                  color="emerald"
                />
              )}
              {proactive.biggest_risk && (
                <InsightPill
                  label="Biggest Risk"
                  value={proactive.biggest_risk.crop}
                  sub={`Risk ${(proactive.biggest_risk.risk_score * 100).toFixed(0)}/100`}
                  color="red"
                />
              )}
              {proactive.safest_market && (
                <InsightPill
                  label="Safest Market"
                  value={proactive.safest_market.crop}
                  sub={proactive.safest_market.state}
                  color="blue"
                />
              )}
              {proactive.strongest_momentum && (
                <InsightPill
                  label="Momentum"
                  value={proactive.strongest_momentum.crop}
                  sub={`Score ${(proactive.strongest_momentum.trend_score * 100).toFixed(0)}/100`}
                  color="amber"
                />
              )}
              {proactive.seasonal_alert && (
                <InsightPill
                  label="Seasonal"
                  value={proactive.seasonal_alert.crop}
                  sub={proactive.seasonal_alert.phase === 'peak' ? 'Peak season' : 'Lean season'}
                  color="purple"
                />
              )}
            </div>
          </div>
        ) : null}
      </div>

      {/* Per-crop deep briefing */}
      <div className="px-4 pb-4 border-t border-gray-100">
        <div className="pt-3 flex items-center gap-2 flex-wrap">
          <select
            value={selectedCrop}
            onChange={e => setCrop(e.target.value)}
            className="text-xs px-2.5 py-1.5 rounded-lg border border-gray-200 bg-white text-gray-700 focus:outline-none focus:ring-1 focus:ring-primary-500"
          >
            {TIER1_CROPS.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
          <select
            value={selectedState}
            onChange={e => setState(e.target.value)}
            className="text-xs px-2.5 py-1.5 rounded-lg border border-gray-200 bg-white text-gray-700 focus:outline-none focus:ring-1 focus:ring-primary-500"
          >
            {SOUTH_INDIAN_STATES.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
          <button
            onClick={loadBriefing}
            disabled={bLoading}
            className="px-3 py-1.5 rounded-lg bg-primary-600 text-white text-xs font-medium hover:bg-primary-700 disabled:opacity-50 transition-colors"
          >
            {bLoading ? 'Analyzing…' : 'Deep Briefing'}
          </button>
          {briefing && (
            <button
              onClick={() => setExpanded(e => !e)}
              className="text-[10px] text-gray-400 hover:text-gray-600 transition-colors px-1.5"
            >
              {expanded ? '▲ Hide' : '▼ Show'}
            </button>
          )}
        </div>

        {bLoading && (
          <div className="flex items-center gap-2 mt-3">
            <Spinner size="sm" className="w-3.5 h-3.5 text-gray-400" />
            <p className="text-xs text-gray-400">Running 4 AI agents…</p>
          </div>
        )}

        {/* Collapsible briefing body */}
        <div
          className="grid transition-all duration-200 ease-out"
          style={{ gridTemplateRows: (briefing && expanded) ? '1fr' : '0fr' }}
        >
          <div className="overflow-hidden">
            {briefing && (
              <div className="mt-3 space-y-2.5">
                {briefing.executive_summary && (
                  <div className="p-3 bg-gray-50/80 rounded-xl border border-gray-100">
                    <p className="text-[9px] font-bold text-gray-400 uppercase tracking-widest mb-1">Executive Summary</p>
                    <p className="text-xs text-gray-700 leading-relaxed">{briefing.executive_summary}</p>
                  </div>
                )}
                <div className="grid grid-cols-2 gap-2">
                  {['trend', 'seasonal'].map(name => {
                    const a = briefing.agents?.[name]
                    if (!a) return null
                    const icons = { trend: '📈', seasonal: '📅' }
                    return (
                      <div key={name} className="p-2.5 bg-gray-50/80 rounded-lg border border-gray-100">
                        <div className="flex items-center gap-1.5 mb-1">
                          <span className="text-sm">{icons[name]}</span>
                          <p className="text-[10px] font-bold text-gray-600 capitalize">{name}</p>
                          <TrendArrow score={a.score} />
                        </div>
                        <p className="text-[10px] text-gray-500 leading-snug">{a.headline}</p>
                      </div>
                    )
                  })}
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <AIRiskCard risk={briefing.agents?.risk} />
                  <AIRecommendationCard recommendation={briefing.agents?.recommendation} />
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
