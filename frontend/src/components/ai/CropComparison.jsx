import { useState, useEffect } from 'react'
import Card from '@components/ui/Card'
import { Spinner } from '@components/ui/Loader'
import { aiService } from '@services/aiService'
import { cropShortName } from '@utils/constants'

/**
 * Multi-crop AI comparison — pick 2–6 crops, AI ranks stability, momentum
 * and forecast confidence from the cross-crop analytics cache and writes
 * a comparison summary.
 */
export default function CropComparison({ allCrops, currentCrop }) {
  const [selected, setSelected] = useState([])
  const [result, setResult]     = useState(null)
  const [busy, setBusy]         = useState(false)
  const [error, setError]       = useState(null)

  // seed with the currently viewed crop
  useEffect(() => {
    setSelected(sel => (sel.includes(currentCrop) ? sel : [currentCrop, ...sel].slice(0, 6)))
    setResult(null)
  }, [currentCrop])

  const toggle = (crop) => {
    setResult(null)
    setSelected(sel =>
      sel.includes(crop) ? sel.filter(c => c !== crop)
      : sel.length >= 6  ? sel
      : [...sel, crop]
    )
  }

  const compare = async () => {
    if (selected.length < 2 || busy) return
    setBusy(true)
    setError(null)
    try {
      setResult(await aiService.compare(selected))
    } catch (err) {
      setError(err?.response?.data?.detail ?? err.message)
    } finally {
      setBusy(false)
    }
  }

  const medal = (i) => i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `${i + 1}.`

  return (
    <Card className="!p-0 overflow-hidden ai-fade-up">
      <div className="px-5 py-3.5 border-b border-gray-100 flex items-center gap-2.5">
        <div className="w-8 h-8 rounded-xl bg-primary-600 text-white flex items-center justify-center text-base">⚖️</div>
        <div>
          <p className="text-sm font-bold text-gray-900 leading-tight">Multi-Crop AI Comparison</p>
          <p className="text-[11px] text-gray-400">select 2–6 crops · risk, momentum & confidence ranking</p>
        </div>
      </div>

      <div className="p-5">
        {/* crop selection chips */}
        <div className="flex flex-wrap gap-1.5 mb-4 max-h-28 overflow-y-auto">
          {allCrops.map(c => {
            const on = selected.includes(c.crop)
            return (
              <button key={c.crop} onClick={() => toggle(c.crop)}
                className={`px-2.5 py-1 rounded-full text-[11px] font-medium border transition-colors ${
                  on
                    ? 'bg-primary-600 text-white border-primary-600'
                    : 'bg-white text-gray-500 border-gray-200 hover:border-primary-300'
                }`}>
                {cropShortName(c.crop)}
              </button>
            )
          })}
        </div>

        <button onClick={compare} disabled={selected.length < 2 || busy}
          className="px-4 py-2 rounded-xl bg-primary-600 text-white text-xs font-semibold
                     hover:bg-primary-700 disabled:opacity-40 transition-colors mb-4">
          {busy ? 'Comparing…' : `Compare ${selected.length} crops with AI`}
        </button>

        {busy && (
          <div className="flex items-center gap-2.5 text-xs text-gray-400 py-2">
            <Spinner size="sm" className="w-4 h-4" /> Ranking stability, momentum and confidence…
          </div>
        )}
        {error && <p className="text-xs text-red-500">{error}</p>}

        {result && !busy && (
          <div className="ai-fade-up space-y-4">
            {/* AI summary */}
            <div className="flex items-start gap-2.5 px-3.5 py-3 bg-primary-50/60 border border-primary-100 rounded-xl">
              <span className="text-primary-500 mt-0.5 shrink-0">✦</span>
              <p className="text-xs text-primary-900 leading-relaxed">{result.summary}</p>
            </div>

            {/* rankings */}
            {result.rankings?.stability && (
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="rounded-xl border border-gray-100 p-3.5">
                  <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2">
                    Stability (low CV first)
                  </p>
                  {result.rankings.stability.map((r, i) => (
                    <div key={r.crop} className="flex justify-between text-xs py-0.5">
                      <span className="text-gray-700">{medal(i)} {cropShortName(r.crop)}</span>
                      <span className="font-semibold text-gray-500">{r.cv?.toFixed?.(0) ?? r.cv}%</span>
                    </div>
                  ))}
                </div>
                <div className="rounded-xl border border-gray-100 p-3.5">
                  <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2">
                    Momentum (7-day)
                  </p>
                  {result.rankings.momentum.map((r, i) => (
                    <div key={r.crop} className="flex justify-between text-xs py-0.5">
                      <span className="text-gray-700">{medal(i)} {cropShortName(r.crop)}</span>
                      <span className={`font-semibold ${r.score > 0 ? 'text-amber-600' : 'text-emerald-600'}`}>
                        {r.score > 0 ? '+' : ''}{r.score?.toFixed?.(1) ?? r.score}%
                      </span>
                    </div>
                  ))}
                </div>
                <div className="rounded-xl border border-gray-100 p-3.5">
                  <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2">
                    Forecast Confidence
                  </p>
                  {result.rankings.confidence.map((r, i) => (
                    <div key={r.crop} className="flex justify-between text-xs py-0.5">
                      <span className="text-gray-700">{medal(i)} {cropShortName(r.crop)}</span>
                      <span className="font-semibold text-gray-500">{r.score}/100 · {r.tier}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </Card>
  )
}
