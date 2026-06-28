/**
 * AIAutonomousMonitor — Phase 4B Steps 1-4
 *
 * Autonomous market intelligence panel. Fetches /api/intelligence/monitor
 * and displays:
 *   - Executive briefing items (Bloomberg-style alerts)
 *   - Priority-sorted crop intelligence cards (regime, escalations, synthesis)
 *   - Regime distribution summary
 *   - Temporal direction indicators
 *
 * No Gemini calls — all analytics deterministic.
 */
import { useState, useEffect, memo, useCallback } from 'react'
import { getIntelligenceMonitor } from '../../services/intelligenceService'
import { AIRegimeBadge, AIPriorityBadge } from './AIRegimeBadge'
import { cropEmoji } from '@utils/constants'

// ── Priority score bar ────────────────────────────────────────────────────────

const PriorityBar = memo(function PriorityBar({ score, level }) {
  const colorMap = {
    CRITICAL:       'bg-red-400',
    HIGH_ATTENTION: 'bg-amber-400',
    WATCH:          'bg-blue-400',
    STABLE:         'bg-gray-200',
  }
  return (
    <div className="h-1 rounded-full bg-gray-100 overflow-hidden w-12 shrink-0">
      <div
        className={`h-full rounded-full transition-all duration-700 ${colorMap[level] ?? 'bg-gray-200'}`}
        style={{ width: `${Math.min(100, score)}%` }}
      />
    </div>
  )
})

// ── Escalation pills ──────────────────────────────────────────────────────────

const EscalationPills = memo(function EscalationPills({ escalations }) {
  if (!escalations?.length) return null
  return (
    <div className="flex flex-wrap gap-1 mt-1">
      {escalations.slice(0, 2).map((e, i) => {
        const key   = e.split(' — ')[0] || e.slice(0, 20)
        const isRed = key.includes('SURGE') || key.includes('CLUSTER') || key.includes('DIVERGENCE')
        return (
          <span key={i} className={`text-[8px] font-bold px-1 py-0.5 rounded border ${
            isRed
              ? 'bg-red-50 border-red-200 text-red-600'
              : 'bg-amber-50 border-amber-200 text-amber-700'
          }`}>
            {key.replace(/_/g, ' ')}
          </span>
        )
      })}
      {escalations.length > 2 && (
        <span className="text-[8px] text-gray-400">+{escalations.length - 2} more</span>
      )}
    </div>
  )
})

// ── Temporal direction indicator ──────────────────────────────────────────────

const TemporalIndicator = memo(function TemporalIndicator({ direction, velocity }) {
  const cfgMap = {
    accelerating: { icon: '⬆', color: 'text-emerald-600', label: 'Accel' },
    decelerating: { icon: '⬇', color: 'text-amber-500',   label: 'Decel' },
    reversing:    { icon: '↩', color: 'text-red-500',      label: 'Rev'   },
    stable:       { icon: '→', color: 'text-gray-400',     label: 'Stable'},
    unknown:      { icon: '?', color: 'text-gray-300',     label: '—'     },
  }
  const c = cfgMap[direction] ?? cfgMap.unknown
  return (
    <span className={`text-[9px] font-bold ${c.color} flex items-center gap-0.5`}>
      {c.icon} {velocity != null ? `${velocity > 0 ? '+' : ''}${velocity?.toFixed(1)}%` : c.label}
    </span>
  )
})

// ── Crop intelligence card ────────────────────────────────────────────────────

const CropCard = memo(function CropCard({ item }) {
  return (
    <div className="flex items-start gap-2.5 p-2.5 rounded-xl border border-gray-100 bg-gray-50/60 hover:bg-white transition-colors duration-150">
      {/* Priority bar */}
      <div className="flex flex-col items-center gap-1 shrink-0 pt-0.5">
        <span className="text-base leading-none">{cropEmoji(item.crop)}</span>
        <PriorityBar score={item.priority_score} level={item.priority_level} />
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-1 mb-0.5">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-[11px] font-bold text-gray-800">{item.crop}</span>
            <span className="text-[9px] text-gray-400">{item.state}</span>
          </div>
          <TemporalIndicator direction={item.temporal_direction} velocity={item.velocity} />
        </div>

        <div className="flex items-center gap-1.5 flex-wrap mb-1">
          <AIRegimeBadge
            regime_name={item.regime_name}
            regime_label={item.regime_label}
            regime_icon={item.regime_icon}
            size="xs"
          />
          {item.reversal_risk && (
            <span className="text-[8px] font-bold px-1 py-0.5 rounded border bg-red-50 border-red-200 text-red-600">
              REVERSAL RISK
            </span>
          )}
        </div>

        <p className="text-[10px] text-gray-500 leading-snug line-clamp-2">{item.synthesis}</p>

        <EscalationPills escalations={item.escalations} />
      </div>
    </div>
  )
})

// ── Executive briefing item ───────────────────────────────────────────────────

const BriefingItem = memo(function BriefingItem({ item }) {
  const cfgMap = {
    critical:  'border-l-red-400    bg-red-50/80',
    warning:   'border-l-amber-400  bg-amber-50/80',
    positive:  'border-l-emerald-400 bg-emerald-50/80',
    info:      'border-l-blue-400   bg-blue-50/80',
  }
  const cls = cfgMap[item.severity] ?? cfgMap.info
  return (
    <div className={`flex gap-2.5 p-2.5 rounded-lg border-l-4 border border-gray-100 ${cls}`}>
      <div className="flex-1 min-w-0">
        <p className="text-[11px] font-bold text-gray-800 leading-tight">
          {(item.headline ?? '').replace(/\*\*([^*]+)\*\*/g, '$1').replace(/\*([^*]+)\*/g, '$1')}
        </p>
        {item.detail && (
          <p className="text-[10px] text-gray-500 mt-0.5 leading-snug line-clamp-2">
            {item.detail.replace(/\*\*([^*]+)\*\*/g, '$1').replace(/\*([^*]+)\*/g, '$1')}
          </p>
        )}
      </div>
    </div>
  )
})

// ── Regime distribution summary ───────────────────────────────────────────────

const RegimeSummary = memo(function RegimeSummary({ distribution, cropsScanned }) {
  if (!distribution || !cropsScanned) return null
  const entries = Object.entries(distribution).sort(([, a], [, b]) => b - a)
  const REGIME_COLORS = {
    BULLISH_EXPANSION:   'bg-emerald-400',
    STABLE:              'bg-blue-400',
    PANIC_VOLATILITY:    'bg-red-400',
    SEASONAL_CORRECTION: 'bg-amber-400',
    RECOVERY_PHASE:      'bg-teal-400',
    SEASONAL_PEAK_RUN:   'bg-purple-400',
    TRANSITIONAL:        'bg-gray-300',
  }
  return (
    <div className="flex items-center gap-1.5 flex-wrap">
      {entries.map(([name, count]) => (
        <span key={name} className="flex items-center gap-1 text-[9px] text-gray-500">
          <span className={`w-2 h-2 rounded-full ${REGIME_COLORS[name] ?? 'bg-gray-300'}`} />
          {count}
        </span>
      ))}
      <span className="text-[9px] text-gray-300">/ {cropsScanned} crops</span>
    </div>
  )
})

// ── Main component ─────────────────────────────────────────────────────────────

export default memo(function AIAutonomousMonitor({ maxCrops = 8, onDataLoad }) {
  const [data,       setData]       = useState(null)
  const [loading,    setLoading]    = useState(true)
  const [error,      setError]      = useState(null)
  const [lastFetch,  setLastFetch]  = useState(null)
  const [showBrief,  setShowBrief]  = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const result = await getIntelligenceMonitor(maxCrops)
      setData(result)
      onDataLoad?.(result)
      setLastFetch(new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }))
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }, [maxCrops, onDataLoad])

  useEffect(() => { load() }, [load])

  const criticalCount = data?.critical_alerts ?? 0
  const highCount     = data?.high_attention  ?? 0
  const escCount      = data?.total_escalations ?? 0

  return (
    <div className="flex flex-col gap-3">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="relative">
            <span className="text-base leading-none">🤖</span>
            {criticalCount > 0 && (
              <span className="absolute -top-1 -right-1 w-3 h-3 rounded-full bg-red-500 text-white text-[7px] font-black flex items-center justify-center animate-pulse">
                {criticalCount}
              </span>
            )}
          </div>
          <div>
            <p className="text-[11px] font-bold text-gray-800">Autonomous Monitor</p>
            <p className="text-[9px] text-gray-400">
              {loading
                ? 'Scanning markets…'
                : `${data?.crops_scanned ?? 0} crops · ${lastFetch ?? ''}`
              }
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1.5">
          {/* Alert summary pills */}
          {!loading && criticalCount > 0 && (
            <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-red-50 border border-red-200 text-red-700 animate-pulse">
              {criticalCount} Critical
            </span>
          )}
          {!loading && highCount > 0 && (
            <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-amber-50 border border-amber-200 text-amber-700">
              {highCount} High
            </span>
          )}
          <button
            onClick={load}
            disabled={loading}
            className="text-[10px] text-gray-400 hover:text-primary-600 transition-colors disabled:opacity-40 px-2 py-0.5 rounded border border-gray-100 hover:border-primary-200"
          >
            {loading ? '⟳' : '↺'}
          </button>
        </div>
      </div>

      {error && (
        <p className="text-[10px] text-red-500 italic">Monitor error — {error}</p>
      )}

      {/* Regime distribution strip */}
      {!loading && data && (
        <div className="flex items-center justify-between">
          <RegimeSummary distribution={data.regime_distribution} cropsScanned={data.crops_scanned} />
          {escCount > 0 && (
            <span className="text-[9px] text-amber-600 font-semibold">
              {escCount} escalation{escCount > 1 ? 's' : ''}
            </span>
          )}
        </div>
      )}

      {/* Executive briefing */}
      {!loading && data?.executive_briefing?.length > 0 && (
        <div className="flex flex-col gap-1">
          <button
            onClick={() => setShowBrief(v => !v)}
            className="flex items-center gap-1.5 text-[9px] font-black uppercase tracking-widest text-gray-400 hover:text-gray-600 transition-colors"
          >
            <span>{showBrief ? '▾' : '▸'}</span>
            Executive Briefing · {data.executive_briefing.length} items
          </button>

          {showBrief && (
            <div className="flex flex-col gap-1.5">
              {data.executive_briefing.map((item, i) => (
                <BriefingItem key={i} item={item} />
              ))}
            </div>
          )}
        </div>
      )}

      {/* Priority-sorted crop cards */}
      {loading ? (
        <div className="space-y-2 animate-pulse">
          {[1, 2, 3].map(i => (
            <div key={i} className="h-16 rounded-xl bg-gray-50 border border-gray-100" />
          ))}
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {(data?.items ?? []).map((item, i) => (
            <CropCard key={`${item.crop}-${item.state}`} item={item} />
          ))}
          {(!data?.items || data.items.length === 0) && (
            <p className="text-[10px] text-gray-400 italic text-center py-3">
              No intelligence data available
            </p>
          )}
        </div>
      )}
    </div>
  )
})
