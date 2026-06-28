/**
 * AIMemoryTimeline — Phase 3B Step 9.
 *
 * Compact visualization of the session's conversational context.
 * Shows what the AI remembers: crop, state, and topic chips from conversation.
 *
 * Props:
 *   crop         — currently selected crop
 *   state        — currently selected state
 *   messages     — message array for topic extraction
 *   onClearCrop  — callback to clear crop selection
 *   onClearState — callback to clear state selection
 */

import { useMemo, memo } from 'react'

const INTENT_TOPIC = {
  price_now:        'Price check',
  trend:            'Price forecast',
  volatility:       'Volatility analysis',
  seasonal:         'Seasonal patterns',
  anomaly:          'Anomaly detection',
  compare:          'Crop comparison',
  adv_safest:       'Safety advisory',
  adv_momentum:     'Momentum analysis',
  profitability:    'Profitability',
  storage:          'Storage strategy',
  sell_window:      'Sell window',
  historical_price: 'Historical prices',
  yearly_comparison:'Year comparison',
  all_time_peak:    'All-time peak',
  trend_analysis:   'Long-term trend',
  seasonal_history: 'Seasonal history',
}

const Chip = memo(function Chip({ label, icon, onRemove, color = 'gray' }) {
  const COLORS = {
    primary: 'bg-primary-50 border-primary-200 text-primary-700',
    emerald: 'bg-emerald-50 border-emerald-200 text-emerald-700',
    blue:    'bg-blue-50    border-blue-200    text-blue-700',
    gray:    'bg-gray-100   border-gray-200    text-gray-600',
  }
  return (
    <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full border text-[9px] font-medium ${COLORS[color] ?? COLORS.gray}`}>
      {icon && <span className="opacity-70">{icon}</span>}
      {label}
      {onRemove && (
        <button
          onClick={onRemove}
          className="ml-0.5 opacity-50 hover:opacity-100 transition-opacity text-[8px] leading-none"
          title="Remove"
        >
          ×
        </button>
      )}
    </span>
  )
})

const AIMemoryTimeline = memo(function AIMemoryTimeline({
  crop,
  state,
  messages = [],
  onClearCrop,
  onClearState,
}) {
  // Extract unique intents from AI messages to show conversation topics
  const topics = useMemo(() => {
    const seen = new Set()
    const result = []
    for (const msg of messages) {
      if (msg.role !== 'ai' || !msg.intent) continue
      const label = INTENT_TOPIC[msg.intent]
      if (label && !seen.has(label)) {
        seen.add(label)
        result.push(label)
      }
    }
    return result.slice(0, 4)  // cap at 4 topics
  }, [messages])

  const hasContext = crop || state || topics.length > 0
  if (!hasContext) return null

  return (
    <div className="flex flex-wrap items-center gap-1 px-3 py-1.5 bg-gray-50/80 border-b border-gray-100">
      <span className="text-[8px] font-bold text-gray-400 uppercase tracking-wide mr-0.5 shrink-0">
        Context:
      </span>

      {crop && (
        <Chip
          label={crop}
          icon="🌱"
          color="emerald"
          onRemove={onClearCrop}
        />
      )}

      {state && (
        <Chip
          label={state}
          icon="📍"
          color="blue"
          onRemove={onClearState}
        />
      )}

      {topics.map(topic => (
        <Chip key={topic} label={topic} color="gray" />
      ))}
    </div>
  )
})

export default AIMemoryTimeline
