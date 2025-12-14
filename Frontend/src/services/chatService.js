import api from './api'

export const chatService = {
  sendMessage: async (recipientId, content) => {
    const response = await api.post('/chat/send', {
      recipientId,
      content  // Backend expects 'content', not 'message'
    })
    return response.data
  },

  getChatHistory: async (userId) => {
    const response = await api.get(`/chat/history/${userId}`)
    return response.data
  },

  getConversations: async () => {
    const response = await api.get('/chat/conversations')
    return response.data
  },

  chatbotQuery: async (question, reportContext) => {
    // Correct path: /chat/chatbot (not /ai/chatbot)
    const response = await api.post('/chat/chatbot', {
      question,
      reportContext
    })
    return response.data
  }
}