const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');

const app = express();
const server = http.createServer(app);

// Enable CORS for all routes
app.use(cors({
  origin: "http://localhost:3000",
  methods: ["GET", "POST"],
  credentials: true
}));

const io = socketIo(server, {
  cors: {
    origin: "http://localhost:3000",
    methods: ["GET", "POST"],
    credentials: true
  }
});

// Store connected users
const users = new Map();

app.get('/', (req, res) => {
  res.json({ message: 'WebRTC Signaling Server is running!' });
});

io.on('connection', (socket) => {
  console.log(`User connected: ${socket.id}`);

  // Handle user joining
  socket.on('join', (data) => {
    const { name } = data;
    users.set(socket.id, { id: socket.id, name });
    
    console.log(`User ${name} joined with ID: ${socket.id}`);
    
    // Send the full user list to all clients (they'll filter themselves)
    const userList = Array.from(users.values());
    io.emit('users', userList);
  });

  // Handle WebRTC offer
  socket.on('offer', (data) => {
    const { to, offer } = data;
    console.log(`Offer from ${socket.id} to ${to}`);
    socket.to(to).emit('offer', { from: socket.id, offer });
  });

  // Handle WebRTC answer
  socket.on('answer', (data) => {
    const { to, answer } = data;
    console.log(`Answer from ${socket.id} to ${to}`);
    socket.to(to).emit('answer', { answer });
  });

  // Handle ICE candidates
  socket.on('ice-candidate', (data) => {
    const { candidate } = data;
    console.log(`ICE candidate from ${socket.id}`);
    socket.broadcast.emit('ice-candidate', { candidate });
  });

  // Handle call end
  socket.on('end-call', () => {
    console.log(`Call ended by ${socket.id}`);
    socket.broadcast.emit('call-ended');
  });

  // Handle disconnection
  socket.on('disconnect', () => {
    console.log(`User disconnected: ${socket.id}`);
    users.delete(socket.id);
    
    // Notify all remaining users about the updated user list
    const userList = Array.from(users.values());
    io.emit('users', userList);
  });

  // Handle errors
  socket.on('error', (error) => {
    console.error(`Socket error for ${socket.id}:`, error);
  });
});

const PORT = process.env.PORT || 3001;

server.listen(PORT, () => {
  console.log(`WebRTC Signaling Server running on port ${PORT}`);
  console.log(`Server URL: http://localhost:${PORT}`);
});

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\nReceived SIGINT. Graceful shutdown...');
  server.close(() => {
    console.log('Server closed.');
    process.exit(0);
  });
});

process.on('SIGTERM', () => {
  console.log('\nReceived SIGTERM. Graceful shutdown...');
  server.close(() => {
    console.log('Server closed.');
  });
});
