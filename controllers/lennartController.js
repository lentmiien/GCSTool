// Constants
const AIT_UPDATES_CONTENT_ID = parseInt(process.env.AIT_UPDATES_CONTENT_ID);
const path = require('path');
const fs = require('fs');
const { webcrypto } = require('node:crypto');
if (!globalThis.crypto) globalThis.crypto = webcrypto;
const { ready } = require('zpl-renderer-js');

// Require necessary database models
const { Content, HostSample } = require('../sequelize');
const TMP_DIR = path.join(__dirname, '..', 'public', 'tmp');
let zplRenderer = null;
const DEFAULT_SAMPLE_LIMIT = 50;
const MAX_SAMPLE_LIMIT = 200;

async function getRenderer() {
  if (zplRenderer) {
    return zplRenderer;
  }
  const { api } = await ready;
  zplRenderer = api;
  return zplRenderer;
}

function splitZplLabels(zplContent) {
  return zplContent
    .split(/\^XZ/gi)
    .map((part) => part.trim())
    .filter((part) => part.length > 0)
    .map((part) => `${part}\n^XZ`);
}

async function writeImage(base64, filepath) {
  const cleaned = base64.includes(',') ? base64.split(',').pop() : base64;
  const buffer = Buffer.from(cleaned, 'base64');
  await fs.promises.mkdir(path.dirname(filepath), { recursive: true });
  await fs.promises.writeFile(filepath, buffer);
}

function sanitizeLimit(input) {
  const parsed = parseInt(input, 10);
  if (Number.isNaN(parsed)) {
    return DEFAULT_SAMPLE_LIMIT;
  }
  return Math.min(Math.max(parsed, 1), MAX_SAMPLE_LIMIT);
}

function normalizeProcessList(value) {
  if (Array.isArray(value)) {
    return value;
  }
  if (!value) {
    return [];
  }
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? parsed : [parsed];
    } catch (err) {
      return [{ error: value }];
    }
  }
  return [value];
}

function countNodeProcesses(processes) {
  return processes.filter((processInfo) => Number.isFinite(Number(processInfo && processInfo.pid))).length;
}

function countPm2Processes(processes) {
  return processes.filter((processInfo) => processInfo && typeof processInfo === 'object' && !processInfo.error).length;
}

function mapSampleForView(sample) {
  const plain = sample.get({ plain: true });
  const nodeProcesses = normalizeProcessList(plain.node_processes);
  const pm2Processes = normalizeProcessList(plain.pm2_processes);

  return {
    id: plain.id,
    tsIso: plain.ts ? new Date(plain.ts).toISOString() : '',
    hostname: plain.hostname,
    memTotalMb: plain.mem_total_mb,
    memUsedMb: plain.mem_used_mb,
    memAvailableMb: plain.mem_available_mb,
    swapTotalMb: plain.swap_total_mb,
    swapUsedMb: plain.swap_used_mb,
    load: [plain.load1, plain.load5, plain.load15].map((value) => Number(value).toFixed(2)).join(' / '),
    rootUsedPct: plain.root_used_pct,
    processCount: plain.process_count,
    nodeProcessCount: countNodeProcesses(nodeProcesses),
    pm2ProcessCount: countPm2Processes(pm2Processes),
    nodeProcessesText: JSON.stringify(nodeProcesses, null, 2),
    pm2ProcessesText: JSON.stringify(pm2Processes, null, 2),
  };
}

// Run for every connection (verify/log users, etc.)
exports.all = function (req, res, next) {
  res.locals.role = req.user.role;
  res.locals.name = req.user.userid;

  // This endpoint is for Lennart test stuff
  if (req.user.userid == 'Lennart') {
    next();
  } else {
    res.redirect('/');
  }
};

// Landing page
exports.index = (req, res) => {
  res.render('lennart_top', { i18n: res.__ });
};

exports.zpl = (req, res) => {
  res.render('lennart_zpl', { i18n: res.__, images: [], error: null });
};

exports.hostSamples = async (req, res) => {
  const hostname = typeof req.query.hostname === 'string' ? req.query.hostname.trim() : '';
  const limit = sanitizeLimit(req.query.limit);
  const where = {};

  if (hostname) {
    where.hostname = hostname;
  }

  try {
    const [hostRows, matchingRows, sampleRows] = await Promise.all([
      HostSample.findAll({
        attributes: ['hostname'],
        group: ['hostname'],
        order: [['hostname', 'ASC']],
        raw: true,
      }),
      HostSample.count({ where }),
      HostSample.findAll({
        where,
        order: [
          ['ts', 'DESC'],
          ['id', 'DESC'],
        ],
        limit,
      }),
    ]);

    const samples = sampleRows.map(mapSampleForView);

    res.render('lennart_host_samples', {
      i18n: res.__,
      error: null,
      hostname,
      hostnames: hostRows.map((row) => row.hostname),
      latestSample: samples.length > 0 ? samples[0] : null,
      limit,
      matchingRows,
      samples,
    });
  } catch (error) {
    console.error('Failed to load host samples:', error);
    res.status(500).render('lennart_host_samples', {
      i18n: res.__,
      error: 'Failed to load host samples.',
      hostname,
      hostnames: [],
      latestSample: null,
      limit,
      matchingRows: 0,
      samples: [],
    });
  }
};

exports.convertZpl = async (req, res) => {
  try {
    if (!req.files || !req.files.zplFile) {
      return res.status(400).render('lennart_zpl', { i18n: res.__, images: [], error: 'Please upload a ZPL file.' });
    }

    const upload = Array.isArray(req.files.zplFile) ? req.files.zplFile[0] : req.files.zplFile;
    const rawContent = upload.data.toString('utf8').trim();
    if (!rawContent) {
      return res.status(400).render('lennart_zpl', { i18n: res.__, images: [], error: 'The uploaded file is empty.' });
    }

    const labels = splitZplLabels(rawContent);
    if (labels.length === 0) {
      return res.status(400).render('lennart_zpl', { i18n: res.__, images: [], error: 'No labels found in the uploaded ZPL.' });
    }

    const renderer = await getRenderer();
    const timestamp = Date.now();
    const images = [];

    for (let i = 0; i < labels.length; i++) {
      const pngBase64 = await renderer.zplToBase64Async(labels[i]);
      const filename = `zpl_${timestamp}_${i + 1}.png`;
      const filepath = path.join(TMP_DIR, filename);
      await writeImage(pngBase64, filepath);
      images.push(`/tmp/${filename}`);
    }

    res.render('lennart_zpl', { i18n: res.__, images, error: null });
  } catch (err) {
    console.error('ZPL conversion failed:', err);
    res.status(500).render('lennart_zpl', { i18n: res.__, images: [], error: 'Failed to convert the ZPL file. Please try again.' });
  }
};

// Update the AIT manual content, need to set AIT_UPDATES_CONTENT_ID to correct id value to work
exports.updateait = (req, res) => {
  if (AIT_UPDATES_CONTENT_ID != -1) {
    Content.update({ data: req.body.data }, { where: { id: AIT_UPDATES_CONTENT_ID } }).then(() => {
      res.json({ status: 'updated!' });
    });
  } else {
    res.json({ status: "Can't update index -1, please set AIT_UPDATES_CONTENT_ID to correct value and restart server..." });
  }
};
