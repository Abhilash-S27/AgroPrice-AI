/**
 * AIWatchlist — Phase 4A Step 9
 * Dynamic AI Market Watchlist with momentum/risk/safe/seasonal buckets.
 * All data from deterministic agent pipeline — no Gemini calls.
 */
import { useState, useEffect, memo } from 'react'
import { getWatchlist } from '../../services/watchlistService'
import { getSignalConfig } from './AISignalBadge'

const BUCKET_CFG = {
  momentum_leaders: {
    label:   'Momentum Leaders',
    icon:    '🚀',
    color:   'emerald',
    desc:    'Bullish price trend detected',
    empty:   'No strong upward trends detected',
  },
  risk_watch: {
    label:   'Risk Watch',
    icon:    '⚠️',
    color:   'red',
    desc:    'High or extreme volatility',
    empty:   'No high-risk crops flagged',
  },
  safest_picks: {
    label:   'Safest Picks',
    icon:    '🛡️',
    color:   'blue',
    desc:    'Low volatility, stable market',
    empty:   'No stable low-risk crops found',
  },
  seasonal_peaks: {
    label:   'Seasonal Peaks',
    icon:    '📅',
    color:   'amber',
    desc:    'Currently in peak demand season',
    empty:   'No crops at seasonal peak',
  },
}

const COLOR_MAP = {
  emerald: { bg: 'bg-emerald-50', border: 'border-emerald-100', dot: 'bg-emerald-400', text: 'text-emerald-700', header: 'text-emerald-800' },
  red:     { bg: 'bg-red-50',     border: 'border-red-100',     dot: 'bg-red-400',     text: 'text-red-700',     header: 'text-red-800'     },
  blue:    { bg: 'bg-blue-50',    border: 'border-blue-100',    dot: 'bg-blue-400',    text: 'text-blue-700',    header: 'text-blue-800'    },
  amber:   { bg: 'bg-amber-50',   border: 'border-amber-100',   dot: 'bg-amber-400',   text: 'text-amber-700',   header: 'text-amber-800'   },
}

const CropChip = memo(function CropChip({ entry, color }) {
  const c   = COLOR_MAP[color] || COLOR_MAP.blue
  const sig = getSignalConfig(entry.verdict)
  return (
    <div className={`flex items-start gap-2 p-2 rounded-lg border ${c.bg} ${c.border}`}>
      <span className={`w-1.5 h-1.5 rounded-full shrink-0 mt-1.5 ${c.dot}`} />
      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-1 flex-wrap">
          <span className="text-[11px] font-bold text-gray-800 leading-tight">{entry.crop}</span>
          <span className={`text-[9px] font-semibold px-1 py-0.5 rounded border ${sig.bg} ${sig.border} ${sig.text}`}>
            {(entry.verdict || 'UNKNOWN').replace(/_/g, ' ')}
          </span>
        </div>
        <p className="text-[10px] text-gray-500 mt-0.5 leading-snug truncate">{entry.headline || entry.state}</p>
        {entry.opportunity_score > 0 && (
          <div className="mt-1 h-0.5 rounded-full bg-gray-100 overflow-hidden">
            <div
              className={`h-full rounded-full ${c.dot}`}
              style={{ width: `${Math.round(entry.opportunity_score * 100)}%` }}
            />
          </div>
        )}
      </div>
    </div>
  )
})

const WatchlistBucket = memo(function WatchlistBucket({ bucketKey, entries, isLoading }) {
  const cfg   = BUCKET_CFG[bucketKey]
  const color = cfg?.color || 'blue'
  const c     = COLOR_MAP[color]

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center gap-1.5 pb-1 border-b border-gray-100">
        <span className="text-sm leading-none">{cfg?.icon}</span>
        <div className="flex-1 min-w-0">
          <p className={`text-[11px] font-bold ${c.header}`}>{cfg?.label}</p>
          <p className="text-[9px] text-gray-400">{cfg?.desc}</p>
        </div>
        <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full ${c.bg} ${c.text}`}>
          {isLoading ? '—' : entries.length}
        </span>
      </div>

      {isLoading ? (
        <div className="space-y-1.5 animate-pulse">
          {[1, 2].map(i => (
            <div key={i} className="h-10 rounded-lg bg-gray-50 border border-gray-100" />
          ))}
        </div>
      ) : entries.length === 0 ? (
        <p className="text-[10px] text-gray-400 italic py-1">{cfg?.empty}</p>
      ) : (
        <div className="space-y-1.5">
          {entries.map((e, i) => (
            <CropChip key={i} entry={e} color={color} />
          ))}
        </div>
      )}
    </div>
  )
})

export default memo(function AIWatchlist() {
  const [data,      setData]      = useState(null)
  const [loading,   setLoading]   = useState(true)
  const [error,     setError]     = useState(null)
  const [lastFetch, setLastFetch] = useState(null)

  const load = async () => {
    setLoading(true)
    setError(null)
    try {
      const result = await getWatchlist(8)
      setData(result)
      setLastFetch(new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }))
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  const topOpp = data?.top_opportunity
  const cropsAnalysed = data?.crops_analysed || 0

  return (
    <div className="flex flex-col gap-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-base leading-none">📊</span>
          <div>
            <p className="text-[11px] font-bold text-gray-800">AI Market Watchlist</p>
            <p className="text-[9px] text-gray-400">
              {loading ? 'Scanning markets…' : `${cropsAnalysed} crops · ${lastFetch || ''}`}
            </p>
          </div>
        </div>
        <button
          onClick={load}
          disabled={loading}
          className="text-[10px] text-gray-400 hover:text-primary-600 transition-colors disabled:opacity-40 px-2 py-0.5 rounded border border-gray-100 hover:border-primary-200"
        >
          {loading ? '⟳' : 'Refresh'}
        </button>
      </div>

      {/* Top opportunity banner */}
      {!loading && topOpp && (
        <div className="flex items-center gap-2 p-2 rounded-lg"
             style={{ background: 'rgba(16,185,129,0.12)', border: '1px solid rgba(16,185,129,0.30)' }}>
          <span className="text-sm leading-none shrink-0">🏆</span>
          <div className="min-w-0 flex-1">
            <p className="text-[10px] font-bold text-emerald-400">
              Top Opportunity — {topOpp.crop} ({topOpp.state})
            </p>
            <p className="text-[10px] text-emerald-500 truncate">
              {(topOpp.headline ?? '').replace(/\*\*([^*]+)\*\*/g, '$1').replace(/\*([^*]+)\*/g, '$1')}
            </p>
          </div>
          <div className="shrink-0 text-right">
            <p className="text-[11px] font-black text-emerald-600">
              {Math.round((topOpp.opportunity_score || 0) * 100)}
            </p>
            <p className="text-[8px] text-emerald-500">/ 100</p>
          </div>
        </div>
      )}

      {error && (
        <p className="text-[10px] text-red-500 italic">
          Failed to load watchlist — {error}
        </p>
      )}

      {/* 2×2 bucket grid */}
      <div className="grid grid-cols-2 gap-3">
        {Object.keys(BUCKET_CFG).map(key => (
          <WatchlistBucket
            key={key}
            bucketKey={key}
            entries={(data?.[key]) || []}
            isLoading={loading}
          />
        ))}
      </div>
    </div>
  )
})
