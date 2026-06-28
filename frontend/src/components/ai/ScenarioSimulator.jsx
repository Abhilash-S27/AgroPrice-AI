import { useState, useEffect } from 'react'
import Card from '@components/ui/Card'
import { Spinner } from '@components/ui/Loader'
import { aiService } from '@services/aiService'
import { formatPrice } from '@utils/formatters'

/**
 * "What-if Market Simulation" — AI scenario engine.
 * Scenario catalogue comes from /api/ai/scenarios; each run calls
 * /api/ai/simulate which modulates the shock by the crop's REAL
 * volatility, category sensitivity, and current seasonal phase.
 */
export default function ScenarioSimulator({ crop, state, days }) {
  const [scenarios, setScenarios] = useState([])
  const [active, setActive]       = useState(null)   // scenario key being simulated
  const [result, setResult]       = useState(null)
  const [busy, setBusy]           = useState(false)
  const [error, setError]         = useState(null)

  useEffect(() => {
    aiService.getScenarios()
      .then(d => setScenarios(d.scenarios ?? []))
      .catch(() => {})
  }, [])

  // reset result when context changes
  useEffect(() => { setResult(null); setActive(null); setError(null) }, [crop, state, days])

  const run = async (key) => {
    if (busy) return
    setActive(key)
    setBusy(true)
    setError(null)
    try {
      const res = await aiService.simulate({ crop, state, scenario: key, days })
      setResult(res)
    } catch (err) {
      setError(err?.response?.data?.detail ?? err.message)
      setResult(null)
    } finally {
      setBusy(false)
    }
  }

  const up = result && result.expected_move_pct.high >= 0 && result.expected_move_pct.low >= 0

  return (
    <Card className="!p-0 overflow-hidden ai-fade-up">
      <div className="px-5 py-3.5 border-b border-gray-100 flex items-center gap-2.5">
        <div className="w-8 h-8 rounded-xl bg-primary-600 text-white flex items-center justify-center text-base">🧪</div>
        <div>
          <p className="text-sm font-bold text-gray-900 leading-tight">What-if Market Simulation</p>
          <p className="text-[11px] text-gray-400">
            AI impact modelling for {crop} · {state} — calibrated to its real volatility & seasonality
          </p>
        </div>
      </div>

      <div className="p-5">
        {/* scenario chips */}
        <div className="flex flex-wrap gap-2 mb-4">
          {scenarios.map(s => (
            <button key={s.key}
              onClick={() => run(s.key)}
              disabled={busy}
              title={s.description}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold border transition-colors disabled:opacity-50 ${
                active === s.key
                  ? 'bg-primary-600 text-white border-primary-600'
                  : 'bg-white text-gray-600 border-gray-200 hover:border-primary-300 hover:text-primary-700'
              }`}>
              {s.icon} {s.label}
            </button>
          ))}
        </div>

        {busy && (
          <div className="flex items-center gap-2.5 text-xs text-gray-400 py-4">
            <Spinner size="sm" className="w-4 h-4" />
            Simulating market impact from live crop characteristics…
          </div>
        )}
        {error && <p className="text-xs text-red-500 py-2">{error}</p>}

        {result && !busy && (
          <div className="ai-fade-up">
            {/* impact stats */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-4">
              <div className={`rounded-xl border p-3.5 ${up ? 'bg-amber-50 border-amber-200' : 'bg-emerald-50 border-emerald-200'}`}>
                <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wide mb-1">Expected Move</p>
                <p className={`text-lg font-extrabold ${up ? 'text-amber-700' : 'text-emerald-700'}`}>
                  {result.expected_move_pct.low > 0 ? '+' : ''}{result.expected_move_pct.low}%
                  {' '}to {result.expected_move_pct.high > 0 ? '+' : ''}{result.expected_move_pct.high}%
                </p>
                <p className="text-[10px] text-gray-400 mt-0.5">over the {days}-day horizon</p>
              </div>
              <div className="rounded-xl border border-gray-200 bg-white p-3.5">
                <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wide mb-1">Price Range</p>
                <p className="text-lg font-extrabold text-gray-900">
                  {formatPrice(result.expected_price_range.low)}–{formatPrice(result.expected_price_range.high)}
                </p>
                <p className="text-[10px] text-gray-400 mt-0.5">
                  from {formatPrice(result.expected_price_range.base)}/qtl base
                </p>
              </div>
              <div className="rounded-xl border border-gray-200 bg-white p-3.5">
                <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wide mb-1">Volatility Effect</p>
                <p className="text-lg font-extrabold text-gray-900">+{result.volatility_shift_pct}%</p>
                <p className="text-[10px] text-gray-400 mt-0.5">short-term swing intensity</p>
              </div>
            </div>

            {/* AI narrative + risk */}
            <div className="space-y-2.5">
              <div className="flex items-start gap-2.5 px-3.5 py-3 bg-gray-50 border border-gray-100 rounded-xl">
                <span className="text-primary-400 mt-0.5 shrink-0">✦</span>
                <p className="text-xs text-gray-700 leading-relaxed">{result.narrative}</p>
              </div>
              <div className="flex items-start gap-2.5 px-3.5 py-3 bg-amber-50/60 border border-amber-100 rounded-xl">
                <span className="text-amber-500 mt-0.5 shrink-0">⚠</span>
                <p className="text-xs text-amber-900 leading-relaxed">{result.risk_note}</p>
              </div>
              <p className="text-[10px] text-gray-300 px-1">
                drivers — volatility ×{result.drivers.volatility_factor} · category ×{result.drivers.category_factor} · seasonal ×{result.drivers.seasonal_factor}
              </p>
            </div>
          </div>
        )}

        {!result && !busy && !error && (
          <p className="text-xs text-gray-400 py-2">
            Pick a scenario to model its impact on {crop} prices using live volatility,
            seasonal phase, and category sensitivity.
          </p>
        )}
      </div>
    </Card>
  )
}
