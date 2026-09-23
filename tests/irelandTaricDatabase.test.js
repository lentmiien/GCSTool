// Opt-in disposable database only; never import sequelize.js or read the application .env.
const Sequelize = require('sequelize');
const { createStore } = require('../services/irelandTaricStore');
const { createWorker } = require('../services/irelandTaricWorker');
const { createTransport } = require('../services/irelandTaricProtocol');
const express = require('express');
const suite = process.env.TARIC_TEST_MYSQL_PORT ? describe : describe.skip;
suite('disposable MySQL transactional outbox', () => {
  let db, models, store, owner, other, server, origin;
  const input = { id: '1'.repeat(32), run_id: '2'.repeat(32), item_id: '0_25', revision: 0,
    jan: '00123456', descriptive_name: 'SYNTHETIC INTEGRATION TEST', input_hs_code: '6912.00' };
  beforeAll(async () => {
    db = new Sequelize('gcs_taric_test', 'root', '', { host: '127.0.0.1', port: Number(process.env.TARIC_TEST_MYSQL_PORT), dialect: 'mysql', logging: false });
    models = { sequelize: db, Op: Sequelize.Op, User: require('../models/user')(db, Sequelize),
      IrelandTaricJob: require('../models/irelandtaricjob')(db, Sequelize) };
    await db.sync({ force: true });
    owner = String((await models.User.create({ userid: 'synthetic-owner' })).id);
    other = String((await models.User.create({ userid: 'synthetic-other' })).id);
    store = createStore(models);
  }, 20000);
  afterAll(async () => { if (server) await new Promise(resolve => server.close(resolve)); if (db) await db.close(); });
  beforeEach(async () => { await models.IrelandTaricJob.destroy({ where: {} }); });
  test('concurrent same-ID replay, owner isolation and immutable selection', async () => {
    const rows = await Promise.all([store.create(owner, input), store.create(owner, input)]);
    expect(rows[0].id).toBe(rows[1].id);
    expect(await models.IrelandTaricJob.count({ where: { owner } })).toBe(1);
    await expect(store.get(other, input.id)).rejects.toThrow('NOT_FOUND');
    await expect(store.create(other, input)).rejects.toThrow('NOT_FOUND');
    await expect(store.create(owner, { ...input, jan: '00123457' })).rejects.toThrow('IDEMPOTENCY_CONFLICT');
    await store.selection(owner, input.id, { selected_code: '0000000000' });
    await store.selection(owner, input.id, { selected_code: '0000000000' });
    await expect(store.selection(owner, input.id, { selected_code: '0000000001' })).rejects.toThrow('SELECTION_IMMUTABLE');
    await expect(store.selection(owner, input.id, { selected_code: '' })).rejects.toThrow('INVALID_FEEDBACK');
    expect((await createStore(models).get(owner, input.id)).selectedCode).toBe('0000000000');
  });
  test('durable early selection, real HTTP 202/poll/failure/feedback, stable keys and restart', async () => {
    const calls = [];
    let polls = 0, feedback = 0;
    const app = express(); app.use(express.json());
    app.use((req, res, next) => { calls.push({ path: req.path, key: req.get('Idempotency-Key'), body: req.body }); next(); });
    app.post('/api/taric/v1/requests', (req, res) => {
      expect(req.body).toEqual({ jan: input.jan, descriptive_name: input.descriptive_name, input_hs_code: '691200', test: true });
      res.status(202).json({ id: 'a'.repeat(32), state: 'queued', test: true, poll_url: 'http://do-not-fetch.invalid/steal' });
    });
    app.get(`/api/taric/v1/requests/${'a'.repeat(32)}`, (req, res) => {
      polls += 1;
      res.status(polls === 1 ? 202 : 200).json({ id: 'a'.repeat(32), state: polls === 1 ? 'running' : 'failed', test: true, error: polls === 1 ? null : 'JAN_AMBIGUOUS' });
    });
    app.post(`/api/taric/v1/requests/${'a'.repeat(32)}/feedback`, (req, res) => {
      feedback += 1;
      if (feedback === 1) return res.status(429).set('Retry-After', '2').json({ error: 'RATE_LIMITED' });
      res.json({ selected_code: req.body.selected_code, decision: 'manual', verification: 'unverified', training_approved: false });
    });
    server = await new Promise(resolve => { const listener = app.listen(0, '127.0.0.1', () => resolve(listener)); });
    origin = `http://127.0.0.1:${server.address().port}`;
    await store.create(owner, input);
    await store.selection(owner, input.id, { selected_code: '0000000000' });
    for (let i = 0; i < 5; i += 1) {
      const restartedStore = createStore(models);
      const worker = createWorker(restartedStore, createTransport(() => ({ origin, key: 'SYNTHETIC_ONLY' })));
      await worker.step(await restartedStore.get(owner, input.id));
    }
    const final = await store.get(owner, input.id);
    expect(final.feedback).toBe('sent');
    expect(final.output.error).toBe('JAN_AMBIGUOUS');
    expect(calls[3].key).toBe(calls[4].key);
    expect(calls[3].key).not.toBe(calls[0].key);
    expect(calls[4].body).toEqual({ selected_code: '0000000000' });
    expect(await store.claim('3'.repeat(32))).toBe(true);
    expect(await createStore(models).claim('4'.repeat(32))).toBe(false);
    await store.release('3'.repeat(32));
    expect(await store.claim('4'.repeat(32))).toBe(true);
  });
  test('two uncertain/pending remote jobs bound admission; owner queue bounded', async () => {
    await store.create(owner, input);
    await store.update(input.id, { state: 'pending' });
    await store.create(owner, { ...input, id: '3'.repeat(32), item_id: '1_25' });
    await store.update('3'.repeat(32), { state: 'paused' });
    await store.create(owner, { ...input, id: '4'.repeat(32), item_id: '2_25' });
    await store.update(input.id, { nextAt: new Date(Date.now() + 60000) });
    expect(await store.due()).toBeNull();
    await store.resume(owner, '3'.repeat(32));
    await store.update('3'.repeat(32), { nextAt: new Date(Date.now() + 60000) });
    expect(await store.due()).toBeNull(); // Replaying unknown admission cannot free a third slot.
  });
  test('paused delivery resumes with the same association; retries and retention are bounded', async () => {
    await store.create(owner, input);
    await store.selection(owner, input.id, { selected_code: '0000000000' });
    await store.update(input.id, { state: 'paused', upstreamId: 'a'.repeat(32), feedback: 'failed', attempts: 8 });
    await expect(store.selection(other, input.id, { selected_code: '0000000000' })).rejects.toThrow('NOT_FOUND');
    const resumed = await createStore(models).resume(owner, input.id);
    expect(resumed).toMatchObject({ state: 'pending', feedback: 'pending', upstreamId: 'a'.repeat(32), selectedCode: '0000000000', resumes: 1 });
    await store.update(input.id, { state: 'paused', resumes: 3 });
    await expect(store.resume(owner, input.id)).rejects.toThrow('RETRY_LIMIT');
    await store.update(input.id, { state: 'terminal', feedback: 'sent' });
    await store.create(owner, { ...input, id: '4'.repeat(32), item_id: '1_25' });
    const later = createStore(models, () => Date.now() + 31 * 86400000);
    await later.cleanup();
    await expect(later.get(owner, input.id)).rejects.toThrow('NOT_FOUND');
    expect((await later.get(owner, '4'.repeat(32))).state).toBe('queued');
  });
});
