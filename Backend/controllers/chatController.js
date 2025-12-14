const Message = require('../models/Message');
const User = require('../models/User');
const Report = require('../models/Report');
const aiService = require('../services/aiService');

// @desc    Send message
// @route   POST /api/chat/send
// @access  Private
exports.sendMessage = async (req, res) => {
  try {
    const { recipientId, content, messageType, reportId } = req.body;

    if (!recipientId || !content) {
      return res.status(400).json({
        success: false,
        message: 'Recipient and content are required'
      });
    }

    const message = await Message.create({
      sender: req.user._id,
      recipient: recipientId,
      content,
      messageType: messageType || 'text',
      relatedReport: reportId
    });

    const populatedMessage = await Message.findById(message._id)
      .populate('sender', 'name userType')
      .populate('recipient', 'name userType');

    // Emit socket event for real-time messaging
    if (global.io) {
      global.io.to(`user_${recipientId}`).emit('newMessage', populatedMessage);
    }

    res.status(201).json({
      success: true,
      message: populatedMessage
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to send message',
      error: error.message
    });
  }
};

// @desc    Get chat history with a user
// @route   GET /api/chat/history/:userId
// @access  Private
exports.getChatHistory = async (req, res) => {
  try {
    const { userId } = req.params;

    const messages = await Message.find({
      $or: [
        { sender: req.user._id, recipient: userId },
        { sender: userId, recipient: req.user._id }
      ]
    })
      .populate('sender', 'name userType')
      .populate('recipient', 'name userType')
      .sort({ createdAt: 1 });

    // Mark messages as read
    await Message.updateMany(
      { sender: userId, recipient: req.user._id, read: false },
      { read: true, readAt: new Date() }
    );

    res.status(200).json({
      success: true,
      messages
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to fetch chat history',
      error: error.message
    });
  }
};

// @desc    Get all conversations
// @route   GET /api/chat/conversations
// @access  Private
exports.getConversations = async (req, res) => {
  try {
    let conversations = [];

    if (req.user.userType === 'patient') {
      // Get patient's assigned doctor
      const patient = await User.findById(req.user._id).populate('assignedDoctor', 'name email specialization');
      
      if (patient.assignedDoctor) {
        const unreadCount = await Message.countDocuments({
          sender: patient.assignedDoctor._id,
          recipient: req.user._id,
          read: false
        });

        const lastMessage = await Message.findOne({
          $or: [
            { sender: req.user._id, recipient: patient.assignedDoctor._id },
            { sender: patient.assignedDoctor._id, recipient: req.user._id }
          ]
        }).sort({ createdAt: -1 });

        conversations.push({
          _id: patient.assignedDoctor._id,
          name: patient.assignedDoctor.name,
          email: patient.assignedDoctor.email,
          specialization: patient.assignedDoctor.specialization,
          unreadCount,
          lastMessage: lastMessage?.content
        });
      }
    } else {
      // Get doctor's patients
      const doctor = await User.findById(req.user._id).populate('patients', 'name email phone');
      
      for (const patient of doctor.patients) {
        const unreadCount = await Message.countDocuments({
          sender: patient._id,
          recipient: req.user._id,
          read: false
        });

        const lastMessage = await Message.findOne({
          $or: [
            { sender: req.user._id, recipient: patient._id },
            { sender: patient._id, recipient: req.user._id }
          ]
        }).sort({ createdAt: -1 });

        conversations.push({
          _id: patient._id,
          name: patient.name,
          email: patient.email,
          phone: patient.phone,
          unreadCount,
          lastMessage: lastMessage?.content
        });
      }
    }

    res.status(200).json({
      success: true,
      conversations
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to fetch conversations',
      error: error.message
    });
  }
};

// @desc    AI Chatbot query
// @route   POST /api/chat/chatbot
// @access  Private
exports.chatbotQuery = async (req, res) => {
  try {
    const { question, reportId } = req.body;

    if (!question) {
      return res.status(400).json({
        success: false,
        message: 'Question is required'
      });
    }

    let reportContext = null;

    if (reportId) {
      const report = await Report.findById(reportId);
      if (report) {
        reportContext = {
          summary: report.summary,
          keyFindings: report.keyFindings,
          abnormalities: report.abnormalities,
          riskLevel: report.riskLevel,
          reportType: report.reportType
        };
      }
    }

    const answer = await aiService.chatbotQuery(question, reportContext);

    res.status(200).json({
      success: true,
      answer
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to process query',
      error: error.message
    });
  }
};