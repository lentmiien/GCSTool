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

async function createMeeting(title, created_by, content, status) {
  /*
    title: type.STRING,
    created_by: type.STRING,
    content: type.TEXT,
    status: type.STRING,
  */
  try {
    const newMeeting = await Meeting.create({ title, created_by, content, status });
    return newMeeting.dataValues;
  } catch (err) {
    console.log(err);
    throw err;
  }
}

async function createMeetingComment(meeting_id, created_by, content) {
  /*
    meeting_id: type.INTEGER,
    created_by: type.STRING,
    content: type.TEXT,
  */
  try {
    const newMeetingComment = await MeetingComment.create({ meeting_id, created_by, content });
    return newMeetingComment.dataValues;
  } catch (err) {
    console.log(err);
    throw err;
  }
}

async function updateMeeting(id, content, status) {
  /*
    title: type.STRING,
    created_by: type.STRING,
    content: type.TEXT,
    status: type.STRING,
  */
  // find
  const job = await Meeting.findOne({ where: { id: id } });
  if (!job) {
    throw Error(`Job not updated. id: ${id}`);
  }

  // update
  job.content = content;
  job.status = status;
  await job.save();

  // return
  return job;
}

async function updateMeetingComment(id, content, status) {
  /*
    meeting_id: type.INTEGER,
    created_by: type.STRING,
    content: type.TEXT,
  */
  // find
  const job = await MeetingComment.findOne({ where: { id: id } });
  if (!job) {
    throw Error(`Job not updated. id: ${id}`);
  }

  // update
  job.content = content;
  await job.save();

  // return
  return job;
}

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
    socket.on('meeting_new', async (data) => {
      // name, title, content, comment
      // Save new meeting database entry
      const meeting = await createMeeting(data.title, data.name, data.content, 'new');
      // Save new meeting comment database entry (if given)
      meeting['comments'] = [];
      if (data.comment.length > 0) {
        const comment = await createMeetingComment(meeting.id, data.name, data.comment);
        meeting['comments'].push(comment);
      }

      // Emit: new database entries
      io.emit('server_response', { newMeeting: [meeting], updateMeeting: [], newComment: [], updateComment: [] });
    });
    socket.on('meeting_update', async (data) => {
      // name, id, content, status
      // Update meeting database entry
      const meeting = await updateMeeting(data.id, data.content, data.status);

      // Emit: database entry
      io.emit('server_response', { newMeeting: [], updateMeeting: [meeting], newComment: [], updateComment: [] });
    });
    socket.on('comment_add', async (data) => {
      // name, id, comment
      // Save new meeting comment database entry
      const comment = await createMeetingComment(data.id, data.name, data.comment);

      // Emit: new database entry
      io.emit('server_response', { newMeeting: [], updateMeeting: [], newComment: [comment], updateComment: [] });
    });
    socket.on('comment_update', async (data) => {
      // id, comment
      // Update meeting comment database entry
      const comment = await updateMeetingComment(data.id, data.comment);

      // Emit: database entry
      io.emit('server_response', { newMeeting: [], updateMeeting: [], newComment: [], updateComment: [comment] });
    });

    socket.on('disconnect', () => {
      console.log('User disconnected:', socket.request.session.passport.user);
    });
  });
};
