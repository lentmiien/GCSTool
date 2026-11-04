const csv = require('csvtojson');
const { TextDecoder, isDeepStrictEqual } = require('util');
const { fail } = require('./japanPostCsv');

const sources = ['website', 'internal', 'mappings', 'exceptions'];
const methods = [
  { key: 'DHL', label: 'DHL', source: 'internal' },
  { key: 'AIT', label: 'AIT / Surface Mail Premium', source: 'internal' },
  { key: 'ECMS', label: 'ECMS', source: 'internal' },
  { key: 'ems', label: 'EMS', flags: ['EMS取扱フラグ'] },
  { key: 'airParcel', label: 'Air parcel', flags: ['国際小包（航空便）取扱フラグ'] },
  { key: 'surfaceParcel', label: 'Surface parcel', flags: ['国際小包（船便）取扱フラグ'] },
  { key: 'salParcel', label: 'SAL parcel', flags: ['SAL小包取扱フラグ'] },
  { key: 'airSmallPacket', label: 'Air small packet · registered', flags: ['小形包装物(航空便)取扱フラグ', '小形包装物（書留）（航空便）取扱フラグ'] },
  { key: 'airSmallPacketUnregistered', label: 'Air small packet · unregistered', flags: ['小形包装物(航空便)取扱フラグ'] },
  { key: 'salSmallPacket', label: 'SAL small packet · registered', flags: ['小形包装物(SAL)取扱フラグ', 'SAL書留フラグ'] },
  { key: 'salSmallPacketUnregistered', label: 'SAL small packet · unregistered', flags: ['小形包装物(SAL)取扱フラグ'] },
  { key: 'surfaceSmallPacket', label: 'Surface small packet', flags: ['小形包装物(船便)取扱フラグ'] },
  { key: 'ePacket', label: 'International ePacket', flags: ['国際eパケット取扱フラグ'] },
];
const label = value => value === true ? 'Available' : value === false ? 'Unavailable' : 'Unknown';
const flag = value => value === '1' || value === 1 || value === true ? true : value === '0' || value === 0 || value === false ? false : null;
function string(value, name, max = 255, optional = false) {
  if (typeof value !== 'string' || value.length > max || (!optional && !value.trim()) || /[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]/.test(value)) fail(`Enter a valid ${name} (up to ${max} characters).`);
  return value.trim();
}
function code(value) {
  const result = string(value, 'internal country code', 100);
  if (!/^[A-Za-z0-9_.-]+$/.test(result)) fail('Internal country codes may contain letters, numbers, underscores, periods and hyphens.');
  return result;
}
function availability(value) {
  if (!['1', '0', '', 'unknown'].includes(value)) fail('Availability must be 1 (available), 0 (unavailable), or blank (unknown).');
  return flag(value);
}
function normalize(source, input) {
  if (!sources.includes(source)) fail('Unknown data source.');
  const countryCode = code(input.countryCode);
  if (source === 'website') return { countryCode, countryName: string(input.countryName, 'country name') };
  if (source === 'internal') return { countryCode, countryName: string(input.countryName, 'country name'), countryNameJ: string(input.countryNameJ || '', 'Japanese name', 255, true),
    DHL: availability(input.DHL), AIT: availability(input.AIT), ECMS: availability(input.ECMS) };
  if (source === 'mappings') {
    const jpCode = string(input.jpCode, 'Japan Post code', 2).toUpperCase();
    if (!/^[A-Z]{2}$/.test(jpCode)) fail('Japan Post codes must contain two letters.');
    return { countryCode, jpCode };
  }
  if (!methods.some(method => method.key === input.method)) fail('Choose a supported shipping method.');
  if (!['1', '0'].includes(input.enabled)) fail('Choose enable or disable for the exception.');
  return { countryCode, method: input.method, enabled: input.enabled === '1', reason: string(input.reason, 'exception reason') };
}
const key = row => JSON.stringify([row.countryCode, row.method || '']);
const sorted = rows => [...rows].sort((a, b) => key(a).localeCompare(key(b), 'en'));
const headers = {
  website: ['country', 'country_code'],
  internal: ['country', 'country_code', 'country_j', 'DHL', 'AIT', 'ECMS'],
  mappings: ['country_code', 'jp_code'],
};
async function parseImport(source, buffer) {
  if (!headers[source]) fail('This source does not support CSV import.');
  if (!Buffer.isBuffer(buffer) || !buffer.length || buffer.length > 5 * 1024 * 1024) fail('Choose a non-empty CSV file up to 5 MB.');
  let text, rows;
  try { text = new TextDecoder('utf-8', { fatal: true }).decode(buffer); }
  catch (_) { fail('The CSV must use UTF-8 encoding.'); }
  try { rows = await csv({ noheader: true, output: 'csv', trim: false, ignoreEmpty: false }).fromString(text); }
  catch (_) { fail('The CSV could not be read. Check its quotes and row structure.'); }
  const header = rows.shift();
  if (!isDeepStrictEqual(header, headers[source])) fail(`Expected CSV header: ${headers[source].join(',')}`);
  if (!rows.length || rows.length > 2000) fail('The CSV must contain between 1 and 2,000 countries.');
  const seen = new Set();
  return sorted(rows.map((row, index) => {
    if (row.length !== header.length) fail(`CSV record ${index + 2} has the wrong number of columns.`);
    const data = Object.fromEntries(header.map((name, i) => [name, row[i]]));
    const result = normalize(source, { ...data, countryCode: data.country_code, countryName: data.country, countryNameJ: data.country_j, jpCode: data.jp_code });
    if (seen.has(result.countryCode)) fail(`Duplicate country code: ${result.countryCode}`);
    seen.add(result.countryCode);
    return result;
  }));
}
function changes(before, after) {
  const oldRows = new Map(before.map(row => [key(row), row]));
  const newRows = new Map(after.map(row => [key(row), row]));
  return [...new Set([...oldRows.keys(), ...newRows.keys()])].flatMap(id => {
    const oldRow = oldRows.get(id), newRow = newRows.get(id);
    if (isDeepStrictEqual(oldRow, newRow)) return [];
    return [{ countryCode: (newRow || oldRow).countryCode, method: (newRow || oldRow).method,
      action: !oldRow ? 'Added' : !newRow ? 'Removed' : 'Changed',
      fields: [...new Set([...Object.keys(oldRow || {}), ...Object.keys(newRow || {})])]
        .filter(field => field !== 'countryCode' && !isDeepStrictEqual(oldRow && oldRow[field], newRow && newRow[field]))
        .map(field => ({ field, before: oldRow ? oldRow[field] : null, after: newRow ? newRow[field] : null })),
    }];
  });
}
function resolveCountry(website, state, jp) {
  const internal = state.internal.find(row => row.countryCode === website.countryCode);
  const mapping = state.mappings.find(row => row.countryCode === website.countryCode);
  const record = mapping && jp.find(row => row.countryCode === mapping.jpCode);
  const exceptions = state.exceptions.filter(row => row.countryCode === website.countryCode);
  return { ...website, internal, mapping, japanPost: record, exceptions, methods: methods.map(method => {
    let base = null;
    let evidence;
    if (method.source === 'internal') {
      base = internal ? internal[method.key] : null;
      evidence = internal ? 'Internal country list' : 'No internal country entry';
    } else {
      const flags = method.flags.map(field => flag(record && record.data[field]));
      base = flags.includes(false) ? false : flags.every(value => value === true) ? true : null;
      evidence = !mapping ? 'No Japan Post mapping' : !record ? 'No Japan Post data at this time' : method.flags.map(field => `${field}: ${record.data[field] || 'not specified'}`).join('; ');
    }
    const exception = exceptions.find(row => row.method === method.key);
    return { ...method, base, value: exception ? exception.enabled : base, exception, evidence };
  }) };
}
function cutoff(value) {
  if (!value) return null;
  if (typeof value !== 'string') fail('Choose a valid historical date.');
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    if (!Number.isFinite(Date.parse(value)) || new Date(value).toISOString().slice(0, 10) !== value) fail('Choose a valid historical date.');
    return new Date(`${value}T23:59:59.999+09:00`);
  }
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(value) || !Number.isFinite(Date.parse(value))) fail('Choose a valid historical date.');
  return new Date(value);
}
module.exports = { sources, methods, headers, label, flag, code, normalize, key, sorted, parseImport, changes, resolveCountry, cutoff };
