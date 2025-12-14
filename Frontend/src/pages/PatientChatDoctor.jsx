import React, { useState, useEffect } from 'react'
import Layout from '../components/Layout'
import ChatWindow from '../components/ChatWindow'
import { chatService } from '../services/chatService'

const PatientChatDoctor = () => {
  const [doctors, setDoctors] = useState([])
  const [selectedDoctor, setSelectedDoctor] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchDoctors()
  }, [])

  const fetchDoctors = async () => {
    try {
      setLoading(true)
      const response = await chatService.getConversations()
      setDoctors(response.conversations || [])
      if (response.conversations?.length > 0) {
        setSelectedDoctor(response.conversations[0])
      }
    } catch (error) {
      console.error('Failed to fetch doctors:', error)
    } finally {
      setLoading(false)
    }
  }

  return (
    <Layout>
      <div className="h-[calc(100vh-180px)]">
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 h-full flex overflow-hidden">
          {/* Doctors List */}
          <div className="w-80 border-r border-gray-200 flex flex-col">
            <div className="p-4 border-b border-gray-200">
              <h2 className="font-semibold text-gray-900">Messages</h2>
              <p className="text-sm text-gray-500">Chat with your doctors</p>
            </div>

            <div className="flex-1 overflow-y-auto">
              {loading ? (
                <div className="p-4 text-center text-gray-500">Loading...</div>
              ) : doctors.length === 0 ? (
                <div className="p-4 text-center">
                  <div className="text-4xl mb-2">👨‍⚕️</div>
                  <p className="text-gray-500 text-sm">No doctors assigned yet</p>
                  <p className="text-gray-400 text-xs mt-1">Upload a report to get connected</p>
                </div>
              ) : (
                doctors.map((doctor) => (
                  <button
                    key={doctor._id}
                    onClick={() => setSelectedDoctor(doctor)}
                    className={`w-full p-4 flex items-center gap-3 hover:bg-gray-50 transition-colors ${
                      selectedDoctor?._id === doctor._id ? 'bg-blue-50 border-r-2 border-blue-600' : ''
                    }`}
                  >
                    <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center text-xl">
                      👨‍⚕️
                    </div>
                    <div className="flex-1 text-left">
                      <p className="font-medium text-gray-900">{doctor.name}</p>
                      <p className="text-sm text-gray-500">{doctor.specialization}</p>
                      {doctor.lastMessage && (
                        <p className="text-xs text-gray-400 truncate">{doctor.lastMessage}</p>
                      )}
                    </div>
                    {doctor.unreadCount > 0 && (
                      <span className="bg-blue-600 text-white text-xs px-2 py-1 rounded-full">
                        {doctor.unreadCount}
                      </span>
                    )}
                  </button>
                ))
              )}
            </div>
          </div>

          {/* Chat Window */}
          <div className="flex-1">
            {selectedDoctor ? (
              <ChatWindow
                recipientId={selectedDoctor._id}
                recipientName={selectedDoctor.name}
              />
            ) : (
              <div className="h-full flex items-center justify-center text-gray-500">
                <div className="text-center">
                  <div className="text-6xl mb-4">💬</div>
                  <p>Select a doctor to start chatting</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </Layout>
  )
}

export default PatientChatDoctor