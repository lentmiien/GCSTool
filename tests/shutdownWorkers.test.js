jest.mock('../sequelize', () => ({
  User: { findByPk: jest.fn() }, Meeting: { create: jest.fn() }, MeetingComment: {},
}));
jest.mock('socket.io', () => jest.fn());
const socketIO = require('socket.io');
const { User, Meeting } = require('../sequelize');
const { createLifecycle } = require('../utils/gracefulShutdown');
const { startScheduler } = require('../services/workflows');
const { createWorker } = require('../services/irelandTaricWorker');

test('the workflow scheduler finishes an active tick and stops admitting new ticks', async () => {
  jest.useFakeTimers();
  try {
    const lifecycle = createLifecycle();
    let finish;
    const service = { tick: jest.fn(() => new Promise(resolve => { finish = resolve; })) };
    const cancel = startScheduler(service, console, task => lifecycle.run(task));
    lifecycle.stop();
    let drained = false;
    const drain = lifecycle.drain().then(() => { drained = true; });
    await Promise.resolve();
    expect(drained).toBe(false);
    finish();
    await drain;
    jest.advanceTimersByTime(120000);
    expect(service.tick).toHaveBeenCalledTimes(1);
    cancel();
  } finally { jest.useRealTimers(); }
});

test('the TARIC worker releases its lease before drain completes and cannot claim new work', async () => {
  jest.useFakeTimers();
  try {
    const lifecycle = createLifecycle();
    let release;
    const store = { claim: jest.fn().mockResolvedValue(true), due: jest.fn().mockResolvedValue(null),
      release: jest.fn(() => new Promise(resolve => { release = resolve; })) };
    const worker = createWorker(store, jest.fn(), () => 1000);
    const cancel = worker.start(task => lifecycle.run(task));
    jest.advanceTimersByTime(2000);
    // claim -> due -> release
    await Promise.resolve();
    await Promise.resolve();
    lifecycle.stop();
    let drained = false;
    const drain = lifecycle.drain().then(() => { drained = true; });
    await Promise.resolve();
    expect(drained).toBe(false);
    expect(store.release).toHaveBeenCalledTimes(1);
    release();
    await drain;
    jest.advanceTimersByTime(6000);
    expect(store.claim).toHaveBeenCalledTimes(1);
    cancel();
  } finally { jest.useRealTimers(); }
});

test('shutdown waits for an admitted meeting mutation and prevents another', async () => {
  const lifecycle = createLifecycle();
  const server = { on: jest.fn(), use: jest.fn(), emit: jest.fn() };
  socketIO.mockReturnValue(server);
  User.findByPk.mockResolvedValue({ id: 1, userid: 'tester', role: 'admin', password: 'synthetic' });
  let finish;
  Meeting.create.mockImplementation(() => new Promise(resolve => { finish = () => resolve({ dataValues: { id: 1 } }); }));
  const io = require('../socket_io_controller').io({}, jest.fn(), lifecycle);
  expect(io).toBe(server);
  const socket = { data: { actor: { id: 1 } }, request: { session: { passport: { user: 1 } } }, on: jest.fn(), emit: jest.fn() };
  const log = jest.spyOn(console, 'log').mockImplementation(() => {});
  try {
    server.on.mock.calls.find(call => call[0] === 'connection')[1](socket);
    const handler = socket.on.mock.calls.find(call => call[0] === 'meeting_new')[1];
    handler({ title: 'test', content: '', status: 'new' });
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
    expect(Meeting.create).toHaveBeenCalledTimes(1);
    lifecycle.stop();
    let drained = false;
    const drain = lifecycle.drain().then(() => { drained = true; });
    await Promise.resolve();
    expect(drained).toBe(false);
    handler({ title: 'another', content: '', status: 'new' });
    finish();
    await drain;
    expect(Meeting.create).toHaveBeenCalledTimes(1);
  } finally { log.mockRestore(); }
});
