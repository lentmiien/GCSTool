const { restartApp } = require('../scripts/restart_gcstool');

function setup(change = {}) {
  const app = { name: 'gcstool', pm_id: 3, pid: 100, monit: { memory: 350000000 }, pm2_env: {
    status: 'online', exec_mode: 'fork_mode', pm_exec_path: '/app/bin/www', pm_cwd: '/app', kill_timeout: 40000, ...change,
  } };
  const execute = jest.fn().mockResolvedValueOnce({ stdout: JSON.stringify([app]) })
    .mockResolvedValueOnce({ stdout: '' })
    .mockResolvedValueOnce({ stdout: JSON.stringify([{ ...app, pid: 200 }]) });
  const options = { pm2Bin: '/bin/pm2', appName: 'gcstool', projectDir: '/app', execute, logger: { log: jest.fn() } };
  return { app, execute, options };
}

test('restarts only the checked ID without deleting, starting or changing its environment', async () => {
  const { execute, options } = setup();
  await restartApp(options);
  expect(execute.mock.calls.map(call => call[1])).toEqual([['jlist'], ['restart', '3'], ['jlist']]);
  expect(execute.mock.calls[1][2].timeout).toBe(70000);
  expect(options.logger.log).toHaveBeenCalledTimes(2);
});

test('dry run verifies configuration without restarting', async () => {
  const { execute, options } = setup();
  await restartApp({ ...options, dryRun: true });
  expect(execute).toHaveBeenCalledTimes(1);
});

test.each([
  { status: 'stopped' }, { exec_mode: 'cluster_mode' }, { pm_exec_path: '/bin/npm' },
  { pm_cwd: '/wrong' }, { kill_timeout: 1600 }, { kill_timeout: undefined }, { kill_timeout: 'invalid' },
])('refuses unsafe or incompatible process settings: %j', async change => {
  const { execute, options } = setup(change);
  await expect(restartApp(options)).rejects.toThrow('App must be online');
  expect(execute).toHaveBeenCalledTimes(1);
});

test.each([0, 2])('refuses %i matching processes', async count => {
  const { app, execute, options } = setup();
  execute.mockReset().mockResolvedValue({ stdout: JSON.stringify(Array(count).fill(app)) });
  await expect(restartApp(options)).rejects.toThrow('exactly one');
  expect(execute).toHaveBeenCalledTimes(1);
});

test('checks the restarted PID and never logs the full PM2 environment', async () => {
  const { app, execute, options } = setup({ SECRET: 'synthetic-secret' });
  execute.mockReset().mockResolvedValueOnce({ stdout: JSON.stringify([app]) })
    .mockResolvedValueOnce({ stdout: '' }).mockResolvedValueOnce({ stdout: JSON.stringify([app]) });
  await expect(restartApp(options)).rejects.toThrow('new online');
  expect(JSON.stringify(options.logger.log.mock.calls)).not.toContain('synthetic-secret');
});
