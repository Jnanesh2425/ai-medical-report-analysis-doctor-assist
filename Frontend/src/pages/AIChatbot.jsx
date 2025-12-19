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
      <div className="max-w-5xl mx-auto h-[calc(100vh-180px)]">
        <div className="bg-white rounded-xl shadow-lg border border-gray-200 h-full flex flex-col">
          {/* Header */}
          <div className="p-5 border-b border-gray-200 bg-gradient-to-r from-purple-600 to-blue-600">
            <div className="flex items-center gap-3 text-white">
              <div className="w-12 h-12 bg-white/20 rounded-full flex items-center justify-center text-2xl backdrop-blur-sm shadow-lg">
                🤖
              </div>
              <div>
                <h1 className="font-bold text-xl">AI Health Assistant</h1>
                <p className="text-sm text-purple-100">Ask me anything about your health reports</p>
              </div>
            </div>
          </div>

          {/* Report Selector */}
          {reports.length > 0 && (
            <div className="p-4 border-b border-gray-200 bg-gray-50">
              <div className="flex items-center gap-2">
                <label className="text-sm text-gray-600 font-medium">Context:</label>
                <select
                  value={selectedReport?._id || ''}
                  onChange={(e) => {
                    const report = reports.find(r => r._id === e.target.value)
                    setSelectedReport(report || null)
                  }}
                  className="px-4 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 bg-white"
                >
                  <option value="">General Questions</option>
                  {reports.map((report) => (
                    <option key={report._id} value={report._id}>
                      {report.fileName} - {report.reportType}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          )}

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-6 space-y-6 bg-gradient-to-b from-gray-50 to-white">
            {messages.map((msg, index) => (
              <div
                key={index}
                className={`flex ${msg.type === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div className={`flex items-start gap-3 max-w-[75%] ${msg.type === 'user' ? 'flex-row-reverse' : ''}`}>
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center text-lg shadow-md flex-shrink-0 ${
                    msg.type === 'user' 
                      ? 'bg-gradient-to-br from-blue-500 to-blue-600' 
                      : 'bg-gradient-to-br from-purple-500 to-purple-600'
                  }`}>
                    {msg.type === 'user' ? '👤' : '🤖'}
                  </div>
                  <div
                    className={`px-5 py-3 rounded-2xl shadow-sm ${
                      msg.type === 'user'
                        ? 'bg-gradient-to-br from-blue-500 to-blue-600 text-white'
                        : 'bg-white text-gray-800 border border-gray-200'
                    }`}
                  >
                    <p className="text-sm leading-relaxed whitespace-pre-wrap">{msg.content}</p>
                  </div>
                </div>
              </div>
            ))}
            
            {loading && (
              <div className="flex justify-start">
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-purple-500 to-purple-600 flex items-center justify-center text-lg shadow-md">
                    🤖
                  </div>
                  <div className="bg-white border border-gray-200 px-5 py-3 rounded-2xl shadow-sm">
                    <div className="flex gap-1.5">
                      <div className="w-2.5 h-2.5 bg-purple-400 rounded-full animate-bounce"></div>
                      <div className="w-2.5 h-2.5 bg-purple-400 rounded-full animate-bounce" style={{ animationDelay: '0.15s' }}></div>
                      <div className="w-2.5 h-2.5 bg-purple-400 rounded-full animate-bounce" style={{ animationDelay: '0.3s' }}></div>
                    </div>
                  </div>
                </div>
              </div>
            )}
            
            <div ref={messagesEndRef} />
          </div>

          {/* Quick Questions */}
          <div className="p-4 border-t border-gray-200 bg-gray-50">
            <div className="flex flex-wrap gap-2">
              {quickQuestions.map((question, index) => (
                <button
                  key={index}
                  onClick={() => handleQuickQuestion(question)}
                  className="px-4 py-2 bg-white border border-purple-200 rounded-full text-sm text-purple-700 hover:bg-purple-50 hover:border-purple-300 transition-all shadow-sm font-medium"
                >
                  {question}
                </button>
              ))}
            </div>
          </div>

          {/* Input */}
          <form onSubmit={handleSend} className="p-5 border-t border-gray-200 bg-white">
            <div className="flex gap-3">
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Ask about your health reports..."
                className="flex-1 px-5 py-3.5 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent text-sm"
                disabled={loading}
              />
              <button
                type="submit"
                disabled={loading || !input.trim()}
                className="px-8 py-3.5 bg-gradient-to-r from-purple-600 to-blue-600 text-white rounded-xl hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed transition-all font-medium"
              >
                Send
              </button>
            </div>
            <p className="text-xs text-gray-500 mt-3 text-center flex items-center justify-center gap-1.5">
              <svg className="w-4 h-4 text-orange-500" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
              </svg>
              This AI provides information only. Always consult your doctor for medical advice.
            </p>
          </form>
        </div>
      </div>
    </Layout>
  )
}

export default AIChatbot