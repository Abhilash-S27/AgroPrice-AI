import { useState, useEffect, useMemo, useRef } from 'react'
import Card from '@components/ui/Card'
import api from '@services/api'
import { formatPrice } from '@utils/formatters'

/**
 * Market Story Mode (Phase 5) — a cinematic, stepped AI analyst
 * presentation: PAST → PRESENT → FUTURE. Every chapter is composed from
 * real data: the history timeline API, the live insight bundle, and the
 * actual forecast trajectory. Auto-play steps through like a briefing.
 */

function buildChapters(insights, forecast, timeline, crop, state) {
  if (!insights?.has_data) return []
  const cs = insights.context_summary ?? {}
  const conf = insights.confidence ?? {}
  const chapters = []

  // PAST — from real timeline events
  const events = timeline?.events ?? []
  const volEvent = events.find(e => e.type === 'volatility')
  const shock = events.find(e => e.type === 'spike' || e.type === 'crash')
  chapters.push({
    era: 'PAST', icon: '🕰️', title: 'How this market behaved',
    text: [
      volEvent ? volEvent.text : `${crop} in ${state} has traded through a decade of seasonal cycles without an abnormal volatility regime.`,
      shock ? `${shock.title} on ${shock.date}: ${shock.text}` : null,
    ].filter(Boolean).join(' '),
  })

  // PRESENT — live conditions
  const phaseLine =
    cs.phase === 'trough' && (cs.momentum ?? 0) > 3
      ? 'The market sits below its seasonal norm, but recovery momentum has clearly emerged.'
      : cs.phase === 'trough'
        ? 'The market is moving through its seasonal trough — arrivals pressure remains.'
        : cs.phase === 'peak'
          ? 'The market is riding its seasonal peak premium.'
          : 'The market is in a normal seasonal phase.'
  chapters.push({
    era: 'PRESENT', icon: '📡', title: 'Where it stands today',
    text: `${phaseLine} Prices average ${formatPrice(cs.avg_30d ?? 0)}/qtl over 30 days with ` +
          `${cs.cv?.toFixed(0)}% volatility and ${cs.momentum > 0 ? '+' : ''}${cs.momentum?.toFixed(1)}%/7d momentum. ` +
          `${cs.anomaly_count ? `${cs.anomaly_count} statistical anomaly event${cs.anomaly_count === 1 ? '' : 's'} in the last 90 days keep${cs.anomaly_count === 1 ? 's' : ''} the baseline noisy.` : 'The recent baseline is statistically clean.'}`,
  })

  // CONFIDENCE — why we trust (or doubt) the projection
  const weakest = (conf.breakdown ?? []).slice()
    .sort((a, b) => (b.weight - b.earned) - (a.weight - a.earned))[0]
  chapters.push({
    era: 'CONFIDENCE', icon: '⚖️', title: 'How much to trust the model',
    text: `The weighted confidence engine scores this pair ${conf.score}/100 (${conf.reliability}). ` +
          (weakest
            ? `The biggest drag is ${weakest.factor.toLowerCase()} (${weakest.earned}/${weakest.weight}) — ${weakest.detail}.`
            : ''),
  })

  // FUTURE — actual forecast trajectory
  if (forecast?.forecast?.length) {
    const fc = forecast.forecast
    const first = fc[0].predicted_price
    const last = fc[fc.length - 1].predicted_price
    const ch = ((last - first) / first) * 100
    const dir = ch > 4 ? 'a rising trajectory' : ch < -4 ? 'a declining path' : 'stabilization'
    chapters.push({
      era: 'FUTURE', icon: '🔮', title: 'Where the model points next',
      text: `Across the ${fc.length}-day horizon the ${forecast.method === 'sparse_trend' ? 'trend estimator' : 'Prophet model'} ` +
            `projects ${dir} (${ch > 0 ? '+' : ''}${ch.toFixed(1)}%), from ${formatPrice(first)} to ${formatPrice(last)}/qtl, ` +
            `inside an 80% band of ${formatPrice(Math.min(...fc.map(p => p.lower_bound)))}–${formatPrice(Math.max(...fc.map(p => p.upper_bound)))}/qtl.`,
    })
  }
  return chapters
}

export default function MarketStoryMode({ insights, forecast, crop, state }) {
  const [timeline, setTimeline] = useState(null)
  const [step, setStep] = useState(0)
  const [playing, setPlaying] = useState(false)
  const timerRef = useRef(null)

  useEffect(() => {
    setTimeline(null)
    setStep(0)
    setPlaying(false)
    api.get('/api/ai/timeline', { params: { crop, state } })
      .then(res => setTimeline(res.data))
      .catch(() => setTimeline({ events: [] }))
  }, [crop, state])

  const chapters = useMemo(
    () => buildChapters(insights, forecast, timeline, crop, state),
    [insights, forecast, timeline, crop, state],
  )

  useEffect(() => {
    clearInterval(timerRef.current)
    if (playing && chapters.length) {
      timerRef.current = setInterval(() => {
        setStep(s => {
          if (s + 1 >= chapters.length) { setPlaying(false); return s }
          return s + 1
        })
      }, 5200)
    }
    return () => clearInterval(timerRef.current)
  }, [playing, chapters.length])

  if (!chapters.length) return null
  const ch = chapters[Math.min(step, chapters.length - 1)]

  return (
    <Card className="!p-0 overflow-hidden ai-fade-up ai-hero">
      <div className="px-5 py-3.5 border-b border-gray-100/70 flex items-center gap-2.5">
        <div className="w-8 h-8 rounded-xl bg-gray-900 text-white flex items-center justify-center text-base">🎬</div>
        <div>
          <p className="text-sm font-bold text-gray-900 leading-tight">Market Story Mode</p>
          <p className="text-[11px] text-gray-500">AI analyst briefing · {crop} · {state}</p>
        </div>
        <button onClick={() => { setStep(0); setPlaying(p => !p) }}
          className="ml-auto px-3 py-1.5 rounded-xl bg-gray-900 text-white text-[11px] font-semibold
                     hover:bg-gray-700 transition-colors no-print">
          {playing ? '⏸ Pause' : '▶ Play briefing'}
        </button>
      </div>

      <div className="p-5">
        {/* chapter progress */}
        <div className="flex items-center gap-1.5 mb-4">
          {chapters.map((c, i) => (
            <button key={i} onClick={() => { setStep(i); setPlaying(false) }}
              className={`h-1.5 rounded-full transition-all duration-500 ${
                i === step ? 'bg-primary-500 flex-[3]' : i < step ? 'bg-primary-200 flex-1' : 'bg-gray-200 flex-1'
              }`} />
          ))}
        </div>

        <div key={step} className="ai-fade-up min-h-[110px]">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-xl">{ch.icon}</span>
            <span className="text-[10px] font-black tracking-[0.2em] text-primary-600">{ch.era}</span>
            <span className="text-sm font-bold text-gray-900">{ch.title}</span>
          </div>
          <p className="text-sm text-gray-700 leading-relaxed">{ch.text}</p>
        </div>

        <div className="flex items-center justify-between mt-3 no-print">
          <button onClick={() => { setStep(s => Math.max(0, s - 1)); setPlaying(false) }}
            disabled={step === 0}
            className="text-[11px] font-semibold text-gray-400 hover:text-gray-600 disabled:opacity-30">
            ← Previous
          </button>
          <span className="text-[10px] text-gray-300">{step + 1} / {chapters.length}</span>
          <button onClick={() => { setStep(s => Math.min(chapters.length - 1, s + 1)); setPlaying(false) }}
            disabled={step === chapters.length - 1}
            className="text-[11px] font-semibold text-primary-600 hover:text-primary-700 disabled:opacity-30">
            Next →
          </button>
        </div>
      </div>
    </Card>
  )
}
