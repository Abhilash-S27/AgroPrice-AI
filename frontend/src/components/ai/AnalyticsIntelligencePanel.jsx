import Card from '@components/ui/Card'
import { TierBadge } from '@components/ui/Badge'
import { formatPrice } from '@utils/formatters'

/**
 * Mode D — Analytics-Only Intelligence Panel.
 *
 * Shown when the selected crop+STATE pair cannot support forecasting.
 * Replaces the forecast copilot with honest regional intelligence from
 * /api/ai/insights → regional: why disabled, real observations about
 * nearby valid markets, and smart fallback actions.
 */
export default function AnalyticsIntelligencePanel({
  crop, state, regional, onSwitchState, onAskAI, onSwitchCrop,
}) {
  if (!regional) return null

  return (
    <Card className="!p-0 overflow-hidden ai-fade-up">
      <div className="px-5 pt-4 pb-3 border-b border-gray-100 flex items-center gap-2.5">
        <div className="w-8 h-8 rounded-xl bg-blue-600 text-white flex items-center justify-center text-base shrink-0">
          ◇
        </div>
        <div>
          <p className="text-sm font-bold text-gray-900 leading-tight">
            Regional Market Intelligence
          </p>
          <p className="text-[11px] text-gray-400">
            analytics-only mode · {crop} · {state}
          </p>
        </div>
      </div>

      <div className="p-5 space-y-4">
        {/* AI analyst summary */}
        {regional.ai_summary && (
          <div>
            <div className="flex items-center gap-2 mb-1.5">
              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">
                AI Summary
              </p>
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px]
                               font-bold text-primary-700 border border-primary-200 ai-shimmer">
                <span className="w-1 h-1 rounded-full bg-primary-500 ai-pulse" />
                generated from live analytics
              </span>
            </div>
            <p className="text-sm text-gray-700 leading-relaxed">{regional.ai_summary}</p>
          </div>
        )}

        {/* why forecasting is disabled */}
        <div className="flex items-start gap-2.5 px-3.5 py-3 bg-blue-50 border border-blue-100 rounded-xl">
          <span className="text-blue-500 mt-0.5 shrink-0">ℹ</span>
          <p className="text-xs text-blue-900 leading-relaxed">{regional.why_disabled}</p>
        </div>

        {/* real observations */}
        {regional.observations?.length > 0 && (
          <div>
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2">
              What the data does show
            </p>
            <ul className="space-y-1.5">
              {regional.observations.map((o, i) => (
                <li key={i} className="flex items-start gap-2 text-xs leading-relaxed text-gray-700">
                  <span className="text-blue-400 mt-0.5 shrink-0">•</span>
                  {o}
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* per-state availability strip */}
        {regional.availability?.length > 0 && (
          <div>
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2">
              {crop} data by state
            </p>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2.5">
              {regional.availability.map(a => (
                <div key={a.state}
                  className={`rounded-xl border p-3 ${
                    a.state === state
                      ? 'border-blue-200 bg-blue-50'
                      : 'border-gray-100 bg-white'
                  }`}>
                  <p className="text-xs font-bold text-gray-800 mb-1">{a.state}</p>
                  <TierBadge tier={a.tier} className="mb-1.5" />
                  <div className="text-[10px] text-gray-400 space-y-0.5 mt-1">
                    <p>{a.training_days.toLocaleString()} days · {a.continuity_score}% recent</p>
                    {a.avg_30d != null && <p>{formatPrice(a.avg_30d)}/qtl · 30d avg</p>}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* similar crops that DO forecast well in this state */}
        {regional.alternatives?.length > 0 && (
          <div>
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2">
              Similar crops with strong {state} data
            </p>
            <div className="flex flex-wrap gap-2">
              {regional.alternatives.map(a => (
                <button key={a.crop}
                  onClick={() => onSwitchCrop?.(a.crop)}
                  title={`${a.continuity_score}% continuity · ${a.cv.toFixed(0)}% CV — click to view`}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-[11px]
                             font-semibold text-gray-700 bg-white border border-gray-200
                             hover:border-primary-300 hover:text-primary-700 transition-colors">
                  {a.crop}
                  <span className={`text-[9px] px-1 py-0.5 rounded font-bold ${
                    a.tier === 'A' ? 'bg-emerald-50 text-emerald-600' : 'bg-teal-50 text-teal-600'
                  }`}>Tier {a.tier}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* smart fallback actions */}
        {regional.actions?.length > 0 && (
          <div className="flex flex-wrap gap-2 pt-1">
            {regional.actions.map((a, i) =>
              a.type === 'switch_state' ? (
                <button key={i}
                  onClick={() => onSwitchState?.(a.state)}
                  className="px-3 py-1.5 rounded-xl text-xs font-semibold bg-primary-600 text-white
                             hover:bg-primary-700 transition-colors">
                  → {a.label}
                </button>
              ) : (
                <button key={i}
                  onClick={() => onAskAI?.(a.prompt)}
                  className="px-3 py-1.5 rounded-xl text-xs font-semibold text-primary-700 bg-primary-50
                             border border-primary-200 hover:bg-primary-100 transition-colors">
                  ✦ {a.label}
                </button>
              )
            )}
          </div>
        )}

        <p className="text-[10px] text-gray-300">{regional.footer}</p>
      </div>
    </Card>
  )
}
