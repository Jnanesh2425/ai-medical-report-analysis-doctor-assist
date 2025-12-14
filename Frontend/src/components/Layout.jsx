import React from 'react'
import Navbar from './Navbar'
import Sidebar from './Sidebar'

const Layout = ({ children, showSidebar = true }) => {
  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />
      <div className="flex">
        {showSidebar && <Sidebar />}
        <main className={`flex-1 p-6 ${showSidebar ? 'ml-64' : ''}`}>
          {children}
        </main>
      </div>
    </div>
  )
}

export default Layout