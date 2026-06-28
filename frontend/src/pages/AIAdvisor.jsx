/**
 * AIAdvisor — Phase 3D Enterprise Command Center & Responsive Intelligence Grid.
 *
 * 7-zone layout:
 *   Zone 1 — Executive Strip        (header, density controls, immersive toggle)
 *   Zone 2 — Critical Alerts        (anomaly DashPanel, priority=critical)
 *   Zone 3 — Live AI Workspace      (intelligence rail + AdvisorChat)
 *   Zone 4 — Strategic Intelligence (KPI 2.0 row + strategic insights)
 *   Zone 5 — Simulation Lab         (market briefing / scenario / recent changes)
 *   Zone 6 — Deep Analysis          (momentum / volatility / seasonal)
 *   Zone 7 — Historical Archive     (cross-crop table / forecast quality)
 *
 * Zones 4-7 collapse in Immersive Mode, leaving a clean AI terminal.
 * Density management (compact / balanced / expanded) adjusts spacing system-wide.
 */

import { useState, useMemo, memo, useCallback } from 'react'
import AdvisorChat from '@components/ai/AdvisorChat'
import AIMarketBriefing from '@components/ai/AIMarketBriefing'
import AISimulationPanel from '@components/ai/AISimulationPanel'
import RecentMarketChanges from '@components/ai/RecentMarketChanges'
import AIWatchlist from '@components/ai/AIWatchlist'
import AIAutonomousMonitor from '@components/ai/AIAutonomousMonitor'
import AICommandMode from '@components/ai/AICommandMode'
import { useAnalytics } from '@hooks/useAnalytics'
import { useCrossAnalytics } from '@hooks/useCrossAnalytics'
import DashPanel from '@components/ui/DashPanel'
import { PageLoader, Spinner } from '@components/ui/Loader'
import {
  SeverityBadge, VolBadge, MomentumChip,
  ReliabilityBadge, SeasonalPhaseBadge, ReadinessBadge,
} from '@components/ui/Badge'
import { formatPrice } from '@utils/formatters'
import { TIER1_CROPS, TIER2_CROPS, SOUTH_INDIAN_STATES, PHASE4_ALL_CROPS, cropEmoji, cropShortName } from '@utils/constants'
import AICouncilPanel from '@components/ai/AICouncilPanel'
import AIProbabilityPanel from '@components/ai/AIProbabilityPanel'
import AIRelationshipMap from '@components/ai/AIRelationshipMap'
import AIStrategyPanel from '@components/ai/AIStrategyPanel'
import AIExecutiveSynthesis from '@components/ai/AIExecutiveSynthesis'
import AIOpportunityMatrix from '@components/ai/AIOpportunityMatrix'
import AIDecisionTrace from '@components/ai/AIDecisionTrace'

// ── Density management ────────────────────────────────────────────────────────

const DENSITY_GAP = { compact: 'gap-2', balanced: 'gap-4', expanded: 'gap-6' }
const DENSITY_LABELS = [
  { key: 'compact',  icon: '▪', title: 'Compact — maximum information density' },
  { key: 'balanced', icon: '▣', title: 'Balanced — default spacing' },
  { key: 'expanded', icon: '□', title: 'Expanded — more whitespace' },
]

function DensityToggle({ value, onChange }) {
  return (
    <div className="flex items-center bg-gray-100 rounded-lg p-0.5 gap-0.5">
      {DENSITY_LABELS.map(({ key, icon, title }) => (
        <button
          key={key}
          onClick={() => onChange(key)}
          title={title}
          className={`px-2 py-0.5 rounded-md text-[9px] font-bold transition-all duration-150 ${
            value === key
              ? 'bg-white text-gray-800 shadow-sm'
              : 'text-gray-400 hover:text-gray-600'
          }`}
        >
          {icon}
        </button>
      ))}
    </div>
  )
}

// ── Zone divider ──────────────────────────────────────────────────────────────

const ZoneLabel = memo(function ZoneLabel({ label }) {
  return (
    <div className="flex items-center gap-3">
      <div className="flex-1 h-px" style={{ background: 'rgba(56,189,248,0.18)' }} />
      <span className="text-[8px] font-black uppercase tracking-widest shrink-0 select-none" style={{ color: 'rgba(56,189,248,0.55)' }}>
        {label}
      </span>
      <div className="flex-1 h-px" style={{ background: 'rgba(56,189,248,0.18)' }} />
    </div>
  )
})

// ── Section divider ───────────────────────────────────────────────────────────

const SectionDivider = memo(function SectionDivider({ label }) {
  return (
    <div className="flex items-center gap-3 pt-1">
      <div className="flex-1 h-px" style={{ background: 'rgba(255,255,255,0.08)' }} />
      <span className="text-[9px] font-bold uppercase tracking-widest shrink-0" style={{ color: 'rgba(255,255,255,0.22)' }}>{label}</span>
      <div className="flex-1 h-px" style={{ background: 'rgba(255,255,255,0.08)' }} />
    </div>
  )
})

// ── Label ─────────────────────────────────────────────────────────────────────

const Label = ({ children, className = '' }) => (
  <p className={`text-[9px] font-bold uppercase tracking-widest text-gray-400 ${className}`}>{children}</p>
)

// ── Intelligence Rail (Zone 3 header) ─────────────────────────────────────────

const IntelligenceRail = memo(function IntelligenceRail({
  topGainer, topLoser, highVol, criticalAnomaly, immersive = false,
}) {
  if (!topGainer && !highVol) return null

  const wrap  = immersive
    ? 'rounded-xl'
    : 'rounded-xl'
  const wrapStyle = {
    background: immersive
      ? 'rgba(3,5,14,0.94)'
      : 'linear-gradient(135deg, rgba(12,16,28,0.65) 0%, rgba(8,12,22,0.75) 100%)',
    border: immersive
      ? '1px solid rgba(255,255,255,0.08)'
      : '1px solid rgba(52,211,153,0.22)',
  }
  const label = 'text-[8px] font-black uppercase tracking-widest shrink-0'
  const labelStyle = { color: immersive ? 'rgba(255,255,255,0.28)' : 'rgba(52,211,153,0.65)' }
  const div   = immersive ? 'bg-white/10' : 'bg-white/[0.08]'

  return (
    <div className={`flex items-center gap-2 px-4 py-2 overflow-x-auto mb-3 ${wrap}`}
         style={{ scrollbarWidth: 'none', ...wrapStyle }}>
      <span className={label} style={labelStyle}>
        Live
      </span>
      <div className={`w-px h-3 shrink-0 ${div}`} />

      {topGainer && (
        <span className="flex items-center gap-1.5 px-2 py-1 rounded-lg border shrink-0 text-[10px] font-semibold"
          style={{ background: 'rgba(16,185,129,0.14)', borderColor: 'rgba(52,211,153,0.32)', color: 'rgba(52,211,153,0.95)' }}>
          {cropEmoji(topGainer.crop)} {topGainer.crop}
          <span className="font-black ml-0.5" style={{ color: topGainer.score > 0 ? 'rgba(52,211,153,1)' : 'rgba(252,165,165,1)' }}>
            {topGainer.score > 0 ? '↑' : '↓'} {Math.abs(topGainer.score ?? 0).toFixed(1)}%
          </span>
        </span>
      )}

      {highVol && highVol.cv > 25 && (
        <span className="flex items-center gap-1.5 px-2 py-1 rounded-lg border shrink-0 text-[10px] font-semibold"
          style={{ background: 'rgba(120,53,15,0.30)', borderColor: 'rgba(120,53,15,0.50)', color: 'rgba(251,191,36,0.88)' }}>
          ⚡ {highVol.crop}
          <span className="font-black ml-0.5">CV {highVol.cv}%</span>
        </span>
      )}

      {criticalAnomaly && (
        <span className="flex items-center gap-1.5 px-2 py-1 rounded-lg border shrink-0 text-[10px] font-bold animate-pulse"
          style={{ background: 'rgba(127,29,29,0.35)', borderColor: 'rgba(127,29,29,0.55)', color: 'rgba(252,165,165,0.90)' }}>
          🔴 Alert Active
        </span>
      )}

      <div className="ml-auto flex items-center gap-1.5 shrink-0">
        <span className="relative flex h-2 w-2 shrink-0">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-50" />
          <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
        </span>
        <span className="text-[8px] font-medium tracking-wide" style={{ color: 'rgba(255,255,255,0.28)' }}>AGMARKNET</span>
      </div>
    </div>
  )
})

// ── KPI Card 2.0 (trend arrows, status rings) ─────────────────────────────────

const KpiCard = memo(function KpiCard({
  label, emoji, name, badge, sub,
  accentColor = 'emerald', trendScore = null, density = 'balanced',
}) {
  const borderMap = {
    emerald: 'border-l-emerald-400',
    amber:   'border-l-amber-400',
    blue:    'border-l-blue-400',
    red:     'border-l-red-400',
  }
  const ringMap = {
    emerald: 'ring-emerald-300',
    amber:   'ring-amber-300',
    blue:    'ring-blue-300',
    red:     'ring-red-300',
  }

  const arrow      = trendScore == null ? null : trendScore > 3 ? '↑' : trendScore < -3 ? '↓' : '→'
  const arrowColor = trendScore > 3 ? 'text-emerald-500' : trendScore < -3 ? 'text-red-500' : 'text-gray-300'
  const pad        = density === 'compact' ? 'p-3' : density === 'expanded' ? 'p-5' : 'p-4'

  return (
    <div className={`
      card-premium inner-glow rounded-2xl
      hover:shadow-lg hover:-translate-y-1 transition-all duration-200 ease-in-out
      ${pad} border-l-4 ${borderMap[accentColor] ?? borderMap.emerald}
    `}>
      <div className="flex items-start justify-between mb-1.5">
        <Label>{label}</Label>
        {arrow && (
          <span className={`text-sm font-black leading-none ${arrowColor}`}>{arrow}</span>
        )}
      </div>
      {name ? (
        <>
          <div className="flex items-center gap-2 mb-1">
            <span className={`text-lg leading-none ring-2 ring-offset-1 rounded-full ${ringMap[accentColor] ?? ringMap.emerald} ring-opacity-40`}>
              {emoji}
            </span>
            <p className="text-[13px] font-bold text-gray-900 leading-tight">{name}</p>
            {badge}
          </div>
          <p className="text-[9px] text-gray-400 leading-snug">{sub}</p>
        </>
      ) : (
        <div className="flex items-center gap-2 py-1">
          <Spinner size="sm" className="w-3.5 h-3.5 text-gray-300" />
          <span className="text-xs text-gray-300">Loading…</span>
        </div>
      )}
    </div>
  )
})

// ── Seasonal style map ────────────────────────────────────────────────────────

const SEASONAL_STYLE = {
  peak:   'bg-amber-50/80  border-amber-200   text-amber-800',
  trough: 'bg-blue-50/80   border-blue-200    text-blue-800',
  normal: 'bg-emerald-50/80 border-emerald-200 text-emerald-800',
  high:   'bg-red-50/80    border-red-200     text-red-800',
}

// ── Sort comparison table ─────────────────────────────────────────────────────

const SORT_OPTIONS = [
  { key: 'avg_price',      label: 'Price'      },
  { key: 'volatility_cv',  label: 'Volatility' },
  { key: 'momentum_score', label: 'Momentum'   },
  { key: 'training_days',  label: 'Data Depth' },
]

// ── Insight prioritization engine ─────────────────────────────────────────────

function prioritizeInsights(insights) {
  const scored = insights.map(ins => {
    let score = 0
    if (ins.tag?.includes('Risk'))      score += 30
    if (ins.tag?.includes('Seasonal'))  score += 20
    if (ins.tag?.includes('Price'))     score += 15
    if (ins.tag?.includes('Stability')) score += 10
    return { ...ins, _score: score }
  })
  return [...scored].sort((a, b) => b._score - a._score)
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function AIAdvisor() {
  const { analytics, loading: analyticsLoading } = useAnalytics()
  const { data: crossData, loading: crossLoading } = useCrossAnalytics()

  const [sortKey,      setSortKey]      = useState('avg_price')
  const [immersive,    setImmersive]    = useState(false)
  const [densityMode,  setDensityMode]  = useState('balanced')
  const [commandMode,  setCommandMode]  = useState(false)
  const [monitorData,  setMonitorData]  = useState(null)
  const [p5Crop,       setP5Crop]       = useState('Tomato')
  const [p5State,      setP5State]      = useState('Karnataka')
  const [labPanel,     setLabPanel]     = useState('briefing')

  const handleMonitorData = useCallback((d) => setMonitorData(d), [])

  const loading  = analyticsLoading
  const outerGap = DENSITY_GAP[densityMode] ?? 'gap-4'

  // ── Derived signals ────────────────────────────────────────────────────────
  const topGainer  = analytics?.momentum?.slice().sort((a, b) => b.score - a.score)[0]  ?? null
  const topLoser   = analytics?.momentum?.slice().sort((a, b) => a.score - b.score)[0]  ?? null
  const highVol    = analytics?.volatility?.[0]          ?? null
  const lowestRisk = analytics?.volatility?.slice(-1)[0] ?? null
  const topQuality = analytics?.forecast_quality?.[0]    ?? null

  const criticalAnomaly = useMemo(() => {
    if (!analytics?.anomalies?.length) return false
    return analytics.anomalies.some(a => a.severity === 'high' && Math.abs(a.pct_deviation) >= 30)
  }, [analytics])

  // ── Strategic insights ─────────────────────────────────────────────────────
  const strategicInsights = useMemo(() => {
    if (!crossData?.crops || !analytics) return []
    const available = crossData.crops.filter(c => c.has_analytics)
    const insights  = []

    const priceLead = available.reduce((a, b) => (b.avg_price > (a?.avg_price ?? 0) ? b : a), null)
    if (priceLead) {
      insights.push({
        icon: '💰',
        title: `${priceLead.crop} leads on price`,
        tag: 'Price Intelligence',
        tagStyle: 'bg-amber-50 border-amber-200 text-amber-700',
        desc: `${priceLead.crop} commands the highest average price at ${formatPrice(priceLead.avg_price)}/qtl in ${priceLead.state}, with ${priceLead.volatility_badge} price behaviour (CV ${priceLead.volatility_cv}%). This reflects ${priceLead.current_phase === 'peak' ? 'seasonal peak conditions' : priceLead.current_phase === 'trough' ? 'seasonal trough pricing' : 'normal market conditions'}.`,
      })
    }

    const peakCrops = available.filter(c => c.current_phase === 'peak' && c.current_vs_norm > 5)
    if (peakCrops.length > 0) {
      const best = peakCrops.reduce((a, b) => (b.current_vs_norm > a.current_vs_norm ? b : a))
      insights.push({
        icon: '📅',
        title: `${best.crop} at seasonal peak`,
        tag: 'Seasonal Signal',
        tagStyle: 'bg-purple-50 border-purple-200 text-purple-700',
        desc: `${best.crop} prices are currently ${best.current_vs_norm}% above the annual average — a seasonal peak pattern. Historical data shows peak months in ${best.peak_months?.slice(0, 3).join(', ') ?? 'N/A'}. Sellers may benefit from current premium pricing.`,
      })
    }

    if (lowestRisk) {
      insights.push({
        icon: '🛡️',
        title: `${lowestRisk.crop} most stable market`,
        tag: 'Stability',
        tagStyle: 'bg-emerald-50 border-emerald-200 text-emerald-700',
        desc: `${lowestRisk.crop} shows the most predictable pricing this period with a coefficient of variation of ${lowestRisk.cv}% — classified as "${lowestRisk.badge}". Low volatility means forecast confidence is high and price surprises are less likely over the next 30 days.`,
      })
    }

    if (highVol && highVol.cv > 35) {
      insights.push({
        icon: '⚡',
        title: `${highVol.crop} elevated price risk`,
        tag: 'Risk Alert',
        tagStyle: 'bg-red-50 border-red-200 text-red-700',
        desc: `${highVol.crop} exhibits ${highVol.badge.toLowerCase()} pricing (CV ${highVol.cv}%) in ${highVol.state}. The 30-day price standard deviation stands at ₹${highVol.recent_30d_vol?.toLocaleString()}/qtl. Handle price commitments with caution.`,
      })
    }

    return prioritizeInsights(insights)
  }, [crossData, analytics, highVol, lowestRisk])

  // ── Sorted comparison rows ─────────────────────────────────────────────────
  const comparisonRows = useMemo(() => {
    if (!crossData?.crops) return []
    const rows = crossData.crops.filter(c =>
      c.has_analytics && (TIER1_CROPS.includes(c.crop) || TIER2_CROPS.includes(c.crop))
    )
    return [...rows].sort((a, b) => (b[sortKey] ?? 0) - (a[sortKey] ?? 0))
  }, [crossData, sortKey])

  // ── Page ───────────────────────────────────────────────────────────────────

  return (
    <div className={`space-y-4 ${immersive ? 'min-h-screen' : ''}`}>

      {/* ════════════════════════════════════════════════════════
          ZONE 1 — EXECUTIVE STRIP
          Header, density controls, immersive mode toggle
          ════════════════════════════════════════════════════════ */}
      <div className={`
        flex items-start justify-between flex-wrap gap-3 pb-1
        ${immersive
          ? 'px-4 py-3 -mx-4 bg-gray-900 border-b border-gray-700/60 rounded-none sm:-mx-6 sm:px-6'
          : ''}
      `}>
        <div>
          <h1 className={`text-2xl font-bold leading-tight tracking-tight ${immersive ? 'text-gray-100' : 'text-gray-900'}`}>
            AgroPrice AI
          </h1>
          <p className="text-xs mt-0.5 tracking-wide" style={{ color: immersive ? 'rgba(255,255,255,0.32)' : 'rgba(255,255,255,0.36)' }}>
            {immersive
              ? 'Intelligence Terminal · Gemini 2.5 Flash · AGMARKNET 2015–2026'
              : 'Agricultural intelligence · AGMARKNET 2015–2026 · Gemini 2.5 Flash'}
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {(loading || crossLoading) && (
            <Spinner size="sm" className="w-3.5 h-3.5 text-gray-400" />
          )}

          {/* Density toggle — hidden in immersive */}
          {!immersive && (
            <DensityToggle value={densityMode} onChange={setDensityMode} />
          )}

          {/* Command Mode toggle */}
          {!immersive && (
            <button
              onClick={() => setCommandMode(true)}
              title="Executive Command Mode — information-dense, highest urgency only"
              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border transition-all duration-200 bg-gray-800 text-gray-200 border-gray-700 hover:bg-gray-700"
            >
              <span>⌘</span>
              CMD
            </button>
          )}

          {/* Immersive Mode toggle */}
          <button
            onClick={() => setImmersive(m => !m)}
            className={`
              inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium
              border transition-all duration-200
              ${immersive
                ? 'bg-gray-100 text-gray-900 border-gray-300'
                : 'bg-gray-900 text-white border-gray-900 hover:bg-gray-800'}
            `}
          >
            <span>{immersive ? '◧' : '▣'}</span>
            {immersive ? 'Exit Immersive' : 'Immersive'}
          </button>

          {!immersive && (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold border"
              style={{ background: 'rgba(14,22,50,0.55)', borderColor: 'rgba(56,189,248,0.30)', color: 'rgba(56,189,248,0.88)' }}>
              <span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: 'rgba(56,189,248,0.80)' }} />
              Decision Intelligence · Phase 5
            </span>
          )}
        </div>
      </div>

      {/* Command Mode overlay — rendered outside main flow so it covers full viewport */}
      {commandMode && (
        <AICommandMode data={monitorData} onClose={() => setCommandMode(false)} />
      )}

      {loading ? <PageLoader /> : (
        <>

          {/* ════════════════════════════════════════════════════════
              ZONE 2 — CRITICAL ALERTS
              Anomaly alerts — surface first when anomalies are detected
              ════════════════════════════════════════════════════════ */}
          {analytics?.anomalies?.length > 0 && (
            <>
              {!immersive && <ZoneLabel label="Zone 2 · Critical Alerts" />}
              <DashPanel
                title="Market Anomaly Alerts"
                subtitle="Price spikes and crashes via rolling z-score analysis · last 90 days"
                priority={criticalAnomaly ? 'critical' : 'high'}
                defaultOpen={criticalAnomaly}
                badge={`${analytics.anomalies.length} events`}
                preview={`${analytics.anomalies.length} price event${analytics.anomalies.length > 1 ? 's' : ''} detected in the last 90 days`}
                compact={immersive || densityMode === 'compact'}
              >
                <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-2">
                  {[...analytics.anomalies]
                    .sort((a, b) => {
                      const sev = { high: 3, medium: 2, low: 1 }
                      return (sev[b.severity] ?? 0) - (sev[a.severity] ?? 0)
                    })
                    .map((a, i) => {
                      const isSpike = a.event_type === 'spike'
                      const bg = a.severity === 'high'
                        ? 'bg-red-50/80 border-red-100 border-l-4 border-l-red-400'
                        : a.severity === 'medium'
                        ? 'bg-amber-50/80 border-amber-100 border-l-4 border-l-amber-400'
                        : 'bg-yellow-50/80 border-yellow-100 border-l-4 border-l-yellow-300'
                      return (
                        <div key={i} className={`flex items-start gap-2.5 p-2.5 rounded-lg border transition-all duration-150 hover:shadow-sm ${bg}`}>
                          <div className={`w-1 self-stretch rounded-full shrink-0 ${
                            a.severity === 'high' ? 'bg-red-400' : a.severity === 'medium' ? 'bg-amber-400' : 'bg-yellow-400'
                          }`} />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-1.5 flex-wrap mb-0.5">
                              <span className="text-[11px] font-bold text-gray-900">
                                {cropEmoji(a.crop)} {a.crop}
                              </span>
                              <span className="text-[9px] text-gray-500">{a.state}</span>
                              <SeverityBadge severity={a.severity} />
                            </div>
                            <p className="text-[10px] font-semibold text-gray-700">
                              {isSpike ? '↑ Spike' : '↓ Crash'}&nbsp;
                              <span className="font-black tabular-nums">{a.pct_deviation > 0 ? '+' : ''}{a.pct_deviation}%</span>
                              <span className="font-normal text-gray-500"> vs 30d avg · {a.date}</span>
                            </p>
                            <p className="text-[9px] text-gray-400 mt-0.5 tabular-nums">
                              ₹{a.price?.toLocaleString()} · baseline ₹{a.roll_mean?.toLocaleString()}/qtl · z={a.z_score}
                            </p>
                          </div>
                        </div>
                      )
                    })}
                </div>
              </DashPanel>
            </>
          )}

          {/* ════════════════════════════════════════════════════════
              ZONE 3 — LIVE AI WORKSPACE
              Intelligence rail + AI Advisor chat (primary focal point)
              ════════════════════════════════════════════════════════ */}
          <ZoneLabel label="Zone 3 · Live AI Workspace" />

          {/* Intelligence rail — always visible above chat */}
          <IntelligenceRail
            topGainer={topGainer}
            topLoser={topLoser}
            highVol={highVol}
            criticalAnomaly={criticalAnomaly}
            immersive={immersive}
          />

          {/* AI Advisor Chat */}
          <AdvisorChat />

          {/* Zones 4-7 — hidden in Immersive Mode */}
          {!immersive && (
            <>

              {/* ════════════════════════════════════════════════════════
                  ZONE 4 — EXECUTIVE INTELLIGENCE
                  KPI command row + Autonomous Monitor + Executive Synthesis
                  ════════════════════════════════════════════════════════ */}
              <ZoneLabel label="Zone 4 · Executive Intelligence" />

              {/* KPI Command Row — auto-fit prevents ultra-narrow cards at any viewport */}
              <div
                className="grid gap-4"
                style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))' }}
              >
                <KpiCard
                  label="Strongest Momentum"
                  emoji={cropEmoji(topGainer?.crop)}
                  name={topGainer?.crop}
                  badge={<MomentumChip signal={topGainer?.signal} score={topGainer?.score} />}
                  sub={topGainer
                    ? `7d avg ${formatPrice(topGainer.avg_7d)}/qtl · 30d avg ${formatPrice(topGainer.avg_30d)}/qtl`
                    : ''}
                  accentColor="emerald"
                  trendScore={topGainer?.score}
                  density={densityMode}
                />
                <KpiCard
                  label="Volatility Risk"
                  emoji={cropEmoji(highVol?.crop)}
                  name={highVol?.crop}
                  badge={<VolBadge level={highVol?.level} badge={highVol?.badge} />}
                  sub={highVol ? `CV ${highVol.cv}% · 30d std ₹${highVol.recent_30d_vol?.toLocaleString()}/qtl` : ''}
                  accentColor="amber"
                  trendScore={highVol ? -(highVol.cv / 10) : null}
                  density={densityMode}
                />
                <KpiCard
                  label="Best Forecast Quality"
                  emoji={cropEmoji(topQuality?.crop)}
                  name={topQuality?.crop}
                  badge={<ReliabilityBadge reliability={topQuality?.reliability} score={topQuality?.score} />}
                  sub={topQuality
                    ? `${topQuality.training_days.toLocaleString()} training days · CV ${topQuality.cv}%`
                    : ''}
                  accentColor="blue"
                  density={densityMode}
                />
              </div>

              {/* Executive row: Autonomous Monitor (3/5) + Executive Synthesis (2/5) */}
              <div className={`grid grid-cols-1 xl:grid-cols-5 ${outerGap}`}>
                <div className="xl:col-span-3">
                  <DashPanel
                    title="Autonomous Market Monitor"
                    subtitle="Regime detection · Escalation engine · Priority scoring · Phase 4B"
                    defaultOpen={true}
                    compact={densityMode === 'compact'}
                    badge="Live"
                    preview="Priority-scored intelligence across all Tier-1 crops"
                  >
                    <AIAutonomousMonitor maxCrops={8} onDataLoad={handleMonitorData} />
                  </DashPanel>
                </div>
                <div className="xl:col-span-2">
                  <DashPanel
                    title="Executive Market Synthesis"
                    subtitle="Bloomberg-style cross-crop posture · Phase 5"
                    defaultOpen={true}
                    compact={densityMode === 'compact'}
                    badge="Cross-market"
                    preview="Institutional market posture across Tier-1 crops"
                  >
                    <AIExecutiveSynthesis maxCrops={8} />
                  </DashPanel>
                </div>
              </div>

              {/* ════════════════════════════════════════════════════════
                  ZONE 5 — STRATEGIC INTELLIGENCE
                  Strategic Insights (3/5) + Watchlist (2/5)
                  ════════════════════════════════════════════════════════ */}
              <ZoneLabel label="Zone 5 · Strategic Intelligence" />

              {(strategicInsights.length > 0 || !crossData) && (
                <div className={`grid grid-cols-1 xl:grid-cols-5 ${outerGap}`}>
                  <div className="xl:col-span-3">
                    <DashPanel
                      title="Strategic Market Insights"
                      subtitle="Analytics-derived intelligence from real AGMARKNET data"
                      defaultOpen
                      compact={densityMode === 'compact'}
                      loading={!crossData && !crossLoading === false}
                      preview={strategicInsights[0]?.title ?? 'Deriving insights from AGMARKNET data…'}
                    >
                      {!crossData ? (
                        <div className="flex items-center gap-2">
                          <Spinner size="sm" className="w-3.5 h-3.5 text-gray-400" />
                          <p className="text-xs text-gray-400">Computing strategic insights from AGMARKNET data…</p>
                        </div>
                      ) : (
                        <div className="space-y-1.5">
                          {strategicInsights.map((ins, i) => (
                            <div key={i}
                              className="flex gap-2.5 px-3 py-2 bg-gray-50/80 rounded-lg border border-gray-100 hover:bg-gray-50 transition-colors duration-150">
                              <div className="w-0.5 rounded-full bg-primary-400 shrink-0 self-stretch" />
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-1.5 mb-0.5 flex-wrap">
                                  {ins.icon && <span className="text-xs">{ins.icon}</span>}
                                  <p className="text-[11px] font-bold text-gray-800">{ins.title}</p>
                                  {ins.tag && (
                                    <span className={`text-[9px] font-medium px-1.5 py-0.5 rounded-full border shrink-0 ${ins.tagStyle || 'bg-white border-gray-200 text-gray-500'}`}>
                                      {ins.tag}
                                    </span>
                                  )}
                                </div>
                                <p className="text-[10px] text-gray-500 leading-snug">{ins.desc}</p>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </DashPanel>
                  </div>
                  <div className="xl:col-span-2">
                    <DashPanel
                      title="AI Market Watchlist"
                      subtitle="Live momentum, risk & opportunity buckets"
                      defaultOpen={true}
                      compact={densityMode === 'compact'}
                      badge="Phase 4A"
                      preview="Dynamic crop buckets: momentum, risk, safest, seasonal"
                    >
                      <AIWatchlist />
                    </DashPanel>
                  </div>
                </div>
              )}

              {/* ════════════════════════════════════════════════════════
                  ZONE 6 — MARKET INTELLIGENCE LAB
                  Market briefing / scenario simulation / recent changes
                  ════════════════════════════════════════════════════════ */}
              <ZoneLabel label="Zone 6 · Market Intelligence Lab" />

              {/* Dropdown-controlled single panel — row-wise layout */}
              <div className="rounded-2xl border border-gray-100 bg-white shadow-sm overflow-hidden">
                {/* Selector bar */}
                <div className="flex items-center gap-3 px-5 py-3 border-b border-gray-100 bg-gray-50/60">
                  <span className="text-[9px] font-black uppercase tracking-widest text-gray-400 shrink-0">Panel</span>
                  <select
                    value={labPanel}
                    onChange={e => setLabPanel(e.target.value)}
                    className="flex-1 text-[11px] font-semibold text-gray-700 bg-white border border-gray-200 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-primary-300 cursor-pointer"
                  >
                    <option value="briefing">🤖  Market Briefing</option>
                    <option value="simulation">⚙️  AI Scenario Simulation</option>
                    <option value="changes">📊  Recent Market Changes</option>
                  </select>
                  {/* Pill navigation */}
                  <div className="hidden sm:flex items-center gap-1 shrink-0">
                    {[
                      { key: 'briefing',   icon: '🤖', label: 'Briefing' },
                      { key: 'simulation', icon: '⚙️', label: 'Simulation' },
                      { key: 'changes',    icon: '📊', label: 'Changes' },
                    ].map(p => (
                      <button
                        key={p.key}
                        onClick={() => setLabPanel(p.key)}
                        className={`text-[9px] font-bold px-2.5 py-1 rounded-full border transition-colors ${
                          labPanel === p.key
                            ? 'bg-gray-900 border-gray-900 text-white'
                            : 'bg-white border-gray-200 text-gray-500 hover:border-gray-400'
                        }`}
                      >
                        {p.icon} {p.label}
                      </button>
                    ))}
                  </div>
                </div>
                {/* Active panel — full width */}
                <div className="p-5">
                  {labPanel === 'briefing'   && <AIMarketBriefing />}
                  {labPanel === 'simulation' && <AISimulationPanel />}
                  {labPanel === 'changes'    && <RecentMarketChanges crop={topGainer?.crop} state={topGainer?.state} />}
                </div>
              </div>

              {/* ════════════════════════════════════════════════════════
                  ZONE 7 — DECISION INTELLIGENCE (Phase 5)
                  Opportunity matrix, council, probability, strategy,
                  cross-market intelligence, decision trace (full width)
                  ════════════════════════════════════════════════════════ */}
              <SectionDivider label="Decision Intelligence — Phase 5" />
              <ZoneLabel label="Zone 7 · Collaborative Decision Intelligence" />

              {/* Crop + State selector */}
              <div className="flex items-center gap-3 flex-wrap px-1 py-2 bg-gray-50 rounded-xl border border-gray-100">
                <span className="text-[9px] font-black uppercase tracking-widest text-gray-400">Analyse:</span>
                <select
                  value={p5Crop}
                  onChange={e => setP5Crop(e.target.value)}
                  className="text-[11px] font-semibold text-gray-700 bg-white border border-gray-200 rounded-lg px-2 py-1 focus:outline-none focus:ring-1 focus:ring-violet-400"
                >
                  {PHASE4_ALL_CROPS.map(c => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
                <span className="text-gray-300 text-xs">in</span>
                <select
                  value={p5State}
                  onChange={e => setP5State(e.target.value)}
                  className="text-[11px] font-semibold text-gray-700 bg-white border border-gray-200 rounded-lg px-2 py-1 focus:outline-none focus:ring-1 focus:ring-violet-400"
                >
                  {SOUTH_INDIAN_STATES.map(s => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
                <span className="text-[9px] text-gray-400 ml-auto hidden sm:block">
                  Phase 5 · Deterministic · Multi-agent
                </span>
              </div>

              {/* Opportunity Matrix — full width for maximum data density */}
              <DashPanel
                title="Opportunity Matrix"
                subtitle="7-dimensional portfolio scoring across all crops"
                defaultOpen={true}
                compact={densityMode === 'compact'}
                badge="7 dimensions"
                preview="Opportunity, stability, risk, confidence, timing, seasonal, quality"
              >
                <AIOpportunityMatrix maxCrops={12} />
              </DashPanel>

              {/* Council + Probability — 2-col equal analytical surfaces */}
              <div className={`grid grid-cols-1 xl:grid-cols-2 ${outerGap}`}>
                <DashPanel
                  title={`AI Council · ${p5Crop}`}
                  subtitle="7-agent specialist council · Weighted vote · Consensus engine"
                  defaultOpen={true}
                  compact={densityMode === 'compact'}
                  badge="7 agents"
                  preview="Multi-agent council debate and weighted verdict"
                >
                  <AICouncilPanel crop={p5Crop} state={p5State} />
                </DashPanel>

                <DashPanel
                  title={`Probabilistic Outlook · ${p5Crop}`}
                  subtitle="Heuristic probability engine · Shock and reversal risk"
                  defaultOpen={true}
                  compact={densityMode === 'compact'}
                  badge="Probability"
                  preview="Upside / downside / sideways probability with confidence interval"
                >
                  <AIProbabilityPanel crop={p5Crop} state={p5State} />
                </DashPanel>
              </div>

              {/* Strategy + Cross-Market — 2-col equal split */}
              <div className={`grid grid-cols-1 xl:grid-cols-2 ${outerGap}`}>
                <DashPanel
                  title={`Strategy · ${p5Crop}`}
                  subtitle="Mode-specific advisory · farmer / trader / wholesale / analyst"
                  defaultOpen={true}
                  compact={densityMode === 'compact'}
                  badge="Multi-mode"
                  preview="Action, timing, caution, entry/exit triggers"
                >
                  <AIStrategyPanel crop={p5Crop} state={p5State} />
                </DashPanel>

                <DashPanel
                  title={`Cross-Market · ${p5Crop}`}
                  subtitle="Crop relationship graph · Substitutes, complements, contagion"
                  defaultOpen={true}
                  compact={densityMode === 'compact'}
                  badge="Relationship"
                  preview="Influence map with coupling score and contagion risk"
                >
                  <AIRelationshipMap crop={p5Crop} />
                </DashPanel>
              </div>

              {/* Decision Trace — full width, open by default for maximum explainability */}
              <DashPanel
                title={`Decision Trace · ${p5Crop}`}
                subtitle="Explainable AI reasoning chain · 6-stage pipeline · Evidence quality"
                defaultOpen={true}
                compact={densityMode === 'compact'}
                badge="Explainability"
                preview="Reasoning pipeline, evidence quality, agreed vs dissenting agents"
              >
                <AIDecisionTrace crop={p5Crop} state={p5State} />
              </DashPanel>

              {/* ════════════════════════════════════════════════════════
                  ZONES 6–7 — DEEP ANALYSIS ARCHIVE
                  Detailed analytics tables — collapsed by default
                  ════════════════════════════════════════════════════════ */}
              <SectionDivider label="Deep Analysis Archive" />

              <ZoneLabel label="Zone 6 · Deep Analysis" />

              {/* Momentum intelligence */}
              <DashPanel
                title="Market Momentum Intelligence"
                subtitle="7-day price movement vs prior 30-day baseline"
                defaultOpen={false}
                compact={densityMode === 'compact'}
                preview={topGainer ? `${topGainer.crop} leads · ${topGainer.score > 0 ? '+' : ''}${topGainer.score?.toFixed(1)}% this week` : undefined}
              >
                <div className={`grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 ${outerGap}`}>
                  {analytics?.momentum?.map(m => (
                    <div key={m.crop}
                      className="p-2.5 bg-gray-50/80 rounded-lg border border-gray-100
                                 hover:bg-gray-50 transition-colors duration-150">
                      <div className="flex items-center gap-1.5 mb-1">
                        <span className="text-sm">{cropEmoji(m.crop)}</span>
                        <p className="text-[11px] font-bold text-gray-800">{m.crop}</p>
                      </div>
                      <MomentumChip signal={m.signal} score={m.score} className="mb-1.5" />
                      <div className="text-[9px] text-gray-400 space-y-0.5 mt-1">
                        <div className="flex justify-between">
                          <span>7d avg</span>
                          <span className="font-medium text-gray-700 tabular-nums">{formatPrice(m.avg_7d)}/qtl</span>
                        </div>
                        <div className="flex justify-between">
                          <span>30d avg</span>
                          <span className="font-medium text-gray-700 tabular-nums">{formatPrice(m.avg_30d)}/qtl</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </DashPanel>

              {/* Volatility intelligence */}
              <DashPanel
                title="Volatility Intelligence"
                subtitle="Coefficient of variation · Price instability ranking"
                defaultOpen={false}
                compact={densityMode === 'compact'}
                preview={highVol ? `${highVol.crop} highest risk · CV ${highVol.cv}% · ${highVol.badge}` : undefined}
              >
                <div className="space-y-1">
                  {analytics?.volatility?.map((v, i) => (
                    <div key={v.crop}
                      className="flex items-center gap-3 py-1.5 border-b border-gray-50 last:border-0
                                 hover:bg-gray-50/60 rounded-lg px-1 transition-colors duration-150">
                      <span className="text-[10px] font-bold text-gray-300 w-4 text-center shrink-0">{i + 1}</span>
                      <span className="text-base w-5 shrink-0">{cropEmoji(v.crop)}</span>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <p className="text-[11px] font-semibold text-gray-800">{v.crop}</p>
                          <VolBadge level={v.level} badge={v.badge} />
                        </div>
                        <p className="text-[9px] text-gray-400 tabular-nums">
                          {v.state} · CV {v.cv}% · 7d ₹{v.recent_7d_vol?.toLocaleString()} · 30d ₹{v.recent_30d_vol?.toLocaleString()}/qtl
                        </p>
                      </div>
                      <div className="w-16 shrink-0">
                        <div className="h-1 rounded-full bg-gray-100 overflow-hidden">
                          <div
                            className={`h-full rounded-full transition-all duration-700 ${
                              v.level === 'stable'   ? 'bg-emerald-400' :
                              v.level === 'moderate' ? 'bg-amber-400'   :
                              v.level === 'high'     ? 'bg-orange-400'  : 'bg-red-400'
                            }`}
                            style={{ width: `${Math.min(100, v.cv)}%` }}
                          />
                        </div>
                        <p className="text-[9px] text-gray-400 text-right mt-0.5">{v.cv}%</p>
                      </div>
                    </div>
                  ))}
                </div>
              </DashPanel>

              {/* Seasonal intelligence */}
              <DashPanel
                title="Seasonal Intelligence"
                subtitle="Historical monthly patterns · Current phase positioning"
                defaultOpen={false}
                compact={densityMode === 'compact'}
              >
                <div className={`grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 ${outerGap}`}>
                  {analytics?.seasonal?.filter(s => !s.error).map(s => {
                    const typeStyle = SEASONAL_STYLE[s.current_phase] ?? SEASONAL_STYLE.normal
                    return (
                      <div key={s.crop} className={`border rounded-lg p-3 ${typeStyle}`}>
                        <div className="flex items-start justify-between mb-1.5">
                          <div className="flex items-center gap-1.5">
                            <span className="text-base">{cropEmoji(s.crop)}</span>
                            <div>
                              <p className="text-[11px] font-bold leading-tight">{s.crop}</p>
                              <p className="text-[9px] opacity-60">{s.state}</p>
                            </div>
                          </div>
                          <SeasonalPhaseBadge phase={s.current_phase} vsNorm={s.current_vs_norm} />
                        </div>
                        <div className="grid grid-cols-2 gap-1.5 text-[9px]">
                          <div>
                            <p className="font-bold opacity-50 uppercase tracking-wide mb-0.5">Peak</p>
                            <p className="font-semibold">{s.peak_months?.join(', ')} (+{s.peak_pct}%)</p>
                          </div>
                          <div>
                            <p className="font-bold opacity-50 uppercase tracking-wide mb-0.5">Trough</p>
                            <p className="font-semibold">{s.trough_months?.join(', ')} ({s.trough_pct}%)</p>
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </DashPanel>

              <ZoneLabel label="Zone 7 · Historical Archive" />

              {/* Cross-crop comparison */}
              <DashPanel
                title="Cross-Crop Comparison"
                subtitle="Tier-1 & Tier-2 crops ranked by key market metrics"
                defaultOpen={false}
                compact={densityMode === 'compact'}
                actions={
                  <div className="flex gap-1 flex-wrap">
                    {SORT_OPTIONS.map(opt => (
                      <button
                        key={opt.key}
                        onClick={() => setSortKey(opt.key)}
                        className={`px-2.5 py-0.5 text-[9px] font-bold rounded-full border transition-all duration-150 ${
                          sortKey === opt.key
                            ? 'bg-gray-900 text-white border-gray-900 shadow-sm'
                            : 'bg-white text-gray-500 border-gray-200 hover:border-gray-400 hover:text-gray-700'
                        }`}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                }
              >
                {crossData ? (
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="border-b border-gray-200">
                          {['Crop', 'Tier', 'Avg Price', 'Momentum', 'Volatility', 'Readiness', 'Training'].map(h => (
                            <th key={h}
                              className="text-left text-[8px] font-black text-gray-400 uppercase tracking-widest py-2 pr-4 first:pl-0 select-none">
                              {h}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {comparisonRows.map(c => (
                          <tr key={c.crop}
                            className="border-b border-gray-50 last:border-0 hover:bg-gray-50/80 transition-colors duration-100">
                            <td className="py-1.5 pr-4">
                              <span className="flex items-center gap-1.5">
                                <span className="text-sm">{cropEmoji(c.crop)}</span>
                                <span className="text-[11px] font-semibold text-gray-800">{cropShortName(c.crop)}</span>
                              </span>
                            </td>
                            <td className="py-1.5 pr-4">
                              <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full border ${
                                c.tier === 1
                                  ? 'text-emerald-700 bg-emerald-50 border-emerald-200'
                                  : 'text-blue-700 bg-blue-50 border-blue-200'
                              }`}>T{c.tier}</span>
                            </td>
                            <td className="py-1.5 pr-4 text-[11px] font-semibold text-gray-800 tabular-nums">
                              {formatPrice(c.avg_price)}/qtl
                            </td>
                            <td className="py-1.5 pr-4">
                              <span className={`text-[10px] font-semibold tabular-nums ${
                                c.momentum_score > 3  ? 'text-emerald-600' :
                                c.momentum_score < -3 ? 'text-red-500' : 'text-gray-500'
                              }`}>
                                {c.momentum_short} {c.momentum_score > 0 ? '+' : ''}{c.momentum_score?.toFixed(1)}%
                              </span>
                            </td>
                            <td className="py-1.5 pr-4">
                              <VolBadge level={c.volatility_level} badge={c.volatility_badge} />
                            </td>
                            <td className="py-1.5 pr-4">
                              <ReadinessBadge readiness={c.readiness} level={c.readiness_level} />
                            </td>
                            <td className="py-1.5 text-[10px] text-gray-400 tabular-nums">
                              {c.training_days?.toLocaleString()}d
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="flex items-center gap-2 py-4 justify-center">
                    <Spinner size="sm" className="w-4 h-4 text-gray-400" />
                    <p className="text-xs text-gray-400">Loading cross-crop data…</p>
                  </div>
                )}
              </DashPanel>

              {/* Forecast quality */}
              <DashPanel
                title="Forecast Reliability & AI Confidence"
                subtitle="Model confidence · Training depth · Price stability"
                defaultOpen={false}
                compact={densityMode === 'compact'}
                preview={topQuality ? `${topQuality.crop} top reliability · ${topQuality.reliability} · ${topQuality.training_days.toLocaleString()} training days` : undefined}
              >
                <div className={`grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 ${outerGap}`}>
                  {analytics?.forecast_quality?.map(q => (
                    <div key={q.crop}
                      className="p-3 bg-gray-50/80 rounded-xl border border-gray-100
                                 hover:bg-gray-50 transition-colors duration-150">
                      <div className="flex items-center gap-1.5 mb-2">
                        <span className="text-sm">{cropEmoji(q.crop)}</span>
                        <p className="text-xs font-bold text-gray-800 truncate">{q.crop}</p>
                      </div>
                      <ReliabilityBadge reliability={q.reliability} score={q.score} className="mb-2" />
                      <div className="h-1.5 rounded-full bg-gray-200 overflow-hidden mb-1.5">
                        <div
                          className={`h-full rounded-full transition-all duration-700 ${
                            q.reliability === 'Excellent' ? 'bg-emerald-500' :
                            q.reliability === 'Good'      ? 'bg-blue-500'    :
                            q.reliability === 'Moderate'  ? 'bg-amber-500'   : 'bg-red-400'
                          }`}
                          style={{ width: `${q.score}%` }}
                        />
                      </div>
                      <div className="text-[10px] text-gray-400 space-y-0.5">
                        <div className="flex justify-between">
                          <span>Training</span>
                          <span className="font-medium">{q.training_days.toLocaleString()}d</span>
                        </div>
                        <div className="flex justify-between">
                          <span>Volatility</span>
                          <span className="font-medium">{q.cv}% CV</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
                <p className="text-[10px] text-gray-400 mt-4 pt-3 border-t border-gray-100 leading-relaxed">
                  Reliability score 0–100: weighted by training data depth (0–50 pts) and price stability (0–50 pts, decreasing with CV).
                  Excellent ≥70 · Good ≥52 · Moderate ≥35 · Low Confidence &lt;35.
                </p>
              </DashPanel>

            </>
          )}

        </>
      )}
    </div>
  )
}
