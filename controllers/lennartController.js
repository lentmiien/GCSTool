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
const CHART_COLORS = [
  '#c0392b',
  '#2980b9',
  '#8e44ad',
  '#27ae60',
  '#d35400',
  '#16a085',
  '#2c3e50',
  '#f39c12',
];

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

function formatTimestampShort(value) {
  if (!value) {
    return '';
  }

  return new Date(value).toISOString().slice(0, 16).replace('T', ' ');
}

function formatDuration(durationMs) {
  if (!Number.isFinite(durationMs) || durationMs <= 0) {
    return '0 min';
  }
  if (durationMs < 60 * 60 * 1000) {
    return `${(durationMs / (60 * 1000)).toFixed(1)} min`;
  }
  if (durationMs < 24 * 60 * 60 * 1000) {
    return `${(durationMs / (60 * 60 * 1000)).toFixed(1)} hr`;
  }
  return `${(durationMs / (24 * 60 * 60 * 1000)).toFixed(1)} days`;
}

function average(values) {
  if (!Array.isArray(values) || values.length === 0) {
    return 0;
  }

  const total = values.reduce((sum, value) => sum + value, 0);
  return total / values.length;
}

function maximum(values) {
  if (!Array.isArray(values) || values.length === 0) {
    return 0;
  }

  return Math.max(...values);
}

function formatValue(value, decimals, suffix) {
  if (!Number.isFinite(value)) {
    return `0${suffix || ''}`;
  }

  return `${Number(value).toFixed(decimals)}${suffix || ''}`;
}

function getChartColor(index) {
  return CHART_COLORS[index % CHART_COLORS.length];
}

function buildMetricRow(label, values, latestValue, options) {
  const suffix = options && options.suffix ? options.suffix : '';
  const latestDecimals = options && typeof options.latestDecimals === 'number' ? options.latestDecimals : 0;
  const averageDecimals = options && typeof options.averageDecimals === 'number' ? options.averageDecimals : latestDecimals;
  const maxDecimals = options && typeof options.maxDecimals === 'number' ? options.maxDecimals : latestDecimals;

  return {
    label,
    latest: formatValue(latestValue, latestDecimals, suffix),
    average: formatValue(average(values), averageDecimals, suffix),
    max: formatValue(maximum(values), maxDecimals, suffix),
  };
}

function buildOverview(samples, matchingRows) {
  if (!Array.isArray(samples) || samples.length === 0) {
    return null;
  }

  const latestSample = samples[0];
  const oldestSample = samples[samples.length - 1];
  const latestTime = new Date(latestSample.tsIso);
  const oldestTime = new Date(oldestSample.tsIso);

  const memoryUsedMb = samples.map((sample) => sample.memUsedMb);
  const memoryUsedPct = samples.map((sample) => sample.memUsedPct);
  const swapUsedMb = samples.map((sample) => sample.swapUsedMb);
  const load1 = samples.map((sample) => sample.load1);
  const rootUsedPct = samples.map((sample) => sample.rootUsedPct);
  const nodeProcesses = samples.map((sample) => sample.processCount);
  const pm2Processes = samples.map((sample) => sample.pm2ProcessCount);

  return {
    displayedRows: samples.length,
    matchingRows,
    latestTsIso: latestSample.tsIso,
    oldestTsIso: oldestSample.tsIso,
    latestTsShort: formatTimestampShort(latestSample.tsIso),
    oldestTsShort: formatTimestampShort(oldestSample.tsIso),
    windowDurationText: formatDuration(latestTime - oldestTime),
    metrics: [
      buildMetricRow('Memory used (MB)', memoryUsedMb, latestSample.memUsedMb, {
        latestDecimals: 0,
        averageDecimals: 1,
        maxDecimals: 0,
        suffix: ' MB',
      }),
      buildMetricRow('Memory used (%)', memoryUsedPct, latestSample.memUsedPct, {
        latestDecimals: 1,
        averageDecimals: 1,
        maxDecimals: 1,
        suffix: '%',
      }),
      buildMetricRow('Swap used (MB)', swapUsedMb, latestSample.swapUsedMb, {
        latestDecimals: 0,
        averageDecimals: 1,
        maxDecimals: 0,
        suffix: ' MB',
      }),
      buildMetricRow('Load 1m', load1, latestSample.load1, {
        latestDecimals: 2,
        averageDecimals: 2,
        maxDecimals: 2,
      }),
      buildMetricRow('Root disk (%)', rootUsedPct, latestSample.rootUsedPct, {
        latestDecimals: 0,
        averageDecimals: 1,
        maxDecimals: 0,
        suffix: '%',
      }),
      buildMetricRow('Node processes', nodeProcesses, latestSample.processCount, {
        latestDecimals: 0,
        averageDecimals: 1,
        maxDecimals: 0,
      }),
      buildMetricRow('PM2 processes', pm2Processes, latestSample.pm2ProcessCount, {
        latestDecimals: 0,
        averageDecimals: 1,
        maxDecimals: 0,
      }),
    ],
  };
}

function buildChart(config) {
  const width = 640;
  const height = 240;
  const padding = { top: 16, right: 16, bottom: 30, left: 52 };
  const innerWidth = width - padding.left - padding.right;
  const innerHeight = height - padding.top - padding.bottom;
  const seriesWithValues = config.series.map((series) => ({
    color: series.color,
    label: series.label,
    values: Array.isArray(series.values) ? series.values.map((value) => Number(value) || 0) : [],
  }));
  const allValues = seriesWithValues.flatMap((series) => series.values);

  let minValue = typeof config.minValue === 'number' ? config.minValue : Math.min(...allValues);
  let maxValue = typeof config.maxValue === 'number' ? config.maxValue : Math.max(...allValues);

  if (!Number.isFinite(minValue)) {
    minValue = 0;
  }
  if (!Number.isFinite(maxValue)) {
    maxValue = 1;
  }

  if (minValue === maxValue) {
    const extra = maxValue === 0 ? 1 : Math.abs(maxValue) * 0.1;
    if (typeof config.minValue !== 'number') {
      minValue -= extra;
    }
    if (typeof config.maxValue !== 'number') {
      maxValue += extra;
    }
  }

  if (config.clampMinZero) {
    minValue = Math.max(0, minValue);
  }
  if (maxValue <= minValue) {
    maxValue = minValue + 1;
  }

  const valueRange = maxValue - minValue;
  const xForIndex = (index, count) => {
    if (count <= 1) {
      return padding.left + (innerWidth / 2);
    }
    return padding.left + ((index / (count - 1)) * innerWidth);
  };
  const yForValue = (value) => {
    const normalized = (value - minValue) / valueRange;
    return padding.top + innerHeight - (normalized * innerHeight);
  };
  const tickCount = 5;
  const axisDecimals = typeof config.axisDecimals === 'number'
    ? config.axisDecimals
    : maxValue <= 10
      ? 1
      : 0;
  const ticks = Array.from({ length: tickCount }, (_, index) => {
    const ratio = index / (tickCount - 1);
    const value = maxValue - (ratio * valueRange);
    return {
      y: yForValue(value),
      label: formatValue(value, axisDecimals, config.unitSuffix || ''),
    };
  });

  return {
    key: config.key,
    title: config.title,
    width,
    height,
    padding,
    startLabel: config.startLabel,
    endLabel: config.endLabel,
    ticks,
    series: seriesWithValues.map((series) => {
      const points = series.values.map((value, index) => ({
        x: xForIndex(index, series.values.length),
        y: yForValue(value),
      }));

      return {
        color: series.color,
        label: series.label,
        polylinePoints: points.map((point) => `${point.x},${point.y}`).join(' '),
        lastPoint: points.length > 0 ? points[points.length - 1] : null,
      };
    }),
  };
}

function buildCharts(samples) {
  if (!Array.isArray(samples) || samples.length === 0) {
    return [];
  }

  const chronological = samples.slice().reverse();
  const startLabel = `${formatTimestampShort(chronological[0].tsIso)} UTC`;
  const endLabel = `${formatTimestampShort(chronological[chronological.length - 1].tsIso)} UTC`;
  const memTotals = chronological.map((sample) => sample.memTotalMb);

  return [
    buildChart({
      key: 'memory',
      title: 'Memory usage (MB)',
      startLabel,
      endLabel,
      clampMinZero: true,
      maxValue: maximum(memTotals),
      axisDecimals: 0,
      unitSuffix: '',
      series: [
        {
          label: 'Used',
          color: '#c0392b',
          values: chronological.map((sample) => sample.memUsedMb),
        },
        {
          label: 'Available',
          color: '#2980b9',
          values: chronological.map((sample) => sample.memAvailableMb),
        },
      ],
    }),
    buildChart({
      key: 'load',
      title: 'Load average',
      startLabel,
      endLabel,
      clampMinZero: true,
      axisDecimals: 2,
      unitSuffix: '',
      series: [
        {
          label: '1m',
          color: '#d9534f',
          values: chronological.map((sample) => sample.load1),
        },
        {
          label: '5m',
          color: '#f0ad4e',
          values: chronological.map((sample) => sample.load5),
        },
        {
          label: '15m',
          color: '#5bc0de',
          values: chronological.map((sample) => sample.load15),
        },
      ],
    }),
    buildChart({
      key: 'disk',
      title: 'Root disk used (%)',
      startLabel,
      endLabel,
      minValue: 0,
      maxValue: 100,
      axisDecimals: 0,
      unitSuffix: '%',
      series: [
        {
          label: 'Root used',
          color: '#8e44ad',
          values: chronological.map((sample) => sample.rootUsedPct),
        },
      ],
    }),
    buildChart({
      key: 'processes',
      title: 'Process counts',
      startLabel,
      endLabel,
      clampMinZero: true,
      axisDecimals: 0,
      unitSuffix: '',
      series: [
        {
          label: 'Node',
          color: '#27ae60',
          values: chronological.map((sample) => sample.processCount),
        },
        {
          label: 'PM2',
          color: '#16a085',
          values: chronological.map((sample) => sample.pm2ProcessCount),
        },
      ],
    }),
  ];
}

function summarizePm2Processes(processes) {
  const summary = {};
  const processList = Array.isArray(processes) ? processes : [];

  processList.forEach((processInfo) => {
    if (!processInfo || typeof processInfo !== 'object' || processInfo.error) {
      return;
    }

    const processName = typeof processInfo.name === 'string' ? processInfo.name.trim() : '';
    if (!processName) {
      return;
    }

    if (!summary[processName]) {
      summary[processName] = {
        memoryMb: 0,
        cpuPct: 0,
        restarts: 0,
        unstableRestarts: 0,
        statusSet: new Set(),
        instances: 0,
      };
    }

    summary[processName].memoryMb += Number(processInfo.memoryMb) || 0;
    summary[processName].cpuPct += Number(processInfo.cpuPct) || 0;
    summary[processName].restarts = Math.max(summary[processName].restarts, Number(processInfo.restarts) || 0);
    summary[processName].unstableRestarts = Math.max(summary[processName].unstableRestarts, Number(processInfo.unstableRestarts) || 0);
    summary[processName].statusSet.add(processInfo.status || 'unknown');
    summary[processName].instances += 1;
  });

  Object.keys(summary).forEach((processName) => {
    summary[processName].status = Array.from(summary[processName].statusSet).sort().join(', ');
    delete summary[processName].statusSet;
  });

  return summary;
}

function buildPm2MemoryCharts(samples) {
  if (!Array.isArray(samples) || samples.length === 0) {
    return [];
  }

  const chronological = samples.slice().reverse();
  const startLabel = `${formatTimestampShort(chronological[0].tsIso)} UTC`;
  const endLabel = `${formatTimestampShort(chronological[chronological.length - 1].tsIso)} UTC`;
  const perSampleSummary = chronological.map((sample) => summarizePm2Processes(sample.pm2Processes));
  const processNames = Array.from(new Set(
    perSampleSummary.flatMap((sampleSummary) => Object.keys(sampleSummary))
  )).sort((left, right) => left.localeCompare(right));

  return processNames.map((processName, index) => {
    const values = perSampleSummary.map((sampleSummary) => {
      return sampleSummary[processName] ? sampleSummary[processName].memoryMb : 0;
    });
    const observedValues = perSampleSummary
      .map((sampleSummary) => (sampleSummary[processName] ? sampleSummary[processName].memoryMb : null))
      .filter((value) => value !== null);
    const observedCpuValues = perSampleSummary
      .map((sampleSummary) => (sampleSummary[processName] ? sampleSummary[processName].cpuPct : null))
      .filter((value) => value !== null);
    const latest = perSampleSummary[perSampleSummary.length - 1][processName] || null;
    const lastObserved = perSampleSummary
      .slice()
      .reverse()
      .map((sampleSummary) => sampleSummary[processName] || null)
      .find((sampleSummary) => sampleSummary !== null) || null;
    const chart = buildChart({
      key: `pm2-memory-${processName}`,
      title: `PM2 memory: ${processName}`,
      startLabel,
      endLabel,
      clampMinZero: true,
      axisDecimals: 0,
      unitSuffix: '',
      series: [
        {
          label: 'Memory MB',
          color: getChartColor(index),
          values,
        },
      ],
    });

    chart.hideLegend = true;
    chart.summaryItems = [
      {
        label: 'Memory',
        text: [
          `Latest ${formatValue(latest ? latest.memoryMb : 0, 0, ' MB')}`,
          `Average ${formatValue(average(observedValues), 1, ' MB')}`,
          `Max ${formatValue(maximum(observedValues), 0, ' MB')}`,
        ].join(' | '),
      },
      {
        label: 'CPU',
        text: [
          `Latest ${formatValue(latest ? latest.cpuPct : 0, 1, '%')}`,
          `Average ${formatValue(average(observedCpuValues), 2, '%')}`,
          `Max ${formatValue(maximum(observedCpuValues), 1, '%')}`,
        ].join(' | '),
      },
      {
        label: 'State',
        text: [
          `Seen ${observedValues.length}/${perSampleSummary.length} samples`,
          `Status ${latest ? latest.status : 'not running'}`,
          `Restarts ${lastObserved ? lastObserved.restarts : 0}`,
          `Unstable ${lastObserved ? lastObserved.unstableRestarts : 0}`,
          `Instances ${lastObserved ? lastObserved.instances : 0}`,
        ].join(' | '),
      },
    ];

    return chart;
  });
}

function mapSampleForView(sample) {
  const plain = sample.get({ plain: true });
  const nodeProcesses = normalizeProcessList(plain.node_processes);
  const pm2Processes = normalizeProcessList(plain.pm2_processes);
  const memTotalMb = Number(plain.mem_total_mb) || 0;
  const memUsedMb = Number(plain.mem_used_mb) || 0;
  const memAvailableMb = Number(plain.mem_available_mb) || 0;
  const swapTotalMb = Number(plain.swap_total_mb) || 0;
  const swapUsedMb = Number(plain.swap_used_mb) || 0;
  const load1 = Number(plain.load1) || 0;
  const load5 = Number(plain.load5) || 0;
  const load15 = Number(plain.load15) || 0;
  const rootUsedPct = Number(plain.root_used_pct) || 0;
  const processCount = Number(plain.process_count) || 0;

  return {
    id: plain.id,
    tsIso: plain.ts ? new Date(plain.ts).toISOString() : '',
    hostname: plain.hostname,
    memTotalMb,
    memUsedMb,
    memAvailableMb,
    memUsedPct: memTotalMb > 0 ? (memUsedMb / memTotalMb) * 100 : 0,
    swapTotalMb,
    swapUsedMb,
    load1,
    load5,
    load15,
    load: [load1, load5, load15].map((value) => Number(value).toFixed(2)).join(' / '),
    rootUsedPct,
    processCount,
    nodeProcessCount: countNodeProcesses(nodeProcesses),
    pm2ProcessCount: countPm2Processes(pm2Processes),
    pm2Processes,
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
    const overview = buildOverview(samples, matchingRows);
    const charts = buildCharts(samples);
    const pm2MemoryCharts = buildPm2MemoryCharts(samples);

    res.render('lennart_host_samples', {
      i18n: res.__,
      error: null,
      hostname,
      hostnames: hostRows.map((row) => row.hostname),
      latestSample: samples.length > 0 ? samples[0] : null,
      limit,
      matchingRows,
      overview,
      charts,
      pm2MemoryCharts,
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
      overview: null,
      charts: [],
      pm2MemoryCharts: [],
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
