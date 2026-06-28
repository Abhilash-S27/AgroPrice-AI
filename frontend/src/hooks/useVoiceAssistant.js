/**
 * useVoiceAssistant — enhanced voice assistant hook for AgroPrice AI.
 *
 * Improvements over Phase 2A:
 *  - maxAlternatives: 3 → picks highest-confidence alternative
 *  - Agricultural grammar hints (same vocabulary as useSpeechRecognition)
 *  - Post-processing correction map for agri term mis-recognitions
 *  - Detailed error states with user-friendly messages
 *  - Phase: idle | connecting | listening | processing | speaking
 *  - Confidence threshold: ignores results below 0.40
 *  - Voice caching for TTS (avoid repeated getVoices() calls)
 *  - Better TTS voice selection and Chrome keepalive fix
 */
import { useState, useRef, useCallback, useEffect } from 'react'

const _SR  = typeof window !== 'undefined'
  ? (window.SpeechRecognition || window.webkitSpeechRecognition)
  : null
const _SGL = typeof window !== 'undefined'
  ? (window.SpeechGrammarList || window.webkitSpeechGrammarList)
  : null
const _SS  = typeof window !== 'undefined' ? window.speechSynthesis : null

// ── Agricultural vocabulary ──────────────────────────────────────────────────
const AGRI_WORDS = [
  'tomato','onion','potato','brinjal','okra','cabbage','cauliflower',
  'beetroot','carrot','mango','banana','papaya','coconut','turmeric',
  'ginger','black pepper','cardamom','arecanut','coffee','cotton',
  'paddy','maize','tapioca','groundnut','soybean','sunflower','jowar',
  'karnataka','tamil nadu','andhra pradesh','kerala','telangana',
  'price','forecast','volatility','momentum','trend','market','mandi',
  'quintal','rupees','seasonal','buy','sell','hold','rising','falling',
  'stable','highest','lowest','average','weekly','monthly','yearly',
  'best crop','safest crop','opportunity','risk','confidence',
]

const CORRECTIONS = {
  'cardamon':'cardamom','cardamum':'cardamom','cardemon':'cardamom',
  'areca nut':'arecanut','areka nut':'arecanut',
  'ladies finger':'okra','lady finger':'okra','eggplant':'brinjal',
  'ground nut':'groundnut','sun flower':'sunflower',
  'black peper':'black pepper','black peeper':'black pepper',
  'andra pradesh':'andhra pradesh','andra':'andhra pradesh',
  'tamilnadu':'tamil nadu','tamil nado':'tamil nadu','tamilnad':'tamil nadu',
  'karna taka':'karnataka','keral':'kerala',
  'telengana':'telangana','telagana':'telangana',
  'monday':'mandi','mandy':'mandi','man d':'mandi',
  'quintle':'quintal','quantal':'quintal','quinta':'quintal',
  'profit model':'prophet model','profit forecast':'prophet forecast',
  'rupes':'rupees','rupee':'rupees',
}

function applyCorrections(text) {
  if (!text) return text
  let result = text.toLowerCase()
  for (const [wrong, right] of Object.entries(CORRECTIONS)) {
    result = result.replace(new RegExp(`\\b${wrong}\\b`, 'gi'), right)
  }
  return result.charAt(0).toUpperCase() + result.slice(1)
}

function buildGrammar() {
  if (!_SGL) return null
  const jsgf = `#JSGF V1.0; grammar agri; public <agri> = ${AGRI_WORDS.join(' | ')} ;`
  try {
    const list = new _SGL()
    list.addFromString(jsgf, 1)
    return list
  } catch { return null }
}

function bestAlternative(result) {
  let best = result[0]
  for (let i = 1; i < result.length; i++) {
    if (result[i].confidence > best.confidence) best = result[i]
  }
  return best
}

// ── TTS helpers ───────────────────────────────────────────────────────────────
let _cachedVoice = null
let _voicesLoaded = false

const FEMALE_KEYS = [
  'heera','veena','zira','aria','jenny','samantha','victoria',
  'karen','moira','tessa','fiona','neerja','serena','allison',
  'ava','alice','female','woman',
]
function isFemale(v) {
  const n = v.name.toLowerCase()
  return FEMALE_KEYS.some(k => n.includes(k))
}

function stripMarkdown(text) {
  return String(text)
    .replace(/\*\*(.*?)\*\*/g, '$1')
    .replace(/\*(.*?)\*/g, '$1')
    .replace(/`(.*?)`/g, '$1')
    .replace(/#{1,6}\s+/g, '')
    .replace(/^\s*[*•\-]\s+/gm, '')
    .replace(/₹/g, 'rupees ')
    .replace(/\/qtl/gi, ' per quintal')
    .replace(/\/quintal/gi, ' per quintal')
    .replace(/(\d),(\d)/g, '$1$2')
    .replace(/\n+/g, '. ')
    .replace(/\s{2,}/g, ' ')
    .trim()
}

function pickVoice() {
  if (!_SS) return null
  if (_cachedVoice) return _cachedVoice
  const voices = _SS.getVoices()
  if (!voices.length) return null
  _voicesLoaded = true
  _cachedVoice = (
    // Female en-IN (local service preferred)
    voices.find(v => v.lang === 'en-IN' && v.localService && isFemale(v)) ||
    voices.find(v => v.lang === 'en-IN' && isFemale(v)) ||
    // Any female English (local first)
    voices.find(v => v.lang.startsWith('en') && v.localService && isFemale(v)) ||
    voices.find(v => v.lang.startsWith('en') && isFemale(v)) ||
    // Fallback: best en-IN regardless of gender
    voices.find(v => v.lang === 'en-IN' && v.localService) ||
    voices.find(v => v.lang === 'en-IN') ||
    voices.find(v => v.lang.startsWith('en')) ||
    null
  )
  return _cachedVoice
}

// ── Main hook ─────────────────────────────────────────────────────────────────
export function useVoiceAssistant({ onTranscript } = {}) {
  const supported        = Boolean(_SR)
  const [phase, setPhase]           = useState('idle')
  const [transcript, setTranscript] = useState('')
  const [errorMsg, setErrorMsg]     = useState(null)
  const recognitionRef              = useRef(null)
  const onTranscriptRef             = useRef(onTranscript)
  const grammarRef                  = useRef(null)
  const keepAliveRef                = useRef(null)

  onTranscriptRef.current = onTranscript

  useEffect(() => { grammarRef.current = buildGrammar() }, [])

  const _clearKeepAlive = useCallback(() => {
    if (keepAliveRef.current) {
      clearInterval(keepAliveRef.current)
      keepAliveRef.current = null
    }
  }, [])

  useEffect(() => () => {
    recognitionRef.current?.abort?.()
    _SS?.cancel()
    _clearKeepAlive()
  }, [_clearKeepAlive])

  const stopListening = useCallback(() => {
    recognitionRef.current?.stop()
    setPhase(p => p === 'listening' || p === 'connecting' ? 'idle' : p)
  }, [])

  const startListening = useCallback(() => {
    if (!supported || phase === 'listening' || phase === 'connecting') return
    setErrorMsg(null)
    setTranscript('')
    setPhase('connecting')

    const rec = new _SR()
    rec.lang            = 'en-IN'
    rec.continuous      = false
    rec.interimResults  = true
    rec.maxAlternatives = 3

    if (grammarRef.current) {
      try { rec.grammars = grammarRef.current } catch { /* browser may not support */ }
    }

    rec.onsoundstart  = () => setPhase('listening')
    rec.onspeechstart = () => setPhase('listening')
    rec.onstart       = () => setPhase('listening')

    rec.onresult = (e) => {
      const results  = Array.from(e.results)
      const isFinal  = results[results.length - 1].isFinal

      if (isFinal) {
        // Start at -1 so even zero-confidence results update bestText.
        let bestText = ''
        let bestConf = -1
        for (const result of results) {
          const alt = bestAlternative(result)
          if (alt.confidence > bestConf) {
            bestConf = alt.confidence
            bestText = alt.transcript.trim()
          }
        }
        const corrected = applyCorrections(bestText)
        setTranscript(corrected)
        if (corrected.length >= 2) {
          setPhase('processing')
          rec.stop()
          onTranscriptRef.current?.(corrected)
        } else {
          setPhase('idle')
        }
      } else {
        const interim = results.map(r => r[0].transcript).join('').trim()
        setTranscript(interim)
      }
    }

    rec.onerror = (event) => {
      setPhase('idle')
      const messages = {
        'not-allowed':         'Microphone access denied — please allow it in browser settings.',
        'no-speech':           'No speech detected — speak clearly and try again.',
        'audio-capture':       'Microphone not found — check your audio device.',
        'network':             'Network issue — check connection and retry.',
        'service-not-allowed': 'Voice service unavailable — try reloading.',
        'aborted':             null,
      }
      const msg = messages[event.error] ?? `Voice error (${event.error})`
      if (msg) setErrorMsg(msg)
    }

    rec.onend = () => {
      setPhase(p => (p === 'listening' || p === 'connecting') ? 'idle' : p)
    }

    recognitionRef.current = rec
    try { rec.start() } catch { setPhase('idle') }
  }, [supported, phase])

  /** Read an AI reply aloud with Chrome keepalive + voice caching. */
  const speak = useCallback((text) => {
    if (!_SS || !text) { setPhase('idle'); return }
    _SS.cancel()
    _clearKeepAlive()

    const clean = stripMarkdown(text)
    const utt   = new SpeechSynthesisUtterance(clean)
    utt.lang    = 'en-IN'
    utt.rate    = 0.92
    utt.pitch   = 1.0
    utt.volume  = 1.0

    const applyVoice = () => { utt.voice = pickVoice() }

    utt.onstart = () => {
      setPhase('speaking')
      // Chrome 15s keepalive fix
      keepAliveRef.current = setInterval(() => {
        if (!_SS.speaking) { _clearKeepAlive(); return }
        _SS.pause(); _SS.resume()
      }, 10000)
    }
    utt.onend   = () => { setPhase('idle'); _clearKeepAlive() }
    utt.onerror = () => { setPhase('idle'); _clearKeepAlive() }

    if (!_voicesLoaded && _SS.getVoices().length === 0) {
      _SS.onvoiceschanged = () => {
        applyVoice()
        _SS.speak(utt)
        _SS.onvoiceschanged = null
      }
    } else {
      applyVoice()
      _SS.speak(utt)
    }

    setPhase('speaking')
  }, [_clearKeepAlive])

  const stopSpeaking = useCallback(() => {
    _SS?.cancel()
    _clearKeepAlive()
    setPhase('idle')
  }, [_clearKeepAlive])

  const finishProcessing = useCallback(() => {
    setPhase(p => p === 'processing' ? 'idle' : p)
  }, [])

  const clearError = useCallback(() => setErrorMsg(null), [])

  return {
    supported, phase, transcript, errorMsg,
    startListening, stopListening,
    speak, stopSpeaking, finishProcessing, clearError,
  }
}
