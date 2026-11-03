const csv = require('csvtojson');
const { TextDecoder } = require('util');
const { fromRows } = require('../public/javascripts/shipcost-chart');
const MAX_BYTES = 1024 * 1024;
const methods = ['EMS', 'Air parcel', 'Surface parcel', 'SAL parcel', 'Air small packet unregistered', 'SAL small packet unregistered', 'Air small packet registered', 'SAL small packet registered'];
const manualMethods = [...methods, 'DHL', 'Surface mail premium'];
function fail(message, status = 400) { const error = new Error(message); error.status = status; throw error; }
function validateMethod(method, manual = false) {
  if (!(manual ? manualMethods : methods).includes(method)) fail('Choose a supported shipping method.');
}
function integer(value, label, max = 2147483647) {
  const text = String(value).trim();
  if (!/^(?:\d+|\d{1,3}(?:,\d{3})+)$/.test(text)) fail(`${label} must be a positive whole number.`);
  const number = Number(text.replace(/,/g, ''));
  if (!Number.isSafeInteger(number) || number <= 0 || number > max) fail(`${label} is outside the supported range (1–${max}).`);
  return number;
}
function zoneNumber(text) {
  if (/^\d+$/.test(text)) return Number(text);
  const digits = '〇一二三四五六七八九';
  if (text === '十') return 10;
  if (text.length === 1) return digits.indexOf(text);
  const parts = text.split('十');
  if (parts.length === 2) return (parts[0] ? digits.indexOf(parts[0]) : 1) * 10 + (parts[1] ? digits.indexOf(parts[1]) : 0);
  return 0;
}
async function parseCsv(buffer, method) {
  validateMethod(method);
  if (!Buffer.isBuffer(buffer) || !buffer.length) fail('Choose a Japan Post rates CSV file.');
  if (buffer.length > MAX_BYTES) fail('The CSV file must be 1 MB or smaller.', 413);
  let text;
  try { text = new TextDecoder('utf-8', { fatal: true }).decode(buffer); }
  catch (_) { fail('The CSV must use UTF-8 encoding, like the Japan Post export.'); }
  let rows;
  try { rows = await csv({ noheader: true, output: 'csv', trim: false, ignoreEmpty: false, checkType: false }).fromString(text); }
  catch (_) { fail('The CSV could not be read. Check its quoting and row structure.'); }
  const headers = rows.shift() || [];
  if (headers.length < 2 || headers.length > 100 || new Set(headers).size !== headers.length) fail('The CSV contains missing or duplicate column names.');
  if (headers[0] !== '重量') fail('The first column must be 重量 (upper weight limit in grams).');
  const columns = headers.slice(1).map((header, index) => {
    const match = /^(新_)?第([一二三四五六七八九十]+|[0-9]+)地帯_料金(.*)$/.exec(header);
    if (!match) fail(`Unrecognized rate column: ${header}. No data was saved.`);
    const number = zoneNumber(match[2]);
    if (number < 1 || number > 99) fail(`Unsupported zone number: ${header}.`);
    return { index: index + 1, current: Boolean(match[1]), key: `zone${number}`, label: `Zone ${number}${match[3] ? ` ${match[3]}` : ''}` };
  });
  const hasNew = columns.some(column => column.current);
  const selected = columns.filter(column => !hasNew || column.current).sort((a, b) => a.key.localeCompare(b.key, 'en', { numeric: true }));
  if (new Set(selected.map(column => column.key)).size !== selected.length) fail('The selected columns contain ambiguous or duplicate zones. Use a complete current rate chart.');
  if (!rows.length || rows.length > 1000) fail('The CSV must contain 1–1,000 weight rows.');
  const weights = new Set();
  const parsed = rows.map((row, index) => {
    if (row.length !== headers.length) fail(`CSV record ${index + 2} has ${row.length} columns; expected ${headers.length}.`);
    const weight = integer(row[0], `Weight in record ${index + 2}`, method.includes('small packet') ? 2000 : 30000);
    if (weights.has(weight)) fail(`Duplicate weight ${weight} g. Each upper weight limit must appear once.`);
    weights.add(weight);
    return { weight, rates: selected.map(column => integer(row[column.index], `Rate in record ${index + 2}, ${headers[column.index]}`)) };
  }).sort((a, b) => a.weight - b.weight);
  return { chart: { weights: parsed.map(row => row.weight), zones: selected.map(({ key, label }) => ({ key, label })), rates: parsed.map(row => row.rates) },
    sourceHeaders: headers, ignoredColumns: columns.filter(column => hasNew && !column.current).map(column => headers[column.index]) };
}
function manualChart(method, rows) {
  validateMethod(method, true);
  if (!Array.isArray(rows) || !rows.length || rows.length > 10000) fail('Submit a complete rate chart.');
  const seen = new Set();
  const parsed = rows.map(row => {
    if (row.method !== method || typeof row.zone !== 'string' || !/^zone[1-9]\d?$/.test(row.zone)) fail('Invalid method or zone in the chart.');
    const weight = integer(row.uptoweight_g, 'Weight', method.includes('small packet') ? 2000 : 2147483647);
    const key = `${row.zone}:${weight}`;
    if (seen.has(key)) fail('The chart contains duplicate weight/zone cells.');
    seen.add(key);
    return { zone: row.zone, uptoweight_g: weight, cost: integer(row.cost, 'Rate') };
  });
  const chart = fromRows(parsed);
  if (chart.rates.some(row => row.includes(null))) fail('Every weight row must have a rate for every zone.');
  return chart;
}
module.exports = { MAX_BYTES, methods, validateMethod, parseCsv, manualChart, fail };
