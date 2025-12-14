import api from './api'

export const reportService = {
  uploadReport: async (formData) => {
    const response = await api.post('/reports/upload', formData, {
      headers: {
        'Content-Type': 'multipart/form-data'
      }
    })
    return response.data
  },

  getMyReports: async () => {
    const response = await api.get('/reports/my-reports')
    return response.data
  },

  getReportById: async (reportId) => {
    const response = await api.get(`/reports/${reportId}`)
    return response.data
  },

  deleteReport: async (reportId) => {
    const response = await api.delete(`/reports/${reportId}`)
    return response.data
  },

  getPatientReports: async (patientId) => {
    const response = await api.get(`/reports/patient/${patientId}`)
    return response.data
  },

  getAllReports: async (filters = {}) => {
    const response = await api.get('/reports/all', { params: filters })
    return response.data
  },

  getAlerts: async () => {
    const response = await api.get('/alerts')
    return response.data
  }
}