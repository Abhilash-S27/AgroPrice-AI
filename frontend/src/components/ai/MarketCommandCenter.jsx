import { useState, useEffect, useRef } from 'react'
import api from '@services/api'
import { cropShortName } from '@utils/constants'

/**
 * South India AI Market Pulse — executive command center.
 * KPI indices, scrolling insight ribbon, and AI pulse cards, all derived
 * from the cross-crop analytics cache via /api/ai/executive.
 */

function useCountUp(target, duration = 900) {
  const [value, setValue] = useState(0)
  const ref = useRef(null)
  useEffect(() => {
    if (target == null) return
    const start = performance.now()
    cancelAnimationFrame(ref.current)
    const tick = (t) => {
      const k = Math.min(1, (t - start) / duration)
      setValue(Math.round(target * (1 - Math.pow(1 - k, 3))))
      if (k < 1) ref.current = requestAnimationFrame(tick)
    }
    ref.current = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(ref.current)
  }, [target, duration])
  return value
}

function KpiCard({ kpi }) {
  const v = useCountUp(kpi.value)
  const tone =
    kpi.key === 'stress'
      ? (kpi.value >= 60 ? 'text-red-600' : kpi.value >= 35 ? 'text-amber-600' : 'text-emerald-600')
      : (kpi.value >= 65 ? 'text-emerald-600' : kpi.value >= 45 ? 'text-amber-600' : 'text-red-600')
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-3.5" title={kpi.detail}>
      <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">{kpi.label}</p>
      <p className={`text-2xl font-extrabold leading-none ${tone}`}>
        {v}<span className="text-xs font-medium text-gray-300">{kpi.unit}</span>
      </p>
      <p className="text-[10px] text-gray-400 mt-1.5 leading-snug">{kpi.detail}</p>
    </div>
  )
}

const ALERT_STYLES = {
  critical:    'bg-red-50 border-red-200 text-red-700',
  warning:     'bg-amber-50 border-amber-200 text-amber-700',
  opportunity: 'bg-emerald-50 border-emerald-200 text-emerald-700',
  stable:      'bg-gray-50 border-gray-200 text-gray-500',
}

function InsightRibbon({ alerts }) {
  if (!alerts?.length) return null
  // duplicate the list so the marquee loops seamlessly
  const items = [...alerts, ...alerts]
  return (
    <div className="relative overflow-hidden rounded-xl border border-gray-100 bg-white py-2">
      <div className="ai-marquee flex gap-2.5 w-max">
        {items.map((a, i) => (
          <span key={i} title={a.action}
            className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px]
                        font-medium border whitespace-nowrap cursor-default ${ALERT_STYLES[a.level]}`}>
            {a.icon} {a.text}
          </span>
        ))}
      </div>
    </div>
  )
}

function PulseCard({ p }) {
  return (
    <div className="min-w-[250px] max-w-[250px] rounded-xl border border-gray-200 bg-white p-3.5
                    hover:border-primary-300 hover:shadow-sm transition-all snap-start">
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">
          {p.icon} {p.title}
        </span>
        {p.confidence != null && (
          <span className="text-[9px] font-bold text-primary-500">{p.confidence}/100</span>
        )}
      </div>
      <p className="text-xs font-semibold text-gray-800 leading-snug mb-1">{p.headline}</p>
      <p className="text-[10px] text-gray-400 leading-relaxed">{p.reasoning}</p>
      <p className="text-[9px] text-gray-300 mt-1.5">{cropShortName(p.crop)} · {p.state} · Tier {p.tier}</p>
    </div>
  )
}

export default function MarketCommandCenter() {
  const [data, setData] = useState(null)

  useEffect(() => {
    api.get('/api/ai/executive')
      .then(res => setData(res.data?.ready ? res.data : null))
      .catch(() => {})
  }, [])

  if (!data) return null

  return (
    <section className="ai-fade-up space-y-3 relative ai-hero rounded-2xl p-4 -m-1 overflow-hidden">
      {/* drifting intelligence particles (decorative, GPU transform only) */}
      <div aria-hidden className="absolute inset-0 pointer-events-none">
        {[18, 46, 72, 88].map((left, i) => (
          <span key={i}
            className="ai-particle absolute bottom-3 w-1 h-1 rounded-full bg-primary-300/70"
            style={{ left: `${left}%`, animationDelay: `${i * 1.7}s` }} />
        ))}
      </div>
      <div className="flex items-center gap-2.5">
        <div className="w-8 h-8 rounded-xl bg-gray-900 text-white flex items-center justify-center text-base">⌖</div>
        <div>
          <h2 className="text-sm font-bold text-gray-900 leading-tight">South India AI Market Pulse</h2>
          <p className="text-[11px] text-gray-400">
            executive intelligence · {data.computed_at} · generated from live cross-crop analytics
          </p>
        </div>
        <span className="ml-auto inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px]
                         font-bold text-primary-700 border border-primary-200 ai-shimmer">
          <span className="w-1.5 h-1.5 rounded-full bg-primary-500 ai-pulse" /> LIVE
        </span>
      </div>

      {/* executive KPI indices */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {data.kpis.map(k => <KpiCard key={k.key} kpi={k} />)}
      </div>

      {/* scrolling insight ribbon */}
      <InsightRibbon alerts={data.alerts} />

      {/* pulse cards — horizontal scroll */}
      <div className="flex gap-3 overflow-x-auto pb-2 snap-x">
        {data.pulse.map(p => <PulseCard key={p.key} p={p} />)}
      </div>
    </section>
  )
}
