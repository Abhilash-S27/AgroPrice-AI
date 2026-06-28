import api from './api'

export const forecastService = {
  /**
   * Fetch tier-aware forecast for a crop+state combination.
   * GET /api/forecasts/by?crop=X&state=Y&days=N
   *
   * Query params (not path segments) because canonical crop names can
   * contain '/' — e.g. "Arecanut (Betelnut/Supari)". An encoded slash
   * (%2F) inside a path segment is rejected by the backend router with
   * 404 before any handler runs; query strings have no such problem.
   */
  async getForecast({ crop, state, days = 30 } = {}) {
    const res = await api.get('/api/forecasts/by', {
      params: { crop, state, days },
    })
    return res.data
  },

  /**
   * Fetch last `limit` days of daily-aggregated historical prices.
   * GET /api/prices/history?crop=X&state=Y&limit=N
   */
  async getPriceHistory({ crop, state, limit = 120 } = {}) {
    const res = await api.get('/api/prices/history', {
      params: { crop, state, limit },
    })
    return res.data
  },
}
