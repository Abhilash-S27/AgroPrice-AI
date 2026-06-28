import { useState } from 'react'
import Card from '@components/ui/Card'

/**
 * "How AgroPrice AI Thinks" — explainable-AI architecture walkthrough.
 * Documents the REAL pipeline implemented in this codebase (every stage
 * below maps to an actual module); nothing aspirational or invented.
 */

const STAGES = [
  {
    icon: '🗄️', title: '1 · Data Foundation',
    text: '48.2M AGMARKNET mandi records (2015–2026) ingested as parquet and queried lazily '
        + 'through DuckDB. Per-crop price sanity caps (Cardamoms trades above the global cap), '
        + 'variety deduplication, and daily aggregation produce one clean price per market per day.',
    module: 'data/loaders · crop_registry',
  },
  {
    icon: '🏷️', title: '2 · Tier Classification',
    text: 'Every crop+state pair is classified at request time: Tier A (≥1,000 days, ≥70% '
        + 'recent continuity, CV ≤75%) gets full Prophet; Tier B runs Prophet with declared '
        + 'uncertainty; Tier C falls back to a robust sparse-trend estimator; Tier D routes to '
        + 'analytics-only intelligence. Recency is measured against the dataset end, so dead '
        + 'reporting cannot masquerade as forecastable.',
    module: 'analytics.classify_forecast_tier',
  },
  {
    icon: '📈', title: '3 · Forecasting Engines',
    text: 'Facebook Prophet (multiplicative yearly seasonality, Indian holidays) for Tiers A/B; '
        + 'a Theil–Sen trend × monthly seasonal multiplier model with widening uncertainty for '
        + 'Tier C. Results are cached per crop/state/horizon/model.',
    module: 'ml/forecasting · prophet_model + sparse_trend',
  },
  {
    icon: '⚖️', title: '4 · Weighted Confidence Scoring',
    text: 'Confidence is computed, not asserted: training depth (25) + recent continuity (30) + '
        + 'volatility stability (20) + anomaly cleanliness (10) + seasonal consistency (10) + '
        + 'data recency (5) = a 0–100 score whose full factor breakdown is exposed in the UI.',
    module: 'ai_forecast_narrator.compute_confidence_score',
  },
  {
    icon: '🧠', title: '5 · Deterministic Reasoning Engine',
    text: 'Narratives, strategies, anomaly explanations, insight cards and battle verdicts are '
        + 'assembled by rules over real metrics — the same numbers shown on screen. No text is '
        + 'generated without a metric behind it, which keeps every sentence auditable.',
    module: 'ai_forecast_narrator · executive_intelligence',
  },
  {
    icon: '💬', title: '6 · Conversational Memory',
    text: 'The chat ships its recent transcript with each message; a context manager rebuilds '
        + 'working memory — active crop, state, timeframe, intent — and resolves follow-ups like '
        + '"what about Feb?" or "and in Kerala?". Inherited slots are shown as "AI inferred" pills.',
    module: 'chat_context_manager.ConversationContext',
  },
  {
    icon: '🧭', title: '7 · Advisory + Fallback Routing',
    text: 'Advisory questions rank all 27 crops on volatility, momentum, continuity and '
        + 'reliability. When a pair cannot support forecasting, the system never goes blank — it '
        + 'explains why, profiles every state\'s data, and offers nearby markets and same-category '
        + 'alternatives as one-click actions.',
    module: 'market_advisor · build_regional_intelligence',
  },
  {
    icon: '🔌', title: '8 · LLM-Ready Provider Layer',
    text: 'The chat sits behind a provider abstraction: today a deterministic rule engine; a '
        + 'Claude/Gemini provider can slot in using the same grounding context, with the rule '
        + 'engine as automatic fallback — intelligence degrades gracefully, never to zero.',
    module: 'forecast_ai_chat.ChatProvider',
  },
]

export default function HowItThinks() {
  const [open, setOpen] = useState(false)
  return (
    <Card className="!p-0 overflow-hidden ai-fade-up">
      <button onClick={() => setOpen(o => !o)}
        className="w-full px-5 py-3.5 flex items-center gap-2.5 hover:bg-gray-50/50 transition-colors">
        <div className="w-8 h-8 rounded-xl bg-gray-900 text-white flex items-center justify-center text-base">🧠</div>
        <div className="text-left">
          <p className="text-sm font-bold text-gray-900 leading-tight">How AgroPrice AI Thinks</p>
          <p className="text-[11px] text-gray-400">explainable-AI architecture · 8-stage decision pipeline</p>
        </div>
        <span className="ml-auto text-gray-400 text-xs">{open ? '▾' : '▸'}</span>
      </button>

      {open && (
        <div className="px-5 pb-5 ai-fade-up">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {STAGES.map((s, i) => (
              <div key={i} className="rounded-xl border border-gray-100 p-3.5 hover:border-primary-200 transition-colors">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-base">{s.icon}</span>
                  <p className="text-xs font-bold text-gray-800">{s.title}</p>
                </div>
                <p className="text-[11px] text-gray-600 leading-relaxed mb-1.5">{s.text}</p>
                <p className="text-[9px] font-mono text-emerald-400 inline-block px-1.5 py-0.5 rounded"
                   style={{ background: 'rgba(52,211,153,0.12)', border: '1px solid rgba(52,211,153,0.20)' }}>
                  {s.module}
                </p>
              </div>
            ))}
          </div>
          <p className="text-[10px] text-gray-300 mt-3">
            Every stage above maps to a real module in this codebase — the platform is fully
            deterministic, grounded, and auditable end to end.
          </p>
        </div>
      )}
    </Card>
  )
}
