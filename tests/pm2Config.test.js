jest.mock('dotenv', () => ({ config: jest.fn() }));

const originalEnv = process.env;
beforeEach(() => {
  jest.resetModules();
  process.env = { ...originalEnv, PM2_APP_NAME: 'gcstool', PM2_MAX_MEMORY_MB: '500', PM2_HEAP_MB: '256' };
});
afterEach(() => { process.env = originalEnv; });

test('runs the Node entrypoint directly in one fork with independent heap and RSS limits', () => {
  const { apps } = require('../ecosystem.config');
  expect(apps).toHaveLength(1);
  expect(apps[0]).toMatchObject({
    name: 'gcstool', script: './bin/www', instances: 1, exec_mode: 'fork',
    max_memory_restart: '500M', node_args: ['--max-old-space-size=256'],
    restart_delay: 5000, kill_timeout: 40000, max_restarts: 10, env: { NODE_ENV: 'production' },
  });
});

test.each(['', '0', '-1', '500M', '1.5', 'Infinity'])('rejects an invalid RSS budget %j', value => {
  process.env.PM2_MAX_MEMORY_MB = value;
  expect(() => require('../ecosystem.config')).toThrow('PM2_MAX_MEMORY_MB');
});

test('requires an explicit heap budget and room for non-heap memory', () => {
  process.env.PM2_HEAP_MB = '';
  expect(() => require('../ecosystem.config')).toThrow('PM2_HEAP_MB');
  process.env.PM2_HEAP_MB = '500';
  expect(() => require('../ecosystem.config')).toThrow('must be smaller');
});
