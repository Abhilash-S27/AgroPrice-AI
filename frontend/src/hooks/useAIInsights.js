import { useState, useEffect, useRef } from 'react'
import { aiService } from '@services/aiService'

// Module-level memo: insights are deterministic per (crop, state, days),
// so a session-long cache avoids refetching while flipping between crops.
const insightCache = new Map()

/**
 * Fetches the AI insight bundle for the selected crop/state/horizon.
 * Refetch-safe: keeps the previous bundle visible while a new one loads
 * (isRefetching), mirroring useForecast's loading strategy.
 */
export function useAIInsights({ crop, state, days = 30 } = {}) {
  const [insights,     setInsights]     = useState(null)
  const [loading,      setLoading]      = useState(true)
  const [isRefetching, setIsRefetching] = useState(false)
  const [error,        setError]        = useState(null)
  const initializedRef = useRef(false)

  useEffect(() => {
    if (!crop || !state) return
    const key = `${crop}|${state}|${days}`

    if (insightCache.has(key)) {
      setInsights(insightCache.get(key))
      setLoading(false)
      setIsRefetching(false)
      setError(null)
      initializedRef.current = true
      return
    }

    let cancelled = false
    if (initializedRef.current) setIsRefetching(true)
    else setLoading(true)
    setError(null)

    aiService.getInsights({ crop, state, days })
      .then(data => {
        if (cancelled) return
        insightCache.set(key, data)
        setInsights(data)
        initializedRef.current = true
      })
      .catch(err => {
        if (!cancelled) setError(err?.response?.data?.detail ?? err.message)
      })
      .finally(() => {
        if (!cancelled) { setLoading(false); setIsRefetching(false) }
      })

    return () => { cancelled = true }
  }, [crop, state, days])

  return { insights, loading, isRefetching, error }
}
