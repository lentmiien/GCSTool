const path = require('path');
const { promisify } = require('util');
const { execFile } = require('child_process');

// Never print jlist or subprocess errors: PM2 includes application secrets.
async function restartApp({ pm2Bin, appName, projectDir, dryRun = false,
  execute = promisify(execFile), logger = console }) {
  const options = { timeout: 10000, killSignal: 'SIGKILL', maxBuffer: 2 * 1024 * 1024 };
  const list = async () => {
    const { stdout } = await execute(pm2Bin, ['jlist'], options);
    const processes = JSON.parse(stdout);
    if (!Array.isArray(processes)) throw new Error('Invalid PM2 process list.');
    return processes;
  };
  const processes = await list();
  const matches = processes.filter(item => item.name === appName);
  if (matches.length !== 1) throw new Error('Expected exactly one matching PM2 app.');
  const app = matches[0];
  const env = app.pm2_env || {};
  if (!Number.isSafeInteger(app.pm_id) || app.pm_id < 0
    || env.status !== 'online' || env.exec_mode !== 'fork_mode'
    || env.pm_exec_path !== path.join(projectDir, 'bin', 'www')
    || env.pm_cwd !== projectDir || !Number.isFinite(Number(env.kill_timeout))
    || Number(env.kill_timeout) < 40000) {
    throw new Error('App must be online, directly run bin/www in the project directory, and have a 40-second kill timeout.');
  }
  logger.log(JSON.stringify({ event: dryRun ? 'weekly_restart_check' : 'weekly_restart_started',
    ts: new Date().toISOString(), name: appName, pid: app.pid, rssBytes: app.monit && app.monit.memory }));
  if (dryRun) return;
  // Target the validated ID. Keep the saved environment, limits and process definition.
  await execute(pm2Bin, ['restart', String(app.pm_id)], { ...options, timeout: 70000 });
  const after = (await list()).find(item => item.pm_id === app.pm_id && item.name === appName);
  if (!after || after.pm2_env.status !== 'online' || !after.pid || after.pid === app.pid) {
    throw new Error('PM2 did not report a new online app process.');
  }
  logger.log(JSON.stringify({ event: 'weekly_restart_complete', ts: new Date().toISOString(), name: appName, pid: after.pid }));
}

if (require.main === module) {
  const projectDir = path.join(__dirname, '..');
  require('dotenv').config({ path: path.join(projectDir, '.env') });
  if (process.argv.slice(2).some(arg => arg !== '--check')) {
    console.error('Usage: node scripts/restart_gcstool.js [--check]');
    process.exitCode = 1;
  } else {
    restartApp({
      pm2Bin: process.env.PM2_BIN || 'pm2',
      appName: process.env.PM2_APP_NAME || 'gcstool',
      projectDir,
      dryRun: process.argv.includes('--check'),
    }).catch(() => {
      console.error('Weekly restart failed. Check the PM2 user, executable, app name, working directory, status and kill timeout.');
      process.exitCode = 1;
    });
  }
}

module.exports = { restartApp };
