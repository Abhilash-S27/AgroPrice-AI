/**
 * Decision Intelligence Service — Phase 5.
 * Calls /api/decision/* endpoints.
 */
import api from './api'

export const decisionService = {
  /** Full 7-agent council for one crop+state. */
  async getCouncil(crop, state) {
    const res = await api.get(`/api/decision/council/${encodeURIComponent(crop)}/${encodeURIComponent(state)}`)
    return res.data
  },

  /** Probabilistic outlook for one crop+state. */
  async getProbability(crop, state) {
    const res = await api.get(`/api/decision/probability/${encodeURIComponent(crop)}/${encodeURIComponent(state)}`)
    return res.data
  },

  /** Mode-specific strategic recommendation. */
  async getStrategy(crop, state, mode = 'general') {
    const res = await api.get(
      `/api/decision/strategy/${encodeURIComponent(crop)}/${encodeURIComponent(state)}`,
      { params: { mode } },
    )
    return res.data
  },

  /** Cross-market relationships for a crop. */
  async getRelationships(crop) {
    const res = await api.get(`/api/decision/relationships/${encodeURIComponent(crop)}`)
    return res.data
  },

  /** Multi-crop opportunity matrix. */
  async getOpportunities(maxCrops = 12) {
    const res = await api.get('/api/decision/opportunities', { params: { max_crops: maxCrops } })
    return res.data
  },

  /** Cross-crop executive synthesis. */
  async getExecutiveSummary(maxCrops = 8) {
    const res = await api.get('/api/decision/executive-summary', { params: { max_crops: maxCrops } })
    return res.data
  },
}
