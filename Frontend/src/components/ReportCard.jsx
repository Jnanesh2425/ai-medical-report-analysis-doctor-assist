import React from 'react'
import { Link } from 'react-router-dom'
import RiskBadge from './RiskBadge'

const ReportCard = ({ report, showPatientInfo = false }) => {
  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-5 hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center text-xl">
            📄
          </div>
          <div>
            <h3 className="font-semibold text-gray-900">{report.fileName}</h3>
            <p className="text-sm text-gray-500">{formatDate(report.createdAt)}</p>
          </div>
        </div>
        <RiskBadge level={report.riskLevel} />
      </div>

      {showPatientInfo && report.patient && (
        <div className="mb-3 p-2 bg-gray-50 rounded">
          <p className="text-sm text-gray-600">
            Patient: <span className="font-medium">{report.patient.name}</span>
          </p>
        </div>
      )}

      {report.summary && (
        <div className="mb-4">
          <p className="text-sm text-gray-600 line-clamp-2">{report.summary}</p>
        </div>
      )}

      {report.abnormalities && report.abnormalities.length > 0 && (
        <div className="mb-4">
          <p className="text-xs font-medium text-gray-500 mb-2">Abnormalities:</p>
          <div className="flex flex-wrap gap-1">
            {report.abnormalities.slice(0, 3).map((abnormality, index) => (
              <span
                key={index}
                className="px-2 py-1 bg-red-50 text-red-700 text-xs rounded"
              >
                {abnormality}
              </span>
            ))}
            {report.abnormalities.length > 3 && (
              <span className="px-2 py-1 bg-gray-100 text-gray-600 text-xs rounded">
                +{report.abnormalities.length - 3} more
              </span>
            )}
          </div>
        </div>
      )}

      <div className="flex gap-2">
        <Link
          to={`/report/${report._id}`}
          className="flex-1 bg-blue-600 text-white text-center py-2 rounded-md text-sm font-medium hover:bg-blue-700"
        >
          View Analysis
        </Link>
      </div>
    </div>
  )
}

export default ReportCard