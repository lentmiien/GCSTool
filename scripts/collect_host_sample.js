const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const os = require('os');
const fs = require('fs/promises');
const util = require('util');
const { execFile } = require('child_process');
const Sequelize = require('sequelize');

const HostSampleModel = require('../models/host_sample');

const execFileP = util.promisify(execFile);
const PM2_BIN = process.env.PM2_BIN || (process.platform === 'win32' ? 'pm2.cmd' : 'pm2');

function kbToMb(kb) {
  return Math.round(kb / 1024);
}

function bytesToMb(bytes) {
  return Math.round(bytes / 1024 / 1024);
}

function countNodeProcesses(processes) {
  return Array.isArray(processes)
    ? processes.filter((processInfo) => Number.isFinite(Number(processInfo && processInfo.pid))).length
    : 0;
}

function createSequelize() {
  const required = ['DB_NAME_GCS', 'DB_USER', 'DB_PASS', 'DB_HOST'];
  const missing = required.filter((name) => typeof process.env[name] === 'undefined');

  if (missing.length > 0) {
    throw new Error(`Missing database configuration: ${missing.join(', ')}`);
  }

  return new Sequelize(process.env.DB_NAME_GCS, process.env.DB_USER, process.env.DB_PASS, {
    host: process.env.DB_HOST,
    dialect: 'mysql',
    logging: false,
  });
}

async function readMemInfo() {
  if (process.platform !== 'linux') {
    const memTotalMb = bytesToMb(os.totalmem());
    const memAvailableMb = bytesToMb(os.freemem());

    return {
      memTotalMb,
      memUsedMb: Math.max(memTotalMb - memAvailableMb, 0),
      memAvailableMb,
      swapTotalMb: 0,
      swapUsedMb: 0,
    };
  }

  const text = await fs.readFile('/proc/meminfo', 'utf8');
  const map = {};

  for (const line of text.split('\n')) {
    const match = line.match(/^(\w+):\s+(\d+)\s+kB$/);
    if (match) {
      map[match[1]] = Number(match[2]);
    }
  }

  const memTotal = map.MemTotal || 0;
  const memAvailable = map.MemAvailable || 0;
  const swapTotal = map.SwapTotal || 0;
  const swapFree = map.SwapFree || 0;

  return {
    memTotalMb: kbToMb(memTotal),
    memUsedMb: kbToMb(memTotal - memAvailable),
    memAvailableMb: kbToMb(memAvailable),
    swapTotalMb: kbToMb(swapTotal),
    swapUsedMb: kbToMb(swapTotal - swapFree),
  };
}

async function readRootDisk() {
  if (process.platform !== 'linux') {
    return {
      rootUsedPct: 0,
    };
  }

  const { stdout } = await execFileP('df', ['-Pk', '/']);
  const lines = stdout.trim().split('\n');
  if (lines.length < 2) {
    throw new Error('Unexpected df output');
  }

  const cols = lines[1].trim().split(/\s+/);

  return {
    rootUsedPct: Number(cols[4].replace('%', '')) || 0,
  };
}

async function readNodeProcesses() {
  if (process.platform !== 'linux') {
    return [{ error: `Unsupported platform: ${process.platform}` }];
  }

  try {
    const { stdout } = await execFileP('ps', [
      '-C',
      'node',
      '-o',
      'pid=,rss=,pcpu=,etime=,args=',
    ]);

    return stdout
      .trim()
      .split('\n')
      .filter(Boolean)
      .map((line) => {
        const match = line.trim().match(/^(\d+)\s+(\d+)\s+([\d.]+)\s+(\S+)\s+(.+)$/);
        if (!match) {
          return { raw: line.trim() };
        }

        return {
          pid: Number(match[1]),
          rssMb: kbToMb(Number(match[2])),
          cpuPct: Number(match[3]),
          etime: match[4],
          args: match[5],
        };
      });
  } catch (err) {
    return [{ error: err.message }];
  }
}

async function readPm2Processes() {
  try {
    const { stdout } = await execFileP(PM2_BIN, ['jlist']);
    const list = JSON.parse(stdout);

    return list.map((processInfo) => ({
      name: processInfo.name,
      pid: processInfo.pid,
      status: processInfo.pm2_env && processInfo.pm2_env.status ? processInfo.pm2_env.status : null,
      restarts: processInfo.pm2_env && processInfo.pm2_env.restart_time ? processInfo.pm2_env.restart_time : 0,
      unstableRestarts: processInfo.pm2_env && processInfo.pm2_env.unstable_restarts ? processInfo.pm2_env.unstable_restarts : 0,
      memoryMb: Math.round(((processInfo.monit && processInfo.monit.memory) || 0) / 1024 / 1024),
      cpuPct: processInfo.monit && processInfo.monit.cpu ? processInfo.monit.cpu : 0,
    }));
  } catch (err) {
    return [{ error: err.message }];
  }
}

async function main() {
  const sequelize = createSequelize();
  const HostSample = HostSampleModel(sequelize, Sequelize);

  try {
    await HostSample.sync();

    const [mem, disk, nodeProcesses, pm2Processes] = await Promise.all([
      readMemInfo(),
      readRootDisk(),
      readNodeProcesses(),
      readPm2Processes(),
    ]);
    const [load1, load5, load15] = os.loadavg();
    const hostname = process.env.HOSTNAME_OVERRIDE || os.hostname();
    const nodeProcessCount = countNodeProcesses(nodeProcesses);

    await HostSample.create({
      ts: new Date(),
      hostname,
      mem_total_mb: mem.memTotalMb,
      mem_used_mb: mem.memUsedMb,
      mem_available_mb: mem.memAvailableMb,
      swap_total_mb: mem.swapTotalMb,
      swap_used_mb: mem.swapUsedMb,
      load1,
      load5,
      load15,
      root_used_pct: disk.rootUsedPct,
      process_count: nodeProcessCount,
      node_processes: nodeProcesses,
      pm2_processes: pm2Processes,
    });

    console.log(new Date().toISOString(), 'sample stored', {
      hostname,
      memAvailableMb: mem.memAvailableMb,
      nodeProcessCount,
    });
  } finally {
    await sequelize.close();
  }
}

main().catch((err) => {
  console.error(new Date().toISOString(), 'sample failed', err);
  process.exit(1);
});
