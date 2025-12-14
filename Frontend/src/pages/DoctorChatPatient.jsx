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
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 h-full flex overflow-hidden">
          {/* Patients List */}
          <div className="w-80 border-r border-gray-200 flex flex-col">
            <div className="p-4 border-b border-gray-200">
              <h2 className="font-semibold text-gray-900">Patient Messages</h2>
              <p className="text-sm text-gray-500">Communicate with your patients</p>
            </div>

            <div className="flex-1 overflow-y-auto">
              {loading ? (
                <div className="p-4 text-center text-gray-500">Loading...</div>
              ) : patients.length === 0 ? (
                <div className="p-4 text-center">
                  <div className="text-4xl mb-2">👥</div>
                  <p className="text-gray-500 text-sm">No patient conversations</p>
                </div>
              ) : (
                patients.map((patient) => (
                  <button
                    key={patient._id}
                    onClick={() => setSelectedPatient(patient)}
                    className={`w-full p-4 flex items-center gap-3 hover:bg-gray-50 transition-colors ${
                      selectedPatient?._id === patient._id ? 'bg-green-50 border-r-2 border-green-600' : ''
                    }`}
                  >
                    <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center text-xl">
                      👤
                    </div>
                    <div className="flex-1 text-left">
                      <p className="font-medium text-gray-900">{patient.name}</p>
                      {patient.lastMessage && (
                        <p className="text-xs text-gray-400 truncate">{patient.lastMessage}</p>
                      )}
                    </div>
                    {patient.unreadCount > 0 && (
                      <span className="bg-green-600 text-white text-xs px-2 py-1 rounded-full">
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
              <div className="h-full flex items-center justify-center text-gray-500">
                <div className="text-center">
                  <div className="text-6xl mb-4">💬</div>
                  <p>Select a patient to start chatting</p>
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