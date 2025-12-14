import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom'
import { useContext } from 'react'
import { AuthProvider, AuthContext } from './context/AuthContext'
import { ReportProvider } from './context/ReportContext'

// Pages
import PatientLogin from './pages/PatientLogin'
import DoctorLogin from './pages/DoctorLogin'
import PatientDashboard from './pages/patientDashboard'
import UploadReports from './pages/UploadReports'
import ViewReportAnalysis from './pages/ViewReportAnalysis'
import PatientChatDoctor from './pages/PatientChatDoctor'
import AIChatbot from './pages/AIChatbot'
import DoctorDashboard from './pages/DoctorDashboard'
import DoctorReportViewer from './pages/DoctorReportViewer'
import AlertsPage from './pages/AlertsPage'
import TimelinePage from './pages/TimelinePage'
import DoctorChatPatient from './pages/DoctorChatPatient'

import './App.css'

// Protected Route Component
const ProtectedRoute = ({ children, allowedUserType }) => {
  const { user, loading } = useContext(AuthContext)

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
      </div>
    )
  }

  if (!user) {
    return <Navigate to="/patient/login" replace />
  }

  if (allowedUserType && user.userType !== allowedUserType) {
    return <Navigate to={`/${user.userType}/dashboard`} replace />
  }

  return children
}

// Home Redirect
const HomeRedirect = () => {
  const { user } = useContext(AuthContext)
  
  if (user) {
    return <Navigate to={`/${user.userType}/dashboard`} replace />
  }
  return <Navigate to="/patient/login" replace />
}

function App() {
  return (
    <AuthProvider>
      <ReportProvider>
        <Router>
          <Routes>
            {/* Home */}
            <Route path="/" element={<HomeRedirect />} />

            {/* Auth Routes */}
            <Route path="/patient/login" element={<PatientLogin />} />
            <Route path="/doctor/login" element={<DoctorLogin />} />

            {/* Patient Routes */}
            <Route
              path="/patient/dashboard"
              element={
                <ProtectedRoute allowedUserType="patient">
                  <PatientDashboard />
                </ProtectedRoute>
              }
            />
            <Route
              path="/patient/upload"
              element={
                <ProtectedRoute allowedUserType="patient">
                  <UploadReports />
                </ProtectedRoute>
              }
            />
            <Route
              path="/patient/reports"
              element={
                <ProtectedRoute allowedUserType="patient">
                  <PatientDashboard />
                </ProtectedRoute>
              }
            />
            <Route
              path="/patient/chat"
              element={
                <ProtectedRoute allowedUserType="patient">
                  <PatientChatDoctor />
                </ProtectedRoute>
              }
            />
            <Route
              path="/patient/chatbot"
              element={
                <ProtectedRoute allowedUserType="patient">
                  <AIChatbot />
                </ProtectedRoute>
              }
            />

            {/* Doctor Routes */}
            <Route
              path="/doctor/dashboard"
              element={
                <ProtectedRoute allowedUserType="doctor">
                  <DoctorDashboard />
                </ProtectedRoute>
              }
            />
            <Route
              path="/doctor/patients"
              element={
                <ProtectedRoute allowedUserType="doctor">
                  <DoctorDashboard />
                </ProtectedRoute>
              }
            />
            <Route
              path="/doctor/reports"
              element={
                <ProtectedRoute allowedUserType="doctor">
                  <DoctorReportViewer />
                </ProtectedRoute>
              }
            />
            <Route
              path="/doctor/alerts"
              element={
                <ProtectedRoute allowedUserType="doctor">
                  <AlertsPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/doctor/timeline"
              element={
                <ProtectedRoute allowedUserType="doctor">
                  <TimelinePage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/doctor/chat"
              element={
                <ProtectedRoute allowedUserType="doctor">
                  <DoctorChatPatient />
                </ProtectedRoute>
              }
            />

            {/* Shared Routes */}
            <Route
              path="/report/:reportId"
              element={
                <ProtectedRoute>
                  <ViewReportAnalysis />
                </ProtectedRoute>
              }
            />

            {/* 404 */}
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </Router>
      </ReportProvider>
    </AuthProvider>
  )
}

export default App