/**
 * Academic Overview (Phase 6) — a concise, visual briefing for professors
 * and reviewers: what was built, which AI concepts it demonstrates, and
 * the key architectural decisions. Everything listed maps to real,
 * implemented modules in this codebase.
 */

const TECH = [
  { icon: '⚡', name: 'FastAPI + DuckDB', note: '48.2M AGMARKNET records, lazy parquet scans' },
  { icon: '📈', name: 'Facebook Prophet', note: 'yearly seasonality + Indian holiday effects' },
  { icon: '⚛️', name: 'React 18 + Vite', note: 'Recharts visualizations, Tailwind design system' },
  { icon: '🗣️', name: 'Web Speech API', note: 'browser-native voice input/output, zero external services' },
]

const CONCEPTS = [
  { icon: '🏷️', name: 'Data-driven model routing',
    note: 'Tier A/B/C/D classification per crop+state — Prophet, sparse-trend fallback, or analytics-only, decided by depth, recency and volatility' },
  { icon: '⚖️', name: 'Explainable confidence',
    note: 'a 6-factor weighted score (training depth, continuity, volatility, anomalies, seasonality, recency) with the full breakdown exposed in the UI' },
  { icon: '🧠', name: 'Grounded generation',
    note: 'every AI narrative, strategy and chat reply is assembled deterministically from computed metrics — auditable, no hallucination' },
  { icon: '💬', name: 'Conversational memory',
    note: 'stateless-server context engine: multi-turn follow-ups ("what about Feb?", "and in Kerala?") resolved from the transcript' },
  { icon: '🤖', name: 'Multi-agent presentation',
    note: 'six real subsystems (forecast, risk, seasonal, strategy, confidence, narrator) visualized as a collaborating pipeline' },
  { icon: '🔌', name: 'LLM-ready abstraction',
    note: 'chat sits behind a provider interface — a Claude/Gemini provider can slot in with the rule engine as guaranteed fallback' },
]

const DECISIONS = [
  'Single crop registry as source of truth — names, aliases, categories, per-crop price caps (Cardamoms trades above the global outlier cap)',
  'Recency measured against dataset end, so dead reporting can never masquerade as forecastable',
  'Graceful degradation over hard failure — analytics-only pairs get regional intelligence and alternatives, never an error page',
  'Cache-first analytics: one cross-crop pass and one pair-matrix SQL feed every executive visual (~0.2s warm)',
]

export default function AcademicOverview({ open, onClose }) {
  if (!open) return null
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-gray-900/40 p-4 sm:p-8"
         onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl ai-fade-up"
           onClick={e => e.stopPropagation()}>
        <div className="flex items-center gap-2.5 px-6 py-4 border-b border-gray-100">
          <div className="w-9 h-9 rounded-xl bg-gray-900 text-white flex items-center justify-center text-lg">🎓</div>
          <div>
            <p className="text-sm font-bold text-gray-900">Academic Overview</p>
            <p className="text-[11px] text-gray-400">AgroPrice AI · GenAI Agricultural Market Intelligence · MCA Project</p>
          </div>
          <button onClick={onClose} aria-label="Close overview"
                  className="ml-auto text-gray-400 hover:text-gray-600">✕</button>
        </div>

        <div className="px-6 py-5 space-y-5">
          <div>
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2">Technology Stack</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {TECH.map(t => (
                <div key={t.name} className="flex items-start gap-2.5 rounded-xl border border-gray-100 p-3">
                  <span className="text-lg">{t.icon}</span>
                  <div>
                    <p className="text-xs font-bold text-gray-800">{t.name}</p>
                    <p className="text-[10px] text-gray-400 leading-snug">{t.note}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div>
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2">
              AI Concepts Demonstrated
            </p>
            <div className="space-y-2">
              {CONCEPTS.map(c => (
                <div key={c.name} className="flex items-start gap-2.5">
                  <span className="text-base mt-0.5">{c.icon}</span>
                  <p className="text-xs text-gray-600 leading-relaxed">
                    <strong className="text-gray-800">{c.name}</strong> — {c.note}
                  </p>
                </div>
              ))}
            </div>
          </div>

          <div>
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2">
              Key Architectural Decisions
            </p>
            <ul className="space-y-1.5">
              {DECISIONS.map((d, i) => (
                <li key={i} className="flex items-start gap-2 text-xs text-gray-600 leading-relaxed">
                  <span className="text-primary-400 mt-0.5 shrink-0">◆</span>{d}
                </li>
              ))}
            </ul>
          </div>

          <p className="text-[10px] text-gray-300 border-t border-gray-50 pt-3">
            For the full pipeline walkthrough, open "How AgroPrice AI Thinks" at the bottom of the
            Forecast page, or press 🎥 Presentation Mode for a guided demo.
          </p>
        </div>
      </div>
    </div>
  )
}
