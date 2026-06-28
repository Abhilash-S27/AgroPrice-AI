/**
 * AICouncilPanel — Phase 5 (Institutional Intelligence Pass).
 *
 * Visualizes the 7-agent council decision board.
 * Institutional empty state: council quorum unavailable diagnostic.
 * Panel controls: Expand All / Collapse All (always visible).
 */
import { useState, useEffect, memo } from 'react'
import { decisionService } from '@services/decisionService'

// ── Agent stance styles ────────────────────────────────────────────────────────

const STANCE_CFG = {
  BULLISH:   { bg: 'bg-emerald-50',  border: 'border-emerald-200', text: 'text-emerald-700', dot: 'bg-emerald-500', icon: '↑' },
  BEARISH:   { bg: 'bg-red-50',      border: 'border-red-200',     text: 'text-red-700',     dot: 'bg-red-500',     icon: '↓' },
  NEUTRAL:   { bg: 'bg-gray-50',     border: 'border-gray-200',    text: 'text-gray-600',    dot: 'bg-gray-400',    icon: '→' },
  HIGH_RISK: { bg: 'bg-amber-50',    border: 'border-amber-200',   text: 'text-amber-700',   dot: 'bg-amber-500',   icon: '⚡' },
  FAVORABLE: { bg: 'bg-emerald-50',  border: 'border-emerald-200', text: 'text-emerald-700', dot: 'bg-emerald-400', icon: '✓' },
}
const getStance = (s) => STANCE_CFG[s] ?? { bg: 'bg-gray-50', border: 'border-gray-200', text: 'text-gray-500', dot: 'bg-gray-300', icon: '?' }

const CONF_COLOR = { high: 'text-emerald-600', medium: 'text-amber-600', low: 'text-gray-400' }
const VOTE_COLOR = { BULLISH: 'bg-emerald-500', BEARISH: 'bg-red-500', NEUTRAL: 'bg-gray-400', HIGH_RISK: 'bg-amber-500' }

// ── Institutional fallback ─────────────────────────────────────────────────────

const CouncilFallback = memo(function CouncilFallback({ crop, state, isError, onRetry }) {
  return (
    <div className="space-y-3">
      <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3.5">
        <div className="flex items-start gap-2.5 mb-2.5">
          <span className="text-amber-500 text-sm mt-0.5 shrink-0">⚠</span>
          <div className="flex-1">
            <p className="text-[11px] font-black text-amber-800 uppercase tracking-wide">
              {isError ? 'COUNCIL PIPELINE FAILED' : 'COUNCIL QUORUM UNAVAILABLE'}
            </p>
            <p className="text-[10px] text-amber-700 mt-0.5 leading-snug">
              {isError
                ? 'The 7-agent specialist council encountered a pipeline error and could not convene.'
                : `Insufficient market data for ${crop ?? 'this crop'} in ${state ?? 'this state'} to form a council quorum.`}
            </p>
          </div>
          {isError && onRetry && (
            <button onClick={onRetry} className="shrink-0 text-[9px] font-bold px-2.5 py-1 rounded-full border border-amber-400 text-amber-700 bg-amber-100 hover:bg-amber-200 transition-colors">
              ↻ Retry
            </button>
          )}
        </div>
        <div className="border-t border-amber-200 pt-2.5">
          <p className="text-[9px] font-black uppercase tracking-widest text-amber-700 mb-1">CONFIDENCE IMPLICATION</p>
          <p className="text-[10px] text-amber-700 leading-snug">
            Without council consensus, directional confidence falls below institutional threshold (40%). No weighted recommendation can be issued.
          </p>
        </div>
      </div>

      <div className="rounded-xl border border-gray-100 bg-gray-50 px-4 py-3">
        <p className="text-[9px] font-black uppercase tracking-widest text-gray-400 mb-2">DEFAULT INSTITUTIONAL STANCE</p>
        <div className="space-y-1.5">
          {[
            'No directional consensus can be formed from available data',
            'Risk assessment: elevated — insufficient signals to quantify',
            'Recommended default position: NEUTRAL — await confirmed data',
            'Tier-A crops (Tomato, Onion, Potato) typically provide full council availability',
          ].map((item, i) => (
            <p key={i} className="text-[10px] text-gray-600 flex items-start gap-1.5">
              <span className="text-gray-300 mt-0.5 shrink-0">·</span>
              {item}
            </p>
          ))}
        </div>
      </div>

      <div className="px-4 py-2.5 rounded-xl border border-gray-100 bg-white">
        <p className="text-[9px] font-black uppercase tracking-wide text-gray-400 mb-0.5">NEXT STEP</p>
        <p className="text-[10px] text-gray-500 leading-snug">
          Select a crop and state with active AGMARKNET price history to enable the full 7-agent specialist council.
        </p>
      </div>
    </div>
  )
})

// ── Agent card ─────────────────────────────────────────────────────────────────

const AgentCard = memo(function AgentCard({ agent, isDissenting, forceExpanded }) {
  const [expanded, setExpanded] = useState(false)
  const stance = getStance(agent.stance)
  const isOpen = forceExpanded || expanded

  return (
    <div className={`rounded-lg border transition-all duration-150 ease-in-out ${stance.border} ${stance.bg} hover:shadow-sm hover:border-opacity-80 hover:-translate-y-px ${isDissenting ? 'border-l-[3px] border-l-orange-400' : ''}`}>
      <button
        className="w-full text-left px-3 py-2 flex items-center gap-2 focus:outline-none"
        onClick={() => setExpanded(e => !e)}
      >
        <span className={`w-2 h-2 rounded-full shrink-0 ${stance.dot}`} />
        <div className="flex-1 min-w-0">
          <p className={`text-[10px] font-bold truncate ${stance.text}`}>{agent.display_name}</p>
          <p className="text-[8px] text-gray-400">{agent.verdict?.replace(/_/g,' ')}</p>
        </div>
        <div className="w-14 shrink-0">
          <div className="h-1 rounded-full bg-gray-200 overflow-hidden">
            <div className={`h-full rounded-full ${stance.dot} transition-all duration-700 ease-out`} style={{ width: `${Math.round(agent.score * 100)}%` }} />
          </div>
          <p className={`text-[8px] mt-0.5 text-right tabular-nums ${CONF_COLOR[agent.confidence] ?? 'text-gray-400'}`}>
            {Math.round(agent.score * 100)}%
          </p>
        </div>
        <span className={`text-sm font-black shrink-0 ${stance.text}`}>{stance.icon}</span>
        <span className="text-[9px] text-gray-400 shrink-0">{isOpen ? '▴' : '▾'}</span>
      </button>

      {isOpen && agent.reasoning?.length > 0 && (
        <div className="px-3 pb-2 space-y-1 border-t border-gray-100 pt-1.5">
          {agent.reasoning.map((r, i) => (
            <div key={i} className="flex items-start gap-1.5">
              <span className={`text-[8px] mt-0.5 shrink-0 ${stance.text}`}>▸</span>
              <p className="text-[10px] text-gray-600 leading-snug">{r}</p>
            </div>
          ))}
          {agent.escalation_flags?.length > 0 && (
            <div className="mt-1.5 flex flex-wrap gap-1">
              {agent.escalation_flags.map((f, i) => (
                <span key={i} className="text-[8px] font-bold px-1.5 py-0.5 rounded bg-amber-100 border border-amber-200 text-amber-700">
                  {f.split(' — ')[0]}
                </span>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
})

// ── Main component ─────────────────────────────────────────────────────────────

export default function AICouncilPanel({ crop, state }) {
  const [data,       setData]       = useState(null)
  const [loading,    setLoading]    = useState(false)
  const [error,      setError]      = useState(null)
  const [expandAll,  setExpandAll]  = useState(false)
  const [retryCount, setRetryCount] = useState(0)

  useEffect(() => {
    if (!crop || !state) return
    setLoading(true)
    setError(null)
    decisionService.getCouncil(crop, state)
      .then(d => setData(d))
      .catch(() => setError('Council pipeline failed'))
      .finally(() => setLoading(false))
  }, [crop, state, retryCount])

  if (!crop || !state) {
    return (
      <div className="text-center py-8 text-gray-400 text-[11px]">
        Select a crop and state to view the AI council decision.
      </div>
    )
  }

  const showFallback = !loading && (error || !data?.has_data || !data?.council)

  return (
    <div className="space-y-4">

      {/* ── Controls — always visible when crop+state selected ── */}
      <div className="flex items-center justify-end">
        <button
          onClick={() => setExpandAll(e => !e)}
          disabled={showFallback || loading}
          className={`text-[9px] font-bold px-2.5 py-1 rounded-full border transition-all duration-150 ease-in-out ${
            showFallback || loading
              ? 'border-gray-100 text-gray-300 bg-gray-50 cursor-not-allowed'
              : expandAll
                ? 'bg-gray-900 border-gray-900 text-white shadow-sm'
                : 'bg-gray-50 border-gray-200 text-gray-500 hover:border-gray-400 hover:bg-white hover:shadow-sm'
          }`}
        >
          {expandAll ? '▴ Collapse All' : '▾ Expand All'}
        </button>
      </div>

      {/* ── Content area ──────────────────────────────────────── */}
      {loading ? (
        <div className="space-y-2 animate-pulse">
          {[1,2,3,4,5,6,7].map(i => <div key={i} className="h-10 bg-gray-100 rounded-xl" />)}
        </div>
      ) : showFallback ? (
        <CouncilFallback crop={crop} state={state} isError={!!error} onRetry={() => setRetryCount(c => c + 1)} />
      ) : (
        <CouncilData data={data} expandAll={expandAll} />
      )}
    </div>
  )
}

// ── Data content ───────────────────────────────────────────────────────────────

function CouncilData({ data, expandAll }) {
  const [show, setShow] = useState(false)
  useEffect(() => {
    setShow(false)
    const id = requestAnimationFrame(() => setShow(true))
    return () => cancelAnimationFrame(id)
  }, [data])

  const council    = data.council
  const consensus  = data.consensus ?? {}
  const agents     = council.agents ?? []
  const breakdown  = council.vote_breakdown ?? {}
  const dominant   = council.dominant_view ?? 'NEUTRAL'
  const dissenters = new Set(council.dissent_agents ?? [])
  const domStance  = getStance(dominant)

  return (
    <div className="space-y-3">
      {/* Council verdict header */}
      <div className={`rounded-lg border ${domStance.border} ${domStance.bg} px-3.5 py-2.5 transition-all duration-150 hover:shadow-sm hover:-translate-y-px`}>
        <div className="flex items-center justify-between gap-3">
          <div className="flex-1 min-w-0">
            <p className="text-[8px] font-black uppercase tracking-widest text-gray-400 mb-0.5">COUNCIL VERDICT</p>
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className={`text-sm font-black ${domStance.text}`}>{domStance.icon}</span>
              <p className={`text-[12px] font-bold ${domStance.text}`}>{dominant.replace(/_/g,' ')}</p>
              {council.contradiction_detected && (
                <span className="text-[8px] font-bold px-1.5 py-0.5 rounded-full bg-orange-100 border border-orange-200 text-orange-700 animate-pulse">
                  ⚠ Divided
                </span>
              )}
            </div>
            {council.council_summary && (
              <p className="text-[9px] text-gray-500 mt-0.5 leading-snug">{council.council_summary}</p>
            )}
          </div>
          <div className="text-right shrink-0">
            <p className="text-lg font-black text-gray-800 tabular-nums">{Math.round(council.consensus_strength * 100)}%</p>
            <p className="text-[8px] text-gray-400 uppercase tracking-wide">consensus</p>
            <p className={`text-[9px] font-bold ${CONF_COLOR[council.final_confidence] ?? 'text-gray-400'}`}>
              {council.final_confidence} conf.
            </p>
          </div>
        </div>

        <div className="mt-2">
          <p className="text-[8px] font-black uppercase tracking-widest text-gray-400 mb-0.5">VOTE BREAKDOWN</p>
          <div className="flex rounded-full overflow-hidden h-1.5 gap-px">
            {Object.entries(breakdown).map(([stance, w]) =>
              w > 0.01 && (
                <div key={stance} className={`${VOTE_COLOR[stance] ?? 'bg-gray-400'} h-full`} style={{ flex: w }} title={`${stance}: ${Math.round(w * 100)}%`} />
              )
            )}
          </div>
          <div className="flex items-center gap-2 mt-1 flex-wrap">
            {Object.entries(breakdown).map(([stance, w]) =>
              w > 0.01 && (
                <span key={stance} className="text-[8px] text-gray-500 flex items-center gap-1">
                  <span className={`w-1.5 h-1.5 rounded-sm ${VOTE_COLOR[stance] ?? 'bg-gray-400'}`} />
                  {stance.replace(/_/g,' ').toLowerCase()} ({Math.round(w * 100)}%)
                </span>
              )
            )}
          </div>
        </div>

        {/* Consensus convergence meter */}
        <div className="mt-2 pt-2 border-t border-gray-100/60">
          <div className="flex items-center justify-between mb-0.5">
            <p className="text-[8px] font-black uppercase tracking-widest text-gray-400">CONSENSUS STRENGTH</p>
            <p className="text-[8px] tabular-nums text-gray-400">{Math.round(council.consensus_strength * 100)}%</p>
          </div>
          <div className="h-1.5 rounded-full bg-gray-100 overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-700 ease-out ${domStance.dot}`}
              style={{ width: `${Math.round(council.consensus_strength * 100)}%` }}
            />
          </div>
        </div>
      </div>

      {/* Weighted recommendation */}
      <div className="flex items-center justify-between px-3 py-2 rounded-lg bg-gray-50 border border-gray-100">
        <p className="text-[9px] text-gray-500">Weighted Recommendation</p>
        <p className="text-[11px] font-bold text-gray-800">{council.weighted_recommendation?.replace(/_/g,' ')}</p>
      </div>

      {/* Agent cards — grouped by majority / dissenting */}
      {(() => {
        const majority  = agents.filter(a => !dissenters.has(a.display_name))
        const minority  = agents.filter(a =>  dissenters.has(a.display_name))
        return (
          <div className="space-y-3">
            {majority.length > 0 && (
              <div>
                <p className="text-[8px] font-black uppercase tracking-widest text-gray-400 mb-1.5">
                  SPECIALIST AGENTS · {majority.length} MAJORITY
                </p>
                <div className="space-y-1">
                  {majority.map((agent, i) => (
                    <div key={agent.agent} style={{
                      opacity: show ? 1 : 0,
                      transform: show ? 'none' : 'translateY(3px)',
                      transition: `opacity 250ms ease-out ${i * 50}ms, transform 250ms ease-out ${i * 50}ms`,
                    }}>
                      <AgentCard agent={agent} isDissenting={false} forceExpanded={expandAll} />
                    </div>
                  ))}
                </div>
              </div>
            )}
            {minority.length > 0 && (
              <div>
                <div className="flex items-center gap-2 my-0.5">
                  <div className="flex-1 h-px bg-orange-100" />
                  <p className="text-[8px] font-black uppercase tracking-widest text-orange-400 shrink-0">
                    {minority.length} DISSENTING
                  </p>
                  <div className="flex-1 h-px bg-orange-100" />
                </div>
                <div className="space-y-1 mt-1">
                  {minority.map((agent, i) => (
                    <div key={agent.agent} style={{
                      opacity: show ? 1 : 0,
                      transform: show ? 'none' : 'translateY(3px)',
                      transition: `opacity 250ms ease-out ${(majority.length + i) * 50}ms, transform 250ms ease-out ${(majority.length + i) * 50}ms`,
                    }}>
                      <AgentCard agent={agent} isDissenting={true} forceExpanded={expandAll} />
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )
      })()}

      {/* Consensus decomposition */}
      {consensus.confidence_decomposition?.length > 0 && (
        <div className="px-3 py-2.5 rounded-lg bg-gray-50 border border-gray-100">
          <p className="text-[8px] font-black uppercase tracking-widest text-gray-400 mb-1.5">CONFIDENCE DECOMPOSITION</p>
          <div className="space-y-1">
            {consensus.confidence_decomposition.map((d, i) => (
              <p key={i} className="text-[10px] text-gray-600 flex items-start gap-1.5">
                <span className="text-gray-300 mt-0.5 shrink-0">·</span>
                {d}
              </p>
            ))}
          </div>
          {consensus.instability_warning && (
            <div className="mt-1.5 px-3 py-1.5 rounded-lg bg-amber-50 border border-amber-200">
              <p className="text-[10px] text-amber-700 font-medium">{consensus.instability_warning}</p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
