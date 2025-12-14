import React from 'react'

const TimelineGraph = ({ reports }) => {
  const getRiskColor = (level) => {
    switch (level?.toLowerCase()) {
      case 'high': return 'bg-red-500'
      case 'medium': return 'bg-yellow-500'
      case 'low': return 'bg-green-500'
      default: return 'bg-gray-500'
    }
  }

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    })
  }

  if (!reports || reports.length === 0) {
    return (
      <div className="bg-white rounded-lg p-6 text-center text-gray-500">
        No reports to display in timeline
      </div>
    )
  }

  return (
    <div className="bg-white rounded-lg p-6">
      <h3 className="text-lg font-semibold text-gray-900 mb-6">Report Timeline</h3>
      
      <div className="relative">
        {/* Timeline Line */}
        <div className="absolute left-4 top-0 bottom-0 w-0.5 bg-gray-200"></div>

        {/* Timeline Items */}
        <div className="space-y-6">
          {reports.map((report, index) => (
            <div key={report._id || index} className="relative flex gap-4">
              {/* Timeline Dot */}
              <div className={`w-8 h-8 rounded-full ${getRiskColor(report.riskLevel)} flex items-center justify-center text-white text-xs font-bold z-10`}>
                {index + 1}
              </div>

              {/* Content */}
              <div className="flex-1 bg-gray-50 rounded-lg p-4">
                <div className="flex items-center justify-between mb-2">
                  <h4 className="font-medium text-gray-900">{report.fileName}</h4>
                  <span className="text-sm text-gray-500">{formatDate(report.createdAt)}</span>
                </div>
                
                {report.summary && (
                  <p className="text-sm text-gray-600 mb-2 line-clamp-2">{report.summary}</p>
                )}

                <div className="flex items-center gap-2">
                  <span className={`px-2 py-1 rounded text-xs font-medium ${
                    report.riskLevel === 'high' ? 'bg-red-100 text-red-800' :
                    report.riskLevel === 'medium' ? 'bg-yellow-100 text-yellow-800' :
                    'bg-green-100 text-green-800'
                  }`}>
                    {report.riskLevel?.toUpperCase()} RISK
                  </span>
                  
                  {report.abnormalities?.length > 0 && (
                    <span className="text-xs text-gray-500">
                      {report.abnormalities.length} abnormalities found
                    </span>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

export default TimelineGraph