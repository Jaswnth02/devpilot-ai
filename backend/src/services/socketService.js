const { Server } = require('socket.io');

let io = null;

const init = (server) => {
  io = new Server(server, {
    cors: {
      origin: process.env.CLIENT_URL || 'http://localhost:5173',
      methods: ['GET', 'POST']
    }
  });

  io.on('connection', (socket) => {
    console.log('Client connected to socket:', socket.id);

    // Join user-specific room for individual notifications
    socket.on('join_user', (userId) => {
      if (userId) {
        socket.join(`user_${userId}`);
        console.log(`Socket ${socket.id} joined user_${userId}`);
      }
    });

    // Join project room for project-specific activities
    socket.on('join_project', (projectId) => {
      if (projectId) {
        socket.join(`project_${projectId}`);
        console.log(`Socket ${socket.id} joined project_${projectId}`);
      }
    });

    socket.on('disconnect', () => {
      console.log('Client disconnected:', socket.id);
    });
  });

  return io;
};

const sendNotificationToUser = (userId, notification) => {
  if (io && userId) {
    io.to(`user_${userId}`).emit('notification', notification);
    console.log(`Realtime notification sent to user_${userId}:`, notification.title);
  }
};

const sendUpdateToProject = (projectId, event, data) => {
  if (io && projectId) {
    io.to(`project_${projectId}`).emit(event, data);
    console.log(`Realtime project_${projectId} update [${event}]:`, data);
  }
};

const getIo = () => io;

module.exports = {
  init,
  sendNotificationToUser,
  sendUpdateToProject,
  getIo
};
