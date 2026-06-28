/**
 * briefingService — Phase 2B AI Market Briefing & Scenario API
 */
import api from './api'

export const briefingService = {
  /** Full AI market briefing for crop+state (all 4 agents). */
  async getMarketBriefing(crop, state) {
    const res = await api.get(`/api/briefing/${encodeURIComponent(crop)}/${encodeURIComponent(state)}`)
    return res.data
  },

  /** Cross-crop proactive intelligence summary. */
  async getProactiveInsights(crops = []) {
    const params = crops.length ? `?crops=${crops.join(',')}` : ''
    const res = await api.get(`/api/briefing/proactive${params}`)
    return res.data
  },

  /** What-if scenario simulation. */
  async simulateScenario(crop, state, scenario) {
    const res = await api.post('/api/briefing/scenario', { crop, state, scenario })
    return res.data
  },
}
