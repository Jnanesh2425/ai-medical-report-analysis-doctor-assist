import React, { useState, useEffect, useRef, useContext } from 'react'
import { AuthContext } from '../context/AuthContext'
import { socketService } from '../services/socketService'
import { chatService } from '../services/chatService'

const ChatWindow = ({ recipientId, recipientName }) => {
  const { user, token } = useContext(AuthContext)
  const [messages, setMessages] = useState([])
  const [newMessage, setNewMessage] = useState('')
  const [loading, setLoading] = useState(true)
  const messagesEndRef = useRef(null)
  
  // Determine if current user is a doctor
  const isDoctor = user?.role === 'doctor'

  useEffect(() => {
    loadChatHistory()
    setupSocket()

    return () => {
      socketService.off('newMessage')
    }
  }, [recipientId])

  useEffect(() => {
    scrollToBottom()
  }, [messages])

  const loadChatHistory = async () => {
    try {
      setLoading(true)
      const response = await chatService.getChatHistory(recipientId)
      setMessages(response.messages || [])
    } catch (error) {
      console.error('Failed to load chat history:', error)
    } finally {
      setLoading(false)
    }
  }

  const setupSocket = () => {
    const socket = socketService.connect(token)
    
    socketService.on('newMessage', (message) => {
      if (message.sender === recipientId || message.recipient === recipientId) {
        setMessages(prev => [...prev, message])
      }
    })
  }

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  const handleSend = async (e) => {
    e.preventDefault()
    if (!newMessage.trim()) return

    try {
      const response = await chatService.sendMessage(recipientId, newMessage)
      setMessages(prev => [...prev, response.message])
      setNewMessage('')
      
      socketService.emit('sendMessage', {
        recipientId,
        message: newMessage
      })
    } catch (error) {
      console.error('Failed to send message:', error)
    }
  }

  const formatTime = (dateString) => {
    return new Date(dateString).toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    })
  }

  const formatDate = (dateString) => {
    const date = new Date(dateString)
    const today = new Date()
    const yesterday = new Date(today)
    yesterday.setDate(yesterday.getDate() - 1)

    if (date.toDateString() === today.toDateString()) {
      return 'Today'
    } else if (date.toDateString() === yesterday.toDateString()) {
      return 'Yesterday'
    } else {
      return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
    }
  }

  const shouldShowDateDivider = (currentMsg, prevMsg) => {
    if (!prevMsg) return true
    const currentDate = new Date(currentMsg.createdAt).toDateString()
    const prevDate = new Date(prevMsg.createdAt).toDateString()
    return currentDate !== prevDate
  }

  return (
    <div className="flex flex-col h-full">
      {/* Modern Chat Header */}
      <div className="bg-gradient-to-r from-blue-600 to-blue-700 text-white p-4 flex items-center gap-3 shadow-md">
        <div className="w-11 h-11 bg-white/20 rounded-full flex items-center justify-center text-xl backdrop-blur-sm">
          {isDoctor ? '👤' : '👨‍⚕️'}
        </div>
        <div className="flex-1">
          <h3 className="font-semibold text-base">{recipientName}</h3>
          <p className="text-xs text-blue-100 flex items-center gap-1">
            <span className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></span>
            Active now
          </p>
        </div>
        <div className="flex gap-1">
          <button className="p-2 hover:bg-white/10 rounded-full transition-colors">
            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
              <path d="M2 3a1 1 0 011-1h2.153a1 1 0 01.986.836l.74 4.435a1 1 0 01-.54 1.06l-1.548.773a11.037 11.037 0 006.105 6.105l.774-1.548a1 1 0 011.059-.54l4.435.74a1 1 0 01.836.986V17a1 1 0 01-1 1h-2C7.82 18 2 12.18 2 5V3z" />
            </svg>
          </button>
          <button className="p-2 hover:bg-white/10 rounded-full transition-colors">
            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
              <path d="M10 6a2 2 0 110-4 2 2 0 010 4zM10 12a2 2 0 110-4 2 2 0 010 4zM10 18a2 2 0 110-4 2 2 0 010 4z" />
            </svg>
          </button>
        </div>
      </div>

      {/* Messages Container with gradient background */}
      <div 
        className="flex-1 overflow-y-auto p-6 space-y-4"
        style={{
          background: 'linear-gradient(to bottom, #f0f4f8 0%, #e2e8f0 100%)'
        }}
      >
        {loading ? (
          <div className="text-center py-12">
            <div className="inline-block animate-spin rounded-full h-10 w-10 border-4 border-blue-500 border-t-transparent"></div>
            <p className="text-gray-600 mt-3 text-sm">Loading messages...</p>
          </div>
        ) : messages.length === 0 ? (
          <div className="text-center py-16">
            <div className="w-20 h-20 bg-gradient-to-br from-blue-400 to-blue-600 rounded-full flex items-center justify-center mx-auto mb-4 shadow-lg">
              <span className="text-4xl">💬</span>
            </div>
            <p className="text-gray-700 font-medium">No messages yet</p>
            <p className="text-gray-500 text-sm mt-1">Start the conversation!</p>
          </div>
        ) : (
          messages.map((msg, index) => {
            const showDateDivider = shouldShowDateDivider(msg, messages[index - 1])
            // Doctor messages always on right, patient messages always on left
            const isDoctorMessage = msg.senderRole === 'doctor'
            const isMyMessage = msg.sender === user._id
            
            return (
              <React.Fragment key={index}>
                {showDateDivider && (
                  <div className="flex justify-center my-4">
                    <span className="bg-white/90 backdrop-blur-sm text-gray-600 text-xs px-4 py-1.5 rounded-full shadow-sm font-medium">
                      {formatDate(msg.createdAt)}
                    </span>
                  </div>
                )}
                <div className={`flex ${isDoctorMessage ? 'justify-end' : 'justify-start'} mb-2`}>
                  <div className="flex items-end gap-2 max-w-md">
                    {/* Avatar for non-doctor messages (left side) */}
                    {!isDoctorMessage && (
                      <div className="w-8 h-8 bg-gradient-to-br from-gray-400 to-gray-600 rounded-full flex items-center justify-center text-sm flex-shrink-0 shadow-sm">
                        👤
                      </div>
                    )}
                    
                    <div className="flex flex-col">
                      {/* Sender name label */}
                      <span className={`text-xs text-gray-600 mb-1 px-2 font-medium ${isDoctorMessage ? 'text-right' : 'text-left'}`}>
                        {isDoctorMessage ? '👨‍⚕️ Doctor' : '👤 Patient'}
                      </span>
                      
                      {/* Message bubble */}
                      <div
                        className={`px-4 py-2.5 rounded-2xl shadow-md ${
                          isDoctorMessage
                            ? 'bg-gradient-to-br from-blue-500 to-blue-600 text-white'
                            : 'bg-white text-gray-800'
                        }`}
                        style={{
                          borderRadius: isDoctorMessage 
                            ? '18px 18px 4px 18px' 
                            : '18px 18px 18px 4px'
                        }}
                      >
                        <p className="text-sm leading-relaxed">{msg.content}</p>
                        <div className={`flex items-center justify-end gap-1 mt-1 ${
                          isDoctorMessage ? 'text-blue-100' : 'text-gray-500'
                        }`}>
                          <span className="text-[10px] font-medium">
                            {formatTime(msg.createdAt)}
                          </span>
                          {isMyMessage && (
                            <svg className={`w-4 h-4 ${isDoctorMessage ? 'text-blue-200' : 'text-blue-500'}`} fill="currentColor" viewBox="0 0 16 16">
                              <path d="M12.354 4.354a.5.5 0 0 0-.708-.708L5 10.293 1.854 7.146a.5.5 0 1 0-.708.708l3.5 3.5a.5.5 0 0 0 .708 0l7-7zm-4.208 7l-.896-.897.707-.707.543.543 6.646-6.647a.5.5 0 0 1 .708.708l-7 7a.5.5 0 0 1-.708 0z"/>
                            </svg>
                          )}
                        </div>
                      </div>
                    </div>
                    
                    {/* Avatar for doctor messages (right side) */}
                    {isDoctorMessage && (
                      <div className="w-8 h-8 bg-gradient-to-br from-blue-400 to-blue-600 rounded-full flex items-center justify-center text-sm flex-shrink-0 shadow-sm">
                        👨‍⚕️
                      </div>
                    )}
                  </div>
                </div>
              </React.Fragment>
            )
          })
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Modern Message Input */}
      <div className="bg-white border-t border-gray-200 p-4 shadow-lg">
        <form onSubmit={handleSend} className="flex items-center gap-3">
          <button
            type="button"
            className="p-2.5 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded-full transition-all"
            title="Attach file"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
            </svg>
          </button>
          
          <div className="flex-1 relative">
            <input
              type="text"
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              placeholder="Type your message..."
              className="w-full px-5 py-3 bg-gray-100 rounded-full focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all text-sm"
            />
            <button
              type="button"
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
            >
              😊
            </button>
          </div>
          
          <button
            type="submit"
            disabled={!newMessage.trim()}
            className={`p-3 rounded-full transition-all shadow-md ${
              newMessage.trim()
                ? 'bg-gradient-to-r from-blue-500 to-blue-600 text-white hover:shadow-lg hover:scale-105'
                : 'bg-gray-200 text-gray-400 cursor-not-allowed'
            }`}
          >
            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
              <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/>
            </svg>
          </button>
        </form>
      </div>
    </div>
  )
}

export default ChatWindow