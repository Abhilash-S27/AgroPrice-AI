import { useState, useEffect } from 'react'
import api from '@services/api'

let cached = null   // session cache — the matrix is deterministic per day

/** crop×state metric grid from /api/ai/pair-matrix (heatmaps + matrix). */
export function usePairMatrix() {
  const [data, setData] = useState(cached)
  const [loading, setLoading] = useState(!cached)

  useEffect(() => {
    if (cached) return
    api.get('/api/ai/pair-matrix')
      .then(res => { cached = res.data; setData(res.data) })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  return { matrix: data, loading }
}
