import { memo } from 'react'

/**
 * Smart AI insight cards — compact, metric-derived signal cards
 * ("High Volatility Detected", "Seasonal Recovery Underway", …).
 * Data: /api/ai/insights → insight_cards (rule-generated, never canned).
 */

const TONE_STYLES = {
  positive: 'border-emerald-200 bg-emerald-50',
  caution:  'border-amber-200  bg-amber-50',
  risk:     'border-red-200    bg-red-50',
  info:     'border-blue-200   bg-blue-50',
}
const TONE_BAR = {
  positive: 'bg-emerald-400',
  caution:  'bg-amber-400',
  risk:     'bg-red-400',
  info:     'bg-blue-400',
}

function SmartInsightCards({ cards = [] }) {
  if (!cards.length) return null
  return (
    <section className="ai-fade-up">
      <div className="flex items-center gap-2 mb-3">
        <h2 className="text-xs font-bold text-gray-500 uppercase tracking-widest">
          AI Market Signals
        </h2>
        <span className="text-[10px] bg-primary-50 text-primary-600 border border-primary-100 px-2 py-0.5 rounded-full font-semibold">
          ✦ generated from live metrics
        </span>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
        {cards.map(c => (
          <div key={c.key}
            className={`rounded-xl border p-3.5 flex flex-col ${TONE_STYLES[c.tone] ?? TONE_STYLES.info}`}>
            <div className="flex items-center gap-2 mb-1.5">
              <span className="text-base">{c.icon}</span>
              <p className="text-xs font-bold text-gray-800 leading-tight">{c.title}</p>
            </div>
            <p className="text-[11px] text-gray-600 leading-relaxed flex-1">{c.explanation}</p>
            {/* visual confidence indicator */}
            <div className="mt-2.5 flex items-center gap-2">
              <div className="flex-1 h-1 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.12)' }}>
                <div className={`h-full rounded-full ${TONE_BAR[c.tone] ?? TONE_BAR.info}`}
                     style={{ width: `${c.confidence}%` }} />
              </div>
              <span className="text-[9px] font-bold text-gray-400">{c.confidence}%</span>
            </div>
          </div>
        ))}
      </div>
    </section>
  )
}

export default memo(SmartInsightCards)
