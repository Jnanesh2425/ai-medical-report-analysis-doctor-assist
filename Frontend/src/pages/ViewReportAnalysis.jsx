import React, { useState, useEffect } from 'react'
import { useParams, Link } from 'react-router-dom'
import Layout from '../components/Layout'
import RiskBadge from '../components/RiskBadge'
import ChatbotWidget from '../components/ChatbotWidget'
import { reportService } from '../services/reportService'

const ViewReportAnalysis = () => {
  const { reportId } = useParams()
  const [report, setReport] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [activeTab, setActiveTab] = useState('summary')

  useEffect(() => {
    fetchReport()
  }, [reportId])

  const fetchReport = async () => {
    try {
      setLoading(true)
      const response = await reportService.getReportById(reportId)
      setReport(response.report)
    } catch (err) {
      setError('Failed to load report')
    } finally {
      setLoading(false)
    }
  }

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  if (loading) {
    return (
      <Layout>
        <div className="flex items-center justify-center h-64">
          <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
        </div>
      </Layout>
    )
  }

  if (error || !report) {
    return (
      <Layout>
        <div className="text-center py-12">
          <div className="text-4xl mb-4">❌</div>
          <h2 className="text-xl font-bold text-gray-900 mb-2">Report Not Found</h2>
          <p className="text-gray-600 mb-4">{error || 'The report you are looking for does not exist.'}</p>
          <Link to="/patient/dashboard" className="text-blue-600 hover:underline">
            ← Back to Dashboard
          </Link>
        </div>
      </Layout>
    )
  }

  return (
    <Layout>
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Header */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 bg-blue-100 rounded-lg flex items-center justify-center text-2xl">
                📄
              </div>
              <div>
                <h1 className="text-xl font-bold text-gray-900">{report.fileName}</h1>
                <p className="text-sm text-gray-500">{report.reportType} • {formatDate(report.createdAt)}</p>
              </div>
            </div>
            <RiskBadge level={report.riskLevel} />
          </div>
        </div>

        {/* Tabs */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200">
          <div className="border-b border-gray-200">
            <div className="flex">
              {['summary', 'findings', 'abnormalities', 'extracted'].map((tab) => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={`flex-1 py-4 text-sm font-medium capitalize transition-colors ${
                    activeTab === tab
                      ? 'text-blue-600 border-b-2 border-blue-600'
                      : 'text-gray-500 hover:text-gray-700'
                  }`}
                >
                  {tab === 'extracted' ? 'Extracted Text' : tab}
                </button>
              ))}
            </div>
          </div>

          <div className="p-6">
            {/* Summary Tab */}
            {activeTab === 'summary' && (
              <div className="space-y-4">
                <h3 className="text-lg font-semibold text-gray-900">AI Summary</h3>
                <div className="bg-blue-50 rounded-lg p-4">
                  <p className="text-gray-800 leading-relaxed">
                    {report.summary || 'No summary available for this report.'}
                  </p>
                </div>

                {/* Risk Score Details */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-6">
                  <div className="bg-gray-50 rounded-lg p-4 text-center">
                    <p className="text-sm text-gray-500">Risk Level</p>
                    <p className={`text-2xl font-bold capitalize ${
                      report.riskLevel === 'high' ? 'text-red-600' :
                      report.riskLevel === 'medium' ? 'text-yellow-600' :
                      'text-green-600'
                    }`}>
                      {report.riskLevel}
                    </p>
                  </div>
                  <div className="bg-gray-50 rounded-lg p-4 text-center">
                    <p className="text-sm text-gray-500">Risk Score</p>
                    <p className="text-2xl font-bold text-gray-900">{report.riskScore}/100</p>
                  </div>
                  <div className="bg-gray-50 rounded-lg p-4 text-center">
                    <p className="text-sm text-gray-500">Abnormalities</p>
                    <p className="text-2xl font-bold text-gray-900">{report.abnormalities?.length || 0}</p>
                  </div>
                </div>
              </div>
            )}

            {/* Findings Tab */}
            {activeTab === 'findings' && (
              <div className="space-y-4">
                <h3 className="text-lg font-semibold text-gray-900">Key Findings</h3>
                {report.keyFindings && report.keyFindings.length > 0 ? (
                  <ul className="space-y-3">
                    {report.keyFindings.map((finding, index) => (
                      <li key={index} className="flex items-start gap-3 bg-gray-50 p-4 rounded-lg">
                        <span className="text-blue-600 mt-1">•</span>
                        <span className="text-gray-800">{finding}</span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-gray-500">No key findings extracted from this report.</p>
                )}
              </div>
            )}

            {/* Abnormalities Tab */}
            {activeTab === 'abnormalities' && (
              <div className="space-y-4">
                <h3 className="text-lg font-semibold text-gray-900">Detected Abnormalities</h3>
                {report.abnormalities && report.abnormalities.length > 0 ? (
                  <div className="space-y-3">
                    {report.abnormalities.map((abnormality, index) => (
                      <div key={index} className="bg-red-50 border-l-4 border-red-500 p-4 rounded-r-lg">
                        <p className="text-red-800 font-medium">{abnormality}</p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="bg-green-50 p-6 rounded-lg text-center">
                    <div className="text-4xl mb-2">✅</div>
                    <p className="text-green-800 font-medium">No abnormalities detected</p>
                    <p className="text-green-600 text-sm">All values appear to be within normal ranges</p>
                  </div>
                )}
              </div>
            )}

            {/* Extracted Text Tab */}
            {activeTab === 'extracted' && (
              <div className="space-y-4">
                <h3 className="text-lg font-semibold text-gray-900">Extracted Text (OCR)</h3>
                <div className="bg-gray-50 rounded-lg p-4 max-h-96 overflow-y-auto">
                  <pre className="text-sm text-gray-700 whitespace-pre-wrap font-mono">
                    {report.extractedText || 'No text extracted from this report.'}
                  </pre>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-4">
          <Link
            to="/patient/chat"
            className="flex-1 bg-green-600 text-white py-3 rounded-lg font-medium hover:bg-green-700 text-center"
          >
            💬 Discuss with Doctor
          </Link>
          <Link
            to="/patient/dashboard"
            className="flex-1 bg-gray-200 text-gray-800 py-3 rounded-lg font-medium hover:bg-gray-300 text-center"
          >
            ← Back to Dashboard
          </Link>
        </div>
      </div>

      <ChatbotWidget reportContext={report} />
    </Layout>
  )
}

export default ViewReportAnalysis