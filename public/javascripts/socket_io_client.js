document.addEventListener('DOMContentLoaded', () => {
  // Connect to the Socket.IO server
  const socket = io();

  // Handle connection errors
  socket.on('connect_error', (error) => {
    console.log('Connection error:', error.message);
  });

  // Handle connection success
  socket.on('connect', () => {
    console.log('Connected to the server');
  });

  // Handle server messages
  socket.on('message', (data) => {
    console.log('Message from the server:', data);
  });

  // Handle disconnection
  socket.on('disconnect', () => {
    console.log('Disconnected from the server');
  });
});