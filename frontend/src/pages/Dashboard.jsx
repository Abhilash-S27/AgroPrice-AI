import { useState, useEffect, useMemo } from 'react'
import { LineChart, Line, ResponsiveContainer } from 'recharts'
import Card from '@components/ui/Card'
import { PageLoader, Spinner } from '@components/ui/Loader'
import { MomentumChip } from '@components/ui/Badge'
import { formatPrice } from '@utils/formatters'
import { PHASE4_ALL_CROPS, SOUTH_INDIAN_STATES, cropShortName } from '@utils/constants'
import api from '@services/api'

// ── Signal tag config ─────────────────────────────────────────────────────────
const SIGNAL_TAG_CFG = {
  'Momentum Leader':   'text-amber-700 bg-amber-50 border-amber-200',
  'Seasonal Peak':     'text-purple-700 bg-purple-50 border-purple-200',
  'Stable Asset':      'text-emerald-700 bg-emerald-50 border-emerald-200',
  'Demand Spike':      'text-red-700 bg-red-50 border-red-200',
  'Forecast Reliable': 'text-blue-700 bg-blue-50 border-blue-200',
  'Weak Confidence':   'text-gray-500 bg-gray-50 border-gray-200',
  'Seasonal Pressure': 'text-orange-700 bg-orange-50 border-orange-200',
  'Volatility Risk':   'text-red-600 bg-red-50 border-red-200',
  'Price Gainer':      'text-amber-600 bg-amber-50 border-amber-200',
  'Export Sensitive':  'text-indigo-700 bg-indigo-50 border-indigo-200',
}

function SignalTag({ tag }) {
  if (!tag) return null
  const cls = SIGNAL_TAG_CFG[tag] ?? 'text-gray-500 bg-gray-50 border-gray-200'
  return (
    <span className={`inline-block text-[9px] font-bold px-1.5 py-0.5 rounded border shrink-0 leading-tight tracking-wide ${cls}`}>
      {tag}
    </span>
  )
}

// ── Section header — consistent across all sections ───────────────────────────
function SectionHeader({ title, badge, live = false, spinner = false }) {
  return (
    <div className="flex items-center gap-2.5 mb-3">
      <span className="w-0.5 h-3.5 rounded-full bg-forest-700 opacity-60 shrink-0" />
      <h2 className="text-[10px] font-bold text-forest-900 uppercase tracking-widest opacity-60">{title}</h2>
      {badge && (
        <span className="text-[10px] bg-forest-50 text-forest-700 border border-forest-900/10 px-2 py-0.5 rounded-full font-medium">
          {badge}
        </span>
      )}
      {live && (
        <span className="relative flex h-1.5 w-1.5 shrink-0">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-60" />
          <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-500" />
        </span>
      )}
      {spinner && <Spinner size="sm" className="w-3.5 h-3.5 text-gray-400" />}
    </div>
  )
}

// ── Tiny sparkline — no axes, no grid ─────────────────────────────────────────
function Sparkline({ data = [], trend = 'stable' }) {
  const color = trend === 'rising' ? '#f59e0b' : trend === 'falling' ? '#22c55e' : '#9ca3af'
  if (!data.length) return <div className="h-10 bg-gray-50 rounded" />
  return (
    <ResponsiveContainer width="100%" height={40}>
      <LineChart data={data} margin={{ top: 2, right: 0, bottom: 2, left: 0 }}>
        <Line type="monotone" dataKey="price" stroke={color} strokeWidth={1.5}
          dot={false} isAnimationActive={false} />
      </LineChart>
    </ResponsiveContainer>
  )
}

// ── Trend chip ────────────────────────────────────────────────────────────────
function TrendChip({ trend, changePct }) {
  const cfg = {
    rising:  { text: 'text-amber-700',   bg: 'bg-amber-50 border-amber-200',    arrow: '↑' },
    falling: { text: 'text-emerald-700', bg: 'bg-emerald-50 border-emerald-200', arrow: '↓' },
    stable:  { text: 'text-gray-600',    bg: 'bg-gray-50 border-gray-200',       arrow: '→' },
  }
  const c = cfg[trend] ?? cfg.stable
  const sign = changePct > 0 ? '+' : ''
  return (
    <span className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded border text-xs font-semibold ${c.bg} ${c.text}`}>
      {c.arrow} {sign}{Number(changePct).toFixed(1)}%
    </span>
  )
}

// ── Volatility pill ───────────────────────────────────────────────────────────
function VolPill({ level }) {
  const cfg = {
    low:    'bg-emerald-50 text-emerald-700 border-emerald-200',
    medium: 'bg-amber-50 text-amber-700 border-amber-200',
    high:   'bg-red-50 text-red-700 border-red-200',
  }
  return (
    <span className={`inline-flex items-center px-1.5 py-0.5 rounded border text-[10px] font-medium ${cfg[level] ?? cfg.medium}`}>
      {level} vol
    </span>
  )
}

// ── Stat card ─────────────────────────────────────────────────────────────────
const STAT_ICONS = {
  'Total Records':  { icon: '📊', glow: 'rgba(52,211,153,0.28)',  bg: 'linear-gradient(135deg,rgba(16,185,129,0.30),rgba(20,120,255,0.22))' },
  'Crops Tracked':  { icon: '🌾', glow: 'rgba(167,139,250,0.30)', bg: 'linear-gradient(135deg,rgba(88,28,135,0.80),rgba(60,20,100,0.90))' },
  'Highest Priced': { icon: '💰', glow: 'rgba(251,191,36,0.30)',  bg: 'linear-gradient(135deg,rgba(120,53,15,0.80),rgba(90,35,10,0.90))' },
  'Most Volatile':  { icon: '⚡', glow: 'rgba(252,165,165,0.30)', bg: 'linear-gradient(135deg,rgba(127,29,29,0.80),rgba(100,20,20,0.90))' },
}

function StatCard({ label, value, sub, border = false }) {
  const meta = STAT_ICONS[label]
  return (
    <Card className={`!p-4 transition-all duration-200 hover:-translate-y-1 ${border ? 'border-l-2 border-l-forest-400' : ''}`}>
      <div className="flex items-start gap-3">
        {meta && (
          <div className="w-9 h-9 rounded-xl flex items-center justify-center text-base shrink-0"
            style={{ background: meta.bg, boxShadow: `0 4px 14px ${meta.glow}` }}>
            {meta.icon}
          </div>
        )}
        <div className="min-w-0">
          <p className="text-[10px] font-bold uppercase tracking-widest mb-1" style={{ color: 'rgba(255,255,255,0.34)' }}>{label}</p>
          <p className="text-xl font-extrabold leading-tight tracking-tight" style={{ color: 'rgba(255,255,255,0.93)' }}>{value}</p>
          {sub && <p className="text-[11px] mt-0.5" style={{ color: 'rgba(255,255,255,0.32)' }}>{sub}</p>}
        </div>
      </div>
    </Card>
  )
}

// ── Market Leader card ────────────────────────────────────────────────────────
function LeaderCard({ label, cropName, metric, metricLabel, accentCls, tag }) {
  return (
    <Card className="!p-3.5 transition-all duration-200 hover:-translate-y-1 hover:shadow-lg">
      <p className="text-[9px] font-bold text-forest-700 uppercase tracking-widest mb-1.5 opacity-50">{label}</p>
      {cropName ? (
        <>
          <div className="flex items-start justify-between gap-1 mb-1">
            <p className="text-sm font-bold text-gray-900 leading-tight">{cropName}</p>
            <SignalTag tag={tag} />
          </div>
          {metric != null && (
            <p className={`text-xs font-bold mt-0.5 ${accentCls}`}>{metric}</p>
          )}
          {metricLabel && (
            <p className="text-[10px] text-gray-400 mt-0.5">{metricLabel}</p>
          )}
        </>
      ) : (
        <p className="text-sm text-gray-300">—</p>
      )}
    </Card>
  )
}

// ── Heatmap cell ──────────────────────────────────────────────────────────────
function HeatCell({ days }) {
  const bg =
    days == null  ? 'bg-gray-50 text-gray-300' :
    days >= 2000  ? 'bg-emerald-100 text-emerald-700' :
    days >= 500   ? 'bg-blue-50 text-blue-600' :
    days >= 90    ? 'bg-amber-50 text-amber-700' :
    days > 0      ? 'bg-orange-50 text-orange-600' :
                    'bg-gray-50 text-gray-300'
  return (
    <div className={`rounded text-center py-1 px-1 text-[9px] font-semibold leading-none ${bg}`}>
      {days == null ? '—' : days >= 1000 ? `${(days / 1000).toFixed(1)}k` : days}
    </div>
  )
}

const TIER1_SET = new Set(['Tomato', 'Onion', 'Banana', 'Brinjal', 'Green Chilli'])
const TIER2_SET = new Set(['Paddy (Dhan)(Common)', 'Bhindi (Ladies Finger)', 'Drumstick',
  'Coconut', 'Ginger (Green)', 'Bitter gourd', 'Carrot', 'Cabbage'])
const cropTier = (c) => TIER1_SET.has(c) ? 1 : TIER2_SET.has(c) ? 2 : 3

const CROP_HOME_STATE = {
  'Tomato':      'Karnataka',
  'Onion':       'Tamil Nadu',
  'Banana':      'Kerala',
  'Brinjal':     'Telangana',
  'Green Chilli':'Andhra Pradesh',
}

const STATE_ABBR = {
  'Tamil Nadu': 'T.N.', 'Karnataka': 'KA', 'Andhra Pradesh': 'A.P.',
  'Telangana': 'TS', 'Kerala': 'KL',
}

// ── AI Brief sentence generator ───────────────────────────────────────────────
function generateBrief(pulse, analytics, regime) {
  if (!pulse.length || !regime) return null
  const { rising, falling, stable, topMom, topAnomaly, sentiment } = regime
  const total = pulse.length

  if (topAnomaly && (topAnomaly.severity === 'high' || Math.abs(topAnomaly.pct_deviation) > 20)) {
    const dir = topAnomaly.event_type === 'spike' ? 'upside dislocation' : 'sharp correction'
    return `${topAnomaly.crop} in ${topAnomaly.state} registers ${dir} (z-score ${topAnomaly.z_score}) as broader markets maintain a ${sentiment.toLowerCase()} stance.`
  }
  if (topMom && topMom.score > 10 && rising.length >= falling.length) {
    const peer = rising.find(p => p.crop !== topMom.crop)
    const stabilizer = stable[0]
    if (peer && stabilizer) {
      return `Momentum is concentrated in ${topMom.crop} and ${peer.crop} as ${stabilizer.crop} pricing continues to stabilize.`
    }
    if (peer) {
      return `${topMom.crop} and ${peer.crop} drive a ${rising.length}-crop advance as seasonal conditions persist elsewhere.`
    }
    return `${topMom.crop} leads momentum (${topMom.score > 0 ? '+' : ''}${topMom.score}%) as South India markets remain broadly ${sentiment.toLowerCase()}.`
  }
  if (rising.length > total * 0.55) {
    const leader = topMom?.crop ?? rising[0]?.crop ?? 'select crops'
    return `South India mandis post a ${rising.length}-crop advance led by ${leader}; seasonal momentum remains intact.`
  }
  if (falling.length > total * 0.55) {
    const anchor = stable[0]?.crop ?? 'select benchmarks'
    return `Post-harvest supply pressure extends across ${falling.length} crops; ${anchor} holds the most stable ground.`
  }
  if (stable.length >= 2) {
    const leaders = rising.slice(0, 2).map(p => p.crop).join(' and ')
    return `Markets rotate without a dominant theme; ${leaders || 'select crops'} retain relative strength amid consolidated pricing.`
  }
  return `South India agricultural markets maintain a ${sentiment.toLowerCase()} disposition across ${total} tracked crop benchmarks.`
}

// ── AI Regime classifier ──────────────────────────────────────────────────────
function classifyAIRegime(pulse, analytics, regime) {
  if (!regime) return null
  const { rising, falling, stable } = regime
  const total        = pulse.length
  const anomalyCount = analytics?.anomalies?.length ?? 0
  const highVolCount = pulse.filter(p => p.volatility_level === 'high').length

  if (highVolCount >= 2 || anomalyCount >= 3) {
    return {
      regimeName:     'Volatility Expansion',
      confidence:     anomalyCount >= 4 ? 'High' : 'Moderate',
      dirBias:        rising.length >= falling.length ? 'Upside-biased' : 'Downside-biased',
      interpretation: 'Price discovery is disorderly; caution warranted on short-term exposure.',
      cls:            'text-red-700 bg-red-50 border-red-200',
    }
  }
  if (rising.length > total * 0.55 && highVolCount <= 1) {
    return {
      regimeName:     'Momentum-Led Market',
      confidence:     rising.length >= 4 ? 'High' : 'Moderate',
      dirBias:        'Bullish',
      interpretation: 'Broad price leadership intact; near-term selling windows warranted.',
      cls:            'text-amber-700 bg-amber-50 border-amber-200',
    }
  }
  if (falling.length > total * 0.55) {
    return {
      regimeName:     'Defensive Pricing Phase',
      confidence:     falling.length >= 4 ? 'High' : 'Moderate',
      dirBias:        'Bearish',
      interpretation: 'Supply pressure dominant; procurement opportunities emerging for buyers.',
      cls:            'text-emerald-700 bg-emerald-50 border-emerald-200',
    }
  }
  if (stable.length >= 2 && highVolCount === 0) {
    return {
      regimeName:     'Stable Consolidation',
      confidence:     'High',
      dirBias:        'Neutral',
      interpretation: 'Markets in equilibrium; seasonal transitions likely near-term catalyst.',
      cls:            'text-blue-700 bg-blue-50 border-blue-200',
    }
  }
  return {
    regimeName:     'Mixed Rotation',
    confidence:     'Moderate',
    dirBias:        rising.length >= falling.length ? 'Mild Bullish' : 'Mild Bearish',
    interpretation: 'No dominant theme; monitor individual crop momentum for selective opportunities.',
    cls:            'text-gray-600 bg-gray-50 border-gray-200',
  }
}

// ── Per-crop signal tag derivation ────────────────────────────────────────────
function deriveCropSignalTags(pulse, analytics) {
  if (!pulse.length) return {}
  const tags = {}
  for (const p of pulse) {
    const anomaly  = analytics?.anomalies?.find(a => a.crop === p.crop)
    const momentum = analytics?.momentum?.find(m => m.crop === p.crop)
    const seasonal = analytics?.seasonal?.find(s => s.crop === p.crop)
    const quality  = analytics?.forecast_quality?.find(q => q.crop === p.crop)

    if (anomaly?.severity === 'high')                           { tags[p.crop] = 'Demand Spike';      continue }
    if (momentum?.signal === 'STRONG_UP' || p.change_pct > 12) { tags[p.crop] = 'Momentum Leader';   continue }
    if (seasonal?.current_phase === 'peak')                     { tags[p.crop] = 'Seasonal Peak';     continue }
    if (seasonal?.current_phase === 'trough')                   { tags[p.crop] = 'Seasonal Pressure'; continue }
    if (p.volatility_level === 'low' && (quality?.score ?? 0) > 60) { tags[p.crop] = 'Stable Asset'; continue }
    if ((quality?.score ?? 0) > 70)                             { tags[p.crop] = 'Forecast Reliable'; continue }
    if (p.volatility_level === 'high')                          { tags[p.crop] = 'Weak Confidence';   continue }
  }
  return tags
}

export default function Dashboard() {
  const [pulse,     setPulse]     = useState([])
  const [stats,     setStats]     = useState(null)
  const [analytics, setAnalytics] = useState(null)
  const [heatmap,   setHeatmap]   = useState(null)
  const [loading,   setLoading]   = useState(true)
  const [error,     setError]     = useState(null)

  useEffect(() => {
    Promise.all([
      api.get('/api/prices/market-pulse'),
      api.get('/api/crops/dataset/stats'),
    ])
      .then(([pulseRes, statsRes]) => {
        setPulse(pulseRes.data)
        setStats(statsRes.data)
      })
      .catch(err => setError(err?.response?.data?.detail ?? err.message))
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    api.get('/api/prices/analytics')
      .then(res => setAnalytics(res.data))
      .catch(() => {})
  }, [])

  useEffect(() => {
    const cropQ = PHASE4_ALL_CROPS.map(c => `crops=${encodeURIComponent(c)}`).join('&')
    api.get(`/api/crops/coverage?${cropQ}`)
      .then(res => {
        const matrix = {}
        for (const row of res.data.coverage) {
          if (!matrix[row.crop]) matrix[row.crop] = {}
          matrix[row.crop][row.state] = { days: row.distinct_days ?? 0, price: row.avg_price ?? null }
        }
        setHeatmap(matrix)
      })
      .catch(() => {})
  }, [])

  // ── All useMemos must precede early returns ───────────────────────────────
  const regime = useMemo(() => {
    if (!pulse.length) return null
    const rising  = pulse.filter(p => p.trend === 'rising')
    const falling = pulse.filter(p => p.trend === 'falling')
    const stable  = pulse.filter(p => p.trend === 'stable')
    const sentiment =
      rising.length > falling.length + 1  ? 'Broadly Bullish' :
      falling.length > rising.length + 1  ? 'Broadly Bearish' : 'Mixed'
    const sentimentCls =
      sentiment === 'Broadly Bullish' ? 'text-amber-700 bg-amber-50 border-amber-200' :
      sentiment === 'Broadly Bearish' ? 'text-emerald-700 bg-emerald-50 border-emerald-200' :
                                        'text-gray-600 bg-gray-50 border-gray-200'
    const topMom     = analytics?.momentum?.[0] ?? null
    const topAnomaly = analytics?.anomalies?.[0] ?? null
    return { rising, falling, stable, sentiment, sentimentCls, topMom, topAnomaly }
  }, [pulse, analytics])

  const brief          = useMemo(() => generateBrief(pulse, analytics, regime),       [pulse, analytics, regime])
  const aiRegime       = useMemo(() => classifyAIRegime(pulse, analytics, regime),    [pulse, analytics, regime])
  const cropSignalTags = useMemo(() => deriveCropSignalTags(pulse, analytics),        [pulse, analytics])

  if (loading) return <PageLoader />
  if (error)   return <div className="py-12 text-center text-sm text-red-500">{error}</div>

  // ── Derived aggregates ─────────────────────────────────────────────────────
  const highestPrice = pulse.reduce((a, b) => (b.avg_price > (a?.avg_price ?? 0) ? b : a), null)
  const mostVolatile = pulse.reduce((a, b) => (b.volatility_pct > (a?.volatility_pct ?? 0) ? b : a), null)
  const sortedMovers = [...pulse].sort((a, b) => b.change_pct - a.change_pct)
  const mostStable   = [...pulse].sort((a, b) => a.volatility_pct - b.volatility_pct)[0] ?? null
  const topGainer    = sortedMovers[0] ?? null
  const topQuality   = analytics?.forecast_quality?.[0] ?? null
  const peakCrop     = analytics?.seasonal?.find(s => s.current_phase === 'peak') ?? null

  return (
    <div className="space-y-5">

      {/* ── Page header ──────────────────────────────────── */}
      <div>
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-2xl font-bold tracking-tight" style={{ color: 'rgba(255,255,255,0.95)' }}>Market Dashboard</h1>
            <p className="text-xs mt-0.5 tracking-wide" style={{ color: 'rgba(255,255,255,0.32)' }}>
              South India · 5 states · Latest: {stats?.latest_date ?? '—'}
            </p>
          </div>
          <span className="text-[10px] font-bold tracking-wide uppercase px-2.5 py-1 rounded-full"
            style={{ background: 'rgba(16,185,129,0.14)', border: '1px solid rgba(52,211,153,0.30)', color: 'rgba(52,211,153,0.95)' }}>
            {stats?.total_rows ?? '—'} records
          </span>
        </div>

        {/* ── Executive AI Brief Strip ─────────────────── */}
        {brief && (
          <div className="mt-3 flex items-center gap-3 py-2.5 pl-3.5 pr-4 rounded-xl overflow-hidden"
            style={{ background: 'linear-gradient(135deg, rgba(12,16,28,0.65) 0%, rgba(8,12,22,0.50) 100%)', border: '1px solid rgba(56,189,248,0.14)', borderLeft: '3px solid rgba(52,211,153,0.50)' }}>
            <span className="relative flex h-2 w-2 shrink-0">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-forest-500 opacity-40" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-forest-600" />
            </span>
            <p className="text-xs text-forest-900/80 leading-relaxed flex-1">{brief}</p>
            <span className="text-[9px] text-forest-700 shrink-0 hidden sm:block font-bold tracking-widest uppercase opacity-60">
              AI Brief
            </span>
          </div>
        )}
      </div>

      {/* ── Global stats row ─────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard label="Total Records"   value={stats?.total_rows ?? '—'}          sub="AGMARKNET 2015–2026" />
        <StatCard label="Crops Tracked"   value={`${stats?.unique_crops ?? '—'}+`}  sub="varieties across mandis" />
        <StatCard label="Highest Priced"  value={highestPrice?.crop ?? '—'}         sub={highestPrice ? `${formatPrice(highestPrice.avg_price)}/qtl avg` : null} />
        <StatCard label="Most Volatile"   value={mostVolatile?.crop ?? '—'}         sub={mostVolatile ? `${mostVolatile.volatility_pct}% CV` : null} />
      </div>

      {/* ── Market Leaders ───────────────────────────────── */}
      <section>
        <SectionHeader
          title="Market Leaders"
          badge="live analytics · 30-day window"
        />
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          <LeaderCard
            label="Fastest Rising"
            cropName={topGainer?.crop}
            metric={topGainer ? `+${topGainer.change_pct.toFixed(1)}% 7-day` : null}
            metricLabel="price momentum"
            accentCls="text-amber-600"
            tag={topGainer ? (topGainer.change_pct > 8 ? 'Momentum Leader' : 'Price Gainer') : null}
          />
          <LeaderCard
            label="Most Stable"
            cropName={mostStable?.crop}
            metric={mostStable ? `${mostStable.volatility_pct}% CV` : null}
            metricLabel="coefficient of variation"
            accentCls="text-emerald-600"
            tag={mostStable ? 'Stable Asset' : null}
          />
          <LeaderCard
            label="Most Volatile"
            cropName={mostVolatile?.crop}
            metric={mostVolatile ? `${mostVolatile.volatility_pct}% CV` : null}
            metricLabel="price instability"
            accentCls="text-red-600"
            tag={mostVolatile ? 'Volatility Risk' : null}
          />
          <LeaderCard
            label="Best Forecast"
            cropName={topQuality?.crop ?? null}
            metric={topQuality ? topQuality.reliability : null}
            metricLabel={topQuality ? `score ${topQuality.score}/100` : null}
            accentCls="text-blue-600"
            tag={topQuality ? 'Forecast Reliable' : null}
          />
          <LeaderCard
            label="Peak Season"
            cropName={peakCrop?.crop ?? (analytics ? 'None currently' : null)}
            metric={peakCrop ? `+${peakCrop.current_vs_norm}% vs norm` : null}
            metricLabel={peakCrop ? `peak: ${peakCrop.peak_months?.slice(0, 2).join(', ')}` : null}
            accentCls="text-purple-600"
            tag={peakCrop ? 'Seasonal Peak' : null}
          />
        </div>
      </section>

      {/* ── Crop Pulse ────────────────────────────────────── */}
      <section>
        <SectionHeader
          title="Tier-1 Crop Pulse · South India Average"
          badge={`30-day window · ${pulse[0]?.last_date ?? ''}`}
          live
        />
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          {pulse.map(p => {
            const trendBorder = p.trend === 'rising' ? 'border-l-amber-400' : p.trend === 'falling' ? 'border-l-emerald-400' : 'border-l-gray-200'
            return (
              <Card key={p.crop} className={`!p-3.5 transition-all duration-200 hover:-translate-y-1 hover:shadow-lg border-l-2 ${trendBorder}`}>
                <div className="flex items-start justify-between mb-1">
                  <p className="text-xs font-bold text-gray-800">{p.crop}</p>
                  <VolPill level={p.volatility_level} />
                </div>
                <p className="text-xl font-extrabold text-gray-900 leading-none tracking-tight mt-1.5">
                  {formatPrice(p.avg_price)}
                  <span className="text-[11px] font-normal text-gray-400 ml-0.5">/qtl</span>
                </p>
                <div className="flex items-center gap-1.5 mt-1.5">
                  <TrendChip trend={p.trend} changePct={p.change_pct} />
                  <span className="text-[10px] text-gray-400">30d</span>
                </div>
                <div className="mt-2 -mx-1">
                  <Sparkline data={p.sparkline} trend={p.trend} />
                </div>
                <p className="text-[10px] text-forest-900/30 mt-1">
                  {p.total_days.toLocaleString()}d training
                </p>
              </Card>
            )
          })}
        </div>
      </section>

      {/* ── Market Alerts ──────────────────────────────────── */}
      <section>
        <SectionHeader
          title="Market Alerts · Anomaly Detection"
          badge="rolling z-score · last 90 days"
          spinner={!analytics}
        />

        {analytics ? (
          analytics.anomalies.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {analytics.anomalies.slice(0, 6).map((a, i) => {
                const isSpike = a.event_type === 'spike'
                const rowBg   = a.severity === 'high'   ? 'bg-red-50 border-red-100' :
                                a.severity === 'medium' ? 'bg-amber-50 border-amber-100' :
                                                          'bg-yellow-50 border-yellow-100'
                return (
                  <div key={i} className={`p-3 rounded-xl border ${rowBg}`}>
                    <div className="flex items-start gap-2.5">
                      <span className={`w-1.5 h-1.5 rounded-full shrink-0 mt-1 ${
                        a.severity === 'high' ? 'bg-red-500' : a.severity === 'medium' ? 'bg-amber-500' : 'bg-yellow-400'
                      }`} />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-xs font-bold text-gray-900">{a.crop}</span>
                          <span className={`text-xs font-bold tabular-nums ${a.pct_deviation > 0 ? 'text-red-600' : 'text-emerald-600'}`}>
                            {a.pct_deviation > 0 ? '+' : ''}{a.pct_deviation}%
                          </span>
                          <span className="text-[10px] text-gray-500">{isSpike ? 'spike' : 'crash'}</span>
                          <span className="text-[10px] text-gray-400">{a.state}</span>
                        </div>
                        <p className="text-[10px] text-gray-400 mt-0.5 tabular-nums">
                          {a.date} · z={a.z_score} · base ₹{a.roll_mean?.toLocaleString()}/qtl
                        </p>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          ) : (
            <div className="flex items-center gap-2 p-3.5 bg-emerald-50 border border-emerald-100 rounded-xl">
              <span className="text-emerald-500 text-sm shrink-0">✓</span>
              <p className="text-xs text-emerald-700 font-medium">
                No significant price anomalies detected in the last 90 days.
              </p>
            </div>
          )
        ) : (
          <div className="h-20 bg-gray-50 rounded-xl border border-gray-100 flex items-center justify-center">
            <p className="text-xs text-gray-400">Running anomaly analysis…</p>
          </div>
        )}
      </section>

      {/* ── Market Regime Summary ────────────────────────────── */}
      {regime && (
        <section>
          <SectionHeader
            title="Market Regime Summary"
            badge="analytical · derived from real data"
          />
          <Card className="!p-4">
            <div className="flex flex-wrap items-start gap-4">

              {/* AI Regime classification */}
              {aiRegime && (
                <div className="shrink-0">
                  <p className="text-[9px] font-bold text-gray-400 uppercase tracking-widest mb-1.5">AI Regime</p>
                  <span className={`text-xs font-bold px-2.5 py-1 rounded-full border ${aiRegime.cls}`}>
                    {aiRegime.regimeName}
                  </span>
                  <div className="mt-2 space-y-0.5">
                    <div className="flex items-center gap-1.5">
                      <span className="text-[9px] text-gray-400 uppercase tracking-wide">Confidence</span>
                      <span className="text-[10px] font-bold text-gray-700">{aiRegime.confidence}</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className="text-[9px] text-gray-400 uppercase tracking-wide">Bias</span>
                      <span className="text-[10px] font-bold text-gray-700">{aiRegime.dirBias}</span>
                    </div>
                  </div>
                </div>
              )}

              <div className="hidden sm:block w-px bg-gray-100 self-stretch" />

              {/* Sentiment + trend breakdown */}
              <div className="shrink-0">
                <p className="text-[9px] font-bold text-gray-400 uppercase tracking-widest mb-1.5">Sentiment</p>
                <span className={`text-xs font-bold px-2.5 py-1 rounded-full border ${regime.sentimentCls}`}>
                  {regime.sentiment}
                </span>
                <div className="flex gap-3 mt-2.5">
                  {[
                    { label: 'Rising',  count: regime.rising.length,  cls: 'text-amber-600'   },
                    { label: 'Stable',  count: regime.stable.length,  cls: 'text-gray-500'    },
                    { label: 'Falling', count: regime.falling.length, cls: 'text-emerald-600' },
                  ].map(t => (
                    <div key={t.label} className="text-center">
                      <p className={`text-xl font-extrabold leading-none ${t.cls}`}>{t.count}</p>
                      <p className="text-[9px] text-gray-400 mt-0.5">{t.label}</p>
                    </div>
                  ))}
                  <div className="self-end pb-0.5">
                    <p className="text-[9px] text-gray-400">/ {pulse.length}</p>
                  </div>
                </div>
              </div>

              <div className="hidden lg:block w-px bg-gray-100 self-stretch" />

              {/* Key signals + AI interpretation */}
              <div className="flex-1 min-w-0">
                {aiRegime && (
                  <div className="mb-2.5 px-2.5 py-1.5 rounded-lg"
                    style={{ background: 'rgba(12,16,28,0.60)', border: '1px solid rgba(56,189,248,0.12)' }}>
                    <p className="text-[9px] font-bold text-forest-700 uppercase tracking-widest mb-0.5 opacity-70">AI Interpretation</p>
                    <p className="text-xs text-forest-900/70 italic leading-relaxed">{aiRegime.interpretation}</p>
                  </div>
                )}
                <p className="text-[9px] font-bold text-gray-400 uppercase tracking-widest mb-1.5">Key Signals</p>
                <div className="space-y-1">
                  {regime.topMom && (
                    <p className="text-xs text-gray-600">
                      <span className="font-semibold text-gray-800">{regime.topMom.crop}</span>
                      {' '}leads momentum — {regime.topMom.signal.toLowerCase()} ({regime.topMom.score > 0 ? '+' : ''}{regime.topMom.score}%)
                    </p>
                  )}
                  {mostStable && (
                    <p className="text-xs text-gray-600">
                      Most stable:{' '}
                      <span className="font-semibold text-gray-800">{mostStable.crop}</span>
                      {' '}at {mostStable.volatility_pct}% CV
                    </p>
                  )}
                  {regime.topAnomaly ? (
                    <p className="text-xs text-gray-600">
                      Active alert:{' '}
                      <span className="font-semibold text-gray-800">{regime.topAnomaly.crop}</span>
                      {' '}in {regime.topAnomaly.state} — z-score {regime.topAnomaly.z_score}
                    </p>
                  ) : (
                    <p className="text-xs text-emerald-600">✓ No active price anomalies in the last 90 days</p>
                  )}
                </div>
              </div>
            </div>
          </Card>
        </section>
      )}

      {/* ── Market Summary + Top Movers ──────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

        <Card>
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Market Summary</h3>
            <span className="text-[9px] text-gray-400 font-medium">7-day trend · South India</span>
          </div>
          <div>
            {pulse.map(p => {
              const homeState = CROP_HOME_STATE[p.crop] ?? 'South India'
              const desc = {
                rising:  `rising in ${homeState}`,
                falling: `easing in ${homeState}`,
                stable:  `stable in ${homeState}`,
              }[p.trend]
              return (
                <div key={p.crop}
                  className="flex items-center gap-3 py-2 border-b border-gray-50 last:border-0 px-1.5 rounded-lg hover:bg-gray-50 transition-colors duration-150">
                  <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                    p.trend === 'rising'  ? 'bg-amber-400' :
                    p.trend === 'falling' ? 'bg-emerald-400' : 'bg-gray-300'
                  }`} />
                  <div className="flex-1 min-w-0">
                    <span className="text-xs font-bold text-gray-800">{p.crop}</span>
                    <span className="text-[10px] text-gray-400 ml-1.5">{desc}</span>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-xs font-semibold text-gray-700 hidden sm:block tabular-nums">
                      {formatPrice(p.avg_7d)}/qtl
                    </span>
                    <TrendChip trend={p.trend} changePct={p.change_pct} />
                    {analytics && (() => {
                      const m = analytics.momentum?.find(m => m.crop === p.crop)
                      return m ? <MomentumChip signal={m.signal} score={m.score} className="hidden lg:inline-flex" /> : null
                    })()}
                  </div>
                </div>
              )
            })}
          </div>
        </Card>

        <Card>
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Top Movers</h3>
            <span className="text-[9px] text-gray-400 font-medium">7-day movements</span>
          </div>
          <div>
            <p className="text-[9px] font-bold text-amber-700 uppercase tracking-widest mb-1.5">Gains</p>
            {sortedMovers.slice(0, 3).map(p => (
              <div key={p.crop + '-g'}
                className="flex items-center gap-3 py-2 px-2 rounded-lg hover:bg-gray-50 transition-colors duration-150">
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-bold text-gray-800">{p.crop}</p>
                  <p className="text-[10px] text-gray-400 tabular-nums">{formatPrice(p.avg_7d)}/qtl · 7d avg</p>
                </div>
                <TrendChip trend={p.trend} changePct={p.change_pct} />
              </div>
            ))}
            <div className="my-2 border-t border-gray-100" />
            <p className="text-[9px] font-bold text-emerald-700 uppercase tracking-widest mb-1.5">Dips</p>
            {[...sortedMovers].reverse().slice(0, 2).map(p => (
              <div key={p.crop + '-d'}
                className="flex items-center gap-3 py-2 px-2 rounded-lg hover:bg-gray-50 transition-colors duration-150">
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-bold text-gray-800">{p.crop}</p>
                  <p className="text-[10px] text-gray-400 tabular-nums">{formatPrice(p.avg_7d)}/qtl · 7d avg</p>
                </div>
                <TrendChip trend={p.trend} changePct={p.change_pct} />
              </div>
            ))}
          </div>
        </Card>
      </div>

      {/* ── Forecast Snapshot ────────────────────────────── */}
      <section>
        <SectionHeader title="Forecast Snapshot · 30-Day Outlook" />
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          {pulse.map(p => {
            const state     = CROP_HOME_STATE[p.crop] ?? 'S. India'
            const signal    = { rising: 'Bullish', falling: 'Bearish', stable: 'Neutral' }[p.trend]
            const signalCls = {
              rising:  'text-amber-600 bg-amber-50 border-amber-200',
              falling: 'text-emerald-600 bg-emerald-50 border-emerald-200',
              stable:  'text-gray-500 bg-gray-50 border-gray-200',
            }[p.trend]
            const confLabel = { low: 'High', medium: 'Medium', high: 'Low' }[p.volatility_level]
            const confCls   = { low: 'text-emerald-600', medium: 'text-amber-600', high: 'text-red-500' }[p.volatility_level]
            const tag       = cropSignalTags[p.crop] ?? null
            return (
              <Card key={p.crop} className="!p-3.5 transition-all duration-150 hover:-translate-y-0.5 hover:shadow-md">
                <div className="flex items-start justify-between mb-1.5">
                  <div>
                    <p className="text-xs font-bold text-gray-900">{p.crop}</p>
                    <p className="text-[10px] text-gray-400">{state}</p>
                  </div>
                  <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded border shrink-0 ${signalCls}`}>
                    {signal}
                  </span>
                </div>
                <p className="text-xl font-extrabold text-gray-900 leading-none tracking-tight tabular-nums">
                  {formatPrice(p.avg_price)}
                </p>
                <p className="text-[10px] text-gray-400 mt-0.5 mb-2.5">/qtl · 30d avg</p>
                <div className="pt-2 border-t border-gray-100 grid grid-cols-2 gap-x-2 text-[10px]">
                  <div>
                    <span className="text-[9px] text-gray-400 uppercase tracking-wide block mb-0.5">Confidence</span>
                    <span className={`font-bold text-xs ${confCls}`}>{confLabel}</span>
                  </div>
                  <div>
                    <span className="text-[9px] text-gray-400 uppercase tracking-wide block mb-0.5">Training</span>
                    <span className="font-bold text-xs text-gray-700 tabular-nums">
                      {(p.total_days / 1000).toFixed(1)}k days
                    </span>
                  </div>
                </div>
                {tag && (
                  <div className="mt-2 pt-1.5 border-t border-gray-50">
                    <SignalTag tag={tag} />
                  </div>
                )}
              </Card>
            )
          })}
        </div>
      </section>

      {/* ── Multi-Crop Coverage Heatmap ──────────────────── */}
      <section>
        <SectionHeader
          title="Multi-Crop Data Coverage"
          badge={`${PHASE4_ALL_CROPS.length} crops × 5 states · trading days in AGMARKNET`}
          spinner={!heatmap}
        />

        {heatmap ? (
          <Card padding={false}>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-gray-100 bg-gray-50/60">
                    <th className="text-left text-[9px] font-bold text-gray-400 uppercase tracking-widest px-4 py-2.5 w-44 border-r border-gray-100">
                      Crop
                    </th>
                    {SOUTH_INDIAN_STATES.map(s => (
                      <th key={s}
                        title={s}
                        className="text-center text-[9px] font-bold text-gray-400 uppercase tracking-widest px-2 py-2.5 w-20">
                        {STATE_ABBR[s] ?? s}
                      </th>
                    ))}
                    <th className="text-center text-[9px] font-bold text-gray-400 uppercase tracking-widest px-2 py-2.5 w-12">
                      Tier
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {PHASE4_ALL_CROPS.map((crop, idx) => {
                    const row     = heatmap[crop] ?? {}
                    const tierNum = cropTier(crop)
                    const tierCls =
                      tierNum === 1 ? 'text-emerald-700 font-bold' :
                      tierNum === 2 ? 'text-blue-600 font-medium' :
                                     'text-gray-400'
                    return (
                      <tr key={crop}
                        className={`border-b border-gray-50 last:border-0 transition-colors duration-150 hover:bg-blue-50/20 ${idx % 2 === 0 ? '' : 'bg-gray-50/50'}`}>
                        <td className="px-4 py-1.5 border-r border-gray-100">
                          <span className="font-medium text-gray-700 text-xs">{cropShortName(crop)}</span>
                        </td>
                        {SOUTH_INDIAN_STATES.map(state => (
                          <td key={state} className="px-1.5 py-1.5">
                            <HeatCell days={row[state]?.days ?? null} />
                          </td>
                        ))}
                        <td className="px-2 py-1.5 text-center">
                          <span className={`text-[9px] ${tierCls}`}>T{tierNum}</span>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
            {/* Legend */}
            <div className="flex items-center gap-4 px-4 py-2 border-t border-gray-50 text-[9px] text-gray-400 flex-wrap">
              <span className="font-bold text-gray-500 uppercase tracking-wide">Data richness</span>
              {[
                { cls: 'bg-emerald-100 border-emerald-200', label: '≥2000 days' },
                { cls: 'bg-blue-50 border-blue-200',        label: '500–1999' },
                { cls: 'bg-amber-50 border-amber-200',      label: '90–499' },
                { cls: 'bg-orange-50 border-orange-200',    label: '1–89' },
                { cls: 'bg-gray-50 border-gray-200',        label: 'No data' },
              ].map(l => (
                <span key={l.label} className="flex items-center gap-1">
                  <span className={`w-2.5 h-2.5 rounded border ${l.cls}`} />
                  {l.label}
                </span>
              ))}
            </div>
          </Card>
        ) : (
          <div className="h-24 bg-gray-50 rounded-xl border border-gray-100 flex items-center justify-center">
            <p className="text-xs text-gray-400">Loading coverage matrix…</p>
          </div>
        )}
      </section>

    </div>
  )
}
