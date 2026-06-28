/**
 * AIStrategyPanel — Phase 5 (Institutional Intelligence Pass).
 *
 * Mode-specific strategic recommendation panel.
 * Mode selector always visible — even during loading and fallback states.
 * Institutional fallback: cautionary WAIT stance with data sufficiency warning.
 */
import { useState, useEffect, memo } from 'react'
import { decisionService } from '@services/decisionService'

// ── Action config ─────────────────────────────────────────────────────────────

const ACTION_CFG = {
  SELL_NOW:               { bg: 'bg-emerald-600', text: 'text-white',         icon: '↑',  label: 'Sell Now' },
  SELL_SOON:              { bg: 'bg-emerald-100', text: 'text-emerald-800',   icon: '↑',  label: 'Sell Soon' },
  HOLD:                   { bg: 'bg-blue-100',    text: 'text-blue-800',      icon: '→',  label: 'Hold Position' },
  WAIT:                   { bg: 'bg-gray-100',    text: 'text-gray-700',      icon: '⏳', label: 'Wait' },
  ACCUMULATE:             { bg: 'bg-teal-100',    text: 'text-teal-800',      icon: '↓',  label: 'Accumulate' },
  REDUCE_EXPOSURE:        { bg: 'bg-amber-100',   text: 'text-amber-800',     icon: '⚡', label: 'Reduce Exposure' },
  WAIT_FOR_STABILIZATION: { bg: 'bg-orange-100',  text: 'text-orange-800',    icon: '⏸', label: 'Wait — Stabilize' },
  ENTER_AFTER_REVERSAL:   { bg: 'bg-purple-100',  text: 'text-purple-800',    icon: '↩', label: 'Enter After Reversal' },
  HIGH_RISK_AVOIDANCE:    { bg: 'bg-red-100',     text: 'text-red-800',       icon: '⚠', label: 'Avoid — High Risk' },
}
const getAction = (a) => ACTION_CFG[a] ?? ACTION_CFG['HOLD']

const MODE_LABELS = {
  farmer:    '🌾 Farmer',
  trader:    '📈 Trader',
  wholesale: '🏬 Wholesale',
  analyst:   '📊 Analyst',
  general:   '📋 General',
}

// ── Info row ──────────────────────────────────────────────────────────────────

const InfoRow = memo(function InfoRow({ label, value, highlight }) {
  return (
    <div className="flex items-start gap-2 py-1 border-b border-gray-50 last:border-0 hover:bg-gray-50/60 px-2 -mx-2 transition-colors duration-100 rounded">
      <p className="text-[9px] font-black uppercase tracking-wide text-gray-400 w-20 shrink-0 pt-0.5">{label}</p>
      <p className={`text-[10px] leading-snug flex-1 ${highlight ? 'text-gray-800 font-medium' : 'text-gray-600'}`}>
        {value}
      </p>
    </div>
  )
})

// ── Mode selector (shared — always visible) ───────────────────────────────────

const ModeSelector = memo(function ModeSelector({ mode, onChange, disabled }) {
  return (
    <div className="flex items-center gap-1.5 flex-wrap">
      {Object.entries(MODE_LABELS).map(([m, label]) => (
        <button
          key={m}
          onClick={() => !disabled && onChange(m)}
          className={`text-[9px] font-bold px-2.5 py-1 rounded-full border transition-all duration-150 ease-in-out ${
            mode === m
              ? 'bg-gray-900 border-gray-900 text-white shadow-sm'
              : disabled
                ? 'bg-gray-50 border-gray-100 text-gray-300 cursor-not-allowed'
                : 'bg-gray-50 border-gray-200 text-gray-500 hover:border-gray-400 hover:bg-white hover:shadow-sm'
          }`}
        >
          {label}
        </button>
      ))}
    </div>
  )
})

// ── Institutional fallback ─────────────────────────────────────────────────────

const StrategyFallback = memo(function StrategyFallback({ crop, state, mode, isError, onRetry }) {
  const modeLabel = (MODE_LABELS[mode] ?? mode).replace(/\S+\s/, '')

  return (
    <div className="space-y-3">
      <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-2.5">
        <div className="flex items-start gap-2">
          <span className="text-amber-500 text-sm mt-0.5 shrink-0">⚠</span>
          <div className="flex-1">
            <p className="text-[10px] font-black text-amber-800 uppercase tracking-wide">
              {isError ? 'STRATEGY ENGINE FAILED' : 'INSUFFICIENT DATA FOR STRATEGY'}
            </p>
            <p className="text-[9px] text-amber-700 mt-0.5 leading-snug">
              {isError
                ? `The ${modeLabel} strategy engine encountered an error.`
                : `Data for ${crop ?? 'this crop'} in ${state ?? 'this state'} does not meet the minimum threshold for a ${modeLabel} recommendation.`}
            </p>
          </div>
          {isError && onRetry && (
            <button onClick={onRetry} className="shrink-0 text-[9px] font-bold px-2.5 py-1 rounded-full border border-amber-400 text-amber-700 bg-amber-100 hover:bg-amber-200 transition-colors">
              ↻ Retry
            </button>
          )}
        </div>
      </div>

      {/* Default cautionary position */}
      <div className="rounded-lg px-4 py-2.5 bg-gray-100">
        <p className="text-[8px] font-black uppercase tracking-widest mb-1 text-gray-500">
          DEFAULT POSITION — {modeLabel}
        </p>
        <div className="flex items-center gap-2">
          <span className="text-base font-black text-gray-500">⏳</span>
          <div>
            <p className="text-[12px] font-black text-gray-700">WAIT</p>
            <p className="text-[9px] text-gray-500">Institutional discipline: neutral stance when data is insufficient</p>
          </div>
        </div>
      </div>

      {/* Caution */}
      <div className="px-3 py-2 rounded-lg bg-amber-50 border border-amber-200">
        <p className="text-[8px] font-black uppercase tracking-wide text-amber-700 mb-1">CAUTION</p>
        <div className="space-y-0.5">
          {[
            'Do not enter positions without confirmed directional signals',
            'Data sufficiency is a prerequisite for strategy generation',
            'Monitor price history over the next 4–8 market weeks before taking action',
          ].map((c, i) => (
            <p key={i} className="text-[10px] text-amber-800 flex items-start gap-1.5">
              <span className="text-amber-400 mt-0.5 shrink-0">⚠</span>
              {c}
            </p>
          ))}
        </div>
      </div>
    </div>
  )
})

// ── Main component ─────────────────────────────────────────────────────────────

export default function AIStrategyPanel({ crop, state, defaultMode = 'general' }) {
  const [mode,       setMode]       = useState(defaultMode)
  const [data,       setData]       = useState(null)
  const [loading,    setLoading]    = useState(false)
  const [error,      setError]      = useState(null)
  const [retryCount, setRetryCount] = useState(0)

  useEffect(() => {
    if (!crop || !state) return
    setLoading(true)
    setError(null)
    decisionService.getStrategy(crop, state, mode)
      .then(d => setData(d))
      .catch(() => setError('Strategy engine failed'))
      .finally(() => setLoading(false))
  }, [crop, state, mode, retryCount])

  if (!crop || !state) {
    return (
      <div className="text-center py-6 text-gray-400 text-[11px]">
        Select a crop and state for strategic recommendation.
      </div>
    )
  }

  const showFallback = !loading && (error || !data?.has_data || !data?.strategy)

  return (
    <div className="space-y-4">

      {/* ── Mode selector — always visible ──────────────────── */}
      <ModeSelector
        mode={mode}
        onChange={setMode}
        disabled={loading}
      />

      {/* ── Content area ──────────────────────────────────── */}
      {loading ? (
        <div className="space-y-2 animate-pulse">
          <div className="h-14 bg-gray-100 rounded-xl" />
          {[1,2,3,4].map(i => <div key={i} className="h-8 bg-gray-50 rounded-lg" />)}
        </div>
      ) : showFallback ? (
        <StrategyFallback crop={crop} state={state} mode={mode} isError={!!error} onRetry={() => setRetryCount(c => c + 1)} />
      ) : (
        <StrategyData data={data} mode={mode} />
      )}
    </div>
  )
}

// ── Data content ───────────────────────────────────────────────────────────────

function StrategyData({ data, mode }) {
  const s   = data.strategy
  const acf = getAction(s.action)

  return (
    <div className="space-y-3">
      {/* Primary action card */}
      <div className={`rounded-lg px-4 py-2.5 ${acf.bg} transition-all duration-150`}>
        <p className={`text-[8px] font-black uppercase tracking-widest mb-0.5 ${acf.text} opacity-60`}>
          RECOMMENDED ACTION — {(MODE_LABELS[mode] ?? mode).replace(/\S+\s/, '')}
        </p>
        <div className="flex items-center gap-2">
          <span className={`text-base font-black ${acf.text}`}>{acf.icon}</span>
          <div className="flex-1 min-w-0">
            <p className={`text-[12px] font-black ${acf.text} leading-tight`}>{acf.label}</p>
            <p className={`text-[9px] ${acf.text} opacity-75 leading-snug`}>{s.urgency}</p>
          </div>
        </div>
      </div>

      {/* Rationale */}
      {s.rationale?.length > 0 && (
        <div className="px-3 py-2.5 rounded-lg bg-gray-50 border border-gray-100">
          <p className="text-[8px] font-black uppercase tracking-widest text-gray-400 mb-1">RATIONALE</p>
          <div className="space-y-1">
            {(Array.isArray(s.rationale) ? s.rationale : [s.rationale]).map((r, i) => (
              <p key={i} className="text-[10px] text-gray-700 leading-snug flex items-start gap-1.5">
                <span className="text-gray-300 mt-0.5 shrink-0">▸</span>
                <span>{r}</span>
              </p>
            ))}
          </div>
        </div>
      )}

      {/* Detail rows */}
      <div className="rounded-lg border border-gray-100 overflow-hidden">
        {s.timing_guidance  && <InfoRow label="Timing"   value={s.timing_guidance}  highlight />}
        {s.entry_guidance   && <InfoRow label="Entry"    value={s.entry_guidance} />}
        {s.exit_guidance    && <InfoRow label="Exit"     value={s.exit_guidance} />}
        {s.seasonal_context && <InfoRow label="Seasonal" value={s.seasonal_context} />}
        {s.escalation_awareness?.length > 0 && (
          <InfoRow
            label="Risk Watch"
            value={Array.isArray(s.escalation_awareness)
              ? s.escalation_awareness.join(' · ')
              : s.escalation_awareness}
          />
        )}
      </div>

      {/* Caution notes */}
      {s.caution_notes?.length > 0 && (
        <div className="px-3 py-2 rounded-lg bg-amber-50 border border-amber-200">
          <p className="text-[8px] font-black uppercase tracking-wide text-amber-700 mb-1">CAUTION</p>
          <div className="space-y-0.5">
            {s.caution_notes.map((c, i) => (
              <p key={i} className="text-[10px] text-amber-800 flex items-start gap-1.5">
                <span className="text-amber-400 mt-0.5 shrink-0">⚠</span>
                {c}
              </p>
            ))}
          </div>
        </div>
      )}

      {/* Watch triggers */}
      {s.watch_triggers?.length > 0 && (
        <div className="px-3 py-2 rounded-lg bg-gray-50 border border-gray-100">
          <p className="text-[8px] font-black uppercase tracking-wide text-gray-400 mb-1">WATCH TRIGGERS</p>
          <div className="space-y-0.5">
            {s.watch_triggers.map((t, i) => (
              <p key={i} className="text-[10px] text-gray-600 flex items-start gap-1.5">
                <span className="text-gray-300 mt-0.5 shrink-0">·</span>
                {t}
              </p>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
