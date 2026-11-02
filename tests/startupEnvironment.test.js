const fs = require('fs');
const path = require('path');
const vm = require('vm');

const startup = fs.readFileSync(path.join(__dirname, '..', 'bin', 'www'), 'utf8');

function boot(env, fileEnv = {}) {
  const reachedAppStartup = new Error('Reached app startup');
  const config = jest.fn(() => {
    // dotenv preserves existing process variables, including empty strings.
    for (const [key, value] of Object.entries(fileEnv)) {
      if (env[key] === undefined) env[key] = value;
    }
  });
  const context = {
    __dirname: '/deployment/gcstool/bin',
    process: { env },
    require: name => {
      if (name === 'path') return path;
      if (name === 'dotenv') return { config };
      // Stop before diagnostics, app imports or database connections.
      throw reachedAppStartup;
    },
  };
  let error;
  try { vm.runInNewContext(startup, context); } catch (caught) { error = caught; }
  return { config, error, reachedAppStartup };
}

test('loads the environment beside the project, independently of the working directory', () => {
  const result = boot({}, { SESSION_SECRET: 'synthetic-file-secret' });
  expect(result.config).toHaveBeenCalledWith({ path: '/deployment/gcstool/.env' });
  expect(result.error).toBe(result.reachedAppStartup);
});

test('accepts a supplied process secret without requiring an env file', () => {
  const env = { SESSION_SECRET: 'synthetic-process-secret' };
  const result = boot(env, { SESSION_SECRET: 'synthetic-file-secret' });
  expect(env.SESSION_SECRET).toBe('synthetic-process-secret');
  expect(result.error).toBe(result.reachedAppStartup);
});

test.each([undefined, '', '   '])('fails before app startup when the secret is %j', secret => {
  const result = boot({ SESSION_SECRET: secret });
  expect(result.error.message).toMatch(/SESSION_SECRET is required/);
  expect(result.error).not.toBe(result.reachedAppStartup);
});

test('reports an empty inherited secret rather than silently replacing it', () => {
  const result = boot({ SESSION_SECRET: '' }, { SESSION_SECRET: 'synthetic-file-secret' });
  expect(result.error.message).toMatch(/SESSION_SECRET is required/);
  expect(result.error.message).not.toContain('synthetic-file-secret');
});
