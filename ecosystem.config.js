const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });

function requiredMegabytes(name) {
  const value = Number(process.env[name]);
  if (!Number.isSafeInteger(value) || value < 1) {
    throw new Error(`Set ${name} to a positive integer in MiB; see documentation/runtime-safety.md.`);
  }
  return value;
}

const rssLimitMb = requiredMegabytes('PM2_MAX_MEMORY_MB');
const heapLimitMb = requiredMegabytes('PM2_HEAP_MB');
if (heapLimitMb >= rssLimitMb) {
  throw new Error('PM2_HEAP_MB must be smaller than PM2_MAX_MEMORY_MB to leave room for Buffers and native memory.');
}

module.exports = {
  apps: [{
    name: process.env.PM2_APP_NAME || 'gcstool',
    cwd: __dirname,
    script: './bin/www',
    instances: 1,
    exec_mode: 'fork',
    // RSS restart threshold, NOT a hard allocation cap (PM2 polls periodically).
    max_memory_restart: `${rssLimitMb}M`,
    node_args: [`--max-old-space-size=${heapLimitMb}`],
    autorestart: true,
    restart_delay: 5000,
    // App drains admitted work for up to 30s before exiting itself.
    kill_timeout: 40000,
    min_uptime: '60s',
    max_restarts: 10,
    watch: false,
    env: { NODE_ENV: 'production' },
  }],
};
