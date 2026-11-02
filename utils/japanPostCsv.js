const csv = require('csvtojson');
const { TextDecoder } = require('util');

const MAX_BYTES = 5 * 1024 * 1024;
// Source column names remain unchanged in saved JSON, including full-width characters.
const sections = [
  { title: 'Country & destination', fields: [
    ['国コード', 'Country code'], ['国名（英語）', 'English name'], ['国名（日本語）', 'Japanese name'],
    ['国名（英語・略称）', 'English short name'], ['地帯コード', 'Zone code'],
    ['発送可能地域(日本語表記）', 'Delivery areas · Japanese'], ['発送可能地域(英語表記）', 'Delivery areas · English'],
    ['物品のみ送付可能フラグ', 'Goods-only flag'],
  ] },
  { title: 'EMS', fields: [
    ['EMS取扱フラグ', 'Availability', 'flag'], ['EMS取扱状態', 'Handling status code'],
    ['EMS_最大重量', 'Maximum weight', 'kg'], ['ＥＭＳサイズ・長さ', 'Maximum length', 'cm'],
    ['ＥＭＳサイズ・長さ＋横周', 'Maximum length + girth', 'cm'], ['EMS_追跡可否', 'Tracking code'],
    ['EMS_CN23枚数', 'CN23 forms', 'copies'], ['EMS_INV枚数　商品', 'Invoices · merchandise', 'copies'],
    ['EMS_INV枚数　商品見本', 'Invoices · samples', 'copies'], ['EMS_INV枚数　その他', 'Invoices · other', 'copies'],
  ] },
  { title: 'Parcels', fields: [
    ['国際小包取扱状態', 'Handling status code'],
    ['SAL小包取扱フラグ', 'SAL availability', 'flag'], ['国際小包（航空便）取扱フラグ', 'Air availability', 'flag'],
    ['国際小包（船便）取扱フラグ', 'Surface availability', 'flag'],
    ['最大重量(小包み・SAL便）', 'SAL · maximum weight', 'kg'], ['小包サイズ・長さ（SAL便）', 'SAL · maximum length', 'cm'],
    ['小包サイズ・長さ＋横周（SAL便）', 'SAL · maximum length + girth', 'cm'],
    ['最大重量(小包み・航空便）', 'Air · maximum weight', 'kg'], ['小包サイズ・長さ（航空便）', 'Air · maximum length', 'cm'],
    ['小包サイズ・長さ＋横周（航空便）', 'Air · maximum length + girth', 'cm'],
    ['最大重量(小包み・船便）', 'Surface · maximum weight', 'kg'], ['小包サイズ・長さ（船便）', 'Surface · maximum length', 'cm'],
    ['小包サイズ・長さ＋横周（船便）', 'Surface · maximum length + girth', 'cm'],
    ['小包_CN23枚数', 'CN23 forms', 'copies'], ['小包_INV枚数　商品', 'Invoices · merchandise', 'copies'],
    ['小包_INV枚数　商品見本', 'Invoices · samples', 'copies'], ['小包_INV枚数　その他', 'Invoices · other', 'copies'],
    ['保険金額上限SDR(航空便)', 'Air · insurance limit', 'SDR'], ['保険金額上限SDR(SAL便)', 'SAL · insurance limit', 'SDR'],
    ['保険金額上限SDR(船便)', 'Surface · insurance limit', 'SDR'], ['速達取扱（小包）', 'Express handling code'],
    ['受取通知取扱（小包）', 'Advice of delivery code'],
  ] },
  { title: 'Small packets & ePacket', fields: [
    ['SP最大重量', 'Small packet · maximum weight', 'kg'], ['SPCN23枚数', 'Small packet · CN23 forms', 'copies'],
    ['小形包装物(航空便)取扱フラグ', 'Air availability', 'flag'], ['小形包装物(SAL)取扱フラグ', 'SAL availability', 'flag'],
    ['小形包装物(船便)取扱フラグ', 'Surface availability', 'flag'],
    ['小形包装物（書留）（航空便）取扱フラグ', 'Registered air availability', 'flag'],
    ['国際eパケット取扱フラグ', 'International ePacket availability', 'flag'], ['eパケットライト取扱区分', 'ePacket Light category'],
  ] },
  { title: 'Printed matter', fields: [
    ['PM最大重量', 'Maximum weight', 'kg'], ['印刷物（航空便）取扱フラグ', 'Air availability', 'flag'],
    ['印刷物（SAL便）取扱フラグ', 'SAL availability', 'flag'], ['印刷物（船便）取扱フラグ', 'Surface availability', 'flag'],
    ['印刷物（書留）（航空便）取扱フラグ', 'Registered air availability', 'flag'],
    ['印刷物（書留）（SAL）取扱フラグ', 'Registered SAL availability', 'flag'],
  ] },
  { title: 'Letters & other services', fields: [
    ['書状／その他（航空便）取扱フラグ', 'Air availability', 'flag'], ['書状／その他（SAL便）取扱フラグ', 'SAL availability', 'flag'],
    ['書状／その他（船便）取扱フラグ', 'Surface availability', 'flag'],
    ['書状／その他（書留）（航空便）取扱フラグ', 'Registered air availability', 'flag'],
    ['書状／その他（書留）（SAL便）取扱フラグ', 'Registered SAL availability', 'flag'],
    ['SAL書留フラグ', 'Registered SAL availability', 'flag'], ['速達取扱（小包以外）', 'Non-parcel express handling code'],
  ] },
];
const columns = sections.flatMap(section => section.fields.map(field => field[0]));
const methods = [
  { key: 'sal', label: 'SAL', className: 'jp-sal', flag: 'SAL小包取扱フラグ', weight: '最大重量(小包み・SAL便）', length: '小包サイズ・長さ（SAL便）', girth: '小包サイズ・長さ＋横周（SAL便）' },
  { key: 'air', label: 'Parcel · air', className: 'jp-air', flag: '国際小包（航空便）取扱フラグ', weight: '最大重量(小包み・航空便）', length: '小包サイズ・長さ（航空便）', girth: '小包サイズ・長さ＋横周（航空便）' },
  { key: 'surface', label: 'Parcel · surface', className: 'jp-surface', flag: '国際小包（船便）取扱フラグ', weight: '最大重量(小包み・船便）', length: '小包サイズ・長さ（船便）', girth: '小包サイズ・長さ＋横周（船便）' },
  { key: 'ems', label: 'EMS', className: 'jp-ems', flag: 'EMS取扱フラグ', weight: 'EMS_最大重量', length: 'ＥＭＳサイズ・長さ', girth: 'ＥＭＳサイズ・長さ＋横周' },
];
function fail(message, status = 400) { const error = new Error(message); error.status = status; throw error; }
function countryCode(value) {
  const code = typeof value === 'string' ? value.trim().toUpperCase() : '';
  if (!/^[A-Z]{2}$/.test(code)) fail('Enter a two-letter country code.');
  return code;
}
async function parseCsv(buffer) {
  if (!Buffer.isBuffer(buffer) || !buffer.length) fail('Choose a Japan Post CSV file.');
  if (buffer.length > MAX_BYTES) fail('The CSV file must be 5 MB or smaller.', 413);
  let text;
  try { text = new TextDecoder('utf-8', { fatal: true }).decode(buffer); }
  catch (_) { fail('The CSV must use UTF-8 encoding, like the Japan Post export.'); }
  let rows;
  try { rows = await csv({ noheader: true, output: 'csv', trim: false, ignoreEmpty: false }).fromString(text); }
  catch (_) { fail('The CSV could not be read. Check its quoting and row structure.'); }
  const headers = rows.shift() || [];
  if (headers.length > 200 || headers.some(header => !header || ['__proto__', 'prototype', 'constructor'].includes(header))
    || new Set(headers).size !== headers.length) fail('The CSV contains empty, duplicate, or unsupported column names.');
  const missing = columns.filter(column => !headers.includes(column));
  if (missing.length) fail(`Missing Japan Post columns: ${missing.slice(0, 5).join(', ')}${missing.length > 5 ? '…' : ''}`);
  if (!rows.length || rows.length > 1000) fail('The CSV must contain between 1 and 1,000 countries.');
  const codes = new Set();
  return rows.map((row, index) => {
    if (row.length !== headers.length) fail(`CSV record ${index + 2} has ${row.length} columns; expected ${headers.length}.`);
    const data = Object.fromEntries(headers.map((header, i) => [header, row[i]]));
    const code = countryCode(data['国コード']);
    if (codes.has(code)) fail(`Duplicate country code ${code}. Each country must appear once per file.`);
    if (!data['国名（英語）'].trim()) fail(`Country ${code} is missing its English name.`);
    codes.add(code);
    return { countryCode: code, data };
  });
}
const availability = value => value === '1' ? 'Available' : value === '0' ? 'Unavailable' : 'Not specified';
function measurement(value, unit, divisor = 1) {
  if (value == null || !value.trim()) return '—';
  if (!/^\d+(?:\.\d+)?$/.test(value.trim())) return value;
  return `${Number((Number(value) / divisor).toFixed(6))} ${unit}`;
}
function limits(data) {
  return methods.map(method => ({ ...method, status: availability(data[method.flag]), values: [
    measurement(data[method.weight], 'kg'), measurement(data[method.length], 'm', 100), measurement(data[method.girth], 'm', 100),
  ] }));
}
function formatField(value, unit) {
  if (value === undefined) return 'Column not present';
  if (value === '') return 'Not provided';
  if (unit === 'flag') return `${availability(value)} (${value})`;
  if (unit === 'copies' && value === '1') return '1 copy';
  return unit ? `${value} ${unit}` : value;
}
function detailSections(data, previous) {
  const known = new Set(columns);
  const extra = [...new Set([...Object.keys(data), ...Object.keys(previous || {})])].filter(key => !known.has(key));
  return [...sections, { title: 'Additional source columns', fields: extra.map(key => [key, key]) }]
    .map(section => ({ title: section.title, fields: section.fields.filter(([key]) => key in data || previous && key in previous).map(([key, label, unit]) => ({
      key, label, value: formatField(data[key], unit), previous: previous ? formatField(previous[key], unit) : null,
      changed: Boolean(previous && data[key] !== previous[key]),
    })) })).filter(section => section.fields.length);
}
module.exports = { MAX_BYTES, columns, methods, parseCsv, countryCode, availability, limits, detailSections, fail };
