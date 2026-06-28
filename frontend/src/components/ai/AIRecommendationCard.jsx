/**
 * AIRecommendationCard — actionable recommendation badge + confidence.
 * Phase 2B.
 */
const VERDICT_CONFIG = {
  SELL_NOW:  { label: 'SELL NOW',  bg: 'bg-emerald-600', text: 'text-white', ring: 'ring-emerald-300', icon: '✅' },
  SELL_SOON: { label: 'SELL SOON', bg: 'bg-green-500',   text: 'text-white', ring: 'ring-green-300',   icon: '📤' },
  HOLD:      { label: 'HOLD',      bg: 'bg-amber-500',   text: 'text-white', ring: 'ring-amber-300',   icon: '⏸️' },
  WAIT:      { label: 'WAIT',      bg: 'bg-orange-500',  text: 'text-white', ring: 'ring-orange-300',  icon: '⏳' },
  WATCH:     { label: 'WATCH',     bg: 'bg-blue-500',    text: 'text-white', ring: 'ring-blue-300',    icon: '👀' },
  UNKNOWN:   { label: 'HOLD',      bg: 'bg-gray-400',    text: 'text-white', ring: 'ring-gray-200',    icon: '—' },
}

const CONFIDENCE_STYLE = {
  high:         'text-emerald-600',
  moderate:     'text-amber-600',
  'moderate-high': 'text-green-600',
  low:          'text-orange-600',
  none:         'text-gray-400',
}

export default function AIRecommendationCard({ recommendation, className = '' }) {
  if (!recommendation) return null

  const details = recommendation.details || {}
  const verdict = recommendation.verdict || 'UNKNOWN'
  const cfg     = VERDICT_CONFIG[verdict] || VERDICT_CONFIG.UNKNOWN
  const conf    = (details.confidence || 'moderate').split(' ')[0]
  const confCls = CONFIDENCE_STYLE[conf] || 'text-gray-500'
  const opp     = recommendation.score ?? 0.5

  return (
    <div className={`p-4 rounded-xl border border-gray-100 bg-white shadow-sm ${className}`}>
      <div className="flex items-start gap-3">
        {/* Verdict badge */}
        <div className={`flex flex-col items-center justify-center w-16 h-16 rounded-xl ${cfg.bg} ring-4 ${cfg.ring} shrink-0`}>
          <span className="text-lg leading-none mb-0.5">{cfg.icon}</span>
          <span className={`text-[9px] font-black tracking-wide ${cfg.text}`}>{cfg.label}</span>
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <p className="text-sm font-bold text-gray-900">AI Recommendation</p>
            <span className={`text-[9px] font-medium ${confCls}`}>
              {conf.charAt(0).toUpperCase() + conf.slice(1)} confidence
            </span>
          </div>

          {/* Opportunity score bar */}
          <div className="mb-2">
            <div className="flex justify-between text-[9px] text-gray-400 mb-0.5">
              <span>Opportunity score</span>
              <span className="font-semibold text-gray-600">{Math.round(opp * 100)}/100</span>
            </div>
            <div className="h-1.5 rounded-full bg-gray-100 overflow-hidden">
              <div
                className={`h-full rounded-full ${cfg.bg}`}
                style={{ width: `${Math.round(opp * 100)}%` }}
              />
            </div>
          </div>

          <p className="text-xs text-gray-600 leading-relaxed">{details.advice}</p>
        </div>
      </div>

      {/* Signal pills */}
      {recommendation.signals?.length > 0 && (
        <div className="mt-3 pt-3 border-t border-gray-50 flex flex-wrap gap-1">
          {recommendation.signals.slice(0, 2).map((s, i) => (
            <span key={i} className="text-[10px] text-gray-500 bg-gray-50 border border-gray-100 rounded-full px-2 py-0.5 leading-snug">
              {s.length > 60 ? s.slice(0, 58) + '…' : s}
            </span>
          ))}
        </div>
      )}
    </div>
  )
}
