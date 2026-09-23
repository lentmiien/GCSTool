const express = require('express');
const request = require('supertest');
const { createRouter, csrfToken } = require('../routes/irelandTaric');
const input = { id: '1'.repeat(32), run_id: '2'.repeat(32), item_id: '0_25', revision: 0, jan: '00123456', descriptive_name: 'SYNTHETIC mug', input_hs_code: '691200' };
function setup(auth = true, configured = () => {}) {
  process.env.SESSION_SECRET = 'synthetic-session-secret';
  const row = { id: input.id, input, owner: '9', state: 'queued', feedback: 'none' };
  const store = { create: jest.fn(async () => row), get: jest.fn(async () => row), list: jest.fn(async () => [row]),
    selection: jest.fn(async () => row), resume: jest.fn(async () => row) };
  const app = express();
  app.use(express.json({ limit: '4kb' }));
  app.use((req, res, next) => { req.user = { id: 9 }; req.isAuthenticated = () => auth; req.sessionID = 'synthetic-session'; next(); });
  app.use(createRouter(store, configured));
  return { app, store, csrf: csrfToken({ sessionID: 'synthetic-session' }) };
}
test('auth and CSRF protect mutations before any job calls', async () => {
  let x = setup(false);
  expect((await request(x.app).post('/requests').send(input)).status).toBe(401);
  expect(x.store.create).not.toHaveBeenCalled();
  x = setup();
  expect((await request(x.app).post('/requests').send(input)).status).toBe(403);
  expect((await request(x.app).post('/requests').set('X-CSRF-Token', 'x'.repeat(64)).send(input)).status).toBe(403);
  expect(x.store.create).not.toHaveBeenCalled();
  expect((await request(x.app).post('/requests').set('X-CSRF-Token', x.csrf).send(input)).status).toBe(202);
  expect(x.store.create).toHaveBeenCalledWith('9', input);
});
test('status does not start inference and is owner scoped with no-store', async () => {
  const x = setup();
  const r = await request(x.app).get(`/requests/${input.id}`);
  expect(r.status).toBe(200);
  expect(r.headers['cache-control']).toBe('private, no-store');
  expect(x.store.get).toHaveBeenCalledWith('9', input.id);
  expect(x.store.create).not.toHaveBeenCalled();
});
test('missing config is safe and failures never serialize raw errors', async () => {
  const x = setup(true, () => { throw new Error('PRIVATE_KEY_AND_URL'); });
  const r = await request(x.app).post('/requests').set('X-CSRF-Token', x.csrf).send(input);
  expect(r.status).toBe(503);
  expect(r.body).toEqual({ error: 'STORAGE_FAILED' });
  expect(x.store.create).not.toHaveBeenCalled();
});
test('selection returns durable local ack without upstream calls; size and rate bounded', async () => {
  const x = setup();
  expect((await request(x.app).post(`/requests/${input.id}/selection`).set('X-CSRF-Token', x.csrf).send({ selected_code: '0000000000' })).status).toBe(202);
  expect(x.store.selection).toHaveBeenCalledWith('9', input.id, { selected_code: '0000000000' });
  const huge = await request(x.app).post('/requests').set('X-CSRF-Token', x.csrf).send({ text: 'x'.repeat(5000) });
  expect(huge.status).toBe(413);
  for (let i = 0; i < 119; i += 1) await request(x.app).get(`/requests/${input.id}`);
  expect((await request(x.app).get(`/requests/${input.id}`)).status).toBe(429);
});
test('one local final-choice POST can durably register and queue without an upstream call', async () => {
  const x = setup(true, () => { throw new Error('configuration must not gate local saving'); });
  const response = await request(x.app).post('/selections').set('X-CSRF-Token', x.csrf)
    .send({ request: input, selected_code: '0000000000' });
  expect(response.status).toBe(202);
  expect(x.store.create).toHaveBeenCalledWith('9', input);
  expect(x.store.selection).toHaveBeenCalledWith('9', input.id, { selected_code: '0000000000' });
  const invalid = setup();
  expect((await request(invalid.app).post('/selections').set('X-CSRF-Token', invalid.csrf)
    .send({ request: input, selected_code: '' })).status).toBe(400);
  expect(invalid.store.create).not.toHaveBeenCalled();
});
