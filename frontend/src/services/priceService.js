import api from './api'

export const priceService = {
  async getPrices({ crop, state, startDate, endDate, limit = 100 }) {
    const params = { crop, limit }
    if (state)     params.state = state
    if (startDate) params.start_date = startDate
    if (endDate)   params.end_date = endDate
    const res = await api.get('/api/prices/', { params })
    return res.data
  },

  async getPriceSummary({ crop, state }) {
    const params = { crop }
    if (state) params.state = state
    const res = await api.get('/api/prices/summary', { params })
    return res.data
  },

  async getLatestPrices(crops = []) {
    const res = await api.get('/api/prices/latest', { params: { crops } })
    return res.data
  },
}
