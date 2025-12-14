import React, { useContext } from 'react'
import { AuthContext } from '../context/AuthContext'
import { useNavigate } from 'react-router-dom'

const Navbar = () => {
  const { user, logout } = useContext(AuthContext)
  const navigate = useNavigate()

  const handleLogout = () => {
    logout()
    navigate('/')
  }

  return (
    <nav className="bg-white shadow-sm border-b border-gray-200 sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          <div className="flex items-center gap-3">
            <div className="text-2xl font-bold text-blue-600">🏥</div>
            <h1 className="text-xl font-semibold text-gray-900">AI Medical Report</h1>
          </div>

          <div className="flex items-center gap-4">
            {user && (
              <>
                <div className="hidden sm:block">
                  <div className="text-sm font-medium text-gray-700">
                    {user.name}
                  </div>
                  <div className="text-xs text-gray-500 capitalize">
                    {user.userType}
                  </div>
                </div>
                <button
                  onClick={handleLogout}
                  className="bg-red-600 text-white px-4 py-2 rounded-md text-sm hover:bg-red-700"
                >
                  Logout
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </nav>
  )
}

export default Navbar