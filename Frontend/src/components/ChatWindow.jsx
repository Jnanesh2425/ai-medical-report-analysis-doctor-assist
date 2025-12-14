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
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  return (
    <div className="flex flex-col h-full bg-white rounded-lg border border-gray-200">
      {/* Chat Header */}
      <div className="p-4 border-b border-gray-200 bg-gray-50">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
            👤
          </div>
          <div>
            <h3 className="font-semibold text-gray-900">{recipientName}</h3>
            <p className="text-xs text-green-600">Online</p>
          </div>
        </div>
      </div>

      {/* Messages Container */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {loading ? (
          <div className="text-center py-8 text-gray-500">Loading messages...</div>
        ) : messages.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            No messages yet. Start the conversation!
          </div>
        ) : (
          messages.map((msg, index) => (
            <div
              key={index}
              className={`flex ${msg.sender === user._id ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className={`max-w-xs lg:max-w-md px-4 py-2 rounded-lg ${
                  msg.sender === user._id
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-100 text-gray-900'
                }`}
              >
                <p className="text-sm">{msg.content}</p>
                <p className={`text-xs mt-1 ${
                  msg.sender === user._id ? 'text-blue-200' : 'text-gray-500'
                }`}>
                  {formatTime(msg.createdAt)}
                </p>
              </div>
            </div>
          ))
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Message Input */}
      <form onSubmit={handleSend} className="p-4 border-t border-gray-200">
        <div className="flex gap-2">
          <input
            type="text"
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            placeholder="Type your message..."
            className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <button
            type="submit"
            className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            Send
          </button>
        </div>
      </form>
    </div>
  )
}

export default ChatWindow