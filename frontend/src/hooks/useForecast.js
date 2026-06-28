import { useState, useEffect, useRef } from 'react'
import { forecastService } from '@services/forecastService'

/**
 * Fetches Prophet forecast + historical prices.
 *
 * Phase 4B: `forecastEnabled` flag separates history from forecast fetches.
 *   - forecastEnabled=true  (default) → fetch both forecast + history
 *   - forecastEnabled=false            → fetch history only (analytics mode)
 *
 * Loading strategy:
 *   - First load  → loading=true  (show full-page spinner)
 *   - Refetch     → isRefetching=true (keep existing chart, show inline spinner)
 */
export function useForecast({ crop, state, days = 30, forecastEnabled = true } = {}) {
  const [forecast,      setForecast]      = useState(null)
  const [history,       setHistory]       = useState([])
  const [loading,       setLoading]       = useState(true)
  const [isRefetching,  setIsRefetching]  = useState(false)
  const [error,         setError]         = useState(null)

  const initializedRef = useRef(false)

  useEffect(() => {
    if (!crop || !state) return

    let cancelled = false

    if (initializedRef.current) {
      setIsRefetching(true)
      setError(null)
    } else {
      setLoading(true)
      setError(null)
    }

    async function load() {
      try {
        // History is always fetched; forecast only when enabled.
        // allSettled so a forecast 422 doesn't swallow history data.
        const [fcResult, histResult] = await Promise.allSettled([
          forecastEnabled
            ? forecastService.getForecast({ crop, state, days })
            : Promise.resolve(null),
          forecastService.getPriceHistory({ crop, state, limit: 120 }),
        ])

        if (!cancelled) {
          // History — set regardless (empty array if failed)
          setHistory(
            histResult.status === 'fulfilled' ? (histResult.value ?? []) : []
          )

          // Forecast — only set/error if it was attempted
          if (fcResult.status === 'fulfilled') {
            setForecast(fcResult.value)
          } else if (forecastEnabled) {
            setError(
              fcResult.reason?.response?.data?.detail ??
              fcResult.reason?.message ??
              'Forecast failed'
            )
          }

          initializedRef.current = true
        }
      } catch (err) {
        if (!cancelled) {
          setError(err?.message ?? 'Load failed')
        }
      } finally {
        if (!cancelled) {
          setLoading(false)
          setIsRefetching(false)
        }
      }
    }

    load()
    return () => { cancelled = true }
  }, [crop, state, days, forecastEnabled])

  return { forecast, history, loading, isRefetching, error }
}
