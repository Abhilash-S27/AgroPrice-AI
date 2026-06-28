/**
 * AIAnalystModeSelector — Phase 3B Step 11 scaffold.
 *
 * Analyst presentation mode selector — adjusts the prompt framing
 * sent to Gemini via the view_mode field in AdvisorRequest.
 *
 * Modes:
 *   farmer    — practical crop selling advice, simple language
 *   trader    — price spread, margins, market timing
 *   wholesale — bulk volumes, supply chain context
 *   analyst   — technical signals, data-heavy, formal tone
 *
 * Note: Full mode-specific prompt routing is a Phase 4 task.
 * This scaffold wires the UI and passes view_mode to the backend.
 */

import { memo } from 'react'

export const ANALYST_MODES = [
  {
    key:   'farmer',
    label: 'Farmer',
    icon:  '🌾',
    desc:  'Practical selling advice in plain language',
  },
  {
    key:   'trader',
    label: 'Trader',
    icon:  '📊',
    desc:  'Price spreads, timing, market momentum',
  },
  {
    key:   'wholesale',
    label: 'Wholesale',
    icon:  '🏪',
    desc:  'Bulk supply, mandi prices, logistics',
  },
  {
    key:   'analyst',
    label: 'Analyst',
    icon:  '🔬',
    desc:  'Technical signals, volatility, data-heavy',
  },
]

const AIAnalystModeSelector = memo(function AIAnalystModeSelector({
  value,
  onChange,
  className = '',
}) {
  return (
    <div className={`${className}`}>
      <p className="text-[8px] font-bold text-gray-400 uppercase tracking-wide mb-1.5">
        View Mode
      </p>
      <div className="flex gap-1 flex-wrap">
        {ANALYST_MODES.map(mode => {
          const active = value === mode.key
          return (
            <button
              key={mode.key}
              onClick={() => onChange(active ? null : mode.key)}
              title={mode.desc}
              className={`flex items-center gap-1 px-2 py-1 rounded-lg border text-[10px] font-medium transition-all ${
                active
                  ? 'bg-primary-600 text-white border-primary-600 shadow-sm'
                  : 'bg-white text-gray-600 border-gray-200 hover:border-primary-300 hover:text-primary-600'
              }`}
            >
              <span className="text-[11px]">{mode.icon}</span>
              {mode.label}
            </button>
          )
        })}
      </div>
    </div>
  )
})

export default AIAnalystModeSelector
