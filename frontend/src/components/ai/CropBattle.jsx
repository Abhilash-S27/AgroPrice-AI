import { useState, useEffect } from 'react'
import {
  RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis,
  ResponsiveContainer, Legend,
} from 'recharts'
import Card from '@components/ui/Card'
import { Spinner } from '@components/ui/Loader'
import api from '@services/api'
import { cropShortName, PHASE4_ALL_CROPS } from '@utils/constants'

/**
 * AI Crop Battle — head-to-head comparison across 6 scored dimensions
 * (stability, momentum, confidence, anomaly calm, continuity, storability)
 * with a radar chart, battle score, and an AI verdict. Scores come from
 * /api/ai/battle (cross-crop analytics, normalized 0–100).
 */
export default function CropBattle({ currentCrop }) {
  const [open,   setOpen]   = useState(true)
  const [a, setA] = useState(currentCrop || 'Tomato')
  const [b, setB] = useState('Maize')
  const [result, setResult] = useState(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)

  useEffect(() => { if (currentCrop) setA(currentCrop) }, [currentCrop])
  useEffect(() => { setResult(null) }, [a, b])

  const fight = async () => {
    if (a === b || busy) return
    setBusy(true)
    setError(null)
    try {
      const res = await api.get('/api/ai/battle', { params: { a, b } })
      setResult(res.data)
    } catch (err) {
      setError(err?.response?.data?.detail ?? err.message)
    } finally {
      setBusy(false)
    }
  }

  const radarData = result?.dimensions?.map(d => ({
    dim: d.label, [cropShortName(result.a.crop)]: d.a, [cropShortName(result.b.crop)]: d.b,
  })) ?? []

  const Sel = ({ value, onChange }) => (
    <select value={value} onChange={e => onChange(e.target.value)}
      className="rounded-lg px-2.5 py-1.5 text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-emerald-500/50 transition-colors"
      style={{ background: 'rgba(15,20,40,0.90)', border: '1px solid rgba(255,255,255,0.14)', color: 'rgba(255,255,255,0.88)' }}>
      {PHASE4_ALL_CROPS.map(c => <option key={c} value={c}>{cropShortName(c)}</option>)}
    </select>
  )

  return (
    <Card className="!p-0 overflow-hidden ai-fade-up">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full px-5 py-3.5 flex items-center gap-2.5 text-left transition-colors hover:bg-white/5"
        style={{ borderBottom: open ? '1px solid rgba(255,255,255,0.08)' : 'none' }}
      >
        <div className="w-8 h-8 rounded-xl bg-primary-600 text-white flex items-center justify-center text-base shrink-0">⚔️</div>
        <div className="flex-1">
          <p className="text-sm font-bold text-gray-900 leading-tight">AI Crop Battle</p>
          <p className="text-[11px] text-gray-400">head-to-head across 6 scored dimensions</p>
        </div>
        <span className="text-gray-400 text-xs transition-transform duration-300" style={{ transform: open ? 'rotate(180deg)' : 'rotate(0deg)' }}>▼</span>
      </button>

      <div style={{ display: 'grid', gridTemplateRows: open ? '1fr' : '0fr', transition: 'grid-template-rows 0.3s ease' }}>
        <div style={{ overflow: 'hidden' }}>
      <div className="p-5">
        <div className="flex items-center gap-2 flex-wrap mb-4">
          <Sel value={a} onChange={setA} />
          <span className="text-xs font-black text-gray-400">VS</span>
          <Sel value={b} onChange={setB} />
          <button onClick={fight} disabled={a === b || busy}
            className="px-3.5 py-1.5 rounded-xl text-white text-xs font-bold disabled:opacity-40 transition-all"
            style={{ background: 'rgba(16,185,129,0.88)', border: '1px solid rgba(52,211,153,0.40)' }}>
            {busy ? 'Scoring…' : '⚔️ Run Battle'}
          </button>
        </div>

        {busy && (
          <div className="flex items-center gap-2.5 text-xs text-gray-400 py-3">
            <Spinner size="sm" className="w-4 h-4" /> Normalizing six metric dimensions…
          </div>
        )}
        {error && <p className="text-xs text-red-500">{error}</p>}

        {result && !busy && (
          <div className="ai-fade-up">
            {/* score banner */}
            <div className="flex items-center justify-center gap-5 mb-2">
              {[result.a, result.b].map((p, i) => {
                const winner = p.score === Math.max(result.a.score, result.b.score)
                return (
                  <div key={i} className={`text-center px-4 py-2 rounded-xl border ${
                    winner ? 'border-emerald-200 bg-emerald-50' : 'border-gray-100 bg-gray-50'
                  }`}>
                    <p className="text-xs font-bold text-gray-800">{cropShortName(p.crop)}</p>
                    <p className={`text-2xl font-extrabold ${winner ? 'text-emerald-600' : 'text-gray-400'}`}>
                      {p.score}
                    </p>
                    <p className="text-[9px] text-gray-400">{winner ? '🏆 winner' : 'battle score'}</p>
                  </div>
                )
              })}
            </div>

            <ResponsiveContainer width="100%" height={260}>
              <RadarChart data={radarData} outerRadius="72%">
                <PolarGrid stroke="rgba(255,255,255,0.10)" />
                <PolarAngleAxis dataKey="dim" tick={{ fontSize: 10, fill: 'rgba(255,255,255,0.55)' }} />
                <PolarRadiusAxis domain={[0, 100]} tick={false} axisLine={false} />
                <Radar name={cropShortName(result.a.crop)} dataKey={cropShortName(result.a.crop)}
                       stroke="#10b981" fill="#10b981" fillOpacity={0.25} />
                <Radar name={cropShortName(result.b.crop)} dataKey={cropShortName(result.b.crop)}
                       stroke="#6366f1" fill="#6366f1" fillOpacity={0.25} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
              </RadarChart>
            </ResponsiveContainer>

            {/* AI verdict */}
            <div className="flex items-start gap-2.5 px-3.5 py-3 rounded-xl mt-2"
                 style={{ background: 'rgba(52,211,153,0.10)', border: '1px solid rgba(52,211,153,0.22)' }}>
              <span className="text-emerald-400 mt-0.5 shrink-0">✦</span>
              <p className="text-xs text-emerald-300 leading-relaxed">{result.verdict}</p>
            </div>

            <div className="grid grid-cols-2 gap-3 mt-3">
              {[result.a, result.b].map((p, i) => (
                <div key={i} className="rounded-xl border border-gray-100 p-3">
                  <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wide mb-1">
                    {cropShortName(p.crop)} profile
                  </p>
                  <p className="text-[10px] text-gray-500 leading-relaxed">
                    {p.cv?.toFixed?.(0)}% CV · momentum {p.momentum > 0 ? '+' : ''}{p.momentum?.toFixed?.(1)}%/7d ·
                    Tier {p.tier} · {p.phase} phase
                  </p>
                  <p className="text-[10px] text-primary-700 font-medium mt-1">
                    ideal: {p.use_case}
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}

        {!result && !busy && !error && (
          <p className="text-xs text-gray-400">
            Pick two crops and run the battle — scores combine stability, momentum,
            confidence, anomaly calm, continuity and storability.
          </p>
        )}
      </div>
        </div>
      </div>
    </Card>
  )
}
