import api from './api'

export const authService = {
  registerPatient: async (patientData) => {
    const response = await api.post('/auth/register/patient', patientData)
    return response.data
  },

  registerDoctor: async (doctorData) => {
    const response = await api.post('/auth/register/doctor', doctorData)
    return response.data
  },

  login: async (email, password, userType) => {
    const response = await api.post('/auth/login', {
      email,
      password,
      userType
    })
    return response.data
  },

  logout: async () => {
    const response = await api.post('/auth/logout')
    return response.data
  },

  getProfile: async () => {
    const response = await api.get('/auth/profile')
    return response.data
  }
}