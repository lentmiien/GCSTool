/*************************************
 *
 * meeting update functionality
 *
 * Consider adding some announcement system (notification to all users)
 *
 */

const socketIO = require('socket.io');
const { isTemporaryPassword } = require('./utils/password');

// Require necessary database models
const { Meeting, MeetingComment, User } = require('./sequelize');

const MEETING_STATUSES = new Set(['new', 'prosessing', 'onhold', 'completed', 'discontinued']);
const MAX_TITLE_LENGTH = 255;
const MAX_MEETING_CONTENT_LENGTH = 50000;
const MAX_COMMENT_LENGTH = 10000;
const OPERATION_ERROR_MESSAGE = 'The requested operation could not be completed.';

function requirePayload(data) {
  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    throw new Error('Invalid socket payload.');
  }
  return data;
}

function requirePositiveId(value, fieldName) {
  let id = value;
  if (typeof value === 'string' && /^[1-9]\d*$/.test(value)) {
    id = Number(value);
  } else if (typeof value !== 'number') {
    throw new Error(`Invalid ${fieldName}.`);
  }

  if (!Number.isSafeInteger(id) || id <= 0) {
    throw new Error(`Invalid ${fieldName}.`);
  }
  return id;
}

function requireString(value, fieldName, maxLength, options = {}) {
  if (typeof value !== 'string') {
    throw new Error(`Invalid ${fieldName}.`);
  }

  const normalized = options.trim ? value.trim() : value;
  if (!options.allowEmpty && normalized.trim().length === 0) {
    throw new Error(`${fieldName} is required.`);
  }
  if (normalized.length > maxLength || Buffer.byteLength(normalized, 'utf8') > maxLength) {
    throw new Error(`${fieldName} is too long.`);
  }
  return normalized;
}

function optionalString(value, fieldName, maxLength) {
  if (value === undefined) {
    return '';
  }
  return requireString(value, fieldName, maxLength, { allowEmpty: true });
}

function requireMeetingStatus(value) {
  if (typeof value !== 'string' || !MEETING_STATUSES.has(value)) {
    throw new Error('Invalid meeting status.');
  }
  return value;
}

function reloadSession(socket) {
  const currentSession = socket.request && socket.request.session;
  if (!currentSession || typeof currentSession.reload !== 'function') {
    return Promise.resolve();
  }

  return new Promise((resolve, reject) => {
    currentSession.reload((error) => {
      if (error) {
        reject(error);
        return;
      }
      resolve();
    });
  });
}

async function resolveActor(socket, reload = false) {
  if (reload) {
    await reloadSession(socket);
  }

  const sessionUserId = socket.request
    && socket.request.session
    && socket.request.session.passport
    && socket.request.session.passport.user;
  const userId = requirePositiveId(sessionUserId, 'authenticated user');
  const user = await User.findByPk(userId, {
    attributes: ['id', 'userid', 'role', 'password'],
  });

  if (!user || typeof user.userid !== 'string' || user.userid.length === 0) {
    throw new Error('Authenticated user was not found.');
  }
  if (isTemporaryPassword(user.password)) {
    throw new Error('Password change is required.');
  }

  return {
    id: user.id,
    userid: user.userid,
    role: user.role,
  };
}

function registerSocketHandler(socket, eventName, handler) {
  socket.on(eventName, (data) => {
    Promise.resolve()
      .then(async () => {
        const actor = await resolveActor(socket, true);
        socket.data.actor = actor;
        await handler(data, actor);
      })
      .catch((error) => {
        const actorId = socket.data.actor ? socket.data.actor.id : 'unknown';
        console.error(`Socket operation failed [${eventName}] for user ${actorId}:`, error);
        socket.emit('operation_error', {
          operation: eventName,
          message: OPERATION_ERROR_MESSAGE,
        });
      });
  });
}

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
    const meeting = await Meeting.findByPk(meeting_id, { attributes: ['id'] });
    if (!meeting) {
      throw new Error(`Meeting not found. id: ${meeting_id}`);
    }

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

async function updateMeetingComment(id, content, actor) {
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

  if (actor.role !== 'admin' && job.created_by !== actor.userid) {
    throw new Error('Comment update is not permitted.');
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
    sessionMiddleware(socket.request, socket.request.res || {}, next);
  });
  io.use(async (socket, next) => {
    try {
      socket.data.actor = await resolveActor(socket);
      next();
    } catch (error) {
      console.error('Socket authentication failed:', error);
      next(new Error('Authentication error'));
    }
  });

  // Socket.IO connection handling
  io.on('connection', (socket) => {
    console.log('Authenticated user connected:', socket.data.actor.id);

    /***********
     * Meeting *
     ***********/
    registerSocketHandler(socket, 'meeting_new', async (data, actor) => {
      const payload = requirePayload(data);
      const title = requireString(payload.title, 'meeting title', MAX_TITLE_LENGTH, { trim: true });
      const content = requireString(
        payload.content,
        'meeting content',
        MAX_MEETING_CONTENT_LENGTH,
        { allowEmpty: true }
      );
      const commentContent = optionalString(payload.comment, 'meeting comment', MAX_COMMENT_LENGTH);

      // Save new meeting database entry
      const meeting = await createMeeting(title, actor.userid, content, 'new');
      // Save new meeting comment database entry (if given)
      meeting['comments'] = [];
      if (commentContent.trim().length > 0) {
        const comment = await createMeetingComment(meeting.id, actor.userid, commentContent);
        meeting['comments'].push(comment);
      }

      // Emit: new database entries
      io.emit('server_response', { newMeeting: [meeting], updateMeeting: [], newComment: [], updateComment: [] });
    });
    registerSocketHandler(socket, 'meeting_update', async (data) => {
      const payload = requirePayload(data);
      const meetingId = requirePositiveId(payload.id, 'meeting id');
      const content = requireString(
        payload.content,
        'meeting content',
        MAX_MEETING_CONTENT_LENGTH,
        { allowEmpty: true }
      );
      const status = requireMeetingStatus(payload.status);

      // Update meeting database entry
      const meeting = await updateMeeting(meetingId, content, status);

      // Emit: database entry
      io.emit('server_response', { newMeeting: [], updateMeeting: [meeting], newComment: [], updateComment: [] });
    });
    registerSocketHandler(socket, 'comment_add', async (data, actor) => {
      const payload = requirePayload(data);
      const meetingId = requirePositiveId(payload.id, 'meeting id');
      const commentContent = requireString(payload.comment, 'meeting comment', MAX_COMMENT_LENGTH);

      // Save new meeting comment database entry
      const comment = await createMeetingComment(meetingId, actor.userid, commentContent);

      // Emit: new database entry
      io.emit('server_response', { newMeeting: [], updateMeeting: [], newComment: [comment], updateComment: [] });
    });
    registerSocketHandler(socket, 'comment_update', async (data, actor) => {
      const payload = requirePayload(data);
      const commentId = requirePositiveId(payload.id, 'comment id');
      const commentContent = requireString(
        payload.comment,
        'meeting comment',
        MAX_COMMENT_LENGTH,
        { allowEmpty: true }
      );

      // Update meeting comment database entry
      const comment = await updateMeetingComment(commentId, commentContent, actor);

      // Emit: database entry
      io.emit('server_response', { newMeeting: [], updateMeeting: [], newComment: [], updateComment: [comment] });
    });

    socket.on('disconnect', () => {
      console.log('User disconnected:', socket.data.actor ? socket.data.actor.id : 'unknown');
    });
  });
};
