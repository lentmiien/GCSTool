jest.mock('perf_hooks', () => ({ monitorEventLoopDelay: jest.fn() }));
const { monitorEventLoopDelay } = require('perf_hooks');
const { startRuntimeDiagnostics } = require('../utils/runtimeDiagnostics');
const { startJobDeadline } = require('../utils/jobDeadline');

beforeEach(() => jest.useFakeTimers());
afterEach(() => {
  jest.useRealTimers();
  jest.restoreAllMocks();
});

test('records memory outside the JS heap and event-loop stalls without retaining samples', () => {
  const delay = { enable: jest.fn(), disable: jest.fn(), reset: jest.fn(), max: 250000000 };
  monitorEventLoopDelay.mockReturnValue(delay);
  const output = { write: jest.fn() };
  const stop = startRuntimeDiagnostics({ intervalMs: 1000, output });
  const sample = JSON.parse(output.write.mock.calls[0][0]);
  expect(sample).toMatchObject({ event: 'runtime_sample', pid: process.pid, eventLoopMaxMs: 250 });
  for (const key of ['rssBytes', 'heapUsedBytes', 'heapTotalBytes', 'heapLimitBytes', 'externalBytes', 'arrayBufferBytes']) {
    expect(sample[key]).toEqual(expect.any(Number));
  }
  jest.advanceTimersByTime(1000);
  expect(output.write).toHaveBeenCalledTimes(2);
  stop();
  jest.advanceTimersByTime(1000);
  expect(output.write).toHaveBeenCalledTimes(2);
  expect(delay.disable).toHaveBeenCalledTimes(1);
  expect(jest.getTimerCount()).toBe(0);
});

test('skips diagnostics while the logging pipe is backed up and resumes after it drains', () => {
  const delay = { enable: jest.fn(), disable: jest.fn(), reset: jest.fn(), max: 0 };
  monitorEventLoopDelay.mockReturnValue(delay);
  const output = { write: jest.fn(), writableNeedDrain: true };
  const stop = startRuntimeDiagnostics({ intervalMs: 1000, output });
  jest.advanceTimersByTime(2000);
  expect(output.write).not.toHaveBeenCalled();
  output.writableNeedDrain = false;
  jest.advanceTimersByTime(1000);
  expect(output.write).toHaveBeenCalledTimes(1);
  stop();
});

test('terminates a stalled monitoring job with a failure exit code', () => {
  const exit = jest.spyOn(process, 'exit').mockImplementation(() => {});
  const write = jest.spyOn(process.stderr, 'write').mockImplementation(() => true);
  startJobDeadline('collector', 45000);
  jest.advanceTimersByTime(44999);
  expect(exit).not.toHaveBeenCalled();
  jest.advanceTimersByTime(1);
  expect(exit).toHaveBeenCalledWith(1);
  expect(JSON.parse(write.mock.calls[0][0])).toMatchObject({ event: 'job_deadline_exceeded', job: 'collector' });
});

test('cancels the deadline after a monitoring job completes', () => {
  const exit = jest.spyOn(process, 'exit').mockImplementation(() => {});
  const clear = startJobDeadline('collector', 45000);
  clear();
  jest.advanceTimersByTime(45000);
  expect(exit).not.toHaveBeenCalled();
  expect(jest.getTimerCount()).toBe(0);
});
