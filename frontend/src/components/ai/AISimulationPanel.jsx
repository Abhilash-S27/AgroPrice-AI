/**
 * AISimulationPanel — What-if scenario simulation panel.
 *
 * Accepts free-text scenario input, calls /api/briefing/scenario,
 * renders structured result (price impact, risk change, recommendation).
 * Phase 2B — Heuristic scenario engine.
 */
import { useState, useCallback } from 'react'
import { briefingService } from '@services/briefingService'
import { TIER1_CROPS, SOUTH_INDIAN_STATES } from '@utils/constants'

const EXAMPLE_SCENARIOS = [
  'What if rainfall decreases by 30% next month?',
  'What if there is a supply glut due to bumper harvest?',
  'What if transport costs increase by 20%?',
  'What if exports are restricted for 3 months?',
  'What if there is sudden demand spike in festival season?',
]

const DIRECTION_CONFIG = {
  up:        { label: 'Price Rise Expected',  color: 'text-emerald-700', bg: 'bg-emerald-50', border: 'border-emerald-200', arrow: '↑' },
  down:      { label: 'Price Drop Expected',  color: 'text-red-700',     bg: 'bg-red-50',     border: 'border-red-200',     arrow: '↓' },
  stable:    { label: 'Price Likely Stable',  color: 'text-gray-700',    bg: 'bg-gray-50',    border: 'border-gray-200',    arrow: '→' },
  uncertain: { label: 'Outcome Uncertain',    color: 'text-gray-600',    bg: 'bg-gray-50',    border: 'border-gray-200',    arrow: '?' },
}

function ImpactBar({ pct, direction }) {
  const color = direction === 'up' ? 'bg-emerald-500' : direction === 'down' ? 'bg-red-500' : 'bg-gray-400'
  const width = Math.min(Math.abs(pct), 100)
  return (
    <div className="h-2 rounded-full bg-gray-100 overflow-hidden">
      <div className={`h-full rounded-full transition-all ${color}`} style={{ width: `${width}%` }} />
    </div>
  )
}

export default function AISimulationPanel({ className = '' }) {
  const [crop,     setCrop]     = useState(TIER1_CROPS[0] || 'Tomato')
  const [state,    setState]    = useState(SOUTH_INDIAN_STATES[0] || 'Karnataka')
  const [scenario, setScenario] = useState('')
  const [result,   setResult]   = useState(null)
  const [loading,  setLoading]  = useState(false)
  const [error,    setError]    = useState(null)

  const runSimulation = useCallback(async () => {
    if (!scenario.trim()) return
    setLoading(true)
    setResult(null)
    setError(null)
    try {
      const res = await briefingService.simulateScenario(crop, state, scenario.trim())
      setResult(res)
    } catch (e) {
      setError(e?.response?.data?.detail || e.message || 'Simulation failed')
    } finally {
      setLoading(false)
    }
  }, [crop, state, scenario])

  const dir = result ? (DIRECTION_CONFIG[result.price_direction] || DIRECTION_CONFIG.stable) : null

  return (
    <div className={`rounded-2xl border border-gray-100 bg-white shadow-sm overflow-hidden ${className}`}>
      {/* Header */}
      <div className="px-5 py-3.5 border-b border-gray-50 flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-orange-500 to-amber-500 text-white flex items-center justify-center text-sm">
            🔮
          </div>
          <div>
            <p className="text-sm font-bold text-gray-900">AI Scenario Simulation</p>
            <p className="text-[11px] text-gray-400">What-if analysis · Heuristic engine</p>
          </div>
        </div>
        <span className="text-[10px] px-2 py-1 rounded-full bg-amber-50 border border-amber-200 text-amber-700 font-medium">
          Illustrative · Not a guarantee
        </span>
      </div>

      <div className="px-5 py-4 space-y-3">
        {/* Crop + state selectors */}
        <div className="flex flex-wrap gap-2">
          <select
            value={crop}
            onChange={e => setCrop(e.target.value)}
            className="text-xs px-2.5 py-1.5 rounded-lg border border-gray-200 bg-white text-gray-700 focus:outline-none focus:ring-1 focus:ring-primary-500"
          >
            {TIER1_CROPS.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
          <select
            value={state}
            onChange={e => setState(e.target.value)}
            className="text-xs px-2.5 py-1.5 rounded-lg border border-gray-200 bg-white text-gray-700 focus:outline-none focus:ring-1 focus:ring-primary-500"
          >
            {SOUTH_INDIAN_STATES.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>

        {/* Scenario input */}
        <div>
          <textarea
            value={scenario}
            onChange={e => setScenario(e.target.value)}
            rows={2}
            placeholder="Describe a scenario e.g. 'What if rainfall drops 40%?'"
            className="w-full text-xs px-3 py-2 rounded-lg border border-gray-200 bg-white text-gray-700 placeholder-gray-300 focus:outline-none focus:ring-1 focus:ring-primary-500 resize-none"
          />
          {/* Example chips */}
          <div className="flex flex-wrap gap-1 mt-1.5">
            {EXAMPLE_SCENARIOS.slice(0, 3).map((s, i) => (
              <button
                key={i}
                onClick={() => setScenario(s)}
                className="text-[10px] text-gray-400 hover:text-primary-600 border border-gray-100 hover:border-primary-200 rounded-full px-2 py-0.5 transition-colors"
              >
                {s.length > 40 ? s.slice(0, 38) + '…' : s}
              </button>
            ))}
          </div>
        </div>

        <button
          onClick={runSimulation}
          disabled={loading || !scenario.trim()}
          className="w-full px-4 py-2 rounded-lg bg-amber-500 text-white text-xs font-bold hover:bg-amber-600 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          {loading ? 'Simulating…' : 'Run Simulation'}
        </button>

        {error && (
          <p className="text-xs text-red-500 text-center">{error}</p>
        )}

        {/* Result */}
        {result && dir && (
          <div className={`mt-1 rounded-xl border ${dir.border} ${dir.bg} overflow-hidden`}>
            {/* Price direction headline */}
            <div className="px-4 py-3 flex items-center justify-between">
              <div>
                <p className={`text-sm font-bold ${dir.color}`}>
                  {dir.arrow} {dir.label}
                </p>
                <p className="text-[11px] text-gray-500 mt-0.5">
                  {result.scenario_type?.replace(/_/g, ' ')} · {crop}, {state}
                </p>
              </div>
              <div className="text-right">
                <p className={`text-xl font-black ${dir.color}`}>
                  {result.price_direction === 'up' ? '+' : result.price_direction === 'down' ? '-' : ''}
                  {Math.abs(result.price_impact_pct || 0).toFixed(1)}%
                </p>
                <p className="text-[10px] text-gray-400">estimated impact</p>
              </div>
            </div>

            {/* Price bar */}
            <div className="px-4 pb-2">
              <ImpactBar pct={result.price_impact_pct || 0} direction={result.price_direction} />
              <div className="flex justify-between text-[10px] text-gray-400 mt-0.5">
                <span>
                  Current {result.current_price
                    ? `₹${Number(result.current_price).toLocaleString('en-IN')}/qtl`
                    : '—'}
                </span>
                <span>
                  Est. {result.estimated_price
                    ? `₹${Number(result.estimated_price).toLocaleString('en-IN')}/qtl`
                    : '—'}
                </span>
              </div>
            </div>

            {/* Rationale */}
            {result.rationale && (
              <div className="px-4 py-3 border-t border-white/40">
                <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1">Rationale</p>
                <p className="text-xs text-gray-700 leading-relaxed">{result.rationale}</p>
              </div>
            )}

            {/* Farmer recommendation */}
            {result.farmer_recommendation && (
              <div className="px-4 py-3 bg-white/40 border-t border-white/40">
                <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1">Advisory</p>
                <p className="text-xs text-gray-700 leading-relaxed">{result.farmer_recommendation}</p>
              </div>
            )}

            {/* Confidence */}
            <div className="px-4 py-2 border-t border-white/40 flex items-center justify-between">
              <span className="text-[10px] text-gray-400">
                Confidence: <span className="font-medium text-gray-600 capitalize">{result.confidence || 'moderate'}</span>
              </span>
              <span className="text-[10px] text-gray-400">
                Risk change: <span className="font-medium text-gray-600 capitalize">{result.risk_change || 'unchanged'}</span>
              </span>
            </div>

            {/* Disclaimer */}
            <div className="px-4 py-2.5 bg-gray-50/80 border-t border-gray-100">
              <p className="text-[10px] text-gray-400 leading-relaxed">
                {result.disclaimer || 'This is an illustrative heuristic simulation. Actual prices depend on many factors. Consult local APMC data before making decisions.'}
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
