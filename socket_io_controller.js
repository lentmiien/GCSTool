/*************************************
 *
 * version3 TODO
 *
 * meeting update functionality
 *
 * add some announcement system (notification to all users)
 *
 */

const socketIO = require('socket.io');

// Require necessary database models
const { Meeting, MeetingComment } = require('./sequelize');

exports.io = (server, sessionMiddleware) => {
  const io = socketIO(server);

  // Socket.IO middleware to protect connections
  io.use((socket, next) => {
    sessionMiddleware(socket.request, socket.request.res, next);
  });
  io.use((socket, next) => {
    if (socket.request.session.passport && socket.request.session.passport.user) {
      return next();
    }
    return next(new Error('Authentication error'));
  });

  // Socket.IO connection handling
  io.on('connection', (socket) => {
    console.log('Authenticated user connected:', socket.request.session.passport.user);

    /***********
     * Meeting *
     ***********/
    socket.on('meeting_new', (data) => {
      console.log(data);
      // Save new meeting database entry
      // Save new meeting comment database entry (if given)

      // Emit: new database entries
    });
    socket.on('meeting_update', (data) => {
      console.log(data);
      // Update meeting database entry

      // Emit: database entry
    });
    socket.on('comment_add', (data) => {
      console.log(data);
      // Save new meeting comment database entry

      // Emit: new database entry
    });
    socket.on('comment_update', (data) => {
      console.log(data);
      // Update meeting comment database entry

      // Emit: database entry
    });

    socket.on('disconnect', () => {
      console.log('User disconnected:', socket.request.session.passport.user);
    });
  });
};
