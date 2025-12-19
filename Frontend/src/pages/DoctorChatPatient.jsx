import React, { useState, useEffect } from 'react'
import Layout from '../components/Layout'
import ChatWindow from '../components/ChatWindow'
import { chatService } from '../services/chatService'

const DoctorChatPatients = () => {
  const [patients, setPatients] = useState([])
  const [selectedPatient, setSelectedPatient] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchPatients()
  }, [])

  const fetchPatients = async () => {
    try {
      setLoading(true)
      const response = await chatService.getConversations()
      setPatients(response.conversations || [])
      if (response.conversations?.length > 0) {
        setSelectedPatient(response.conversations[0])
      }
    } catch (error) {
      console.error('Failed to fetch patients:', error)
    } finally {
      setLoading(false)
    }
  }

  return (
    <Layout>
      <div className="h-[calc(100vh-180px)]">
        <div className="bg-white rounded-xl shadow-lg h-full flex overflow-hidden border border-gray-200">
          {/* Modern Patients Sidebar */}
          <div className="w-80 bg-gradient-to-b from-gray-50 to-white border-r border-gray-200 flex flex-col">
            {/* Sidebar Header */}
            <div className="bg-gradient-to-r from-blue-600 to-blue-700 p-4 text-white">
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-lg font-bold">Patient Messages</h2>
                <button className="p-2 hover:bg-white/20 rounded-full transition-colors">
                  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clipRule="evenodd" />
                  </svg>
                </button>
              </div>
              <div className="relative">
                <input
                  type="text"
                  placeholder="Search patients..."
                  className="w-full pl-10 pr-4 py-2.5 bg-white/20 backdrop-blur-sm text-white placeholder-blue-100 rounded-xl text-sm focus:outline-none focus:bg-white/30 transition-all border border-white/20"
                />
                <svg className="w-5 h-5 text-blue-100 absolute left-3 top-2.5" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 012 8z" clipRule="evenodd" />
                </svg>
              </div>
            </div>

            {/* Conversations List */}
            <div className="flex-1 overflow-y-auto">
              {loading ? (
                <div className="p-4 text-center text-gray-500">Loading...</div>
              ) : patients.length === 0 ? (
                <div className="p-8 text-center">
                  <div className="w-20 h-20 bg-gradient-to-br from-blue-400 to-blue-600 rounded-full flex items-center justify-center mx-auto mb-4 shadow-lg">
                    <span className="text-3xl">👥</span>
                  </div>
                  <p className="text-gray-700 font-semibold text-sm">No conversations yet</p>
                  <p className="text-gray-500 text-xs mt-1">Patient chats will appear here</p>
                </div>
              ) : (
                patients.map((patient) => (
                  <button
                    key={patient._id}
                    onClick={() => setSelectedPatient(patient)}
                    className={`w-full p-4 flex items-center gap-3 hover:bg-blue-50 transition-all border-b border-gray-100 ${
                      selectedPatient?._id === patient._id ? 'bg-blue-50 border-l-4 border-l-blue-600' : ''
                    }`}
                  >
                    <div className="relative">
                      <div className="w-12 h-12 bg-gradient-to-br from-gray-400 to-gray-600 rounded-full flex items-center justify-center text-xl shadow-md">
                        👤
                      </div>
                      <div className="absolute bottom-0 right-0 w-3.5 h-3.5 bg-green-500 rounded-full border-2 border-white shadow-sm"></div>
                    </div>
                    <div className="flex-1 text-left min-w-0">
                      <div className="flex justify-between items-baseline mb-1">
                        <p className="font-semibold text-gray-900 text-sm">{patient.name}</p>
                        <span className="text-xs text-gray-500 font-medium">12:45 PM</span>
                      </div>
                      {patient.lastMessage && (
                        <p className="text-xs text-gray-600 truncate">{patient.lastMessage}</p>
                      )}
                    </div>
                    {patient.unreadCount > 0 && (
                      <span className="bg-gradient-to-r from-blue-500 to-blue-600 text-white text-xs min-w-[20px] h-5 px-2 rounded-full flex items-center justify-center font-bold shadow-sm">
                        {patient.unreadCount}
                      </span>
                    )}
                  </button>
                ))
              )}
            </div>
          </div>

          {/* Chat Window */}
          <div className="flex-1">
            {selectedPatient ? (
              <ChatWindow
                recipientId={selectedPatient._id}
                recipientName={selectedPatient.name}
              />
            ) : (
              <div 
                className="h-full flex items-center justify-center"
                style={{
                  background: 'linear-gradient(to bottom, #f0f4f8 0%, #e2e8f0 100%)'
                }}
              >
                <div className="text-center">
                  <div className="w-24 h-24 bg-gradient-to-br from-blue-400 to-blue-600 rounded-full flex items-center justify-center mx-auto mb-6 shadow-xl">
                    <span className="text-5xl">💬</span>
                  </div>
                  <h3 className="text-2xl font-semibold text-gray-800 mb-2">Doctor Chat</h3>
                  <p className="text-gray-600">Select a patient to start messaging</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </Layout>
  )
}

export default DoctorChatPatients