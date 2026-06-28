/**
 * AIExecutiveSummaryCards — Bloomberg-style executive intelligence cards.
 *
 * Displays a compact 2×2 grid of Market Outlook / Risk Level /
 * Seasonal Signal / Suggested Action from the 4-agent pipeline.
 * Each card shows a verdict label, a score bar, and a percentage.
 *
 * Phase 3B: Now uses AISignalBadge centralized config.
 * Renders ONLY when recommendation.verdict is set and non-UNKNOWN.
 */

import { getSignalConfig } from './AISignalBadge'

function MiniCard({ title, verdict, score }) {
  const cfg = getSignalConfig(verdict)
  // Map AISignalBadge fields to legacy names used in this component
  const mapped = {
    color:  cfg.text,
    bg:     cfg.bg,
    border: cfg.border,
    bar:    cfg.bar,
    icon:   cfg.icon,
    label:  cfg.label,
  }
  const pct = Math.round(Math.max(0, Math.min(1, score ?? 0.5)) * 100)

  return (
    <div className={`rounded-lg border p-2.5 ${mapped.bg} ${mapped.border}`}>
      <p className="text-[9px] font-bold uppercase tracking-wider text-gray-400 mb-1.5">{title}</p>
      <div className="flex items-center justify-between mb-1">
        <span className={`text-[11px] font-bold ${mapped.color} flex items-center gap-1`}>
          <span className="opacity-80 text-xs">{mapped.icon}</span>
          {mapped.label}
        </span>
        <span className={`text-[10px] font-mono ${mapped.color} opacity-70`}>{pct}%</span>
      </div>
      <div className="h-1 rounded-full bg-white/60 overflow-hidden">
        <div
          className={`h-full rounded-full transition-all ${mapped.bar}`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  )
}

export default function AIExecutiveSummaryCards({ agentInsights, className = '' }) {
  const agents = agentInsights || {}
  const rec = agents.recommendation

  // Only render if recommendation verdict is set and meaningful
  if (!rec?.verdict || rec.verdict === 'UNKNOWN') return null

  return (
    <div className={`mt-3 pt-3 border-t border-gray-100 ${className}`}>
      <p className="text-[9px] font-bold uppercase tracking-wider text-gray-400 mb-2">
        AI Intelligence Summary
      </p>
      <div className="grid grid-cols-2 gap-1.5">
        {agents.trend && (
          <MiniCard
            title="Market Outlook"
            verdict={agents.trend.verdict}
            score={agents.trend.score}
          />
        )}
        {agents.risk && (
          <MiniCard
            title="Risk Level"
            verdict={agents.risk.verdict}
            score={agents.risk.score}
          />
        )}
        {agents.seasonal && (
          <MiniCard
            title="Seasonal Signal"
            verdict={agents.seasonal.verdict}
            score={agents.seasonal.score}
          />
        )}
        {rec && (
          <MiniCard
            title="Suggested Action"
            verdict={rec.verdict}
            score={rec.score}
          />
        )}
      </div>
    </div>
  )
}
