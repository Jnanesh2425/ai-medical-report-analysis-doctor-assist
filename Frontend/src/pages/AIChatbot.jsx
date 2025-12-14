import React, { useState, useRef, useEffect, useContext } from 'react'
import Layout from '../components/Layout'
import { ReportContext } from '../context/ReportContext'
import { chatService } from '../services/chatService'

const AIChatbot = () => {
  const { reports } = useContext(ReportContext)
  const [messages, setMessages] = useState([
    {
      type: 'bot',
      content: 'Hello! 👋 I\'m your AI health assistant. I can help you understand your medical reports, explain medical terms, and answer health-related questions. How can I help you today?',
      timestamp: new Date()
    }
  ])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [selectedReport, setSelectedReport] = useState(null)
  const messagesEndRef = useRef(null)

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const handleSend = async (e) => {
    e.preventDefault()
    if (!input.trim() || loading) return

    const userMessage = {
      type: 'user',
      content: input,
      timestamp: new Date()
    }

    setMessages(prev => [...prev, userMessage])
    setInput('')
    setLoading(true)

    try {
      const response = await chatService.chatbotQuery(input, selectedReport)
      
      const botMessage = {
        type: 'bot',
        content: response.answer,
        timestamp: new Date()
      }

      setMessages(prev => [...prev, botMessage])
    } catch (error) {
      const errorMessage = {
        type: 'bot',
        content: 'I apologize, but I encountered an error processing your request. Please try again.',
        timestamp: new Date()
      }
      setMessages(prev => [...prev, errorMessage])
    } finally {
      setLoading(false)
    }
  }

  const quickQuestions = [
    'What does my latest report say?',
    'Explain my abnormalities',
    'What is my risk level?',
    'What should I do next?',
    'Explain medical terms in simple words'
  ]

  const handleQuickQuestion = (question) => {
    setInput(question)
  }

  return (
    <Layout>
      <div className="max-w-4xl mx-auto h-[calc(100vh-180px)]">
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 h-full flex flex-col">
          {/* Header */}
          <div className="p-4 border-b border-gray-200 bg-gradient-to-r from-purple-600 to-blue-600 rounded-t-xl">
            <div className="flex items-center gap-3 text-white">
              <div className="text-3xl">🤖</div>
              <div>
                <h1 className="font-bold text-lg">AI Health Assistant</h1>
                <p className="text-sm text-purple-200">Ask me anything about your health reports</p>
              </div>
            </div>
          </div>

          {/* Report Selector */}
          {reports.length > 0 && (
            <div className="p-3 border-b border-gray-200 bg-gray-50">
              <label className="text-sm text-gray-600 mr-2">Context:</label>
              <select
                value={selectedReport?._id || ''}
                onChange={(e) => {
                  const report = reports.find(r => r._id === e.target.value)
                  setSelectedReport(report || null)
                }}
                className="px-3 py-1 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">General Questions</option>
                {reports.map((report) => (
                  <option key={report._id} value={report._id}>
                    {report.fileName} - {report.reportType}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {messages.map((msg, index) => (
              <div
                key={index}
                className={`flex ${msg.type === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div className={`flex items-start gap-3 max-w-[80%] ${msg.type === 'user' ? 'flex-row-reverse' : ''}`}>
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm ${
                    msg.type === 'user' ? 'bg-blue-100' : 'bg-purple-100'
                  }`}>
                    {msg.type === 'user' ? '👤' : '🤖'}
                  </div>
                  <div
                    className={`px-4 py-3 rounded-2xl ${
                      msg.type === 'user'
                        ? 'bg-blue-600 text-white rounded-tr-none'
                        : 'bg-gray-100 text-gray-800 rounded-tl-none'
                    }`}
                  >
                    <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
                  </div>
                </div>
              </div>
            ))}
            
            {loading && (
              <div className="flex justify-start">
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-full bg-purple-100 flex items-center justify-center text-sm">
                    🤖
                  </div>
                  <div className="bg-gray-100 px-4 py-3 rounded-2xl rounded-tl-none">
                    <div className="flex gap-1">
                      <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"></div>
                      <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
                      <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                    </div>
                  </div>
                </div>
              </div>
            )}
            
            <div ref={messagesEndRef} />
          </div>

          {/* Quick Questions */}
          <div className="p-3 border-t border-gray-200 bg-gray-50">
            <div className="flex flex-wrap gap-2">
              {quickQuestions.map((question, index) => (
                <button
                  key={index}
                  onClick={() => handleQuickQuestion(question)}
                  className="px-3 py-1 bg-white border border-gray-300 rounded-full text-xs text-gray-600 hover:bg-gray-100 hover:border-gray-400 transition-colors"
                >
                  {question}
                </button>
              ))}
            </div>
          </div>

          {/* Input */}
          <form onSubmit={handleSend} className="p-4 border-t border-gray-200">
            <div className="flex gap-3">
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Ask about your health reports..."
                className="flex-1 px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
                disabled={loading}
              />
              <button
                type="submit"
                disabled={loading || !input.trim()}
                className="px-6 py-3 bg-blue-600 text-white rounded-xl hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Send
              </button>
            </div>
            <p className="text-xs text-gray-400 mt-2 text-center">
              ⚠️ This AI provides information only. Always consult your doctor for medical advice.
            </p>
          </form>
        </div>
      </div>
    </Layout>
  )
}

export default AIChatbot