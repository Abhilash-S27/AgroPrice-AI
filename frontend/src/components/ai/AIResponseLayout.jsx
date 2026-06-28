/**
 * AIResponseLayout — Phase 3B executive AI response presentation.
 *
 * Transforms a raw AI message into a structured executive intelligence brief:
 *
 *   [Executive Signal Strip]  — 4 key verdicts at a glance
 *   [AI Narrative]            — Gemini text, collapsible after 4 lines
 *   [Visualization Strip]     — Sparkline, volatility, seasonal, confidence
 *   [Confidence Diagnostics]  — Why X% confidence (expandable)
 *   [AI Intelligence Cards]   — 2×2 agent verdict grid
 *
 * Gracefully degrades:
 *   - Ungrounded responses: shows plain text without executive framing
 *   - Streaming: shows skeleton header + live text without collapse
 *
 * Phase 3B — Intelligence Visualization & Executive UX Polish
 */

import { useState, memo } from 'react'
import AISignalBadge, { getSignalConfig } from './AISignalBadge'
import { AIVisualizationStrip } from './AIVisualization'
import AIExecutiveSummaryCards from './AIExecutiveSummaryCards'
import AIReasoningPanel from './AIReasoningPanel'

// ── Markdown renderer (reused from Phase 2A) ──────────────────────────────────

function renderMarkdown(text) {
  if (!text) return null
  const lines = text.split('\n')
  const elements = []
  let listItems = []

  function flushList() {
    if (listItems.length > 0) {
      elements.push(
        <ul key={`ul-${elements.length}`} className="space-y-1 my-1.5 ml-2">
          {listItems.map((li, i) => (
            <li key={i} className="flex gap-2 text-[13px] text-gray-700 leading-relaxed">
              <span className="text-primary-400 mt-0.5 shrink-0 font-bold text-[10px]">▸</span>
              <span dangerouslySetInnerHTML={{ __html: inlineFormat(li) }} />
            </li>
          ))}
        </ul>
      )
      listItems = []
    }
  }

  function inlineFormat(str) {
    return str
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.*?)\*/g, '<em>$1</em>')
      .replace(/(₹[\d,]+)/g, '<span class="text-emerald-600 font-semibold">$1</span>')
      .replace(/(\d+\.?\d*%)/g, '<span class="text-blue-600 font-medium">$1</span>')
  }

  lines.forEach((line, i) => {
    const trimmed = line.trim()
    if (!trimmed) { flushList(); return }

    if (/^#{1,3}\s+/.test(trimmed)) {
      flushList()
      const content = trimmed.replace(/^#{1,3}\s+/, '')
      elements.push(
        <p key={i} className="text-[11px] font-bold text-gray-600 uppercase tracking-wider mt-2.5 mb-1">
          {content}
        </p>
      )
    } else if (/^[\*\-•]\s+/.test(trimmed) || /^\d+\.\s+/.test(trimmed)) {
      listItems.push(trimmed.replace(/^[\*\-•]\s+/, '').replace(/^\d+\.\s+/, ''))
    } else {
      flushList()
      elements.push(
        <p key={i} className="text-[13px] text-gray-700 leading-relaxed"
           dangerouslySetInnerHTML={{ __html: inlineFormat(trimmed) }} />
      )
    }
  })
  flushList()
  return elements
}

// ── Executive Signal Strip ────────────────────────────────────────────────────

function ExecutiveStrip({ agents, grounded, latencyMs }) {
  if (!agents || !Object.keys(agents).length) return null
  const { trend, risk, seasonal, recommendation: rec } = agents
  if (!rec?.verdict || rec.verdict === 'UNKNOWN') return null

  return (
    <div className="flex flex-wrap items-center gap-1 pb-2 mb-2 border-b border-gray-100">
      {trend?.verdict    && <AISignalBadge verdict={trend.verdict}    size="xs" />}
      {risk?.verdict     && <AISignalBadge verdict={risk.verdict}     size="xs" />}
      {seasonal?.verdict && <AISignalBadge verdict={seasonal.verdict} size="xs" />}
      {rec?.verdict      && <AISignalBadge verdict={rec.verdict}      size="xs" />}
      <span className="ml-auto flex items-center gap-1.5 text-[8px] text-gray-400 font-medium">
        {grounded && (
          <>
            <span className="w-1 h-1 rounded-full bg-emerald-500 inline-block" />
            <span className="text-emerald-600">Grounded</span>
          </>
        )}
        {latencyMs > 0 && <span>· {latencyMs}ms</span>}
      </span>
    </div>
  )
}

// ── Collapsible AI Narrative ──────────────────────────────────────────────────

function CollapsibleNarrative({ text, isStreaming }) {
  const [expanded, setExpanded] = useState(false)
  const lines = (text || '').split('\n').filter(Boolean)
  const COLLAPSE_THRESHOLD = 8

  const shouldCollapse = !isStreaming && lines.length > COLLAPSE_THRESHOLD
  const visibleText    = shouldCollapse && !expanded
    ? lines.slice(0, COLLAPSE_THRESHOLD).join('\n')
    : text

  return (
    <div>
      <div className={`prose-sm ${shouldCollapse && !expanded ? 'line-clamp-none' : ''}`}>
        {renderMarkdown(visibleText)}
        {isStreaming && (
          <span className="inline-block w-0.5 h-3.5 bg-primary-500 ml-0.5 align-middle rounded-sm animate-pulse" />
        )}
      </div>
      {shouldCollapse && (
        <button
          onClick={() => setExpanded(e => !e)}
          className="mt-2 text-[10px] font-semibold text-primary-600 hover:text-primary-700 flex items-center gap-1 transition-colors"
        >
          <span className={`transition-transform duration-200 ${expanded ? 'rotate-90' : ''}`}>▶</span>
          {expanded ? 'Collapse analysis' : `Read full analysis (${lines.length - COLLAPSE_THRESHOLD} more lines)`}
        </button>
      )}
    </div>
  )
}

// ── Confidence Diagnostics Panel ──────────────────────────────────────────────

function ConfidenceDiagnostics({ recommendation, trend, risk }) {
  const [open, setOpen] = useState(false)
  if (!recommendation?.details?.confidence) return null

  const conf   = recommendation.details
  const oppPct = Math.round((conf.opportunity_score ?? 0.5) * 100)
  const drivers = []

  // Build confidence driver bullets from agent data
  const tScore = Math.round((trend?.score ?? 0.5) * 100)
  const rScore = Math.round((risk?.score ?? 0.5) * 100)

  if (trend?.verdict) {
    drivers.push({ label: 'Trend signal', value: trend.verdict.replace(/_/g, ' '), positive: trend.score > 0.5 })
  }
  if (risk?.verdict) {
    drivers.push({ label: 'Risk level', value: risk.verdict.replace(/_/g, ' '), positive: risk.score < 0.5 })
  }
  if (conf.confidence === 'high') {
    drivers.push({ label: 'Data quality', value: 'Sufficient training depth', positive: true })
  } else if (conf.confidence === 'low') {
    drivers.push({ label: 'Data quality', value: 'Limited historical data', positive: false })
  }
  if (risk?.details?.anomaly_count > 1) {
    drivers.push({ label: 'Anomaly noise', value: `${risk.details.anomaly_count} events in 90 days`, positive: false })
  }

  return (
    <div className="mt-2 border border-gray-100 rounded-lg overflow-hidden">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-3 py-2 bg-gray-50 hover:bg-gray-100 transition-colors text-left"
      >
        <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wide">
          Confidence Diagnostics · {oppPct}% opportunity score
        </span>
        <span className={`text-gray-400 text-xs transition-transform duration-200 ${open ? 'rotate-90' : ''}`}>▶</span>
      </button>
      {open && (
        <div className="px-3 py-2.5 space-y-1.5 bg-white">
          <p className="text-[10px] text-gray-500 mb-2">
            Opportunity score is a composite of trend ({tScore}%), inverse risk ({100 - rScore}%), and seasonal positioning.
          </p>
          {drivers.map((d, i) => (
            <div key={i} className="flex items-center gap-2">
              <span className={`text-[9px] ${d.positive ? 'text-emerald-500' : 'text-red-400'}`}>
                {d.positive ? '✓' : '✗'}
              </span>
              <span className="text-[10px] text-gray-500">{d.label}:</span>
              <span className="text-[10px] font-semibold text-gray-700">{d.value}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ── Skeleton loading state ────────────────────────────────────────────────────

function ResponseSkeleton() {
  return (
    <div className="animate-pulse space-y-2">
      <div className="flex gap-1.5">
        {[60, 72, 56, 64].map((w, i) => (
          <div key={i} className="h-4 rounded-full bg-gray-100" style={{ width: w }} />
        ))}
      </div>
      <div className="space-y-1.5 pt-1">
        <div className="h-3 bg-gray-100 rounded w-full" />
        <div className="h-3 bg-gray-100 rounded w-5/6" />
        <div className="h-3 bg-gray-100 rounded w-4/5" />
      </div>
    </div>
  )
}

// ── Main Component ────────────────────────────────────────────────────────────

const AIResponseLayout = memo(function AIResponseLayout({ msg, isStreaming = false }) {
  if (!msg) return null

  const {
    text            = '',
    agent_insights  = {},
    grounded        = false,
    latency_ms      = 0,
    error_type,
    reasoning_trace = null,
    persona         = null,
  } = msg

  const agents    = agent_insights || {}
  const hasAgents = !!(agents.trend || agents.risk || agents.recommendation)

  // While waiting for first token — show skeleton
  if (isStreaming && !text) {
    return <ResponseSkeleton />
  }

  // Ungrounded / no agents — plain rendering
  if (!grounded || !hasAgents) {
    return (
      <div>
        <CollapsibleNarrative text={text} isStreaming={isStreaming} />
      </div>
    )
  }

  // Grounded with agent data — full executive layout
  return (
    <div className="space-y-2">
      {/* Executive signal strip */}
      <ExecutiveStrip
        agents={agents}
        grounded={grounded}
        latencyMs={latency_ms}
      />

      {/* AI narrative — collapsible */}
      <CollapsibleNarrative text={text} isStreaming={isStreaming} />

      {/* Only show post-stream content after streaming completes */}
      {!isStreaming && (
        <>
          {/* Visualization strip — sparkline + meters */}
          <AIVisualizationStrip agentInsights={agents} />

          {/* Confidence diagnostics panel */}
          <ConfidenceDiagnostics
            recommendation={agents.recommendation}
            trend={agents.trend}
            risk={agents.risk}
          />

          {/* AI Intelligence Cards (2×2) */}
          <AIExecutiveSummaryCards agentInsights={agents} />

          {/* Collapsible agent reasoning — Explainability 2.0 (Phase 4A) */}
          <AIReasoningPanel
            agentInsights={agents}
            reasoningTrace={reasoning_trace}
            persona={persona}
          />
        </>
      )}
    </div>
  )
})

export default AIResponseLayout
