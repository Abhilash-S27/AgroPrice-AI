import { useState, useEffect } from 'react'
import api from '@services/api'

/**
 * Fetches /api/forecasts/coverage — category-grouped forecast tier registry.
 *
 * On cold start the backend returns a registry stub (legacy Tier-1 crops
 * marked forecastable); once cross-crop analytics is warm the full
 * tier matrix replaces it.
 *
 * Provides:
 *   crops           — all supported crops with tier + diagnostics
 *   categories      — [{key, label, crops:[...]}] for grouped dropdowns
 *   tierCounts      — {A, B, C, D}
 *   forecastEnabled — Tier A crops   (full Prophet)
 *   limitedForecast — Tier B crops   (moderate Prophet)
 *   sparseTrend     — Tier C crops   (trend-estimation fallback)
 *   analyticsOnly   — Tier D crops   (no forecast)
 *   allEligible     — A + B + C      (anything that renders a forecast line)
 *   forCrop(name)   — lookup a single crop's coverage record
 */
export function useForecastCoverage() {
  const [data,    setData]    = useState(null)
  const [loading, setLoading] = useState(true)
  const [error,   setError]   = useState(null)

  useEffect(() => {
    api.get('/api/forecasts/coverage')
      .then(res => setData(res.data))
      .catch(err => setError(err?.response?.data?.detail ?? err.message))
      .finally(() => setLoading(false))
  }, [])

  const crops      = data?.crops ?? []
  const categories = data?.categories ?? []
  const tierCounts = data?.tier_counts ?? null

  const forecastEnabled = crops.filter(c => c.tier === 'A')
  const limitedForecast = crops.filter(c => c.tier === 'B')
  const sparseTrend     = crops.filter(c => c.tier === 'C')
  const analyticsOnly   = crops.filter(c => c.tier === 'D')
  const allEligible     = [...forecastEnabled, ...limitedForecast, ...sparseTrend]

  const forCrop = (name) => crops.find(c => c.crop === name) ?? null

  return {
    data,
    loading,
    error,
    crops,
    categories,
    tierCounts,
    forecastEnabled,
    limitedForecast,
    sparseTrend,
    analyticsOnly,
    allEligible,
    forCrop,
  }
}
