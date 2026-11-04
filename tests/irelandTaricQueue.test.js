const { Op } = require('sequelize');
const { createStore } = require('../services/irelandTaricStore');

function setup(age = 16 * 60000, lease = 0) {
  const now = Date.UTC(2026, 10, 4);
  const transaction = { LOCK: { UPDATE: 'UPDATE' } };
  const control = { leaseUntil: new Date(lease), update: jest.fn() };
  const Job = { findOrCreate: jest.fn(), findByPk: jest.fn(async () => control),
    count: jest.fn(async () => 22), min: jest.fn(async () => new Date(now - 86400000)),
    max: jest.fn(async () => new Date(now - age)), destroy: jest.fn(async () => 22) };
  const sequelize = { transaction: fn => fn(transaction) };
  return { store: createStore({ IrelandTaricJob: Job, sequelize, Op }, () => now), Job, control, now };
}

test('queue status includes age and inactivity without exposing item data', async () => {
  const x = setup();
  expect(await x.store.queueStatus()).toEqual({ count: 22, waitingMs: 86400000, stalledMs: 960000, canClear: true });
  x.Job.count.mockResolvedValue(0);
  expect(await x.store.queueStatus()).toEqual({ count: 0, waitingMs: 0, stalledMs: 0, canClear: false });
});

test.each([0, 14 * 60000, 15 * 60000])('server refuses clearing after %i ms of inactivity', async age => {
  const x = setup(age);
  await expect(x.store.clearQueue()).rejects.toMatchObject({ safeCode: 'QUEUE_NOT_STALLED', status: 409 });
  expect(x.Job.destroy).not.toHaveBeenCalled();
});

test('live worker lease prevents clearing while a request is in flight', async () => {
  const x = setup(16 * 60000, Date.UTC(2026, 10, 4) + 60000);
  await expect(x.store.clearQueue()).rejects.toMatchObject({ safeCode: 'QUEUE_WORKER_BUSY' });
  expect(x.Job.destroy).not.toHaveBeenCalled();
});

test('stalled recovery clears all outstanding states and feedback under the control lock', async () => {
  const x = setup();
  expect(await x.store.clearQueue()).toEqual({ cleared: 22 });
  const options = x.Job.destroy.mock.calls[0][0];
  expect(options.transaction).toBeDefined();
  expect(options.where[Op.or]).toEqual([
    { state: { [Op.in]: ['queued', 'pending', 'paused'] } },
    { feedback: 'pending', state: { [Op.in]: ['terminal', 'rejected'] } },
  ]);
  expect(x.control.update).toHaveBeenCalledWith({ leaseUntil: new Date(0), leaseOwner: null }, expect.any(Object));
});
