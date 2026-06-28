/**
 * RecentMarketChanges — Phase 3B Step 4.
 *
 * Fetches deterministic recent change signals from /api/briefing/recent/{crop}/{state}
 * and renders a compact analyst-style change card.
 *
 * Only renders when crop + state are selected.
 * Zero LLM involvement — all signals are deterministic.
 */

import { useState, useEffect, useCallback } from 'react'
import api from '@services/api'

const SEVERITY_BORDER = {
  critical: 'border-red-200    bg-red-50',
  high:     'border-orange-200 bg-orange-50',
  medium:   'border-amber-200  bg-amber-50',
  low:      'border-gray-200   bg-gray-50',
}

const DIRECTION_COLOR = {
  up:      'text-emerald-600',
  down:    'text-red-500',
  neutral: 'text-gray-500',
}

function ChangeCard({ signal }) {
  const [expanded, setExpanded] = useState(false)
  const border = SEVERITY_BORDER[signal.severity] ?? SEVERITY_BORDER.low
  const dirCol = DIRECTION_COLOR[signal.direction] ?? DIRECTION_COLOR.neutral

  return (
    <div className={`rounded-lg border p-2.5 ${border}`}>
      <div className="flex items-start gap-2">
        <span className="text-sm shrink-0 mt-0.5">{signal.icon}</span>
        <div className="flex-1 min-w-0">
          <p className={`text-[11px] font-semibold ${dirCol} leading-snug`}>
            {signal.headline}
          </p>
          {expanded && (
            <p className="text-[10px] text-gray-600 mt-1 leading-relaxed">{signal.detail}</p>
          )}
        </div>
        <button
          onClick={() => setExpanded(e => !e)}
          className="text-gray-400 hover:text-gray-600 text-[10px] shrink-0 mt-0.5 transition-colors"
          title={expanded ? 'Collapse' : 'Expand'}
        >
          {expanded ? '▲' : '▼'}
        </button>
      </div>
    </div>
  )
}

export default function RecentMarketChanges({ crop, state }) {
  const [data,    setData]    = useState(null)
  const [loading, setLoading] = useState(false)
  const [error,   setError]   = useState(null)

  const fetch = useCallback(async () => {
    if (!crop || !state) return
    setLoading(true)
    setError(null)
    try {
      const res = await api.get(`/api/briefing/recent/${encodeURIComponent(crop)}/${encodeURIComponent(state)}`)
      setData(res.data)
    } catch (err) {
      setError('Could not load recent changes.')
    } finally {
      setLoading(false)
    }
  }, [crop, state])

  useEffect(() => { fetch() }, [fetch])

  if (!crop || !state) return null

  return (
    <div className="rounded-2xl border border-gray-100 bg-white shadow-sm hover:shadow-md transition-shadow duration-200 overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3.5 border-b border-gray-100">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-xl bg-gradient-to-br from-orange-500 to-amber-400 text-white flex items-center justify-center text-xs">
            📊
          </div>
          <div>
            <p className="text-sm font-semibold text-gray-900">Recent Changes</p>
            <p className="text-[10px] text-gray-400">{crop} · {state} · Deterministic</p>
          </div>
        </div>
        <button
          onClick={fetch}
          disabled={loading}
          className="text-[9px] font-semibold text-primary-600 hover:text-primary-700 transition-colors disabled:opacity-40 px-2 py-1 rounded-lg hover:bg-primary-50 border border-transparent hover:border-primary-200"
        >
          {loading ? '…' : '↻'}
        </button>
      </div>

      <div className="p-3.5 space-y-2">
        {loading && (
          <div className="animate-pulse space-y-1.5">
            {[80, 90, 70].map((w, i) => (
              <div key={i} className="h-8 rounded-lg bg-gray-100" />
            ))}
          </div>
        )}

        {error && !loading && (
          <p className="text-[10px] text-red-500 p-2">{error}</p>
        )}

        {data && !loading && (
          <>
            {/* Analyst narrative */}
            {data.narrative && (
              <div className="p-2.5 rounded-xl bg-primary-50/60 border border-primary-100">
                <p className="text-[9px] font-bold text-primary-600 uppercase tracking-wide mb-1">Analyst Note</p>
                <p className="text-[10px] text-gray-700 leading-relaxed">{data.narrative}</p>
              </div>
            )}

            {/* Change signals */}
            {data.changes?.length > 0 ? (
              <div className="space-y-1.5">
                {data.changes.map((sig, i) => (
                  <ChangeCard key={i} signal={sig} />
                ))}
              </div>
            ) : (
              <div className="flex items-center gap-2 p-2.5 bg-emerald-50/80 border border-emerald-100 rounded-xl">
                <span className="text-emerald-500 text-sm">✓</span>
                <p className="text-[10px] text-emerald-700 font-medium">No significant market changes detected.</p>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
