import { useState, useEffect } from 'react'
import api from '@services/api'

/**
 * Fetches /api/prices/analytics once per component mount.
 *
 * The backend caches the result in memory (TTL = 24h), so:
 *   - First call in a session: ~800ms (5 DuckDB scans)
 *   - All subsequent calls:    ~9ms (memory cache hit)
 *
 * Returns:
 *   analytics.anomalies[]      — price spike/crash events (last 90 days)
 *   analytics.volatility[]     — CV ranking + badge per crop
 *   analytics.seasonal[]       — monthly profile + current phase per crop
 *   analytics.momentum[]       — 7d momentum signal per crop
 *   analytics.forecast_quality[] — reliability score per crop+state
 */
export function useAnalytics() {
  const [analytics, setAnalytics] = useState(null)
  const [loading,   setLoading]   = useState(true)
  const [error,     setError]     = useState(null)

  useEffect(() => {
    api.get('/api/prices/analytics')
      .then(res => setAnalytics(res.data))
      .catch(err => setError(err?.response?.data?.detail ?? err.message))
      .finally(() => setLoading(false))
  }, [])

  // Convenience: look up analytics for a specific crop
  const forCrop = (crop) => ({
    anomalies:       (analytics?.anomalies        ?? []).filter(a => a.crop === crop),
    volatility:       analytics?.volatility?.find(v  => v.crop === crop) ?? null,
    seasonal:         analytics?.seasonal?.find(s    => s.crop === crop) ?? null,
    momentum:         analytics?.momentum?.find(m    => m.crop === crop) ?? null,
    forecastQuality:  analytics?.forecast_quality?.find(q => q.crop === crop) ?? null,
  })

  return { analytics, loading, error, forCrop }
}
