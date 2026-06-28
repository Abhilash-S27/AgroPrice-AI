import { memo } from 'react'
import Card from '@components/ui/Card'

/**
 * AI visual storytelling gauges — per crop+state pair.
 * Volatility Thermometer · Momentum Gauge · Forecast Trust Index ·
 * Anomaly Intensity. All values come straight from the pair's
 * context_summary / confidence — no recomputation.
 */

function SemiGauge({ pct, tone, label, display, sub }) {
  // semicircle arc, r=42 → half-circumference ≈ 132
  const C = Math.PI * 42
  const clamped = Math.max(0, Math.min(100, pct))
  const offset = C * (1 - clamped / 100)
  return (
    <div className="flex flex-col items-center">
      <svg viewBox="0 0 100 58" className="w-28">
        <path d="M 8 52 A 42 42 0 0 1 92 52" fill="none"
              stroke="rgba(255,255,255,0.10)" strokeWidth="8" strokeLinecap="round" />
        <path d="M 8 52 A 42 42 0 0 1 92 52" fill="none"
              stroke={tone} strokeWidth="8" strokeLinecap="round"
              strokeDasharray={C} strokeDashoffset={offset}
              className="ai-gauge-arc" />
        <text x="50" y="46" textAnchor="middle"
              style={{ font: '800 15px Inter, sans-serif', fill: 'rgba(255,255,255,0.94)' }}>
          {display}
        </text>
      </svg>
      <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wide -mt-1">{label}</p>
      <p className="text-[9px] text-gray-400">{sub}</p>
    </div>
  )
}

function AIGauges({ pairSummary, confidence }) {
  if (!pairSummary || pairSummary.cv == null) return null

  const cv = pairSummary.cv
  const mom = pairSummary.momentum ?? 0
  const trust = confidence?.score ?? pairSummary.reliability_score ?? 0
  const anoms = pairSummary.anomaly_count ?? 0

  const volTone = cv >= 55 ? '#f87171' : cv >= 30 ? '#fbbf24' : '#34d399'
  const momTone = mom > 3 ? '#fbbf24' : mom < -3 ? '#34d399' : '#9ca3af'
  const trustTone = trust >= 70 ? '#34d399' : trust >= 50 ? '#fbbf24' : '#f87171'
  const anomPct = Math.min(100, anoms * 30)
  const anomTone = anoms >= 3 ? '#f87171' : anoms >= 1 ? '#fbbf24' : '#34d399'

  return (
    <Card className="!p-4 ai-fade-up">
      <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-3">
        AI Visual Reasoning · this crop + state
      </p>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <SemiGauge pct={Math.min(100, cv)} tone={volTone}
                   label="Volatility" display={`${cv.toFixed(0)}%`} sub="coefficient of variation" />
        <SemiGauge pct={Math.min(100, Math.max(0, 50 + mom * 1.5))} tone={momTone}
                   label="Momentum" display={`${mom > 0 ? '+' : ''}${Number(mom).toFixed(1)}%`} sub="7-day vs prior month" />
        <SemiGauge pct={trust} tone={trustTone}
                   label="Trust Index" display={`${trust}`} sub="weighted confidence /100" />
        <SemiGauge pct={anomPct} tone={anomTone}
                   label="Anomaly Intensity" display={`${anoms}`} sub="significant events / 90d" />
      </div>
    </Card>
  )
}

export default memo(AIGauges)
