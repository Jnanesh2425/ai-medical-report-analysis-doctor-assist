import React, { useState, useEffect, useContext } from 'react'
import { Link } from 'react-router-dom'
import { AuthContext } from '../context/AuthContext'
import { ReportContext } from '../context/ReportContext'
import { reportService } from '../services/reportService'
import Layout from '../components/Layout'
import ReportCard from '../components/ReportCard'
import RiskBadge from '../components/RiskBadge'
import ChatbotWidget from '../components/ChatbotWidget'

const PatientDashboard = () => {
  const { user } = useContext(AuthContext)
  const { reports, setReports } = useContext(ReportContext)
  const [loading, setLoading] = useState(true)
  const [stats, setStats] = useState({
    total: 0,
    high: 0,
    medium: 0,
    low: 0
  })

  useEffect(() => {
    fetchReports()
  }, [])

  const fetchReports = async () => {
    try {
      setLoading(true)
      const response = await reportService.getMyReports()
      setReports(response.reports || [])
      
      // Calculate stats
      const reportList = response.reports || []
      setStats({
        total: reportList.length,
        high: reportList.filter(r => r.riskLevel === 'high').length,
        medium: reportList.filter(r => r.riskLevel === 'medium').length,
        low: reportList.filter(r => r.riskLevel === 'low').length
      })
    } catch (error) {
      console.error('Failed to fetch reports:', error)
    } finally {
      setLoading(false)
    }
  }

  return (
    <Layout>
      <div className="space-y-6">
        {/* Welcome Header */}
        <div className="bg-gradient-to-r from-blue-600 to-blue-700 rounded-xl p-6 text-white">
          <h1 className="text-2xl font-bold mb-2">Welcome back, {user?.name}! 👋</h1>
          <p className="text-blue-100">Your health dashboard - track your medical reports and insights</p>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-white rounded-lg p-5 shadow-sm border border-gray-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">Total Reports</p>
                <p className="text-3xl font-bold text-gray-900">{stats.total}</p>
              </div>
              <div className="text-3xl">📋</div>
            </div>
          </div>

          <div className="bg-white rounded-lg p-5 shadow-sm border-l-4 border-red-500">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">High Risk</p>
                <p className="text-3xl font-bold text-red-600">{stats.high}</p>
              </div>
              <div className="text-3xl">⚠️</div>
            </div>
          </div>

          <div className="bg-white rounded-lg p-5 shadow-sm border-l-4 border-yellow-500">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">Medium Risk</p>
                <p className="text-3xl font-bold text-yellow-600">{stats.medium}</p>
              </div>
              <div className="text-3xl">🔔</div>
            </div>
          </div>

          <div className="bg-white rounded-lg p-5 shadow-sm border-l-4 border-green-500">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">Low Risk</p>
                <p className="text-3xl font-bold text-green-600">{stats.low}</p>
              </div>
              <div className="text-3xl">✅</div>
            </div>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Link
            to="/patient/upload"
            className="bg-white rounded-lg p-6 shadow-sm border border-gray-200 hover:border-blue-400 hover:shadow-md transition-all flex items-center gap-4"
          >
            <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center text-2xl">
              📤
            </div>
            <div>
              <h3 className="font-semibold text-gray-900">Upload Report</h3>
              <p className="text-sm text-gray-500">Upload new medical report</p>
            </div>
          </Link>

          <Link
            to="/patient/chat"
            className="bg-white rounded-lg p-6 shadow-sm border border-gray-200 hover:border-blue-400 hover:shadow-md transition-all flex items-center gap-4"
          >
            <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center text-2xl">
              💬
            </div>
            <div>
              <h3 className="font-semibold text-gray-900">Chat with Doctor</h3>
              <p className="text-sm text-gray-500">Ask questions about reports</p>
            </div>
          </Link>

          <Link
            to="/patient/chatbot"
            className="bg-white rounded-lg p-6 shadow-sm border border-gray-200 hover:border-blue-400 hover:shadow-md transition-all flex items-center gap-4"
          >
            <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center text-2xl">
              🤖
            </div>
            <div>
              <h3 className="font-semibold text-gray-900">AI Assistant</h3>
              <p className="text-sm text-gray-500">Get instant explanations</p>
            </div>
          </Link>
        </div>

        {/* Recent Reports */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200">
          <div className="p-4 border-b border-gray-200 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-gray-900">Recent Reports</h2>
            <Link to="/patient/reports" className="text-blue-600 hover:underline text-sm">
              View All →
            </Link>
          </div>
          
          <div className="p-4">
            {loading ? (
              <div className="text-center py-8 text-gray-500">Loading reports...</div>
            ) : reports.length === 0 ? (
              <div className="text-center py-8">
                <div className="text-4xl mb-3">📭</div>
                <p className="text-gray-500 mb-4">No reports uploaded yet</p>
                <Link
                  to="/patient/upload"
                  className="inline-block bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700"
                >
                  Upload Your First Report
                </Link>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {reports.slice(0, 6).map((report) => (
                  <ReportCard key={report._id} report={report} />
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      <ChatbotWidget />
    </Layout>
  )
}

export default PatientDashboard