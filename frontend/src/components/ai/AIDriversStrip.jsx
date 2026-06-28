/**
 * "Why this insight?" — explainability strip.
 * Renders the key data signals behind the AI's conclusions as compact
 * chips (hover for the underlying detail). Data: /api/ai/insights → drivers.
 */

const TONE = {
  up:      'bg-emerald-50 text-emerald-700 border-emerald-200',
  down:    'bg-amber-50  text-amber-700  border-amber-200',
  neutral: 'bg-gray-50   text-gray-600   border-gray-200',
}
const TONE_DOT = { up: 'bg-emerald-400', down: 'bg-amber-400', neutral: 'bg-gray-300' }

export default function AIDriversStrip({ drivers = [], className = '' }) {
  if (!drivers.length) return null
  return (
    <div className={className}>
      <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1.5">
        Why this insight? · key drivers
      </p>
      <div className="flex flex-wrap gap-1.5">
        {drivers.map((d, i) => (
          <span key={i} title={d.detail}
            className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-lg text-[11px]
                        font-medium border cursor-default ${TONE[d.tone] ?? TONE.neutral}`}>
            <span className={`w-1.5 h-1.5 rounded-full ${TONE_DOT[d.tone] ?? TONE_DOT.neutral}`} />
            {d.label}
          </span>
        ))}
      </div>
    </div>
  )
}
