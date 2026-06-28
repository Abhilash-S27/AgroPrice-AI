import { useState, useEffect } from 'react'
import api from '@services/api'

/**
 * Executive AI Report (Phase 5) — presentation-grade export.
 * Fetches the deterministic markdown report, renders it as styled HTML,
 * embeds a live snapshot of the on-page forecast chart (cloned SVG),
 * and prints via the browser (Save as PDF) — print CSS isolates the
 * report so the PDF contains only the document.
 */

// minimal, safe markdown → HTML for our own deterministic report format
function mdToHtml(md) {
  const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  return esc(md)
    .split('\n')
    .map(line => {
      if (line.startsWith('# '))  return `<h1>${line.slice(2)}</h1>`
      if (line.startsWith('## ')) return `<h2>${line.slice(3)}</h2>`
      if (line.startsWith('- '))  return `<li>${line.slice(2)}</li>`
      if (line.startsWith('---')) return '<hr/>'
      if (line.trim() === '')     return '<br/>'
      return `<p>${line}</p>`
    })
    .join('')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/_(.+?)_/g, '<em>$1</em>')
}

export default function ExecutiveReportModal({ crop, state, days, open, onClose }) {
  const [md, setMd] = useState(null)
  const [chartSvg, setChartSvg] = useState(null)

  useEffect(() => {
    if (!open) return
    setMd(null)
    api.get('/api/ai/report', {
      params: { crop, state, days }, responseType: 'text',
      transformResponse: [(d) => d],
    })
      .then(res => setMd(res.data))
      .catch(() => setMd('# Report unavailable\nThe analytics engine could not be reached.'))

    // live snapshot of the on-page forecast chart (first recharts surface)
    const svg = document.querySelector('.recharts-surface')
    setChartSvg(svg ? svg.outerHTML : null)
  }, [open, crop, state, days])

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-gray-900/40 p-4 sm:p-8">
      <div className="print-area bg-white rounded-2xl shadow-2xl w-full max-w-3xl">
        {/* toolbar (hidden in print) */}
        <div className="no-print flex items-center justify-between px-6 py-3.5 border-b border-gray-100 sticky top-0 bg-white rounded-t-2xl">
          <p className="text-sm font-bold text-gray-900">Executive AI Report · {crop} · {state}</p>
          <div className="flex gap-2">
            <button onClick={() => window.print()}
              className="px-3.5 py-1.5 rounded-xl bg-primary-600 text-white text-xs font-semibold hover:bg-primary-700">
              🖨 Print / Save as PDF
            </button>
            <button onClick={onClose}
              className="px-3.5 py-1.5 rounded-xl bg-gray-100 text-gray-600 text-xs font-semibold hover:bg-gray-200">
              Close
            </button>
          </div>
        </div>

        <div className="px-8 py-6">
          {!md && <p className="text-sm text-gray-400">Composing the executive report…</p>}
          {md && (
            <>
              {/* chart snapshot */}
              {chartSvg && (
                <div className="print-block mb-6 border border-gray-100 rounded-xl p-3 overflow-hidden">
                  <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2">
                    Forecast Snapshot · {crop} · {state}
                  </p>
                  <div className="w-full [&>svg]:w-full [&>svg]:h-auto"
                       dangerouslySetInnerHTML={{ __html: chartSvg }} />
                </div>
              )}
              <div
                className="report-body print-block
                           [&_h1]:text-xl [&_h1]:font-extrabold [&_h1]:text-gray-900 [&_h1]:mb-1
                           [&_h2]:text-sm [&_h2]:font-bold [&_h2]:text-gray-800 [&_h2]:mt-5 [&_h2]:mb-1.5
                           [&_h2]:border-b [&_h2]:border-gray-100 [&_h2]:pb-1
                           [&_p]:text-xs [&_p]:text-gray-600 [&_p]:leading-relaxed [&_p]:my-1
                           [&_li]:text-xs [&_li]:text-gray-600 [&_li]:leading-relaxed [&_li]:ml-4 [&_li]:list-disc
                           [&_strong]:text-gray-800 [&_em]:text-gray-400
                           [&_hr]:my-4 [&_hr]:border-gray-100"
                dangerouslySetInnerHTML={{ __html: mdToHtml(md) }}
              />
            </>
          )}
        </div>
      </div>
    </div>
  )
}
