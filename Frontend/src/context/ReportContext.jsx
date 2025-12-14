import React, { createContext, useState } from 'react'

export const ReportContext = createContext()

export const ReportProvider = ({ children }) => {
  const [reports, setReports] = useState([])
  const [selectedReport, setSelectedReport] = useState(null)
  const [uploading, setUploading] = useState(false)
  const [alerts, setAlerts] = useState([])

  const addReport = (report) => {
    setReports([report, ...reports])
  }

  const updateReport = (reportId, updatedData) => {
    setReports(reports.map(r => r._id === reportId ? { ...r, ...updatedData } : r))
  }

  const deleteReport = (reportId) => {
    setReports(reports.filter(r => r._id !== reportId))
  }

  const addAlert = (alert) => {
    setAlerts([alert, ...alerts])
  }

  return (
    <ReportContext.Provider
      value={{
        reports,
        setReports,
        selectedReport,
        setSelectedReport,
        uploading,
        setUploading,
        alerts,
        addReport,
        updateReport,
        deleteReport,
        addAlert
      }}
    >
      {children}
    </ReportContext.Provider>
  )
}