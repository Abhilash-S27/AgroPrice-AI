import { useState } from 'react'
import Card from '@components/ui/Card'
import { Spinner } from '@components/ui/Loader'
import api from '@services/api'
import { SOUTH_INDIAN_STATES, cropShortName } from '@utils/constants'

/**
 * AI Strategy Planner — decision-intelligence simulator.
 * The user states their constraints (risk appetite, horizon, storage,
 * state focus); /api/ai/strategy filters and ranks real crop metrics
 * into grounded recommendations with selling windows and storage notes.
 */

const OPTIONS = {
  risk_appetite: [
    { v: 'low',    label: '🛡️ Low risk' },
    { v: 'medium', label: '⚖️ Balanced' },
    { v: 'high',   label: '🔥 Aggressive' },
  ],
  horizon: [
    { v: 'short',  label: '⏱️ Short term' },
    { v: 'medium', label: '📆 Medium' },
    { v: 'long',   label: '🗓️ Long term' },
  ],
  storage: [
    { v: 'none',    label: '🚫 No storage' },
    { v: 'limited', label: '📦 Limited' },
    { v: 'good',    label: '🏪 Good capacity' },
  ],
}

const selectCls = `w-full rounded-lg px-3 py-2 text-xs font-semibold
  focus:outline-none focus:ring-1 focus:ring-emerald-500/50 transition-colors`

const selectStyle = {
  background: 'rgba(15,20,40,0.90)',
  border: '1px solid rgba(255,255,255,0.14)',
  color: 'rgba(255,255,255,0.88)',
  appearance: 'auto',
}

function DropdownRow({ label, options, value, onChange }) {
  return (
    <div>
      <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wide mb-1.5">{label}</p>
      <select
        value={value}
        onChange={e => onChange(e.target.value)}
        className={selectCls}
        style={selectStyle}
      >
        {options.map(o => (
          <option key={o.v} value={o.v}>{o.label}</option>
        ))}
      </select>
    </div>
  )
}

export default function StrategyPlanner() {
  const [open,   setOpen]   = useState(true)
  const [prefs, setPrefs] = useState({ risk_appetite: 'medium', horizon: 'medium', storage: 'limited', state: '' })
  const [result, setResult] = useState(null)
  const [busy, setBusy] = useState(false)

  const set = (k) => (v) => { setPrefs(p => ({ ...p, [k]: v })); setResult(null) }

  const plan = async () => {
    if (busy) return
    setBusy(true)
    try {
      const res = await api.post('/api/ai/strategy', {
        ...prefs, state: prefs.state || null,
      })
      setResult(res.data)
    } catch { /* surfaced via empty result */ } finally {
      setBusy(false)
    }
  }

  return (
    <Card className="!p-0 overflow-hidden ai-fade-up">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full px-5 py-3.5 flex items-center gap-2.5 text-left transition-colors hover:bg-white/5"
        style={{ borderBottom: open ? '1px solid rgba(255,255,255,0.08)' : 'none' }}
      >
        <div className="w-8 h-8 rounded-xl bg-primary-600 text-white flex items-center justify-center text-base shrink-0">🧭</div>
        <div className="flex-1">
          <p className="text-sm font-bold text-gray-900 leading-tight">AI Strategy Planner</p>
          <p className="text-[11px] text-gray-400">your constraints → risk-adjusted crop strategy</p>
        </div>
        <span className="text-gray-400 text-xs transition-transform duration-300" style={{ transform: open ? 'rotate(180deg)' : 'rotate(0deg)' }}>▼</span>
      </button>

      <div style={{ display: 'grid', gridTemplateRows: open ? '1fr' : '0fr', transition: 'grid-template-rows 0.3s ease' }}>
        <div style={{ overflow: 'hidden' }}>
      <div className="p-5 space-y-3.5">
        <DropdownRow label="Risk Appetite" options={OPTIONS.risk_appetite}
                     value={prefs.risk_appetite} onChange={set('risk_appetite')} />
        <DropdownRow label="Investment Horizon" options={OPTIONS.horizon}
                     value={prefs.horizon} onChange={set('horizon')} />
        <DropdownRow label="Storage Capacity" options={OPTIONS.storage}
                     value={prefs.storage} onChange={set('storage')} />

        <div>
          <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wide mb-1.5">State Focus (optional)</p>
          <select
            value={prefs.state}
            onChange={e => set('state')(e.target.value)}
            className={selectCls}
            style={selectStyle}
          >
            <option value="">All South India</option>
            {SOUTH_INDIAN_STATES.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>

        <button onClick={plan} disabled={busy}
          className="w-full px-4 py-2.5 rounded-xl text-white text-xs font-bold
                     disabled:opacity-40 transition-all duration-200"
          style={{ background: busy ? 'rgba(16,185,129,0.50)' : 'rgba(16,185,129,0.90)', border: '1px solid rgba(52,211,153,0.40)' }}>
          {busy ? 'Planning…' : 'Generate AI Strategy'}
        </button>

        {busy && (
          <div className="flex items-center gap-2.5 text-xs text-gray-400">
            <Spinner size="sm" className="w-4 h-4" /> Ranking crops against your constraints…
          </div>
        )}

        {result?.ready && !busy && (
          <div className="ai-fade-up space-y-3">
            <div className="flex items-start gap-2.5 px-3.5 py-3 rounded-xl"
                 style={{ background: 'rgba(52,211,153,0.10)', border: '1px solid rgba(52,211,153,0.22)' }}>
              <span className="text-emerald-400 mt-0.5 shrink-0">✦</span>
              <p className="text-xs text-emerald-300 leading-relaxed">{result.narrative}</p>
            </div>
            {result.recommendations.map((r, i) => (
              <div key={r.crop} className="rounded-xl border border-gray-100 p-3.5">
                <div className="flex items-center justify-between mb-1.5">
                  <p className="text-xs font-bold text-gray-800">
                    {i === 0 ? '🥇' : i === 1 ? '🥈' : '🥉'} {cropShortName(r.crop)} · {r.state}
                  </p>
                  <span className="text-[10px] font-semibold text-gray-400">
                    Tier {r.tier} · {r.reliability}/100
                  </span>
                </div>
                <ul className="space-y-0.5 mb-1.5">
                  {r.reasons.map((why, j) => (
                    <li key={j} className="text-[11px] text-gray-600 flex items-start gap-1.5">
                      <span className="text-primary-400 mt-0.5">◆</span>{why}
                    </li>
                  ))}
                </ul>
                <p className="text-[10px] text-gray-500">
                  <strong>Selling window:</strong> {r.selling_window} · <strong>Storage:</strong> {r.storage_note}
                </p>
              </div>
            ))}
          </div>
        )}
      </div>
        </div>
      </div>
    </Card>
  )
}
