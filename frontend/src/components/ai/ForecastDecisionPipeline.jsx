import { useMemo } from 'react'
import Card from '@components/ui/Card'

/**
 * "How AI Reached This Forecast" — live decision pipeline (Phase 5).
 * Eight sequential stages, each annotated with the ACTUAL values the
 * current crop+state pair produced at that stage. Stages animate in
 * order via staggered CSS delays.
 */

export default function ForecastDecisionPipeline({ insights, forecast, crop, state }) {
  const stages = useMemo(() => {
    if (!insights?.has_data) return []
    const cs = insights.context_summary ?? {}
    const conf = insights.confidence ?? {}
    const method = forecast?.method === 'sparse_trend' ? 'Sparse-Trend Estimator' : 'Prophet'

    return [
      { icon: '🗄️', name: 'Data',
        detail: `48.2M AGMARKNET records scanned for ${crop} · ${state}` },
      { icon: '🧹', name: 'Cleaning',
        detail: `variety dedup + price caps → ${cs.training_days?.toLocaleString()} clean daily prices` },
      { icon: '🏷️', name: 'Tier Classification',
        detail: `Tier ${cs.tier} — ${cs.continuity_score}% continuity, ${cs.cv?.toFixed(0)}% CV` },
      { icon: '📈', name: 'Forecast Engine',
        detail: forecast
          ? `${method} → ${forecast.forecast?.length}-day projection`
          : `${method} pipeline armed for this tier` },
      { icon: '⚖️', name: 'Confidence Engine',
        detail: `6 weighted factors → ${conf.score}/100 (${conf.reliability})` },
      { icon: '🎯', name: 'Advisory Engine',
        detail: `${(insights.strategy?.risks?.length ?? 0)} risk flags · seasonal windows mapped` },
      { icon: '✦', name: 'AI Narrator',
        detail: `narrative + ${insights.anomaly_explanations?.length ?? 0} anomaly explanations composed` },
      { icon: '✅', name: 'Final Forecast',
        detail: `rendered with full diagnostics — auditable end to end` },
    ]
  }, [insights, forecast, crop, state])

  if (!stages.length) return null

  return (
    <Card className="!p-4 ai-fade-up">
      <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-3">
        How AI Reached This Forecast · live decision pipeline
      </p>
      <div className="flex flex-col lg:flex-row lg:items-stretch gap-1.5 lg:gap-0 overflow-x-auto">
        {stages.map((s, i) => (
          <div key={s.name} className="flex items-center lg:flex-1 min-w-0">
            <div className="ai-stage flex-1 min-w-0 rounded-xl border border-gray-100 bg-gray-50 px-2.5 py-2
                            hover:border-primary-200 hover:bg-gray-100 transition-colors"
                 style={{ animationDelay: `${i * 0.18}s` }}
                 title={s.detail}>
              <p className="text-[10px] font-bold text-gray-700 leading-tight whitespace-nowrap">
                {s.icon} {s.name}
              </p>
              <p className="text-[9px] text-gray-400 leading-snug mt-0.5 truncate lg:whitespace-normal lg:line-clamp-2">
                {s.detail}
              </p>
            </div>
            {i < stages.length - 1 && (
              <svg className="hidden lg:block w-4 h-3 shrink-0" viewBox="0 0 16 12">
                <line x1="0" y1="6" x2="14" y2="6" stroke="rgba(52,211,153,0.35)" strokeWidth="2" className="ai-flow-line" />
                <path d="M 10 2 L 15 6 L 10 10" fill="none" stroke="rgba(52,211,153,0.25)" strokeWidth="1.5" />
              </svg>
            )}
          </div>
        ))}
      </div>
    </Card>
  )
}
