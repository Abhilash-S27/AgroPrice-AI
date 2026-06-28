import api from './api'

export const reportService = {
  async downloadPdf({ crop, state, period = 'monthly' }) {
    const params = { crop, period }
    if (state) params.state = state
    const res = await api.get('/api/reports/pdf', { params, responseType: 'blob' })
    _triggerDownload(res.data, `${crop}_report.pdf`)
  },

  async downloadExcel({ crop, state }) {
    const params = { crop }
    if (state) params.state = state
    const res = await api.get('/api/reports/excel', { params, responseType: 'blob' })
    _triggerDownload(res.data, `${crop}_report.xlsx`)
  },
}

function _triggerDownload(blob, filename) {
  const url = window.URL.createObjectURL(new Blob([blob]))
  const link = document.createElement('a')
  link.href = url
  link.setAttribute('download', filename)
  document.body.appendChild(link)
  link.click()
  link.remove()
  window.URL.revokeObjectURL(url)
}
