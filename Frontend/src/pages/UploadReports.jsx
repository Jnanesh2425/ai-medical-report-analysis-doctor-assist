import React, { useState, useContext } from 'react'
import { useNavigate } from 'react-router-dom'
import Layout from '../components/Layout'
import FileUploader from '../components/FileUploader'
import { ReportContext } from '../context/ReportContext'
import { reportService } from '../services/reportService'

const UploadReports = () => {
  const [selectedFile, setSelectedFile] = useState(null)
  const [reportType, setReportType] = useState('')
  const [notes, setNotes] = useState('')
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)
  
  const { addReport } = useContext(ReportContext)
  const navigate = useNavigate()

  const reportTypes = [
    'Blood Test',
    'X-Ray',
    'MRI Scan',
    'CT Scan',
    'Ultrasound',
    'ECG/EKG',
    'Urine Test',
    'Biopsy Report',
    'Pathology Report',
    'Prescription',
    'Discharge Summary',
    'Other'
  ]

  const handleFileSelect = (file) => {
    setSelectedFile(file)
    setError('')
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    
    if (!selectedFile) {
      setError('Please select a file to upload')
      return
    }

    if (!reportType) {
      setError('Please select a report type')
      return
    }

    setUploading(true)
    setError('')

    try {
      const formData = new FormData()
      formData.append('file', selectedFile)
      formData.append('reportType', reportType)
      formData.append('notes', notes)

      const response = await reportService.uploadReport(formData)
      
      addReport(response.report)
      setSuccess(true)
      
      setTimeout(() => {
        navigate(`/report/${response.report._id}`)
      }, 2000)
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to upload report. Please try again.')
    } finally {
      setUploading(false)
    }
  }

  return (
    <Layout>
      <div className="max-w-3xl mx-auto">
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8">
          <div className="text-center mb-8">
            <div className="text-4xl mb-3">📤</div>
            <h1 className="text-2xl font-bold text-gray-900">Upload Medical Report</h1>
            <p className="text-gray-600 mt-2">
              Upload your medical report and our AI will analyze it for you
            </p>
          </div>

          {success ? (
            <div className="text-center py-8">
              <div className="text-6xl mb-4">✅</div>
              <h2 className="text-xl font-bold text-green-600 mb-2">Upload Successful!</h2>
              <p className="text-gray-600 mb-4">Your report is being analyzed by AI...</p>
              <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto"></div>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-6">
              {error && (
                <div className="p-4 bg-red-50 text-red-700 rounded-lg text-sm">
                  {error}
                </div>
              )}

              {/* File Upload */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Upload File *
                </label>
                <FileUploader
                  onFileSelect={handleFileSelect}
                  uploading={uploading}
                  acceptedTypes=".pdf,.png,.jpg,.jpeg"
                />
              </div>

              {/* Report Type */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Report Type *
                </label>
                <select
                  value={reportType}
                  onChange={(e) => setReportType(e.target.value)}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  disabled={uploading}
                >
                  <option value="">Select Report Type</option>
                  {reportTypes.map((type) => (
                    <option key={type} value={type}>{type}</option>
                  ))}
                </select>
              </div>

              {/* Notes */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Additional Notes (Optional)
                </label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={4}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Add any symptoms, concerns, or context about this report..."
                  disabled={uploading}
                />
              </div>

              {/* What Happens Next */}
              <div className="bg-blue-50 rounded-lg p-4">
                <h3 className="font-medium text-blue-900 mb-2">What happens next?</h3>
                <ul className="text-sm text-blue-800 space-y-1">
                  <li>📄 Your file will be securely uploaded</li>
                  <li>🔍 OCR will extract text from your report</li>
                  <li>🤖 AI will analyze and summarize findings</li>
                  <li>⚠️ Abnormalities and risk levels will be identified</li>
                  <li>👨‍⚕️ Your doctor will be notified if needed</li>
                </ul>
              </div>

              {/* Submit Button */}
              <button
                type="submit"
                disabled={uploading || !selectedFile}
                className="w-full bg-blue-600 text-white py-3 rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {uploading ? (
                  <>
                    <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    Uploading & Analyzing...
                  </>
                ) : (
                  <>
                    📤 Upload & Analyze Report
                  </>
                )}
              </button>
            </form>
          )}
        </div>
      </div>
    </Layout>
  )
}

export default UploadReports