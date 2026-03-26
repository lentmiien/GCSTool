// Constants
const AIT_UPDATES_CONTENT_ID = parseInt(process.env.AIT_UPDATES_CONTENT_ID);
const path = require('path');
const fs = require('fs');
const { webcrypto } = require('node:crypto');
if (!globalThis.crypto) globalThis.crypto = webcrypto;
const { ready } = require('zpl-renderer-js');

// Require necessary database models
const { Content, HostSample, Op } = require('../sequelize');
const TMP_DIR = path.join(__dirname, '..', 'public', 'tmp');
let zplRenderer = null;
const DEFAULT_SAMPLE_LIMIT = 50;
const MAX_SAMPLE_LIMIT = 200;
const LONG_TERM_WINDOW_DAYS = 30;
const LONG_TERM_WINDOW_MS = LONG_TERM_WINDOW_DAYS * 24 * 60 * 60 * 1000;
const DEFAULT_PROCESS_CHART_LIMIT = 8;
const MAX_PROCESS_CHART_LIMIT = 20;
const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;
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

function sanitizeProcessChartLimit(input) {
  const parsed = parseInt(input, 10);
  if (Number.isNaN(parsed)) {
    return DEFAULT_PROCESS_CHART_LIMIT;
  }
  return Math.min(Math.max(parsed, 1), MAX_PROCESS_CHART_LIMIT);
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

function numericValues(values) {
  if (!Array.isArray(values)) {
    return [];
  }

  return values
    .map((value) => Number(value))
    .filter((value) => Number.isFinite(value));
}

function average(values) {
  const numbers = numericValues(values);
  if (numbers.length === 0) {
    return 0;
  }

  const total = numbers.reduce((current, value) => current + value, 0);
  return total / numbers.length;
}

function sum(values) {
  const numbers = numericValues(values);
  return numbers.reduce((current, value) => current + value, 0);
}

function maximum(values) {
  const numbers = numericValues(values);
  if (numbers.length === 0) {
    return 0;
  }

  return Math.max(...numbers);
}

function minimum(values) {
  const numbers = numericValues(values);
  if (numbers.length === 0) {
    return 0;
  }

  return Math.min(...numbers);
}

function percentile(values, percentileValue) {
  const numbers = numericValues(values).sort((left, right) => left - right);
  if (numbers.length === 0) {
    return 0;
  }
  if (numbers.length === 1) {
    return numbers[0];
  }

  const position = ((percentileValue || 0) / 100) * (numbers.length - 1);
  const lowerIndex = Math.floor(position);
  const upperIndex = Math.ceil(position);
  if (lowerIndex === upperIndex) {
    return numbers[lowerIndex];
  }

  const lowerValue = numbers[lowerIndex];
  const upperValue = numbers[upperIndex];
  const weight = position - lowerIndex;
  return lowerValue + ((upperValue - lowerValue) * weight);
}

function formatValue(value, decimals, suffix) {
  if (!Number.isFinite(value)) {
    return `0${suffix || ''}`;
  }

  return `${Number(value).toFixed(decimals)}${suffix || ''}`;
}

function formatSignedValue(value, decimals, suffix) {
  if (!Number.isFinite(value) || value === 0) {
    return `0${suffix || ''}`;
  }

  const sign = value > 0 ? '+' : '';
  return `${sign}${Number(value).toFixed(decimals)}${suffix || ''}`;
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
  const perSampleSummary = chronological.map((sample) => sample.pm2Summary || summarizePm2Processes(sample.pm2Processes));
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

function calculateWindowChange(values, windowSize) {
  const numbers = numericValues(values);
  if (numbers.length < 2) {
    return 0;
  }

  const maxWindowSize = Math.floor(numbers.length / 2) || 1;
  const size = Math.max(1, Math.min(windowSize || 7, maxWindowSize));
  return average(numbers.slice(-size)) - average(numbers.slice(0, size));
}

function buildTimeBuckets(samples, bucketMs) {
  const buckets = new Map();

  samples.forEach((sample) => {
    if (!Number.isFinite(sample.tsMs)) {
      return;
    }

    const startMs = Math.floor(sample.tsMs / bucketMs) * bucketMs;
    if (!buckets.has(startMs)) {
      buckets.set(startMs, {
        startMs,
        samples: [],
      });
    }

    buckets.get(startMs).samples.push(sample);
  });

  return Array.from(buckets.values()).sort((left, right) => left.startMs - right.startMs);
}

function buildObservationBuckets(observations, bucketMs) {
  const buckets = new Map();

  observations.forEach((observation) => {
    if (!Number.isFinite(observation.tsMs)) {
      return;
    }

    const startMs = Math.floor(observation.tsMs / bucketMs) * bucketMs;
    if (!buckets.has(startMs)) {
      buckets.set(startMs, {
        startMs,
        observations: [],
      });
    }

    buckets.get(startMs).observations.push(observation);
  });

  return Array.from(buckets.values()).sort((left, right) => left.startMs - right.startMs);
}

function buildBucketChart(config) {
  if (!Array.isArray(config.buckets) || config.buckets.length === 0) {
    return null;
  }

  const firstBucket = config.buckets[0];
  const lastBucket = config.buckets[config.buckets.length - 1];
  const chart = buildChart({
    key: config.key,
    title: config.title,
    startLabel: `${formatTimestampShort(firstBucket.startMs)} UTC`,
    endLabel: `${formatTimestampShort(lastBucket.startMs)} UTC`,
    clampMinZero: config.clampMinZero,
    minValue: config.minValue,
    maxValue: config.maxValue,
    axisDecimals: config.axisDecimals,
    unitSuffix: config.unitSuffix,
    series: config.series.map((series, index) => ({
      label: series.label,
      color: series.color || getChartColor(index),
      values: config.buckets.map((bucket) => series.getValue(bucket)),
    })),
  });

  if (config.summaryText) {
    chart.summaryText = config.summaryText;
  }
  if (config.summaryItems) {
    chart.summaryItems = config.summaryItems;
  }
  if (config.hideLegend) {
    chart.hideLegend = true;
  }

  return chart;
}

function findPeakSample(samples, selector) {
  let peakSample = null;
  let peakValue = -Infinity;

  samples.forEach((sample) => {
    const value = Number(selector(sample));
    if (!Number.isFinite(value)) {
      return;
    }
    if (peakSample === null || value > peakValue) {
      peakSample = sample;
      peakValue = value;
    }
  });

  return peakSample;
}

function findLowestSample(samples, selector) {
  let lowestSample = null;
  let lowestValue = Infinity;

  samples.forEach((sample) => {
    const value = Number(selector(sample));
    if (!Number.isFinite(value)) {
      return;
    }
    if (lowestSample === null || value < lowestValue) {
      lowestSample = sample;
      lowestValue = value;
    }
  });

  return lowestSample;
}

function groupSamplesByHostname(samples) {
  return samples.reduce((summary, sample) => {
    if (!summary[sample.hostname]) {
      summary[sample.hostname] = [];
    }
    summary[sample.hostname].push(sample);
    return summary;
  }, {});
}

function estimateTypicalIntervalMs(samples) {
  if (!Array.isArray(samples) || samples.length < 2) {
    return 0;
  }

  const gaps = [];
  for (let index = 1; index < samples.length; index += 1) {
    const gapMs = samples[index].tsMs - samples[index - 1].tsMs;
    if (gapMs > 0) {
      gaps.push(gapMs);
    }
  }

  return percentile(gaps, 50);
}

function buildCoverageSummary(samples) {
  if (!Array.isArray(samples) || samples.length === 0) {
    return {
      typicalIntervalMs: 0,
      expectedSamples: 0,
      coveragePct: 0,
      largestGapMs: 0,
      gapCount: 0,
      gapThresholdMs: 10 * 60 * 1000,
    };
  }

  if (samples.length === 1) {
    return {
      typicalIntervalMs: 0,
      expectedSamples: 1,
      coveragePct: 100,
      largestGapMs: 0,
      gapCount: 0,
      gapThresholdMs: 10 * 60 * 1000,
    };
  }

  const typicalIntervalMs = estimateTypicalIntervalMs(samples);
  const gapThresholdMs = Math.max((typicalIntervalMs || 0) * 3, 10 * 60 * 1000);
  const windowMs = Math.max(samples[samples.length - 1].tsMs - samples[0].tsMs, 0);
  const expectedSamples = typicalIntervalMs > 0
    ? Math.max(Math.round(windowMs / typicalIntervalMs) + 1, samples.length)
    : samples.length;

  let largestGapMs = 0;
  let gapCount = 0;
  for (let index = 1; index < samples.length; index += 1) {
    const gapMs = samples[index].tsMs - samples[index - 1].tsMs;
    if (gapMs > gapThresholdMs) {
      gapCount += 1;
      largestGapMs = Math.max(largestGapMs, gapMs);
    }
  }

  return {
    typicalIntervalMs,
    expectedSamples,
    coveragePct: expectedSamples > 0 ? Math.min(100, (samples.length / expectedSamples) * 100) : 100,
    largestGapMs,
    gapCount,
    gapThresholdMs,
  };
}

function buildLongTermMetricRow(label, values, latestValue, trendValues, options) {
  const suffix = options && options.suffix ? options.suffix : '';
  const latestDecimals = options && typeof options.latestDecimals === 'number' ? options.latestDecimals : 0;
  const averageDecimals = options && typeof options.averageDecimals === 'number' ? options.averageDecimals : latestDecimals;
  const p95Decimals = options && typeof options.p95Decimals === 'number' ? options.p95Decimals : averageDecimals;
  const maxDecimals = options && typeof options.maxDecimals === 'number' ? options.maxDecimals : latestDecimals;
  const trendDecimals = options && typeof options.trendDecimals === 'number' ? options.trendDecimals : latestDecimals;
  const trendWindowSize = options && typeof options.trendWindowSize === 'number' ? options.trendWindowSize : 7;

  return {
    label,
    latest: formatValue(latestValue, latestDecimals, suffix),
    average: formatValue(average(values), averageDecimals, suffix),
    p95: formatValue(percentile(values, 95), p95Decimals, suffix),
    max: formatValue(maximum(values), maxDecimals, suffix),
    trend: formatSignedValue(calculateWindowChange(trendValues, trendWindowSize), trendDecimals, suffix),
  };
}

function buildHostSummaryRows(samples) {
  const grouped = groupSamplesByHostname(samples);

  return Object.keys(grouped)
    .sort((left, right) => left.localeCompare(right))
    .map((hostname) => {
      const hostSamples = grouped[hostname];
      const latestSample = hostSamples[hostSamples.length - 1];
      const coverage = buildCoverageSummary(hostSamples);

      return {
        hostname,
        sampleCount: hostSamples.length,
        sampleCountText: `${hostSamples.length} rows`,
        latestTsShort: formatTimestampShort(latestSample.tsIso),
        latestMemoryText: `${formatValue(latestSample.memUsedPct, 1, '%')} (${formatValue(latestSample.memUsedMb, 0, ' MB')})`,
        averageMemoryText: `${formatValue(average(hostSamples.map((sample) => sample.memUsedPct)), 1, '%')} (${formatValue(average(hostSamples.map((sample) => sample.memUsedMb)), 0, ' MB')})`,
        peakMemoryText: `${formatValue(maximum(hostSamples.map((sample) => sample.memUsedPct)), 1, '%')} (${formatValue(maximum(hostSamples.map((sample) => sample.memUsedMb)), 0, ' MB')})`,
        lowAvailableText: formatValue(minimum(hostSamples.map((sample) => sample.memAvailableMb)), 0, ' MB'),
        maxSwapText: formatValue(maximum(hostSamples.map((sample) => sample.swapUsedMb)), 0, ' MB'),
        maxLoadText: formatValue(maximum(hostSamples.map((sample) => sample.load1)), 2, ''),
        maxPm2MemoryText: formatValue(maximum(hostSamples.map((sample) => sample.pm2TotalMemoryMb)), 0, ' MB'),
        coverageText: `${formatValue(coverage.coveragePct, 1, '%')} (${hostSamples.length}/${coverage.expectedSamples})`,
        largestGapText: formatDuration(coverage.largestGapMs),
        expectedSamples: coverage.expectedSamples,
        coveragePct: coverage.coveragePct,
        typicalIntervalMs: coverage.typicalIntervalMs,
        largestGapMs: coverage.largestGapMs,
      };
    });
}

function buildMemoryPressureEvents(samples) {
  const grouped = groupSamplesByHostname(samples);
  const events = [];

  Object.keys(grouped).forEach((hostname) => {
    const hostSamples = grouped[hostname];
    if (hostSamples.length === 0) {
      return;
    }

    const coverage = buildCoverageSummary(hostSamples);
    const usedPctThreshold = Math.max(80, percentile(hostSamples.map((sample) => sample.memUsedPct), 90));
    const p10Available = percentile(hostSamples.map((sample) => sample.memAvailableMb), 10);
    const lowAvailableThreshold = p10Available > 0 ? Math.min(4096, p10Available) : 4096;
    const swapThreshold = Math.max(128, percentile(hostSamples.map((sample) => sample.swapUsedMb), 90));
    const eventGapThresholdMs = Math.max(coverage.gapThresholdMs, 15 * 60 * 1000);
    let currentEvent = null;

    function finishCurrentEvent() {
      if (!currentEvent) {
        return;
      }

      currentEvent.durationMs = Math.max(currentEvent.endTsMs - currentEvent.startTsMs, 0);
      currentEvent.durationText = formatDuration(currentEvent.durationMs);
      currentEvent.startTsShort = formatTimestampShort(currentEvent.startTsIso);
      currentEvent.endTsShort = formatTimestampShort(currentEvent.endTsIso);
      currentEvent.peakMemoryText = `${formatValue(currentEvent.peakMemUsedPct, 1, '%')} (${formatValue(currentEvent.peakMemUsedMb, 0, ' MB')})`;
      currentEvent.lowAvailableText = formatValue(currentEvent.minAvailableMb, 0, ' MB');
      currentEvent.maxSwapText = formatValue(currentEvent.maxSwapUsedMb, 0, ' MB');
      currentEvent.peakPm2MemoryText = formatValue(currentEvent.peakPm2TotalMemoryMb, 0, ' MB');
      currentEvent.peakLoadText = formatValue(currentEvent.peakLoad1, 2, '');
      currentEvent.severity = currentEvent.peakMemUsedPct
        + (currentEvent.maxSwapUsedMb / 256)
        + (Math.max(0, 2048 - currentEvent.minAvailableMb) / 128);
      events.push(currentEvent);
      currentEvent = null;
    }

    hostSamples.forEach((sample) => {
      const isPressureSample = sample.memUsedPct >= usedPctThreshold
        || sample.memAvailableMb <= Math.max(lowAvailableThreshold, 1024)
        || (sample.swapUsedMb > 0 && sample.swapUsedMb >= swapThreshold);

      if (!isPressureSample) {
        finishCurrentEvent();
        return;
      }

      if (!currentEvent || sample.tsMs - currentEvent.endTsMs > eventGapThresholdMs) {
        finishCurrentEvent();
        currentEvent = {
          hostname,
          startTsIso: sample.tsIso,
          endTsIso: sample.tsIso,
          startTsMs: sample.tsMs,
          endTsMs: sample.tsMs,
          peakMemUsedPct: sample.memUsedPct,
          peakMemUsedMb: sample.memUsedMb,
          minAvailableMb: sample.memAvailableMb,
          maxSwapUsedMb: sample.swapUsedMb,
          peakPm2TotalMemoryMb: sample.pm2TotalMemoryMb,
          peakLoad1: sample.load1,
          sampleCount: 1,
        };
        return;
      }

      currentEvent.endTsIso = sample.tsIso;
      currentEvent.endTsMs = sample.tsMs;
      currentEvent.sampleCount += 1;
      currentEvent.peakMemUsedPct = Math.max(currentEvent.peakMemUsedPct, sample.memUsedPct);
      currentEvent.peakMemUsedMb = Math.max(currentEvent.peakMemUsedMb, sample.memUsedMb);
      currentEvent.minAvailableMb = Math.min(currentEvent.minAvailableMb, sample.memAvailableMb);
      currentEvent.maxSwapUsedMb = Math.max(currentEvent.maxSwapUsedMb, sample.swapUsedMb);
      currentEvent.peakPm2TotalMemoryMb = Math.max(currentEvent.peakPm2TotalMemoryMb, sample.pm2TotalMemoryMb);
      currentEvent.peakLoad1 = Math.max(currentEvent.peakLoad1, sample.load1);
    });

    finishCurrentEvent();
  });

  return events
    .sort((left, right) => {
      if (right.severity !== left.severity) {
        return right.severity - left.severity;
      }
      return right.endTsMs - left.endTsMs;
    })
    .slice(0, 12);
}

function buildMemoryJumpRows(samples) {
  const grouped = groupSamplesByHostname(samples);
  const jumps = [];

  Object.keys(grouped).forEach((hostname) => {
    const hostSamples = grouped[hostname];

    for (let index = 1; index < hostSamples.length; index += 1) {
      const previous = hostSamples[index - 1];
      const current = hostSamples[index];
      const deltaMemUsedMb = current.memUsedMb - previous.memUsedMb;
      if (deltaMemUsedMb <= 0) {
        continue;
      }

      jumps.push({
        hostname,
        tsIso: current.tsIso,
        tsShort: formatTimestampShort(current.tsIso),
        deltaMemUsedMb,
        deltaMemUsedPct: current.memUsedPct - previous.memUsedPct,
        deltaPm2MemoryMb: current.pm2TotalMemoryMb - previous.pm2TotalMemoryMb,
        deltaSwapUsedMb: current.swapUsedMb - previous.swapUsedMb,
        gapDurationText: formatDuration(current.tsMs - previous.tsMs),
        currentMemoryText: `${formatValue(current.memUsedPct, 1, '%')} (${formatValue(current.memUsedMb, 0, ' MB')})`,
        currentAvailableText: formatValue(current.memAvailableMb, 0, ' MB'),
        currentLoadText: formatValue(current.load1, 2, ''),
      });
    }
  });

  return jumps
    .sort((left, right) => right.deltaMemUsedMb - left.deltaMemUsedMb)
    .slice(0, 10)
    .map((jump) => ({
      ...jump,
      deltaMemUsedText: formatSignedValue(jump.deltaMemUsedMb, 0, ' MB'),
      deltaMemUsedPctText: formatSignedValue(jump.deltaMemUsedPct, 1, '%'),
      deltaPm2MemoryText: formatSignedValue(jump.deltaPm2MemoryMb, 0, ' MB'),
      deltaSwapUsedText: formatSignedValue(jump.deltaSwapUsedMb, 0, ' MB'),
    }));
}

function buildGapRows(samples) {
  const grouped = groupSamplesByHostname(samples);
  const rows = [];

  Object.keys(grouped).forEach((hostname) => {
    const hostSamples = grouped[hostname];
    const coverage = buildCoverageSummary(hostSamples);

    for (let index = 1; index < hostSamples.length; index += 1) {
      const previous = hostSamples[index - 1];
      const current = hostSamples[index];
      const gapMs = current.tsMs - previous.tsMs;
      if (gapMs <= coverage.gapThresholdMs) {
        continue;
      }

      rows.push({
        hostname,
        fromTsShort: formatTimestampShort(previous.tsIso),
        toTsShort: formatTimestampShort(current.tsIso),
        gapMs,
        gapText: formatDuration(gapMs),
        estimatedMissingSamples: coverage.typicalIntervalMs > 0
          ? Math.max(Math.round(gapMs / coverage.typicalIntervalMs) - 1, 1)
          : 0,
        memoryAfterText: `${formatValue(current.memUsedPct, 1, '%')} (${formatValue(current.memUsedMb, 0, ' MB')})`,
        pm2AfterText: formatValue(current.pm2TotalMemoryMb, 0, ' MB'),
        loadAfterText: formatValue(current.load1, 2, ''),
      });
    }
  });

  return rows
    .sort((left, right) => right.gapMs - left.gapMs)
    .slice(0, 10);
}

function buildPm2ProcessAnalytics(samples) {
  const totalSamples = samples.length;
  const summary = {};

  samples.forEach((sample) => {
    const processSummary = sample.pm2Summary || summarizePm2Processes(sample.pm2Processes);
    sample.pm2Summary = processSummary;

    Object.keys(processSummary).forEach((processName) => {
      const processInfo = processSummary[processName];
      if (!summary[processName]) {
        summary[processName] = {
          name: processName,
          memoryValues: [],
          cpuValues: [],
          observations: [],
          hosts: new Set(),
          presenceCount: 0,
          maxInstances: 0,
          restartDelta: 0,
          unstableRestartDelta: 0,
          previousRestartsByHost: {},
          previousUnstableRestartsByHost: {},
          latest: null,
          statusSet: new Set(),
        };
      }

      const target = summary[processName];
      target.memoryValues.push(processInfo.memoryMb);
      target.cpuValues.push(processInfo.cpuPct);
      target.observations.push({
        tsMs: sample.tsMs,
        tsIso: sample.tsIso,
        hostname: sample.hostname,
        memoryMb: processInfo.memoryMb,
        cpuPct: processInfo.cpuPct,
        restarts: processInfo.restarts,
        unstableRestarts: processInfo.unstableRestarts,
        status: processInfo.status,
        instances: processInfo.instances,
      });
      target.hosts.add(sample.hostname);
      target.presenceCount += 1;
      target.maxInstances = Math.max(target.maxInstances, processInfo.instances);
      target.statusSet.add(processInfo.status || 'unknown');
      target.latest = {
        tsIso: sample.tsIso,
        memoryMb: processInfo.memoryMb,
        cpuPct: processInfo.cpuPct,
        status: processInfo.status || 'unknown',
        instances: processInfo.instances,
      };

      const previousRestarts = target.previousRestartsByHost[sample.hostname];
      const previousUnstableRestarts = target.previousUnstableRestartsByHost[sample.hostname];

      if (typeof previousRestarts === 'number' && processInfo.restarts > previousRestarts) {
        target.restartDelta += processInfo.restarts - previousRestarts;
      }
      if (typeof previousUnstableRestarts === 'number' && processInfo.unstableRestarts > previousUnstableRestarts) {
        target.unstableRestartDelta += processInfo.unstableRestarts - previousUnstableRestarts;
      }

      target.previousRestartsByHost[sample.hostname] = processInfo.restarts;
      target.previousUnstableRestartsByHost[sample.hostname] = processInfo.unstableRestarts;
    });
  });

  return Object.values(summary)
    .map((processInfo) => {
      const dailyBuckets = buildObservationBuckets(processInfo.observations, DAY_MS);
      const dailyAverageMemory = dailyBuckets.map((bucket) => average(bucket.observations.map((observation) => observation.memoryMb)));
      const lateVsEarlyMb = calculateWindowChange(dailyAverageMemory, 7);
      const coveragePct = totalSamples > 0 ? (processInfo.presenceCount / totalSamples) * 100 : 0;
      const hostsText = Array.from(processInfo.hosts).sort((left, right) => left.localeCompare(right)).join(', ');
      const latestStatus = processInfo.latest ? processInfo.latest.status : 'unknown';
      const riskScore = percentile(processInfo.memoryValues, 95)
        + Math.max(0, lateVsEarlyMb)
        + (processInfo.restartDelta * 128)
        + (processInfo.unstableRestartDelta * 256);

      return {
        name: processInfo.name,
        hostsText,
        hostCount: processInfo.hosts.size,
        presenceCount: processInfo.presenceCount,
        coveragePct,
        coverageText: `${processInfo.presenceCount}/${totalSamples} (${formatValue(coveragePct, 1, '%')})`,
        latestTsShort: processInfo.latest ? formatTimestampShort(processInfo.latest.tsIso) : '',
        latestMemoryMb: processInfo.latest ? processInfo.latest.memoryMb : 0,
        latestMemoryText: formatValue(processInfo.latest ? processInfo.latest.memoryMb : 0, 0, ' MB'),
        averageMemoryMb: average(processInfo.memoryValues),
        averageMemoryText: formatValue(average(processInfo.memoryValues), 1, ' MB'),
        p95MemoryMb: percentile(processInfo.memoryValues, 95),
        p95MemoryText: formatValue(percentile(processInfo.memoryValues, 95), 0, ' MB'),
        maxMemoryMb: maximum(processInfo.memoryValues),
        maxMemoryText: formatValue(maximum(processInfo.memoryValues), 0, ' MB'),
        lateVsEarlyMb,
        lateVsEarlyText: formatSignedValue(lateVsEarlyMb, 0, ' MB'),
        averageCpuPct: average(processInfo.cpuValues),
        averageCpuText: formatValue(average(processInfo.cpuValues), 2, '%'),
        maxCpuPct: maximum(processInfo.cpuValues),
        maxCpuText: formatValue(maximum(processInfo.cpuValues), 1, '%'),
        restartDelta: processInfo.restartDelta,
        unstableRestartDelta: processInfo.unstableRestartDelta,
        restartText: `${processInfo.restartDelta} / ${processInfo.unstableRestartDelta}`,
        latestStatus,
        latestInstances: processInfo.latest ? processInfo.latest.instances : 0,
        latestStateText: `${latestStatus} (${processInfo.latest ? processInfo.latest.instances : 0} inst)`,
        riskScore,
        dailyBuckets,
      };
    })
    .sort((left, right) => {
      if (right.riskScore !== left.riskScore) {
        return right.riskScore - left.riskScore;
      }
      return right.maxMemoryMb - left.maxMemoryMb;
    });
}

function buildPm2ProcessCharts(processRows, processLimit) {
  return processRows
    .slice(0, processLimit)
    .map((processRow, index) => {
      const chart = buildBucketChart({
        key: `pm2-trend-${processRow.name}`,
        title: `PM2 process: ${processRow.name}`,
        buckets: processRow.dailyBuckets,
        clampMinZero: true,
        axisDecimals: 0,
        series: [
          {
            label: 'Daily avg',
            color: getChartColor(index),
            getValue: (bucket) => average(bucket.observations.map((observation) => observation.memoryMb)),
          },
          {
            label: 'Daily peak',
            color: '#2c3e50',
            getValue: (bucket) => maximum(bucket.observations.map((observation) => observation.memoryMb)),
          },
        ],
        summaryItems: [
          {
            label: 'Memory',
            text: [
              `Latest ${processRow.latestMemoryText}`,
              `Average ${processRow.averageMemoryText}`,
              `P95 ${processRow.p95MemoryText}`,
              `Max ${processRow.maxMemoryText}`,
            ].join(' | '),
          },
          {
            label: 'Trend',
            text: [
              `Late vs early ${processRow.lateVsEarlyText}`,
              `Seen ${processRow.coverageText}`,
              `Hosts ${processRow.hostsText || '-'}`,
            ].join(' | '),
          },
          {
            label: 'CPU',
            text: [
              `Average ${processRow.averageCpuText}`,
              `Max ${processRow.maxCpuText}`,
            ].join(' | '),
          },
          {
            label: 'Stability',
            text: [
              `Restarts ${processRow.restartDelta}`,
              `Unstable ${processRow.unstableRestartDelta}`,
              `State ${processRow.latestStateText}`,
            ].join(' | '),
          },
        ],
      });

      return chart;
    })
    .filter(Boolean);
}

function buildLongTermCharts(samples, hourlyBuckets, dailyBuckets) {
  if (!Array.isArray(samples) || samples.length === 0) {
    return [];
  }

  return [
    buildBucketChart({
      key: 'memory-pressure-hourly',
      title: 'Memory pressure by hour (%)',
      buckets: hourlyBuckets,
      minValue: 0,
      maxValue: 100,
      axisDecimals: 1,
      unitSuffix: '%',
      series: [
        {
          label: 'Hourly avg',
          color: '#c0392b',
          getValue: (bucket) => average(bucket.samples.map((sample) => sample.memUsedPct)),
        },
        {
          label: 'Hourly p95',
          color: '#d35400',
          getValue: (bucket) => percentile(bucket.samples.map((sample) => sample.memUsedPct), 95),
        },
        {
          label: 'Hourly peak',
          color: '#8e44ad',
          getValue: (bucket) => maximum(bucket.samples.map((sample) => sample.memUsedPct)),
        },
      ],
      summaryText: 'Sustained high hourly averages and p95 values point to persistent memory pressure rather than one-off spikes.',
    }),
    buildBucketChart({
      key: 'memory-capacity-daily',
      title: 'Daily memory capacity (MB)',
      buckets: dailyBuckets,
      clampMinZero: true,
      axisDecimals: 0,
      series: [
        {
          label: 'Daily avg used',
          color: '#c0392b',
          getValue: (bucket) => average(bucket.samples.map((sample) => sample.memUsedMb)),
        },
        {
          label: 'Daily peak used',
          color: '#d35400',
          getValue: (bucket) => maximum(bucket.samples.map((sample) => sample.memUsedMb)),
        },
        {
          label: 'Lowest available',
          color: '#2980b9',
          getValue: (bucket) => minimum(bucket.samples.map((sample) => sample.memAvailableMb)),
        },
      ],
      summaryText: 'Rising used memory combined with falling minimum available memory is the main leak pattern to watch.',
    }),
    buildBucketChart({
      key: 'pm2-vs-system-memory',
      title: 'Daily PM2 memory vs host memory (MB)',
      buckets: dailyBuckets,
      clampMinZero: true,
      axisDecimals: 0,
      series: [
        {
          label: 'PM2 avg',
          color: '#16a085',
          getValue: (bucket) => average(bucket.samples.map((sample) => sample.pm2TotalMemoryMb)),
        },
        {
          label: 'PM2 p95',
          color: '#27ae60',
          getValue: (bucket) => percentile(bucket.samples.map((sample) => sample.pm2TotalMemoryMb), 95),
        },
        {
          label: 'Host avg used',
          color: '#2c3e50',
          getValue: (bucket) => average(bucket.samples.map((sample) => sample.memUsedMb)),
        },
      ],
      summaryText: 'This shows how much of the host memory footprint is accounted for by PM2-managed processes.',
    }),
    buildBucketChart({
      key: 'swap-daily',
      title: 'Daily swap usage (MB)',
      buckets: dailyBuckets,
      clampMinZero: true,
      axisDecimals: 0,
      series: [
        {
          label: 'Daily avg',
          color: '#8e44ad',
          getValue: (bucket) => average(bucket.samples.map((sample) => sample.swapUsedMb)),
        },
        {
          label: 'Daily peak',
          color: '#5b2c6f',
          getValue: (bucket) => maximum(bucket.samples.map((sample) => sample.swapUsedMb)),
        },
      ],
      summaryText: 'Swap use is a strong sign that RAM pressure is crossing into a stability risk.',
    }),
    buildBucketChart({
      key: 'load-daily',
      title: 'Daily load average',
      buckets: dailyBuckets,
      clampMinZero: true,
      axisDecimals: 2,
      series: [
        {
          label: 'Daily avg 1m',
          color: '#e67e22',
          getValue: (bucket) => average(bucket.samples.map((sample) => sample.load1)),
        },
        {
          label: 'Daily p95 1m',
          color: '#f39c12',
          getValue: (bucket) => percentile(bucket.samples.map((sample) => sample.load1), 95),
        },
        {
          label: 'Daily peak 1m',
          color: '#c0392b',
          getValue: (bucket) => maximum(bucket.samples.map((sample) => sample.load1)),
        },
      ],
      summaryText: 'Higher load during the same window as memory pressure can help explain crash or slowdown timing.',
    }),
    buildBucketChart({
      key: 'process-counts-daily',
      title: 'Daily process counts',
      buckets: dailyBuckets,
      clampMinZero: true,
      axisDecimals: 0,
      series: [
        {
          label: 'Node avg',
          color: '#27ae60',
          getValue: (bucket) => average(bucket.samples.map((sample) => sample.processCount)),
        },
        {
          label: 'PM2 avg',
          color: '#16a085',
          getValue: (bucket) => average(bucket.samples.map((sample) => sample.pm2ProcessCount)),
        },
      ],
      summaryText: 'Unexpected count changes can line up with restarts, scaling changes, or processes disappearing.',
    }),
    buildBucketChart({
      key: 'disk-daily',
      title: 'Daily root disk usage (%)',
      buckets: dailyBuckets,
      minValue: 0,
      maxValue: 100,
      axisDecimals: 0,
      unitSuffix: '%',
      series: [
        {
          label: 'Daily avg',
          color: '#6c3483',
          getValue: (bucket) => average(bucket.samples.map((sample) => sample.rootUsedPct)),
        },
        {
          label: 'Daily peak',
          color: '#8e44ad',
          getValue: (bucket) => maximum(bucket.samples.map((sample) => sample.rootUsedPct)),
        },
      ],
      summaryText: 'Disk trends are secondary here, but spikes still matter for diagnosing general host stress.',
    }),
    buildBucketChart({
      key: 'sample-count-daily',
      title: 'Daily sample count',
      buckets: dailyBuckets,
      clampMinZero: true,
      axisDecimals: 0,
      series: [
        {
          label: 'Samples',
          color: '#2980b9',
          getValue: (bucket) => bucket.samples.length,
        },
      ],
      summaryText: 'Sharp drops in collected samples usually mean downtime, collection failures, or long host gaps.',
      hideLegend: true,
    }),
  ].filter(Boolean);
}

function buildLongTermInsights(summary) {
  const insights = [];

  if (Math.abs(summary.memoryTrendMb) >= 256 || Math.abs(summary.memoryTrendPct) >= 2) {
    insights.push(
      `Average daily used memory moved ${formatSignedValue(summary.memoryTrendMb, 0, ' MB')} (${formatSignedValue(summary.memoryTrendPct, 1, '%')}) between the first and last 7-day windows.`
    );
  }

  if (summary.mostSevereEvent) {
    insights.push(
      `The most severe memory-pressure event peaked at ${formatValue(summary.mostSevereEvent.peakMemUsedPct, 1, '%')} with only ${formatValue(summary.mostSevereEvent.minAvailableMb, 0, ' MB')} available on ${summary.mostSevereEvent.hostname}.`
    );
  }

  if (summary.maxSwapUsedMb > 0) {
    insights.push(
      `Swap was used on ${summary.swapSampleCount} samples across ${summary.swapDays} day buckets, peaking at ${formatValue(summary.maxSwapUsedMb, 0, ' MB')}.`
    );
  }

  if (summary.heaviestProcess) {
    insights.push(
      `${summary.heaviestProcess.name} is the heaviest PM2 process in this window, peaking at ${summary.heaviestProcess.maxMemoryText} and shifting ${summary.heaviestProcess.lateVsEarlyText} between the early and late period.`
    );
  }

  if (summary.restartLeader && (summary.restartLeader.restartDelta > 0 || summary.restartLeader.unstableRestartDelta > 0)) {
    insights.push(
      `Observed PM2 restart counter increases total ${summary.totalRestarts}/${summary.totalUnstableRestarts}, led by ${summary.restartLeader.name} (${summary.restartLeader.restartDelta}/${summary.restartLeader.unstableRestartDelta}).`
    );
  }

  if (summary.largestGapRow) {
    insights.push(
      `The longest collection gap was ${summary.largestGapRow.gapText} ending at ${summary.largestGapRow.toTsShort} UTC on ${summary.largestGapRow.hostname}.`
    );
  }

  return insights.slice(0, 5);
}

function buildLongTermOverview(samples, dailyBuckets, hostSummaries, memoryEvents, gapRows, processRows) {
  if (!Array.isArray(samples) || samples.length === 0) {
    return null;
  }

  const latestSample = samples[samples.length - 1];
  const oldestSample = samples[0];
  const peakMemorySample = findPeakSample(samples, (sample) => sample.memUsedPct);
  const lowestAvailableSample = findLowestSample(samples, (sample) => sample.memAvailableMb);
  const peakSwapSample = findPeakSample(samples, (sample) => sample.swapUsedMb);
  const expectedSamples = sum(hostSummaries.map((row) => row.expectedSamples));
  const actualSamples = sum(hostSummaries.map((row) => row.sampleCount));
  const coveragePct = expectedSamples > 0 ? Math.min(100, (actualSamples / expectedSamples) * 100) : 100;
  const typicalIntervals = hostSummaries
    .map((row) => row.typicalIntervalMs)
    .filter((value) => value > 0);
  const dailyWindowSize = Math.min(7, Math.max(1, Math.floor(dailyBuckets.length / 2) || 1));
  const memoryTrendMb = calculateWindowChange(
    dailyBuckets.map((bucket) => average(bucket.samples.map((sample) => sample.memUsedMb))),
    dailyWindowSize
  );
  const memoryTrendPct = calculateWindowChange(
    dailyBuckets.map((bucket) => average(bucket.samples.map((sample) => sample.memUsedPct))),
    dailyWindowSize
  );
  const pm2TrendMb = calculateWindowChange(
    dailyBuckets.map((bucket) => average(bucket.samples.map((sample) => sample.pm2TotalMemoryMb))),
    dailyWindowSize
  );
  const pm2ShareValues = samples.map((sample) => sample.pm2SharePct);
  const swapSampleCount = samples.filter((sample) => sample.swapUsedMb > 0).length;
  const swapDays = dailyBuckets.filter((bucket) => maximum(bucket.samples.map((sample) => sample.swapUsedMb)) > 0).length;
  const totalRestarts = sum(processRows.map((row) => row.restartDelta));
  const totalUnstableRestarts = sum(processRows.map((row) => row.unstableRestartDelta));
  const restartLeader = processRows
    .filter((row) => row.restartDelta > 0 || row.unstableRestartDelta > 0)
    .sort((left, right) => (right.restartDelta + right.unstableRestartDelta) - (left.restartDelta + left.unstableRestartDelta))[0] || null;
  const largestGapMs = maximum(hostSummaries.map((row) => row.largestGapMs));
  const maxSwapUsedMb = maximum(samples.map((sample) => sample.swapUsedMb));
  const summary = {
    memoryTrendMb,
    memoryTrendPct,
    pm2TrendMb,
    maxSwapUsedMb,
    swapSampleCount,
    swapDays,
    mostSevereEvent: memoryEvents.length > 0 ? memoryEvents[0] : null,
    heaviestProcess: processRows.length > 0 ? processRows[0] : null,
    totalRestarts,
    totalUnstableRestarts,
    restartLeader,
    largestGapRow: gapRows.length > 0 ? gapRows[0] : null,
  };

  return {
    latestTsShort: formatTimestampShort(latestSample.tsIso),
    oldestTsShort: formatTimestampShort(oldestSample.tsIso),
    windowDurationText: formatDuration(latestSample.tsMs - oldestSample.tsMs),
    matchingRows: samples.length,
    hostCount: hostSummaries.length,
    latestHost: latestSample.hostname,
    coverageText: expectedSamples > 0
      ? `${formatValue(coveragePct, 1, '%')} (${actualSamples}/${expectedSamples} expected rows)`
      : 'n/a',
    cadenceText: typicalIntervals.length > 0 ? formatDuration(average(typicalIntervals)) : 'unknown',
    cards: [
      {
        label: 'Latest memory',
        value: `${formatValue(latestSample.memUsedPct, 1, '%')} / ${formatValue(latestSample.memUsedMb, 0, ' MB')}`,
        detail: `${formatValue(latestSample.memAvailableMb, 0, ' MB')} available on ${latestSample.hostname} at ${formatTimestampShort(latestSample.tsIso)} UTC.`,
      },
      {
        label: '30-day memory ceiling',
        value: peakMemorySample ? formatValue(peakMemorySample.memUsedPct, 1, '%') : '0%',
        detail: peakMemorySample
          ? `${formatValue(peakMemorySample.memUsedMb, 0, ' MB')} used on ${peakMemorySample.hostname} at ${formatTimestampShort(peakMemorySample.tsIso)} UTC.`
          : 'No samples.',
      },
      {
        label: 'Lowest headroom',
        value: lowestAvailableSample ? formatValue(lowestAvailableSample.memAvailableMb, 0, ' MB') : '0 MB',
        detail: lowestAvailableSample
          ? `At that point memory used was ${formatValue(lowestAvailableSample.memUsedPct, 1, '%')} on ${lowestAvailableSample.hostname}.`
          : 'No samples.',
      },
      {
        label: 'Memory trend',
        value: formatSignedValue(memoryTrendMb, 0, ' MB'),
        detail: `Average daily memory changed ${formatSignedValue(memoryTrendPct, 1, '%')} between the first and last 7-day windows.`,
      },
      {
        label: 'PM2 share of used memory',
        value: formatValue(average(pm2ShareValues), 1, '%'),
        detail: `Latest PM2 total is ${formatValue(latestSample.pm2TotalMemoryMb, 0, ' MB')} (${formatSignedValue(pm2TrendMb, 0, ' MB')} over the same 7-day comparison).`,
      },
      {
        label: 'Swap activity',
        value: formatValue(maxSwapUsedMb, 0, ' MB'),
        detail: peakSwapSample && peakSwapSample.swapUsedMb > 0
          ? `Seen on ${swapSampleCount} rows across ${swapDays} day buckets, peaking at ${formatTimestampShort(peakSwapSample.tsIso)} UTC.`
          : 'No swap use recorded in the selected window.',
      },
      {
        label: 'Observed PM2 restarts',
        value: `${totalRestarts} / ${totalUnstableRestarts}`,
        detail: 'Shown as restart / unstable-restart counter increases observed in PM2 data.',
      },
      {
        label: 'Largest collection gap',
        value: formatDuration(largestGapMs),
        detail: `Coverage is ${expectedSamples > 0 ? `${formatValue(coveragePct, 1, '%')} overall` : 'not available'} with a typical cadence around ${typicalIntervals.length > 0 ? formatDuration(average(typicalIntervals)) : 'unknown'}.`,
      },
    ],
    metrics: [
      buildLongTermMetricRow(
        'Memory used (MB)',
        samples.map((sample) => sample.memUsedMb),
        latestSample.memUsedMb,
        dailyBuckets.map((bucket) => average(bucket.samples.map((sample) => sample.memUsedMb))),
        { latestDecimals: 0, averageDecimals: 1, p95Decimals: 0, maxDecimals: 0, trendDecimals: 0, suffix: ' MB' }
      ),
      buildLongTermMetricRow(
        'Memory used (%)',
        samples.map((sample) => sample.memUsedPct),
        latestSample.memUsedPct,
        dailyBuckets.map((bucket) => average(bucket.samples.map((sample) => sample.memUsedPct))),
        { latestDecimals: 1, averageDecimals: 1, p95Decimals: 1, maxDecimals: 1, trendDecimals: 1, suffix: '%' }
      ),
      buildLongTermMetricRow(
        'Available memory (MB)',
        samples.map((sample) => sample.memAvailableMb),
        latestSample.memAvailableMb,
        dailyBuckets.map((bucket) => average(bucket.samples.map((sample) => sample.memAvailableMb))),
        { latestDecimals: 0, averageDecimals: 1, p95Decimals: 0, maxDecimals: 0, trendDecimals: 0, suffix: ' MB' }
      ),
      buildLongTermMetricRow(
        'PM2 memory total (MB)',
        samples.map((sample) => sample.pm2TotalMemoryMb),
        latestSample.pm2TotalMemoryMb,
        dailyBuckets.map((bucket) => average(bucket.samples.map((sample) => sample.pm2TotalMemoryMb))),
        { latestDecimals: 0, averageDecimals: 1, p95Decimals: 0, maxDecimals: 0, trendDecimals: 0, suffix: ' MB' }
      ),
      buildLongTermMetricRow(
        'PM2 share of used memory (%)',
        pm2ShareValues,
        latestSample.pm2SharePct,
        dailyBuckets.map((bucket) => average(bucket.samples.map((sample) => sample.pm2SharePct))),
        { latestDecimals: 1, averageDecimals: 1, p95Decimals: 1, maxDecimals: 1, trendDecimals: 1, suffix: '%' }
      ),
      buildLongTermMetricRow(
        'Swap used (MB)',
        samples.map((sample) => sample.swapUsedMb),
        latestSample.swapUsedMb,
        dailyBuckets.map((bucket) => average(bucket.samples.map((sample) => sample.swapUsedMb))),
        { latestDecimals: 0, averageDecimals: 1, p95Decimals: 0, maxDecimals: 0, trendDecimals: 0, suffix: ' MB' }
      ),
      buildLongTermMetricRow(
        'Load 1m',
        samples.map((sample) => sample.load1),
        latestSample.load1,
        dailyBuckets.map((bucket) => average(bucket.samples.map((sample) => sample.load1))),
        { latestDecimals: 2, averageDecimals: 2, p95Decimals: 2, maxDecimals: 2, trendDecimals: 2 }
      ),
      buildLongTermMetricRow(
        'Root disk (%)',
        samples.map((sample) => sample.rootUsedPct),
        latestSample.rootUsedPct,
        dailyBuckets.map((bucket) => average(bucket.samples.map((sample) => sample.rootUsedPct))),
        { latestDecimals: 0, averageDecimals: 1, p95Decimals: 1, maxDecimals: 0, trendDecimals: 1, suffix: '%' }
      ),
      buildLongTermMetricRow(
        'Node processes',
        samples.map((sample) => sample.processCount),
        latestSample.processCount,
        dailyBuckets.map((bucket) => average(bucket.samples.map((sample) => sample.processCount))),
        { latestDecimals: 0, averageDecimals: 1, p95Decimals: 0, maxDecimals: 0, trendDecimals: 1 }
      ),
      buildLongTermMetricRow(
        'PM2 processes',
        samples.map((sample) => sample.pm2ProcessCount),
        latestSample.pm2ProcessCount,
        dailyBuckets.map((bucket) => average(bucket.samples.map((sample) => sample.pm2ProcessCount))),
        { latestDecimals: 0, averageDecimals: 1, p95Decimals: 0, maxDecimals: 0, trendDecimals: 1 }
      ),
    ],
    insights: buildLongTermInsights(summary),
  };
}

function mapSampleForView(sample) {
  const plain = typeof sample.get === 'function' ? sample.get({ plain: true }) : sample;
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
  const pm2TotalMemoryMb = sum(pm2Processes.map((processInfo) => processInfo && processInfo.memoryMb));
  const pm2TotalCpuPct = sum(pm2Processes.map((processInfo) => processInfo && processInfo.cpuPct));
  const nodeTotalRssMb = sum(nodeProcesses.map((processInfo) => processInfo && processInfo.rssMb));
  const tsMs = plain.ts ? new Date(plain.ts).getTime() : 0;

  return {
    id: plain.id,
    tsIso: plain.ts ? new Date(plain.ts).toISOString() : '',
    tsMs,
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
    nodeProcesses,
    nodeProcessCount: countNodeProcesses(nodeProcesses),
    nodeTotalRssMb,
    pm2ProcessCount: countPm2Processes(pm2Processes),
    pm2TotalMemoryMb,
    pm2TotalCpuPct,
    pm2SharePct: memUsedMb > 0 ? (pm2TotalMemoryMb / memUsedMb) * 100 : 0,
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

exports.hostTrends = async (req, res) => {
  const hostname = typeof req.query.hostname === 'string' ? req.query.hostname.trim() : '';
  const processLimit = sanitizeProcessChartLimit(req.query.processLimit);
  const since = new Date(Date.now() - LONG_TERM_WINDOW_MS);
  const where = {
    ts: {
      [Op.gte]: since,
    },
  };

  if (hostname) {
    where.hostname = hostname;
  }

  try {
    const [hostRows, sampleRows] = await Promise.all([
      HostSample.findAll({
        attributes: ['hostname'],
        group: ['hostname'],
        order: [['hostname', 'ASC']],
        raw: true,
      }),
      HostSample.findAll({
        attributes: [
          'id',
          'ts',
          'hostname',
          'mem_total_mb',
          'mem_used_mb',
          'mem_available_mb',
          'swap_total_mb',
          'swap_used_mb',
          'load1',
          'load5',
          'load15',
          'root_used_pct',
          'process_count',
          'pm2_processes',
        ],
        where,
        order: [
          ['ts', 'ASC'],
          ['id', 'ASC'],
        ],
        raw: true,
      }),
    ]);

    const samples = sampleRows.map(mapSampleForView);
    samples.forEach((sample) => {
      sample.pm2Summary = summarizePm2Processes(sample.pm2Processes);
    });

    const hourlyBuckets = buildTimeBuckets(samples, HOUR_MS);
    const dailyBuckets = buildTimeBuckets(samples, DAY_MS);
    const hostSummaries = buildHostSummaryRows(samples);
    const memoryEvents = buildMemoryPressureEvents(samples);
    const memoryJumps = buildMemoryJumpRows(samples);
    const gapRows = buildGapRows(samples);
    const processRows = buildPm2ProcessAnalytics(samples);
    const processCharts = buildPm2ProcessCharts(processRows, processLimit);
    const charts = buildLongTermCharts(samples, hourlyBuckets, dailyBuckets);
    const overview = buildLongTermOverview(samples, dailyBuckets, hostSummaries, memoryEvents, gapRows, processRows);
    const hostnames = hostRows.map((row) => row.hostname);

    let scopeNote = `Showing the last ${LONG_TERM_WINDOW_DAYS} days for all matching samples.`;
    if (hostname) {
      scopeNote = `Showing the last ${LONG_TERM_WINDOW_DAYS} days for host ${hostname}.`;
    } else if (hostnames.length > 1) {
      scopeNote = 'No hostname filter is selected. Charts combine sample-level trends from multiple hosts, so totals are not summed cluster totals.';
    } else if (hostnames.length === 1) {
      scopeNote = `Only one host is stored, so the dashboard covers ${hostnames[0]}.`;
    }

    res.render('lennart_host_trends', {
      i18n: res.__,
      error: null,
      hostname,
      hostnames,
      latestSample: samples.length > 0 ? samples[samples.length - 1] : null,
      processLimit,
      windowDays: LONG_TERM_WINDOW_DAYS,
      scopeNote,
      overview,
      charts,
      hostSummaries,
      memoryEvents,
      memoryJumps,
      gapRows,
      processRows,
      processCharts,
    });
  } catch (error) {
    console.error('Failed to load host trends:', error);
    res.status(500).render('lennart_host_trends', {
      i18n: res.__,
      error: 'Failed to load host trends.',
      hostname,
      hostnames: [],
      latestSample: null,
      processLimit,
      windowDays: LONG_TERM_WINDOW_DAYS,
      scopeNote: '',
      overview: null,
      charts: [],
      hostSummaries: [],
      memoryEvents: [],
      memoryJumps: [],
      gapRows: [],
      processRows: [],
      processCharts: [],
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
