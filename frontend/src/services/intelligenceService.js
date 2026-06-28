/**
 * intelligenceService — Phase 4B
 * API client for /api/intelligence endpoints.
 */

const BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8001'

/**
 * GET /api/intelligence/monitor
 * Returns: { generated_at, crops_scanned, critical_alerts, high_attention,
 *             total_escalations, reversal_risks, regime_distribution,
 *             items[], executive_briefing[] }
 */
export async function getIntelligenceMonitor(maxCrops = 8) {
  const res = await fetch(`${BASE}/api/intelligence/monitor?max_crops=${maxCrops}`)
  if (!res.ok) throw new Error(`Intelligence API error ${res.status}`)
  return res.json()
}

/**
 * GET /api/intelligence/compare/{crop}/{state}
 * Returns: { safer_alternatives[], stronger_momentum[], seasonal_outperformers[] }
 */
export async function getStrategicComparison(crop, state) {
  const res = await fetch(
    `${BASE}/api/intelligence/compare/${encodeURIComponent(crop)}/${encodeURIComponent(state)}`
  )
  if (!res.ok) throw new Error(`Comparison API error ${res.status}`)
  return res.json()
}
