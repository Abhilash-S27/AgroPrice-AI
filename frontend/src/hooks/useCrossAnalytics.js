import { useState, useEffect } from 'react'
import api from '@services/api'

/**
 * Fetches /api/prices/cross-crop-analytics once per mount.
 *
 * Returns per-crop analytics for all Phase 4 crops (Tier-1 + Tier-2 + Tier-3):
 *   data.crops[]        — per-crop: avg_price, volatility, momentum, seasonal phase, readiness
 *   data.market_leaders — highest_price, fastest_rising, most_stable, most_volatile, best_forecast
 *   data.computed_at    — computation date
 *
 * Backend cache: ~12s cold → ~10ms hot.
 */
export function useCrossAnalytics() {
  const [data,    setData]    = useState(null)
  const [loading, setLoading] = useState(true)
  const [error,   setError]   = useState(null)

  useEffect(() => {
    api.get('/api/prices/cross-crop-analytics')
      .then(res => setData(res.data))
      .catch(err => setError(err?.response?.data?.detail ?? err.message))
      .finally(() => setLoading(false))
  }, [])

  // Look up analytics for a specific crop by name
  const forCrop = (cropName) =>
    data?.crops?.find(c => c.crop === cropName) ?? null

  return { data, loading, error, forCrop }
}
