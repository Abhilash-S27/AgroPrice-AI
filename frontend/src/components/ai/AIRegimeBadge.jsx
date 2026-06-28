/**
 * AIRegimeBadge — Phase 4B
 * Reusable regime indicator chip. Centralised single source of truth for
 * all 7 market regimes. Used by AIAutonomousMonitor and AIWatchlist.
 */
import { memo } from 'react'

export const REGIME_CFG = {
  BULLISH_EXPANSION:   { bg: 'bg-emerald-50', border: 'border-emerald-200', text: 'text-emerald-700', dot: 'bg-emerald-400' },
  STABLE:              { bg: 'bg-blue-50',    border: 'border-blue-200',    text: 'text-blue-700',    dot: 'bg-blue-400'    },
  PANIC_VOLATILITY:    { bg: 'bg-red-50',     border: 'border-red-200',     text: 'text-red-700',     dot: 'bg-red-400'     },
  SEASONAL_CORRECTION: { bg: 'bg-amber-50',   border: 'border-amber-200',   text: 'text-amber-700',   dot: 'bg-amber-400'   },
  RECOVERY_PHASE:      { bg: 'bg-teal-50',    border: 'border-teal-200',    text: 'text-teal-700',    dot: 'bg-teal-400'    },
  SEASONAL_PEAK_RUN:   { bg: 'bg-purple-50',  border: 'border-purple-200',  text: 'text-purple-700',  dot: 'bg-purple-400'  },
  TRANSITIONAL:        { bg: 'bg-gray-50',    border: 'border-gray-200',    text: 'text-gray-600',    dot: 'bg-gray-300'    },
}

const PRIORITY_CFG = {
  CRITICAL:       { bg: 'bg-red-50',   border: 'border-red-200',   text: 'text-red-700',   icon: '🔴' },
  HIGH_ATTENTION: { bg: 'bg-amber-50', border: 'border-amber-200', text: 'text-amber-700', icon: '🟠' },
  WATCH:          { bg: 'bg-blue-50',  border: 'border-blue-200',  text: 'text-blue-700',  icon: '🔵' },
  STABLE:         { bg: 'bg-gray-50',  border: 'border-gray-200',  text: 'text-gray-500',  icon: '⚪' },
}

export const getRegimeCfg = (name) =>
  REGIME_CFG[name] ?? REGIME_CFG.TRANSITIONAL

export const getPriorityCfg = (level) =>
  PRIORITY_CFG[level] ?? PRIORITY_CFG.STABLE

/**
 * @param {string}  regime_name    — machine-readable key from backend
 * @param {string}  regime_label   — human-readable label
 * @param {string}  regime_icon    — emoji
 * @param {'xs'|'sm'|'md'} size
 */
export const AIRegimeBadge = memo(function AIRegimeBadge({
  regime_name,
  regime_label,
  regime_icon,
  size = 'sm',
}) {
  const c = getRegimeCfg(regime_name)
  const textSize = size === 'xs' ? 'text-[9px]' : size === 'sm' ? 'text-[10px]' : 'text-xs'
  const px       = size === 'xs' ? 'px-1 py-0.5' : 'px-1.5 py-0.5'

  return (
    <span className={`
      inline-flex items-center gap-1 ${px} rounded-full border
      ${c.bg} ${c.border} ${c.text} ${textSize} font-semibold whitespace-nowrap shrink-0
    `}>
      <span className="leading-none">{regime_icon}</span>
      {regime_label}
    </span>
  )
})

/**
 * @param {string} level   — CRITICAL | HIGH_ATTENTION | WATCH | STABLE
 * @param {'xs'|'sm'|'md'} size
 */
export const AIPriorityBadge = memo(function AIPriorityBadge({ level, size = 'sm' }) {
  const c = getPriorityCfg(level)
  const textSize = size === 'xs' ? 'text-[9px]' : 'text-[10px]'
  const px       = size === 'xs' ? 'px-1 py-0.5' : 'px-1.5 py-0.5'

  return (
    <span className={`
      inline-flex items-center gap-0.5 ${px} rounded-full border
      ${c.bg} ${c.border} ${c.text} ${textSize} font-bold whitespace-nowrap shrink-0
    `}>
      {c.icon} {level.replace('_', ' ')}
    </span>
  )
})

export default AIRegimeBadge
