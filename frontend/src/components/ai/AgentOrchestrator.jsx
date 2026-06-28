import { useState, useEffect, useMemo } from 'react'
import Card from '@components/ui/Card'

/**
 * AI Agent Orchestration Panel (Phase 5).
 *
 * Visualizes the REAL subsystems that produced the current page as six
 * collaborating agents. Every status line is assembled from the live
 * insight bundle for the selected crop+state — the "agents" are honest
 * personifications of actual modules (forecaster, volatility analyzer,
 * seasonal decomposer, advisor, confidence scorer, narrator), never
 * random or canned.
 *
 * On crop/state change the agents replay a staggered thinking→done
 * sequence, mirroring the real recomputation that just happened.
 */

function buildAgents(insights, forecast) {
  if (!insights?.has_data) return []
  const cs = insights.context_summary ?? {}
  const conf = insights.confidence ?? {}
  const strat = insights.strategy ?? {}
  const anomalies = insights.anomaly_explanations ?? []
  const phase = cs.phase ?? 'normal'

  const weakest = (conf.breakdown ?? [])
    .slice()
    .sort((a, b) => (b.weight - b.earned) - (a.weight - a.earned))[0]

  return [
    {
      key: 'forecast', name: 'Forecast Agent', icon: '📈',
      role: 'price prediction engine',
      summary: forecast
        ? `${forecast.method === 'sparse_trend' ? 'Sparse-trend estimator' : 'Prophet'} fitted on ${forecast.training_rows?.toLocaleString()} days → ${forecast.forecast?.length}-day projection (Tier ${cs.tier}).`
        : `Tier ${cs.tier} pipeline selected on ${cs.training_days?.toLocaleString()} training days.`,
      metrics: `${cs.training_days?.toLocaleString()} days · Tier ${cs.tier}`,
      contribution: Math.round((conf.breakdown?.find(b => b.factor === 'Training depth')?.earned ?? 0) / 25 * 100),
    },
    {
      key: 'risk', name: 'Risk Agent', icon: '⚡',
      role: 'volatility + anomaly analysis',
      summary: (cs.cv ?? 0) >= 55
        ? `Detected elevated instability: ${cs.cv?.toFixed(0)}% CV + ${cs.anomaly_count ?? 0} anomalies in 90 days.`
        : (cs.cv ?? 0) >= 30
          ? `Moderate swing profile: ${cs.cv?.toFixed(0)}% CV, ${cs.anomaly_count ?? 0} recent anomaly event${(cs.anomaly_count ?? 0) === 1 ? '' : 's'}.`
          : `Market reads stable: ${cs.cv?.toFixed(0)}% CV with ${cs.anomaly_count ?? 0} recent anomalies.`,
      metrics: `${cs.cv?.toFixed(0)}% CV · ${cs.anomaly_count ?? 0} events/90d`,
      contribution: Math.round(((conf.breakdown?.find(b => b.factor === 'Volatility stability')?.earned ?? 0)
        + (conf.breakdown?.find(b => b.factor === 'Anomaly cleanliness')?.earned ?? 0)) / 30 * 100),
    },
    {
      key: 'seasonal', name: 'Seasonal Agent', icon: '🔄',
      role: 'cycle / trough / recovery analysis',
      summary: phase === 'trough' && (cs.momentum ?? 0) > 3
        ? `Trough-exit pattern: prices below seasonal norm but momentum has turned ${cs.momentum > 0 ? '+' : ''}${cs.momentum?.toFixed(1)}%/7d.`
        : phase === 'peak'
          ? `Peak window active — current pricing rides the seasonal premium.`
          : `Phase classified '${phase}' with ${cs.momentum > 0 ? '+' : ''}${cs.momentum?.toFixed(1)}%/7d short-term drift.`,
      metrics: `${phase} phase · ${cs.momentum > 0 ? '+' : ''}${cs.momentum?.toFixed(1)}%/7d`,
      contribution: Math.round((conf.breakdown?.find(b => b.factor === 'Seasonal consistency')?.earned ?? 0) / 10 * 100),
    },
    {
      key: 'strategy', name: 'Strategy Agent', icon: '🎯',
      role: 'farmer / trader recommendations',
      summary: strat.farmer?.[0] ?? strat.trader?.[0] ?? 'Deriving positioning guidance from seasonality and momentum.',
      metrics: `${(strat.farmer?.length ?? 0) + (strat.trader?.length ?? 0) + (strat.storage?.length ?? 0)} recommendations · ${strat.risks?.length ?? 0} risk flags`,
      contribution: null,
    },
    {
      key: 'confidence', name: 'Confidence Agent', icon: '⚖️',
      role: 'forecast reliability scoring',
      summary: `Weighted score ${conf.score}/100 (${conf.reliability}); biggest drag: ${weakest ? `${weakest.factor.toLowerCase()} (${weakest.earned}/${weakest.weight})` : '—'}.`,
      metrics: `${conf.score}/100 · 6 factors`,
      contribution: conf.score,
    },
    {
      key: 'narrator', name: 'Narrator Agent', icon: '✦',
      role: 'executive explanation generation',
      summary: insights.trend_story ?? 'Composing the market narrative from agent outputs.',
      metrics: `${anomalies.length} anomaly explanations · 1 narrative`,
      contribution: null,
    },
  ]
}

export default function AgentOrchestrator({ insights, forecast, crop, state }) {
  const agents = useMemo(() => buildAgents(insights, forecast), [insights, forecast])
  // staggered thinking→done replay on context change
  const [doneCount, setDoneCount] = useState(0)

  useEffect(() => {
    setDoneCount(0)
    if (!agents.length) return
    const timers = agents.map((_, i) =>
      setTimeout(() => setDoneCount(c => Math.max(c, i + 1)), 350 + i * 420))
    return () => timers.forEach(clearTimeout)
  }, [crop, state, agents.length])

  if (!agents.length) return null

  return (
    <Card className="!p-0 overflow-hidden ai-fade-up">
      <div className="px-5 py-3.5 border-b border-gray-100 flex items-center gap-2.5">
        <div className="w-8 h-8 rounded-xl bg-gray-900 text-white flex items-center justify-center text-base">🤖</div>
        <div>
          <p className="text-sm font-bold text-gray-900 leading-tight">AI Agent Orchestration</p>
          <p className="text-[11px] text-gray-400">
            six intelligence subsystems collaborating on {crop} · {state}
          </p>
        </div>
        <span className="ml-auto inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px]
                         font-bold text-primary-700 border border-primary-200 ai-shimmer">
          <span className="w-1.5 h-1.5 rounded-full bg-primary-500 ai-pulse" />
          {doneCount < agents.length ? 'ORCHESTRATING' : 'PIPELINE COMPLETE'}
        </span>
      </div>

      <div className="p-4 grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
        {agents.map((a, i) => {
          const thinking = i >= doneCount
          return (
            <div key={a.key}
              className={`relative rounded-xl border p-3.5 ai-lift transition-colors ${
                thinking ? 'border-gray-100 bg-gray-50' : 'border-emerald-200 bg-emerald-50'
              }`}>
              {/* connector hint to the next agent */}
              {i < agents.length - 1 && (
                <svg className="hidden xl:block absolute -right-3.5 top-1/2 w-4 h-2 z-10" viewBox="0 0 16 8">
                  <line x1="0" y1="4" x2="16" y2="4" stroke="rgba(52,211,153,0.30)" strokeWidth="2"
                        className={thinking ? '' : 'ai-flow-line'} />
                </svg>
              )}
              <div className="flex items-center gap-2 mb-1.5">
                <div className={`w-7 h-7 rounded-lg flex items-center justify-center text-sm ${
                  thinking ? 'bg-gray-200 ai-agent-thinking' : 'bg-emerald-50 border border-emerald-200'
                }`}>
                  {a.icon}
                </div>
                <div>
                  <p className="text-xs font-bold text-gray-800 leading-tight">{a.name}</p>
                  <p className="text-[9px] text-gray-400">{a.role}</p>
                </div>
                <span className={`ml-auto text-[9px] font-bold px-1.5 py-0.5 rounded ${
                  thinking ? 'bg-amber-50 text-amber-600' : 'bg-emerald-50 text-emerald-600'
                }`}>
                  {thinking ? '⋯ thinking' : '✓ done'}
                </span>
              </div>
              {thinking ? (
                <div className="space-y-1.5 py-1">
                  <div className="h-2 rounded bg-gray-200/80 ai-shimmer w-11/12" />
                  <div className="h-2 rounded bg-gray-200/80 ai-shimmer w-3/4" />
                </div>
              ) : (
                <>
                  <p className="text-[11px] text-gray-600 leading-relaxed ai-fade-up">{a.summary}</p>
                  <div className="flex items-center justify-between mt-2 pt-2 border-t border-gray-50">
                    <span className="text-[9px] font-mono text-gray-400">{a.metrics}</span>
                    {a.contribution != null && (
                      <span className="text-[9px] font-bold text-primary-500"
                            title="Contribution of this agent's factors to the confidence score">
                        {a.contribution}%
                      </span>
                    )}
                  </div>
                </>
              )}
            </div>
          )
        })}
      </div>
    </Card>
  )
}
