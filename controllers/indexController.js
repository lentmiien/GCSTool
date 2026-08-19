const async = require('async');
const axios = require('axios');
var parseString = require('xml2js').parseString;

// Require necessary database models
const {
  sequelize,
  Entry,
  Content,
  User,
  Username,
  Op,
  Staff,
  Holiday,
  Schedule2,
  DailyTaskAssignment,
  DailyTaskType,
  VersionHistory,
  Meeting,
  MeetingComment,
} = require('../sequelize');
const { version: currentVersion } = require('../package.json');
const sanitizeHtml = require('../utils/sanitizeHtml');
const { hashPassword, isTemporaryPassword, verifyPassword } = require('../utils/password');
const { addDays, getJapanToday } = require('../utils/dailyTasks');

const timekeeper = [];

const jpnews = {
  lastupdated: 0,
  data: {}
};

function normalizeJapanPostNews(items, now = new Date()) {
  const normalized = { recent: [], older: [] };
  if (!Array.isArray(items)) {
    return normalized;
  }

  const recentBoundary = new Date(now.getTime() - (30 * 24 * 60 * 60 * 1000));
  items.forEach((item) => {
    const title = item && Array.isArray(item.title) && typeof item.title[0] === 'string'
      ? item.title[0].trim()
      : '';
    const link = item && Array.isArray(item.link) && typeof item.link[0] === 'string'
      ? item.link[0].trim()
      : '';
    const pubDate = item && Array.isArray(item.pubDate) && typeof item.pubDate[0] === 'string'
      ? item.pubDate[0].trim()
      : '';

    let parsedLink;
    try {
      parsedLink = new URL(link);
    } catch (_error) {
      return;
    }
    if (!title || (parsedLink.protocol !== 'http:' && parsedLink.protocol !== 'https:')) {
      return;
    }

    const publishedAt = new Date(pubDate);
    const entry = { title, link: parsedLink.href, pubDate };
    if (
      Number.isFinite(publishedAt.getTime())
      && publishedAt >= recentBoundary
      && publishedAt <= now
    ) {
      normalized.recent.push(entry);
    } else {
      normalized.older.push(entry);
    }
  });

  return normalized;
}

// Load admin data
exports.all = async function (req, res, next) {
  try {
  res.locals.role = req.user.role;
  res.locals.name = req.user.userid;

  // Acquire JP news (at most once every 6 hours)
  if (Date.now() - jpnews.lastupdated > (1000 * 60 * 60 * 6)) {
    jpnews.lastupdated = Date.now();
    axios.get('https://www.post.japanpost.jp/rss/int.xml')
      .then(function (response) {
        // handle success
        jpnews.data['raw'] = response.data;
        // xml to json
        parseString(response.data, (err, result) => {
          if (err || !result || !result.rss || !result.rss.channel || !result.rss.channel[0]) {
            console.error('Failed to parse Japan Post news feed:', err || 'Unexpected feed structure');
            return;
          }
          jpnews.data['json'] = Array.isArray(result.rss.channel[0].item) ? result.rss.channel[0].item : [];
        });
      })
      .catch(function (error) {
        // handle error
        console.log(error);
      });
  }
  res.locals.jp = jpnews.data['json'];

  // Time keeper
  if (req.user.userid) {
    const d = new Date(Date.now() + (1000 * 60 * 60 * 9)); // +9 hours for Japanese time
    let exist = false;
    const dstr = `${d.getFullYear()}-${d.getMonth() > 8 ? d.getMonth() + 1 : '0' + (d.getMonth() + 1)}-${d.getDate() > 9 ? d.getDate() : '0' + d.getDate()}`;
    timekeeper.forEach((entry) => {
      if (entry.datestr === dstr) {
        exist = true;
        if (entry[req.user.userid]) {
          entry[req.user.userid].last = Date.now();
        } else {
          entry[req.user.userid] = {
            first: Date.now(),
            last: Date.now(),
          };
        }
      }
    });
    if (!exist) {
      // Create new
      const input = { datestr: dstr };
      input[req.user.userid] = {
        first: Date.now(),
        last: Date.now(),
      };
      timekeeper.push(input);

      // Remove old entries
      if (timekeeper.length > 31) {
        timekeeper.shift();
      }
    }
  }

  // Load workschedule
  res.locals.workschedule = { days: [] };
  const schedule = await Staff.findAll({ include: [{ model: Schedule2 }], where: { name: req.user.userid } });
  const workScheduleToday = getJapanToday();
  for(let i = 0; i < 7; i++) {
    res.locals.workschedule.days.push({
      category: null,
      date: addDays(workScheduleToday, i),
      schedule: null
    });
  }
  if (schedule.length > 0 && Array.isArray(schedule[0].schedule2s)) {
    for(let i = 0; i < res.locals.workschedule.days.length; i++) {
      schedule[0].schedule2s.forEach(s => {
        if(s.date == res.locals.workschedule.days[i].date) {
          // full / mix / off
          res.locals.workschedule.days[i].category = s.work.indexOf('work') >= 0 ? 'ws_full' : (s.work == 'off' || s.work == 'holiday' || s.work == 'vacation') ? 'ws_off' : 'ws_mix';
          res.locals.workschedule.days[i].schedule = s.work;
        }
      });
    }
  }

  const workScheduleStart = res.locals.workschedule.days[0].date;
  const workScheduleEnd = res.locals.workschedule.days[res.locals.workschedule.days.length - 1].date;
  const personalTaskAssignments = await DailyTaskAssignment.findAll({
    where: {
      assigneeUserId: req.user.id,
      date: { [Op.between]: [workScheduleStart, workScheduleEnd] },
    },
    include: [{
      model: DailyTaskType,
      as: 'taskType',
      attributes: ['id', 'name', 'team', 'archived'],
      required: true,
    }],
    order: [['date', 'ASC'], ['taskTypeId', 'ASC']],
  });
  const personalTasksByDate = {};
  personalTaskAssignments.forEach((assignmentRecord) => {
    const assignment = assignmentRecord.get({ plain: true });
    if (!personalTasksByDate[assignment.date]) {
      personalTasksByDate[assignment.date] = [];
    }
    personalTasksByDate[assignment.date].push({
      id: assignment.id,
      name: assignment.taskType.name,
      team: assignment.taskType.team,
      archived: assignment.taskType.archived,
    });
  });
  res.locals.workschedule.days.forEach((day) => {
    day.tasks = (personalTasksByDate[day.date] || []).map((task) => ({
      ...task,
      hasConflict: day.category === 'ws_off',
    }));
  });

  // Holiday schedule next week
  res.locals.holidays_next_week = [];
  const date_lookup = [];
  const staff_schedule = await Staff.findAll({ include: [{ model: Schedule2 }] });
  const holidays = await Holiday.findAll();
  const names = await Username.findAll();
  const work_statuses = ["work", "halfoff_e", "halfoff_m", "2hoff_e", "2hoff_m", "telwork"];

  const d = new Date();
  const sd = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const ed = new Date(d.getFullYear(), d.getMonth(), d.getDate() + 10);
  const sd_str = `${sd.getFullYear()}-${sd.getMonth() > 8 ? (sd.getMonth()+1) : '0'+(sd.getMonth()+1)}-${sd.getDate() > 9 ? sd.getDate() : '0'+sd.getDate()}`;
  const ed_str = `${ed.getFullYear()}-${ed.getMonth() > 8 ? (ed.getMonth()+1) : '0'+(ed.getMonth()+1)}-${ed.getDate() > 9 ? ed.getDate() : '0'+ed.getDate()}`;

  const namesLookup = {};
  for (let i = 0; i < names.length; i++) {
    namesLookup[names[i].userid] = names[i].name;
  }

  holidays.forEach(h => {
    if (h.date >= sd_str && h.date <= ed_str) {
      date_lookup.push(h.date);
      res.locals.holidays_next_week.push({
        date: h.date,
        work_staff: [],
        staff_names: [],
        message_title: "",
        message_body: "",
      });
    }
  });
  staff_schedule.forEach(s => {
    s.schedule2s.forEach(c => {
      //{date, work}
      const index = date_lookup.indexOf(c.date);
      if (index >= 0) {
        // off, vacation, holiday
        // work, halfoff_e, halfoff_m, 2hoff_e, 2hoff_m, telwork
        if (work_statuses.indexOf(c.work) >= 0) {
          res.locals.holidays_next_week[index].work_staff.push(s.name);
          res.locals.holidays_next_week[index].staff_names.push(namesLookup[s.name] ? namesLookup[s.name] : `[${s.name}]`);
        }
      }
    });
  });
  const months = ["１", "２", "３", "４", "５", "６", "７", "８", "９", "１０", "１１", "１２"];
  const dates = ["０", "１", "２", "３", "４", "５", "６", "７", "８", "９", "１０", "１１", "１２", "１３", "１４", "１５", "１６", "１７", "１８", "１９", "２０", "２１", "２２", "２３", "２４", "２５", "２６", "２７", "２８", "２９", "３０", "３１"];
  const days = ["日", "月", "火", "水", "木", "金", "土"];
  for (let i = 0; i < res.locals.holidays_next_week.length; i++) {
    const hd = new Date(res.locals.holidays_next_week[i].date);
    res.locals.holidays_next_week[i].message_title = `依頼／${months[hd.getMonth()]}月${dates[hd.getDate()]}日の在宅勤務　リモート制限解除（ＶＰＮ接続）`;
    res.locals.holidays_next_week[i].message_body = `ＶＰＮ接続を維持してください。||${months[hd.getMonth()]}月${dates[hd.getDate()]}日（${days[hd.getDay()]}）：|${res.locals.holidays_next_week[i].staff_names.join('|')}`;
  }

  next();
  } catch (error) {
    next(error);
  }
};

exports.view_timekeeper = (req, res) => {
  if (req.user.role === 'admin') {
    timekeeper.sort((a, b) => {
      if (a.datestr < b.datestr) {
        return 1;
      } else if (a.datestr > b.datestr) {
        return -1;
      } else {
        return 0;
      }
    });
    res.render('timekeeper', { timekeeper });
  } else {
    res.redirect('/');
  }
};

exports.index = async function (req, res, next) {
  let d = new Date();
  d = new Date(d.getFullYear(), d.getMonth() - 1, d.getDate());
  try {
    const where = {
      team: req.user.team,
      updatedAt: {
        [Op.gt]: d,
      },
    };
    if (req.user.role !== 'admin') {
      where[Op.or] = [
        { ismaster: true },
        { creator: req.user.userid },
      ];
    }

    const entries = await Entry.findAll({
      include: [{ model: Content }],
      order: [['updatedAt', 'DESC']],
      where,
    });

    const visibleEntries = entries.map((entryInstance) => {
      const entry = entryInstance.get({ plain: true });
      if (Array.isArray(entry.contents)) {
        entry.contents.sort((left, right) => left.id - right.id);
      }
      if (entry.category === 'manual' && Array.isArray(entry.contents)) {
        entry.contents.forEach((content) => {
          content.sanitizedData = sanitizeHtml(content.data);
        });
      }
      return entry;
    });
    return res.render('index', {
      entries: visibleEntries,
      japanPostNews: normalizeJapanPostNews(res.locals.jp),
    });
  } catch (error) {
    return next(error);
  }
};

exports.change_password_get = function (req, res) {
  return res.render('change_password', {
    pagetitle: 'Change password · GCS Support Tool',
    passwordChangeRequired: isTemporaryPassword(req.user.password),
  });
};

exports.change_password_post = async function (req, res, next) {
  const currentPassword = typeof req.body.currentPassword === 'string' ? req.body.currentPassword : '';
  const newPassword = typeof req.body.newPassword === 'string' ? req.body.newPassword : '';
  const confirmPassword = typeof req.body.confirmPassword === 'string' ? req.body.confirmPassword : '';
  const renderError = (status, error) => res.status(status).render('change_password', {
    pagetitle: 'Change password · GCS Support Tool',
    passwordChangeRequired: isTemporaryPassword(req.user.password),
    error,
  });

  if (!currentPassword || currentPassword.length > 128) {
    return renderError(400, 'Enter your current password.');
  }
  if (newPassword.length < 12 || newPassword.length > 128) {
    return renderError(400, 'Your new password must contain between 12 and 128 characters.');
  }
  if (newPassword !== confirmPassword) {
    return renderError(400, 'The new password and confirmation do not match.');
  }

  try {
    if (!(await verifyPassword(currentPassword, req.user.password))) {
      return renderError(400, 'The current password is incorrect.');
    }
    if (await verifyPassword(newPassword, req.user.password)) {
      return renderError(400, 'Choose a new password that is different from your current password.');
    }

    const password = await hashPassword(newPassword);
    await req.user.update({ password });
    return res.redirect('/');
  } catch (error) {
    return next(error);
  }
};

function parseVersionHistoryItems(entry) {
  try {
    const items = JSON.parse(entry.changesJson || '[]');
    return Array.isArray(items) ? items : [];
  } catch (err) {
    return [];
  }
}

function isNewerVersion(version, referenceVersion) {
  // Release notes newer than the running package describe work that is not deployed yet.
  const versionPattern = /^\d+(?:\.\d+)*$/;
  if (!versionPattern.test(version) || !versionPattern.test(referenceVersion)) {
    return false;
  }

  const versionParts = version.split('.').map(Number);
  const referenceParts = referenceVersion.split('.').map(Number);
  const partCount = Math.max(versionParts.length, referenceParts.length);

  for (let i = 0; i < partCount; i++) {
    const versionPart = versionParts[i] || 0;
    const referencePart = referenceParts[i] || 0;

    if (versionPart !== referencePart) {
      return versionPart > referencePart;
    }
  }

  return false;
}

exports.about = async function (req, res, next) {
  try {
    const today = new Date().toISOString().slice(0, 10);
    const entries = await VersionHistory.findAll({
      order: [['sortOrder', 'ASC'], ['version', 'DESC']],
    });
    const updates = entries.map((entry) => {
      const hasFutureReleaseDate = entry.releaseDate && String(entry.releaseDate) > today;
      const isUpcoming = hasFutureReleaseDate || isNewerVersion(entry.version, currentVersion);
      return {
        version: entry.version,
        releaseDate: entry.releaseDate,
        updateDate: entry.updateDate,
        items: parseVersionHistoryItems(entry),
        isCurrent: entry.version === currentVersion && !isUpcoming,
        isUpcoming,
      };
    });
    res.render('about', {
      currentVersion,
      pagetitle: 'About GCS Support Tool',
      updates,
    });
  } catch (err) {
    next(err);
  }
};

exports.admin_get = async function (req, res) {
  if (req.user.role !== 'admin') {
    return res.status(403).render('admin', { users: [], error: 'Administrator access is required.' });
  }

  try {
    const userRecords = await User.findAll({
      attributes: ['id', 'userid', 'password', 'team', 'role'],
      order: [['userid', 'ASC']],
    });
    const users = userRecords.map((user) => ({
      id: user.id,
      userid: user.userid,
      team: user.team,
      role: user.role,
      hasPassword: typeof user.password === 'string' && user.password.length > 0,
      passwordChangeRequired: isTemporaryPassword(user.password),
    }));
    res.render('admin', { users });
  } catch (error) {
    console.error('Failed to load users:', error);
    res.render('admin', { users: [], error: 'Failed to load users.' });
  }
};

exports.adduser = async (req, res, next) => {
  if (req.user.role !== 'admin') {
    return res.status(403).render('s_added', { message: 'Only admin staff can add users...' });
  }

  const userid = typeof req.body.newuserid === 'string' ? req.body.newuserid.trim() : '';
  const password = typeof req.body.newpassword === 'string' ? req.body.newpassword : '';
  const allowedTeams = ['ohami_gcs_mail', 'ohami_gcs_order', 'ohami_gcs_korea', 'ohami_gcs_boss'];
  const allowedRoles = ['user', 'admin'];
  if (
    !userid ||
    userid.length > 100 ||
    password.length < 12 ||
    password.length > 128 ||
    !allowedTeams.includes(req.body.newteam) ||
    !allowedRoles.includes(req.body.newrole)
  ) {
    return res.status(400).render('s_added', {
      message: 'Enter a valid user ID and a temporary password between 12 and 128 characters.',
    });
  }

  try {
    const hashedPassword = await hashPassword(password, { temporary: true });
    const created = await sequelize.transaction(async (transaction) => {
      const existing = await User.findOne({
        where: { userid },
        transaction,
        lock: transaction.LOCK.UPDATE,
      });
      if (existing) {
        return false;
      }
      await User.create({
        userid,
        password: hashedPassword,
        team: req.body.newteam,
        role: req.body.newrole,
      }, { transaction });
      return true;
    });
    if (!created) {
      return res.status(409).render('s_added', { message: 'That user ID is already in use.' });
    }
    return res.redirect('/admin');
  } catch (error) {
    return next(error);
  }
};

exports.change_name = async (req, res, next) => {
  const id_to_change = Number.parseInt(req.params.id, 10);
  const change_to_name = typeof req.body.name === 'string' ? req.body.name.trim() : '';
  if (req.user.role !== 'admin') {
    return res.status(403).json({ status: 'Administrator access is required.' });
  }
  if (!Number.isSafeInteger(id_to_change) || id_to_change <= 1 || !change_to_name || change_to_name.length > 100) {
    return res.status(400).json({ status: 'Invalid user name or ID.' });
  }
  try {
    const result = await sequelize.transaction(async (transaction) => {
      const user = await User.findByPk(id_to_change, {
        transaction,
        lock: transaction.LOCK.UPDATE,
      });
      if (!user) {
        return { status: 404, message: 'User not found.' };
      }

      const duplicate = await User.findOne({
        where: {
          id: { [Op.ne]: id_to_change },
          userid: change_to_name,
        },
        transaction,
        lock: transaction.LOCK.UPDATE,
      });
      if (duplicate) {
        return { status: 409, message: 'That user name is already in use.' };
      }

      const previousName = user.userid;
      if (previousName !== change_to_name) {
        await Promise.all([
          Entry.update({ creator: change_to_name }, { where: { creator: previousName }, transaction }),
          Username.update({ userid: change_to_name }, { where: { userid: previousName }, transaction }),
          Staff.update({ name: change_to_name }, { where: { name: previousName }, transaction }),
          Meeting.update({ created_by: change_to_name }, { where: { created_by: previousName }, transaction }),
          MeetingComment.update({ created_by: change_to_name }, { where: { created_by: previousName }, transaction }),
          DailyTaskAssignment.update(
            { assigneeName: change_to_name },
            { where: { assigneeUserId: id_to_change }, transaction }
          ),
          DailyTaskAssignment.update(
            { assignedByName: change_to_name },
            { where: { assignedByUserId: id_to_change }, transaction }
          ),
        ]);
        await user.update({ userid: change_to_name }, { transaction });
      }

      return { status: 200, message: 'OK' };
    });
    return res.status(result.status).json({ status: result.message });
  } catch (error) {
    return next(error);
  }
};

exports.reset_password = async (req, res, next) => {
  const id_to_reset = Number.parseInt(req.params.id, 10);
  const password = typeof req.body.password === 'string' ? req.body.password : '';
  if (req.user.role !== 'admin') {
    return res.status(403).json({ status: 'Administrator access is required.' });
  }
  if (!Number.isSafeInteger(id_to_reset) || id_to_reset <= 1 || password.length < 12 || password.length > 128) {
    return res.status(400).json({ status: 'Temporary passwords must be between 12 and 128 characters.' });
  }
  try {
    const hashedPassword = await hashPassword(password, { temporary: true });
    const [updatedCount] = await User.update({ password: hashedPassword }, { where: { id: id_to_reset } });
    return res.status(updatedCount ? 200 : 404).json({ status: updatedCount ? 'OK' : 'User not found.' });
  } catch (error) {
    return next(error);
  }
};

exports.change_team = async (req, res, next) => {
  const id_to_change = Number.parseInt(req.params.id, 10);
  const allowedTeams = ['ohami_gcs_mail', 'ohami_gcs_order', 'ohami_gcs_korea', 'ohami_gcs_boss'];
  const change_to_team = req.body.team;
  if (req.user.role !== 'admin') {
    return res.status(403).json({ status: 'Administrator access is required.' });
  }
  if (!Number.isSafeInteger(id_to_change) || id_to_change <= 1 || !allowedTeams.includes(change_to_team)) {
    return res.status(400).json({ status: 'Invalid team or user ID.' });
  }
  try {
    const [updatedCount] = await User.update({ team: change_to_team }, { where: { id: id_to_change } });
    return res.status(updatedCount ? 200 : 404).json({ status: updatedCount ? 'OK' : 'User not found.' });
  } catch (error) {
    return next(error);
  }
};

async function updateUserRole(req, res, next, nextRole) {
  const id_to_change = Number.parseInt(req.params.id, 10);
  if (req.user.role !== 'admin') {
    return res.status(403).json({ status: 'Administrator access is required.' });
  }
  if (!Number.isSafeInteger(id_to_change) || id_to_change <= 1) {
    return res.status(400).json({ status: 'Invalid user ID.' });
  }
  try {
    const [updatedCount] = await User.update({ role: nextRole }, { where: { id: id_to_change } });
    return res.status(updatedCount ? 200 : 404).json({ status: updatedCount ? 'OK' : 'User not found.' });
  } catch (error) {
    return next(error);
  }
}

exports.make_admin = (req, res, next) => updateUserRole(req, res, next, 'admin');

exports.make_user = (req, res, next) => updateUserRole(req, res, next, 'user');

exports.removeuser = async (req, res, next) => {
  if (req.user.role !== 'admin') {
    return res.status(403).render('s_added', { message: 'Only admin staff can remove users...' });
  }
  const userId = Number.parseInt(req.params.userid, 10);
  if (!Number.isSafeInteger(userId) || userId <= 1) {
    return res.redirect('/admin');
  }

  try {
    const user = await User.findByPk(userId);
    if (!user) {
      return res.redirect('/admin');
    }
    const entries = await Entry.findAll({
      where: { creator: user.userid, ismaster: false },
      attributes: ['id'],
    });
    const entryIds = entries.map((entry) => entry.id);
    if (entryIds.length > 0) {
      await Content.destroy({ where: { entryId: entryIds } });
      await Entry.destroy({ where: { id: entryIds } });
    }
    await user.destroy();
    return res.redirect('/admin');
  } catch (error) {
    return next(error);
  }
};
