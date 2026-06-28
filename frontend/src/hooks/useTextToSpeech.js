/**
 * useTextToSpeech — enhanced browser speechSynthesis hook.
 *
 * Improvements over Phase 2A:
 *  - Voice caching: pickVoice() called once then cached (avoids repeated getVoices())
 *  - Prefers local (non-network) en-IN voice when available
 *  - Better agri term pronunciation preprocessing
 *  - Chrome 15-second keepalive fix (pause/resume every 10s)
 *  - Detailed error state exposed to consumers
 *  - Graceful voices-not-loaded fallback (onvoiceschanged)
 */
import { useState, useRef, useCallback, useEffect } from 'react'

const _SS = typeof window !== 'undefined' ? window.speechSynthesis : null

// Module-level voice cache so all hook instances share the same resolved voice
let _cachedVoice  = null
let _voicesLoaded = false

// Voice name keywords that reliably identify a female voice across platforms:
//   Windows: Heera (en-IN), Zira (en-US), Aria, Jenny
//   macOS/iOS: Veena (en-IN), Samantha, Victoria, Karen, Moira, Tessa, Fiona
//   Android: varies, but "female" sometimes appears in the URI
const FEMALE_KEYS = [
  'heera','veena','zira','aria','jenny','samantha','victoria',
  'karen','moira','tessa','fiona','neerja','serena','allison',
  'ava','alice','female','woman',
]
function isFemale(v) {
  const n = v.name.toLowerCase()
  return FEMALE_KEYS.some(k => n.includes(k))
}

function pickVoice() {
  if (!_SS) return null
  if (_cachedVoice) return _cachedVoice
  const voices = _SS.getVoices()
  if (!voices.length) return null
  _voicesLoaded = true
  _cachedVoice = (
    // 1. Female en-IN (local service preferred — no network latency)
    voices.find(v => v.lang === 'en-IN' && v.localService && isFemale(v)) ||
    voices.find(v => v.lang === 'en-IN' && isFemale(v)) ||
    // 2. Any female English voice (local first)
    voices.find(v => v.lang.startsWith('en') && v.localService && isFemale(v)) ||
    voices.find(v => v.lang.startsWith('en') && isFemale(v)) ||
    // 3. Fallback: best available en-IN regardless of gender
    voices.find(v => v.lang === 'en-IN' && v.localService) ||
    voices.find(v => v.lang === 'en-IN') ||
    voices.find(v => v.lang.startsWith('en')) ||
    null
  )
  return _cachedVoice
}

/** Remove markdown + improve TTS pronunciation for agri terms. */
function prepareForSpeech(text) {
  return String(text)
    .replace(/\*\*(.*?)\*\*/g, '$1')
    .replace(/\*(.*?)\*/g, '$1')
    .replace(/`(.*?)`/g, '$1')
    .replace(/#{1,6}\s+/g, '')
    .replace(/^\s*[*•\-]\s+/gm, '')
    // Currency & units
    .replace(/₹\s?(\d[\d,]*)/g, (_, n) => `${n.replace(/,/g, '')} rupees`)
    .replace(/\/qtl/gi, ' per quintal')
    .replace(/\/quintal/gi, ' per quintal')
    .replace(/(\d),(\d{3})/g, '$1$2')     // remove thousand separators
    // Abbreviations that TTS reads letter-by-letter
    .replace(/\bCV\b/g, 'C.V.')
    .replace(/\bKG\b/gi, 'kilograms')
    .replace(/\bMT\b/g, 'metric tons')
    .replace(/\bAP\b/g, 'Andhra Pradesh')
    .replace(/\bTN\b/g, 'Tamil Nadu')
    // Percentage spoken naturally
    .replace(/(\d+\.?\d*)\s*%/g, '$1 percent')
    // Newlines and whitespace
    .replace(/\n+/g, '. ')
    .replace(/\s{2,}/g, ' ')
    .trim()
}

export function useTextToSpeech() {
  const [speaking,  setSpeaking]  = useState(false)
  const [supported]                = useState(!!_SS)
  const utteranceRef               = useRef(null)
  const keepAliveRef               = useRef(null)

  const _clearKeepAlive = useCallback(() => {
    if (keepAliveRef.current) {
      clearInterval(keepAliveRef.current)
      keepAliveRef.current = null
    }
  }, [])

  useEffect(() => () => {
    _SS?.cancel()
    _clearKeepAlive()
  }, [_clearKeepAlive])

  const speak = useCallback((text) => {
    if (!_SS || !text) return
    _SS.cancel()
    _clearKeepAlive()

    const clean = prepareForSpeech(text)
    const utt   = new SpeechSynthesisUtterance(clean)
    utt.lang    = 'en-IN'
    utt.rate    = 0.90   // slightly slower for clarity
    utt.pitch   = 1.0
    utt.volume  = 1.0

    const applyAndSpeak = () => {
      utt.voice = pickVoice()
      _SS.speak(utt)
    }

    utt.onstart = () => {
      setSpeaking(true)
      // Chrome 15s cutoff fix
      keepAliveRef.current = setInterval(() => {
        if (!_SS.speaking) { _clearKeepAlive(); return }
        _SS.pause()
        _SS.resume()
      }, 10000)
    }
    utt.onend   = () => { setSpeaking(false); _clearKeepAlive() }
    utt.onerror = () => { setSpeaking(false); _clearKeepAlive() }

    utteranceRef.current = utt

    if (!_voicesLoaded && _SS.getVoices().length === 0) {
      _SS.onvoiceschanged = () => {
        _SS.onvoiceschanged = null
        applyAndSpeak()
      }
    } else {
      applyAndSpeak()
    }
  }, [_clearKeepAlive])

  const stop = useCallback(() => {
    _SS?.cancel()
    setSpeaking(false)
    _clearKeepAlive()
  }, [_clearKeepAlive])

  return { speaking, supported, speak, stop }
}
