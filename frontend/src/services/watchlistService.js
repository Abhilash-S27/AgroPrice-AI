/**
 * watchlistService.js — Phase 4A
 * API client for the AI Market Watchlist endpoint.
 */

const BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8001'

export async function getWatchlist(maxCrops = 8) {
  const res = await fetch(`${BASE}/api/watchlist?max_crops=${maxCrops}`)
  if (!res.ok) throw new Error(`Watchlist API error ${res.status}`)
  return res.json()
}
