import React, { useContext } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { AuthContext } from '../context/AuthContext'

const Sidebar = () => {
  const { user } = useContext(AuthContext)
  const location = useLocation()

  const patientLinks = [
    { path: '/patient/dashboard', label: 'Dashboard', icon: '🏠' },
    { path: '/patient/upload', label: 'Upload Reports', icon: '📤' },
    { path: '/patient/reports', label: 'My Reports', icon: '📋' },
    { path: '/patient/chat', label: 'Chat with Doctor', icon: '💬' },
    { path: '/patient/chatbot', label: 'AI Assistant', icon: '🤖' }
  ]

  const doctorLinks = [
    { path: '/doctor/dashboard', label: 'Dashboard', icon: '🏠' },
    { path: '/doctor/patients', label: 'Patients', icon: '👥' },
    { path: '/doctor/reports', label: 'All Reports', icon: '📋' },
    { path: '/doctor/alerts', label: 'Alerts', icon: '🚨' },
    { path: '/doctor/timeline', label: 'Timeline', icon: '📈' },
    { path: '/doctor/chat', label: 'Messages', icon: '💬' }
  ]

  const links = user?.userType === 'doctor' ? doctorLinks : patientLinks

  return (
    <aside className="w-64 bg-white border-r border-gray-200 min-h-screen fixed left-0 top-16">
      <div className="p-4">
        <div className="mb-6 p-3 bg-blue-50 rounded-lg">
          <p className="text-sm font-medium text-blue-900">{user?.name || 'User'}</p>
          <p className="text-xs text-blue-600 capitalize">{user?.userType || 'Guest'}</p>
        </div>

        <nav className="space-y-1">
          {links.map((link) => (
            <Link
              key={link.path}
              to={link.path}
              className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                location.pathname === link.path
                  ? 'bg-blue-600 text-white'
                  : 'text-gray-700 hover:bg-gray-100'
              }`}
            >
              <span>{link.icon}</span>
              {link.label}
            </Link>
          ))}
        </nav>
      </div>
    </aside>
  )
}

export default Sidebar
