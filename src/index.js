// src/index.js
require('dotenv').config();
const express = require('express');
const path = require('path');
const http = require('http');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// serve frontend
app.use(express.static(path.join(__dirname, '..', 'public')));

// basic health route
app.get('/health', (req, res) => res.json({ status: 'ok' }));

// mount existing routes (upload)
const uploadRouter = require('./routes/upload');
app.use('/api', uploadRouter);

// Initialize HTTP server and Socket.IO
const { Server } = require('socket.io');

const server = http.createServer(app);
const io = new Server(server, { 
  cors: { 
    origin: '*',
    methods: ['GET', 'POST']
  } 
});

// Store io instance for route access
app.set('io', io);

// Socket.IO connection handling
io.on('connection', (socket) => {
  console.log('socket.io: client connected', socket.id);
  
  socket.on('disconnect', () => {
    console.log('socket.io: client disconnected', socket.id);
  });
  
  // Optional: allow clients to join patient-specific rooms
  socket.on('join:patient', (patientId) => {
    socket.join(`patient:${patientId}`);
    console.log(`socket.io: ${socket.id} joined room patient:${patientId}`);
  });
});

// Mount alert routes
const alertsRouter = require('./alerts/alertsRouter');
const insightsRouter = require('./alerts/insightsRouter');
app.use('/api', alertsRouter);
app.use('/api', insightsRouter);

// Start server
server.listen(PORT, () => {
  console.log(`✓ Server running on http://localhost:${PORT}`);
  console.log(`✓ Socket.IO enabled for real-time alerts`);
});
