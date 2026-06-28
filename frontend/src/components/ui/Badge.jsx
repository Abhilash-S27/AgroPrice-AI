import clsx from 'clsx'

// ── Base badge ────────────────────────────────────────────────────────────────
const variants = {
  green:  'bg-green-100 text-green-800',
  red:    'bg-red-100 text-red-800',
  yellow: 'bg-yellow-100 text-yellow-800',
  blue:   'bg-blue-100 text-blue-800',
  gray:   'bg-gray-100 text-gray-700',
}

export default function Badge({ children, variant = 'gray', className = '' }) {
  return (
    <span className={clsx(
      'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium',
      variants[variant], className,
    )}>
      {children}
    </span>
  )
}

// ── Trend badge (rising / falling / stable) ───────────────────────────────────
export function TrendBadge({ trend }) {
  const map = {
    rising:  { variant: 'red',    label: 'Rising'  },
    falling: { variant: 'green',  label: 'Falling' },
    stable:  { variant: 'gray',   label: 'Stable'  },
  }
  const { variant, label } = map[trend] ?? map.stable
  return <Badge variant={variant}>{label}</Badge>
}

// ── Volatility badge (stable / moderate / high / extreme) ─────────────────────
const VOL_STYLES = {
  stable:   'bg-emerald-50 text-emerald-700 border border-emerald-200',
  moderate: 'bg-amber-50   text-amber-700   border border-amber-200',
  high:     'bg-orange-50  text-orange-700  border border-orange-200',
  extreme:  'bg-red-50     text-red-700     border border-red-200',
}

export function VolBadge({ level, badge, className = '' }) {
  const style = VOL_STYLES[level] ?? VOL_STYLES.moderate
  const label = badge ?? (level ? level.charAt(0).toUpperCase() + level.slice(1) : '—')
  return (
    <span className={clsx(
      'inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold',
      style, className,
    )}>
      {label}
    </span>
  )
}

// ── Severity badge (low / medium / high) for anomaly alerts ──────────────────
const SEV_STYLES = {
  low:    'bg-yellow-50 text-yellow-700 border border-yellow-200',
  medium: 'bg-orange-50 text-orange-700 border border-orange-200',
  high:   'bg-red-50    text-red-700    border border-red-200',
}
const SEV_DOT = {
  low: 'bg-yellow-400', medium: 'bg-orange-400', high: 'bg-red-500',
}

export function SeverityBadge({ severity, className = '' }) {
  const s = severity?.toLowerCase() ?? 'low'
  return (
    <span className={clsx(
      'inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold',
      SEV_STYLES[s] ?? SEV_STYLES.low, className,
    )}>
      <span className={clsx('w-1.5 h-1.5 rounded-full', SEV_DOT[s] ?? SEV_DOT.low)} />
      {s.charAt(0).toUpperCase() + s.slice(1)}
    </span>
  )
}

// ── Momentum chip (signal + short arrow) ─────────────────────────────────────
const MOM_STYLES = {
  'Strong Uptrend':   'bg-emerald-50 text-emerald-700 border border-emerald-200',
  'Uptrend':          'bg-emerald-50 text-emerald-600 border border-emerald-200',
  'Stable':           'bg-gray-50    text-gray-600    border border-gray-200',
  'Downtrend':        'bg-amber-50   text-amber-700   border border-amber-200',
  'Strong Downtrend': 'bg-red-50     text-red-700     border border-red-200',
}

export function MomentumChip({ signal, score, className = '' }) {
  const style = MOM_STYLES[signal] ?? MOM_STYLES['Stable']
  const arrow = signal?.includes('Up')   ? '↑' :
                signal?.includes('Down') ? '↓' : '→'
  const showDouble = signal?.startsWith('Strong')
  return (
    <span className={clsx(
      'inline-flex items-center gap-0.5 px-2 py-0.5 rounded text-xs font-semibold',
      style, className,
    )}>
      {showDouble ? `${arrow}${arrow}` : arrow}
      {score != null && (
        <span className="ml-0.5">{score > 0 ? '+' : ''}{Number(score).toFixed(1)}%</span>
      )}
    </span>
  )
}

// ── Reliability badge (Excellent / Good / Moderate / Low Confidence) ──────────
const REL_STYLES = {
  'Excellent':      'bg-emerald-50 text-emerald-700 border border-emerald-200',
  'Good':           'bg-blue-50    text-blue-700    border border-blue-200',
  'Moderate':       'bg-amber-50   text-amber-700   border border-amber-200',
  'Low Confidence': 'bg-red-50     text-red-700     border border-red-200',
}
const REL_ICONS = {
  'Excellent': '★★★', 'Good': '★★', 'Moderate': '★', 'Low Confidence': '○',
}

export function ReliabilityBadge({ reliability, score, className = '' }) {
  const style = REL_STYLES[reliability] ?? REL_STYLES['Moderate']
  const icon  = REL_ICONS[reliability]  ?? '○'
  return (
    <span className={clsx(
      'inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold',
      style, className,
    )}>
      <span className="opacity-70 tracking-tighter">{icon}</span>
      {reliability}
      {score != null && <span className="opacity-60">· {score}</span>}
    </span>
  )
}

// ── Seasonal phase chip ───────────────────────────────────────────────────────
const PHASE_STYLES = {
  peak:   'bg-amber-50   text-amber-700   border border-amber-200',
  trough: 'bg-blue-50    text-blue-700    border border-blue-200',
  normal: 'bg-gray-50    text-gray-600    border border-gray-200',
}
const PHASE_ICONS = { peak: '▲', trough: '▼', normal: '◆' }

export function SeasonalPhaseBadge({ phase, vsNorm, className = '' }) {
  const style = PHASE_STYLES[phase] ?? PHASE_STYLES.normal
  const icon  = PHASE_ICONS[phase]  ?? '◆'
  const label = phase === 'peak' ? 'Peak Season' : phase === 'trough' ? 'Trough Season' : 'Normal Season'
  return (
    <span className={clsx(
      'inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold',
      style, className,
    )}>
      {icon} {label}
      {vsNorm != null && (
        <span className="opacity-60">{vsNorm > 0 ? ' +' : ' '}{vsNorm}%</span>
      )}
    </span>
  )
}

// ── Forecast readiness badge ──────────────────────────────────────────────────
// Phase 4B levels: forecast / limited / analytics / sparse / experimental
// Phase 4  levels: tier1 / tier2 — kept as aliases for backward compat
const READINESS_STYLES = {
  // ── Phase 4B ────────────────────────────────────────────────────────────────
  forecast:     'bg-emerald-50 text-emerald-700 border border-emerald-200',
  limited:      'bg-teal-50    text-teal-700    border border-teal-200',
  analytics:    'bg-blue-50    text-blue-700    border border-blue-200',
  sparse:       'bg-amber-50   text-amber-700   border border-amber-200',
  experimental: 'bg-gray-50    text-gray-500    border border-gray-200',
  // ── Phase 4 aliases ─────────────────────────────────────────────────────────
  tier1:        'bg-emerald-50 text-emerald-700 border border-emerald-200',
  tier2:        'bg-blue-50    text-blue-700    border border-blue-200',
}
const READINESS_ICONS = {
  forecast: '◈', limited: '◑', analytics: '◇',
  sparse: '△', experimental: '○',
  tier1: '◈', tier2: '◇',
}

export function ReadinessBadge({ readiness, level, className = '' }) {
  const style = READINESS_STYLES[level] ?? READINESS_STYLES.experimental
  const icon  = READINESS_ICONS[level]  ?? '○'
  return (
    <span className={clsx(
      'inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold',
      style, className,
    )}>
      <span>{icon}</span>
      {readiness}
    </span>
  )
}

// ── Forecast tier badge (Phase 1: Tier A/B/C/D) ──────────────────────────────
const TIER_STYLES = {
  A: 'bg-emerald-50 text-emerald-700 border border-emerald-200',
  B: 'bg-teal-50    text-teal-700    border border-teal-200',
  C: 'bg-amber-50   text-amber-700   border border-amber-200',
  D: 'bg-blue-50    text-blue-700    border border-blue-200',
}
const TIER_ICONS  = { A: '◈', B: '◑', C: '◔', D: '◇' }
const TIER_LABELS = {
  A: 'Full Forecast', B: 'Moderate Forecast',
  C: 'Sparse Trend',  D: 'Analytics Only',
}

export function TierBadge({ tier, className = '' }) {
  const style = TIER_STYLES[tier] ?? TIER_STYLES.D
  return (
    <span className={clsx(
      'inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold',
      style, className,
    )}>
      <span>{TIER_ICONS[tier] ?? '◇'}</span>
      {TIER_LABELS[tier] ?? 'Analytics Only'}
      <span className="opacity-60">· Tier {tier ?? 'D'}</span>
    </span>
  )
}
