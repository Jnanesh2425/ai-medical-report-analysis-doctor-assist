import React, { useState, useEffect, useContext } from 'react'
import { Link } from 'react-router-dom'
import Layout from '../components/Layout'
import { AuthContext } from '../context/AuthContext'
import api from '../services/api'

const ViewPatients = () => {
  const { user } = useContext(AuthContext)
  const [patients, setPatients] = useState([])
  const [loading, setLoading] = useState(true)
  const [selectedPatient, setSelectedPatient] = useState(null)
  const [patientReports, setPatientReports] = useState([])
  const [loadingReports, setLoadingReports] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')

  useEffect(() => {
    fetchPatients()
  }, [])

  const fetchPatients = async () => {
    try {
      setLoading(true)
      const response = await api.get('/auth/my-patients')
      setPatients(response.data.patients || [])
    } catch (error) {
      console.error('Failed to fetch patients:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleSelectPatient = async (patient) => {
    setSelectedPatient(patient)
    setLoadingReports(true)
    try {
      const response = await api.get(`/reports/patient/${patient._id}`)
      setPatientReports(response.data.reports || [])
    } catch (error) {
      console.error('Failed to fetch patient reports:', error)
      setPatientReports([])
    } finally {
      setLoadingReports(false)
    }
  }

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    })
  }

  const getRiskBadgeColor = (level) => {
    switch(level) {
      case 'high': return 'bg-red-100 text-red-700 border-red-200'
      case 'medium': return 'bg-yellow-100 text-yellow-700 border-yellow-200'
      case 'low': return 'bg-green-100 text-green-700 border-green-200'
      default: return 'bg-gray-100 text-gray-700 border-gray-200'
    }
  }

  const filteredPatients = patients.filter(patient =>
    patient.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    patient.email?.toLowerCase().includes(searchTerm.toLowerCase())
  )

  return (
    <Layout>
      <div className="space-y-6">
        {/* Header */}
        <div className="bg-gradient-to-r from-green-600 to-green-700 rounded-xl p-6 text-white">
          <h1 className="text-2xl font-bold mb-2">👥 My Patients</h1>
          <p className="text-green-100">View and manage your registered patients</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Patient List */}
          <div className="lg:col-span-1 bg-white rounded-lg shadow-sm border border-gray-200">
            <div className="p-4 border-b border-gray-200">
              <h2 className="text-lg font-semibold text-gray-900 mb-3">Patient List</h2>
              <input
                type="text"
                placeholder="Search patients..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 text-sm"
              />
            </div>
            
            <div className="max-h-[500px] overflow-y-auto">
              {loading ? (
                <div className="p-8 text-center">
                  <div className="w-8 h-8 border-4 border-green-600 border-t-transparent rounded-full animate-spin mx-auto"></div>
                  <p className="text-gray-500 mt-2">Loading patients...</p>
                </div>
              ) : filteredPatients.length === 0 ? (
                <div className="p-8 text-center">
                  <div className="text-4xl mb-2">👤</div>
                  <p className="text-gray-500">No patients found</p>
                  <p className="text-xs text-gray-400 mt-1">Patients will appear here when they register with your code</p>
                </div>
              ) : (
                filteredPatients.map((patient) => (
                  <div
                    key={patient._id}
                    onClick={() => handleSelectPatient(patient)}
                    className={`p-4 border-b border-gray-100 cursor-pointer hover:bg-gray-50 transition-colors ${
                      selectedPatient?._id === patient._id ? 'bg-green-50 border-l-4 border-l-green-500' : ''
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center text-green-600 font-semibold">
                        {patient.name?.charAt(0).toUpperCase()}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-gray-900 truncate">{patient.name}</p>
                        <p className="text-xs text-gray-500 truncate">{patient.email}</p>
                      </div>
                    </div>
                    {patient.phone && (
                      <p className="text-xs text-gray-400 mt-1 ml-13">📞 {patient.phone}</p>
                    )}
                  </div>
                ))
              )}
            </div>
            
            <div className="p-3 border-t border-gray-200 bg-gray-50">
              <p className="text-xs text-gray-500 text-center">
                Total: {filteredPatients.length} patient{filteredPatients.length !== 1 ? 's' : ''}
              </p>
            </div>
          </div>

          {/* Patient Details & Reports */}
          <div className="lg:col-span-2 space-y-4">
            {selectedPatient ? (
              <>
                {/* Patient Info Card */}
                <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-4">
                      <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center text-green-600 text-2xl font-bold">
                        {selectedPatient.name?.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <h2 className="text-xl font-bold text-gray-900">{selectedPatient.name}</h2>
                        <p className="text-gray-500">{selectedPatient.email}</p>
                        {selectedPatient.phone && (
                          <p className="text-sm text-gray-400">📞 {selectedPatient.phone}</p>
                        )}
                      </div>
                    </div>
                    <Link
                      to={`/doctor/chat?patient=${selectedPatient._id}`}
                      className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition-colors flex items-center gap-2"
                    >
                      💬 Chat
                    </Link>
                  </div>
                  
                  <div className="grid grid-cols-3 gap-4 mt-6 pt-4 border-t border-gray-200">
                    <div className="text-center">
                      <p className="text-2xl font-bold text-gray-900">{patientReports.length}</p>
                      <p className="text-xs text-gray-500">Total Reports</p>
                    </div>
                    <div className="text-center">
                      <p className="text-2xl font-bold text-red-600">
                        {patientReports.filter(r => r.riskLevel === 'high').length}
                      </p>
                      <p className="text-xs text-gray-500">High Risk</p>
                    </div>
                    <div className="text-center">
                      <p className="text-2xl font-bold text-green-600">
                        {patientReports.filter(r => r.riskLevel === 'low').length}
                      </p>
                      <p className="text-xs text-gray-500">Low Risk</p>
                    </div>
                  </div>
                </div>

                {/* Patient Reports */}
                <div className="bg-white rounded-lg shadow-sm border border-gray-200">
                  <div className="p-4 border-b border-gray-200">
                    <h3 className="text-lg font-semibold text-gray-900">📄 Patient Reports</h3>
                  </div>
                  
                  <div className="p-4">
                    {loadingReports ? (
                      <div className="text-center py-8">
                        <div className="w-8 h-8 border-4 border-green-600 border-t-transparent rounded-full animate-spin mx-auto"></div>
                        <p className="text-gray-500 mt-2">Loading reports...</p>
                      </div>
                    ) : patientReports.length === 0 ? (
                      <div className="text-center py-8">
                        <div className="text-4xl mb-2">📭</div>
                        <p className="text-gray-500">No reports uploaded yet</p>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {patientReports.map((report) => (
                          <Link
                            key={report._id}
                            to={`/report/${report._id}`}
                            className="block p-4 border border-gray-200 rounded-lg hover:border-green-400 hover:shadow-md transition-all"
                          >
                            <div className="flex items-center justify-between">
                              <div className="flex-1">
                                <div className="flex items-center gap-2">
                                  <span className="text-lg">📄</span>
                                  <p className="font-medium text-gray-900">{report.fileName || report.reportType}</p>
                                </div>
                                <p className="text-sm text-gray-500 mt-1">
                                  {report.reportType} • Uploaded {formatDate(report.createdAt)}
                                </p>
                                {report.analysis?.summary && (
                                  <p className="text-xs text-gray-400 mt-2 line-clamp-2">
                                    {report.analysis.summary}
                                  </p>
                                )}
                              </div>
                              <div className="ml-4">
                                <span className={`px-3 py-1 rounded-full text-xs font-medium border ${getRiskBadgeColor(report.riskLevel)}`}>
                                  {report.riskLevel?.toUpperCase() || 'N/A'}
                                </span>
                              </div>
                            </div>
                          </Link>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </>
            ) : (
              <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-12 text-center">
                <div className="text-6xl mb-4">👈</div>
                <h3 className="text-xl font-semibold text-gray-900 mb-2">Select a Patient</h3>
                <p className="text-gray-500">Click on a patient from the list to view their details and reports</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </Layout>
  )
}

export default ViewPatients
