// Opt in to a disposable database; never load .env or the application's sequelize.js.
const Sequelize = require('sequelize');
const { randomUUID } = require('crypto');
const { createService } = require('../services/workflows');
const express = require('express');
const request = require('supertest');
const suite = process.env.WORKFLOW_TEST_MYSQL_PORT ? describe : describe.skip;

suite('workflow transactions and HTTP routes on disposable MySQL', () => {
  let db, models, service, admin, alice, bob, outsider, app;
  const csrf = 'a'.repeat(64);
  const input = (overrides = {}) => ({ name: 'Quarterly GST', description: 'Prepare country GST', trigger: 'manual', enabled: true,
    requiredVariables: [{ name: 'Period', defaultValue: '' }], steps: [
      { title: 'Gather', description: 'Gather payment data', assignees: [alice.id] },
      { title: 'Check', description: 'Confirm the numbers', assignees: [bob.id, alice.id] },
      { title: 'Pay', description: 'Submit payment', assignees: [admin.id] },
    ], ...overrides });
  const startInput = (overrides = {}) => ({ revision: 0, startKey: randomUUID(), values: ['2026-Q4'], custom: [], comment: 'https://example.test/data', ...overrides });
  const tasksFor = run => models.WorkflowTask.findAll({ where: { runId: run.id }, order: [['position', 'ASC']] });
  const get = (path, user = alice) => request(app).get(path).set('x-test-user', String(user.id));
  const post = (path, body, user = alice) => request(app).post(path).set('x-test-user', String(user.id)).send({ _csrf: csrf, ...body });

  beforeAll(async () => {
    db = new Sequelize('gcs_workflow_test', 'root', '', { host: '127.0.0.1', port: Number(process.env.WORKFLOW_TEST_MYSQL_PORT), dialect: 'mysql', logging: false });
    models = { sequelize: db, Op: Sequelize.Op, ...require('../models/workflow')(db, Sequelize), User: require('../models/user')(db, Sequelize) };
    await db.sync({ force: true });
    service = createService(models);
    jest.doMock('../sequelize', () => models);
    app = express();
    app.set('views', `${__dirname}/../views`);
    app.set('view engine', 'pug');
    app.use(express.json());
    app.use(express.urlencoded({ extended: false }));
    app.use(async (req, res, next) => {
      req.user = await models.User.findByPk(Number(req.get('x-test-user')));
      req.session = { workflowCsrf: csrf };
      res.locals = { role: req.user.role, name: req.user.userid, currentPath: req.path };
      next();
    });
    app.use('/workflows', require('../routes/workflows'));
    app.use((error, req, res, next) => res.status(error.status || 500).send(error.message));
  }, 20000);
  afterAll(async () => { if (db) await db.close(); });
  beforeEach(async () => {
    for (const name of ['WorkflowEvent', 'WorkflowAssignee', 'WorkflowParticipant', 'WorkflowTask', 'WorkflowRun', 'WorkflowDefinition', 'User']) {
      await models[name].destroy({ where: {} });
    }
    [admin, alice, bob, outsider] = await Promise.all(['admin', 'alice', 'bob', 'outsider'].map(userid => models.User.create({ userid, role: userid === 'admin' ? 'admin' : 'user' })));
  });

  test('manual start completes first step atomically, is idempotent, and only first-step staff may start', async () => {
    const def = await service.saveDefinition(null, input(), admin);
    await expect(service.start(def.id, startInput(), admin)).rejects.toMatchObject({ status: 403 });
    const payload = startInput();
    const [first, second] = await Promise.all([service.start(def.id, payload, alice), service.start(def.id, payload, alice)]);
    expect(first.id).toBe(second.id);
    expect(await models.WorkflowRun.count()).toBe(1);
    expect((await tasksFor(first)).map(task => task.state)).toEqual(['completed', 'active', 'pending']);
    expect(await service.countActive(alice.id)).toBe(1);
    expect(await service.countActive(bob.id)).toBe(1);
    expect(await service.countActive(outsider.id)).toBe(0);
    const one = await service.saveDefinition(null, input({ steps: [input().steps[0]] }), admin);
    expect((await service.start(one.id, startInput(), alice)).status).toBe('completed');
  });

  test('return moves exactly one step, requires a comment, and replaces the sole comment on resubmission', async () => {
    const def = await service.saveDefinition(null, input(), admin);
    let run = await service.start(def.id, startInput(), alice);
    let tasks = await tasksFor(run);
    await expect(service.act(run.id, tasks[1].id, { revision: 0, action: 'reject', comment: '' }, bob)).rejects.toMatchObject({ status: 400 });
    expect((await models.WorkflowRun.findByPk(run.id)).revision).toBe(0);
    run = await service.act(run.id, tasks[1].id, { revision: 0, action: 'reject', comment: 'Missing invoice' }, bob);
    expect(run.activePosition).toBe(0);
    tasks = await tasksFor(run);
    expect(tasks.map(task => task.state)).toEqual(['active', 'pending', 'pending']);
    expect(tasks[0].comment).toBe('https://example.test/data');
    run = await service.act(run.id, tasks[0].id, { revision: 1, action: 'complete', comment: 'Corrected link' }, alice);
    run = await service.act(run.id, tasks[1].id, { revision: 2, action: 'complete', comment: '' }, bob);
    run = await service.act(run.id, tasks[2].id, { revision: 3, action: 'complete', comment: 'Paid' }, admin);
    expect(run.status).toBe('completed');
    expect((await tasksFor(run)).map(task => task.comment)).toEqual(['Corrected link', '', 'Paid']);
    expect(await service.countActive(admin.id)).toBe(0);
    await expect(service.act(run.id, tasks[2].id, { revision: 4, action: 'complete' }, admin)).rejects.toMatchObject({ status: 409 });
    expect(models.WorkflowEvent.rawAttributes.comment).toBeUndefined();
  });

  test('concurrent completions advance only once and unauthorized staff cannot act', async () => {
    const def = await service.saveDefinition(null, input(), admin);
    const run = await service.start(def.id, startInput(), alice);
    const tasks = await tasksFor(run);
    await expect(service.act(run.id, tasks[1].id, { revision: 0, action: 'complete' }, admin)).rejects.toMatchObject({ status: 403 });
    const results = await Promise.allSettled([alice, bob].map(user => service.act(run.id, tasks[1].id, { revision: 0, action: 'complete' }, user)));
    expect(results.filter(result => result.status === 'fulfilled')).toHaveLength(1);
    expect(results.find(result => result.status === 'rejected').reason.status).toBe(409);
    expect((await models.WorkflowRun.findByPk(run.id)).activePosition).toBe(2);
    expect(await models.WorkflowEvent.count({ where: { taskId: tasks[1].id, action: 'complete' } })).toBe(1);
  });

  test('self membership, locks and zero-staff tasks propagate to ongoing runs and preserve historical access', async () => {
    let def = await service.saveDefinition(null, input(), admin);
    const run = await service.start(def.id, startInput(), alice);
    def = await service.membership(def.id, def.steps[1].id, { revision: 0, action: 'leave' }, bob);
    expect(await service.countActive(bob.id)).toBe(0);
    await expect(service.runForUser(run.id, bob)).resolves.toBeTruthy();
    def = await service.membership(def.id, def.steps[1].id, { revision: 1, action: 'leave' }, alice);
    expect(await service.countActive(alice.id)).toBe(0);
    expect((await get('/workflows/analytics', admin)).text).toContain('Unassigned tasks (2)');
    def = await service.membership(def.id, def.steps[1].id, { revision: 2, action: 'join' }, outsider);
    expect(await service.countActive(outsider.id)).toBe(1);
    def = await service.saveDefinition(def.id, { ...def.get({ plain: true }), locked: true }, admin);
    await expect(service.membership(def.id, def.steps[1].id, { revision: def.revision, action: 'leave' }, outsider)).rejects.toMatchObject({ status: 403 });
    await expect(service.saveDefinition(def.id, input(), alice)).rejects.toMatchObject({ status: 403 });
  });

  test('required and custom variables can be corrected with trusted edit attribution', async () => {
    const def = await service.saveDefinition(null, input(), admin);
    const run = await service.start(def.id, startInput(), alice);
    await expect(service.updateVariables(run.id, { revision: 0, custom: [] }, outsider)).rejects.toMatchObject({ status: 403 });
    expect(run.variables[0]).toMatchObject({ editedBy: alice.userid, editedByUserId: alice.id });
    const updated = await service.updateVariables(run.id, { revision: 0, custom: [{ name: 'Order', value: '123', editedBy: 'Admin' }], values: ['2026-Q3'] }, bob);
    expect(updated.variables).toEqual([
      expect.objectContaining({ name: 'Period', value: '2026-Q3', required: true, editedBy: bob.userid, editedByUserId: bob.id, editedAt: expect.any(String) }),
      expect.objectContaining({ name: 'Order', value: '123', required: false, editedBy: bob.userid, editedByUserId: bob.id, editedAt: expect.any(String) }),
    ]);
    const unchanged = await service.updateVariables(run.id, { revision: 1, values: ['2026-Q3'], custom: [{ name: 'Order', value: '123' }] }, alice);
    expect(unchanged.variables).toEqual(updated.variables);
    expect(unchanged.revision).toBe(1);
    await expect(service.updateVariables(run.id, { revision: 1, values: [''] }, bob)).rejects.toMatchObject({ status: 400 });
    await expect(service.updateVariables(run.id, { revision: 0, custom: [] }, bob)).rejects.toMatchObject({ status: 409 });
    await expect(service.updateVariables(run.id, { revision: 1, custom: Array(4).fill({ name: 'x', value: 'y' }) }, bob)).rejects.toMatchObject({ status: 400 });
  });

  test('task submission saves corrections and comments atomically through returns and completion', async () => {
    const def = await service.saveDefinition(null, input(), admin);
    let run = await service.start(def.id, startInput({ custom: [{ name: 'Country', value: 'AU' }] }), alice);
    const tasks = await tasksFor(run);
    const originalVariables = run.variables;
    const path = `/workflows/runs/${run.id}/tasks/${tasks[1].id}`;
    for (const invalid of [
      { action: 'reject', comment: '', values: ['2026-Q3'] },
      { action: 'complete', comment: 'Invalid', values: [''] },
      { action: 'complete', comment: 'Invalid', custom: [{ name: 'Period', value: 'Duplicate' }] },
    ]) {
      expect((await post(path, { revision: 0, ...invalid }, bob)).status).toBe(400);
      await run.reload();
      expect(run.variables).toEqual(originalVariables);
      expect(run.activePosition).toBe(1);
      expect(run.revision).toBe(0);
      expect((await tasksFor(run))[1].comment).toBe('');
    }
    expect((await post(path, { revision: 0, action: 'complete', values: ['Unauthorized'] }, admin)).status).toBe(403);
    expect((await post(path, { revision: 0, action: 'reject', comment: 'Use the corrected period', values: JSON.stringify(['2026-Q3']), custom: JSON.stringify([{ name: 'Country', value: 'AU' }]) }, bob)).status).toBe(303);
    await run.reload();
    expect(run.activePosition).toBe(0);
    expect(run.variables[0]).toMatchObject({ value: '2026-Q3', editedBy: bob.userid, editedByUserId: bob.id });
    expect(run.variables[1]).toEqual(originalVariables[1]);
    const correction = run.variables[0];
    const page = await get('/workflows', alice);
    expect(page.text).toContain('Edited by bob');
    expect(page.text).toContain('value="2026-Q3"');
    expect((await post(`/workflows/runs/${run.id}/tasks/${tasks[0].id}`, { revision: 0, action: 'complete', values: ['Stale'] }, alice)).status).toBe(409);
    run = await service.act(run.id, tasks[0].id, { revision: 1, action: 'complete', values: ['2026-Q3'], custom: [{ name: 'Country', value: 'NZ' }], comment: 'Confirmed' }, alice);
    expect(run.variables[0]).toEqual(correction);
    expect(run.variables[1]).toMatchObject({ value: 'NZ', editedBy: alice.userid });
    run = await service.act(run.id, tasks[1].id, { revision: 2, action: 'complete' }, bob);
    run = await service.act(run.id, tasks[2].id, { revision: 3, action: 'complete', values: ['2026-Q2'], comment: 'Final correction' }, admin);
    expect(run.status).toBe('completed');
    expect(run.variables[0]).toMatchObject({ value: '2026-Q2', editedBy: admin.userid });
    await expect(service.updateVariables(run.id, { revision: 4, values: ['Closed'] }, admin)).rejects.toMatchObject({ status: 409 });
  });

  test('cancellation is admin-only and removes reminders without losing history', async () => {
    const def = await service.saveDefinition(null, input(), admin);
    const run = await service.start(def.id, startInput(), alice);
    await expect(service.cancel(run.id, { revision: 0, reason: 'Duplicate' }, alice)).rejects.toMatchObject({ status: 403 });
    await service.cancel(run.id, { revision: 0, reason: 'Duplicate' }, admin);
    expect(await service.countActive(bob.id)).toBe(0);
    expect((await service.runForUser(run.id, bob)).cancellationReason).toBe('Duplicate');
    expect((await tasksFor(run))[0].comment).toBe('https://example.test/data');
    expect((await get(`/workflows/runs/${run.id}`, bob)).status).toBe(200);
  });

  test('two scheduler workers catch up exactly once and schedule edits retain the durable cursor', async () => {
    let def = await service.saveDefinition(null, input({ trigger: 'scheduled', schedule: { frequency: 'weekly', interval: 1, startDate: '2026-10-05', time: '09:00', weekdays: [1] }, requiredVariables: [{ name: 'Period', defaultValue: '{date} / {month} / {year}' }] }), admin);
    const now = new Date('2026-10-26T01:00:00Z');
    await Promise.all([service.tick(now), createService(models).tick(now)]);
    expect(await models.WorkflowRun.count()).toBe(4);
    expect(await service.countActive(alice.id)).toBe(4);
    const run = await models.WorkflowRun.findOne({ order: [['scheduledFor', 'ASC']] });
    expect(run.variables[0].value).toBe('2026-10-05 / 2026-10 / 2026');
    expect(run.variables[0]).toMatchObject({ editedBy: 'Scheduler', editedByUserId: null, editedAt: expect.any(String) });
    expect((await tasksFor(run)).map(task => task.state)).toEqual(['active', 'pending', 'pending']);
    def = await models.WorkflowDefinition.findByPk(def.id);
    const nextStart = def.nextStart;
    await service.saveDefinition(def.id, { ...def.get({ plain: true }), description: 'Revised instructions' }, admin);
    expect((await models.WorkflowDefinition.findByPk(def.id)).nextStart).toEqual(nextStart);
    await service.tick(now);
    expect(await models.WorkflowRun.count()).toBe(4);
    await def.reload();
    await service.saveDefinition(def.id, { ...def.get({ plain: true }), archived: true }, admin);
    await service.tick(new Date('2026-12-01T00:00:00Z'));
    expect(await models.WorkflowRun.count()).toBe(4);
  });

  test('all pages render, history is paginated and scoped, and CSRF/admin guards apply', async () => {
    const def = await service.saveDefinition(null, input({ name: '<script>alert(1)</script>' }), admin);
    let run;
    for (let i = 0; i < 26; i++) run = await service.start(def.id, startInput(), alice);
    for (const path of ['/workflows', '/workflows/definitions', `/workflows/definitions/${def.id}`, `/workflows/runs/${run.id}`, '/workflows/history', '/workflows/history?page=2', '/workflows/analytics', `/workflows/definitions/${def.id}/edit`, '/workflows/definitions/new']) {
      const response = await get(path, admin);
      expect({ path, status: response.status, error: response.status !== 200 ? response.text : null }).toEqual({ path, status: 200, error: null });
      expect(response.text).not.toContain('<script>alert(1)</script>');
    }
    expect((await get('/workflows/history', bob)).text).toContain('Page 1 of 2');
    expect((await get('/workflows/history?status=completed', bob)).text).toContain('0 runs found');
    expect((await get('/workflows/history', outsider)).text).toContain('0 runs found');
    expect((await get(`/workflows/runs/${run.id}`, outsider)).status).toBe(403);
    expect((await get('/workflows/analytics', alice)).status).toBe(403);
    expect((await get(`/workflows/definitions/${def.id}/edit`, alice)).status).toBe(403);
    expect((await post('/workflows/definitions', input(), alice)).status).toBe(403);
    expect((await post('/workflows/definitions', { ...input(), _csrf: '' }, admin)).status).toBe(403);
    expect((await get('/workflows', outsider)).text).not.toContain('Gather payment data');
    expect((await get('/workflows/history?from=2026-02-30', bob)).status).toBe(400);
  });

  test('editing and archiving tasks preserves existing run content and skips archived steps in new runs', async () => {
    let def = await service.saveDefinition(null, input(), admin);
    const original = await service.start(def.id, startInput(), alice);
    const data = def.get({ plain: true });
    data.steps[0].title = 'Revised gathering instructions';
    data.steps[1].archived = true;
    def = await service.saveDefinition(def.id, data, admin);
    expect((await tasksFor(original)).map(task => task.title)).toEqual(['Gather', 'Check', 'Pay']);
    const fresh = await service.start(def.id, startInput({ revision: def.revision }), alice);
    expect((await tasksFor(fresh)).map(task => task.title)).toEqual(['Revised gathering instructions', 'Pay']);
    expect((await tasksFor(fresh))[1].state).toBe('active');
    expect((await models.WorkflowRun.findByPk(original.id)).status).toBe('open');
  });

  test('catch-up is bounded, paused definitions do not start, and restart resumes the cursor', async () => {
    let def = await service.saveDefinition(null, input({ trigger: 'scheduled', enabled: false,
      schedule: { frequency: 'daily', interval: 1, startDate: '2026-10-01', time: '00:00' }, requiredVariables: [] }), admin);
    const now = new Date('2026-10-26T00:00:00Z');
    await service.tick(now);
    expect(await models.WorkflowRun.count()).toBe(0);
    def = await service.saveDefinition(def.id, { ...def.get({ plain: true }), enabled: true }, admin);
    await service.tick(now);
    expect(await models.WorkflowRun.count()).toBe(12);
    await createService(models).tick(now);
    expect(await models.WorkflowRun.count()).toBe(24);
    await createService(models).tick(now);
    expect(await models.WorkflowRun.count()).toBe(26);
  });

  test('analytics excludes archived definitions and tasks but detects deleted staff', async () => {
    let def = await service.saveDefinition(null, input({ steps: [
      { title: 'Unassigned visible', description: 'No staff', assignees: [] },
      { title: 'Unassigned archived', description: 'Old', assignees: [], archived: true },
      { title: 'Deleted staff', description: 'Staff will leave', assignees: [outsider.id] },
    ] }), admin);
    await outsider.destroy();
    const response = await get('/workflows/analytics', admin);
    expect(response.status).toBe(200);
    expect(response.text).toContain('Unassigned tasks (2)');
    expect(response.text).toContain('Unassigned visible');
    expect(response.text).toContain('Deleted staff');
    expect(response.text).not.toContain('Unassigned archived');
    const data = def.get({ plain: true });
    data.steps[2].assignees = [];
    def = await service.saveDefinition(def.id, { ...data, archived: true }, admin);
    expect((await get('/workflows/analytics', admin)).text).toContain('Unassigned tasks (0)');
  });
});
