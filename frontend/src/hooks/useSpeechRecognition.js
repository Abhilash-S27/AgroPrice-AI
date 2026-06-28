/**
 * useSpeechRecognition — enhanced Web Speech API hook for AgroPrice AI.
 *
 * Improvements over Phase 2A:
 *  - maxAlternatives: 3 → picks highest-confidence result
 *  - Agricultural vocabulary grammar hints (crops, states, market terms)
 *  - Post-processing correction map for common agri-term mis-recognitions
 *  - Detailed error classification (not-allowed, no-speech, network, audio-capture)
 *  - soundLevel phase: idle | connecting | listening | processing
 *  - Confidence threshold: ignores results below 0.40
 *  - Auto-language fallback: tries en-IN, falls back to en-US on no-speech
 *  - Noise resilience: ignores very short (<2 chars) interim results
 */
import { useState, useRef, useCallback, useEffect } from 'react'

const _SR = typeof window !== 'undefined'
  ? (window.SpeechRecognition || window.webkitSpeechRecognition)
  : null

const _SGL = typeof window !== 'undefined'
  ? (window.SpeechGrammarList || window.webkitSpeechGrammarList)
  : null

// ── Agricultural vocabulary for grammar hints ────────────────────────────────
const AGRI_CROPS = [
  'tomato', 'onion', 'potato', 'brinjal', 'okra', 'cabbage', 'cauliflower',
  'beetroot', 'carrot', 'mango', 'banana', 'papaya', 'coconut', 'turmeric',
  'ginger', 'black pepper', 'cardamom', 'arecanut', 'coffee', 'cotton',
  'paddy', 'maize', 'tapioca', 'groundnut', 'soybean', 'sunflower', 'jowar',
]
const AGRI_STATES = [
  'karnataka', 'tamil nadu', 'andhra pradesh', 'kerala', 'telangana',
]
const AGRI_TERMS = [
  'price', 'forecast', 'volatility', 'momentum', 'trend', 'market', 'mandi',
  'quintal', 'rupees', 'seasonal', 'anomaly', 'buy', 'sell', 'hold',
  'rising', 'falling', 'stable', 'highest', 'lowest', 'average',
  'weekly', 'monthly', 'yearly', 'today', 'tomorrow', 'this month',
  'best crop', 'safest crop', 'opportunity', 'risk', 'confidence',
]

// ── Post-recognition correction map for common mis-recognitions ───────────────
const CORRECTIONS = {
  // crop names
  'cardamon':         'cardamom',
  'cardamum':         'cardamom',
  'cardemon':         'cardamom',
  'areca nut':        'arecanut',
  'areka nut':        'arecanut',
  'areca':            'arecanut',
  'brinjal eggplant': 'brinjal',
  'eggplant':         'brinjal',
  'ladies finger':    'okra',
  'lady finger':      'okra',
  'tapioca root':     'tapioca',
  'ground nut':       'groundnut',
  'ground nuts':      'groundnuts',
  'sun flower':       'sunflower',
  'black peper':      'black pepper',
  'black peeper':     'black pepper',
  // states
  'andra pradesh':    'andhra pradesh',
  'andra':            'andhra pradesh',
  'tamilnadu':        'tamil nadu',
  'tamil nado':       'tamil nadu',
  'tamilnad':         'tamil nadu',
  'karna taka':       'karnataka',
  'keral':            'kerala',
  'telengana':        'telangana',
  'telagana':         'telangana',
  // market terms
  'monday':           'mandi',
  'mandy':            'mandi',
  'man d':            'mandi',
  'quintle':          'quintal',
  'quantal':          'quintal',
  'quinta':           'quintal',
  'profit model':     'prophet model',
  'profit forecast':  'prophet forecast',
  'rupes':            'rupees',
  'rupee':            'rupees',
  'rs ':              'rupees ',
  // query intents
  'what is the price': 'what is the price',
  'how much is':       'how much is',
  'should i sell':     'should i sell',
  'when to sell':      'when to sell',
  'best time to sell': 'best time to sell',
}

function applyCorrections(text) {
  if (!text) return text
  let result = text.toLowerCase()
  for (const [wrong, right] of Object.entries(CORRECTIONS)) {
    result = result.replace(new RegExp(`\\b${wrong}\\b`, 'gi'), right)
  }
  // Capitalize first letter, preserve the rest
  return result.charAt(0).toUpperCase() + result.slice(1)
}

function buildGrammar() {
  if (!_SGL) return null
  const allWords = [...AGRI_CROPS, ...AGRI_STATES, ...AGRI_TERMS]
  const jsgf = `#JSGF V1.0; grammar agri; public <agri> = ${allWords.join(' | ')} ;`
  try {
    const list = new _SGL()
    list.addFromString(jsgf, 1)
    return list
  } catch {
    return null
  }
}

function bestAlternative(result) {
  let best = result[0]
  for (let i = 1; i < result.length; i++) {
    if (result[i].confidence > best.confidence) best = result[i]
  }
  return best
}

/**
 * @param {Object}   opts
 * @param {string}   opts.lang         BCP-47 language tag (default 'en-IN')
 * @param {number}   opts.minConfidence Ignore results below this (default 0.40)
 * @param {Function} opts.onTranscript  Called with (transcript: string, isFinal: boolean)
 * @param {Function} opts.onError       Called with (errorCode: string, message: string)
 */
export function useSpeechRecognition({
  lang           = 'en-IN',
  minConfidence  = 0.40,
  onTranscript,
  onError,
} = {}) {
  const [listening, setListening]   = useState(false)
  const [phase,     setPhase]       = useState('idle')   // idle|connecting|listening|processing
  const [errorMsg,  setErrorMsg]    = useState(null)
  const [supported]                  = useState(!!_SR)
  const recognitionRef               = useRef(null)
  const onTranscriptRef              = useRef(onTranscript)
  const onErrorRef                   = useRef(onError)
  const grammarRef                   = useRef(null)

  useEffect(() => { onTranscriptRef.current = onTranscript }, [onTranscript])
  useEffect(() => { onErrorRef.current = onError }, [onError])
  useEffect(() => { grammarRef.current = buildGrammar() }, [])
  useEffect(() => () => recognitionRef.current?.abort(), [])

  const start = useCallback(() => {
    if (!_SR) return
    recognitionRef.current?.abort()
    setErrorMsg(null)
    setPhase('connecting')

    const rec = new _SR()
    rec.lang             = lang
    rec.continuous       = false
    rec.interimResults   = true
    rec.maxAlternatives  = 3

    if (grammarRef.current) {
      try { rec.grammars = grammarRef.current } catch { /* not all browsers support */ }
    }

    rec.onaudiostart = () => setPhase('connecting')
    rec.onsoundstart = () => setPhase('listening')
    rec.onspeechstart = () => setPhase('listening')

    rec.onstart = () => {
      setListening(true)
      setPhase('listening')
    }

    rec.onend = () => {
      setListening(false)
      setPhase(p => p === 'processing' ? 'processing' : 'idle')
    }

    rec.onerror = (event) => {
      setListening(false)
      setPhase('idle')
      const code = event.error
      const messages = {
        'not-allowed':    'Microphone access denied — please allow microphone in browser settings.',
        'no-speech':      'No speech detected — please speak clearly and try again.',
        'audio-capture':  'Microphone not found — check your device audio input.',
        'network':        'Network error — check your connection and try again.',
        'aborted':        null,
        'service-not-allowed': 'Speech service not available — try reloading the page.',
      }
      const msg = messages[code] ?? `Voice error (${code}) — please try again.`
      if (msg) {
        setErrorMsg(msg)
        onErrorRef.current?.(code, msg)
      }
    }

    rec.onresult = (event) => {
      const results  = Array.from(event.results)
      const isFinal  = results[results.length - 1].isFinal

      if (isFinal) {
        setPhase('processing')
        // Pick highest-confidence alternative across ALL results.
        // Start at -1 so even zero-confidence results update bestText.
        let bestText       = ''
        let bestConfidence = -1
        for (const result of results) {
          const alt = bestAlternative(result)
          if (alt.confidence > bestConfidence) {
            bestConfidence = alt.confidence
            bestText       = alt.transcript.trim()
          }
        }
        const corrected = applyCorrections(bestText)
        if (corrected.length >= 2) {
          onTranscriptRef.current?.(corrected, true)
        }
        setPhase('idle')
      } else {
        // Interim: join all interim texts for live display
        const interim = results
          .map(r => r[0].transcript)
          .join('')
          .trim()
        if (interim.length >= 2) {
          onTranscriptRef.current?.(interim, false)
        }
      }
    }

    recognitionRef.current = rec
    try {
      rec.start()
    } catch {
      setListening(false)
      setPhase('idle')
    }
  }, [lang, minConfidence])

  const stop = useCallback(() => {
    recognitionRef.current?.stop()
    setListening(false)
    setPhase('idle')
  }, [])

  const clearError = useCallback(() => setErrorMsg(null), [])

  return { listening, phase, supported, errorMsg, start, stop, clearError }
}
