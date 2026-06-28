import { useState, useEffect, useRef } from 'react'
import { ComposableMap, Geographies, Geography, Marker, Sphere } from 'react-simple-maps'
import Card from '@components/ui/Card'
import { PageLoader, Spinner } from '@components/ui/Loader'
import { VolBadge, MomentumChip, ReliabilityBadge, SeasonalPhaseBadge } from '@components/ui/Badge'
import { formatPrice } from '@utils/formatters'
import { TIER1_CROPS, cropShortName } from '@utils/constants'
import { useForecastCoverage } from '@hooks/useForecastCoverage'
import api from '@services/api'

// ── Local offline GeoJSON — real OSM post-2014 boundaries (~76 KB) ────────────
const GEO_URL = '/geo/south_india.geojson'

const STATE_LABELS = {
  'Andhra Pradesh': { coords: [80.2, 15.2], abbr: 'AP',  full: 'Andhra Pradesh' },
  'Karnataka':      { coords: [76.5, 14.8], abbr: 'KA',  full: 'Karnataka'      },
  'Kerala':         { coords: [76.3, 10.5], abbr: 'KL',  full: 'Kerala'         },
  'Tamil Nadu':     { coords: [78.6, 11.2], abbr: 'TN',  full: 'Tamil Nadu'     },
  'Telangana':      { coords: [79.2, 17.8], abbr: 'TS',  full: 'Telangana'      },
}

const STATE_CANONICAL = {
  'karnataka':       'Karnataka',
  'tamil nadu':      'Tamil Nadu',
  'andhra pradesh':  'Andhra Pradesh',
  'telangana':       'Telangana',
  'kerala':          'Kerala',
}

function normalizeGeoName(geo) {
  const raw = geo.properties?.NAME_1
           ?? geo.properties?.ST_NM
           ?? geo.properties?.name
           ?? geo.properties?.State
           ?? ''
  return STATE_CANONICAL[raw.toLowerCase().trim()] ?? null
}

const SOUTH_INDIA_SET = new Set(Object.values(STATE_CANONICAL))

const METRICS = [
  { value: 'avg_price',         label: 'Avg Price (30d)',      unit: '₹/qtl', desc: 'Average modal price over last 30 trading days' },
  { value: 'change_pct',        label: 'Price Trend',          unit: '% 7d',  desc: '7-day price change vs prior period' },
  { value: 'volatility_cv',     label: 'Volatility (CV)',      unit: '%',     desc: 'Coefficient of variation — price instability' },
  { value: 'reliability_score', label: 'Forecast Reliability', unit: '/100',  desc: 'Prophet forecast confidence score' },
  { value: 'anomaly_count',     label: 'Anomaly Events',       unit: '',      desc: 'Price spikes/crashes in last 90 days' },
]

// ── Color scale ───────────────────────────────────────────────────────────────
function metricColor(value, min, max, metric, available) {
  if (!available || value == null || isNaN(value)) return 'transparent'
  const t = max > min ? Math.max(0, Math.min(1, (value - min) / (max - min))) : 0.5
  if (metric === 'change_pct') {
    const absMax = Math.max(Math.abs(min), Math.abs(max)) || 1
    const norm = Math.abs(value) / absMax
    return value >= 0
      ? `hsl(142, 68%, ${Math.round(78 - norm * 44)}%)`
      : `hsl(0,   68%, ${Math.round(78 - norm * 44)}%)`
  }
  const palettes = {
    avg_price:         [218, 72],
    volatility_cv:     [0,   68],
    reliability_score: [142, 68],
    anomaly_count:     [30,  85],
  }
  const [h, s] = palettes[metric] ?? [220, 60]
  return `hsl(${h}, ${s}%, ${Math.round(88 - t * 52)}%)`
}

// ── Map skeleton shimmer ──────────────────────────────────────────────────────
function MapSkeleton() {
  return (
    <div className="absolute inset-0 z-10 rounded-b-xl overflow-hidden pointer-events-none">
      <div className="w-full h-full bg-gradient-to-br from-gray-50 to-gray-100 animate-pulse flex flex-col items-center justify-center gap-3">
        <div className="flex flex-col items-center gap-2 opacity-60">
          <div className="w-28 h-3 bg-gray-200 rounded-full" />
          <div className="w-20 h-2 bg-gray-200 rounded-full mt-1" />
        </div>
        <div className="flex gap-2 mt-2 opacity-30">
          {[48, 36, 52, 44, 40].map((w, i) => (
            <div key={i} className="bg-gray-300 rounded" style={{ width: w, height: w * 1.3 }} />
          ))}
        </div>
      </div>
    </div>
  )
}

// ── Compact state tooltip ─────────────────────────────────────────────────────
function StateTooltip({ data, pos, crop }) {
  if (!data || !pos) return null
  const d = data
  return (
    <div
      className="fixed z-50 bg-white border border-gray-200 rounded-xl shadow-2xl p-3 pointer-events-none"
      style={{
        left: pos.x + 18,
        top:  pos.y - 10,
        minWidth: 196,
        maxWidth: 232,
        boxShadow: '0 8px 32px rgba(0,0,0,0.12), 0 2px 8px rgba(0,0,0,0.08)',
      }}
    >
      <div className="flex items-center justify-between mb-2">
        <p className="text-[13px] font-extrabold text-gray-900 tracking-tight leading-none">{data.state}</p>
        <span className="text-[9px] font-bold text-gray-400 bg-gray-50 border border-gray-100 px-1.5 py-0.5 rounded uppercase tracking-widest">{crop}</span>
      </div>
      {d.available ? (
        <div className="space-y-1">
          <div className="flex justify-between items-center">
            <span className="text-[10px] text-gray-400 font-medium uppercase tracking-wide">Price</span>
            <span className="text-xs font-bold text-gray-900 tabular-nums">{formatPrice(d.avg_price)}/qtl</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-[10px] text-gray-400 font-medium uppercase tracking-wide">7d</span>
            <span className={`text-xs font-bold tabular-nums ${d.change_pct > 0 ? 'text-emerald-600' : d.change_pct < 0 ? 'text-red-500' : 'text-gray-600'}`}>
              {d.change_pct > 0 ? '+' : ''}{d.change_pct}%
            </span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-[10px] text-gray-400 font-medium uppercase tracking-wide">Vol</span>
            <VolBadge level={d.volatility_level} badge={d.volatility_badge} />
          </div>
          <div className="flex justify-between items-center">
            <span className="text-[10px] text-gray-400 font-medium uppercase tracking-wide">Signal</span>
            <MomentumChip signal={d.momentum_signal} score={d.change_pct} />
          </div>
          <div className="flex justify-between items-center">
            <span className="text-[10px] text-gray-400 font-medium uppercase tracking-wide">Forecast</span>
            <ReliabilityBadge reliability={d.reliability} score={d.reliability_score} />
          </div>
          {d.anomaly_count > 0 && (
            <div className="flex justify-between items-center pt-1.5 mt-0.5 border-t border-gray-100">
              <span className="text-[10px] text-gray-400 font-medium uppercase tracking-wide">Events</span>
              <span className="text-xs font-bold text-amber-600 tabular-nums">
                {d.anomaly_count}× anomaly
              </span>
            </div>
          )}
        </div>
      ) : (
        <p className="text-[10px] text-gray-400 italic">No data for {crop}</p>
      )}
    </div>
  )
}

// ── Color legend ──────────────────────────────────────────────────────────────
function ColorLegend({ metric, statesData }) {
  const metricObj = METRICS.find(m => m.value === metric)
  const avail = statesData.filter(s => s.available && s[metric] != null)
  if (!avail.length) return null

  const min = Math.min(...avail.map(s => s[metric]))
  const max = Math.max(...avail.map(s => s[metric]))

  const stops = [0, 0.2, 0.4, 0.6, 0.8, 1].map(t =>
    metricColor(min + t * (max - min), min, max, metric, true)
  )

  const fmt = (v) =>
    metric === 'avg_price'         ? `₹${(Math.round(v / 100) / 10).toFixed(1)}k`
    : metric === 'reliability_score' ? Math.round(v)
    : `${v > 0 && metric === 'change_pct' ? '+' : ''}${Number(v).toFixed(1)}`

  return (
    <div className="flex items-center gap-2 mt-1.5">
      <span className="text-[9px] font-bold text-gray-400 shrink-0 tabular-nums">{fmt(min)}</span>
      <div
        className="flex-1 h-2 rounded-full overflow-hidden border border-gray-100"
        style={{ background: `linear-gradient(to right, ${stops.join(', ')})` }}
      />
      <span className="text-[9px] font-bold text-gray-400 shrink-0 tabular-nums">{fmt(max)}</span>
      <span className="text-[9px] text-gray-300 ml-0.5">{metricObj?.unit}</span>
    </div>
  )
}

// ── Spatial intelligence brief (deterministic, no LLM) ───────────────────────
function generateSpatialBrief(statesData, crop) {
  const avail = statesData.filter(s => s.available)
  if (avail.length < 2) return null

  const sorted    = [...avail].sort((a, b) => b.avg_price - a.avg_price)
  const highest   = sorted[0]
  const lowest    = sorted[sorted.length - 1]
  const rising    = avail.filter(s => s.trend === 'rising').length
  const falling   = avail.filter(s => s.trend === 'falling').length
  const anomalous = avail.filter(s => s.anomaly_count > 0).length
  const spread    = lowest.avg_price > 0
    ? ((highest.avg_price - lowest.avg_price) / lowest.avg_price * 100).toFixed(0)
    : null

  if (rising >= Math.ceil(avail.length * 0.6))
    return `${crop} advances in ${rising} of ${avail.length} South Indian states — ${highest.state} leads at ${formatPrice(highest.avg_price)}/qtl${spread ? `, a ${spread}% regional spread above ${lowest.state}` : ''}.`
  if (falling >= Math.ceil(avail.length * 0.6))
    return `${crop} prices ease across ${falling} states — arrivals exceed demand or seasonal pressure; ${highest.state} holds the highest floor at ${formatPrice(highest.avg_price)}/qtl.`
  if (anomalous >= 2)
    return `${crop} markets show volatility signals in ${anomalous} states — anomalies require attention; ${highest.state} records the highest price at ${formatPrice(highest.avg_price)}/qtl.`
  return spread
    ? `${crop} trades across a ${spread}% price spread in South India — ${highest.state} at ${formatPrice(highest.avg_price)}/qtl against ${lowest.state} at ${formatPrice(lowest.avg_price)}/qtl.`
    : `${crop} geographic intelligence active across ${avail.length} South Indian states.`
}

// ── KPI highlight card ────────────────────────────────────────────────────────
function HighlightCard({ label, state, value, sub }) {
  if (!state) return null
  return (
    <div className="bg-white border border-gray-200 rounded-xl p-3 transition-all duration-150 hover:-translate-y-0.5 hover:shadow-md">
      <p className="text-[9px] font-bold text-gray-400 uppercase tracking-widest mb-1">{label}</p>
      <p className="text-[13px] font-extrabold text-gray-900 truncate tracking-tight leading-tight">{state}</p>
      <p className="text-[11px] font-bold text-primary-600 mt-0.5 tabular-nums">{value}</p>
      {sub && <p className="text-[9px] text-gray-400 mt-0.5 truncate font-medium">{sub}</p>}
    </div>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function MapIntelligence() {
  const [crop,          setCrop]          = useState('Tomato')
  const [metric,        setMetric]        = useState('avg_price')
  const [geoIntel,      setGeoIntel]      = useState(null)
  const [intelLoading,  setIntelLoading]  = useState(true)
  const [mapReady,      setMapReady]      = useState(false)
  const [hoveredState,  setHoveredState]  = useState(null)
  const [tooltipPos,    setTooltipPos]    = useState(null)
  const mapContainerRef = useRef(null)

  const { categories } = useForecastCoverage()

  useEffect(() => {
    const t = setTimeout(() => setMapReady(true), 300)
    return () => clearTimeout(t)
  }, [])

  useEffect(() => {
    setIntelLoading(true)
    api.get('/api/prices/geographic-intelligence', { params: { crop } })
      .then(res => setGeoIntel(res.data))
      .catch(() => setGeoIntel(null))
      .finally(() => setIntelLoading(false))
  }, [crop])

  const stateMap = {}
  for (const s of (geoIntel?.states ?? [])) stateMap[s.state] = s

  const statesData = geoIntel?.states ?? []
  const available  = statesData.filter(s => s.available)

  const pick = (fn) => available.length ? available.reduce(fn) : null
  const highestPrice = pick((a, b) => b.avg_price         > a.avg_price         ? b : a)
  const lowestPrice  = pick((a, b) => b.avg_price         < a.avg_price         ? b : a)
  const strongestUp  = pick((a, b) => b.change_pct        > a.change_pct        ? b : a)
  const bestReliable = pick((a, b) => b.reliability_score > a.reliability_score ? b : a)

  const metricValues = available.map(s => s[metric]).filter(v => v != null)
  const scaleMin = metricValues.length ? Math.min(...metricValues) : 0
  const scaleMax = metricValues.length ? Math.max(...metricValues) : 1

  const handleMouseMove = (e) => setTooltipPos({ x: e.clientX, y: e.clientY })

  if (intelLoading && !geoIntel) return <PageLoader />

  const spatialBrief = generateSpatialBrief(statesData, crop)

  // Legend value formatter for bottom dots
  const fmtLegendVal = (val) => {
    if (val == null) return null
    if (metric === 'avg_price')         return formatPrice(val)
    if (metric === 'change_pct')        return `${val > 0 ? '+' : ''}${val}%`
    if (metric === 'reliability_score') return `${val}/100`
    return `${val}`
  }

  return (
    <div className="space-y-4" onMouseMove={handleMouseMove}>

      {/* ── Header ──────────────────────────────────────── */}
      <div>
        <div className="flex items-center gap-2.5">
          <h1 className="text-xl font-extrabold text-gray-900 tracking-tight">Geographic Market Intelligence</h1>
          {intelLoading && <Spinner size="sm" className="w-3.5 h-3.5 text-gray-400" />}
        </div>
        <p className="text-[11px] text-gray-400 mt-0.5 tabular-nums">
          South India · 5-state price analytics
          {geoIntel?.computed_at ? ` · ${geoIntel.computed_at}` : ''}
        </p>

        {/* ── Spatial Intelligence Strip ─────────────────── */}
        {spatialBrief && (
          <div className="mt-2.5 flex items-center gap-3 py-2 pl-3 pr-4 bg-gray-50 border border-gray-100 border-l-2 border-l-emerald-300 rounded-lg">
            <span className="relative flex h-2 w-2 shrink-0">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-50" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
            </span>
            <p className="text-xs text-gray-600 leading-relaxed flex-1">{spatialBrief}</p>
            <span className="text-[9px] text-gray-400 shrink-0 hidden sm:block font-bold tracking-widest uppercase">Spatial Intel</span>
          </div>
        )}
      </div>

      {/* ── Compact selector controls ────────────────────── */}
      <div className="flex items-center gap-4 flex-wrap">
        <div className="flex items-center gap-2">
          <span className="text-[9px] font-bold text-gray-400 uppercase tracking-widest">Crop</span>
          <select
            value={crop}
            onChange={e => setCrop(e.target.value)}
            disabled={intelLoading}
            className="border border-gray-200 rounded-lg px-2.5 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-primary-500 disabled:opacity-50 bg-white text-gray-700 font-medium"
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
              TIER1_CROPS.map(c => <option key={c}>{c}</option>)
            )}
          </select>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[9px] font-bold text-gray-400 uppercase tracking-widest">Metric</span>
          <select
            value={metric}
            onChange={e => setMetric(e.target.value)}
            className="border border-gray-200 rounded-lg px-2.5 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-primary-500 bg-white text-gray-700 font-medium"
          >
            {METRICS.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
          </select>
        </div>
        <p className="text-[10px] text-gray-400 hidden sm:block">
          {METRICS.find(m => m.value === metric)?.desc ?? ''}
        </p>
      </div>

      {/* ── Map + Intelligence Panel ─────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">

        {/* Choropleth map — 3/5 width */}
        <Card className="lg:col-span-3" padding={false}>
          <div className="px-4 pt-3.5 pb-2">
            <div className="flex items-center justify-between mb-1">
              <p className="text-[9px] font-bold text-gray-400 uppercase tracking-widest">
                {crop} · {METRICS.find(m => m.value === metric)?.label}
              </p>
              <span className="text-[9px] font-bold text-gray-300 uppercase tracking-widest">AGMARKNET</span>
            </div>
            <ColorLegend metric={metric} statesData={statesData} />
          </div>

          {/* Map canvas */}
          <div ref={mapContainerRef} className="relative select-none" style={{ minHeight: 300 }}>
            {!mapReady && <MapSkeleton />}

            <ComposableMap
              projection="geoMercator"
              projectionConfig={{ center: [79, 14.5], scale: 2100 }}
              width={520}
              height={580}
              style={{
                width: '100%',
                height: 'auto',
                opacity:    mapReady ? 1 : 0,
                transition: 'opacity 0.35s ease-in-out',
              }}
            >
              <Sphere id="rsm-bg" fill="#ffffff" stroke="#e2e8f0" strokeWidth={0.5} />

              <Geographies geography={GEO_URL}>
                {({ geographies }) =>
                  geographies.map(geo => {
                    const name      = normalizeGeoName(geo)
                    if (!name || !SOUTH_INDIA_SET.has(name)) return null

                    const stateData = stateMap[name]
                    const val       = stateData?.[metric]
                    const isNoData  = !stateData?.available
                    const fill      = metricColor(val, scaleMin, scaleMax, metric, stateData?.available)
                    const isHovered = hoveredState === name

                    return (
                      <Geography
                        key={geo.rsmKey}
                        geography={geo}
                        fill={isNoData ? '#dde3ec' : fill}
                        stroke={isHovered ? '#0f172a' : '#1e3a5f'}
                        strokeWidth={isHovered ? 3.5 : 2.5}
                        style={{
                          default: {
                            outline:    'none',
                            filter:     'none',
                            transition: 'filter 0.18s ease',
                          },
                          hover: {
                            outline: 'none',
                            filter:  isNoData ? 'brightness(0.96)' : 'brightness(0.84) saturate(1.15)',
                            cursor:  'pointer',
                          },
                          pressed: {
                            outline: 'none',
                            filter:  'brightness(0.74) saturate(1.2)',
                          },
                        }}
                        onMouseEnter={() => setHoveredState(name)}
                        onMouseLeave={() => { setHoveredState(null); setTooltipPos(null) }}
                      />
                    )
                  })
                }
              </Geographies>

              {/* State abbreviation labels */}
              {Object.entries(STATE_LABELS).map(([name, { coords, abbr }]) => {
                const sd      = stateMap[name]
                const hasData = sd?.available
                const fill    = hasData ? metricColor(sd[metric], scaleMin, scaleMax, metric, true) : null

                const lightness = fill && fill.startsWith('hsl')
                  ? parseInt(fill.match(/,\s*(\d+)%\)$/)?.[1] ?? '70')
                  : 70
                const textColor = !hasData ? '#64748b' : lightness < 55 ? '#ffffff' : '#1e293b'
                const isHov = hoveredState === name

                return (
                  <Marker key={name} coordinates={coords}>
                    <text
                      textAnchor="middle"
                      dy="0.35em"
                      style={{
                        fontSize:      isHov ? 11 : 10,
                        fontWeight:    700,
                        fill:          textColor,
                        letterSpacing: '0.06em',
                        fontFamily:    'Inter, system-ui, sans-serif',
                        paintOrder:    'stroke',
                        stroke:        lightness < 55 ? 'rgba(0,0,0,0.3)' : 'rgba(255,255,255,0.8)',
                        strokeWidth:   3,
                        strokeLinejoin:'round',
                        pointerEvents: 'none',
                        userSelect:    'none',
                        transition:    'font-size 0.15s ease',
                      }}
                    >
                      {abbr}
                    </text>
                  </Marker>
                )
              })}
            </ComposableMap>

            {hoveredState && tooltipPos && stateMap[hoveredState] && (
              <StateTooltip
                data={stateMap[hoveredState]}
                pos={tooltipPos}
                crop={crop}
              />
            )}
          </div>

          {/* State legend dots with abbreviation + value */}
          <div className="px-4 pb-3.5 pt-1 flex flex-wrap gap-x-3 gap-y-1.5">
            {statesData.filter(s => s.available).map(s => {
              const fill  = metricColor(s[metric], scaleMin, scaleMax, metric, true)
              const abbr  = Object.entries(STATE_LABELS).find(([n]) => n === s.state)?.[1]?.abbr ?? s.state
              const vFmt  = fmtLegendVal(s[metric])
              return (
                <div key={s.state} className="flex items-center gap-1.5">
                  <span
                    className="w-2 h-2 rounded-sm shrink-0"
                    style={{ background: fill }}
                  />
                  <span className="text-[9px] font-bold text-gray-600">{abbr}</span>
                  {vFmt && <span className="text-[9px] text-gray-400 tabular-nums">{vFmt}</span>}
                </div>
              )
            })}
          </div>
        </Card>

        {/* Intelligence panel — 2/5 width */}
        <div className="lg:col-span-2 space-y-3">

          {/* KPI highlight cards */}
          <div className="grid grid-cols-2 gap-2">
            <HighlightCard
              label="Highest Price"
              state={highestPrice?.state}
              value={highestPrice ? formatPrice(highestPrice.avg_price) + '/qtl' : '—'}
              sub={highestPrice ? `${highestPrice.change_pct > 0 ? '+' : ''}${highestPrice.change_pct}% 7d` : null}
            />
            <HighlightCard
              label="Lowest Price"
              state={lowestPrice?.state}
              value={lowestPrice ? formatPrice(lowestPrice.avg_price) + '/qtl' : '—'}
              sub={lowestPrice ? lowestPrice.volatility_badge : null}
            />
            <HighlightCard
              label="Strongest Uptrend"
              state={strongestUp?.state}
              value={strongestUp ? `${strongestUp.change_pct > 0 ? '+' : ''}${strongestUp.change_pct}%` : '—'}
              sub={strongestUp?.momentum_signal}
            />
            <HighlightCard
              label="Most Reliable"
              state={bestReliable?.state}
              value={bestReliable ? `${bestReliable.reliability_score}/100` : '—'}
              sub={bestReliable?.reliability}
            />
          </div>

          {/* Per-state detail cards */}
          <Card className="!p-3">
            <p className="text-[9px] font-bold text-gray-400 uppercase tracking-widest mb-2.5">
              State Intelligence
            </p>
            <div className="space-y-1.5">
              {statesData.map(s => (
                <div
                  key={s.state}
                  className={`p-2.5 rounded-xl border transition-all duration-150 ${
                    hoveredState === s.state
                      ? 'border-primary-300 bg-primary-50 shadow-sm'
                      : 'border-gray-100 bg-gray-50 hover:border-gray-200'
                  }`}
                >
                  {s.available ? (
                    <>
                      {/* State name + momentum signal */}
                      <div className="flex items-center justify-between mb-1.5">
                        <p className="text-[13px] font-extrabold text-gray-900 tracking-tight leading-none">{s.state}</p>
                        <MomentumChip signal={s.momentum_signal} score={s.change_pct} />
                      </div>
                      {/* Primary geographic signal: price + 7d change */}
                      <div className="flex items-baseline gap-1 mb-2">
                        <span className="text-sm font-extrabold text-gray-900 tabular-nums tracking-tight">{formatPrice(s.avg_price)}</span>
                        <span className="text-[9px] text-gray-400 font-medium">/qtl</span>
                        {s.change_pct != null && (
                          <span className={`text-[10px] font-bold tabular-nums ml-auto ${s.change_pct > 0 ? 'text-emerald-600' : s.change_pct < 0 ? 'text-red-500' : 'text-gray-500'}`}>
                            {s.change_pct > 0 ? '+' : ''}{s.change_pct}%
                          </span>
                        )}
                      </div>
                      {/* Secondary signals: vol · forecast · events */}
                      <div className="flex items-center gap-2 flex-wrap text-[10px]">
                        <VolBadge level={s.volatility_level} badge={s.volatility_cv + '%'} />
                        <span className={`font-bold ${
                          s.reliability === 'Excellent' ? 'text-emerald-600' :
                          s.reliability === 'Good'      ? 'text-blue-600'    :
                          s.reliability === 'Moderate'  ? 'text-amber-600'   : 'text-red-500'
                        }`}>{s.reliability}</span>
                        {s.anomaly_count > 0 && (
                          <span className="font-bold text-amber-600 tabular-nums">{s.anomaly_count}⚠</span>
                        )}
                      </div>
                      {s.current_phase !== 'normal' && (
                        <div className="mt-1.5">
                          <SeasonalPhaseBadge phase={s.current_phase} vsNorm={s.current_vs_norm} />
                        </div>
                      )}
                    </>
                  ) : (
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-gray-500">{s.state}</span>
                      <span className="text-[10px] text-gray-400 italic">No state continuity</span>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </Card>

        </div>
      </div>

      {/* ── Regional Market Heat ─────────────────────────── */}
      <div>
        <p className="text-[9px] font-bold text-gray-400 uppercase tracking-widest mb-3">
          Regional Market Heat · {crop}
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {statesData.filter(s => s.available).map(s => {
            const cardCls =
              s.trend === 'rising'  ? 'border-amber-200 bg-amber-50'  :
              s.trend === 'falling' ? 'border-blue-200 bg-blue-50'    :
                                      'border-gray-200 bg-gray-50'
            const trendPillCls =
              s.trend === 'rising'  ? 'text-amber-700 bg-amber-100 border-amber-200' :
              s.trend === 'falling' ? 'text-blue-700 bg-blue-100 border-blue-200'    :
                                      'text-gray-500 bg-gray-100 border-gray-200'
            const trendLabel =
              s.trend === 'rising' ? '↑ Rising' : s.trend === 'falling' ? '↓ Easing' : '→ Stable'

            return (
              <div key={s.state} className={`border rounded-xl p-3 transition-all duration-150 hover:-translate-y-0.5 hover:shadow-md ${cardCls}`}>
                {/* State name + trend pill */}
                <div className="flex items-center justify-between mb-2">
                  <p className="text-[13px] font-extrabold text-gray-900 tracking-tight">{s.state}</p>
                  <span className={`text-[9px] font-bold border px-1.5 py-0.5 rounded-full shrink-0 ${trendPillCls}`}>
                    {trendLabel}
                  </span>
                </div>
                {/* Primary: price + 7d change */}
                <div className="flex items-baseline gap-1.5 mb-2">
                  <span className="text-base font-extrabold text-gray-900 tabular-nums tracking-tight">{formatPrice(s.avg_price)}</span>
                  <span className="text-[9px] text-gray-400">/qtl</span>
                  {s.change_pct != null && (
                    <span className={`text-[10px] font-bold tabular-nums ml-auto ${s.change_pct > 0 ? 'text-emerald-600' : s.change_pct < 0 ? 'text-red-500' : 'text-gray-500'}`}>
                      {s.change_pct > 0 ? '+' : ''}{s.change_pct}%
                    </span>
                  )}
                </div>
                {/* Secondary: vol · anomaly · training days */}
                <div className="flex items-center gap-1.5 flex-wrap">
                  <VolBadge level={s.volatility_level} badge={s.volatility_badge} />
                  {s.anomaly_count > 0 && (
                    <span className="text-[9px] font-bold text-amber-700 bg-amber-50 border border-amber-200 px-1.5 py-0.5 rounded-full tabular-nums">
                      {s.anomaly_count}× anom
                    </span>
                  )}
                  <span className="text-[9px] text-gray-300 tabular-nums ml-auto">{s.training_days?.toLocaleString()}d</span>
                </div>
              </div>
            )
          })}
        </div>
      </div>

    </div>
  )
}
