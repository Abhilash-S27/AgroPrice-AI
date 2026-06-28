import { useState, useEffect } from 'react'
import Card from '@components/ui/Card'
import api from '@services/api'

/**
 * Market History Storyteller — AI-annotated timeline of notable events
 * for the selected crop+state: volatility regimes (incl. the COVID period),
 * all-time extremes, and the largest statistical shocks across the FULL
 * history. Data: /api/ai/timeline (cached server-side).
 */

const TYPE_STYLES = {
  volatility: 'border-amber-200 bg-amber-50',
  peak:       'border-emerald-200 bg-emerald-50',
  trough:     'border-blue-200 bg-blue-50',
  spike:      'border-red-200 bg-red-50',
  crash:      'border-violet-200 bg-violet-50',
}

export default function MarketTimeline({ crop, state }) {
  const [data, setData] = useState(null)
  const [open, setOpen] = useState(false)

  useEffect(() => {
    setData(null)
    if (!open) return
    api.get('/api/ai/timeline', { params: { crop, state } })
      .then(res => setData(res.data))
      .catch(() => {})
  }, [crop, state, open])

  return (
    <Card className="!p-0 overflow-hidden ai-fade-up">
      <button onClick={() => setOpen(o => !o)}
        className="w-full px-5 py-3.5 flex items-center gap-2.5 hover:bg-gray-50 transition-colors">
        <div className="w-8 h-8 rounded-xl bg-primary-600 text-white flex items-center justify-center text-base">🕰️</div>
        <div className="text-left">
          <p className="text-sm font-bold text-gray-900 leading-tight">Market History Storyteller</p>
          <p className="text-[11px] text-gray-400">
            AI-annotated timeline · {crop} · {state} · 2015–2026
          </p>
        </div>
        <span className="ml-auto text-gray-400 text-xs">{open ? '▾' : '▸'}</span>
      </button>

      {open && (
        <div className="px-5 pb-5 ai-fade-up">
          {!data && <p className="text-xs text-gray-400 py-2">Reading a decade of price history…</p>}
          {data?.events?.length === 0 && (
            <p className="text-xs text-gray-400 py-2">{data.note ?? 'No notable events found.'}</p>
          )}
          {data?.events?.length > 0 && (
            <div className="relative pl-5 space-y-3 before:absolute before:left-1.5 before:top-1
                            before:bottom-1 before:w-px before:bg-gray-200">
              {data.events.map((e, i) => (
                <div key={i} className="relative">
                  <span className="absolute -left-5 top-1 w-3 h-3 rounded-full border-2 border-primary-400" style={{ background: 'rgba(12,16,28,0.90)' }} />
                  <div className={`rounded-xl border p-3 ${TYPE_STYLES[e.type] ?? 'border-gray-100 bg-gray-50'}`}>
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className="text-sm">{e.icon}</span>
                      <p className="text-xs font-bold text-gray-800">{e.title}</p>
                      <span className="ml-auto text-[10px] font-semibold text-gray-400">{e.date}</span>
                    </div>
                    <p className="text-[11px] text-gray-600 leading-relaxed">{e.text}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </Card>
  )
}
