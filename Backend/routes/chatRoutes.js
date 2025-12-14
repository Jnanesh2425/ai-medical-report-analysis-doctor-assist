const express = require('express');
const router = express.Router();
const {
  sendMessage,
  getChatHistory,
  getConversations,
  chatbotQuery
} = require('../controllers/chatController');
const { protect } = require('../middleware/authMiddleware');

router.post('/send', protect, sendMessage);
router.get('/history/:userId', protect, getChatHistory);
router.get('/conversations', protect, getConversations);
router.post('/chatbot', protect, chatbotQuery);

module.exports = router;