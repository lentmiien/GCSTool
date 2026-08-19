const {
  DailyTaskAssignment,
  DailyTaskType,
  Holiday,
  Op,
  Schedule2,
  Staff,
  User,
} = require('../sequelize');
const {
  OFF_STATUSES,
  RANGE_OPTIONS,
  TEAM_OPTIONS,
  TEAM_VALUES,
  addDays,
  classifyScheduleStatus,
  formatDateLabel,
  getDayOfWeek,
  getJapanToday,
  getScheduleLabel,
  getTeamLabel,
  isValidDateString,
} = require('../utils/dailyTasks');

const DEFAULT_TEAM = 'ohami_gcs_mail';

function isAdmin(req) {
  return req.user && req.user.role === 'admin';
}

function parsePositiveInteger(value) {
  const normalized = typeof value === 'number' ? String(value) : value;
  if (typeof normalized !== 'string' || !/^\d+$/.test(normalized)) {
    return null;
  }
  const parsed = Number.parseInt(normalized, 10);
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : null;
}

function getViewState(source, postBody = false) {
  const startValue = postBody ? source.viewStart : source.start;
  const daysValue = postBody ? source.viewDays : source.days;
  const teamValue = postBody ? source.viewTeam : source.team;
  const parsedDays = Number.parseInt(daysValue, 10);

  return {
    start: isValidDateString(startValue) ? startValue : getJapanToday(),
    days: RANGE_OPTIONS.includes(parsedDays) ? parsedDays : 14,
    team: teamValue === 'all' || TEAM_VALUES.includes(teamValue) ? teamValue : DEFAULT_TEAM,
  };
}

function buildIndexUrl(source, flashType, message, postBody = true, anchor = '') {
  const state = getViewState(source, postBody);
  const query = new URLSearchParams({
    start: state.start,
    days: String(state.days),
    team: state.team,
  });
  if (flashType && message) {
    query.set(flashType, message);
  }
  const safeAnchor = typeof anchor === 'string' && /^[a-zA-Z0-9-]+$/.test(anchor)
    ? `#${anchor}`
    : '';
  return `/daily-tasks?${query.toString()}${safeAnchor}`;
}

function redirectWithMessage(res, source, flashType, message, anchor = '') {
  return res.redirect(303, buildIndexUrl(source, flashType, message, true, anchor));
}

function resolveScheduleStatus(staff, scheduleByDate, holidayDates, date) {
  if (!staff) {
    return 'no_staff_record';
  }
  if (scheduleByDate[date]) {
    return scheduleByDate[date];
  }
  if (holidayDates.has(date)) {
    return 'holiday';
  }
  return staff[`day${getDayOfWeek(date)}`] || 'not_set';
}

function buildScheduleMap(staffRecord) {
  const lookup = {};
  const schedules = staffRecord && Array.isArray(staffRecord.schedule2s)
    ? staffRecord.schedule2s
    : [];
  schedules.forEach((schedule) => {
    lookup[String(schedule.date)] = schedule.work;
  });
  return lookup;
}

function decorateAssignment(assignment, taskTypesById, usersById, usersWithAvailability) {
  const taskType = taskTypesById[assignment.taskTypeId];
  const currentUser = usersById[assignment.assigneeUserId];
  const availabilityUser = usersWithAvailability[assignment.assigneeUserId];
  const availability = availabilityUser && availabilityUser.availability[assignment.date]
    ? availabilityUser.availability[assignment.date]
    : {
      status: 'no_staff_record',
      label: getScheduleLabel('no_staff_record'),
      category: 'unknown',
    };

  return {
    ...assignment,
    assigneeDisplayName: currentUser ? currentUser.userid : assignment.assigneeName,
    assignedByDisplayName: usersById[assignment.assignedByUserId]
      ? usersById[assignment.assignedByUserId].userid
      : assignment.assignedByName,
    taskTypeName: taskType ? taskType.name : 'Unknown task',
    scheduleStatus: availability.status,
    scheduleLabel: availability.label,
    scheduleCategory: availability.category,
    hasConflict: availability.category === 'off',
  };
}

exports.index = async function (req, res, next) {
  const filters = getViewState(req.query);
  const endDate = addDays(filters.start, filters.days - 1);
  const selectedYear = filters.start.slice(0, 4);
  const yearStart = `${selectedYear}-01-01`;
  const yearEnd = `${selectedYear}-12-31`;
  const today = getJapanToday();
  const typeWhere = filters.team === 'all' ? {} : { team: filters.team };

  try {
    const [taskTypeRecords, userRecords, staffRecords, holidayRecords] = await Promise.all([
      DailyTaskType.findAll({
        where: typeWhere,
        order: [['archived', 'ASC'], ['name', 'ASC']],
      }),
      User.findAll({
        attributes: ['id', 'userid', 'team', 'role'],
        order: [['userid', 'ASC']],
      }),
      Staff.findAll({
        include: [{
          model: Schedule2,
          required: false,
          where: {
            date: { [Op.between]: [filters.start, endDate] },
          },
        }],
        order: [['name', 'ASC']],
      }),
      Holiday.findAll({
        attributes: ['date'],
        where: {
          date: { [Op.between]: [filters.start, endDate] },
        },
      }),
    ]);

    const taskTypes = taskTypeRecords.map((taskTypeRecord) => {
      const taskType = taskTypeRecord.get({ plain: true });
      return {
        ...taskType,
        teamLabel: getTeamLabel(taskType.team),
      };
    });
    const taskTypeIds = taskTypes.map((taskType) => taskType.id);
    const assignmentWhere = taskTypeIds.length
      ? { taskTypeId: { [Op.in]: taskTypeIds } }
      : null;

    const [rangeAssignmentRecords, yearAssignmentRecords] = assignmentWhere
      ? await Promise.all([
        DailyTaskAssignment.findAll({
          where: {
            ...assignmentWhere,
            date: { [Op.between]: [filters.start, endDate] },
          },
          order: [['date', 'ASC'], ['taskTypeId', 'ASC']],
        }),
        DailyTaskAssignment.findAll({
          where: {
            ...assignmentWhere,
            date: { [Op.between]: [yearStart, yearEnd] },
          },
          order: [['date', 'ASC']],
        }),
      ])
      : [[], []];

    const users = userRecords.map((user) => user.get({ plain: true }));
    const usersById = {};
    users.forEach((user) => {
      usersById[user.id] = user;
    });

    const staffByName = {};
    staffRecords.forEach((staffRecord) => {
      const staff = staffRecord.get({ plain: true });
      staff.scheduleByDate = buildScheduleMap(staff);
      staffByName[staff.name] = staff;
    });
    const holidayDates = new Set(holidayRecords.map((holiday) => String(holiday.date)));

    const dates = [];
    for (let dayOffset = 0; dayOffset < filters.days; dayOffset++) {
      const date = addDays(filters.start, dayOffset);
      dates.push({
        date,
        label: formatDateLabel(date),
        isToday: date === today,
      });
    }

    const usersWithAvailability = {};
    users.forEach((user) => {
      const staff = staffByName[user.userid] || null;
      const availability = {};
      dates.forEach((day) => {
        const status = resolveScheduleStatus(
          staff,
          staff ? staff.scheduleByDate : {},
          holidayDates,
          day.date
        );
        availability[day.date] = {
          status,
          label: getScheduleLabel(status),
          category: classifyScheduleStatus(status),
        };
      });
      usersWithAvailability[user.id] = {
        ...user,
        teamLabel: getTeamLabel(user.team),
        shortTeamLabel: getTeamLabel(user.team, true),
        hasStaffRecord: Boolean(staff),
        availability,
      };
    });
    const decoratedUsers = users.map((user) => usersWithAvailability[user.id]);

    const taskTypesById = {};
    taskTypes.forEach((taskType) => {
      taskTypesById[taskType.id] = taskType;
    });
    const rangeAssignments = rangeAssignmentRecords.map((assignment) => decorateAssignment(
      assignment.get({ plain: true }),
      taskTypesById,
      usersById,
      usersWithAvailability
    ));
    const assignmentsBySlot = {};
    rangeAssignments.forEach((assignment) => {
      assignmentsBySlot[`${assignment.date}:${assignment.taskTypeId}`] = assignment;
    });

    const assignedTypeIds = new Set(rangeAssignments.map((assignment) => assignment.taskTypeId));
    const boardTaskTypes = taskTypes
      .filter((taskType) => !taskType.archived || assignedTypeIds.has(taskType.id))
      .map((taskType) => ({
        ...taskType,
        teamLabel: getTeamLabel(taskType.team),
        assignableUsers: isAdmin(req)
          ? decoratedUsers
          : decoratedUsers.filter((user) => user.team === taskType.team && user.hasStaffRecord),
      }));

    dates.forEach((day) => {
      day.workingUsers = decoratedUsers.filter((user) => {
        if (filters.team !== 'all' && user.team !== filters.team) {
          return false;
        }
        const category = user.availability[day.date].category;
        return category === 'working' || category === 'partial';
      });
      day.taskSlots = boardTaskTypes.map((taskType) => ({
        taskType,
        assignment: assignmentsBySlot[`${day.date}:${taskType.id}`] || null,
      }));
    });

    const yearAssignments = yearAssignmentRecords.map((assignmentRecord) => assignmentRecord.get({ plain: true }));
    const summaryAssignedTypeIds = new Set(yearAssignments.map((assignment) => assignment.taskTypeId));
    const yearTotalsByType = {};
    yearAssignments.forEach((assignment) => {
      yearTotalsByType[assignment.taskTypeId] = (yearTotalsByType[assignment.taskTypeId] || 0) + 1;
    });
    const summaryTaskTypes = taskTypes
      .filter((taskType) => !taskType.archived || summaryAssignedTypeIds.has(taskType.id))
      .map((taskType) => ({
        ...taskType,
        teamLabel: getTeamLabel(taskType.team),
        total: yearTotalsByType[taskType.id] || 0,
      }));
    const summaryRowsByKey = {};

    decoratedUsers.forEach((user) => {
      if (!user.hasStaffRecord || (filters.team !== 'all' && user.team !== filters.team)) {
        return;
      }
      summaryRowsByKey[`user:${user.id}`] = {
        key: `user:${user.id}`,
        name: user.userid,
        team: user.team,
        teamLabel: user.teamLabel,
        counts: {},
        total: 0,
      };
    });

    yearAssignments.forEach((assignment) => {
      const currentUser = usersWithAvailability[assignment.assigneeUserId];
      const key = `user:${assignment.assigneeUserId}`;
      if (!summaryRowsByKey[key]) {
        summaryRowsByKey[key] = {
          key,
          name: currentUser ? currentUser.userid : assignment.assigneeName,
          team: currentUser ? currentUser.team : '',
          teamLabel: currentUser ? currentUser.teamLabel : 'Former staff',
          counts: {},
          total: 0,
        };
      }
      summaryRowsByKey[key].counts[assignment.taskTypeId] = (summaryRowsByKey[key].counts[assignment.taskTypeId] || 0) + 1;
      summaryRowsByKey[key].total++;
    });

    const summaryRows = Object.values(summaryRowsByKey).sort((left, right) => left.name.localeCompare(right.name));
    const conflicts = rangeAssignments.filter((assignment) => assignment.hasConflict);

    return res.render('daily_tasks/index', {
      pagetitle: 'Daily tasks · GCS Support Tool',
      filters,
      rangeOptions: RANGE_OPTIONS,
      teamOptions: TEAM_OPTIONS,
      selectedTeamLabel: filters.team === 'all' ? 'All teams' : getTeamLabel(filters.team),
      endDate,
      previousStart: addDays(filters.start, -filters.days),
      nextStart: addDays(filters.start, filters.days),
      today,
      dates,
      taskTypes,
      boardTaskTypes,
      rangeAssignments,
      conflicts,
      activeTaskTypeCount: taskTypes.filter((taskType) => !taskType.archived).length,
      selectedYear,
      summaryTaskTypes,
      summaryRows,
      success: typeof req.query.success === 'string' ? req.query.success.slice(0, 500) : null,
      warning: typeof req.query.warning === 'string' ? req.query.warning.slice(0, 500) : null,
      error: typeof req.query.error === 'string' ? req.query.error.slice(0, 500) : null,
    });
  } catch (error) {
    return next(error);
  }
};

exports.assign = async function (req, res, next) {
  const taskTypeId = parsePositiveInteger(req.body.taskTypeId);
  const assigneeUserId = parsePositiveInteger(req.body.assigneeUserId);
  const date = typeof req.body.date === 'string' ? req.body.date : '';
  const note = typeof req.body.note === 'string' ? req.body.note.trim() : '';
  const assignmentAnchor = taskTypeId && isValidDateString(date)
    ? `task-${date}-${taskTypeId}`
    : '';

  if (!taskTypeId || !assigneeUserId || !isValidDateString(date) || note.length > 500) {
    return redirectWithMessage(res, req.body, 'error', 'Enter a valid task, date, assignee, and note of at most 500 characters.');
  }

  try {
    const [taskType, assignee] = await Promise.all([
      DailyTaskType.findByPk(taskTypeId),
      User.findByPk(assigneeUserId, { attributes: ['id', 'userid', 'team'] }),
    ]);

    if (!taskType || !assignee) {
      return redirectWithMessage(
        res,
        req.body,
        'error',
        'The selected task type or staff member no longer exists.',
        assignmentAnchor
      );
    }
    const staff = await Staff.findOne({ where: { name: assignee.userid } });
    if (taskType.archived) {
      return redirectWithMessage(
        res,
        req.body,
        'error',
        'Archived task types cannot receive new assignments.',
        assignmentAnchor
      );
    }
    if (!isAdmin(req) && (assignee.team !== taskType.team || !staff)) {
      return redirectWithMessage(
        res,
        req.body,
        'error',
        `Only staff in ${getTeamLabel(taskType.team)} can be assigned this task.`,
        assignmentAnchor
      );
    }

    await DailyTaskAssignment.upsert({
      date,
      taskTypeId,
      assigneeUserId: assignee.id,
      assigneeName: assignee.userid,
      assignedByUserId: req.user.id,
      assignedByName: req.user.userid,
      note,
    });

    let scheduleStatus = 'no_staff_record';
    if (staff) {
      const [schedule, holiday] = await Promise.all([
        Schedule2.findOne({ where: { staffId: staff.id, date } }),
        Holiday.findOne({ where: { date } }),
      ]);
      scheduleStatus = schedule
        ? schedule.work
        : holiday
          ? 'holiday'
          : staff[`day${getDayOfWeek(date)}`] || 'not_set';
    }

    const savedMessage = `${taskType.name} assigned to ${assignee.userid} on ${date}.`;
    if (OFF_STATUSES.has(scheduleStatus)) {
      const scheduleLabel = getScheduleLabel(scheduleStatus).toLowerCase();
      return redirectWithMessage(
        res,
        req.body,
        'warning',
        `${savedMessage} ${assignee.userid} is scheduled as ${scheduleLabel}, so this task should be rescheduled.`,
        assignmentAnchor
      );
    }
    return redirectWithMessage(res, req.body, 'success', savedMessage, assignmentAnchor);
  } catch (error) {
    return next(error);
  }
};

exports.removeAssignment = async function (req, res, next) {
  const assignmentId = parsePositiveInteger(req.params.id);
  if (!assignmentId) {
    return redirectWithMessage(res, req.body, 'error', 'Invalid assignment.');
  }

  try {
    const assignment = await DailyTaskAssignment.findByPk(assignmentId);
    if (!assignment) {
      return redirectWithMessage(res, req.body, 'error', 'That assignment no longer exists.');
    }
    const assignmentAnchor = `task-${assignment.date}-${assignment.taskTypeId}`;
    await assignment.destroy();
    return redirectWithMessage(res, req.body, 'success', 'Assignment removed.', assignmentAnchor);
  } catch (error) {
    return next(error);
  }
};

exports.createTaskType = async function (req, res, next) {
  if (!isAdmin(req)) {
    return redirectWithMessage(res, req.body, 'error', 'Administrator access is required to add task types.');
  }

  const name = typeof req.body.name === 'string' ? req.body.name.trim() : '';
  const description = typeof req.body.description === 'string' ? req.body.description.trim() : '';
  const team = typeof req.body.team === 'string' ? req.body.team : '';
  if (!name || name.length > 120 || description.length > 500 || !TEAM_VALUES.includes(team)) {
    return redirectWithMessage(res, req.body, 'error', 'Enter a task name, a valid team, and a description of at most 500 characters.');
  }

  try {
    await DailyTaskType.create({
      name,
      description,
      team,
      archived: false,
      createdByUserId: req.user.id,
    });
    req.body.viewTeam = team;
    return redirectWithMessage(res, req.body, 'success', `${name} added to ${getTeamLabel(team)}.`);
  } catch (error) {
    if (error && error.name === 'SequelizeUniqueConstraintError') {
      return redirectWithMessage(res, req.body, 'error', 'A task type with that name already exists for this team.');
    }
    return next(error);
  }
};

exports.setTaskTypeArchived = async function (req, res, next) {
  if (!isAdmin(req)) {
    return redirectWithMessage(res, req.body, 'error', 'Administrator access is required to archive task types.');
  }

  const taskTypeId = parsePositiveInteger(req.params.id);
  const archived = req.body.archived === 'true';
  if (!taskTypeId) {
    return redirectWithMessage(res, req.body, 'error', 'Invalid task type.');
  }

  try {
    const taskType = await DailyTaskType.findByPk(taskTypeId);
    if (!taskType) {
      return redirectWithMessage(res, req.body, 'error', 'That task type no longer exists.');
    }
    await taskType.update({ archived });
    const action = archived ? 'archived' : 'restored';
    return redirectWithMessage(res, req.body, 'success', `${taskType.name} ${action}. Existing assignments were kept.`);
  } catch (error) {
    return next(error);
  }
};
