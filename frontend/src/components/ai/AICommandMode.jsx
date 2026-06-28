/**
 * AICommandMode — Phase 5 upgrade.
 *
 * Executive command mode overlay. Information-dense, highest urgency only.
 * Phase 4B: regime + escalation + priority matrix.
 * Phase 5: decision intelligence posture + council disagreements + probability + confidence collapse.
 */
import { useState, useEffect, memo } from 'react'
import { AIRegimeBadge, AIPriorityBadge } from './AIRegimeBadge'
import { decisionService } from '@services/decisionService'

// ── Market posture config ─────────────────────────────────────────────────────

const POSTURE_CFG = {
  OPPORTUNISTIC: { color: 'text-emerald-400', bg: 'bg-emerald-950/60', border: 'border-emerald-800', icon: '▲' },
  DEFENSIVE:     { color: 'text-amber-400',   bg: 'bg-amber-950/60',   border: 'border-amber-800',   icon: '⚡' },
  CAUTIOUS:      { color: 'text-orange-400',  bg: 'bg-orange-950/60',  border: 'border-orange-800',  icon: '⚠' },
  CRISIS:        { color: 'text-red-400',     bg: 'bg-red-950/60',     border: 'border-red-800',     icon: '🔴' },
  NEUTRAL:       { color: 'text-blue-400',    bg: 'bg-blue-950/60',    border: 'border-blue-800',    icon: '→' },
}
const getPosture = (p) => POSTURE_CFG[p] ?? POSTURE_CFG['NEUTRAL']

const REGIME_BAR_COLOR = {
  BULLISH_EXPANSION:   'bg-emerald-500',
  STABLE:              'bg-blue-400',
  PANIC_VOLATILITY:    'bg-red-500',
  SEASONAL_CORRECTION: 'bg-amber-400',
  RECOVERY_PHASE:      'bg-teal-400',
  SEASONAL_PEAK_RUN:   'bg-purple-400',
  TRANSITIONAL:        'bg-gray-300',
}

const AlertStat = memo(function AlertStat({ label, count, color }) {
  if (count === 0) return null
  return (
    <div className={`flex flex-col items-center px-3 py-2 rounded-lg border ${color}`}>
      <span className="text-lg font-black leading-none">{count}</span>
      <span className="text-[9px] font-bold mt-0.5 uppercase tracking-wide">{label}</span>
    </div>
  )
})

export default function AICommandMode({ data, onClose }) {
  const [p5Data,    setP5Data]    = useState(null)
  const [p5Loading, setP5Loading] = useState(true)

  useEffect(() => {
    setP5Loading(true)
    decisionService.getExecutiveSummary(6)
      .then(d => setP5Data(d))
      .catch(() => setP5Data(null))
      .finally(() => setP5Loading(false))
  }, [])

  if (!data) return null

  const { items = [], critical_alerts, high_attention, watch, crops_scanned,
          regime_distribution, executive_briefing = [], reversal_risks, total_escalations } = data

  // Top opportunity
  const stableItems = items.filter(i => i.priority_level === 'STABLE')
  const topOpp = items.reduce((best, i) =>
    (i.opportunity_score > (best?.opportunity_score ?? 0)) ? i : best
  , null)

  // Flatten all escalations across crops (sorted by crop priority)
  const allEscalations = items
    .filter(i => i.escalations?.length)
    .flatMap(i => i.escalations.map(e => ({ crop: i.crop, esc: e, priority: i.priority_level })))
    .slice(0, 5)

  const regimeEntries = Object.entries(regime_distribution || {}).sort(([,a],[,b]) => b - a)

  return (
    <div className="fixed inset-0 z-50 bg-gray-950/95 flex flex-col overflow-auto">
      <div className="max-w-4xl mx-auto w-full p-6 flex flex-col gap-5">

        {/* Command mode header */}
        <div className="flex items-center justify-between border-b border-gray-700 pb-4">
          <div>
            <h2 className="text-lg font-black text-white tracking-tight">COMMAND MODE</h2>
            <p className="text-[10px] text-gray-500 mt-0.5 uppercase tracking-widest">
              Autonomous Market Intelligence · {crops_scanned} crops analysed
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white text-xl px-3 py-1 rounded border border-gray-700 hover:border-gray-500 transition-colors"
          >
            ✕
          </button>
        </div>

        {/* Alert stats row */}
        <div>
          <p className="text-[9px] font-black uppercase tracking-widest text-gray-500 mb-2">ALERT STATUS</p>
          <div className="flex items-center gap-3 flex-wrap">
            <AlertStat label="Critical"     count={critical_alerts ?? 0} color="bg-red-950 border-red-800 text-red-300" />
            <AlertStat label="High Attn"    count={high_attention  ?? 0} color="bg-amber-950 border-amber-800 text-amber-300" />
            <AlertStat label="Watch"        count={watch           ?? 0} color="bg-blue-950 border-blue-800 text-blue-300" />
            <AlertStat label="Stable"       count={stableItems.length}  color="bg-gray-800 border-gray-700 text-gray-400" />
            {reversal_risks > 0 && (
              <AlertStat label="Reversals" count={reversal_risks} color="bg-rose-950 border-rose-800 text-rose-300" />
            )}
            {total_escalations > 0 && (
              <div className="ml-auto text-right">
                <p className="text-2xl font-black text-amber-400">{total_escalations}</p>
                <p className="text-[9px] text-gray-500 uppercase tracking-wide">escalations</p>
              </div>
            )}
          </div>
        </div>

        {/* Regime distribution bar */}
        {regimeEntries.length > 0 && (
          <div>
            <p className="text-[9px] font-black uppercase tracking-widest text-gray-500 mb-2">REGIME LANDSCAPE</p>
            <div className="flex rounded-lg overflow-hidden h-4 gap-px">
              {regimeEntries.map(([name, count]) => (
                <div
                  key={name}
                  className={`${REGIME_BAR_COLOR[name] ?? 'bg-gray-600'} flex items-center justify-center text-[7px] text-white font-black`}
                  style={{ flex: count }}
                  title={`${name}: ${count} crops`}
                >
                  {count > 1 ? count : ''}
                </div>
              ))}
            </div>
            <div className="flex items-center gap-3 mt-1.5 flex-wrap">
              {regimeEntries.map(([name, count]) => (
                <span key={name} className="text-[9px] text-gray-500 flex items-center gap-1">
                  <span className={`w-2 h-2 rounded-sm ${REGIME_BAR_COLOR[name] ?? 'bg-gray-600'}`} />
                  {name.replace(/_/g, ' ').toLowerCase()} ({count})
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Executive briefing */}
        {executive_briefing.length > 0 && (
          <div>
            <p className="text-[9px] font-black uppercase tracking-widest text-gray-500 mb-2">EXECUTIVE BRIEFING</p>
            <div className="space-y-1.5">
              {executive_briefing.map((b, i) => {
                const color = b.severity === 'critical' ? 'border-l-red-500 text-red-300'
                  : b.severity === 'warning' ? 'border-l-amber-500 text-amber-300'
                  : b.severity === 'positive' ? 'border-l-emerald-500 text-emerald-300'
                  : 'border-l-blue-500 text-blue-300'
                return (
                  <div key={i} className={`pl-3 border-l-2 ${color}`}>
                    <p className="text-[11px] font-bold">{b.headline}</p>
                    {b.detail && (
                      <p className="text-[10px] text-gray-400 mt-0.5">{b.detail}</p>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* Active escalations */}
        {allEscalations.length > 0 && (
          <div>
            <p className="text-[9px] font-black uppercase tracking-widest text-gray-500 mb-2">ACTIVE ESCALATIONS</p>
            <div className="space-y-1">
              {allEscalations.map((e, i) => (
                <div key={i} className="flex items-start gap-2 py-1.5 border-b border-gray-800 last:border-0">
                  <span className="text-[9px] text-gray-500 font-bold shrink-0 w-14 pt-0.5">
                    {e.crop}
                  </span>
                  <p className="text-[10px] text-gray-300 leading-snug">{e.esc}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Priority matrix — top 6 crops */}
        <div>
          <p className="text-[9px] font-black uppercase tracking-widest text-gray-500 mb-2">PRIORITY MATRIX</p>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {items.slice(0, 6).map(item => (
              <div key={`${item.crop}-${item.state}`}
                className="p-2.5 rounded-lg border border-gray-800 bg-gray-900 flex flex-col gap-1">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold text-gray-200">{item.crop}</span>
                  <span className="text-[9px] text-gray-500">{Math.round(item.priority_score)}</span>
                </div>
                <div className="flex items-center gap-1 flex-wrap">
                  <AIPriorityBadge level={item.priority_level} size="xs" />
                </div>
                <p className="text-[9px] text-gray-500 leading-snug">
                  {item.regime_icon} {item.regime_label}
                </p>
                {item.reversal_risk && (
                  <span className="text-[8px] text-rose-400 font-bold">↩ REVERSAL RISK</span>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Top opportunity */}
        {topOpp && (
          <div className="border border-emerald-800 rounded-xl p-4 bg-emerald-950/60">
            <p className="text-[9px] font-black uppercase tracking-widest text-emerald-400 mb-1">TOP OPPORTUNITY</p>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-base font-black text-white">{topOpp.crop}</p>
                <p className="text-[10px] text-emerald-400">{topOpp.state} · {topOpp.regime_label}</p>
                <p className="text-[10px] text-gray-400 mt-0.5">{topOpp.synthesis}</p>
              </div>
              <div className="text-right">
                <p className="text-2xl font-black text-emerald-400">
                  {Math.round((topOpp.opportunity_score || 0) * 100)}
                </p>
                <p className="text-[9px] text-emerald-600 uppercase">opp score</p>
              </div>
            </div>
          </div>
        )}

        {/* ── Phase 5 Decision Intelligence ──────────────────────────────── */}
        <div className="border-t border-gray-800 pt-5 mt-1">
          <p className="text-[9px] font-black uppercase tracking-widest text-violet-400 mb-3">
            DECISION INTELLIGENCE — PHASE 5
          </p>

          {p5Loading ? (
            <p className="text-[10px] text-gray-600 animate-pulse">Fetching decision intelligence…</p>
          ) : p5Data ? (
            <>
              {/* Market posture */}
              {p5Data.dominant_posture && (() => {
                const pc = getPosture(p5Data.dominant_posture)
                return (
                  <div className={`rounded-xl border ${pc.border} ${pc.bg} px-4 py-3 mb-4`}>
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-[8px] font-black uppercase tracking-widest text-gray-500 mb-0.5">MARKET POSTURE</p>
                        <p className={`text-base font-black ${pc.color}`}>
                          {pc.icon} {p5Data.dominant_posture}
                        </p>
                        {p5Data.posture_headline && (
                          <p className="text-[10px] text-gray-400 mt-0.5">{p5Data.posture_headline}</p>
                        )}
                      </div>
                      <p className="text-[9px] text-gray-500">
                        {p5Data.crops_analysed} crops
                      </p>
                    </div>
                  </div>
                )
              })()}

              {/* Priority briefing cards */}
              {p5Data.high_priority_cards?.length > 0 && (
                <div className="mb-4">
                  <p className="text-[9px] font-black uppercase tracking-widest text-gray-500 mb-2">DECISION BRIEFING</p>
                  <div className="space-y-1.5">
                    {p5Data.high_priority_cards.slice(0, 4).map((card, i) => {
                      const color = card.severity === 'high' ? 'border-l-red-500 text-red-300'
                        : card.severity === 'moderate' ? 'border-l-amber-500 text-amber-300'
                        : card.severity === 'positive' ? 'border-l-emerald-500 text-emerald-300'
                        : 'border-l-blue-500 text-blue-300'
                      return (
                        <div key={i} className={`pl-3 border-l-2 ${color}`}>
                          <p className="text-[10px] font-bold">{card.headline}</p>
                          {card.detail && (
                            <p className="text-[9px] text-gray-500 mt-0.5">{card.detail}</p>
                          )}
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}

              {/* Critical escalations from Phase 5 */}
              {p5Data.critical_escalations?.length > 0 && (
                <div>
                  <p className="text-[9px] font-black uppercase tracking-widest text-gray-500 mb-1.5">DECISION ESCALATIONS</p>
                  {p5Data.critical_escalations.slice(0, 3).map((e, i) => (
                    <p key={i} className="text-[10px] text-red-400 flex items-start gap-1.5 mb-1">
                      <span className="shrink-0 mt-0.5">!</span>
                      {e}
                    </p>
                  ))}
                </div>
              )}
            </>
          ) : (
            <p className="text-[10px] text-gray-600">Decision intelligence unavailable (start backend on :8001)</p>
          )}
        </div>

      </div>
    </div>
  )
}
