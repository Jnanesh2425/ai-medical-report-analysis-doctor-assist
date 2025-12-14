import React, { useState, useEffect, useContext } from 'react'
import { Link } from 'react-router-dom'
import Layout from '../components/Layout'
import { AuthContext } from '../context/AuthContext'
import { reportService } from '../services/reportService'
import { socketService } from '../services/socketService'

const AlertsPage = () => {
  const { token } = useContext(AuthContext)
  const [alerts, setAlerts] = useState([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('all')

  useEffect(() => {
    fetchAlerts()
    setupSocket()

    return () => {
      socketService.off('newAlert')
    }
  }, [])

  const fetchAlerts = async () => {
    try {
      setLoading(true)
      const response = await reportService.getAlerts()
      setAlerts(response.alerts || [])
    } catch (error) {
      console.error('Failed to fetch alerts:', error)
    } finally {
      setLoading(false)
    }
  }

  const setupSocket = () => {
    socketService.connect(token)
    socketService.on('newAlert', (alert) => {
      setAlerts(prev => [alert, ...prev])
    })
  }

  const acknowledgeAlert = async (alertId) => {
    try {
      setAlerts(prev => prev.map(alert => 
        alert._id === alertId ? { ...alert, acknowledged: true } : alert
      ))
    } catch (error) {
      console.error('Failed to acknowledge alert:', error)
    }
  }

  const filteredAlerts = alerts.filter(alert => {
    if (filter === 'all') return true
    if (filter === 'pending') return !alert.acknowledged
    if (filter === 'acknowledged') return alert.acknowledged
    return alert.severity === filter
  })

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  const getSeverityConfig = (severity) => {
    switch (severity) {
      case 'high':
        return { bg: 'bg-red-50', border: 'border-red-500', text: 'text-red-800', icon: '🚨' }
      case 'medium':
        return { bg: 'bg-yellow-50', border: 'border-yellow-500', text: 'text-yellow-800', icon: '⚠️' }
      default:
        return { bg: 'bg-blue-50', border: 'border-blue-500', text: 'text-blue-800', icon: 'ℹ️' }
    }
  }

  const stats = {
    total: alerts.length,
    pending: alerts.filter(a => !a.acknowledged).length,
    high: alerts.filter(a => a.severity === 'high').length,
    medium: alerts.filter(a => a.severity === 'medium').length
  }

  return (
    <Layout>
      <div className="space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold text-gray-900">🚨 Alerts Center</h1>
          <p className="text-gray-600">Monitor and manage patient alerts</p>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-white rounded-lg p-4 shadow-sm border border-gray-200">
            <p className="text-sm text-gray-500">Total Alerts</p>
            <p className="text-2xl font-bold text-gray-900">{stats.total}</p>
          </div>
          <div className="bg-white rounded-lg p-4 shadow-sm border-l-4 border-orange-500">
            <p className="text-sm text-gray-500">Pending</p>
            <p className="text-2xl font-bold text-orange-600">{stats.pending}</p>
          </div>
          <div className="bg-white rounded-lg p-4 shadow-sm border-l-4 border-red-500">
            <p className="text-sm text-gray-500">High Severity</p>
            <p className="text-2xl font-bold text-red-600">{stats.high}</p>
          </div>
          <div className="bg-white rounded-lg p-4 shadow-sm border-l-4 border-yellow-500">
            <p className="text-sm text-gray-500">Medium Severity</p>
            <p className="text-2xl font-bold text-yellow-600">{stats.medium}</p>
          </div>
        </div>

        {/* Filter */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
          <div className="flex flex-wrap gap-2">
            {['all', 'pending', 'acknowledged', 'high', 'medium', 'low'].map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`px-4 py-2 rounded-lg text-sm font-medium capitalize transition-colors ${
                  filter === f
                    ? 'bg-green-600 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                {f}
              </button>
            ))}
          </div>
        </div>

        {/* Alerts List */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200">
          <div className="p-4 border-b border-gray-200">
            <h2 className="font-semibold text-gray-900">
              {filteredAlerts.length} Alert{filteredAlerts.length !== 1 ? 's' : ''}
            </h2>
          </div>

          <div className="divide-y divide-gray-100">
            {loading ? (
              <div className="text-center py-12">
                <div className="w-12 h-12 border-4 border-green-600 border-t-transparent rounded-full animate-spin mx-auto"></div>
              </div>
            ) : filteredAlerts.length === 0 ? (
              <div className="text-center py-12">
                <div className="text-4xl mb-3">✅</div>
                <p className="text-gray-500">No alerts found</p>
              </div>
            ) : (
              filteredAlerts.map((alert) => {
                const config = getSeverityConfig(alert.severity)
                return (
                  <div
                    key={alert._id}
                    className={`p-4 ${config.bg} border-l-4 ${config.border} ${
                      alert.acknowledged ? 'opacity-60' : ''
                    }`}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex items-start gap-3">
                        <span className="text-2xl">{config.icon}</span>
                        <div>
                          <div className="flex items-center gap-2 mb-1">
                            <span className={`px-2 py-0.5 rounded text-xs font-medium ${config.text} ${config.bg}`}>
                              {alert.severity?.toUpperCase()}
                            </span>
                            {alert.acknowledged && (
                              <span className="px-2 py-0.5 bg-green-100 text-green-800 rounded text-xs">
                                ✓ Acknowledged
                              </span>
                            )}
                          </div>
                          <p className="font-medium text-gray-900">{alert.message}</p>
                          <div className="flex items-center gap-4 mt-2 text-sm text-gray-500">
                            <span>Patient: {alert.patientName}</span>
                            <span>{formatDate(alert.createdAt)}</span>
                          </div>
                        </div>
                      </div>

                      <div className="flex gap-2">
                        {alert.reportId && (
                          <Link
                            to={`/report/${alert.reportId}`}
                            className="px-3 py-1 bg-white border border-gray-300 text-gray-700 rounded text-sm hover:bg-gray-50"
                          >
                            View Report
                          </Link>
                        )}
                        {!alert.acknowledged && (
                          <button
                            onClick={() => acknowledgeAlert(alert._id)}
                            className="px-3 py-1 bg-green-600 text-white rounded text-sm hover:bg-green-700"
                          >
                            Acknowledge
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                )
              })
            )}
          </div>
        </div>
      </div>
    </Layout>
  )
}

export default AlertsPage