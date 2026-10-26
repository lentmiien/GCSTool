const { randomUUID } = require('crypto');
const rules = require('../utils/workflows');

function createService(db) {
  const { sequelize, Op, WorkflowDefinition: Definition, WorkflowRun: Run, WorkflowTask: Task,
    WorkflowAssignee: Assignee, WorkflowParticipant: Participant, WorkflowEvent: Event, User } = db;
  const admin = user => user && user.role === 'admin';
  const requireAdmin = user => { if (!admin(user)) rules.fail('Administrator access required.', 403); };
  const transaction = callback => sequelize.transaction(callback);
  const lock = t => ({ transaction: t, lock: t.LOCK.UPDATE });

  async function definition(id, t) {
    const result = await Definition.findByPk(rules.integer(id, 1, 2147483647, 'workflow'), t ? lock(t) : {});
    if (!result) rules.fail('Workflow not found.', 404);
    return result;
  }

  async function runForUser(id, user, t) {
    if (typeof id !== 'string' || !/^[0-9a-f-]{36}$/i.test(id)) rules.fail('Workflow run not found.', 404);
    const run = await Run.findByPk(id, t ? lock(t) : {});
    if (!run) rules.fail('Workflow run not found.', 404);
    if (!admin(user) && !await Participant.findOne({ where: { runId: id, userId: user.id }, transaction: t })) {
      rules.fail('You are not included in this workflow run.', 403);
    }
    return run;
  }

  async function recordEvent(runId, user, action, t, extra = {}) {
    return Event.create({ runId, userId: user ? user.id : null, userName: user ? user.userid : 'Scheduler', action, ...extra }, { transaction: t });
  }

  async function addParticipants(runId, ids, t) {
    await Participant.bulkCreate([...new Set(ids)].map(userId => ({ runId, userId })), { transaction: t, ignoreDuplicates: true });
  }

  // Membership changes affect matching tasks in open runs. Keep historical access
  // for everyone who was included, even if they subsequently leave the template.
  async function syncAssignments(def, previousSteps, user, t) {
    const changed = def.steps.filter(step => {
      const previous = previousSteps.find(old => old.id === step.id);
      return previous && JSON.stringify([...previous.assignees].sort()) !== JSON.stringify([...step.assignees].sort());
    });
    if (!changed.length) return;
    const runs = await Run.findAll({ where: { definitionId: def.id, status: 'open' }, order: [['id', 'ASC']], ...lock(t) });
    for (const run of runs) {
      const tasks = await Task.findAll({ where: { runId: run.id }, transaction: t });
      for (const step of changed) {
        const task = tasks.find(item => item.stepId === step.id);
        if (!task) continue;
        await Assignee.destroy({ where: { taskId: task.id }, transaction: t });
        await Assignee.bulkCreate(step.assignees.map(userId => ({ taskId: task.id, userId })), { transaction: t });
        await addParticipants(run.id, step.assignees, t);
      }
      await run.update({ revision: run.revision + 1 }, { transaction: t });
      await recordEvent(run.id, user, 'staff_updated', t);
    }
  }

  async function saveDefinition(id, input, user) {
    requireAdmin(user);
    return transaction(async t => {
      const previous = id ? await definition(id, t) : null;
      if (previous) rules.assertRevision(previous, input.revision);
      const users = await User.findAll({ attributes: ['id'], transaction: t });
      const data = rules.validateDefinition(input, new Set(users.map(item => item.id)), previous);
      if (!previous) return Definition.create(data, { transaction: t });
      const previousSteps = previous.steps;
      await previous.update({ ...data, revision: previous.revision + 1 }, { transaction: t });
      await syncAssignments(previous, previousSteps, user, t);
      return previous;
    });
  }

  async function membership(id, stepId, input, user) {
    return transaction(async t => {
      const def = await definition(id, t);
      rules.assertRevision(def, input.revision);
      if (def.locked && !admin(user)) rules.fail('Staff membership is locked by an administrator.', 403);
      if (!['join', 'leave'].includes(input.action)) rules.fail('Invalid membership action.');
      const previousSteps = def.steps;
      const steps = JSON.parse(JSON.stringify(previousSteps));
      const step = steps.find(item => item.id === stepId);
      if (!step) rules.fail('Task not found.', 404);
      step.assignees = step.assignees.filter(id => id !== user.id);
      if (input.action === 'join') step.assignees.push(user.id);
      await def.update({ steps, revision: def.revision + 1 }, { transaction: t });
      await syncAssignments(def, previousSteps, user, t);
      return def;
    });
  }

  async function createRun(def, variables, user, scheduledFor, startKey, comment, t) {
    const now = new Date();
    const manual = !scheduledFor;
    const steps = def.steps.filter(step => !step.archived);
    const finished = manual && steps.length === 1;
    const run = await Run.create({ id: randomUUID(), definitionId: def.id, name: def.name, variables, scheduledFor,
      startKey, status: finished ? 'completed' : 'open', activePosition: manual ? 1 : 0, finishedAt: finished ? now : null }, { transaction: t });
    await addParticipants(run.id, steps.flatMap(step => step.assignees), t);
    for (const [position, step] of steps.entries()) {
      const completed = manual && position === 0;
      const active = !finished && position === run.activePosition;
      const task = await Task.create({ runId: run.id, stepId: step.id, position, title: step.title, description: step.description,
        state: completed ? 'completed' : active ? 'active' : 'pending', activatedAt: active || completed ? now : null,
        completedAt: completed ? now : null, completedBy: completed ? user.userid : null,
        comment: completed ? comment : '', commentBy: completed && comment ? user.userid : null, commentAt: completed && comment ? now : null }, { transaction: t });
      await Assignee.bulkCreate(step.assignees.map(userId => ({ taskId: task.id, userId })), { transaction: t });
      if (completed) await recordEvent(run.id, user, 'complete', t, { taskId: task.id });
    }
    await recordEvent(run.id, user, manual ? 'start' : 'auto_start', t);
    return run;
  }

  async function start(id, input, user) {
    return transaction(async t => {
      const def = await definition(id, t);
      if (def.archived || !def.enabled || def.trigger !== 'manual') rules.fail('This workflow is not available for manual starts.', 409);
      if (!def.steps.find(step => !step.archived).assignees.includes(user.id)) rules.fail('Only staff assigned to the first task may start this workflow.', 403);
      if (typeof input.startKey !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(input.startKey)) rules.fail('Invalid start token. Reload the page.');
      const existing = await Run.findOne({ where: { startKey: input.startKey }, transaction: t });
      if (existing) {
        if (existing.definitionId !== def.id) rules.fail('Start token already used.', 409);
        await runForUser(existing.id, user, t);
        return existing;
      }
      rules.assertRevision(def, input.revision);
      const variables = rules.validateVariables(def.requiredVariables, rules.parseJson(input.values), rules.parseJson(input.custom));
      return createRun(def, variables, user, null, input.startKey, rules.text(input.comment || '', 'Comment', 10000, false), t);
    });
  }

  async function act(id, taskId, input, user) {
    return transaction(async t => {
      const run = await runForUser(id, user, t);
      rules.assertRevision(run, input.revision);
      const tasks = await Task.findAll({ where: { runId: run.id }, order: [['position', 'ASC']], transaction: t });
      const task = tasks.find(item => item.id === rules.integer(taskId, 1, 2147483647, 'task'));
      if (!task) rules.fail('Task not found.', 404);
      if (!await Assignee.findOne({ where: { taskId: task.id, userId: user.id }, transaction: t })) rules.fail('You are not assigned to this task.', 403);
      const comment = rules.text(input.comment || '', 'Comment', 10000, false);
      const nextPosition = rules.transition(run, task, input.action, comment);
      const now = new Date();
      const taskChanges = { state: input.action === 'complete' ? 'completed' : 'pending',
        completedAt: input.action === 'complete' ? now : null, completedBy: input.action === 'complete' ? user.userid : null };
      if (task.comment !== comment) Object.assign(taskChanges, { comment, commentBy: user.userid, commentAt: now });
      await task.update(taskChanges, { transaction: t });
      const nextTask = tasks[nextPosition];
      if (nextTask) await nextTask.update({ state: 'active', activatedAt: now, completedAt: null, completedBy: null }, { transaction: t });
      await run.update({ activePosition: nextPosition, status: nextTask ? 'open' : 'completed', finishedAt: nextTask ? null : now, revision: run.revision + 1 }, { transaction: t });
      await recordEvent(run.id, user, input.action, t, { taskId: task.id,
        durationSeconds: task.activatedAt ? Math.max(0, Math.round((now - new Date(task.activatedAt)) / 1000)) : null });
      return run;
    });
  }

  async function updateVariables(id, input, user) {
    return transaction(async t => {
      const run = await runForUser(id, user, t);
      rules.assertRevision(run, input.revision);
      if (run.status !== 'open') rules.fail('This workflow is closed.', 409);
      const required = run.variables.filter(variable => variable.required);
      const variables = rules.validateVariables(required, required.map(variable => variable.value), rules.parseJson(input.custom));
      await run.update({ variables, revision: run.revision + 1 }, { transaction: t });
      await recordEvent(run.id, user, 'variables_updated', t);
      return run;
    });
  }

  async function cancel(id, input, user) {
    requireAdmin(user);
    return transaction(async t => {
      const run = await runForUser(id, user, t);
      rules.assertRevision(run, input.revision);
      if (run.status !== 'open') rules.fail('This workflow is already closed.', 409);
      await run.update({ status: 'cancelled', finishedAt: new Date(), cancellationReason: rules.text(input.reason, 'Cancellation reason', 2000), revision: run.revision + 1 }, { transaction: t });
      await Task.update({ state: 'cancelled' }, { where: { runId: id, state: { [Op.in]: ['active', 'pending'] } }, transaction: t });
      await recordEvent(id, user, 'cancel', t);
      return run;
    });
  }

  function activeTaskQuery(userId) {
    return { where: { state: 'active' }, include: [
      { model: Run, as: 'run', where: { status: 'open' }, required: true },
      { model: Assignee, as: 'assignees', where: { userId }, required: true },
    ] };
  }

  async function tick(now = new Date()) {
    const due = await Definition.findAll({ where: { enabled: true, archived: false, trigger: 'scheduled', nextStart: { [Op.lte]: now } }, attributes: ['id'] });
    for (const item of due) {
      // Bounded catch-up; subsequent ticks continue from the persisted cursor.
      for (let count = 0; count < 12; count++) {
        const created = await transaction(async t => {
          const def = await definition(item.id, t);
          if (def.archived || !def.enabled || def.trigger !== 'scheduled' || !def.nextStart || new Date(def.nextStart) > now) return false;
          const scheduledFor = new Date(def.nextStart);
          const existing = await Run.findOne({ where: { definitionId: def.id, scheduledFor }, transaction: t });
          if (!existing) {
            const date = rules.japanDate(scheduledFor);
            const values = def.requiredVariables.map(variable => variable.defaultValue
              .replace(/\{date\}/g, date).replace(/\{month\}/g, date.slice(0, 7)).replace(/\{year\}/g, date.slice(0, 4)));
            await createRun(def, rules.validateVariables(def.requiredVariables, values, []), null, scheduledFor, null, '', t);
          }
          await def.update({ nextStart: rules.nextOccurrence(def.schedule, scheduledFor) }, { transaction: t });
          return true;
        });
        if (!created) break;
      }
    }
  }

  return { admin, requireAdmin, definition, runForUser, saveDefinition, membership, start, act, updateVariables, cancel, tick,
    countActive: userId => Task.count({ ...activeTaskQuery(userId), distinct: true, col: 'id' }),
    activeTasks: userId => Task.findAll({ ...activeTaskQuery(userId), order: [['activatedAt', 'ASC'], ['id', 'ASC']] }) };
}

function startScheduler(service, logger = console) {
  let running = false;
  const poll = async () => {
    if (running) return;
    running = true;
    try { await service.tick(); } catch (_) { logger.error('Workflow scheduler failed; pending starts will retry on the next tick.'); }
    finally { running = false; }
  };
  poll();
  const timer = setInterval(poll, 60000);
  timer.unref();
  return () => clearInterval(timer);
}

module.exports = { createService, startScheduler };
