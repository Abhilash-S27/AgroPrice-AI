import { useState, useRef, useEffect, useCallback } from 'react'
import Card from '@components/ui/Card'
import { aiService } from '@services/aiService'
import { useVoiceAssistant } from '@hooks/useVoiceAssistant'

/**
 * "Ask AgroPrice AI" — embedded forecast copilot chat.
 * Context-aware: every message carries the currently selected crop/state/horizon.
 * Voice: browser-native speech-to-text feeds the same pipeline; replies can be
 * spoken back via SpeechSynthesis. No external APIs.
 */

/**
 * Highlight ₹ amounts and percentages inside AI replies so analytical
 * values stand out — pure text transform, no content changes.
 */
function emphasize(text) {
  const parts = String(text).split(/(₹[\d,.]+(?:\/qtl)?|[+-]?\d+(?:\.\d+)?%(?:\s*CV)?)/g)
  return parts.map((p, i) =>
    /^(₹|[+-]?\d)/.test(p)
      ? <strong key={i} className="font-semibold text-gray-900">{p}</strong>
      : p
  )
}

function TypingBubble() {
  return (
    <div className="flex items-end gap-2">
      <div className="w-6 h-6 rounded-lg bg-primary-600 text-white text-[11px] flex items-center justify-center shrink-0">✦</div>
      <div className="px-3.5 py-2.5 rounded-2xl rounded-bl-md bg-gray-100 flex items-center gap-1">
        <span className="w-1.5 h-1.5 rounded-full bg-gray-400 ai-typing-dot" />
        <span className="w-1.5 h-1.5 rounded-full bg-gray-400 ai-typing-dot" />
        <span className="w-1.5 h-1.5 rounded-full bg-gray-400 ai-typing-dot" />
      </div>
    </div>
  )
}

function Waveform() {
  return (
    <span className="flex items-center gap-0.5 h-4">
      {[...Array(5)].map((_, i) => (
        <span key={i} className="ai-wave-bar w-0.5 h-full bg-red-400 rounded-full" />
      ))}
    </span>
  )
}

export default function AIChatPanel({
  crop, state, days, suggestedPrompts = [],
  injectedPrompt = null, onInjectedHandled,
}) {
  const [messages, setMessages] = useState([])   // {role, text, intent?}
  const [input, setInput]       = useState('')
  const [busy, setBusy]         = useState(false)
  const [voiceReplies, setVoiceReplies] = useState(false)
  const scrollRef = useRef(null)
  const messagesRef = useRef(messages)
  messagesRef.current = messages

  const send = useCallback(async (text) => {
    const message = (text ?? '').trim()
    if (!message || busy) return
    // conversation memory: ship the recent turns so the engine can resolve
    // follow-ups ("in 2024"), inherited crops, and ongoing topics
    const history = messagesRef.current.slice(-8).map(m => ({
      role: m.role === 'ai' ? 'ai' : 'user',
      text: m.text,
    }))
    setMessages(m => [...m, { role: 'user', text: message }])
    setInput('')
    setBusy(true)
    try {
      const res = await aiService.chat({ message, crop, state, days, history })
      setMessages(m => [...m, {
        role: 'ai', text: res.reply, intent: res.intent, followUps: res.follow_ups ?? [],
        kind: res.kind, kindIcon: res.kind_icon, confidence: res.confidence,
        inferred: res.inferred_context ?? [],
      }])
      if (voiceReplies) voice.speak(res.reply)
      else voice.finishProcessing()
    } catch (err) {
      setMessages(m => [...m, {
        role: 'ai',
        text: err?.response?.data?.detail ?? 'I could not reach the analytics engine — please retry.',
        intent: 'error',
      }])
      voice.finishProcessing()
    } finally {
      setBusy(false)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [busy, crop, state, days, voiceReplies])

  const voice = useVoiceAssistant({ onTranscript: send })

  // smart fallback actions (e.g. Mode-D "Compare Karnataka vs Kerala") can
  // inject a prompt from outside the panel
  useEffect(() => {
    if (injectedPrompt) {
      send(injectedPrompt)
      onInjectedHandled?.()
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [injectedPrompt])

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' })
  }, [messages, busy])

  const lastFollowUps = [...messages].reverse().find(m => m.role === 'ai')?.followUps ?? []
  const chips = messages.length === 0 ? suggestedPrompts.slice(0, 4) : lastFollowUps.slice(0, 3)

  return (
    <Card className="!p-0 overflow-hidden ai-fade-up">
      {/* header */}
      <div className="px-5 py-3.5 border-b border-gray-100 flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-primary-600 text-white flex items-center justify-center text-base">💬</div>
          <div>
            <p className="text-sm font-bold text-gray-900 leading-tight">Ask AgroPrice AI</p>
            <p className="text-[11px] text-gray-400">
              context: {crop} · {state} · {days}-day horizon
            </p>
          </div>
        </div>
        <label className="flex items-center gap-1.5 text-[11px] text-gray-500 cursor-pointer select-none">
          <input type="checkbox" checked={voiceReplies}
                 onChange={e => setVoiceReplies(e.target.checked)}
                 className="rounded accent-primary-600" />
          🔊 Speak replies
        </label>
      </div>

      {/* transcript area */}
      <div ref={scrollRef} className="h-72 overflow-y-auto px-5 py-4 space-y-3 bg-gray-50/50">
        {messages.length === 0 && (
          <div className="h-full flex flex-col items-center justify-center text-center px-6">
            <span className="text-2xl mb-2">✦</span>
            <p className="text-sm font-semibold text-gray-600 mb-1">
              Talk to AgroPrice AI about {crop}
            </p>
            <p className="text-xs text-gray-400">
              Answers are grounded in the live volatility, seasonality, momentum and
              anomaly metrics you see on this page.
            </p>
          </div>
        )}

        {messages.map((m, i) => (
          m.role === 'user' ? (
            <div key={i} className="flex justify-end">
              <div className="max-w-[80%] px-3.5 py-2.5 rounded-2xl rounded-br-md bg-primary-600 text-white text-xs leading-relaxed">
                {m.text}
              </div>
            </div>
          ) : (
            <div key={i} className="flex items-end gap-2">
              <div className="w-6 h-6 rounded-lg bg-primary-600 text-white text-[11px] flex items-center justify-center shrink-0">✦</div>
              <div className="max-w-[85%]">
                <div className="rounded-2xl rounded-bl-md bg-white border border-gray-200 overflow-hidden">
                  {/* analyst section header */}
                  {m.kind && (
                    <div className="flex items-center justify-between px-3.5 pt-2 pb-1.5 border-b border-gray-50">
                      <span className="text-[10px] font-bold text-primary-600 uppercase tracking-wide">
                        {m.kindIcon} {m.kind}
                      </span>
                      {m.confidence != null && (
                        <span className="text-[9px] font-semibold text-gray-400"
                              title="Forecast reliability score for this market">
                          confidence {m.confidence}/100
                        </span>
                      )}
                    </div>
                  )}
                  <div className="px-3.5 py-2.5 text-xs leading-relaxed text-gray-700">
                    {emphasize(m.text)}
                  </div>
                </div>
                {/* AI inferred context pills — slots carried from memory */}
                {m.inferred?.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-1.5 ml-1">
                    <span className="text-[9px] font-bold text-gray-400 uppercase tracking-wide py-0.5">
                      ✦ AI inferred:
                    </span>
                    {m.inferred.map((p, j) => (
                      <span key={j}
                        className="px-1.5 py-0.5 rounded-full text-[9px] font-semibold
                                   bg-violet-50 text-violet-600 border border-violet-100">
                        {p}
                      </span>
                    ))}
                  </div>
                )}
                {m.intent && m.intent !== 'error' && (
                  <p className="text-[10px] text-gray-300 mt-1 ml-1">
                    reasoning: {m.intent.replace(/_/g, ' ')} analysis
                  </p>
                )}
              </div>
            </div>
          )
        ))}

        {busy && <TypingBubble />}
      </div>

      {/* suggestion chips */}
      {chips.length > 0 && (
        <div className="px-5 py-2 border-t border-gray-100 flex gap-1.5 flex-wrap bg-white">
          {chips.map((p, i) => (
            <button key={i} onClick={() => send(p)} disabled={busy}
              className="px-2.5 py-1 rounded-full text-[11px] font-medium text-primary-700 bg-primary-50
                         border border-primary-100 hover:bg-primary-100 transition-colors disabled:opacity-50">
              {p}
            </button>
          ))}
        </div>
      )}

      {/* composer */}
      <div className="px-4 py-3 border-t border-gray-100 bg-white">
        {voice.errorMsg && (
          <div className="flex items-center justify-between mb-2 px-2">
            <p className="text-[11px] text-red-400">{voice.errorMsg}</p>
            <button onClick={voice.clearError} className="text-[10px] text-gray-400 hover:text-gray-600 ml-2">✕</button>
          </div>
        )}
        {!voice.errorMsg && voice.phase === 'connecting' && (
          <div className="flex items-center gap-2 mb-2 px-2 text-[11px] animate-pulse" style={{ color: 'rgba(251,191,36,0.90)' }}>
            ⏳ Connecting microphone…
          </div>
        )}
        {!voice.errorMsg && voice.phase === 'listening' && (
          <div className="flex items-center gap-2 mb-2 px-2 text-[11px]" style={{ color: 'rgba(52,211,153,0.90)' }}>
            <Waveform />
            {voice.transcript
              ? <span className="truncate">🎙 {voice.transcript}</span>
              : <span className="animate-pulse">🎙 Listening — speak clearly…</span>}
          </div>
        )}
        {!voice.errorMsg && voice.phase === 'speaking' && (
          <div className="flex items-center justify-between mb-2 px-2 text-[11px]" style={{ color: 'rgba(99,102,241,0.90)' }}>
            <span className="flex items-center gap-2"><Waveform /> Speaking…</span>
            <button onClick={voice.stopSpeaking} className="text-[10px] text-gray-400 hover:text-gray-600">stop</button>
          </div>
        )}
        <form
          className="flex items-center gap-2"
          onSubmit={e => { e.preventDefault(); send(input) }}
        >
          {/* mic — Talk to AgroPrice AI */}
          <button
            type="button"
            aria-label={voice.phase === 'listening' ? 'Stop voice input' : 'Start voice input'}
            title={
              !voice.supported ? 'Voice not supported in this browser' :
              voice.phase === 'connecting' ? 'Connecting…' :
              voice.phase === 'listening' ? 'Stop listening' :
              'Speak your question'
            }
            disabled={!voice.supported}
            onClick={
              voice.phase === 'listening' || voice.phase === 'connecting'
                ? voice.stopListening
                : () => { voice.clearError?.(); voice.startListening() }
            }
            className="w-9 h-9 rounded-xl flex items-center justify-center text-base shrink-0 border transition-all"
            style={
              voice.phase === 'connecting'
                ? { background: 'rgba(251,191,36,0.15)', borderColor: 'rgba(251,191,36,0.50)' }
                : voice.phase === 'listening'
                  ? { background: 'rgba(239,68,68,0.15)', borderColor: 'rgba(239,68,68,0.50)' }
                  : voice.supported
                    ? { background: 'rgba(255,255,255,0.05)', borderColor: 'rgba(255,255,255,0.14)' }
                    : { background: 'transparent', borderColor: 'rgba(255,255,255,0.08)', opacity: 0.4 }
            }
          >
            🎙️
          </button>
          <input
            value={input}
            onChange={e => setInput(e.target.value)}
            placeholder={`Ask about ${crop} — trend, risk, selling window…`}
            className="flex-1 border border-gray-200 rounded-xl px-3.5 py-2 text-xs
                       focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
          />
          <button type="submit" disabled={busy || !input.trim()}
            className="px-3.5 py-2 rounded-xl bg-primary-600 text-white text-xs font-semibold
                       hover:bg-primary-700 disabled:opacity-40 transition-colors">
            Send
          </button>
        </form>
      </div>
    </Card>
  )
}
