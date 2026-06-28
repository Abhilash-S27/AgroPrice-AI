/**
 * AIReasoningPanel — Explainability Panel 2.0 (Phase 4A)
 *
 * Shows WHY the AI gave a particular response:
 *   - 4-agent verdicts (trend, risk, seasonal, recommendation)
 *   - Reasoning trace (what the engine considered, compact)
 *   - Correlation signals (confirming / contradicting patterns)
 *   - Confidence contributors and detractors
 *   - Persona mode in use
 */
import { useState, memo } from 'react'
import { getSignalConfig } from './AISignalBadge'

const AGENT_META = {
  trend:          { label: 'Trend',          icon: '📈', desc: 'Price momentum & direction' },
  risk:           { label: 'Risk',           icon: '⚡', desc: 'Volatility & anomaly risk' },
  seasonal:       { label: 'Seasonal',       icon: '📅', desc: 'Seasonal positioning' },
  recommendation: { label: 'Recommendation', icon: '💡', desc: 'Actionable guidance' },
}

const CORRELATION_STYLE = {
  CONFIRMING:   'bg-emerald-50 border-emerald-100 text-emerald-700',
  CONTRADICTION: 'bg-red-50    border-red-100     text-red-700',
  'MIXED SIGNAL': 'bg-amber-50 border-amber-100   text-amber-700',
  'TRIPLE BEAR': 'bg-red-50    border-red-100     text-red-800',
  'ANOMALY CONTEXT': 'bg-orange-50 border-orange-100 text-orange-700',
}

function ScoreBar({ score, colorClass = 'bg-primary-500' }) {
  return (
    <div className="h-1 rounded-full bg-gray-100 overflow-hidden mt-1">
      <div
        className={`h-full rounded-full transition-all ${colorClass}`}
        style={{ width: `${Math.round((score || 0) * 100)}%` }}
      />
    </div>
  )
}

const AgentCard = memo(function AgentCard({ name, insight }) {
  const meta    = AGENT_META[name] || { label: name, icon: '🤖', desc: '' }
  const verdict = insight?.verdict || 'UNKNOWN'
  const sig     = getSignalConfig(verdict)
  const score   = insight?.score ?? 0.5
  const signals = insight?.signals || []

  const barColor = name === 'risk'
    ? (score > 0.65 ? 'bg-red-400' : score > 0.35 ? 'bg-amber-400' : 'bg-emerald-400')
    : name === 'recommendation'
    ? (verdict.startsWith('SELL') ? 'bg-emerald-500' : verdict === 'WAIT' ? 'bg-orange-400' : 'bg-amber-400')
    : 'bg-primary-500'

  return (
    <div className="p-2.5 bg-gray-50 rounded-lg border border-gray-100">
      <div className="flex items-center justify-between mb-1.5">
        <div className="flex items-center gap-1.5">
          <span className="text-base leading-none">{meta.icon}</span>
          <span className="text-[11px] font-bold text-gray-700">{meta.label}</span>
        </div>
        <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded border ${sig.bg} ${sig.border} ${sig.text}`}>
          {verdict.replace(/_/g, ' ')}
        </span>
      </div>

      <ScoreBar score={score} colorClass={barColor} />

      {signals.length > 0 && (
        <ul className="mt-2 space-y-0.5">
          {signals.slice(0, 3).map((s, i) => (
            <li key={i} className="text-[10px] text-gray-500 flex gap-1 leading-snug">
              <span className="shrink-0 text-gray-300 mt-0.5">›</span>
              <span>{s}</span>
            </li>
          ))}
        </ul>
      )}

      {name === 'recommendation' && insight?.details?.advice && (
        <p className="mt-2 text-[10px] text-gray-600 italic border-t border-gray-100 pt-1.5 leading-snug">
          {insight.details.advice}
        </p>
      )}
    </div>
  )
})

function CorrelationSignals({ signals }) {
  if (!signals || signals.length === 0) return null

  return (
    <div className="mt-2 space-y-1">
      <p className="text-[9px] font-bold uppercase tracking-wider text-gray-400 mb-1">
        Signal Correlations
      </p>
      {signals.map((sig, i) => {
        const prefix = sig.split('—')[0].trim()
        const body   = sig.slice(sig.indexOf('—') + 1).trim()
        const style  = CORRELATION_STYLE[prefix] || 'bg-gray-50 border-gray-100 text-gray-600'
        return (
          <div key={i} className={`p-1.5 rounded border text-[10px] leading-snug ${style}`}>
            <span className="font-semibold">{prefix}</span>
            {body ? ` — ${body}` : ''}
          </div>
        )
      })}
    </div>
  )
}

function ConfidenceFactors({ agentInsights }) {
  const rec = agentInsights?.recommendation
  if (!rec) return null

  const score = rec.score ?? null
  if (score === null) return null

  const label = score >= 0.70 ? 'high' : score >= 0.48 ? 'medium' : 'low'
  const barColor = score >= 0.70 ? 'bg-emerald-400' : score >= 0.48 ? 'bg-amber-400' : 'bg-red-400'
  const textColor = score >= 0.70 ? 'text-emerald-700' : score >= 0.48 ? 'text-amber-700' : 'text-red-600'

  return (
    <div className="mt-2 p-2 bg-gray-50 rounded-lg border border-gray-100">
      <div className="flex items-center justify-between mb-1">
        <p className="text-[9px] font-bold uppercase tracking-wider text-gray-400">
          Agent Confidence
        </p>
        <span className={`text-[10px] font-bold ${textColor}`}>
          {label} · {Math.round(score * 100)}%
        </span>
      </div>
      <div className="h-1.5 rounded-full bg-gray-100 overflow-hidden">
        <div
          className={`h-full rounded-full transition-all ${barColor}`}
          style={{ width: `${Math.round(score * 100)}%` }}
        />
      </div>
    </div>
  )
}

function ReasoningTrace({ trace }) {
  if (!trace) return null
  const parts = trace.split(' | ').map(p => {
    const [key, ...val] = p.split(': ')
    return { key, val: val.join(': ') }
  })
  return (
    <div className="mt-2 p-2 bg-gray-900/5 rounded-lg border border-gray-100">
      <p className="text-[9px] font-bold uppercase tracking-wider text-gray-400 mb-1.5">
        Engine Reasoning Trace
      </p>
      <div className="flex flex-wrap gap-1">
        {parts.map(({ key, val }, i) => (
          <span key={i} className="text-[9px] px-1.5 py-0.5 rounded bg-white border border-gray-100 text-gray-600">
            <span className="font-semibold text-gray-400">{key}:</span>{' '}
            <span className="text-gray-700">{val}</span>
          </span>
        ))}
      </div>
    </div>
  )
}

function PersonaTag({ persona }) {
  if (!persona) return null
  return (
    <span className="text-[9px] font-semibold px-1.5 py-0.5 rounded-full bg-primary-50 border border-primary-100 text-primary-600">
      {persona}
    </span>
  )
}

export default memo(function AIReasoningPanel({
  agentInsights,
  reasoningTrace,
  correlationSignals,
  persona,
  className = '',
}) {
  const [open, setOpen] = useState(false)

  const agents = Object.entries(agentInsights || {}).filter(
    ([k, v]) => k !== 'price_series_30d' && v?.headline
  )
  if (agents.length === 0) return null

  const recVerdict = agentInsights?.recommendation?.verdict || ''
  const sig        = getSignalConfig(recVerdict)

  // Extract correlation signals from agentInsights if not passed directly
  const signals = correlationSignals
    || (agentInsights?._correlation_signals)
    || []

  return (
    <div className={`mt-2 border-t border-gray-100 pt-2 ${className}`}>
      <button
        onClick={() => setOpen(o => !o)}
        className="flex items-center gap-1.5 text-[10px] text-gray-400 hover:text-gray-600 transition-colors w-full text-left"
      >
        <span className={`transition-transform text-[8px] ${open ? 'rotate-90' : ''}`}>▸</span>
        <span className="font-medium">Why AI suggested this</span>
        {recVerdict && (
          <span className={`ml-auto px-1.5 py-0.5 rounded border text-[9px] font-semibold ${sig.bg} ${sig.border} ${sig.text}`}>
            {recVerdict.replace(/_/g, ' ')}
          </span>
        )}
        {persona && <PersonaTag persona={persona} />}
      </button>

      {open && (
        <div className="mt-2 space-y-2">
          {/* Agent cards — 2×2 grid */}
          <div className="grid grid-cols-2 gap-1.5">
            {agents.map(([name, insight]) => (
              <AgentCard key={name} name={name} insight={insight} />
            ))}
          </div>

          {/* Confidence bar from recommendation agent score */}
          <ConfidenceFactors agentInsights={agentInsights} />

          {/* Correlation signals (Phase 4A) */}
          <CorrelationSignals signals={signals} />

          {/* Reasoning trace (Phase 4A) */}
          <ReasoningTrace trace={reasoningTrace} />
        </div>
      )}
    </div>
  )
})
