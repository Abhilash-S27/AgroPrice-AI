import { useState, useEffect, useCallback } from 'react'

/**
 * Presentation / Demo Mode (Phase 5) — guided walkthrough for reviews
 * and demos. Each step scrolls to a real section, dims everything else,
 * explains what the section demonstrates, and can trigger a one-click
 * demo scenario (e.g. switching to an analytics-only pair).
 *
 * Sections are addressed by DOM id; missing sections are skipped safely.
 */

const STEPS = [
  {
    id: 'command-center', title: 'South India AI Market Pulse',
    text: 'Executive command center: four KPI indices, a severity-ranked alert ribbon, and AI pulse cards — all computed live from 27 crops of cross-market analytics.',
  },
  {
    id: 'ai-copilot', title: 'AI Forecast Copilot',
    text: 'The narrative, confidence reasoning and strategy for the selected crop+state. Every sentence cites a computed metric; the confidence score exposes its full weighted breakdown.',
  },
  {
    id: 'agent-orchestrator', title: 'Multi-Agent Orchestration',
    text: 'Six real subsystems — forecaster, risk analyzer, seasonal decomposer, strategist, confidence scorer, narrator — visualized as collaborating agents with their live outputs.',
  },
  {
    id: 'forecast-chart', title: 'Tier-Aware Forecasting',
    text: 'Prophet (or the sparse-trend fallback) with an 80% confidence band, future-region shading, and AI anomaly annotations placed on real price points.',
    scenario: { label: 'Show Tier-A market (Tomato · Karnataka)', crop: 'Tomato', state: 'Karnataka' },
  },
  {
    id: 'story-mode', title: 'Market Story Mode',
    text: 'A cinematic AI briefing: past behaviour from the history timeline, present conditions, confidence assessment, and the projected trajectory — press Play.',
  },
  {
    id: 'ai-tools', title: 'Simulation + Conversational AI',
    text: 'What-if scenario modelling calibrated to real volatility, and a stateful copilot chat with multi-turn memory, temporal reasoning and advisory rankings.',
  },
  {
    id: 'market-vision', title: 'Market Vision · Executive Intelligence',
    text: 'The opportunity matrix (27 crops by risk × opportunity), the 135-cell reasoning heatmap, the AI crop battle, and the constraint-driven strategy planner.',
  },
  {
    id: 'analytics-fallback', title: 'Graceful Intelligence Degradation',
    text: 'Forecasting is honestly disabled where data cannot support it — regional intelligence, nearby benchmark markets and crop alternatives take over. No dead ends.',
    scenario: { label: 'Show analytics-only pair (Coffee · Andhra Pradesh)', crop: 'Coffee', state: 'Andhra Pradesh' },
    fallbackId: 'ai-copilot',
  },
]

/**
 * Spotlight implementation: opacity inherits multiplicatively down the DOM,
 * so dimming a common ancestor would fade the focused section too. Instead,
 * for every ancestor of the target (up to the page root) we dim its SIBLINGS
 * — the path to the spotlighted section stays at full opacity regardless of
 * how deeply it is nested.
 */
function clearSpotlight() {
  document.querySelectorAll('.demo-dimmed').forEach(el => el.classList.remove('demo-dimmed'))
  document.querySelectorAll('.demo-focus').forEach(el => el.classList.remove('demo-focus'))
}

function spotlight(target) {
  clearSpotlight()
  const root = document.getElementById('forecast-page-root')
  if (!target || !root || !root.contains(target)) return
  target.classList.add('demo-focus')
  let node = target
  while (node && node !== root) {
    const parent = node.parentElement
    if (!parent) break
    for (const sib of parent.children) {
      // demo-exempt: fixed overlays (these controls, modals) must stay live
      if (sib !== node && !sib.classList.contains('demo-exempt')) {
        sib.classList.add('demo-dimmed')
      }
    }
    node = parent
  }
}

export default function PresentationMode({ onScenario }) {
  const [active, setActive] = useState(false)
  const [step, setStep] = useState(0)

  const focus = useCallback((idx) => {
    const s = STEPS[idx]
    const el = document.getElementById(s.id) ?? document.getElementById(s.fallbackId ?? '')
    spotlight(el)
    el?.scrollIntoView({ behavior: 'smooth', block: 'center' })
  }, [])

  const start = () => {
    setActive(true)
    setStep(0)
    document.documentElement.requestFullscreen?.().catch(() => {})
    setTimeout(() => focus(0), 300)
  }

  const exit = useCallback(() => {
    setActive(false)
    clearSpotlight()
    if (document.fullscreenElement) document.exitFullscreen?.().catch(() => {})
  }, [])

  const go = (idx) => {
    const clamped = Math.max(0, Math.min(STEPS.length - 1, idx))
    setStep(clamped)
    setTimeout(() => focus(clamped), 100)
  }

  // keyboard navigation while presenting
  useEffect(() => {
    if (!active) return
    const onKey = (e) => {
      if (e.key === 'ArrowRight') go(step + 1)
      else if (e.key === 'ArrowLeft') go(step - 1)
      else if (e.key === 'Escape') exit()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, step])

  if (!active) {
    return (
      <button onClick={start}
        className="demo-exempt no-print fixed bottom-5 right-5 z-40 px-4 py-2.5 rounded-2xl bg-gray-900 text-white
                   text-xs font-bold shadow-xl hover:bg-gray-700 transition-colors ai-lift">
        🎥 Presentation Mode
      </button>
    )
  }

  const s = STEPS[step]
  return (
    <div className="demo-exempt no-print fixed bottom-5 left-1/2 -translate-x-1/2 z-50 w-[min(560px,92vw)]
                    bg-white/95 backdrop-blur border border-gray-200 rounded-2xl shadow-2xl p-4 ai-fade-up">
      <div className="flex items-center gap-2 mb-1.5">
        <span className="text-[10px] font-black tracking-[0.2em] text-primary-600">
          STEP {step + 1} / {STEPS.length}
        </span>
        <span className="text-sm font-bold text-gray-900">{s.title}</span>
        <span className="ml-auto text-[9px] text-gray-300 hidden sm:inline">← → navigate · Esc exit</span>
        <button onClick={exit} aria-label="Exit presentation mode"
                className="text-gray-400 hover:text-gray-600 text-sm">✕</button>
      </div>
      <p className="text-xs text-gray-600 leading-relaxed mb-2.5">{s.text}</p>
      {s.scenario && (
        <button
          onClick={() => { onScenario?.(s.scenario.crop, s.scenario.state); setTimeout(() => focus(step), 600) }}
          className="mb-2.5 px-3 py-1.5 rounded-xl text-[11px] font-semibold text-primary-700
                     bg-primary-50 border border-primary-200 hover:bg-primary-100 transition-colors">
          ⚡ {s.scenario.label}
        </button>
      )}
      <div className="flex items-center justify-between">
        <button onClick={() => go(step - 1)} disabled={step === 0}
          className="px-3 py-1.5 rounded-xl text-[11px] font-semibold bg-gray-100 text-gray-600
                     hover:bg-gray-200 disabled:opacity-30 transition-colors">
          ← Back
        </button>
        <div className="flex gap-1">
          {STEPS.map((_, i) => (
            <button key={i} onClick={() => go(i)}
              className={`w-1.5 h-1.5 rounded-full ${i === step ? 'bg-primary-500' : 'bg-gray-200'}`} />
          ))}
        </div>
        {step < STEPS.length - 1 ? (
          <button onClick={() => go(step + 1)}
            className="px-3 py-1.5 rounded-xl text-[11px] font-semibold bg-primary-600 text-white
                       hover:bg-primary-700 transition-colors">
            Next →
          </button>
        ) : (
          <button onClick={exit}
            className="px-3 py-1.5 rounded-xl text-[11px] font-semibold bg-gray-900 text-white
                       hover:bg-gray-700 transition-colors">
            Finish ✓
          </button>
        )}
      </div>
    </div>
  )
}
