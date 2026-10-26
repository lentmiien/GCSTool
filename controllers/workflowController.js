const { randomUUID, randomBytes, timingSafeEqual } = require('crypto');
const db = require('../sequelize');
const { createService } = require('../services/workflows');
const rules = require('../utils/workflows');
const service = createService(db);
const { Op, WorkflowDefinition: Definition, WorkflowRun: Run, WorkflowTask: Task,
  WorkflowAssignee: Assignee, WorkflowParticipant: Participant, WorkflowEvent: Event, User } = db;

const handle = fn => async (req, res, next) => {
  try { await fn(req, res); } catch (error) { next(error); }
};
const plain = record => record.get({ plain: true });
const formatDate = value => value ? new Date(value).toLocaleString('en-GB', { timeZone: 'Asia/Tokyo', hour12: false }) : '—';

exports.prepare = (req, res, next) => {
  if (!req.session.workflowCsrf) req.session.workflowCsrf = randomBytes(32).toString('hex');
  if (req.method === 'POST') {
    const token = typeof req.body._csrf === 'string' ? req.body._csrf : '';
    const expected = req.session.workflowCsrf;
    if (Buffer.byteLength(token) !== Buffer.byteLength(expected) || !timingSafeEqual(Buffer.from(token), Buffer.from(expected))) {
      return res.status(403).send('This form has expired. Reload the page and try again.');
    }
  }
  Object.assign(res.locals, { workflowCsrf: req.session.workflowCsrf, workflowUser: req.user,
    isWorkflowAdmin: service.admin(req.user), formatWorkflowDate: formatDate, pagetitle: 'Workflows · GCS Support Tool' });
  next();
};

exports.tasks = handle(async (req, res) => {
  const tasks = await service.activeTasks(req.user.id);
  const runIds = tasks.map(task => task.runId);
  const comments = runIds.length ? await Task.findAll({ where: { runId: { [Op.in]: runIds }, comment: { [Op.ne]: '' } }, order: [['position', 'ASC']] }) : [];
  const definitions = await Definition.findAll({ where: { enabled: true, archived: false, trigger: 'manual' }, order: [['name', 'ASC']] });
  res.render('workflows/tasks', { tasks, comments,
    starters: definitions.filter(def => def.steps.find(step => !step.archived).assignees.includes(req.user.id)) });
});

exports.definitions = handle(async (req, res) => {
  const definitions = await Definition.findAll({ order: [['archived', 'ASC'], ['name', 'ASC']] });
  res.render('workflows/definitions', { definitions });
});

exports.definition = handle(async (req, res) => {
  const def = await service.definition(req.params.id);
  const users = await User.findAll({ attributes: ['id', 'userid'], order: [['userid', 'ASC']] });
  res.render('workflows/definition', { def, users, startKey: randomUUID() });
});

exports.editor = handle(async (req, res) => {
  service.requireAdmin(req.user);
  const def = req.params.id ? plain(await service.definition(req.params.id)) : {
    name: '', description: '', trigger: 'manual', enabled: true, archived: false, locked: false, revision: 0,
    steps: [{ title: '', description: '', assignees: [], archived: false }], requiredVariables: [],
  };
  const users = await User.findAll({ attributes: ['id', 'userid'], order: [['userid', 'ASC']] });
  res.render('workflows/editor', { def, users });
});

exports.saveDefinition = handle(async (req, res) => {
  const def = await service.saveDefinition(req.params.id, req.body, req.user);
  res.redirect(303, `/workflows/definitions/${def.id}`);
});
exports.membership = handle(async (req, res) => {
  await service.membership(req.params.id, req.params.stepId, req.body, req.user);
  res.redirect(303, `/workflows/definitions/${req.params.id}`);
});
exports.start = handle(async (req, res) => {
  const run = await service.start(req.params.id, req.body, req.user);
  res.redirect(303, `/workflows/runs/${run.id}`);
});
exports.act = handle(async (req, res) => {
  await service.act(req.params.id, req.params.taskId, req.body, req.user);
  res.redirect(303, '/workflows');
});
exports.variables = handle(async (req, res) => {
  await service.updateVariables(req.params.id, req.body, req.user);
  res.redirect(303, `/workflows/runs/${req.params.id}`);
});
exports.cancel = handle(async (req, res) => {
  await service.cancel(req.params.id, req.body, req.user);
  res.redirect(303, `/workflows/runs/${req.params.id}`);
});

exports.run = handle(async (req, res) => {
  const run = await service.runForUser(req.params.id, req.user);
  const tasks = await Task.findAll({ where: { runId: run.id }, include: [{ model: Assignee, as: 'assignees' }], order: [['position', 'ASC']] });
  const users = await User.findAll({ attributes: ['id', 'userid'] });
  const eventPage = rules.integer(req.query.eventPage || 1, 1, 1000000, 'event page');
  const events = await Event.findAndCountAll({ where: { runId: run.id }, order: [['createdAt', 'DESC'], ['id', 'DESC']], limit: 30, offset: (eventPage - 1) * 30 });
  res.render('workflows/run', { run, tasks, users, events: events.rows, eventPage, eventPages: Math.max(1, Math.ceil(events.count / 30)) });
});

exports.history = handle(async (req, res) => {
  const page = rules.integer(req.query.page || 1, 1, 1000000, 'page');
  const filters = {
    status: typeof req.query.status === 'string' ? req.query.status : '',
    q: typeof req.query.q === 'string' ? req.query.q.trim().slice(0, 160) : '',
    from: typeof req.query.from === 'string' ? req.query.from : '',
    to: typeof req.query.to === 'string' ? req.query.to : '',
  };
  const where = {};
  if (filters.status) {
    if (!['open', 'completed', 'cancelled'].includes(filters.status)) rules.fail('Invalid status filter.');
    where.status = filters.status;
  }
  if (filters.q) where.name = { [Op.like]: `%${filters.q.replace(/[\\%_]/g, '\\$&')}%` };
  if (filters.from || filters.to) {
    if ((filters.from && !rules.validDate(filters.from)) || (filters.to && !rules.validDate(filters.to))) rules.fail('Invalid date filter.');
    if (filters.from && filters.to && filters.from > filters.to) rules.fail('The end date must be on or after the start date.');
    where.createdAt = {};
    if (filters.from) where.createdAt[Op.gte] = new Date(`${filters.from}T00:00:00+09:00`);
    if (filters.to) where.createdAt[Op.lt] = new Date(new Date(`${filters.to}T00:00:00+09:00`).getTime() + 86400000);
  }
  const include = service.admin(req.user) ? [] : [{ model: Participant, as: 'participants', where: { userId: req.user.id }, attributes: [], required: true }];
  const result = await Run.findAndCountAll({ where, include, distinct: true, limit: 25, offset: (page - 1) * 25, order: [['createdAt', 'DESC'], ['id', 'DESC']] });
  const tasks = result.rows.length ? await Task.findAll({ where: { runId: { [Op.in]: result.rows.map(run => run.id) } }, order: [['position', 'ASC']] }) : [];
  const pageUrl = number => `/workflows/history?${new URLSearchParams({ ...filters, page: String(number) })}`;
  res.render('workflows/history', { runs: result.rows, tasks, filters, page, pages: Math.max(1, Math.ceil(result.count / 25)), total: result.count, pageUrl });
});

exports.analytics = handle(async (req, res) => {
  service.requireAdmin(req.user);
  // Aggregate in SQL so the analytics placeholder need not load the event history.
  const { fn, col, literal } = require('sequelize');
  const statuses = await Run.findAll({ attributes: ['status', [fn('COUNT', col('id')), 'total'],
    [fn('AVG', literal('TIMESTAMPDIFF(SECOND, createdAt, finishedAt)')), 'averageSeconds']], group: ['status'], raw: true });
  const activity = await Event.findAll({ attributes: ['userId', 'userName', 'action', [fn('COUNT', col('id')), 'total'],
    [fn('AVG', col('durationSeconds')), 'averageSeconds']], group: ['userId', 'userName', 'action'], raw: true });
  const taskCounts = await Task.findAll({ attributes: ['state', [fn('COUNT', col('id')), 'total']], group: ['state'], raw: true });
  const definitions = await Definition.findAll({ where: { archived: false }, order: [['name', 'ASC']] });
  const users = await User.findAll({ attributes: ['id'] });
  const existingUsers = new Set(users.map(user => user.id));
  const unassigned = definitions.flatMap(def => def.steps.filter(step => !step.archived && !step.assignees.some(id => existingUsers.has(id)))
    .map(step => ({ name: def.name, task: step.title, href: `/workflows/definitions/${def.id}/edit`, source: 'Definition' })));
  const openTasks = await Task.findAll({ where: { state: { [Op.in]: ['active', 'pending'] } }, include: [
    { model: Run, as: 'run', where: { status: 'open' }, required: true, include: [{ model: Definition, as: 'definition', where: { archived: false }, required: true }] },
    { model: Assignee, as: 'assignees' },
  ] });
  for (const task of openTasks) {
    const step = task.run.definition.steps.find(item => item.id === task.stepId);
    if ((!step || !step.archived) && !task.assignees.some(item => existingUsers.has(item.userId))) {
      unassigned.push({ name: task.run.name, task: task.title, href: `/workflows/runs/${task.runId}`, source: task.state === 'active' ? 'Active task' : 'Pending task' });
    }
  }
  res.render('workflows/analytics', { statuses, activity, taskCounts, unassigned });
});
