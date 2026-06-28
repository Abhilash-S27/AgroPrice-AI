/**
 * AISignalBadge — Phase 3B centralized signal framework.
 *
 * Single source of truth for all AI signal verdicts across:
 *   - Chat responses (AIResponseLayout)
 *   - Market briefing (AIMarketBriefing)
 *   - Executive cards (AIExecutiveSummaryCards)
 *   - Scenario simulation (AISimulationPanel)
 *
 * Usage:
 *   <AISignalBadge verdict="STRONG_BULLISH" size="sm" />
 *   import { SIGNAL_CONFIG, getSignalConfig } from './AISignalBadge'
 */

// ── Master signal config ───────────────────────────────────────────────────────
export const SIGNAL_CONFIG = {
  // Trend
  STRONG_BULLISH: {
    label: 'Strong Rise', icon: '↑↑', group: 'trend',
    text: 'text-emerald-700', bg: 'bg-emerald-50', border: 'border-emerald-200',
    bar: 'bg-emerald-500', dot: 'bg-emerald-500',
  },
  BULLISH: {
    label: 'Rising', icon: '↑', group: 'trend',
    text: 'text-emerald-600', bg: 'bg-emerald-50', border: 'border-emerald-200',
    bar: 'bg-emerald-400', dot: 'bg-emerald-400',
  },
  MILD_BULLISH: {
    label: 'Mild Rise', icon: '↗', group: 'trend',
    text: 'text-green-600', bg: 'bg-green-50', border: 'border-green-200',
    bar: 'bg-green-400', dot: 'bg-green-400',
  },
  NEUTRAL: {
    label: 'Stable', icon: '→', group: 'trend',
    text: 'text-gray-600', bg: 'bg-gray-50', border: 'border-gray-200',
    bar: 'bg-gray-400', dot: 'bg-gray-400',
  },
  MILD_BEARISH: {
    label: 'Mild Drop', icon: '↘', group: 'trend',
    text: 'text-orange-600', bg: 'bg-orange-50', border: 'border-orange-200',
    bar: 'bg-orange-400', dot: 'bg-orange-400',
  },
  BEARISH: {
    label: 'Falling', icon: '↓', group: 'trend',
    text: 'text-red-600', bg: 'bg-red-50', border: 'border-red-200',
    bar: 'bg-red-400', dot: 'bg-red-400',
  },
  STRONG_BEARISH: {
    label: 'Sharp Drop', icon: '↓↓', group: 'trend',
    text: 'text-red-700', bg: 'bg-red-50', border: 'border-red-200',
    bar: 'bg-red-500', dot: 'bg-red-500',
  },
  // Risk
  LOW_RISK: {
    label: 'Low Risk', icon: '●', group: 'risk',
    text: 'text-emerald-700', bg: 'bg-emerald-50', border: 'border-emerald-200',
    bar: 'bg-emerald-400', dot: 'bg-emerald-400',
  },
  MODERATE_RISK: {
    label: 'Moderate', icon: '●', group: 'risk',
    text: 'text-amber-600', bg: 'bg-amber-50', border: 'border-amber-200',
    bar: 'bg-amber-400', dot: 'bg-amber-400',
  },
  HIGH_RISK: {
    label: 'High Risk', icon: '●', group: 'risk',
    text: 'text-orange-600', bg: 'bg-orange-50', border: 'border-orange-200',
    bar: 'bg-orange-400', dot: 'bg-orange-400',
  },
  EXTREME_RISK: {
    label: 'Extreme', icon: '◉', group: 'risk',
    text: 'text-red-700', bg: 'bg-red-50', border: 'border-red-200',
    bar: 'bg-red-500', dot: 'bg-red-500',
  },
  // Seasonal
  DEEP_PEAK: {
    label: 'Deep Peak', icon: '★', group: 'seasonal',
    text: 'text-purple-700', bg: 'bg-purple-50', border: 'border-purple-200',
    bar: 'bg-purple-500', dot: 'bg-purple-500',
  },
  PEAK_SEASON: {
    label: 'Peak Season', icon: '◆', group: 'seasonal',
    text: 'text-amber-600', bg: 'bg-amber-50', border: 'border-amber-200',
    bar: 'bg-amber-400', dot: 'bg-amber-400',
  },
  LEAN_SEASON: {
    label: 'Lean Season', icon: '◇', group: 'seasonal',
    text: 'text-blue-600', bg: 'bg-blue-50', border: 'border-blue-200',
    bar: 'bg-blue-400', dot: 'bg-blue-400',
  },
  DEEP_TROUGH: {
    label: 'Deep Trough', icon: '▽', group: 'seasonal',
    text: 'text-blue-700', bg: 'bg-blue-50', border: 'border-blue-200',
    bar: 'bg-blue-500', dot: 'bg-blue-500',
  },
  NORMAL: {
    label: 'Normal', icon: '○', group: 'seasonal',
    text: 'text-gray-600', bg: 'bg-gray-50', border: 'border-gray-200',
    bar: 'bg-gray-400', dot: 'bg-gray-400',
  },
  // Recommendation
  SELL_NOW: {
    label: 'Sell Now', icon: '✓', group: 'rec',
    text: 'text-emerald-700', bg: 'bg-emerald-50', border: 'border-emerald-200',
    bar: 'bg-emerald-500', dot: 'bg-emerald-500',
  },
  SELL_SOON: {
    label: 'Sell Soon', icon: '✓', group: 'rec',
    text: 'text-green-600', bg: 'bg-green-50', border: 'border-green-200',
    bar: 'bg-green-400', dot: 'bg-green-400',
  },
  HOLD: {
    label: 'Hold', icon: '▶', group: 'rec',
    text: 'text-amber-600', bg: 'bg-amber-50', border: 'border-amber-200',
    bar: 'bg-amber-400', dot: 'bg-amber-400',
  },
  WAIT: {
    label: 'Wait', icon: '◎', group: 'rec',
    text: 'text-orange-600', bg: 'bg-orange-50', border: 'border-orange-200',
    bar: 'bg-orange-400', dot: 'bg-orange-400',
  },
  WATCH: {
    label: 'Watch', icon: '◉', group: 'rec',
    text: 'text-blue-600', bg: 'bg-blue-50', border: 'border-blue-200',
    bar: 'bg-blue-400', dot: 'bg-blue-400',
  },
  UNKNOWN: {
    label: 'Unknown', icon: '?', group: 'unknown',
    text: 'text-gray-400', bg: 'bg-gray-50', border: 'border-gray-200',
    bar: 'bg-gray-300', dot: 'bg-gray-300',
  },
}

const _fallback = SIGNAL_CONFIG.UNKNOWN

/** Get config for a verdict string, with graceful fallback. */
export function getSignalConfig(verdict) {
  return SIGNAL_CONFIG[verdict] ?? _fallback
}

// ── Component ─────────────────────────────────────────────────────────────────

const SIZE_CLASSES = {
  xs:  'text-[9px]  px-1    py-0    gap-0.5',
  sm:  'text-[10px] px-1.5  py-0.5  gap-1',
  md:  'text-xs     px-2    py-1    gap-1',
  lg:  'text-sm     px-2.5  py-1.5  gap-1.5',
}

/**
 * AISignalBadge
 *
 * @param {string} verdict  - Signal key (e.g. "STRONG_BULLISH")
 * @param {'xs'|'sm'|'md'|'lg'} size
 * @param {boolean} showIcon
 * @param {string} className
 */
export default function AISignalBadge({ verdict, size = 'sm', showIcon = true, className = '' }) {
  const cfg  = getSignalConfig(verdict)
  const sz   = SIZE_CLASSES[size] ?? SIZE_CLASSES.sm

  return (
    <span
      className={`inline-flex items-center font-semibold rounded-full border ${cfg.bg} ${cfg.border} ${cfg.text} ${sz} ${className}`}
    >
      {showIcon && <span className="opacity-80">{cfg.icon}</span>}
      {cfg.label}
    </span>
  )
}
