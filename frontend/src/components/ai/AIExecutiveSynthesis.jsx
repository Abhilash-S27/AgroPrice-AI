/**
 * AIExecutiveSynthesis — Phase 5.
 *
 * Bloomberg-style institutional briefing panel.
 * Shows: market posture, executive summary, strategic outlook,
 * institutional commentary, briefing cards.
 *
 * Data source: /api/decision/executive-summary (cross-crop)
 * or can accept a per-crop synthesis object as prop.
 */
import { useState, useEffect, memo } from 'react'
import { decisionService } from '@services/decisionService'

// ── Market posture config ─────────────────────────────────────────────────────

const POSTURE_CFG = {
  OPPORTUNISTIC: { bg: 'bg-emerald-600', ring: 'ring-emerald-300', text: 'text-white', label: 'OPPORTUNISTIC', icon: '▲', live: true,   urgent: false },
  DEFENSIVE:     { bg: 'bg-amber-500',   ring: 'ring-amber-300',   text: 'text-white', label: 'DEFENSIVE',     icon: '⚡', live: false,  urgent: false },
  CAUTIOUS:      { bg: 'bg-orange-500',  ring: 'ring-orange-300',  text: 'text-white', label: 'CAUTIOUS',      icon: '⚠', live: false,  urgent: false },
  CRISIS:        { bg: 'bg-red-600',     ring: 'ring-red-300',     text: 'text-white', label: 'CRISIS',        icon: '⚠', live: false,  urgent: true  },
  NEUTRAL:       { bg: 'bg-blue-500',    ring: 'ring-blue-300',    text: 'text-white', label: 'NEUTRAL',       icon: '→', live: false,  urgent: false },
}
const getPosture = (p) => POSTURE_CFG[p] ?? POSTURE_CFG['NEUTRAL']

const CARD_SEVERITY_CFG = {
  high:     { border: 'border-red-200',    bg: 'bg-red-50',     text: 'text-red-700',    dot: 'bg-red-500' },
  moderate: { border: 'border-amber-200',  bg: 'bg-amber-50',   text: 'text-amber-700',  dot: 'bg-amber-500' },
  low:      { border: 'border-blue-200',   bg: 'bg-blue-50',    text: 'text-blue-700',   dot: 'bg-blue-400' },
  positive: { border: 'border-emerald-200',bg: 'bg-emerald-50', text: 'text-emerald-700',dot: 'bg-emerald-500' },
}
const getCard = (sev) => CARD_SEVERITY_CFG[sev] ?? CARD_SEVERITY_CFG['low']

// ── Briefing card sub-component ───────────────────────────────────────────────

const BriefingCard = memo(function BriefingCard({ card }) {
  const cfg = getCard(card.severity ?? card.color)
  return (
    <div className={`rounded-lg border ${cfg.border} ${cfg.bg} px-3 py-2 transition-all duration-150 hover:shadow-sm hover:-translate-y-px`}>
      <div className="flex items-start gap-2">
        <div className={`w-1 self-stretch rounded-full ${cfg.dot} shrink-0`} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <p className={`text-[8px] font-black uppercase tracking-widest ${cfg.text} opacity-70`}>
              {card.category}
            </p>
            {card.value && (
              <p className={`text-[9px] font-black ${cfg.text} ml-auto tabular-nums`}>{card.value}</p>
            )}
          </div>
          <p className={`text-[10px] font-bold ${cfg.text} leading-snug`}>{card.headline}</p>
          {card.detail && (
            <p className="text-[9px] text-gray-500 mt-0.5 leading-snug">{card.detail}</p>
          )}
        </div>
      </div>
    </div>
  )
})

// ── Cross-crop posture distribution bar ──────────────────────────────────────

const PostureBar = memo(function PostureBar({ distribution }) {
  if (!distribution) return null
  const entries = Object.entries(distribution)
  const total   = entries.reduce((a, [, v]) => a + v, 0) || 1
  const colorMap = {
    OPPORTUNISTIC: 'bg-emerald-500',
    DEFENSIVE:     'bg-amber-400',
    CAUTIOUS:      'bg-orange-400',
    CRISIS:        'bg-red-500',
    NEUTRAL:       'bg-blue-400',
  }
  return (
    <div>
      <div className="flex h-2 rounded-full overflow-hidden gap-px">
        {entries.map(([p, v]) => (
          v > 0 && (
            <div
              key={p}
              className={`${colorMap[p] ?? 'bg-gray-400'} h-full`}
              style={{ flex: v / total }}
              title={`${p}: ${v} crops`}
            />
          )
        ))}
      </div>
      <div className="flex items-center gap-3 mt-1.5 flex-wrap">
        {entries.map(([p, v]) => (
          v > 0 && (
            <span key={p} className="text-[9px] text-gray-500 flex items-center gap-1">
              <span className={`w-1.5 h-1.5 rounded-sm ${colorMap[p] ?? 'bg-gray-400'}`} />
              {p.toLowerCase()} ({v})
            </span>
          )
        ))}
      </div>
    </div>
  )
})

// ── Main component ─────────────────────────────────────────────────────────────

export default function AIExecutiveSynthesis({ maxCrops = 8 }) {
  const [data,     setData]     = useState(null)
  const [loading,  setLoading]  = useState(false)
  const [error,    setError]    = useState(null)
  const [showAll,  setShowAll]  = useState(false)
  const [show,     setShow]     = useState(false)

  const load = () => {
    setLoading(true)
    setError(null)
    decisionService.getExecutiveSummary(maxCrops)
      .then(d => setData(d))
      .catch(() => setError('Executive synthesis unavailable'))
      .finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [maxCrops]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!data) { setShow(false); return }
    const id = requestAnimationFrame(() => setShow(true))
    return () => cancelAnimationFrame(id)
  }, [data])

  if (loading) {
    return (
      <div className="space-y-3 animate-pulse">
        <div className="h-20 bg-gray-100 rounded-xl" />
        <div className="h-12 bg-gray-50 rounded-xl" />
        {[1,2,3].map(i => <div key={i} className="h-14 bg-gray-50 rounded-xl" />)}
      </div>
    )
  }

  if (error) return (
    <div className="text-center py-4">
      <p className="text-[11px] text-red-500 mb-2">{error}</p>
      <button onClick={load} className="text-[10px] text-gray-500 underline">Retry</button>
    </div>
  )
  if (!data?.crops_analysed) {
    return <p className="text-[11px] text-gray-400 text-center py-4">No synthesis data available.</p>
  }

  // Deduplicate priority cards by headline (cross-crop aggregation produces dupes)
  const seen = new Set()
  const deduped = (data.high_priority_cards ?? []).filter(c => {
    const key = c.headline?.trim().toLowerCase()
    if (!key || seen.has(key)) return false
    seen.add(key)
    return true
  })
  const cardsToShow = showAll ? deduped : deduped.slice(0, 5)

  const posture = getPosture(data.dominant_posture)

  return (
    <div className="space-y-3">
      {/* Market posture banner — compact horizontal strip */}
      <div className={`rounded-lg px-4 py-3 ${posture.bg} ring-1 ring-offset-1 ${posture.ring}`}>
        <div className="flex items-center gap-2.5">
          <span className={`text-base font-black ${posture.text} shrink-0 ${posture.urgent ? 'animate-pulse' : ''}`}>{posture.icon}</span>
          {posture.live && (
            <span className="relative flex h-1.5 w-1.5 shrink-0">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-60" />
              <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-white opacity-80" />
            </span>
          )}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <p className={`text-[11px] font-black ${posture.text}`}>{posture.label}</p>
              <p className={`text-[9px] ${posture.text} opacity-70`}>
                {data.crops_analysed} crops · {data.posture_headline || 'South Indian markets'}
              </p>
            </div>
          </div>
        </div>
        {data.posture_distribution && (
          <div className="mt-2">
            <PostureBar distribution={data.posture_distribution} />
          </div>
        )}
      </div>

      {/* Priority briefing cards (deduplicated) */}
      {deduped.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <p className="text-[9px] font-black uppercase tracking-widest text-gray-400">PRIORITY BRIEFINGS</p>
            <span className="text-[9px] text-gray-300">{deduped.length} signals</span>
          </div>
          <div className="space-y-1.5">
            {cardsToShow.map((card, i) => (
              <div key={i} style={{
                opacity: show ? 1 : 0,
                transform: show ? 'none' : 'translateY(4px)',
                transition: `opacity 280ms ease-out ${i * 35}ms, transform 280ms ease-out ${i * 35}ms`,
              }}>
                <BriefingCard card={card} />
              </div>
            ))}
          </div>
          {deduped.length > 5 && (
            <button
              onClick={() => setShowAll(s => !s)}
              className="mt-1.5 text-[9px] text-gray-400 underline w-full text-center"
            >
              {showAll ? `Show less` : `Show ${deduped.length - 5} more`}
            </button>
          )}
        </div>
      )}

      {/* Critical escalations */}
      {data.critical_escalations?.length > 0 && (
        <div className="px-3 py-2 rounded-lg bg-red-50 border border-red-200">
          <p className="text-[9px] font-black uppercase tracking-wide text-red-700 mb-1">CRITICAL ESCALATIONS</p>
          {data.critical_escalations.map((e, i) => (
            <p key={i} className="text-[10px] text-red-700 flex items-start gap-1.5">
              <span className="text-red-400 mt-0.5 shrink-0">!</span>
              {e}
            </p>
          ))}
        </div>
      )}

      {/* Generated at */}
      {data.generated_at && (
        <p className="text-[9px] text-gray-300 text-right">
          Generated {new Date(data.generated_at).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
        </p>
      )}
    </div>
  )
}
