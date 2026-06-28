/**
 * AIRiskCard — visual risk assessment card.
 * Shows volatility level, anomaly count, risk meter bar.
 * Phase 2B.
 */
export default function AIRiskCard({ risk, className = '' }) {
  if (!risk) return null

  const score   = risk.score ?? 0.5
  const verdict = risk.verdict || 'UNKNOWN'
  const details = risk.details || {}

  const { color, bg, border, label } = (
    score < 0.25 ? { color: 'text-emerald-700', bg: 'bg-emerald-50', border: 'border-emerald-200', label: 'Low Risk' } :
    score < 0.50 ? { color: 'text-amber-700',   bg: 'bg-amber-50',   border: 'border-amber-200',   label: 'Moderate Risk' } :
    score < 0.75 ? { color: 'text-orange-700',  bg: 'bg-orange-50',  border: 'border-orange-200',  label: 'High Risk' } :
                   { color: 'text-red-700',      bg: 'bg-red-50',     border: 'border-red-200',     label: 'Extreme Risk' }
  )

  const barColor = (
    score < 0.25 ? 'bg-emerald-500' :
    score < 0.50 ? 'bg-amber-500'   :
    score < 0.75 ? 'bg-orange-500'  : 'bg-red-500'
  )

  return (
    <div className={`p-4 rounded-xl border ${bg} ${border} ${className}`}>
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <span className="text-lg">⚡</span>
          <p className="text-sm font-bold text-gray-800">Risk Assessment</p>
        </div>
        <span className={`text-[10px] font-bold px-2 py-1 rounded-full border ${bg} ${border} ${color}`}>
          {label}
        </span>
      </div>

      {/* Risk meter bar */}
      <div className="mb-3">
        <div className="flex justify-between text-[10px] text-gray-400 mb-1">
          <span>Low</span><span>Extreme</span>
        </div>
        <div className="h-2 rounded-full bg-white/60 border border-white/40 overflow-hidden">
          <div
            className={`h-full rounded-full transition-all ${barColor}`}
            style={{ width: `${Math.round(score * 100)}%` }}
          />
        </div>
        <p className={`text-right text-[10px] mt-0.5 font-semibold ${color}`}>
          {Math.round(score * 100)}/100
        </p>
      </div>

      <p className="text-xs text-gray-700 leading-relaxed mb-2">{risk.headline}</p>

      {/* Key metrics */}
      <div className="grid grid-cols-3 gap-2 mt-2 pt-2 border-t border-white/50">
        <div className="text-center">
          <p className="text-[9px] text-gray-500 uppercase tracking-wide">Volatility</p>
          <p className="text-xs font-bold text-gray-800">{details.volatility_cv?.toFixed(0)}% CV</p>
        </div>
        <div className="text-center">
          <p className="text-[9px] text-gray-500 uppercase tracking-wide">Anomalies</p>
          <p className="text-xs font-bold text-gray-800">{details.anomaly_count ?? 0}</p>
        </div>
        <div className="text-center">
          <p className="text-[9px] text-gray-500 uppercase tracking-wide">Data Quality</p>
          <p className="text-xs font-bold text-gray-800">{details.quality_score?.toFixed(0) ?? '—'}</p>
        </div>
      </div>
    </div>
  )
}
