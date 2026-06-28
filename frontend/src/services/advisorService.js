import api from './api'

/**
 * AI Advisor service — calls /api/advisor/ask.
 *
 * Unlike aiService.chat (forecast copilot), this service targets the
 * Gemini-grounded advisor pipeline with full context injection.
 *
 * Session IDs are managed client-side: generate once per page load,
 * persist in component state so follow-ups inherit crop/state from memory.
 */
export const advisorService = {
  /**
   * Ask the grounded AI Advisor a question.
   *
   * @param {Object} params
   * @param {string}      params.question   - User question (min 10 chars)
   * @param {string|null} params.crop       - Optional crop hint
   * @param {string|null} params.state      - Optional state hint
   * @param {string|null} params.session_id - Session ID for memory continuity
   *
   * @returns {Promise<{
   *   answer: string,
   *   model_used: string,
   *   sources: string[],
   *   session_id: string,
   *   intent: string,
   *   inferred_context: string[],
   * }>}
   */
  async ask({ question, crop = null, state = null, session_id = null } = {}) {
    const res = await api.post('/api/advisor/ask', {
      question,
      crop,
      state,
      session_id,
      include_price_context: true,
    })
    return res.data
  },

  /**
   * Fetch conversation history for a session.
   */
  async getHistory(session_id) {
    const res = await api.get('/api/advisor/history', { params: { session_id } })
    return res.data
  },

  /**
   * Stream AI Advisor tokens via SSE (Server-Sent Events) — Phase 3A.
   *
   * Async generator — yields SSE event objects:
   *   {type: "token", token: string}    — incremental text token
   *   {type: "done",  intent, sources, grounded, latency_ms, agent_insights, ...}
   *   {type: "error", error_type, message}
   *
   * Uses native fetch() with ReadableStream — bypasses axios and Vite proxy
   * so the dev proxy does not buffer the SSE stream.
   *
   * @param {Object}      params  - same fields as ask()
   * @param {AbortSignal} [signal] - AbortSignal for cancellation
   */
  async *askStream({ question, crop = null, state = null, session_id = null } = {}, signal) {
    const baseUrl = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:8001'

    let response
    try {
      response = await fetch(`${baseUrl}/api/advisor/ask/stream`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ question, crop, state, session_id, include_price_context: true }),
        signal,
      })
    } catch (err) {
      if (err.name === 'AbortError') return
      yield {
        type:       'error',
        error_type: 'network_error',
        message:    'Cannot reach the AI Advisor. Make sure the server is running (start.bat).',
      }
      return
    }

    if (!response.ok) {
      let message = `Server error (HTTP ${response.status}).`
      if (response.status === 422) message = 'Question is too short or invalid — please type a bit more.'
      else if (response.status === 503 || response.status === 502) message = 'AI Advisor is temporarily unavailable — please retry.'
      yield { type: 'error', error_type: 'http_error', message }
      return
    }

    const reader  = response.body.getReader()
    const decoder = new TextDecoder()
    let   buffer  = ''

    try {
      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        buffer += decoder.decode(value, { stream: true })

        // Split on SSE event separator (double newline)
        const events = buffer.split('\n\n')
        buffer = events.pop() ?? ''   // last item may be an incomplete event

        for (const event of events) {
          const line = event.trim()
          if (!line.startsWith('data: ')) continue
          try {
            yield JSON.parse(line.slice(6))
          } catch { /* skip malformed events */ }
        }
      }
    } catch (err) {
      if (err.name !== 'AbortError') {
        yield { type: 'error', error_type: 'stream_error', message: 'Stream interrupted.' }
      }
    } finally {
      reader.cancel().catch(() => {})
    }
  },

  /** Generate a new session ID (client-side fallback). */
  newSessionId() {
    return `adv_${Math.random().toString(36).slice(2, 14)}`
  },
}
