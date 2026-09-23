const { createWorker } = require('../services/irelandTaricWorker');
const jobInput = { id: '1'.repeat(32), input: {}, state: 'queued', attempts: 0, feedback: 'none', expiresAt: new Date(999999999) };
const response = (state, error) => ({ status: state === 'queued' ? 202 : 200, data: { id: 'a'.repeat(32), test: true, state, result: null, error }, retryMs: 0 });
function setup(values = {}) {
  const job = { ...jobInput, ...values };
  const store = { update: jest.fn(async (id, values) => Object.assign(job, values)), claim: jest.fn(async () => true),
    release: jest.fn(), due: jest.fn(async () => job), cleanup: jest.fn() };
  const transport = jest.fn();
  return { job, store, transport, worker: createWorker(store, transport, () => 10000) };
}
test('pending selection survives worker recreation and is delivered after a failed prediction ID', async () => {
  const x = setup({ selectedCode: '0000000000', feedback: 'pending' });
  x.transport.mockResolvedValueOnce(response('queued'));
  await x.worker.step(x.job);
  expect(x.job.state).toBe('pending');
  x.transport.mockResolvedValueOnce(response('failed', 'EVIDENCE_NOT_FOUND'));
  await createWorker(x.store, x.transport, () => 10000).step(x.job);
  expect(x.job.upstreamId).toBe('a'.repeat(32));
  x.transport.mockResolvedValueOnce({ status: 200, data: { selected_code: '0000000000', decision: 'manual', verification: 'unverified', training_approved: false } });
  await x.worker.step(x.job);
  expect(x.job.feedback).toBe('sent');
  expect(x.transport.mock.calls.map(call => call[0])).toEqual(['submit', 'poll', 'feedback']);
});
test.each([409, 429, 502])('feedback transient %s retries the same selection and ID', async status => {
  const x = setup({ state: 'terminal', upstreamId: 'a'.repeat(32), selectedCode: '0000000000', feedback: 'pending' });
  x.transport.mockResolvedValue({ status, data: { error: status === 409 ? 'STALE' : 'RATE_LIMITED' }, retryMs: 60000 });
  await x.worker.step(x.job);
  expect(x.job.feedback).toBe('pending');
  expect(x.job.nextAt.getTime()).toBe(70000);
  expect(x.job.selectedCode).toBe('0000000000');
});
test('unknown submit acceptance retries unchanged; bounded failures pause', async () => {
  const x = setup();
  x.transport.mockResolvedValue({ status: 502, data: { error: 'SECRET' } });
  for (let i = 0; i < 8; i += 1) await x.worker.step(x.job);
  expect(x.job).toMatchObject({ state: 'paused', error: 'TRANSPORT_FAILED', attempts: 8 });
  expect(x.job.upstreamId).toBeUndefined();
});
test.each([401, 403, 404])('definite HTTP %s rejection never fabricates an upstream ID', async status => {
  const x = setup({ selectedCode: '0000000000', feedback: 'pending' });
  x.transport.mockResolvedValue({ status, data: { error: status === 404 ? 'NOT_FOUND' : 'UNAUTHORIZED' } });
  await x.worker.step(x.job); await x.worker.step(x.job);
  expect(x.job).toMatchObject({ state: 'rejected', feedback: 'unavailable' });
  expect(x.transport).toHaveBeenCalledTimes(1);
});
test('poll output cannot switch request identity', async () => {
  const x = setup({ state: 'pending', upstreamId: 'b'.repeat(32) });
  x.transport.mockResolvedValue(response('complete'));
  await x.worker.step(x.job);
  expect(x.job.upstreamId).toBe('b'.repeat(32));
  expect(x.job.output).toBeUndefined();
});
test('worker lease prevents simultaneous processing; deadline bounds delivery', async () => {
  const x = setup({ expiresAt: new Date(1), feedback: 'pending' });
  x.store.claim.mockResolvedValue(false);
  await x.worker.tick();
  expect(x.transport).not.toHaveBeenCalled();
  await x.worker.step(x.job);
  expect(x.job).toMatchObject({ state: 'paused', feedback: 'failed', error: 'DELIVERY_EXPIRED' });
});
test.each(['accepted', 'changed', 'manual'])('records %s only from an unverified feedback acknowledgement', async decision => {
  const x = setup({ state: 'terminal', upstreamId: 'a'.repeat(32), selectedCode: '0000000000', feedback: 'pending' });
  x.transport.mockResolvedValue({ status: 200, data: { selected_code: '0000000000', decision, verification: 'unverified', training_approved: false } });
  await x.worker.step(x.job);
  expect(x.job).toMatchObject({ state: 'terminal', feedback: 'sent' });
});
test('paused unknown admission cannot silently restart inference to send feedback', async () => {
  const x = setup({ state: 'paused', selectedCode: '0000000000', feedback: 'pending', attempts: 8 });
  await x.worker.step(x.job);
  expect(x.transport).not.toHaveBeenCalled();
  expect(x.job.feedback).toBe('failed');
});
test('bounded polling pauses, and a missing configuration is a safe retryable failure', async () => {
  const x = setup({ state: 'pending', polls: 239, upstreamId: 'a'.repeat(32) });
  x.transport.mockResolvedValue(response('queued'));
  await x.worker.step(x.job);
  expect(x.job.state).toBe('paused');
  const y = setup(); y.transport.mockRejectedValue(new Error('PRIVATE'));
  await y.worker.step(y.job);
  expect(y.job.error).toBe('CONFIG_NOT_READY');
});
test('paused pending prediction is polled to terminal before final feedback', async () => {
  const x = setup({ state: 'paused', upstreamId: 'a'.repeat(32), selectedCode: '0000000000', feedback: 'pending' });
  x.transport.mockResolvedValueOnce(response('queued'));
  await x.worker.step(x.job);
  expect(x.transport.mock.calls[0][0]).toBe('poll');
  expect(x.job.state).toBe('pending');
});
test('immutable feedback conflict is visible and never retried automatically', async () => {
  const x = setup({ state: 'terminal', upstreamId: 'a'.repeat(32), selectedCode: '0000000000', feedback: 'pending' });
  x.transport.mockResolvedValue({ status: 409, data: { error: 'IDEMPOTENCY_CONFLICT' } });
  await x.worker.step(x.job);
  expect(x.job).toMatchObject({ feedback: 'failed', error: 'IDEMPOTENCY_CONFLICT', selectedCode: '0000000000' });
});
test('Retry-After is respected beyond one minute and bounded by the delivery deadline', async () => {
  const x = setup();
  x.transport.mockResolvedValue({ status: 429, data: { error: 'RATE_LIMITED' }, retryMs: 180000 });
  await x.worker.step(x.job);
  expect(x.job.nextAt.getTime()).toBe(190000);
  x.transport.mockResolvedValue({ status: 429, data: { error: 'RATE_LIMITED' }, retryMs: Number.MAX_VALUE });
  await x.worker.step(x.job);
  expect(x.job.nextAt).toEqual(x.job.expiresAt);
});
test('exhausted remote polling cannot loop forever through pending feedback', async () => {
  const x = setup({ state: 'pending', polls: 239, upstreamId: 'a'.repeat(32), selectedCode: '0000000000', feedback: 'pending' });
  x.transport.mockResolvedValue(response('queued'));
  await x.worker.step(x.job);
  expect(x.job).toMatchObject({ state: 'paused', feedback: 'failed' });
});
