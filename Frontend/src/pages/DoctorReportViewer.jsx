import React, { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import Layout from '../components/Layout'
import ReportCard from '../components/ReportCard'
import RiskBadge from '../components/RiskBadge'
import { reportService } from '../services/reportService'

const DoctorReportViewer = () => {
  const [reports, setReports] = useState([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [filterRisk, setFilterRisk] = useState('all')
  const [filterType, setFilterType] = useState('all')

  useEffect(() => {
    fetchReports()
  }, [])

  const fetchReports = async () => {
    try {
      setLoading(true)
      const response = await reportService.getAllReports()
      setReports(response.reports || [])
    } catch (error) {
      console.error('Failed to fetch reports:', error)
    } finally {
      setLoading(false)
    }
  }

  const filteredReports = reports.filter(report => {
    const matchesSearch = 
      report.fileName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      report.patient?.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      report.abnormalities?.some(a => a.toLowerCase().includes(searchTerm.toLowerCase()))

    const matchesRisk = filterRisk === 'all' || report.riskLevel === filterRisk
    const matchesType = filterType === 'all' || report.reportType === filterType

    return matchesSearch && matchesRisk && matchesType
  })

  const reportTypes = [...new Set(reports.map(r => r.reportType).filter(Boolean))]

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    })
  }

  return (
    <Layout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">All Reports</h1>
            <p className="text-gray-600">Review and analyze patient reports</p>
          </div>
          <div className="text-sm text-gray-500">
            {filteredReports.length} of {reports.length} reports
          </div>
        </div>

        {/* Filters */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {/* Search */}
            <div className="md:col-span-2">
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search by patient, file name, or abnormality..."
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
              />
            </div>

            {/* Risk Filter */}
            <div>
              <select
                value={filterRisk}
                onChange={(e) => setFilterRisk(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
              >
                <option value="all">All Risk Levels</option>
                <option value="high">High Risk</option>
                <option value="medium">Medium Risk</option>
                <option value="low">Low Risk</option>
              </select>
            </div>

            {/* Type Filter */}
            <div>
              <select
                value={filterType}
                onChange={(e) => setFilterType(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
              >
                <option value="all">All Report Types</option>
                {reportTypes.map((type) => (
                  <option key={type} value={type}>{type}</option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Reports Table */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
          {loading ? (
            <div className="text-center py-12">
              <div className="w-12 h-12 border-4 border-green-600 border-t-transparent rounded-full animate-spin mx-auto"></div>
              <p className="text-gray-500 mt-4">Loading reports...</p>
            </div>
          ) : filteredReports.length === 0 ? (
            <div className="text-center py-12">
              <div className="text-4xl mb-3">📭</div>
              <p className="text-gray-500">No reports found</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="text-left py-3 px-4 font-medium text-gray-600">Patient</th>
                    <th className="text-left py-3 px-4 font-medium text-gray-600">Report</th>
                    <th className="text-left py-3 px-4 font-medium text-gray-600">Type</th>
                    <th className="text-left py-3 px-4 font-medium text-gray-600">Risk</th>
                    <th className="text-left py-3 px-4 font-medium text-gray-600">Abnormalities</th>
                    <th className="text-left py-3 px-4 font-medium text-gray-600">Date</th>
                    <th className="text-left py-3 px-4 font-medium text-gray-600">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredReports.map((report) => (
                    <tr key={report._id} className="border-b border-gray-100 hover:bg-gray-50">
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center text-sm">
                            👤
                          </div>
                          <span className="font-medium text-gray-900">
                            {report.patient?.name || 'Unknown'}
                          </span>
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <span className="text-gray-900">{report.fileName}</span>
                      </td>
                      <td className="py-3 px-4">
                        <span className="px-2 py-1 bg-gray-100 text-gray-700 rounded text-xs">
                          {report.reportType}
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        <RiskBadge level={report.riskLevel} />
                      </td>
                      <td className="py-3 px-4">
                        {report.abnormalities?.length > 0 ? (
                          <span className="text-red-600 font-medium">
                            {report.abnormalities.length} found
                          </span>
                        ) : (
                          <span className="text-green-600">None</span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-gray-500 text-sm">
                        {formatDate(report.createdAt)}
                      </td>
                      <td className="py-3 px-4">
                        <Link
                          to={`/report/${report._id}`}
                          className="bg-green-600 text-white px-3 py-1 rounded text-sm hover:bg-green-700"
                        >
                          View
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </Layout>
  )
}

export default DoctorReportViewer