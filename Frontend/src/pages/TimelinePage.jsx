import React, { useState, useEffect } from 'react'
import Layout from '../components/Layout'
import TimelineGraph from '../components/TimelineGraph'
import RiskBadge from '../components/RiskBadge'
import { reportService } from '../services/reportService'

const TimelinePage = () => {
  const [reports, setReports] = useState([])
  const [patients, setPatients] = useState([])
  const [selectedPatient, setSelectedPatient] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchReports()
  }, [])

  const fetchReports = async () => {
    try {
      setLoading(true)
      const response = await reportService.getAllReports()
      const reportList = response.reports || []
      setReports(reportList)

      // Extract unique patients
      const uniquePatients = [...new Map(
        reportList.map(r => [r.patient?._id, r.patient])
      ).values()].filter(Boolean)
      setPatients(uniquePatients)
    } catch (error) {
      console.error('Failed to fetch reports:', error)
    } finally {
      setLoading(false)
    }
  }

  const filteredReports = selectedPatient
    ? reports.filter(r => r.patient?._id === selectedPatient._id)
    : reports

  const sortedReports = [...filteredReports].sort(
    (a, b) => new Date(b.createdAt) - new Date(a.createdAt)
  )

  const getRiskTrend = () => {
    if (sortedReports.length < 2) return 'stable'
    const recent = sortedReports[0]?.riskLevel
    const previous = sortedReports[1]?.riskLevel
    const riskOrder = { low: 1, medium: 2, high: 3 }
    
    if (riskOrder[recent] > riskOrder[previous]) return 'increasing'
    if (riskOrder[recent] < riskOrder[previous]) return 'decreasing'
    return 'stable'
  }

  const trend = getRiskTrend()

  return (
    <Layout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">📈 Patient Timeline</h1>
            <p className="text-gray-600">Track patient health progression over time</p>
          </div>
        </div>

        {/* Patient Selector */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Select Patient
          </label>
          <select
            value={selectedPatient?._id || ''}
            onChange={(e) => {
              const patient = patients.find(p => p._id === e.target.value)
              setSelectedPatient(patient || null)
            }}
            className="w-full md:w-64 px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
          >
            <option value="">All Patients</option>
            {patients.map((patient) => (
              <option key={patient._id} value={patient._id}>
                {patient.name}
              </option>
            ))}
          </select>
        </div>

        {/* Stats */}
        {selectedPatient && (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="bg-white rounded-lg p-4 shadow-sm border border-gray-200">
              <p className="text-sm text-gray-500">Patient</p>
              <p className="text-lg font-bold text-gray-900">{selectedPatient.name}</p>
            </div>
            <div className="bg-white rounded-lg p-4 shadow-sm border border-gray-200">
              <p className="text-sm text-gray-500">Total Reports</p>
              <p className="text-2xl font-bold text-gray-900">{sortedReports.length}</p>
            </div>
            <div className="bg-white rounded-lg p-4 shadow-sm border border-gray-200">
              <p className="text-sm text-gray-500">Latest Risk</p>
              {sortedReports[0] && <RiskBadge level={sortedReports[0].riskLevel} />}
            </div>
            <div className="bg-white rounded-lg p-4 shadow-sm border border-gray-200">
              <p className="text-sm text-gray-500">Trend</p>
              <p className={`text-lg font-bold capitalize ${
                trend === 'increasing' ? 'text-red-600' :
                trend === 'decreasing' ? 'text-green-600' :
                'text-gray-600'
              }`}>
                {trend === 'increasing' && '📈 '}
                {trend === 'decreasing' && '📉 '}
                {trend === 'stable' && '➡️ '}
                {trend}
              </p>
            </div>
          </div>
        )}

        {/* Timeline */}
        {loading ? (
          <div className="bg-white rounded-lg p-12 text-center">
            <div className="w-12 h-12 border-4 border-green-600 border-t-transparent rounded-full animate-spin mx-auto"></div>
            <p className="text-gray-500 mt-4">Loading timeline...</p>
          </div>
        ) : sortedReports.length === 0 ? (
          <div className="bg-white rounded-lg p-12 text-center">
            <div className="text-4xl mb-3">📭</div>
            <p className="text-gray-500">No reports to display</p>
          </div>
        ) : (
          <TimelineGraph reports={sortedReports} />
        )}

        {/* Risk Distribution */}
        {sortedReports.length > 0 && (
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Risk Distribution</h3>
            <div className="grid grid-cols-3 gap-4">
              <div className="text-center p-4 bg-red-50 rounded-lg">
                <p className="text-3xl font-bold text-red-600">
                  {sortedReports.filter(r => r.riskLevel === 'high').length}
                </p>
                <p className="text-sm text-red-600">High Risk</p>
              </div>
              <div className="text-center p-4 bg-yellow-50 rounded-lg">
                <p className="text-3xl font-bold text-yellow-600">
                  {sortedReports.filter(r => r.riskLevel === 'medium').length}
                </p>
                <p className="text-sm text-yellow-600">Medium Risk</p>
              </div>
              <div className="text-center p-4 bg-green-50 rounded-lg">
                <p className="text-3xl font-bold text-green-600">
                  {sortedReports.filter(r => r.riskLevel === 'low').length}
                </p>
                <p className="text-sm text-green-600">Low Risk</p>
              </div>
            </div>
          </div>
        )}
      </div>
    </Layout>
  )
}

export default TimelinePage