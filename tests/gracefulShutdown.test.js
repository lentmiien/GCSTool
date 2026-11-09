const { EventEmitter } = require('events');
const express = require('express');
const request = require('supertest');
const { createLifecycle, installGracefulShutdown } = require('../utils/gracefulShutdown');

function deferred() {
  let resolve;
  const promise = new Promise(done => { resolve = done; });
  return { promise, resolve };
}

test('drains admitted work, prevents new work, and releases failed tasks', async () => {
  const lifecycle = createLifecycle();
  const task = deferred();
  const active = lifecycle.run(() => task.promise);
  await expect(lifecycle.run(() => Promise.reject(new Error('task failed')))).rejects.toThrow('task failed');
  lifecycle.stop();
  const next = jest.fn();
  await lifecycle.run(next);
  expect(next).not.toHaveBeenCalled();
  let drained = false;
  const drain = lifecycle.drain().then(() => { drained = true; });
  await Promise.resolve();
  expect(drained).toBe(false);
  task.resolve();
  await active;
  await drain;
  expect(drained).toBe(true);
});

test('finishes an active HTTP response and rejects requests admitted after shutdown', async () => {
  const lifecycle = createLifecycle();
  const entered = deferred();
  const responseReady = deferred();
  const app = express();
  app.use(lifecycle.middleware);
  app.get('/', async (req, res) => {
    entered.resolve();
    await responseReady.promise;
    res.send('saved');
  });
  const response = request(app).get('/').then(result => result);
  await entered.promise;
  lifecycle.stop();
  const rejected = await request(app).get('/');
  expect(rejected.status).toBe(503);
  expect(rejected.headers['retry-after']).toBe('10');
  let drained = false;
  const drain = lifecycle.drain().then(() => { drained = true; });
  await Promise.resolve();
  expect(drained).toBe(false);
  responseReady.resolve();
  expect((await response).text).toBe('saved');
  await drain;
  expect(drained).toBe(true);
});

test('disconnects HTTP tracking on client close without retaining listeners', async () => {
  const lifecycle = createLifecycle();
  const res = new EventEmitter();
  lifecycle.middleware({}, res, jest.fn());
  res.emit('close');
  lifecycle.stop();
  await lifecycle.drain();
  expect(res.listenerCount('finish')).toBe(0);
  expect(res.listenerCount('close')).toBe(0);
});

test('signals close listeners immediately but close pools only after work drains', async () => {
  jest.useFakeTimers();
  try {
    const lifecycle = createLifecycle();
    const task = deferred();
    const active = lifecycle.run(() => task.promise);
    const runtime = Object.assign(new EventEmitter(), { pid: 123, exit: jest.fn() });
    const server = { close: jest.fn() };
    const io = { close: jest.fn() };
    const closeResources = jest.fn();
    const stop = installGracefulShutdown({ lifecycle, server, io, closeResources, runtime,
      logger: { log: jest.fn(), error: jest.fn() } });
    runtime.emit('SIGINT');
    runtime.emit('SIGTERM');
    expect(server.close).toHaveBeenCalledTimes(1);
    expect(io.close).toHaveBeenCalledTimes(1);
    expect(closeResources).not.toHaveBeenCalled();
    task.resolve();
    await active;
    await stop('SIGINT');
    expect(closeResources).toHaveBeenCalledTimes(1);
    expect(runtime.exit).toHaveBeenCalledWith(0);
    expect(jest.getTimerCount()).toBe(0);
  } finally { jest.useRealTimers(); }
});

test('a hung resource cleanup cannot prevent the shutdown deadline', async () => {
  jest.useFakeTimers();
  try {
    const runtime = Object.assign(new EventEmitter(), { exit: jest.fn() });
    const stop = installGracefulShutdown({ lifecycle: createLifecycle(),
      server: { close: jest.fn() }, io: { close: jest.fn() },
      closeResources: () => new Promise(() => {}), runtime,
      logger: { log: jest.fn(), error: jest.fn() } });
    stop('SIGTERM');
    await Promise.resolve();
    jest.advanceTimersByTime(29999);
    expect(runtime.exit).not.toHaveBeenCalled();
    jest.advanceTimersByTime(1);
    expect(runtime.exit).toHaveBeenCalledWith(1);
  } finally { jest.useRealTimers(); }
});

test('a real SIGINT drains an HTTP response with Socket.IO attached before exiting', async () => {
  const { spawn } = require('child_process');
  const http = require('http');
  const child = spawn(process.execPath, ['-e', `
    const express = require('express');
    const http = require('http');
    const { createLifecycle, installGracefulShutdown } = require('./utils/gracefulShutdown');
    const lifecycle = createLifecycle();
    const app = express();
    app.use(lifecycle.middleware);
    app.get('/', (req, res) => {
      process.send({ started: true });
      setTimeout(() => res.send('saved'), 100);
    });
    const server = http.createServer(app);
    const io = require('socket.io')(server);
    installGracefulShutdown({ lifecycle, server, io, closeResources: async () => {} });
    server.listen(0, '127.0.0.1', () => process.send({ port: server.address().port }));
  `], { cwd: require('path').join(__dirname, '..'), stdio: ['ignore', 'pipe', 'pipe', 'ipc'] });
  let output = '';
  child.stdout.on('data', chunk => { output += chunk; });
  const exit = new Promise((resolve, reject) => {
    child.once('error', reject);
    child.once('exit', (code, signal) => resolve({ code, signal }));
  });
  const deadline = setTimeout(() => child.kill('SIGKILL'), 4000);
  try {
    const response = new Promise((resolve, reject) => {
      child.on('message', message => {
        if (message.started) child.kill('SIGINT');
        if (message.port) {
          http.get(`http://127.0.0.1:${message.port}/`, res => {
            let body = '';
            res.on('data', chunk => { body += chunk; });
            res.on('end', () => resolve({ status: res.statusCode, body }));
            res.on('error', reject);
          }).on('error', reject);
        }
      });
      child.once('exit', code => { if (code !== 0) reject(new Error('Child exited before completing the request')); });
    });
    expect(await response).toEqual({ status: 200, body: 'saved' });
    expect(await exit).toEqual({ code: 0, signal: null });
    expect(output).toContain('shutdown_complete');
  } finally {
    clearTimeout(deadline);
    if (child.exitCode === null && child.signalCode === null) child.kill('SIGKILL');
  }
});
