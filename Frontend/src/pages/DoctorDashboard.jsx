import React, { useState, useEffect, useContext } from 'react'
import { Link } from 'react-router-dom'
import Layout from '../components/Layout'
import ReportCard from '../components/ReportCard'
import RiskBadge from '../components/RiskBadge'
import { AuthContext } from '../context/AuthContext'
import { reportService } from '../services/reportService'
import { socketService } from '../services/socketService'
import api from '../services/api'

const DoctorDashboard = () => {
  const { user, token } = useContext(AuthContext)
  const [reports, setReports] = useState([])
  const [patients, setPatients] = useState([])
  const [alerts, setAlerts] = useState([])
  const [loading, setLoading] = useState(true)
  const [stats, setStats] = useState({
    totalPatients: 0,
    totalReports: 0,
    highRisk: 0,
    pendingAlerts: 0
  })

  useEffect(() => {
    // First assign any unassigned patients to this doctor, then fetch data
    assignAndFetchData()
    setupSocket()

    return () => {
      socketService.off('newAlert')
      socketService.off('newReport')
    }
  }, [])

  const assignAndFetchData = async () => {
    try {
      // Assign unassigned patients to this doctor
      await api.post('/auth/assign-patients')
    } catch (error) {
      console.log('No unassigned patients or already assigned')
    }
    // Then fetch the data
    await fetchData()
  }

  const fetchData = async () => {
    try {
      setLoading(true)
      
      // Fetch patients, reports, and alerts in parallel
      const [patientsRes, reportsRes, alertsRes] = await Promise.all([
        api.get('/auth/my-patients'),
        reportService.getAllReports(),
        reportService.getAlerts()
      ])

      const patientList = patientsRes.data.patients || []
      const reportList = reportsRes.reports || []
      
      setPatients(patientList)
      setReports(reportList)
      setAlerts(alertsRes.alerts || [])

      // Calculate stats using actual patient count
      setStats({
        totalPatients: patientList.length,
        totalReports: reportList.length,
        highRisk: reportList.filter(r => r.riskLevel === 'high').length,
        pendingAlerts: (alertsRes.alerts || []).filter(a => !a.acknowledged).length
      })
    } catch (error) {
      console.error('Failed to fetch data:', error)
    } finally {
      setLoading(false)
    }
  }

  const setupSocket = () => {
    const socket = socketService.connect(token)

    socketService.on('newAlert', (alert) => {
      setAlerts(prev => [alert, ...prev])
      setStats(prev => ({ ...prev, pendingAlerts: prev.pendingAlerts + 1 }))
    })

    socketService.on('newReport', (report) => {
      setReports(prev => [report, ...prev])
      setStats(prev => ({ ...prev, totalReports: prev.totalReports + 1 }))
    })
  }

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  return (
    <Layout>
      <div className="space-y-6">
        {/* Welcome Header */}
        <div className="bg-gradient-to-r from-green-600 to-green-700 rounded-xl p-6 text-white">
          <h1 className="text-2xl font-bold mb-2">Welcome, Dr. {user?.name}! 👨‍⚕️</h1>
          <p className="text-green-100">Monitor your patients and review medical reports</p>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-white rounded-lg p-5 shadow-sm border border-gray-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">Total Patients</p>
                <p className="text-3xl font-bold text-gray-900">{stats.totalPatients}</p>
              </div>
              <div className="text-3xl">👥</div>
            </div>
          </div>

          <div className="bg-white rounded-lg p-5 shadow-sm border border-gray-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">Total Reports</p>
                <p className="text-3xl font-bold text-gray-900">{stats.totalReports}</p>
              </div>
              <div className="text-3xl">📋</div>
            </div>
          </div>

          <div className="bg-white rounded-lg p-5 shadow-sm border-l-4 border-red-500">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">High Risk</p>
                <p className="text-3xl font-bold text-red-600">{stats.highRisk}</p>
              </div>
              <div className="text-3xl">⚠️</div>
            </div>
          </div>

          <div className="bg-white rounded-lg p-5 shadow-sm border-l-4 border-orange-500">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">Pending Alerts</p>
                <p className="text-3xl font-bold text-orange-600">{stats.pendingAlerts}</p>
              </div>
              <div className="text-3xl">🔔</div>
            </div>
          </div>
        </div>

        {/* Main Content Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Recent Alerts */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200">
            <div className="p-4 border-b border-gray-200 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-900">🚨 Recent Alerts</h2>
              <Link to="/doctor/alerts" className="text-blue-600 hover:underline text-sm">
                View All
              </Link>
            </div>
            <div className="p-4 space-y-3 max-h-80 overflow-y-auto">
              {loading ? (
                <p className="text-gray-500 text-center py-4">Loading...</p>
              ) : alerts.length === 0 ? (
                <div className="text-center py-6">
                  <div className="text-3xl mb-2">✅</div>
                  <p className="text-gray-500">No pending alerts</p>
                </div>
              ) : (
                alerts.slice(0, 5).map((alert, index) => (
                  <div
                    key={alert._id || index}
                    className={`p-3 rounded-lg border-l-4 ${
                      alert.severity === 'high' ? 'border-red-500 bg-red-50' :
                      alert.severity === 'medium' ? 'border-yellow-500 bg-yellow-50' :
                      'border-blue-500 bg-blue-50'
                    }`}
                  >
                    <p className="font-medium text-sm text-gray-900">{alert.message}</p>
                    <p className="text-xs text-gray-500 mt-1">
                      {alert.patientName} • {formatDate(alert.createdAt)}
                    </p>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* High Risk Patients */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200">
            <div className="p-4 border-b border-gray-200 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-900">⚠️ High Risk Patients</h2>
              <Link to="/doctor/patients" className="text-blue-600 hover:underline text-sm">
                View All
              </Link>
            </div>
            <div className="p-4 space-y-3 max-h-80 overflow-y-auto">
              {loading ? (
                <p className="text-gray-500 text-center py-4">Loading...</p>
              ) : reports.filter(r => r.riskLevel === 'high').length === 0 ? (
                <div className="text-center py-6">
                  <div className="text-3xl mb-2">👍</div>
                  <p className="text-gray-500">No high risk patients</p>
                </div>
              ) : (
                reports
                  .filter(r => r.riskLevel === 'high')
                  .slice(0, 5)
                  .map((report) => (
                    <Link
                      key={report._id}
                      to={`/report/${report._id}`}
                      className="block p-3 bg-red-50 rounded-lg hover:bg-red-100 transition-colors"
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-medium text-gray-900">{report.patient?.name}</p>
                          <p className="text-xs text-gray-500">{report.reportType}</p>
                        </div>
                        <RiskBadge level="high" />
                      </div>
                    </Link>
                  ))
              )}
            </div>
          </div>

          {/* Recent Reports */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200">
            <div className="p-4 border-b border-gray-200 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-900">📄 Recent Reports</h2>
              <Link to="/doctor/reports" className="text-blue-600 hover:underline text-sm">
                View All
              </Link>
            </div>
            <div className="p-4 space-y-3 max-h-80 overflow-y-auto">
              {loading ? (
                <p className="text-gray-500 text-center py-4">Loading...</p>
              ) : reports.length === 0 ? (
                <div className="text-center py-6">
                  <div className="text-3xl mb-2">📭</div>
                  <p className="text-gray-500">No reports yet</p>
                </div>
              ) : (
                reports.slice(0, 5).map((report) => (
                  <Link
                    key={report._id}
                    to={`/report/${report._id}`}
                    className="block p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-medium text-gray-900 text-sm">{report.fileName}</p>
                        <p className="text-xs text-gray-500">
                          {report.patient?.name} • {formatDate(report.createdAt)}
                        </p>
                      </div>
                      <RiskBadge level={report.riskLevel} />
                    </div>
                  </Link>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Link
            to="/doctor/patients"
            className="bg-white rounded-lg p-5 shadow-sm border border-gray-200 hover:border-green-400 hover:shadow-md transition-all flex items-center gap-4"
          >
            <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center text-2xl">
              👥
            </div>
            <div>
              <h3 className="font-semibold text-gray-900">View Patients</h3>
              <p className="text-sm text-gray-500">Manage patient list</p>
            </div>
          </Link>

          <Link
            to="/doctor/reports"
            className="bg-white rounded-lg p-5 shadow-sm border border-gray-200 hover:border-green-400 hover:shadow-md transition-all flex items-center gap-4"
          >
            <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center text-2xl">
              📋
            </div>
            <div>
              <h3 className="font-semibold text-gray-900">All Reports</h3>
              <p className="text-sm text-gray-500">Review all reports</p>
            </div>
          </Link>

          <Link
            to="/doctor/timeline"
            className="bg-white rounded-lg p-5 shadow-sm border border-gray-200 hover:border-green-400 hover:shadow-md transition-all flex items-center gap-4"
          >
            <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center text-2xl">
              📈
            </div>
            <div>
              <h3 className="font-semibold text-gray-900">Timeline</h3>
              <p className="text-sm text-gray-500">View report history</p>
            </div>
          </Link>

          <Link
            to="/doctor/chat"
            className="bg-white rounded-lg p-5 shadow-sm border border-gray-200 hover:border-green-400 hover:shadow-md transition-all flex items-center gap-4"
          >
            <div className="w-12 h-12 bg-orange-100 rounded-lg flex items-center justify-center text-2xl">
              💬
            </div>
            <div>
              <h3 className="font-semibold text-gray-900">Messages</h3>
              <p className="text-sm text-gray-500">Chat with patients</p>
            </div>
          </Link>
        </div>
      </div>
    </Layout>
  )
}

export default DoctorDashboard