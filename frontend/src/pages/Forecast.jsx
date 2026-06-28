import { useState, useEffect, useMemo } from 'react'
import { useForecast }          from '@hooks/useForecast'
import { useAnalytics }         from '@hooks/useAnalytics'
import { useForecastCoverage }  from '@hooks/useForecastCoverage'
import Card, { CardHeader }     from '@components/ui/Card'
import { PageLoader, Spinner }  from '@components/ui/Loader'
import {
  SeverityBadge, ReliabilityBadge, SeasonalPhaseBadge, TierBadge,
} from '@components/ui/Badge'
import ForecastChart from '@components/charts/ForecastChart'
import AICopilotPanel from '@components/ai/AICopilotPanel'
import AIChatPanel from '@components/ai/AIChatPanel'
import ScenarioSimulator from '@components/ai/ScenarioSimulator'
import CropComparison from '@components/ai/CropComparison'
import AnalyticsIntelligencePanel from '@components/ai/AnalyticsIntelligencePanel'
import SmartInsightCards from '@components/ai/SmartInsightCards'
import MarketCommandCenter from '@components/ai/MarketCommandCenter'
import AIGauges from '@components/ai/AIGauges'
import OpportunityMatrix from '@components/ai/OpportunityMatrix'
import MarketHeatmap from '@components/ai/MarketHeatmap'
import CropBattle from '@components/ai/CropBattle'
import StrategyPlanner from '@components/ai/StrategyPlanner'
import MarketTimeline from '@components/ai/MarketTimeline'
import HowItThinks from '@components/ai/HowItThinks'
import AgentOrchestrator from '@components/ai/AgentOrchestrator'
import ForecastDecisionPipeline from '@components/ai/ForecastDecisionPipeline'
import MarketStoryMode from '@components/ai/MarketStoryMode'
import PresentationMode from '@components/ai/PresentationMode'
import ExecutiveReportModal from '@components/ai/ExecutiveReportModal'
import AcademicOverview from '@components/ai/AcademicOverview'
import { useAIInsights } from '@hooks/useAIInsights'
import { formatPrice, formatDateLong } from '@utils/formatters'
import { TIER1_CROPS, SOUTH_INDIAN_STATES, cropShortName } from '@utils/constants'
import api from '@services/api'

// ── Derive quality signals from forecast data ─────────────────────────────────
function useForecastInsights(forecast, history) {
  return useMemo(() => {
    if (!forecast?.forecast?.length) return null
    const fc  = forecast.forecast
    const n   = fc.length
    const mid = Math.floor(n / 2)

    const firstHalf  = fc.slice(0, mid).reduce((s, d) => s + d.predicted_price, 0) / mid
    const secondHalf = fc.slice(mid).reduce((s, d) => s + d.predicted_price, 0) / (n - mid)
    const trendPct   = ((secondHalf - firstHalf) / firstHalf) * 100

    const signal =
      trendPct >  4 ? 'Bullish' :
      trendPct < -4 ? 'Bearish' : 'Neutral'
    const signalCls =
      signal === 'Bullish' ? 'text-amber-700 bg-amber-50 border-amber-200' :
      signal === 'Bearish' ? 'text-emerald-700 bg-emerald-50 border-emerald-200' :
                             'text-gray-600 bg-gray-50 border-gray-200'

    const avgPred = fc.reduce((s, d) => s + d.predicted_price, 0) / n
    const avgCI   = fc.reduce((s, d) => s + (d.upper_bound - d.lower_bound), 0) / n
    const ciPct   = (avgCI / avgPred) * 100
    const confLabel =
      ciPct < 60  ? 'High'   :
      ciPct < 120 ? 'Medium' : 'Low'
    const confCls =
      confLabel === 'High'   ? 'text-emerald-600' :
      confLabel === 'Medium' ? 'text-amber-600'   : 'text-red-500'

    const rows = forecast.training_rows ?? 0
    const dataQuality =
      rows >= 2000 ? 'Good' :
      rows >= 500  ? 'Fair' : 'Limited'
    const dataCls =
      dataQuality === 'Good' ? 'text-emerald-600' :
      dataQuality === 'Fair' ? 'text-amber-600'   : 'text-red-500'

    const insights = []
    if (Math.abs(trendPct) > 4)
      insights.push(`${signal === 'Bullish' ? 'Rising' : 'Falling'} trend — ${Math.abs(trendPct).toFixed(1)}% projected over ${n} days`)
    if (ciPct > 100)
      insights.push(`Wide confidence interval (±${Math.round(avgCI / 2)} ₹/qtl) — high price uncertainty`)
    else
      insights.push(`Narrow confidence interval — model has ${confLabel.toLowerCase()} predictive confidence`)
    if (rows >= 2000)
      insights.push(`Strong training base — ${rows.toLocaleString()} historical days used`)

    const yearsLabel = history?.length
      ? (() => {
          const first = history[0]?.date?.slice(0, 4) ?? '—'
          const last  = history[history.length - 1]?.date?.slice(0, 4) ?? '—'
          return first === last ? first : `${first}–${last}`
        })()
      : '—'

    return {
      signal, signalCls, confLabel, confCls, dataQuality, dataCls,
      trendPct, insights, yearsLabel, ciPct, avgCI, avgPred,
    }
  }, [forecast, history])
}

// ── Risk classification ────────────────────────────────────────────────────────
function classifyRisk(insights, cropAnalytics) {
  if (!insights) return null
  const cv     = cropAnalytics?.volatility?.cv ?? 0
  const phase  = cropAnalytics?.seasonal?.current_phase ?? 'normal'
  const vsNorm = Math.abs(cropAnalytics?.seasonal?.current_vs_norm ?? 0)

  if (insights.confLabel === 'Low' || insights.dataQuality === 'Limited')
    return { label: 'Low Confidence', icon: '⚠', cls: 'bg-red-50 border-red-200 text-red-700' }
  if (cv > 45)
    return { label: 'High Volatility', icon: '⚡', cls: 'bg-orange-50 border-orange-200 text-orange-700' }
  if (phase !== 'normal' && vsNorm > 20)
    return { label: 'Seasonal Distortion', icon: '◈', cls: 'bg-purple-50 border-purple-200 text-purple-700' }
  if (cv > 25 || insights.confLabel === 'Medium')
    return { label: 'Moderate Risk', icon: '△', cls: 'bg-amber-50 border-amber-200 text-amber-700' }
  return { label: 'Stable Market', icon: '✓', cls: 'bg-emerald-50 border-emerald-200 text-emerald-700' }
}

// ── Forecast interpretation narrative ─────────────────────────────────────────
function buildNarrative(crop, state, days, insights, cropAnalytics, forecast) {
  if (!insights || !forecast) return null
  const parts = []
  const isSparse = forecast.method === 'sparse_trend'
  const modelName = isSparse ? 'The sparse-trend estimator' : 'The Prophet model'

  if (insights.signal === 'Bullish')
    parts.push(`${modelName} projects a rising price trajectory for ${crop} in ${state} (+${Math.abs(insights.trendPct).toFixed(1)}% over ${days} days).`)
  else if (insights.signal === 'Bearish')
    parts.push(`${modelName} projects a declining price trajectory for ${crop} in ${state} (−${Math.abs(insights.trendPct).toFixed(1)}% over ${days} days).`)
  else
    parts.push(`${modelName} projects a stable price trajectory for ${crop} in ${state} over the next ${days} days.`)

  const halfCI = Math.round(insights.avgCI / 2)
  if (isSparse)
    parts.push(`Reporting for this crop is sparse, so this is a directional trend estimate (±₹${halfCI}/qtl band) — not a full statistical forecast.`)
  else if (insights.confLabel === 'High')
    parts.push(`Model confidence is high — the 80% forecast band is relatively narrow (±₹${halfCI}/qtl).`)
  else if (insights.confLabel === 'Medium')
    parts.push(`The 80% confidence band spans ±₹${halfCI}/qtl, indicating moderate price uncertainty.`)
  else
    parts.push(`The confidence band is wide (±₹${halfCI}/qtl), reflecting elevated price uncertainty — treat forecasts with caution.`)

  if (cropAnalytics?.seasonal && !cropAnalytics.seasonal.error) {
    const phase  = cropAnalytics.seasonal.current_phase
    const vsNorm = cropAnalytics.seasonal.current_vs_norm
    if (phase === 'peak')
      parts.push(`${crop} is currently in its seasonal peak (${vsNorm > 0 ? '+' : ''}${vsNorm}% above annual average), supporting elevated prices.`)
    else if (phase === 'trough')
      parts.push(`${crop} is in its seasonal trough (${vsNorm}% vs annual average); prices may recover as the season progresses.`)
  }

  parts.push(`Forecast generated from ${forecast.training_rows?.toLocaleString()} historical price observations (AGMARKNET, South India).`)
  return parts.join(' ')
}

const HORIZON_OPTIONS = [
  { value: 30, label: '30 days' },
  { value: 60, label: '60 days' },
  { value: 90, label: '90 days' },
]

function SelectField({ label, value, onChange, children, disabled }) {
  return (
    <div>
      <label className="block text-[10px] font-bold text-forest-700 mb-1.5 uppercase tracking-widest opacity-60">{label}</label>
      <select
        value={value}
        onChange={e => onChange(e.target.value)}
        disabled={disabled}
        className="w-full border border-forest-900/10 rounded-xl px-3 py-2 text-sm text-gray-800 bg-white/80
                   focus:outline-none focus:ring-2 focus:ring-forest-500/30 focus:border-forest-400/40
                   disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-150"
      >
        {children}
      </select>
    </div>
  )
}

function StatCard({ label, value, sub, accent = false }) {
  return (
    <div className={`card-premium rounded-2xl inner-glow p-4 transition-all duration-200 hover:-translate-y-0.5 ${accent ? 'border-l-2 border-l-forest-500' : ''}`}>
      <p className="text-[10px] font-bold text-forest-700 uppercase tracking-widest mb-1 opacity-60">{label}</p>
      <p className={`text-xl font-bold leading-tight ${accent ? 'text-forest-700' : 'text-gray-900'}`}>{value}</p>
      {sub && <p className="text-xs text-forest-900/40 mt-0.5">{sub}</p>}
    </div>
  )
}

function ErrorState({ crop, state, message }) {
  return (
    <Card>
      <div className="flex flex-col items-center justify-center py-14 text-center">
        <div className="w-12 h-12 rounded-full bg-red-50 flex items-center justify-center mb-3">
          <svg className="w-6 h-6 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
              d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
          </svg>
        </div>
        <p className="font-semibold text-gray-700">No forecast available for {crop} in {state}</p>
        <p className="text-sm text-gray-400 mt-1.5 max-w-sm">{message}</p>
        <p className="text-xs text-gray-400 mt-2">Try a different crop or state combination.</p>
      </div>
    </Card>
  )
}

// ── Analytics-only panel (for non-forecast-eligible crops) ────────────────────
function AnalyticsOnlyPanel({ crop, state, history, geoData, cropAnalytics }) {
  const lastPrice = history.at(-1)?.modal_price
  const lastDate  = history.at(-1)?.date

  // Simple history sparkline data
  const histPoints = history.map(h => ({ date: h.date, price: h.modal_price }))

  return (
    <div className="space-y-5">
      {/* KPI strip — strictly per-pair data (no home-state leakage) */}
      <div className="grid grid-cols-2 gap-4">
        <StatCard label={`Last Recorded Price · ${state}`} value={lastPrice != null ? `${formatPrice(lastPrice)}/qtl` : '—'} sub={lastDate ? formatDateLong(lastDate) : 'no recent records'} />
        <StatCard label="History Loaded" value={history.length ? `${history.length} days` : '—'} sub={`${crop} price observations in ${state}`} />
      </div>

      {/* Price history chart — only when there is enough data to be
          meaningful; a near-empty chart frame communicates nothing */}
      {history.length >= 10 && (
        <Card padding={false}>
          <div className="px-5 pt-5">
            <CardHeader
              title={`${crop} · ${state}`}
              subtitle={`${history.length} days of recorded price history · No Prophet model available`}
            />
          </div>
          <div className="px-3 pb-5">
            <ForecastChart history={history} forecast={null} />
          </div>
        </Card>
      )}

      {/* Cross-State Geographic Snapshot */}
      {geoData && geoData.states && (
        <section>
          <h2 className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-3">
            State-Level Analytics · {crop}
          </h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
            {geoData.states.map(s => {
              if (!s.available) {
                return (
                  <Card key={s.state} className="!p-3.5 opacity-60">
                    <p className="text-xs font-bold text-gray-600 mb-1">{s.state}</p>
                    <p className="text-xs text-gray-400">Insufficient continuity</p>
                  </Card>
                )
              }
              return (
                <Card key={s.state} className="!p-3.5">
                  <p className="text-xs font-bold text-gray-800 mb-1.5">{s.state}</p>
                  <p className="text-lg font-extrabold text-gray-900">
                    {formatPrice(s.avg_price)}
                    <span className="text-[10px] font-normal text-gray-400">/qtl</span>
                  </p>
                  <div className="flex items-center gap-1 mt-0.5">
                    <span className={`text-[10px] font-semibold ${
                      s.trend === 'rising' ? 'text-amber-600' :
                      s.trend === 'falling' ? 'text-emerald-600' : 'text-gray-500'
                    }`}>
                      {s.trend === 'rising' ? '↑' : s.trend === 'falling' ? '↓' : '→'}
                      {' '}{s.change_pct > 0 ? '+' : ''}{s.change_pct}%
                    </span>
                  </div>
                  <div className="mt-2 pt-2 border-t border-gray-100 text-[10px]">
                    <div className="flex justify-between">
                      <span className="text-gray-400">CV</span>
                      <span className="font-semibold text-gray-700">{s.volatility_cv}%</span>
                    </div>
                    <div className="flex justify-between mt-0.5">
                      <span className="text-gray-400">Training</span>
                      <span className="font-semibold text-gray-700">{s.training_days?.toLocaleString()}d</span>
                    </div>
                  </div>
                </Card>
              )
            })}
          </div>
        </section>
      )}

      {/* Seasonal intelligence from analytics endpoint */}
      {cropAnalytics?.seasonal && !cropAnalytics.seasonal.error && (
        <Card className="!p-4">
          <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2">
            Seasonal Pattern · {cropAnalytics.seasonal.state}
          </p>
          <div className="flex items-center gap-2 mb-2">
            <SeasonalPhaseBadge phase={cropAnalytics.seasonal.current_phase} vsNorm={cropAnalytics.seasonal.current_vs_norm} />
          </div>
          <div className="grid grid-cols-2 gap-3 text-xs">
            <div>
              <p className="text-gray-400 text-[10px] uppercase tracking-wide mb-0.5">Peak months</p>
              <p className="font-semibold text-gray-800">
                {cropAnalytics.seasonal.peak_months?.join(', ')}
                <span className="text-emerald-600 ml-1">(+{cropAnalytics.seasonal.peak_pct}%)</span>
              </p>
            </div>
            <div>
              <p className="text-gray-400 text-[10px] uppercase tracking-wide mb-0.5">Trough months</p>
              <p className="font-semibold text-gray-800">
                {cropAnalytics.seasonal.trough_months?.join(', ')}
                <span className="text-amber-600 ml-1">({cropAnalytics.seasonal.trough_pct}%)</span>
              </p>
            </div>
          </div>
        </Card>
      )}
    </div>
  )
}

// ── Main component ────────────────────────────────────────────────────────────
export default function Forecast() {
  const [crop,    setCrop]    = useState('Tomato')
  const [state,   setState]   = useState('Karnataka')
  const [days,    setDays]    = useState(30)
  const [geoData, setGeoData] = useState(null)
  const [geoLoad, setGeoLoad] = useState(false)

  // Crop registry (categories drive the dropdown; coverage records are
  // crop-level home-state metadata — NEVER used for state-specific rendering)
  const { categories, crops: coverageCrops, forCrop: coverageForCrop } = useForecastCoverage()

  // Phase 2.5: per-PAIR intelligence — the single source of truth for which
  // mode this crop+state renders in (full / moderate / sparse / analytics)
  const {
    insights: aiInsights,
    loading: aiLoading,
    isRefetching: aiRefetching,
    error: aiError,
  } = useAIInsights({ crop, state, days })

  // ── Centralized mode resolver (crop+state aware) ────────────────────────
  const pairSummary = aiInsights?.context_summary ?? null
  const pairReady   = !aiLoading && !aiRefetching && aiInsights != null
  const mode        = pairReady ? aiInsights.mode : null   // null while resolving
  const pairTier    = pairReady ? (pairSummary?.tier ?? 'D') : null
  const isModerateForecast = mode === 'moderate'
  const isSparseTrend      = mode === 'sparse'
  const isAnalyticsOnly    = mode === 'analytics'

  // Phase 2.5 — Mode-D smart action: inject a prompt into the chat panel
  const [chatPrompt, setChatPrompt] = useState(null)

  // useForecast: don't attempt Prophet once the pair is known analytics-only
  const { forecast, history, loading, isRefetching, error } = useForecast({
    crop, state, days,
    forecastEnabled: !isAnalyticsOnly,
  })

  const insights      = useForecastInsights(forecast, history)
  const { forCrop }   = useAnalytics()
  const cropAnalytics = forCrop(crop)

  // Cross-state geographic snapshot — fetches when crop changes
  useEffect(() => {
    setGeoData(null)
    setGeoLoad(true)
    api.get(`/api/prices/geographic-intelligence?crop=${encodeURIComponent(crop)}`)
      .then(res => setGeoData(res.data))
      .catch(() => {})
      .finally(() => setGeoLoad(false))
  }, [crop])

  // All hooks unconditional — derived values after
  // stable annotations array — keeps the memoized chart from re-rendering
  // on unrelated page state changes (chat, simulator, etc.)
  const chartAnnotations = useMemo(
    () => (aiInsights?.anomaly_explanations ?? []).map(a => ({
      date: a.date,
      kind: a.event_type,
      label: a.event_type === 'spike'
        ? `▲ spike ${a.pct_deviation > 0 ? '+' : ''}${a.pct_deviation}%`
        : `▼ crash ${a.pct_deviation}%`,
    })),
    [aiInsights],
  )
  const riskClass = useMemo(() => classifyRisk(insights, cropAnalytics), [insights, cropAnalytics])
  const narrative = useMemo(
    () => buildNarrative(crop, state, days, insights, cropAnalytics, forecast),
    [crop, state, days, insights, cropAnalytics, forecast]
  )

  const lastPrice   = history.at(-1)?.modal_price
  const lastDate    = history.at(-1)?.date
  const fcPoints    = forecast?.forecast ?? []
  const avgForecast = fcPoints.length
    ? Math.round(fcPoints.reduce((s, d) => s + d.predicted_price, 0) / fcPoints.length) : null
  const maxUpper    = fcPoints.length ? Math.max(...fcPoints.map(d => d.upper_bound)) : null
  const minLower    = fcPoints.length ? Math.min(...fcPoints.map(d => d.lower_bound)) : null

  // Phase 5: presentation-grade executive report (print/PDF modal)
  const [reportOpen, setReportOpen] = useState(false)
  // Phase 6: academic overview for professors/reviewers
  const [academicOpen, setAcademicOpen] = useState(false)

  return (
    <div id="forecast-page-root" className="space-y-5">

      {/* ── South India AI Market Pulse (Phase 4 command center) ── */}
      <div id="command-center">
        <MarketCommandCenter />
      </div>

      {/* ── Page header ──────────────────────────────────────── */}
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Price Forecast</h1>
          <p className="text-xs text-gray-400 mt-1 tracking-wide">
            South India · Prophet model · Historical + forward outlook
            <button onClick={() => setReportOpen(true)}
              className="ml-3 text-xs font-semibold text-primary-600 hover:text-primary-700 no-print">
              📑 Executive report
            </button>
            <button onClick={() => setAcademicOpen(true)}
              className="ml-3 text-xs font-semibold text-gray-500 hover:text-gray-700 no-print">
              🎓 Academic overview
            </button>
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {/* Tier badge — resolved for the CURRENT crop+state pair */}
          {pairTier && <TierBadge tier={pairTier} />}
          {/* model + risk pills only when this pair actually forecasts */}
          {pairReady && !isAnalyticsOnly && forecast && (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
              {forecast.method === 'sparse_trend' ? 'Trend Model' : 'Prophet'}
              {' · '}{forecast.training_rows?.toLocaleString()} training days
            </span>
          )}
          {pairReady && !isAnalyticsOnly && riskClass && (
            <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold border ${riskClass.cls}`}>
              {riskClass.icon} {riskClass.label}
            </span>
          )}
          {isRefetching && (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-blue-50 text-blue-600 border border-blue-200">
              <Spinner size="sm" className="w-3 h-3" />
              Generating…
            </span>
          )}
        </div>
      </div>

      {/* ── Selector controls ─────────────────────────────────── */}
      <Card>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">

          {/* Crop — category-grouped selector from the tier registry */}
          <SelectField
            label="Crop"
            value={crop}
            onChange={v => {
              setCrop(v)
              // jump to the crop's home state (its best data) on switch
              const cov = coverageForCrop(v)
              setState(cov?.state || 'Karnataka')
            }}
            disabled={isRefetching}
          >
            {categories.length > 0 ? (
              categories.map(cat => (
                <optgroup key={cat.key} label={cat.label}>
                  {cat.crops.map(c => (
                    <option key={c.crop} value={c.crop}>
                      {cropShortName(c.crop)}
                      {c.tier === 'B' ? '  ◑' : c.tier === 'C' ? '  ◔' : c.tier === 'D' ? '  ◇' : ''}
                    </option>
                  ))}
                </optgroup>
              ))
            ) : (
              // Fallback while coverage is loading
              TIER1_CROPS.map(c => <option key={c} value={c}>{c}</option>)
            )}
          </SelectField>

          <SelectField label="State" value={state} onChange={setState} disabled={isRefetching}>
            {SOUTH_INDIAN_STATES.map(s => <option key={s} value={s}>{s}</option>)}
          </SelectField>

          <SelectField label="Forecast Horizon" value={days} onChange={v => setDays(Number(v))} disabled={isRefetching || isAnalyticsOnly}>
            {HORIZON_OPTIONS.map(opt => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </SelectField>
        </div>

        {/* Per-pair diagnostics row — always crop+STATE specific */}
        {pairReady && pairSummary?.training_days != null && (
          <div className="mt-3 flex flex-wrap items-center gap-3 pt-3 border-t border-forest-900/[0.06] text-[11px] text-forest-900/40">
            <span>Training data ({state}): <strong className="text-gray-600">{pairSummary.training_days?.toLocaleString()} days</strong></span>
            <span>·</span>
            <span>Continuity: <strong className="text-gray-600">{pairSummary.continuity_score}%</strong> <span className="opacity-70">({pairSummary.recent_days_365} days in last year)</span></span>
            <span>·</span>
            <span>Volatility CV: <strong className="text-gray-600">{pairSummary.cv}%</strong></span>
            {pairSummary.anomaly_count != null && (
              <>
                <span>·</span>
                <span>Anomalies (90d): <strong className="text-gray-600">{pairSummary.anomaly_count}</strong></span>
              </>
            )}
            {pairSummary.reliability && !isAnalyticsOnly && (
              <>
                <span>·</span>
                <span>Model quality: <strong className="text-gray-600">{pairSummary.reliability}</strong></span>
              </>
            )}
          </div>
        )}
      </Card>

      {/* ── Tier B: moderate-forecast banner ─────────────────── */}
      {isModerateForecast && (
        <div className="flex items-start gap-3 p-3.5 bg-teal-50 border border-teal-100 rounded-xl">
          <span className="text-teal-600 shrink-0 mt-0.5">◑</span>
          <div>
            <p className="text-xs font-semibold text-teal-800 mb-0.5">Moderate forecast confidence — Tier B</p>
            <p className="text-xs text-teal-700 leading-relaxed">
              {crop} has <strong>{pairSummary?.training_days?.toLocaleString()} training days</strong> in {state},
              but only <strong>{pairSummary?.recent_days_365} reporting days in the last year</strong> ({pairSummary?.continuity_score}% continuity).
              Prophet runs on the full history, yet recent reporting gaps widen real-world uncertainty —
              interpret this forecast with added caution.
            </p>
          </div>
        </div>
      )}

      {/* ── Tier C: sparse-trend banner ───────────────────────── */}
      {isSparseTrend && (
        <div className="flex items-start gap-3 p-3.5 bg-amber-50 border border-amber-100 rounded-xl">
          <span className="text-amber-600 shrink-0 mt-0.5">◔</span>
          <div>
            <p className="text-xs font-semibold text-amber-800 mb-0.5">Sparse-trend estimate — Tier C</p>
            <p className="text-xs text-amber-700 leading-relaxed">
              {crop} reported on only <strong>{pairSummary?.recent_days_365} days in the last year</strong> in {state}
              {' '}({pairSummary?.continuity_score}% continuity) — too sparse for a reliable Prophet model.
              Showing an honest <strong>trend estimate</strong> instead: robust recent trend × historical seasonal
              pattern, with uncertainty that widens over the horizon. Treat it as directional guidance, not a price prediction.
            </p>
          </div>
        </div>
      )}

      {/* ── AI Forecast Copilot — forecast-capable modes only ──── */}
      {!loading && (
        <div id="ai-copilot" className="space-y-5">
          {!isAnalyticsOnly && (
            <AICopilotPanel
              insights={aiInsights}
              loading={aiLoading}
              isRefetching={aiRefetching}
              error={aiError}
            />
          )}

          {/* Smart AI insight cards (all modes, metric-derived) */}
          {pairReady && <SmartInsightCards cards={aiInsights?.insight_cards ?? []} />}

          {/* AI visual reasoning gauges (per-pair) */}
          {pairReady && !isAnalyticsOnly && (
            <AIGauges pairSummary={pairSummary} confidence={aiInsights?.confidence} />
          )}
        </div>
      )}

      {/* ── Phase 5: multi-agent orchestration + decision pipeline ── */}
      {!loading && pairReady && !isAnalyticsOnly && (
        <div id="agent-orchestrator" className="space-y-5">
          <AgentOrchestrator
            insights={aiInsights}
            forecast={forecast}
            crop={crop}
            state={state}
          />
          <ForecastDecisionPipeline
            insights={aiInsights}
            forecast={forecast}
            crop={crop}
            state={state}
          />
        </div>
      )}

      {loading && <PageLoader />}

      {/* ── Mode D: analytics-only intelligence (crop+state pair) ── */}
      {!loading && isAnalyticsOnly && (
        <>
          <AnalyticsIntelligencePanel
            crop={crop}
            state={state}
            regional={aiInsights?.regional}
            onSwitchState={(s) => setState(s)}
            onSwitchCrop={(c) => setCrop(c)}
            onAskAI={(prompt) => setChatPrompt(prompt)}
          />
          <AnalyticsOnlyPanel
            crop={crop}
            state={state}
            history={history}
            geoData={geoData}
            cropAnalytics={cropAnalytics}
          />
        </>
      )}

      {/* ── Forecast error state (only when the pair SHOULD forecast) ── */}
      {!loading && pairReady && !isAnalyticsOnly && error && (
        <ErrorState crop={crop} state={state} message={error} />
      )}

      {/* ── Full forecast view (Modes A/B/C) ───────────────────── */}
      {!loading && !isAnalyticsOnly && !error && forecast && (
        <div className={`space-y-5 transition-opacity duration-200 ${isRefetching ? 'opacity-40 pointer-events-none' : 'opacity-100'}`}>

          {/* KPI row */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard
              label="Last Recorded Price"
              value={lastPrice != null ? `${formatPrice(lastPrice)}/qtl` : '—'}
              sub={lastDate ? formatDateLong(lastDate) : null}
            />
            <StatCard
              label={`${days}-Day Avg Forecast`}
              value={avgForecast != null ? `${formatPrice(avgForecast)}/qtl` : '—'}
              sub="predicted mean"
              accent
            />
            <StatCard
              label="Confidence Range"
              value={minLower != null ? `${formatPrice(minLower)} – ${formatPrice(maxUpper)}` : '—'}
              sub="80% interval, full horizon"
            />
            <StatCard
              label="Training Data"
              value={forecast.training_rows?.toLocaleString() ?? '—'}
              sub="daily price observations"
            />
          </div>

          {/* Quality badges */}
          {insights && (
            <div className="flex flex-wrap gap-2">
              <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold border ${insights.signalCls}`}>
                {insights.signal === 'Bullish' ? '↑' : insights.signal === 'Bearish' ? '↓' : '→'} {insights.signal} Trend
              </span>
              <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold border ${
                insights.confLabel === 'High'   ? 'bg-emerald-50 border-emerald-200 text-emerald-700' :
                insights.confLabel === 'Medium' ? 'bg-amber-50 border-amber-200 text-amber-700' :
                                                  'bg-red-50 border-red-200 text-red-700'
              }`}>
                {insights.confLabel} Confidence
              </span>
              {cropAnalytics.forecastQuality && (
                <ReliabilityBadge
                  reliability={cropAnalytics.forecastQuality.reliability}
                  score={cropAnalytics.forecastQuality.score}
                />
              )}
              {cropAnalytics.seasonal && (
                <SeasonalPhaseBadge
                  phase={cropAnalytics.seasonal.current_phase}
                  vsNorm={cropAnalytics.seasonal.current_vs_norm}
                />
              )}
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold border bg-blue-50 border-blue-200 text-blue-700">
                ⚡ {forecast.method === 'sparse_trend' ? 'Trend Model' : 'Prophet'} · Cached
              </span>
            </div>
          )}

          {/* Forecast interpretation narrative */}
          {narrative && (
            <div className="p-4 bg-gray-50 border border-gray-100 rounded-xl">
              <div className="flex items-start gap-3">
                <span className="text-primary-400 mt-0.5 shrink-0 text-base">◈</span>
                <div>
                  <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-1">
                    Forecast Interpretation
                  </p>
                  <p className="text-sm text-gray-700 leading-relaxed">{narrative}</p>
                </div>
              </div>
            </div>
          )}

          {/* Forecast insight bullets */}
          {insights?.insights?.length > 0 && (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {insights.insights.map((txt, i) => (
                <div key={i} className="flex items-start gap-2.5 p-3 bg-gray-50 border border-gray-100 rounded-xl">
                  <span className="text-primary-400 mt-0.5 shrink-0 text-base">◈</span>
                  <p className="text-xs text-gray-600 leading-relaxed">{txt}</p>
                </div>
              ))}
            </div>
          )}

          {/* Main chart — with AI anomaly annotations on real points */}
          <div id="forecast-chart">
            <Card padding={false}>
              <div className="px-5 pt-5">
                <CardHeader
                  title={`${crop} · ${state}`}
                  subtitle={
                    forecast.method === 'sparse_trend'
                      ? `Last ${history.length} days of history + ${days}-day sparse-trend estimate with widening uncertainty band`
                      : `Last ${history.length} days of history + ${days}-day Prophet forecast with 80% confidence band`
                  }
                />
              </div>
              <div className="px-3 pb-5">
                <ForecastChart
                  history={history}
                  forecast={forecast}
                  annotations={chartAnnotations}
                />
              </div>
            </Card>
          </div>

          {/* ── Phase 5: Market Story Mode (AI analyst briefing) ── */}
          <div id="story-mode">
            <MarketStoryMode
              insights={aiInsights}
              forecast={forecast}
              crop={crop}
              state={state}
            />
          </div>

          {/* Seasonal intelligence */}
          {cropAnalytics.seasonal && !cropAnalytics.seasonal.error && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Card className="!p-4">
                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2">
                  Seasonal Pattern · {cropAnalytics.seasonal.state}
                </p>
                <div className="flex items-center gap-2 mb-2">
                  <SeasonalPhaseBadge
                    phase={cropAnalytics.seasonal.current_phase}
                    vsNorm={cropAnalytics.seasonal.current_vs_norm}
                  />
                </div>
                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div>
                    <p className="text-gray-400 text-[10px] uppercase tracking-wide mb-0.5">Peak months</p>
                    <p className="font-semibold text-gray-800">
                      {cropAnalytics.seasonal.peak_months?.join(', ')}
                      <span className="text-emerald-600 ml-1">(+{cropAnalytics.seasonal.peak_pct}%)</span>
                    </p>
                  </div>
                  <div>
                    <p className="text-gray-400 text-[10px] uppercase tracking-wide mb-0.5">Trough months</p>
                    <p className="font-semibold text-gray-800">
                      {cropAnalytics.seasonal.trough_months?.join(', ')}
                      <span className="text-amber-600 ml-1">({cropAnalytics.seasonal.trough_pct}%)</span>
                    </p>
                  </div>
                </div>
              </Card>

              {/* Recent anomaly events */}
              <Card className="!p-4">
                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2">
                  Recent Price Anomalies · {cropAnalytics.volatility?.state ?? state}
                </p>
                {cropAnalytics.anomalies.length > 0 ? (
                  <div className="space-y-1.5">
                    {cropAnalytics.anomalies.slice(0, 3).map((a, i) => (
                      <div key={i} className="flex items-center gap-2 py-1">
                        <span className="text-xs">{a.event_type === 'spike' ? '↑' : '↓'}</span>
                        <div className="flex-1 min-w-0">
                          <span className="text-xs font-semibold text-gray-800">
                            {a.pct_deviation > 0 ? '+' : ''}{a.pct_deviation}%
                          </span>
                          <span className="text-[10px] text-gray-400 ml-1">{a.date}</span>
                        </div>
                        <SeverityBadge severity={a.severity} />
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-emerald-600">✓ No anomalies in last 90 days</p>
                )}
              </Card>
            </div>
          )}

          {/* Cross-State Snapshot */}
          <section>
            <div className="flex items-center gap-3 mb-3">
              <h2 className="text-xs font-bold text-gray-500 uppercase tracking-widest">
                Cross-State Snapshot · {crop}
              </h2>
              <span className="text-[10px] bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full">
                current crop across all 5 states
              </span>
              {geoLoad && <Spinner size="sm" className="w-3.5 h-3.5 text-gray-400" />}
            </div>

            {geoData ? (
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
                {geoData.states.map(s => {
                  if (!s.available) {
                    return (
                      <Card key={s.state} className="!p-3.5 opacity-60">
                        <p className="text-xs font-bold text-gray-600 mb-1">{s.state}</p>
                        <p className="text-sm text-gray-400">Insufficient continuity</p>
                      </Card>
                    )
                  }
                  const isSelected = s.state === state
                  const trendCls =
                    s.trend === 'rising'  ? 'text-amber-600' :
                    s.trend === 'falling' ? 'text-emerald-600' : 'text-gray-500'
                  return (
                    <Card key={s.state}
                      className={`!p-3.5 ${isSelected ? 'border-primary-300 ring-1 ring-primary-200' : ''}`}>
                      <div className="flex items-start justify-between mb-1.5">
                        <p className="text-xs font-bold text-gray-800">{s.state}</p>
                        {isSelected && (
                          <span className="text-[9px] font-bold text-primary-700 bg-primary-50 px-1 py-0.5 rounded border border-primary-200">
                            Selected
                          </span>
                        )}
                      </div>
                      <p className="text-lg font-extrabold text-gray-900">
                        {formatPrice(s.avg_price)}
                        <span className="text-[10px] font-normal text-gray-400">/qtl</span>
                      </p>
                      <div className="flex items-center gap-1 mt-0.5">
                        <span className={`text-[10px] font-semibold ${trendCls}`}>
                          {s.trend === 'rising' ? '↑' : s.trend === 'falling' ? '↓' : '→'}
                          {' '}{s.change_pct > 0 ? '+' : ''}{s.change_pct}%
                        </span>
                      </div>
                      <div className="mt-2 pt-2 border-t border-gray-100 grid grid-cols-1 gap-0.5 text-[10px]">
                        <div className="flex justify-between">
                          <span className="text-gray-400">Reliability</span>
                          <span className="font-semibold text-gray-700">{s.reliability}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-400">Training</span>
                          <span className="font-semibold text-gray-700">{s.training_days?.toLocaleString()}d</span>
                        </div>
                      </div>
                    </Card>
                  )
                })}
              </div>
            ) : !geoLoad ? null : (
              <div className="h-24 bg-gray-50 rounded-xl border border-gray-100 flex items-center justify-center">
                <p className="text-xs text-gray-400">Loading cross-state data…</p>
              </div>
            )}
          </section>

          {/* Model metadata */}
          <Card>
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-3">
              Model & Data Details
            </p>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-x-8 gap-y-3 text-sm">
              <div>
                <span className="block text-xs text-gray-400 mb-0.5">Algorithm</span>
                <span className="font-medium text-gray-800">
                  {forecast.method === 'sparse_trend' ? 'Sparse Trend Estimator' : 'Facebook Prophet'}
                </span>
              </div>
              <div>
                <span className="block text-xs text-gray-400 mb-0.5">Seasonality</span>
                <span className="font-medium text-gray-800">
                  {forecast.method === 'sparse_trend' ? 'Monthly multipliers' : 'Multiplicative · Yearly'}
                </span>
              </div>
              <div>
                <span className="block text-xs text-gray-400 mb-0.5">Generated</span>
                <span className="font-medium text-gray-800">
                  {formatDateLong(forecast.generated_at?.slice(0, 10))}
                </span>
              </div>
              <div>
                <span className="block text-xs text-gray-400 mb-0.5">Data source</span>
                <span className="font-medium text-gray-800">AGMARKNET · 2015–2026</span>
              </div>
            </div>
            {insights && (
              <div className="mt-4 pt-4 border-t border-gray-100 grid grid-cols-2 sm:grid-cols-4 gap-x-8 gap-y-3 text-sm">
                <div>
                  <span className="block text-xs text-gray-400 mb-0.5">Training Days</span>
                  <span className="font-medium text-gray-800">{forecast.training_rows?.toLocaleString()}</span>
                </div>
                <div>
                  <span className="block text-xs text-gray-400 mb-0.5">History Shown</span>
                  <span className="font-medium text-gray-800">{history.length} days</span>
                </div>
                <div>
                  <span className="block text-xs text-gray-400 mb-0.5">Avg CI Width</span>
                  <span className={`font-medium ${insights.confCls}`}>
                    {Math.round(insights.ciPct)}% of forecast
                  </span>
                </div>
                <div>
                  <span className="block text-xs text-gray-400 mb-0.5">Data Quality</span>
                  <span className={`font-medium ${insights.dataCls}`}>{insights.dataQuality}</span>
                </div>
              </div>
            )}
          </Card>

        </div>
      )}

      {/* ── GenAI interactive layer (Phase 2 / 2.5 mode-aware) ── */}
      {!loading && (
        <>
          <section id="ai-tools">
            <h2 className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-3">
              AI Intelligence Tools
            </h2>
            <div className={`grid grid-cols-1 gap-5 ${isAnalyticsOnly ? '' : 'xl:grid-cols-2'}`}>
              {/* simulation needs a forecastable pair — hidden in Mode D */}
              {!isAnalyticsOnly && (
                <ScenarioSimulator crop={crop} state={state} days={days} />
              )}
              <AIChatPanel
                crop={crop}
                state={state}
                days={days}
                suggestedPrompts={aiInsights?.suggested_prompts ?? []}
                injectedPrompt={chatPrompt}
                onInjectedHandled={() => setChatPrompt(null)}
              />
            </div>
          </section>

          <CropComparison
            allCrops={coverageCrops}
            currentCrop={crop}
          />

          {/* ── Phase 4: Market Vision — executive visual intelligence ── */}
          <section id="market-vision" className="space-y-5">
            <h2 className="text-xs font-bold text-gray-500 uppercase tracking-widest">
              Market Vision · Executive Intelligence
            </h2>
            <OpportunityMatrix onSelectCrop={(c) => {
              setCrop(c)
              const cov = coverageForCrop(c)
              if (cov?.state) setState(cov.state)
            }} />
            <MarketHeatmap />
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
              <CropBattle currentCrop={crop} />
              <StrategyPlanner />
            </div>
            <MarketTimeline crop={crop} state={state} />
            <HowItThinks />
          </section>
        </>
      )}

      {/* ── Phase 5: presentation mode + executive report ─────── */}
      <PresentationMode
        onScenario={(c, s) => { setCrop(c); setState(s) }}
      />
      <ExecutiveReportModal
        crop={crop}
        state={state}
        days={days}
        open={reportOpen}
        onClose={() => setReportOpen(false)}
      />
      <AcademicOverview
        open={academicOpen}
        onClose={() => setAcademicOpen(false)}
      />

    </div>
  )
}
