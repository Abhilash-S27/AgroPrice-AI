/**
 * AIDecisionTrace — Phase 5 (Institutional Architecture Pass).
 *
 * Explainable AI reasoning chain panel.
 * Pipeline stage keys: stage / description / result / status
 * Evidence keys: strongest_evidence / weakest_evidence / confidence_drivers / risk_drivers
 *
 * Visual layout:
 *   1. Pipeline flow — horizontal numbered stage bar
 *   2. Decision summary — dark banner
 *   3. Evidence quality — color-keyed progress bar
 *   4. Agent consensus — agreed vs dissenting 2-col
 *   5. Evidence intelligence — 2-col (strongest + confidence drivers)
 *   6. Risk & uncertainty — 2-col (risk factors + caveats)
 *   7. Impact narratives — 2-col (anomaly + seasonal)
 *   8. Stage details — expandable vertical pipeline
 */
import { useState, useEffect, useCallback, memo, Fragment } from 'react'
import { decisionService } from '@services/decisionService'

// ── Evidence quality config ───────────────────────────────────────────────────

const QUALITY_CFG = {
  strong:   { bg: 'bg-emerald-50', border: 'border-emerald-200', text: 'text-emerald-700', bar: 'bg-emerald-500', pct: 90 },
  moderate: { bg: 'bg-blue-50',    border: 'border-blue-200',    text: 'text-blue-700',    bar: 'bg-blue-400',    pct: 65 },
  mixed:    { bg: 'bg-amber-50',   border: 'border-amber-200',   text: 'text-amber-700',   bar: 'bg-amber-400',   pct: 42 },
  weak:     { bg: 'bg-red-50',     border: 'border-red-200',     text: 'text-red-700',     bar: 'bg-red-400',     pct: 20 },
}
const getQuality = (q) => QUALITY_CFG[q] ?? QUALITY_CFG['moderate']

// ── Stage category colors — data → signals → agents → consensus → evidence → synthesis ──

const STAGE_COLORS = [
  { bg: 'bg-indigo-500', text: 'text-indigo-600', light: 'bg-indigo-100', line: 'bg-gradient-to-r from-indigo-200 to-blue-200'    },
  { bg: 'bg-blue-500',   text: 'text-blue-600',   light: 'bg-blue-100',   line: 'bg-gradient-to-r from-blue-200 to-purple-200'    },
  { bg: 'bg-purple-500', text: 'text-purple-600', light: 'bg-purple-100', line: 'bg-gradient-to-r from-purple-200 to-violet-200'  },
  { bg: 'bg-violet-500', text: 'text-violet-600', light: 'bg-violet-100', line: 'bg-gradient-to-r from-violet-200 to-teal-200'    },
  { bg: 'bg-teal-500',   text: 'text-teal-600',   light: 'bg-teal-100',   line: 'bg-gradient-to-r from-teal-200 to-emerald-200'  },
  { bg: 'bg-emerald-500',text: 'text-emerald-600',light: 'bg-emerald-100',line: ''                                                },
]
const getStageColor = (i) => STAGE_COLORS[Math.min(i, STAGE_COLORS.length - 1)]

// ── Stage status helpers ───────────────────────────────────────────────────────

const stageDotCls = (status, index) => {
  if (status === 'complete') {
    const clr = getStageColor(index ?? 5)
    return `${clr.bg} border-transparent`
  }
  if (status === 'skipped') return 'bg-gray-300 border-gray-300'
  return 'bg-amber-500 border-amber-500'
}

// ── Visual pipeline flow ──────────────────────────────────────────────────────
// Horizontal numbered stage bar — always visible at the top of the panel.

const PipelineFlow = memo(function PipelineFlow({ stages }) {
  if (!stages?.length) return null
  return (
    <div className="flex items-start px-1">
      {stages.map((stage, i) => {
        const isComplete = stage.status === 'complete'
        const isSkipped  = stage.status === 'skipped'
        const clr        = getStageColor(i)
        const shortLabel = stage.stage.replace(/^\d+\.\s*/, '').split(/[\s·—(]/)[0]
        return (
          <Fragment key={i}>
            <div className="flex flex-col items-center gap-1.5 shrink-0">
              <div className={`w-7 h-7 rounded-full flex items-center justify-center text-[9px] font-black leading-none transition-all duration-300 ${
                isComplete ? `${clr.bg} text-white shadow-sm` :
                isSkipped  ? 'bg-gray-200 text-gray-400' :
                             'bg-amber-400 text-white'
              }`}>
                {isComplete ? '✓' : i + 1}
              </div>
              <p
                className={`text-[8px] font-medium text-center leading-tight w-12 truncate transition-colors duration-300 ${
                  isComplete ? clr.text : 'text-gray-400'
                }`}
                title={stage.stage}
              >
                {shortLabel}
              </p>
            </div>
            {i < stages.length - 1 && (
              <div className={`flex-1 h-px mt-3.5 mx-1 ${
                isComplete ? clr.line || 'bg-emerald-200' : 'bg-gray-200'
              }`} />
            )}
          </Fragment>
        )
      })}
    </div>
  )
})

// ── Expandable pipeline stage (detail row) ────────────────────────────────────

const PipelineStage = memo(function PipelineStage({ stage, index, isLast }) {
  const [expanded, setExpanded] = useState(false)
  const clr = getStageColor(index ?? 5)
  return (
    <div className="flex items-start gap-3">
      <div className="flex flex-col items-center shrink-0">
        <div className={`w-3 h-3 rounded-full border-2 mt-0.5 transition-colors duration-200 ${stageDotCls(stage.status, index)}`} />
        {!isLast && <div className={`w-px flex-1 mt-1 min-h-[20px] ${stage.status === 'complete' ? clr.light : 'bg-gray-100'}`} />}
      </div>
      <div className="flex-1 min-w-0 pb-3">
        <button className="w-full text-left" onClick={() => setExpanded(e => !e)}>
          <div className="flex items-center justify-between gap-2">
            <p className="text-[11px] font-bold text-gray-700 truncate">{stage.stage}</p>
            {stage.result && (
              <span className="text-[8px] text-gray-400 shrink-0">{expanded ? '▴' : '▾'}</span>
            )}
          </div>
          <p className="text-[10px] text-gray-500 leading-snug mt-0.5">{stage.description}</p>
        </button>
        {expanded && stage.result && (
          <div className="mt-1.5 px-2.5 py-2 rounded-lg bg-gray-50 border border-gray-100">
            <p className="text-[10px] text-gray-600 leading-relaxed">{stage.result}</p>
          </div>
        )}
      </div>
    </div>
  )
})

// ── Bullet list section ───────────────────────────────────────────────────────

const BulletSection = memo(function BulletSection({
  label, items,
  colorClass = 'text-gray-300', bgClass = 'bg-gray-50',
  borderClass = 'border-gray-100', textClass = 'text-gray-600', icon = '·',
}) {
  if (!items?.length) return null
  return (
    <div className={`px-4 py-3 rounded-xl border ${borderClass} ${bgClass}`}>
      <p className={`text-[9px] font-black uppercase tracking-wide mb-1.5 ${textClass}`}>{label}</p>
      <div className="space-y-1">
        {items.map((item, i) => (
          <p key={i} className="text-[10px] text-gray-600 leading-snug flex items-start gap-1.5">
            <span className={`shrink-0 mt-0.5 ${colorClass}`}>{icon}</span>
            <span className="min-w-0 break-words">{item}</span>
          </p>
        ))}
      </div>
    </div>
  )
})

// ── Institutional fallback ─────────────────────────────────────────────────────

const TRACE_STAGE_LABELS = ['Data Retrieval', 'Signal Analysis', 'Agent Council', 'Consensus', 'Evidence', 'Synthesis']

const TraceFallback = memo(function TraceFallback({ crop, state, isError, onRetry }) {
  return (
    <div className="space-y-4">
      {/* Skeleton pipeline — shows missing stages */}
      <div className="flex items-start px-1">
        {TRACE_STAGE_LABELS.map((label, i) => (
          <Fragment key={i}>
            <div className="flex flex-col items-center gap-1.5 shrink-0">
              <div className="w-7 h-7 rounded-full flex items-center justify-center text-[9px] font-black bg-gray-200 text-gray-400">
                {i + 1}
              </div>
              <p className="text-[8px] text-gray-300 text-center leading-tight w-12 truncate">{label}</p>
            </div>
            {i < TRACE_STAGE_LABELS.length - 1 && (
              <div className="flex-1 h-px mt-3.5 mx-1 bg-gray-200" />
            )}
          </Fragment>
        ))}
      </div>

      <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3.5">
        <div className="flex items-start gap-2.5">
          <span className="text-amber-500 text-sm mt-0.5 shrink-0">⚠</span>
          <div className="flex-1">
            <p className="text-[11px] font-black text-amber-800 uppercase tracking-wide">
              {isError ? 'TRACE PIPELINE FAILED' : 'REASONING TRACE UNAVAILABLE'}
            </p>
            <p className="text-[10px] text-amber-700 mt-0.5 leading-snug">
              {isError
                ? `The decision trace engine failed for ${crop ?? 'this crop'} in ${state ?? 'this state'}.`
                : `Insufficient data for ${crop ?? 'this crop'} in ${state ?? 'this state'} to generate a complete 6-stage reasoning trace.`}
            </p>
          </div>
          {isError && onRetry && (
            <button onClick={onRetry} className="shrink-0 text-[9px] font-bold px-2.5 py-1 rounded-full border border-amber-400 text-amber-700 bg-amber-100 hover:bg-amber-200 transition-colors">
              ↻ Retry
            </button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {[
          { label: 'STRONGEST EVIDENCE', bg: 'bg-emerald-50', border: 'border-emerald-200', text: 'text-emerald-700', msg: 'No evidence assembled' },
          { label: 'CONFIDENCE DRIVERS', bg: 'bg-blue-50',    border: 'border-blue-200',    text: 'text-blue-700',    msg: 'No confidence drivers identified' },
        ].map(({ label, bg, border, text, msg }) => (
          <div key={label} className={`px-4 py-3 rounded-xl border ${border} ${bg}`}>
            <p className={`text-[9px] font-black uppercase tracking-wide mb-1.5 ${text}`}>{label}</p>
            <p className={`text-[10px] italic ${text} opacity-60`}>{msg}</p>
          </div>
        ))}
      </div>
    </div>
  )
})

// ── Main component ─────────────────────────────────────────────────────────────

export default function AIDecisionTrace({ crop, state }) {
  const [data,       setData]       = useState(null)
  const [loading,    setLoading]    = useState(false)
  const [error,      setError]      = useState(null)
  const [showStages, setShowStages] = useState(true)

  const load = useCallback(() => {
    if (!crop || !state) return
    setLoading(true)
    setError(null)
    decisionService.getCouncil(crop, state)
      .then(d => setData(d))
      .catch(() => setError('Decision trace unavailable'))
      .finally(() => setLoading(false))
  }, [crop, state])

  useEffect(() => { load() }, [load])

  if (!crop || !state) {
    return (
      <div className="text-center py-6 text-gray-400 text-[11px]">
        Select a crop and state to view the decision reasoning chain.
      </div>
    )
  }

  if (loading) {
    return (
      <div className="space-y-4 animate-pulse">
        {/* Skeleton pipeline flow */}
        <div className="flex items-center gap-1 px-1">
          {[1,2,3,4,5,6].map(i => (
            <Fragment key={i}>
              <div className="w-7 h-7 rounded-full bg-gray-200 shrink-0" />
              {i < 6 && <div className="flex-1 h-px bg-gray-100" />}
            </Fragment>
          ))}
        </div>
        <div className="h-16 bg-gray-100 rounded-xl" />
        <div className="h-8 bg-gray-50 rounded-xl" />
        <div className="grid grid-cols-2 gap-2">
          <div className="h-6 bg-gray-100 rounded-xl" />
          <div className="h-6 bg-gray-100 rounded-xl" />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="h-24 bg-gray-50 rounded-xl" />
          <div className="h-24 bg-gray-50 rounded-xl" />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="h-24 bg-gray-50 rounded-xl" />
          <div className="h-24 bg-gray-50 rounded-xl" />
        </div>
      </div>
    )
  }

  const showFallback = !loading && (error || !data?.has_data || !data?.trace)

  if (showFallback) {
    return (
      <div className="space-y-4">
        <TraceFallback crop={crop} state={state} isError={!!error} onRetry={load} />
      </div>
    )
  }

  const t          = data.trace
  const quality    = getQuality(t.evidence_quality)
  const stages     = t.pipeline_stages ?? []
  const agreed     = t.agreed_agents ?? []
  const dissenting = t.dissenting_agents ?? []

  return (
    <div className="space-y-4">

      {/* ── Controls — always visible ──────────────────────────────────── */}
      <div className="flex items-center justify-end">
        <button
          onClick={() => setShowStages(s => !s)}
          className={`text-[9px] font-bold px-2.5 py-1 rounded-full border transition-colors ${
            showStages
              ? 'bg-gray-900 border-gray-900 text-white'
              : 'bg-gray-50 border-gray-200 text-gray-500 hover:border-gray-400'
          }`}
        >
          Stages
        </button>
      </div>

      {/* ── 1. Visual pipeline flow ─────────────────────────────────────── */}
      {stages.length > 0 && <PipelineFlow stages={stages} />}

      {/* ── 2. Decision summary ──────────────────────────────────────────── */}
      {t.trace_summary && (
        <div className="flex gap-2.5 px-4 py-3 rounded-xl bg-gray-900 border border-gray-800">
          <div className="w-0.5 self-stretch rounded-full bg-emerald-500/60 shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-[9px] font-black uppercase tracking-widest text-gray-500 mb-1">DECISION SUMMARY</p>
            <p className="text-[11px] text-gray-200 leading-relaxed">{t.trace_summary}</p>
          </div>
        </div>
      )}

      {/* ── 3. Evidence quality banner ──────────────────────────────────── */}
      <div className={`rounded-xl border ${quality.border} ${quality.bg} px-4 py-3`}>
        <div className="flex items-center justify-between mb-1.5">
          <p className="text-[9px] font-black uppercase tracking-widest text-gray-400">EVIDENCE QUALITY</p>
          <span className={`text-[10px] font-bold ${quality.text}`}>
            {(t.evidence_quality ?? 'unknown').toUpperCase()}
          </span>
        </div>
        <div className="h-1.5 rounded-full bg-gray-100 overflow-hidden">
          <div className={`h-full rounded-full ${quality.bar} transition-all duration-700 ease-out`} style={{ width: `${quality.pct}%` }} />
        </div>
      </div>

      {/* ── 4. Agent consensus ──────────────────────────────────────────── */}
      <div className="grid grid-cols-2 gap-2">
        <div className="px-3.5 py-3 rounded-xl bg-emerald-50 border border-emerald-200">
          <p className="text-[9px] font-black uppercase tracking-wide text-emerald-700 mb-1.5">
            AGREEMENT ({agreed.length})
          </p>
          {agreed.length === 0
            ? <p className="text-[9px] text-emerald-600">All unified</p>
            : agreed.map((a, i) => (
                <p key={i} className="text-[9px] text-emerald-700 truncate">✓ {a}</p>
              ))}
        </div>
        <div className={`px-3.5 py-3 rounded-xl border ${
          dissenting.length > 0 ? 'bg-orange-50 border-orange-200' : 'bg-gray-50 border-gray-100'
        }`}>
          <p className={`text-[9px] font-black uppercase tracking-wide mb-1.5 ${
            dissenting.length > 0 ? 'text-orange-700' : 'text-gray-400'
          }`}>
            DISSENT ({dissenting.length})
          </p>
          {dissenting.length === 0
            ? <p className="text-[9px] text-gray-400">None</p>
            : dissenting.map((a, i) => (
                <p key={i} className="text-[9px] text-orange-700 truncate">⚡ {a}</p>
              ))}
        </div>
      </div>

      {/* ── 5. Evidence intelligence — 2-col ─────────────────────────────── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <BulletSection
          label="STRONGEST EVIDENCE"
          items={t.strongest_evidence}
          icon="▸"
          bgClass="bg-emerald-50"
          borderClass="border-emerald-200"
          colorClass="text-emerald-500"
          textClass="text-emerald-700"
        />
        <BulletSection
          label="CONFIDENCE DRIVERS"
          items={t.confidence_drivers}
          icon="+"
          bgClass="bg-blue-50"
          borderClass="border-blue-200"
          colorClass="text-blue-400"
          textClass="text-blue-700"
        />
      </div>

      {/* ── 6. Risk & uncertainty — 2-col ────────────────────────────────── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <BulletSection
          label="RISK FACTORS"
          items={t.risk_drivers}
          icon="⚡"
          bgClass="bg-amber-50"
          borderClass="border-amber-200"
          colorClass="text-amber-400"
          textClass="text-amber-700"
        />
        <BulletSection
          label="CAVEATS / UNCERTAINTY"
          items={t.weakest_evidence}
          icon="⚠"
          bgClass="bg-red-50"
          borderClass="border-red-100"
          colorClass="text-red-400"
          textClass="text-red-600"
        />
      </div>

      {/* ── 7. Impact narratives — 2-col ─────────────────────────────────── */}
      {(t.anomaly_impact || t.seasonal_impact) && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
          {t.anomaly_impact && (
            <div className="px-4 py-2.5 rounded-xl bg-gray-50 border border-gray-100">
              <p className="text-[9px] font-black uppercase tracking-wide text-gray-400 mb-0.5">ANOMALY IMPACT</p>
              <p className="text-[10px] text-gray-600 leading-relaxed">{t.anomaly_impact}</p>
            </div>
          )}
          {t.seasonal_impact && (
            <div className="px-4 py-2.5 rounded-xl bg-gray-50 border border-gray-100">
              <p className="text-[9px] font-black uppercase tracking-wide text-gray-400 mb-0.5">SEASONAL IMPACT</p>
              <p className="text-[10px] text-gray-600 leading-relaxed">{t.seasonal_impact}</p>
            </div>
          )}
        </div>
      )}

      {/* ── 8. Stage details — expandable vertical list (toggled) ─────────── */}
      {showStages && stages.length > 0 && (
        <div>
          <p className="text-[9px] font-black uppercase tracking-widest text-gray-400 mb-3">STAGE DETAILS</p>
          <div>
            {stages.map((stage, i) => (
              <PipelineStage key={i} stage={stage} index={i} isLast={i === stages.length - 1} />
            ))}
          </div>
        </div>
      )}

    </div>
  )
}
