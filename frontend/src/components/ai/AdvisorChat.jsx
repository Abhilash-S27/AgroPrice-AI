import { useState, useRef, useEffect, useCallback } from 'react'
import Card from '@components/ui/Card'
import { advisorService } from '@services/advisorService'
import api from '@services/api'
import { SOUTH_INDIAN_STATES, TIER1_CROPS, TIER2_CROPS, TIER3_CROPS } from '@utils/constants'
import { useSpeechRecognition } from '@hooks/useSpeechRecognition'
import { useTextToSpeech } from '@hooks/useTextToSpeech'
import AIResponseLayout from './AIResponseLayout'
import AIMemoryTimeline from './AIMemoryTimeline'
import AIAnalystModeSelector from './AIAnalystModeSelector'

// ── Suggested opening prompts ─────────────────────────────────────────────────
const SUGGESTED_PROMPTS = [
  'What is the current market outlook for tomato in Karnataka?',
  'Why are onion prices rising this season?',
  'Which crop is safest to sell this month?',
  'Explain the volatility in cardamom prices',
  'What is the best time to sell chilli?',
  'Compare ragi and rice market stability',
]

// ── Intent → display label ────────────────────────────────────────────────────
const INTENT_LABELS = {
  price_now:      'Price Query',
  trend:          'Forecast',
  volatility:     'Volatility',
  seasonal:       'Seasonal',
  anomaly:        'Anomaly',
  compare:        'Comparison',
  adv_safest:     'Safety Advisory',
  adv_riskiest:   'Risk Advisory',
  adv_momentum:   'Momentum',
  adv_short:      'Short-term',
  adv_long:       'Long-term',
  adv_diversify:  'Diversification',
  profitability:  'Profitability',
  storage:        'Storage',
  sell_window:    'Sell Window',
  confidence:     'Reliability',
  historical:          'Historical',
  historical_price:    'Historical Price',
  yearly_comparison:   'Year Comparison',
  all_time_peak:       'All-Time Peak',
  all_time_trough:     'All-Time Trough',
  trend_analysis:      'Price Trend',
  seasonal_history:    'Seasonal History',
  greeting:       'Greeting',
  thanks:         'Acknowledgement',
  help:           'Help',
  rejected:       'Out of scope',
  unknown:        'General',
}

// ── Gemini error_type → user-facing badge ─────────────────────────────────────
const GEMINI_ERROR_BADGES = {
  quota_exceeded:    { label: 'Quota Exceeded',      color: 'amber',   action: 'Free-tier quota exhausted — responses will resume shortly.' },
  invalid_key:       { label: 'API Key Invalid',     color: 'red',     action: 'Check GEMINI_API_KEY in backend/.env and restart the server.' },
  key_not_configured:{ label: 'API Key Missing',     color: 'red',     action: 'Add GEMINI_API_KEY to backend/.env and restart the server.' },
  safety_blocked:    { label: 'Safety Filtered',     color: 'orange',  action: 'Response was filtered — please rephrase your question.' },
  empty_response:    { label: 'Empty Response',      color: 'gray',    action: 'Gemini returned no content — try rephrasing.' },
  timeout:           { label: 'Timeout',             color: 'orange',  action: 'Gemini took too long — please retry.' },
  server_error:      { label: 'Gemini Unavailable',  color: 'red',     action: 'Gemini service is temporarily down — retry in a moment.' },
  network_error:     { label: 'Network Error',       color: 'red',     action: 'Cannot reach Gemini — check your internet connection.' },
  client_error:      { label: 'Request Error',       color: 'orange',  action: 'Gemini rejected the request — please retry.' },
  stream_error:      { label: 'Stream Error',        color: 'orange',  action: 'Streaming was interrupted — please retry.' },
  pipeline_error:    { label: 'Pipeline Error',      color: 'red',     action: 'Advisor pipeline error — please retry.' },
}

// ── Structured HTTP error → user-safe message ─────────────────────────────────
function describeAdvisorError(err) {
  const detail    = err?.response?.data?.detail
  const category  = typeof detail === 'object' ? detail?.category : null
  const serverMsg = typeof detail === 'object' ? detail?.message
                  : typeof detail === 'string' ? detail : null

  if (!err?.response) {
    return 'Network error — the backend is not reachable. Make sure the server '
         + 'is running (start.bat), then retry.'
  }
  switch (category) {
    case 'validation_error':
      return `Request rejected: ${serverMsg ?? 'invalid crop or state.'}`
    case 'pipeline_error':
      return serverMsg ?? 'The advisor pipeline hit an internal error — please retry.'
    default:
      return serverMsg ?? `The advisor returned an unexpected ${err.response.status} error — please retry.`
  }
}

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Inline: bold, italic, price & % highlighting */
function inlineFormat(text) {
  const parts = String(text).split(/(\*\*[^*]+\*\*|\*[^*]+\*|₹[\d,]+(?:\/quintal|\/qtl)?|[+-]?\d+(?:\.\d+)?%)/g)
  return parts.map((p, i) => {
    if (/^\*\*/.test(p) && p.endsWith('**'))
      return <strong key={i} className="font-semibold text-gray-900">{p.slice(2, -2)}</strong>
    if (/^\*/.test(p) && p.endsWith('*'))
      return <em key={i} className="italic">{p.slice(1, -1)}</em>
    if (/^₹/.test(p) || /^[+-]?\d+(\.\d+)?%$/.test(p))
      return <strong key={i} className="font-medium text-emerald-700">{p}</strong>
    return p
  })
}

/** Block-level markdown renderer — handles bullets, numbered lists, headings, paragraphs */
function renderAdvisorMarkdown(text) {
  const blocks = String(text).split(/\n{2,}/)
  const out = []
  for (let bi = 0; bi < blocks.length; bi++) {
    const lines = blocks[bi].split('\n').map(l => l.trim()).filter(Boolean)
    if (!lines.length) continue

    // Bullet list
    if (lines.every(l => /^[-•*]\s/.test(l))) {
      out.push(
        <ul key={bi} className="list-disc list-inside space-y-0.5 my-1.5 text-sm text-gray-800">
          {lines.map((l, li) => <li key={li}>{inlineFormat(l.replace(/^[-•*]\s+/, ''))}</li>)}
        </ul>
      )
      continue
    }
    // Numbered list
    if (lines.every(l => /^\d+[.)]\s/.test(l))) {
      out.push(
        <ol key={bi} className="list-decimal list-inside space-y-0.5 my-1.5 text-sm text-gray-800">
          {lines.map((l, li) => <li key={li}>{inlineFormat(l.replace(/^\d+[.)]\s+/, ''))}</li>)}
        </ol>
      )
      continue
    }
    // Heading
    if (lines.length === 1 && /^#{1,3}\s+/.test(lines[0])) {
      out.push(
        <p key={bi} className="text-sm font-semibold text-gray-900 mt-2">
          {inlineFormat(lines[0].replace(/^#{1,3}\s+/, ''))}
        </p>
      )
      continue
    }
    // Paragraph (may have inline soft line-breaks)
    out.push(
      <p key={bi} className="text-sm leading-relaxed text-gray-800">
        {lines.map((l, li) => (
          <span key={li}>{li > 0 && <br />}{inlineFormat(l)}</span>
        ))}
      </p>
    )
  }
  return out.length ? out : [<p key={0} className="text-sm leading-relaxed text-gray-800">{inlineFormat(text)}</p>]
}

function IconMic({ active }) {
  return (
    <svg className="w-4 h-4" viewBox="0 0 24 24" fill={active ? 'currentColor' : 'none'}
         stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <rect x="9" y="2" width="6" height="12" rx="3"/>
      <path d="M5 10a7 7 0 0014 0M12 19v3M9 22h6"/>
    </svg>
  )
}

function IconSpeaker({ active }) {
  return (
    <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none"
         stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/>
      {active
        ? <><path d="M15.54 8.46a5 5 0 010 7.07"/><path d="M19.07 4.93a10 10 0 010 14.14"/></>
        : <path d="M15.54 8.46a5 5 0 010 7.07"/>
      }
    </svg>
  )
}

function TypingDots() {
  return (
    <div className="flex items-end gap-2">
      <div className="w-6 h-6 rounded-lg bg-primary-600 text-white text-[11px] flex items-center justify-center shrink-0">AI</div>
      <div className="px-3.5 py-2.5 rounded-2xl rounded-bl-md bg-gray-100 flex items-center gap-1">
        {[0,1,2].map(i => (
          <span key={i} className="w-1.5 h-1.5 rounded-full bg-gray-400 animate-bounce"
                style={{ animationDelay: `${i * 0.15}s` }} />
        ))}
      </div>
    </div>
  )
}

function IntentChip({ intent }) {
  if (!intent || intent === 'unknown' || intent === 'greeting' || intent === 'thanks') return null
  const label = INTENT_LABELS[intent] || intent
  return (
    <span className="inline-block text-[9px] font-semibold px-1.5 py-0.5 rounded border
                     bg-blue-50 border-blue-200 text-blue-600 ml-1 align-middle">
      {label}
    </span>
  )
}

function GeminiErrorBadge({ errorType }) {
  if (!errorType) return null
  const badge = GEMINI_ERROR_BADGES[errorType]
  if (!badge) return null

  const colorMap = {
    amber:  'bg-amber-50 border-amber-200 text-amber-700',
    red:    'bg-red-50 border-red-200 text-red-700',
    orange: 'bg-orange-50 border-orange-200 text-orange-700',
    gray:   'bg-gray-100 border-gray-200 text-gray-600',
  }
  const cls = colorMap[badge.color] || colorMap.gray

  return (
    <div className={`mt-1.5 text-[10px] px-2 py-1 rounded border ${cls} flex items-start gap-1`}>
      <span className="font-semibold shrink-0">[{badge.label}]</span>
      <span>{badge.action}</span>
    </div>
  )
}

function GroundedIndicator({ grounded }) {
  if (grounded === undefined) return null
  return (
    <span className={`inline-flex items-center gap-1 text-[9px] px-1.5 py-0.5 rounded-full border ml-1 align-middle
      ${grounded
        ? 'bg-emerald-50 border-emerald-200 text-emerald-700'
        : 'bg-gray-100 border-gray-200 text-gray-500'}`}>
      <span className={`w-1 h-1 rounded-full ${grounded ? 'bg-emerald-500' : 'bg-gray-400'}`} />
      {grounded ? 'Grounded' : 'General'}
    </span>
  )
}

function SourcesList({ sources }) {
  if (!sources?.length) return null
  return (
    <div className="mt-1.5 flex flex-wrap gap-1">
      {sources.map((s, i) => (
        <span key={i} className="text-[9px] px-1.5 py-0.5 rounded-full bg-emerald-50 border border-emerald-100 text-emerald-600">
          {s}
        </span>
      ))}
    </div>
  )
}

function InferredContext({ items }) {
  if (!items?.length) return null
  return (
    <p className="text-[10px] text-amber-600 mt-0.5 italic">
      Using {items.join(', ')} from conversation memory
    </p>
  )
}

// ── Streaming cursor ──────────────────────────────────────────────────────────
function StreamCursor() {
  return (
    <span className="inline-block w-0.5 h-3.5 bg-primary-600 ml-0.5 align-middle rounded-sm animate-pulse" />
  )
}

// ── Main component ─────────────────────────────────────────────────────────────
export default function AdvisorChat({ initialCrop = null, initialState = null }) {
  const [messages, setMessages]         = useState([])
  const [input, setInput]               = useState('')
  const [busy, setBusy]                 = useState(false)
  const [sessionId, setSessionId]       = useState(() => advisorService.newSessionId())
  const [selectedCrop, setCrop]         = useState(initialCrop || '')
  const [selectedState, setState_]      = useState(initialState || '')
  const [viewMode, setViewMode]         = useState(null)   // Phase 3B analyst mode
  const [interimTranscript, setInterim] = useState('')
  const [speakingIdx, setSpeakingIdx]   = useState(null)
  const scrollRef  = useRef(null)
  const abortRef   = useRef(null)   // AbortController for the active stream
  const sendRef    = useRef(null)   // always-current reference to send() for STT callback

  const clearCrop  = useCallback(() => setCrop(''),   [])
  const clearState = useCallback(() => setState_(''), [])

  // ── TTS hook ──────────────────────────────────────────────────────────────
  const { speaking, supported: ttsOk, speak, stop: stopSpeaking } = useTextToSpeech()
  useEffect(() => { if (!speaking) setSpeakingIdx(null) }, [speaking])

  // ── STT hook ──────────────────────────────────────────────────────────────
  const onTranscript = useCallback((transcript, isFinal) => {
    if (isFinal) {
      setInterim('')
      setInput('')
      sendRef.current?.(transcript)   // auto-submit: speak → answer immediately
    } else {
      setInterim(transcript)
    }
  }, [])
  const {
    listening, phase: micPhase, supported: sttOk,
    errorMsg: micError, start: startMic, stop: stopMic, clearError: clearMicError,
  } = useSpeechRecognition({ onTranscript })

  const toggleMic = useCallback(() => {
    if (listening) stopMic()
    else { setInterim(''); clearMicError(); startMic() }
  }, [listening, startMic, stopMic, clearMicError])

  const speakMsg = useCallback((text, idx) => {
    if (speakingIdx === idx && speaking) { stopSpeaking(); setSpeakingIdx(null) }
    else { stopSpeaking(); setSpeakingIdx(idx); speak(text) }
  }, [speakingIdx, speaking, stopSpeaking, speak])

  // Auto-scroll on new messages / streaming tokens
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' })
  }, [messages, busy])

  // ── Streaming send (Phase 3A) ─────────────────────────────────────────────
  const send = useCallback(async (textArg) => {
    const message = (textArg ?? input).trim()
    if (!message || busy) return

    // Cancel any in-progress stream
    abortRef.current?.abort()
    abortRef.current = new AbortController()

    // Append user message + AI placeholder in one update
    setMessages(m => [
      ...m,
      { role: 'user', text: message },
      {
        role: 'ai', text: '', streaming: true,
        intent: null, sources: [], inferred: [], error_type: null,
        grounded: false, latency_ms: 0, agent_insights: {},
      },
    ])
    setInput('')
    setBusy(true)

    let streamText = ''

    try {
      for await (const chunk of advisorService.askStream(
        {
          question:   message,
          crop:       selectedCrop  || null,
          state:      selectedState || null,
          session_id: sessionId,
          view_mode:  viewMode || null,
        },
        abortRef.current.signal,
      )) {
        if (chunk.type === 'token') {
          streamText += chunk.token
          setMessages(m => {
            const arr  = [...m]
            const last = arr.length - 1
            if (arr[last]?.streaming) arr[last] = { ...arr[last], text: streamText }
            return arr
          })

        } else if (chunk.type === 'done') {
          if (chunk.session_id && chunk.session_id !== sessionId) {
            setSessionId(chunk.session_id)
          }
          setMessages(m => {
            const arr  = [...m]
            const last = arr.length - 1
            if (arr[last]?.role === 'ai') {
              arr[last] = {
                ...arr[last],
                text:             streamText,
                streaming:        false,
                intent:           chunk.intent           ?? null,
                sources:          chunk.sources          ?? [],
                inferred:         chunk.inferred_context ?? [],
                error_type:       chunk.error_type       ?? null,
                grounded:         chunk.grounded         ?? false,
                latency_ms:       chunk.latency_ms       ?? 0,
                agent_insights:   chunk.agent_insights   ?? {},
                reasoning_trace:  chunk.reasoning_trace  ?? null,
                persona:          chunk.persona          ?? null,
              }
            }
            return arr
          })

        } else if (chunk.type === 'error') {
          setMessages(m => {
            const arr  = [...m]
            const last = arr.length - 1
            if (arr[last]?.role === 'ai') {
              arr[last] = {
                ...arr[last],
                text:       streamText || chunk.message || 'An error occurred.',
                streaming:  false,
                error_type: chunk.error_type || 'unknown',
                grounded:   false,
                intent:     'error',
              }
            }
            return arr
          })
        }
      }
    } catch (err) {
      if (err.name !== 'AbortError') {
        setMessages(m => {
          const arr  = [...m]
          const last = arr.length - 1
          if (arr[last]?.role === 'ai') {
            arr[last] = {
              ...arr[last],
              text:       streamText || 'Failed to connect. Please retry.',
              streaming:  false,
              error_type: 'network_error',
              grounded:   false,
              intent:     'error',
            }
          }
          return arr
        })
      }
    } finally {
      setBusy(false)
    }
  }, [busy, input, selectedCrop, selectedState, sessionId])
  sendRef.current = send   // keep ref current so STT callback always calls the latest send

  const clearChat = () => {
    abortRef.current?.abort()
    setMessages([])
    setSessionId(advisorService.newSessionId())
  }

  // Whether the last AI message is currently streaming
  const isStreaming = messages.at(-1)?.streaming === true

  const chips        = messages.length === 0 ? SUGGESTED_PROMPTS.slice(0, 4) : []
  const cropOptions  = [...TIER1_CROPS, ...TIER2_CROPS, ...TIER3_CROPS]
  const stateOptions = SOUTH_INDIAN_STATES

  return (
    <Card className="!p-0 overflow-hidden">

      {/* ── Header ────────────────────────────────────────────── */}
      <div className="px-5 py-3.5 border-b border-gray-100 flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-primary-600 text-white flex items-center justify-center text-sm font-bold">AI</div>
          <div>
            <p className="text-sm font-bold text-gray-900 leading-tight">AI Advisor</p>
            <p className="text-[11px] text-gray-400">
              Grounded · Gemini-powered · Agricultural intelligence
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {busy && (
            <span className="text-[10px] text-gray-400 animate-pulse">
              {isStreaming ? 'Writing…' : 'Thinking…'}
            </span>
          )}
          {messages.length > 0 && (
            <button
              onClick={clearChat}
              className="text-[10px] px-2 py-1 rounded border border-gray-200 text-gray-500 hover:border-gray-300 transition-colors"
            >
              New chat
            </button>
          )}
          <span className="inline-flex items-center gap-1 text-[10px] px-2 py-1 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-700">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
            Gemini 2.5 Flash
          </span>
        </div>
      </div>

      {/* ── Context selectors ─────────────────────────────────── */}
      <div className="px-4 py-2 border-b border-gray-100 bg-gray-50/60">
        <div className="flex gap-2 flex-wrap items-center">
          <select
            value={selectedCrop}
            onChange={e => setCrop(e.target.value)}
            className="text-xs px-2.5 py-1.5 rounded-lg border border-gray-200 bg-white text-gray-700 focus:outline-none focus:ring-1 focus:ring-primary-500 min-w-[120px]"
          >
            <option value="">Any crop</option>
            {cropOptions.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
          <select
            value={selectedState}
            onChange={e => setState_(e.target.value)}
            className="text-xs px-2.5 py-1.5 rounded-lg border border-gray-200 bg-white text-gray-700 focus:outline-none focus:ring-1 focus:ring-primary-500 min-w-[120px]"
          >
            <option value="">Any state</option>
            {stateOptions.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
          {!selectedCrop && !selectedState && (
            <span className="text-[10px] text-gray-400 italic">
              Select crop &amp; state for grounded price data
            </span>
          )}
          {/* Analyst mode selector — Phase 3B */}
          <div className="ml-auto">
            <AIAnalystModeSelector value={viewMode} onChange={setViewMode} />
          </div>
        </div>
      </div>

      {/* ── Memory timeline — Phase 3B ────────────────────────── */}
      <AIMemoryTimeline
        crop={selectedCrop}
        state={selectedState}
        messages={messages}
        onClearCrop={clearCrop}
        onClearState={clearState}
      />

      {/* ── Transcript ────────────────────────────────────────── */}
      <div ref={scrollRef} className="h-80 overflow-y-auto px-5 py-4 space-y-3 bg-gray-50/30">
        {messages.length === 0 && (
          <div className="h-full flex flex-col items-center justify-center text-center px-6 py-4">
            <span className="text-3xl mb-3 opacity-60">🌾</span>
            <p className="text-sm font-medium text-gray-700">Ask AgroPrice AI Advisor</p>
            <p className="text-xs text-gray-400 mt-1 max-w-xs">
              Get grounded insights on crop prices, market trends, seasonal patterns,
              and farming strategy — powered by real AGMARKNET data.
            </p>
          </div>
        )}

        {messages.map((msg, i) => (
          <div key={i} className={`flex items-end gap-2 ${msg.role === 'user' ? 'justify-end' : ''}`}>
            {msg.role === 'ai' && (
              <div className="w-6 h-6 rounded-lg bg-primary-600 text-white text-[11px] flex items-center justify-center shrink-0">AI</div>
            )}
            <div className={`max-w-[85%] ${msg.role === 'user'
              ? 'px-3.5 py-2.5 rounded-2xl rounded-br-md bg-primary-600 text-white text-sm'
              : 'px-3.5 py-2.5 rounded-2xl rounded-bl-md bg-white border border-gray-100 text-sm text-gray-800 shadow-sm'}`}
            >
              {msg.role === 'ai' ? (
                <>
                  {/* Phase 3B — Executive response layout */}
                  <AIResponseLayout msg={msg} isStreaming={msg.streaming} />

                  {/* Metadata row */}
                  <div className="flex flex-wrap items-center gap-1 mt-2 pt-1.5 border-t border-gray-50">
                    <IntentChip intent={msg.intent} />
                    <InferredContext items={msg.inferred} />
                    {ttsOk && !msg.streaming && (
                      <button
                        onClick={() => speakMsg(msg.text, i)}
                        title={speakingIdx === i && speaking ? 'Stop speaking' : 'Read aloud'}
                        className={`ml-auto flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[10px] font-medium transition-colors border ${
                          speakingIdx === i && speaking
                            ? 'text-primary-600 bg-primary-50 border-primary-200'
                            : 'text-gray-500 bg-gray-50 border-gray-200 hover:text-primary-600 hover:bg-primary-50 hover:border-primary-200'
                        }`}
                      >
                        <IconSpeaker active={speakingIdx === i && speaking} />
                        <span>{speakingIdx === i && speaking ? 'Stop' : 'Listen'}</span>
                      </button>
                    )}
                  </div>

                  <GeminiErrorBadge errorType={msg.error_type} />
                  <SourcesList sources={msg.sources} />
                </>
              ) : (
                <p>{msg.text}</p>
              )}
            </div>
            {msg.role === 'user' && (
              <div className="w-6 h-6 rounded-lg bg-gray-200 text-gray-600 text-[11px] flex items-center justify-center shrink-0">U</div>
            )}
          </div>
        ))}

        {/* Typing dots while waiting for first token */}
        {busy && !isStreaming && <TypingDots />}
      </div>

      {/* ── Suggested chips ───────────────────────────────────── */}
      {chips.length > 0 && (
        <div className="px-5 pb-2 pt-1 flex flex-wrap gap-1.5 border-t border-gray-50 bg-white">
          {chips.map((p, i) => (
            <button
              key={i}
              onClick={() => send(p)}
              disabled={busy}
              className="text-[11px] px-2.5 py-1 rounded-full border border-gray-200 text-gray-600
                         hover:border-primary-400 hover:text-primary-700 hover:bg-primary-50
                         transition-colors disabled:opacity-50 whitespace-nowrap"
            >
              {p.length > 50 ? p.slice(0, 48) + '...' : p}
            </button>
          ))}
        </div>
      )}

      {/* ── Input bar ─────────────────────────────────────────── */}
      <div className="px-4 pt-3 pb-2 border-t border-gray-100 bg-white">
        {micError && (
          <div className="flex items-center justify-between mb-1.5 px-1">
            <p className="text-[11px] text-red-400">{micError}</p>
            <button onClick={clearMicError} className="text-[10px] text-gray-400 hover:text-gray-600 ml-2">✕</button>
          </div>
        )}
        {!micError && (micPhase === 'connecting' || listening || interimTranscript) && (
          <p className="text-[11px] mb-1.5 px-1 animate-pulse"
             style={{ color: micPhase === 'connecting' ? 'rgba(251,191,36,0.90)' : 'rgba(52,211,153,0.90)' }}>
            {micPhase === 'connecting'
              ? '⏳ Connecting microphone…'
              : interimTranscript
                ? `🎙 ${interimTranscript}`
                : '🎙 Listening — speak clearly…'}
          </p>
        )}
        <div className="flex gap-2">
          <input
            type="text"
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && !e.shiftKey && send()}
            placeholder={selectedCrop
              ? `Ask about ${selectedCrop} market…`
              : 'Ask about any South Indian crop market…'}
            disabled={busy}
            className="flex-1 text-sm px-3.5 py-2 rounded-xl border border-gray-200 bg-gray-50
                       placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-primary-500
                       focus:border-transparent disabled:opacity-60 transition-all"
          />
          {sttOk && (
            <button
              onClick={toggleMic}
              disabled={busy}
              title={
                micPhase === 'connecting' ? 'Connecting…' :
                listening ? 'Stop listening' :
                'Voice input (speak your question)'
              }
              className="p-2 rounded-xl border transition-all shrink-0"
              style={
                micPhase === 'connecting'
                  ? { background: 'rgba(251,191,36,0.15)', borderColor: 'rgba(251,191,36,0.50)', color: 'rgba(251,191,36,0.90)' }
                  : listening
                    ? { background: 'rgba(239,68,68,0.15)', borderColor: 'rgba(239,68,68,0.50)', color: 'rgba(239,68,68,0.90)' }
                    : { background: 'rgba(255,255,255,0.05)', borderColor: 'rgba(255,255,255,0.14)', color: 'rgba(255,255,255,0.55)' }
              }
            >
              <IconMic active={listening || micPhase === 'connecting'} />
            </button>
          )}
          <button
            onClick={() => send()}
            disabled={busy || !input.trim()}
            className="px-4 py-2 rounded-xl bg-primary-600 text-white text-sm font-medium
                       hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed
                       transition-colors shrink-0"
          >
            {busy ? '…' : 'Ask'}
          </button>
        </div>
      </div>

      {/* developer diagnostics — dev builds only */}
      {import.meta.env.DEV && (
        <AdvisorDebugPanel
          lastMsg={messages.at(-1)}
          crop={selectedCrop}
          state={selectedState}
          sessionId={sessionId}
        />
      )}
    </Card>
  )
}

// ── Developer debug panel (dev-only) ──────────────────────────────────────────
function AdvisorDebugPanel({ lastMsg, crop, state, sessionId }) {
  const [open, setOpen]     = useState(false)
  const [dbg, setDbg]       = useState(null)
  const [health, setHealth] = useState(null)

  const refresh = async () => {
    try {
      const [debugRes, healthRes] = await Promise.all([
        api.get('/api/advisor/debug'),
        api.get('/api/advisor/health'),
      ])
      setDbg(debugRes.data)
      setHealth(healthRes.data)
    } catch (err) {
      setDbg({ route: 'unreachable', error: err.message })
      setHealth(null)
    }
  }

  return (
    <div className="border-t border-dashed border-gray-200 pt-2 px-4 pb-2">
      <button
        onClick={() => { setOpen(o => !o); if (!open) refresh() }}
        className="text-[10px] font-mono text-gray-300 hover:text-gray-500"
      >
        {open ? '▾' : '▸'} dev diagnostics
      </button>
      {open && (
        <div className="mt-1.5 rounded-lg bg-gray-900 text-gray-200 p-3 text-[10px] font-mono space-y-1 overflow-x-auto">

          {health && (
            <p className="text-gray-300">
              gemini: {health.gemini_ready ? '✓ ready' : '✗ not ready'}
              {' '}· configured: {health.gemini_configured ? '✓' : '✗'}
              {' '}· duckdb: {health.duckdb_ready ? '✓' : '✗'}
              {' '}· model: {health.model}
              {' '}· memory: {health.memory_backend}
            </p>
          )}

          <p className="text-gray-400">
            ui-crop: {crop || '(none)'} · ui-state: {state || '(none)'}
            {' '}· session: {sessionId?.slice(0, 12)}
          </p>

          {lastMsg?.role === 'ai' && (
            <p className="text-gray-400">
              last-msg: streaming={String(lastMsg.streaming ?? false)}
              {' '}· grounded={String(lastMsg.grounded ?? false)}
              {' '}· intent={lastMsg.intent || '-'}
              {' '}· latency={lastMsg.latency_ms ?? 0}ms
              {' '}· error_type={lastMsg.error_type || 'none'}
              {' '}· agents={Object.keys(lastMsg.agent_insights || {}).join(',')||'-'}
            </p>
          )}

          {dbg?.route && (
            <p>route: {dbg.route}
              {dbg.gemini && <> · gemini: {dbg.gemini.ready ? '✓ ready' : '✗ not ready'}
              · key: {dbg.gemini.api_key_loaded ? '✓ loaded' : '✗ missing'}
              · model: {dbg.gemini.model}</>}
            </p>
          )}
          {dbg?.memory && <p>memory: {dbg.memory.active_sessions} active session(s) · backend: {dbg.memory.backend}</p>}
          {dbg?.last_request_trace?.stages && (
            <>
              <p className="text-gray-400">
                last request: "{dbg.last_request_trace.question}"
                {' '}· intent={dbg.last_request_trace.intent}
                {' '}· grounded={String(dbg.last_request_trace.grounded ?? false)}
                {' '}· error={dbg.last_request_trace.error_type || 'none'}
                {' '}· {dbg.last_request_trace.total_ms}ms
              </p>
              {dbg.last_request_trace.stages.map((s, i) => (
                <p key={i} className="pl-2 text-gray-400">
                  {s.t_ms}ms {s.stage} {Object.entries(s)
                    .filter(([k]) => !['stage', 't_ms'].includes(k))
                    .map(([k, v]) => `${k}=${String(v).slice(0, 40)}`).join(' ')}
                </p>
              ))}
            </>
          )}
          <button onClick={refresh} className="text-primary-400 hover:text-primary-300 mt-1">↻ refresh</button>
        </div>
      )}
    </div>
  )
}
