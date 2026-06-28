/**
 * Axios instance — single source of truth for all API calls.
 * Base URL is read from VITE_API_BASE_URL environment variable.
 */
import axios from 'axios'

const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:8001',
  timeout: 30_000,
  headers: { 'Content-Type': 'application/json' },
})

// Log errors in development.
// A 422 from the forecast endpoint is an EXPECTED domain response for
// analytics-only crop+state pairs (the UI renders its regional-intelligence
// fallback) — logging it as an error would be noise, so it is skipped.
api.interceptors.response.use(
  res => res,
  err => {
    const expected422 =
      err?.response?.status === 422 &&
      String(err?.config?.url ?? '').includes('/api/forecasts/')
    if (import.meta.env.DEV && !expected422) {
      console.error('[API Error]', err?.response?.status, err?.config?.url, err?.response?.data)
    }
    return Promise.reject(err)
  }
)

export default api
