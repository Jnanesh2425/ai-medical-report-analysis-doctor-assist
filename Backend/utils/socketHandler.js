const jwt = require('jsonwebtoken');
const User = require('../models/User');

const setupSocket = (io) => {
  // Authentication middleware for socket
  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth.token;
      
      if (!token) {
        return next(new Error('Authentication required'));
      }

      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      const user = await User.findById(decoded.id);

      if (!user) {
        return next(new Error('User not found'));
      }

      socket.user = user;
      next();
    } catch (error) {
      next(new Error('Authentication failed'));
    }
  });

  io.on('connection', (socket) => {
    console.log(`🔌 User connected: ${socket.user.name} (${socket.user.userType})`);

    // Join personal room
    socket.join(`user_${socket.user._id}`);

    // Join role-based room
    if (socket.user.userType === 'doctor') {
      socket.join(`doctor_${socket.user._id}`);
      socket.join('doctors');
    } else {
      socket.join('patients');
    }

    // Handle sending messages
    socket.on('sendMessage', async (data) => {
      const { recipientId, message } = data;
      
      // Emit to recipient
      io.to(`user_${recipientId}`).emit('newMessage', {
        sender: socket.user._id,
        senderName: socket.user.name,
        content: message,
        createdAt: new Date()
      });
    });

    // Handle typing indicator
    socket.on('typing', (data) => {
      socket.to(`user_${data.recipientId}`).emit('userTyping', {
        userId: socket.user._id,
        name: socket.user.name
      });
    });

    // Handle stop typing
    socket.on('stopTyping', (data) => {
      socket.to(`user_${data.recipientId}`).emit('userStopTyping', {
        userId: socket.user._id
      });
    });

    // Handle disconnect
    socket.on('disconnect', () => {
      console.log(`🔌 User disconnected: ${socket.user.name}`);
    });
  });

  return io;
};

module.exports = setupSocket;