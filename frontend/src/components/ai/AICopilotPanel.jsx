import { useState } from 'react'
import Card from '@components/ui/Card'
import { Spinner } from '@components/ui/Loader'
import AIDriversStrip from '@components/ai/AIDriversStrip'

/**
 * AgroPrice AI Copilot panel — narrative, confidence reasoning, strategy.
 * All content arrives from /api/ai/insights (real-metric generation).
 */

function AIBadge({ refreshing }) {
  return (
    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold
                     text-primary-700 border border-primary-200 ai-shimmer">
      <span className="w-1.5 h-1.5 rounded-full bg-primary-500 ai-pulse" />
      {refreshing ? 'AgroPrice AI · thinking…' : 'AgroPrice AI · generated from live analytics'}
    </span>
  )
}

function ConfidenceMeter({ confidence }) {
  const [showBreakdown, setShowBreakdown] = useState(false)
  const pct = confidence?.score ?? 0
  const breakdown = confidence?.breakdown ?? []
  const tone =
    pct >= 70 ? 'bg-emerald-500' :
    pct >= 50 ? 'bg-amber-500'   : 'bg-red-400'
  return (
    <div>
      <div className="flex items-baseline justify-between mb-1">
        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">
          AI Confidence Reasoning
        </p>
        <span className="text-sm font-extrabold text-gray-900">
          {pct}<span className="text-[10px] font-medium text-gray-400">/100</span>
        </span>
      </div>
      <div className="h-1.5 rounded-full bg-gray-100 overflow-hidden mb-3">
        <div className={`h-full rounded-full transition-all duration-700 ${tone}`}
             style={{ width: `${pct}%` }} />
      </div>
      <p className="text-xs text-gray-600 mb-2.5">{confidence?.summary}</p>
      <ul className="space-y-1.5">
        {(confidence?.reasons ?? []).map((r, i) => (
          <li key={i} className="flex items-start gap-2 text-xs leading-relaxed">
            <span className={`mt-0.5 shrink-0 text-[10px] font-bold ${
              r.direction === 'up' ? 'text-emerald-500' : 'text-amber-500'
            }`}>
              {r.direction === 'up' ? '▲' : '▼'}
            </span>
            <span className="text-gray-600">{r.text}</span>
          </li>
        ))}
      </ul>

      {/* weighted scoring breakdown — the math behind the number */}
      {breakdown.length > 0 && (
        <div className="mt-3">
          <button
            onClick={() => setShowBreakdown(s => !s)}
            className="text-[10px] font-semibold text-primary-600 hover:text-primary-700"
          >
            {showBreakdown ? '▾ Hide scoring breakdown' : '▸ Show scoring breakdown'}
          </button>
          {showBreakdown && (
            <div className="mt-2 space-y-1.5 ai-fade-up">
              {breakdown.map((b, i) => (
                <div key={i} title={b.detail} className="cursor-default">
                  <div className="flex justify-between text-[10px] mb-0.5">
                    <span className="text-gray-500 font-medium">{b.factor}</span>
                    <span className="text-gray-400 font-semibold">{b.earned}/{b.weight}</span>
                  </div>
                  <div className="h-1 rounded-full bg-gray-100 overflow-hidden">
                    <div className="h-full rounded-full bg-primary-400"
                         style={{ width: `${(b.earned / b.weight) * 100}%` }} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

const STRATEGY_TABS = [
  { key: 'farmer',  label: '🌱 Farmer',  empty: 'No farmer-specific guidance for this state.' },
  { key: 'trader',  label: '📊 Trader',  empty: 'No trader-specific guidance for this state.' },
  { key: 'storage', label: '🏪 Storage', empty: 'No storage guidance for this state.' },
  { key: 'risks',   label: '⚠️ Risks',   empty: 'No elevated risk flags.' },
]

function StrategyTabs({ strategy }) {
  const [tab, setTab] = useState('farmer')
  const items = strategy?.[tab] ?? []
  const meta = STRATEGY_TABS.find(t => t.key === tab)
  return (
    <div>
      <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2">
        AI Market Strategy
      </p>
      <div className="flex gap-1 mb-3 flex-wrap">
        {STRATEGY_TABS.map(t => (
          <button key={t.key}
            onClick={() => setTab(t.key)}
            className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-colors ${
              tab === t.key
                ? 'bg-primary-600 text-white'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}>
            {t.label}
          </button>
        ))}
      </div>
      {items.length ? (
        <ul className="space-y-2">
          {items.map((s, i) => (
            <li key={i} className="flex items-start gap-2 text-xs leading-relaxed text-gray-700">
              <span className="text-primary-400 mt-0.5 shrink-0">◆</span>
              {s}
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-xs text-gray-400">{meta.empty}</p>
      )}
    </div>
  )
}

export default function AICopilotPanel({ insights, loading, isRefetching, error }) {
  if (loading) {
    return (
      <Card className="!p-5">
        <div className="flex items-center gap-3 text-sm text-gray-400">
          <Spinner size="sm" className="w-4 h-4" />
          AgroPrice AI is analysing live market metrics…
        </div>
      </Card>
    )
  }
  if (error || !insights?.has_data) return null

  return (
    <Card className={`!p-0 overflow-hidden ai-fade-up transition-opacity duration-200 ${
      isRefetching ? 'opacity-50' : 'opacity-100'
    }`}>
      {/* header strip */}
      <div className="px-5 pt-4 pb-3 border-b border-gray-100 flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-primary-600 text-white flex items-center justify-center text-base shrink-0">
            ✦
          </div>
          <div>
            <p className="text-sm font-bold text-gray-900 leading-tight">AI Forecast Copilot</p>
            <p className="text-[11px] text-gray-400">narrative · confidence · strategy</p>
          </div>
        </div>
        <AIBadge refreshing={isRefetching} />
      </div>

      <div className="p-5 space-y-5">
        {/* market narrative */}
        <div>
          <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1.5">
            Market Narrative
          </p>
          <p className="text-sm text-gray-700 leading-relaxed">{insights.narrative}</p>
        </div>

        {/* trend story strip */}
        <div className="flex items-start gap-2.5 px-3.5 py-2.5 rounded-xl"
             style={{ background: 'rgba(52,211,153,0.10)', border: '1px solid rgba(52,211,153,0.22)' }}>
          <span className="text-emerald-400 mt-0.5 shrink-0 text-sm">❝</span>
          <p className="text-xs text-emerald-300 font-medium leading-relaxed italic">
            {insights.trend_story}
          </p>
        </div>

        {/* explainability: the data signals behind these conclusions */}
        <AIDriversStrip drivers={insights.drivers ?? []} />

        {/* confidence + strategy side by side */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 pt-1">
          <ConfidenceMeter confidence={insights.confidence} />
          <StrategyTabs strategy={insights.strategy} />
        </div>

        {/* anomaly explanations */}
        {insights.anomaly_explanations?.length > 0 && (
          <div className="pt-1">
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2">
              AI Anomaly Interpretation
            </p>
            <div className="space-y-2.5">
              {insights.anomaly_explanations.slice(0, 2).map((a, i) => (
                <div key={i} className="p-3 rounded-xl border border-gray-100 bg-gray-50/70">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-sm">{a.event_type === 'spike' ? '⚡' : '📉'}</span>
                    <span className="text-xs font-bold text-gray-800">
                      {a.event_type === 'spike' ? 'Price Spike' : 'Price Crash'} · {a.date}
                    </span>
                    <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded ${
                      a.severity === 'high'   ? 'bg-red-50 text-red-600' :
                      a.severity === 'medium' ? 'bg-orange-50 text-orange-600' :
                                                'bg-yellow-50 text-yellow-700'
                    }`}>
                      {a.severity}
                    </span>
                  </div>
                  <p className="text-xs text-gray-600 leading-relaxed">
                    {a.meaning} {a.probable_cause} {a.implication}
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </Card>
  )
}
