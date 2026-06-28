import { useState, useEffect, memo } from 'react'
import { useNavigate } from 'react-router-dom'
import { LineChart, Line, ResponsiveContainer } from 'recharts'
import Card from '@components/ui/Card'
import { PageLoader, Spinner } from '@components/ui/Loader'
import { VolBadge, ReliabilityBadge, SeasonalPhaseBadge, ReadinessBadge } from '@components/ui/Badge'
import { useAnalytics } from '@hooks/useAnalytics'
import { useCrossAnalytics } from '@hooks/useCrossAnalytics'
import { formatPrice } from '@utils/formatters'
import {
  TIER1_CROPS, TIER2_CROPS, TIER3_CROPS, SOUTH_INDIAN_STATES,
  CROP_CATEGORIES, cropShortName, cropEmoji,
} from '@utils/constants'
import api from '@services/api'

// ── Static intelligence maps ──────────────────────────────────────────────────

const RELATED_CROPS = {
  'Tomato':                    ['Onion', 'Brinjal', 'Green Chilli'],
  'Onion':                     ['Tomato', 'Green Chilli', 'Brinjal'],
  'Banana':                    ['Coconut', 'Banana - Green'],
  'Brinjal':                   ['Tomato', 'Bhindi (Ladies Finger)', 'Bitter gourd'],
  'Green Chilli':              ['Tomato', 'Onion', 'Ginger (Green)'],
  'Paddy (Dhan)(Common)':      ['Maize', 'Tapioca'],
  'Bhindi (Ladies Finger)':    ['Brinjal', 'Drumstick', 'Carrot'],
  'Drumstick':                 ['Bhindi (Ladies Finger)', 'Cabbage'],
  'Coconut':                   ['Banana', 'Arecanut (Betelnut/Supari)'],
  'Ginger (Green)':            ['Green Chilli', 'Turmeric'],
  'Bitter gourd':              ['Brinjal', 'Bhindi (Ladies Finger)', 'Carrot'],
  'Carrot':                    ['Cabbage', 'Bitter gourd'],
  'Cabbage':                   ['Carrot', 'Drumstick'],
}

const EXPORT_SENSITIVE  = new Set(['Black pepper', 'Cardamoms', 'Coffee', 'Cotton', 'Turmeric'])
const MONSOON_DEPENDENT = new Set(['Paddy (Dhan)(Common)', 'Cotton', 'Maize', 'Coconut', 'Banana'])

// ── Intelligence derivation helpers ──────────────────────────────────────────

const CONFIDENCE_PHRASES = {
  'Excellent':      'Highly predictable',
  'Good':           'Strong historical consistency',
  'Moderate':       'Moderate predictability',
  'Low Confidence': 'Elevated uncertainty',
}
function getConfidenceLabel(reliability) {
  return CONFIDENCE_PHRASES[reliability] ?? 'Moderate predictability'
}

// Single-sentence insight optimised for fast scanning
function deriveCropSummary(cropName, cd, ca) {
  if (!cd) return null
  const vol      = cd.volatility_level ?? 'moderate'
  const momScore = cd.momentum_score ?? 0
  const signal   = ca?.momentum?.signal ?? null
  const phase    = ca?.seasonal?.current_phase ?? 'normal'
  const rel      = ca?.forecastQuality?.reliability ?? null

  if (vol === 'extreme')                       return 'Extreme volatility — prices can shift sharply between sessions.'
  if (vol === 'high' && momScore > 3)          return 'High volatility with strong upward momentum.'
  if (vol === 'high' && momScore < -3)         return 'High volatility with notable downward price pressure.'
  if (vol === 'stable' && rel === 'Excellent') return 'Stable, predictable pricing with high forecast confidence.'
  if (vol === 'stable')                        return 'Consistent pricing — low risk, reliable near-term forecasts.'
  if (phase === 'peak' && momScore > 2)        return 'Seasonal peak driving prices above historical norms.'
  if (phase === 'trough')                      return 'Seasonal trough — historically a procurement opportunity.'
  if (signal === 'Strong Uptrend' || momScore > 6) return 'Strong upward momentum — bullish short-term outlook.'
  if (momScore > 3)                            return 'Positive momentum — prices trending upward this week.'
  if (momScore < -3)                           return 'Downward price pressure visible in recent sessions.'
  return 'Moderate activity — mixed near-term signals.'
}

function deriveCognitiveTags(cropName, cd, analytics) {
  if (!cd) return []
  const anomalies = analytics?.anomalies?.filter(a => a.crop === cropName) ?? []
  const seasonal  = analytics?.seasonal?.find(s => s.crop === cropName)
  const momScore  = cd.momentum_score ?? 0
  const vol       = cd.volatility_level ?? 'moderate'
  const vsNorm    = seasonal?.current_vs_norm ?? 0
  const phase     = seasonal?.current_phase ?? 'normal'

  const candidates = [
    vol === 'extreme'                         && { label: 'Volatility Driven', color: 'red' },
    anomalies.length >= 2 && momScore > 3     && { label: 'Demand Surge',      color: 'purple' },
    momScore > 6                              && { label: 'Momentum Leader',   color: 'emerald' },
    vol === 'high'                            && { label: 'Volatility Driven', color: 'orange' },
    phase === 'peak' && Math.abs(vsNorm) > 10 && { label: 'Seasonal Watch',    color: 'amber' },
    phase === 'trough' && Math.abs(vsNorm)>10 && { label: 'Seasonal Watch',    color: 'blue' },
    EXPORT_SENSITIVE.has(cropName)            && { label: 'Export Sensitive',  color: 'indigo' },
    MONSOON_DEPENDENT.has(cropName)           && { label: 'Monsoon Dependent', color: 'teal' },
    momScore > 3 && (vol === 'stable' || vol === 'moderate') && { label: 'AI Opportunity', color: 'violet' },
  ]
  return candidates.filter(Boolean).slice(0, 2)
}

// Pool-based observation — picks the most contextually rich signal
function deriveObservation(crossData, analytics) {
  const leaders   = crossData?.market_leaders ?? {}
  const anomalies = analytics?.anomalies ?? []
  const seasonal  = analytics?.seasonal  ?? []
  const mv = leaders.most_volatile
  const fr = leaders.fastest_rising
  const ms = leaders.most_stable
  const bf = leaders.best_forecast

  const peakCrops   = seasonal.filter(s => s.current_phase === 'peak'   && Math.abs(s.current_vs_norm ?? 0) > 10)
  const troughCrops = seasonal.filter(s => s.current_phase === 'trough' && Math.abs(s.current_vs_norm ?? 0) > 10)
  const anonCrops   = [...new Set(anomalies.slice(0, 3).map(a => a.crop))]

  // Ranked pool — first truthy entry wins
  const pool = [
    // Both volatile + rising mover (most informative dual signal)
    mv && fr && mv.crop !== fr.crop &&
      `${mv.crop} leads South Indian market volatility. ${fr.crop} shows the strongest upward momentum — watch both for near-term moves.`,

    // Single crop dominates both signals
    mv && fr && mv.crop === fr.crop &&
      `${mv.crop} is the dominant market signal — combining peak volatility with the strongest price momentum across South India.`,

    // Multiple crops in seasonal peak
    peakCrops.length >= 2 &&
      `${peakCrops[0].crop} and ${peakCrops[1].crop} are in seasonal peak phase — prices elevated above historical norms. Selling window may be narrowing.`,

    // Single peak crop with stable contrast
    peakCrops.length === 1 && ms &&
      `${peakCrops[0].crop} is in seasonal peak, trading ${Math.abs(peakCrops[0].current_vs_norm ?? 0).toFixed(0)}% above norms. ${ms.crop} offers the most stable procurement option right now.`,

    // Anomaly cluster warning
    anomalies.length >= 3 &&
      `${anomalies.length} price anomalies detected this period — ${anonCrops.join(', ')} showing unusual price behaviour. Verify before trading.`,

    // Trough opportunity + rising signal
    troughCrops.length >= 1 && fr &&
      `${troughCrops[0].crop} is at seasonal trough — historically a buy opportunity. ${fr.crop} prices are rising fastest this week.`,

    // Stable vs volatile contrast
    ms && mv &&
      `${ms.crop} offers the most predictable pricing in South India this period. ${mv.crop} continues elevated volatility — risk-adjusted procurement favours stability.`,

    // Best forecast crop highlight
    bf &&
      `AI forecast confidence is strongest for ${bf.crop} — ${getConfidenceLabel('Excellent').toLowerCase()} pricing with a reliable 90-day outlook.`,
  ]

  const result = pool.find(Boolean)
  return result || 'AI is monitoring 27 crops across 5 South Indian states. No dominant signal detected — markets appear broadly stable.'
}

// ── AI sub-components ─────────────────────────────────────────────────────────

function AIObservationStrip({ text }) {
  if (!text) return null
  return (
    <div className="flex items-start gap-3 px-4 py-2.5 rounded-xl overflow-hidden"
      style={{ background: 'linear-gradient(135deg, rgba(22,58,45,0.05) 0%, rgba(31,81,63,0.03) 100%)', border: '1px solid rgba(22,58,45,0.10)', borderLeft: '3px solid #1b4332' }}>
      <div className="flex items-center gap-1.5 shrink-0 pt-[2px]">
        <span className="w-1.5 h-1.5 rounded-full bg-forest-600 animate-pulse" />
        <span className="text-[10px] font-bold text-forest-700 uppercase tracking-widest whitespace-nowrap opacity-70">
          AI Observation
        </span>
      </div>
      <p className="text-[12.5px] text-forest-900/70 leading-relaxed">{text}</p>
    </div>
  )
}

const TAG_STYLES = {
  emerald: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  red:     'bg-red-50     text-red-700     border-red-200',
  orange:  'bg-orange-50  text-orange-700  border-orange-200',
  amber:   'bg-amber-50   text-amber-700   border-amber-200',
  blue:    'bg-blue-50    text-blue-700    border-blue-200',
  indigo:  'bg-indigo-50  text-indigo-700  border-indigo-200',
  teal:    'bg-teal-50    text-teal-700    border-teal-200',
  purple:  'bg-purple-50  text-purple-700  border-purple-200',
  violet:  'bg-violet-50  text-violet-700  border-violet-200',
}

const CognitiveTag = memo(function CognitiveTag({ label, color = 'blue' }) {
  const style = TAG_STYLES[color] ?? TAG_STYLES.blue
  return (
    <span className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded border text-[9px] font-bold tracking-wide ${style}`}>
      <span className="opacity-40">✦</span>{label}
    </span>
  )
})

function AIActionFooter({ cropName }) {
  const navigate = useNavigate()
  const go = (e) => { e.stopPropagation(); navigate('/advisor') }
  return (
    <div className="flex items-center gap-0 pt-1.5 mt-1.5 border-t border-gray-100">
      <button onClick={go}
        className="text-[9px] font-medium text-forest-600 hover:text-forest-800 transition-colors">
        Ask AI
      </button>
      <span className="text-gray-200 mx-1.5">·</span>
      <button onClick={go}
        className="text-[9px] font-medium text-forest-600 hover:text-forest-800 transition-colors">
        Explain Trend
      </button>
    </div>
  )
}

function RelatedCropPills({ cropName, onSelect }) {
  const related = RELATED_CROPS[cropName] ?? []
  if (!related.length) return null
  return (
    <div className="mt-3 pt-3 border-t border-gray-100">
      <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-2">
        Related Crops
      </p>
      <div className="flex flex-wrap gap-1.5">
        {related.map(rc => (
          <button
            key={rc}
            onClick={() => TIER1_CROPS.includes(rc) && onSelect(rc)}
            className={`flex items-center gap-1 px-2 py-1 bg-gray-50 border border-gray-200 rounded-lg
              text-xs font-medium text-gray-600 transition-colors
              ${TIER1_CROPS.includes(rc)
                ? 'hover:bg-forest-50 hover:border-forest-200 hover:text-forest-700 cursor-pointer'
                : 'cursor-default opacity-60'
              }`}
          >
            <span className="text-sm leading-none">{cropEmoji(rc)}</span>
            <span>{cropShortName(rc)}</span>
          </button>
        ))}
      </div>
    </div>
  )
}

// ── Tiny inline sparkline ─────────────────────────────────────────────────────
function MiniSparkline({ data = [], color = '#22c55e' }) {
  if (!data.length) return <div className="h-7 bg-gray-50 rounded" />
  return (
    <ResponsiveContainer width="100%" height={28}>
      <LineChart data={data} margin={{ top: 1, right: 0, bottom: 1, left: 0 }}>
        <Line type="monotone" dataKey="price" stroke={color} strokeWidth={1.5}
          dot={false} isAnimationActive={false} />
      </LineChart>
    </ResponsiveContainer>
  )
}

// Aggregate coverage rows by crop
function processCoverage(rows = []) {
  const map = {}
  for (const row of rows) {
    if (!map[row.crop]) {
      map[row.crop] = { crop: row.crop, states: [], totalDays: 0, priceSum: 0, priceCount: 0, lastDate: '' }
    }
    map[row.crop].states.push(row.state)
    map[row.crop].totalDays += row.distinct_days ?? 0
    if (row.avg_price) { map[row.crop].priceSum += row.avg_price; map[row.crop].priceCount += 1 }
    if (row.last_date > map[row.crop].lastDate) map[row.crop].lastDate = row.last_date
  }
  for (const c of Object.values(map)) {
    c.avgPrice = c.priceCount > 0 ? Math.round(c.priceSum / c.priceCount) : null
    delete c.priceSum; delete c.priceCount
  }
  return map
}

const TIER1_COLORS = {
  'Tomato': '#f59e0b', 'Onion': '#8b5cf6', 'Banana': '#22c55e',
  'Brinjal': '#3b82f6', 'Green Chilli': '#ef4444',
}

// Category filter tabs — keys must match CROP_CATEGORIES keys in constants.js
const CATEGORY_TABS = [
  { key: 'all',       label: 'All Crops' },
  { key: 'vegetable', label: 'Vegetables' },
  { key: 'fruit',     label: 'Fruits & Specialty' },
  { key: 'grain',     label: 'Grains & Spices' },
  { key: 'cash',      label: 'Cash Crops' },
]

// ── Tier-2/3 compact analytics card ──────────────────────────────────────────
function AnalyticsCard({ crop, crossData: cd, tier, analytics }) {
  const tierCls = tier === 2
    ? 'text-blue-700 bg-blue-50 border-blue-200'
    : 'text-gray-500 bg-gray-50 border-gray-200'
  const tags = analytics ? deriveCognitiveTags(crop, cd, analytics) : []

  return (
    <div className="bg-white border border-gray-100 rounded-xl p-3 hover:border-gray-200 hover:shadow-sm transition-all">
      <div className="flex items-start justify-between mb-1.5">
        <div className="flex items-center gap-1.5 min-w-0">
          <span className="text-sm leading-none shrink-0">{cropEmoji(crop)}</span>
          <p className="text-xs font-bold text-gray-800 truncate">{cropShortName(crop)}</p>
        </div>
        <span className={`text-[9px] font-bold px-1 py-0.5 rounded border shrink-0 ml-1 ${tierCls}`}>
          T{tier}
        </span>
      </div>

      {cd?.avg_price ? (
        <p className="text-sm font-extrabold text-gray-900 mb-1.5">
          {formatPrice(cd.avg_price)}
          <span className="text-[10px] font-normal text-gray-400">/qtl</span>
        </p>
      ) : (
        <p className="text-sm text-gray-400 mb-1.5">—</p>
      )}

      {cd?.has_analytics && (
        <div className="flex items-center gap-1 mb-1.5 flex-wrap">
          <VolBadge level={cd.volatility_level} badge={cd.volatility_badge} />
          <span className={`text-[9px] font-semibold px-1 py-0.5 rounded border ${
            cd.momentum_score > 3  ? 'bg-amber-50 text-amber-700 border-amber-200' :
            cd.momentum_score < -3 ? 'bg-emerald-50 text-emerald-700 border-emerald-200' :
                                     'bg-gray-50 text-gray-500 border-gray-200'
          }`}>
            {cd.momentum_short} {cd.momentum_score > 0 ? '+' : ''}{cd.momentum_score?.toFixed(1)}%
          </span>
        </div>
      )}

      {tags.length > 0 && (
        <div className="mb-1.5">
          <CognitiveTag label={tags[0].label} color={tags[0].color} />
        </div>
      )}

      {cd ? (
        <ReadinessBadge readiness={cd.readiness} level={cd.readiness_level} />
      ) : (
        <div className="h-4 w-24 bg-gray-100 rounded animate-pulse" />
      )}

      <p className="text-[10px] text-gray-400 mt-1.5">
        {cd?.training_days ? `${cd.training_days.toLocaleString()}d · ${cd.state}` : 'Loading…'}
      </p>
    </div>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function CropExplorer() {
  const [coverage,  setCoverage]  = useState({})
  const [pulse,     setPulse]     = useState({})
  const [selected,  setSelected]  = useState(null)
  const [loading,   setLoading]   = useState(true)
  const [search,    setSearch]    = useState('')
  const [category,  setCategory]  = useState('all')
  const { analytics, forCrop }    = useAnalytics()
  const { data: crossData, loading: crossLoading, forCrop: forCrossData } = useCrossAnalytics()

  useEffect(() => {
    const cropQ = TIER1_CROPS.map(c => `crops=${encodeURIComponent(c)}`).join('&')
    Promise.all([
      api.get(`/api/crops/coverage?${cropQ}`),
      api.get('/api/prices/market-pulse'),
    ])
      .then(([covRes, pulseRes]) => {
        setCoverage(processCoverage(covRes.data.coverage))
        const pm = {}
        for (const p of pulseRes.data) pm[p.crop] = p
        setPulse(pm)
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  if (loading) return <PageLoader />

  const maxStates    = SOUTH_INDIAN_STATES.length
  const selectedData = selected ? coverage[selected] : null

  const matchesCrop = (name) =>
    !search || name.toLowerCase().includes(search.toLowerCase()) ||
    cropShortName(name).toLowerCase().includes(search.toLowerCase())

  const matchesCat = (name) => {
    if (category === 'all') return true
    if (category === 'vegetable')
      return CROP_CATEGORIES.vegetable?.crops.includes(name) || CROP_CATEGORIES.core?.crops.includes(name)
    if (category === 'grain')
      return CROP_CATEGORIES.grain?.crops.includes(name) || CROP_CATEGORIES.cash?.crops.includes(name)
    return CROP_CATEGORIES[category]?.crops.includes(name) ?? false
  }

  const visTier1  = TIER1_CROPS.filter(c => matchesCrop(c) && matchesCat(c))
  const visTier2  = TIER2_CROPS.filter(c => matchesCrop(c) && matchesCat(c))
  const visTier3  = TIER3_CROPS.filter(c => matchesCrop(c) && matchesCat(c))
  const noResults = search && !visTier1.length && !visTier2.length && !visTier3.length

  const observation = deriveObservation(crossData, analytics)

  return (
    <div className="space-y-5">

      {/* ── Header ───────────────────────────────────────── */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Crop Explorer</h1>
        <p className="text-sm text-gray-500 mt-0.5">
          AI-assisted crop discovery across South Indian markets
        </p>
      </div>

      {/* ── AI Observation strip ──────────────────────────── */}
      {!crossLoading && <AIObservationStrip text={observation} />}

      {/* ── Summary stats ────────────────────────────────── */}
      <div className="grid grid-cols-3 gap-3">
        <Card className="!p-3.5 transition-all duration-200 hover:-translate-y-0.5">
          <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-1">Forecast-Ready</p>
          <p className="text-2xl font-bold text-gray-900">{TIER1_CROPS.length}</p>
          <p className="text-[10px] text-gray-400 mt-0.5">Tier-1 · Prophet AI</p>
        </Card>
        <Card className="!p-3.5 transition-all duration-200 hover:-translate-y-0.5">
          <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-1">Analytics-Ready</p>
          <p className="text-2xl font-bold text-gray-900">{TIER2_CROPS.length}</p>
          <p className="text-[10px] text-gray-400 mt-0.5">Tier-2 · trend & volatility</p>
        </Card>
        <Card className="!p-3.5 transition-all duration-200 hover:-translate-y-0.5">
          <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-1">Crops Tracked</p>
          <p className="text-2xl font-bold text-gray-900">
            {TIER1_CROPS.length + TIER2_CROPS.length + TIER3_CROPS.length}
          </p>
          <p className="text-[10px] text-gray-400 mt-0.5">5 South Indian states</p>
        </Card>
      </div>

      {/* ── Search + Category filter ──────────────────────── */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-48">
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search crops…"
            className="w-full border border-forest-900/10 rounded-xl px-3 py-2 text-sm text-gray-800 bg-white/80
                       placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-forest-500/30 focus:border-forest-400/40 transition-all duration-150"
          />
          {search && (
            <button onClick={() => setSearch('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 text-xs">
              ✕
            </button>
          )}
        </div>
        <div className="flex gap-1.5 flex-wrap">
          {CATEGORY_TABS.map(tab => (
            <button
              key={tab.key}
              onClick={() => setCategory(tab.key)}
              className={`px-3 py-1.5 text-xs font-medium rounded-xl border transition-all duration-150 ${
                category === tab.key
                  ? 'btn-forest'
                  : 'bg-white/80 text-gray-600 border-forest-900/10 hover:border-forest-300 hover:text-forest-800 hover:bg-forest-50'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* ── No-results state ─────────────────────────────── */}
      {noResults && (
        <div className="flex flex-col items-center justify-center py-10 text-center">
          <p className="text-2xl mb-2">🌾</p>
          <p className="text-sm font-semibold text-gray-600">No crops match "{search}"</p>
          <p className="text-xs text-gray-400 mt-1">Try a different name or clear the search</p>
          <button onClick={() => setSearch('')}
            className="mt-3 text-xs text-primary-600 hover:text-primary-700 font-medium">
            Clear search
          </button>
        </div>
      )}

      {/* ── Tier 1 — Forecast Ready ───────────────────────── */}
      {visTier1.length > 0 && (
        <section>
          <div className="flex items-center gap-2 mb-3">
            <h2 className="text-xs font-bold text-gray-400 uppercase tracking-widest">
              Tier 1 — Forecast Ready
            </h2>
            <span className="text-[10px] bg-emerald-50 text-emerald-700 border border-emerald-200 px-2 py-0.5 rounded-full font-medium">
              Prophet · 30–90 day horizon
            </span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
            {visTier1.map(cropName => {
              const cov      = coverage[cropName] ?? {}
              const pls      = pulse[cropName]
              const stateN   = cov.states?.length ?? 0
              const pct      = Math.round((stateN / maxStates) * 100)
              const color    = TIER1_COLORS[cropName] ?? '#22c55e'
              const isActive = selected === cropName
              const ca       = analytics ? forCrop(cropName) : {}
              const cd       = forCrossData(cropName)
              const summary  = analytics && cd ? deriveCropSummary(cropName, cd, ca) : null
              const tags     = (analytics || cd) ? deriveCognitiveTags(cropName, cd ?? {}, analytics) : []
              const rising   = pls?.trend === 'rising'
              const falling  = pls?.trend === 'falling'

              return (
                <div
                  key={cropName}
                  onClick={() => setSelected(isActive ? null : cropName)}
                  className={`card-premium rounded-2xl inner-glow p-3.5 cursor-pointer
                    transition-all duration-200
                    ${isActive
                      ? 'border-forest-400/40 ring-1 ring-forest-300/40 shadow-lg -translate-y-0.5'
                      : 'hover:shadow-lg hover:-translate-y-1'
                    }`}
                >
                  {/* 1. Crop name + tier badge */}
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-1.5 min-w-0">
                      <span className="text-base leading-none shrink-0">{cropEmoji(cropName)}</span>
                      <p className="text-xs font-bold text-gray-900 truncate">{cropName}</p>
                    </div>
                    <span className="text-[10px] font-bold text-forest-700 bg-forest-50 border border-forest-200 px-1.5 py-0.5 rounded shrink-0 ml-1">
                      T1
                    </span>
                  </div>

                  {/* 2. Price + 7d change on one line */}
                  <div className="flex items-baseline gap-2 mb-2">
                    {cov.avgPrice ? (
                      <p className="text-xl font-extrabold text-gray-900 leading-none">
                        {formatPrice(cov.avgPrice)}
                        <span className="text-[10px] font-normal text-gray-400">/qtl</span>
                      </p>
                    ) : (
                      <p className="text-sm text-gray-300">—</p>
                    )}
                    {pls && (
                      <span className={`text-[10px] font-semibold leading-none ${
                        rising ? 'text-amber-500' : falling ? 'text-emerald-500' : 'text-gray-400'
                      }`}>
                        {pls.change_pct > 0 ? '+' : ''}{pls.change_pct}%
                      </span>
                    )}
                  </div>

                  {/* 3. Sparkline */}
                  {pls?.sparkline?.length > 0 && (
                    <div className="-mx-0.5 mb-2">
                      <MiniSparkline data={pls.sparkline} color={color} />
                    </div>
                  )}

                  {/* 4. AI single-line insight */}
                  {summary && (
                    <p className="text-[11px] text-gray-500 leading-snug mb-1.5">
                      {summary}
                    </p>
                  )}

                  {/* 5. Cognitive tags (max 2) */}
                  {tags.length > 0 && (
                    <div className="flex flex-wrap gap-1 mb-2">
                      {tags.map(t => (
                        <CognitiveTag key={t.label} label={t.label} color={t.color} />
                      ))}
                    </div>
                  )}

                  {/* 6. Coverage bar */}
                  <div className="mb-0">
                    <div className="flex justify-between text-[10px] text-gray-400 mb-0.5">
                      <span>{stateN}/{maxStates} states</span>
                      <span style={{ color }}>{pct}%</span>
                    </div>
                    <div className="h-1 rounded-full bg-gray-100 overflow-hidden">
                      <div className="h-full rounded-full transition-all"
                        style={{ width: `${pct}%`, backgroundColor: color }} />
                    </div>
                  </div>

                  {/* 7. AI action footer */}
                  <AIActionFooter cropName={cropName} />
                </div>
              )
            })}
          </div>
        </section>
      )}

      {/* ── Selected Tier-1 crop detail panel ─────────────── */}
      {selected && selectedData && (
        <Card>
          <div className="flex items-start justify-between mb-3">
            <div>
              <h3 className="text-sm font-bold text-gray-900">
                {cropEmoji(selected)} {selected} — Coverage Detail
              </h3>
              <p className="text-xs text-gray-500 mt-0.5">
                {selectedData.states.length} state(s)
                {selectedData.avgPrice ? ` · Avg ${formatPrice(selectedData.avgPrice)}/qtl` : ''}
                {' · '}{selectedData.totalDays?.toLocaleString()} trading days
                {' · '}Last: {selectedData.lastDate ?? '—'}
              </p>
            </div>
            <button onClick={() => setSelected(null)}
              className="text-gray-400 hover:text-gray-600 text-xs shrink-0 ml-2">✕</button>
          </div>

          <div className="flex flex-wrap gap-1.5">
            {selectedData.states.map(st => (
              <span key={st}
                className="flex items-center gap-1.5 px-2.5 py-1 bg-gray-50 border border-gray-200 rounded-lg text-xs font-medium text-gray-700">
                <span className="w-1.5 h-1.5 rounded-full bg-primary-400" />
                {st}
              </span>
            ))}
          </div>

          {pulse[selected] && (
            <div className="mt-3 grid grid-cols-2 sm:grid-cols-4 gap-3 pt-3 border-t border-gray-100">
              {[
                { label: '30d Avg Price',   value: `${formatPrice(pulse[selected].avg_price)}/qtl` },
                { label: '7d Change',       value: `${pulse[selected].change_pct > 0 ? '+' : ''}${pulse[selected].change_pct}%` },
                { label: 'Volatility CV',   value: `${pulse[selected].volatility_pct}%` },
                { label: 'Price Stability', value: getConfidenceLabel(
                    pulse[selected].volatility_level === 'stable'   ? 'Excellent' :
                    pulse[selected].volatility_level === 'moderate' ? 'Good'      :
                    pulse[selected].volatility_level === 'high'     ? 'Moderate'  : 'Low Confidence'
                  )},
              ].map(m => (
                <div key={m.label}>
                  <p className="text-[10px] text-gray-400 uppercase tracking-wide">{m.label}</p>
                  <p className="text-sm font-bold text-gray-800 mt-0.5">{m.value}</p>
                </div>
              ))}
            </div>
          )}

          {analytics && (() => {
            const ca = forCrop(selected)
            if (!ca.seasonal || ca.seasonal.error) return null
            return (
              <div className="mt-3 pt-3 border-t border-gray-100 flex items-center gap-2 flex-wrap">
                <SeasonalPhaseBadge phase={ca.seasonal.current_phase} vsNorm={ca.seasonal.current_vs_norm} />
                <span className="text-xs text-gray-500">
                  Peak: {ca.seasonal.peak_months?.join(', ')} (+{ca.seasonal.peak_pct}%)
                  {' · '}Trough: {ca.seasonal.trough_months?.join(', ')} ({ca.seasonal.trough_pct}%)
                </span>
              </div>
            )
          })()}

          <RelatedCropPills cropName={selected} onSelect={(rc) => setSelected(rc)} />
        </Card>
      )}

      {/* ── Tier 2 — Analytics Ready ──────────────────────── */}
      {visTier2.length > 0 && (
        <section>
          <div className="flex items-center gap-2 mb-3">
            <h2 className="text-xs font-bold text-gray-400 uppercase tracking-widest">
              Tier 2 — Analytics Ready
            </h2>
            <span className="text-[10px] bg-blue-50 text-blue-700 border border-blue-200 px-2 py-0.5 rounded-full font-medium">
              Trend · Volatility · Seasonal
            </span>
            {crossLoading && <Spinner size="sm" className="w-3.5 h-3.5 text-gray-400" />}
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-2.5">
            {visTier2.map(cropName => (
              <AnalyticsCard
                key={cropName}
                crop={cropName}
                crossData={forCrossData(cropName)}
                tier={2}
                analytics={analytics}
              />
            ))}
          </div>
        </section>
      )}

      {/* ── Tier 3 — Niche & Sparse ──────────────────────── */}
      {visTier3.length > 0 && (
        <section>
          <div className="flex items-center gap-2 mb-3">
            <h2 className="text-xs font-bold text-gray-400 uppercase tracking-widest">
              Tier 3 — Niche & Sparse
            </h2>
            <span className="text-[10px] bg-gray-100 text-gray-500 border border-gray-200 px-2 py-0.5 rounded-full font-medium">
              Limited data · regional specialties
            </span>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 xl:grid-cols-7 gap-2">
            {visTier3.map(cropName => {
              const cd = forCrossData(cropName)
              return (
                <div key={cropName}
                  className="bg-white border border-gray-100 rounded-lg px-3 py-2.5 hover:border-gray-200 transition-colors">
                  <div className="flex items-center gap-1.5 mb-1.5">
                    <span className="text-sm leading-none">{cropEmoji(cropName)}</span>
                    <p className="text-xs font-semibold text-gray-700 truncate">{cropShortName(cropName)}</p>
                  </div>
                  {cd ? (
                    <ReadinessBadge readiness={cd.readiness} level={cd.readiness_level} />
                  ) : (
                    <div className="h-4 w-20 bg-gray-100 rounded animate-pulse" />
                  )}
                  {EXPORT_SENSITIVE.has(cropName) && (
                    <div className="mt-1.5">
                      <CognitiveTag label="Export Sensitive" color="indigo" />
                    </div>
                  )}
                  {MONSOON_DEPENDENT.has(cropName) && !EXPORT_SENSITIVE.has(cropName) && (
                    <div className="mt-1.5">
                      <CognitiveTag label="Monsoon Dependent" color="teal" />
                    </div>
                  )}
                  {cd?.training_days > 0 && (
                    <p className="text-[10px] text-gray-400 mt-1.5">{cd.training_days.toLocaleString()}d</p>
                  )}
                </div>
              )
            })}
          </div>
        </section>
      )}

    </div>
  )
}
