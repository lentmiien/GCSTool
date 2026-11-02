const fs = require('fs');
const { parseCsv, columns, countryCode, limits, detailSections } = require('../utils/japanPostCsv');
const { japanDate, parseDate } = require('../services/japanPost');
const sample = fs.readFileSync('tests/fixtures/japan-post-countries.csv');
const encode = (rows, headers = columns) => Buffer.from([headers, ...rows.map(row => headers.map(key => row[key] || ''))]
  .map(row => row.map(value => `"${String(value).replace(/"/g, '""')}"`).join(',')).join('\r\n'));
let records;
beforeAll(async () => { records = await parseCsv(sample); });

test('the supplied export preserves all 61 columns for all 255 distinct country codes', () => {
  expect(records).toHaveLength(255);
  expect(new Set(records.map(row => row.countryCode)).size).toBe(255);
  for (const record of records) expect(Object.keys(record.data)).toHaveLength(61);
  const au = records.find(row => row.countryCode === 'AU').data;
  expect(au['ＥＭＳサイズ・長さ']).toBe('105');
  expect(au['国名（日本語）']).toBe('オーストラリア');
  expect(au['EMS_INV枚数　その他']).toBe('0');
  expect(detailSections(au).flatMap(section => section.fields)).toHaveLength(61);
});

test('viewer conversion leaves source values intact and handling flags control availability', () => {
  const au = records.find(row => row.countryCode === 'AU').data;
  const result = limits(au);
  expect(result.map(method => method.status)).toEqual(['Unavailable', 'Available', 'Available', 'Available']);
  expect(result[1].values).toEqual(['20 kg', '1.05 m', '2 m']);
  expect(result[3].values).toEqual(['20 kg', '1.05 m', '3 m']);
  expect(au['ＥＭＳサイズ・長さ']).toBe('105');
  expect(limits({ ...au, EMS取扱フラグ: '0', EMS_最大重量: '30' })[3].status).toBe('Unavailable');
  expect(limits({ ...au, EMS取扱フラグ: '', EMS_最大重量: '0' })[3].status).toBe('Not specified');
  const unknown = limits({ ...au, 'ＥＭＳサイズ・長さ': 'See conditions', 'EMS_最大重量': '' })[3];
  expect(unknown.values.slice(0, 2)).toEqual(['—', 'See conditions']);
});

test('BOM, CRLF, quoted commas, quotes, newlines, empty strings and extra columns survive import', async () => {
  const data = { ...records[0].data, extra: 'line one, "quoted"\nline two', blank: '' };
  const parsed = await parseCsv(Buffer.concat([Buffer.from('\ufeff'), encode([data], [...columns, 'extra', 'blank'])]));
  expect(parsed[0].data).toEqual(data);
  const fields = detailSections(parsed[0].data, records[0].data).flatMap(section => section.fields);
  expect(fields.find(field => field.key === 'extra')).toMatchObject({ value: data.extra, changed: true, previous: 'Column not present' });
  expect(fields.find(field => field.key === 'blank').value).toBe('Not provided');
});

test('invalid imports fail before any data can be saved', async () => {
  const data = records[0].data;
  await expect(parseCsv(Buffer.from('hello'))).rejects.toThrow('Missing Japan Post');
  await expect(parseCsv(encode([data, data]))).rejects.toThrow('Duplicate country');
  await expect(parseCsv(encode([{ ...data, 国コード: '123' }]))).rejects.toThrow('two-letter');
  await expect(parseCsv(encode([{ ...data, '国名（英語）': '' }]))).rejects.toThrow('English name');
  await expect(parseCsv(encode([data], [...columns, columns[0]]))).rejects.toThrow('duplicate');
  await expect(parseCsv(encode([data], [...columns, '__proto__']))).rejects.toThrow('unsupported');
  await expect(parseCsv(Buffer.concat([encode([data]), Buffer.from(',"extra"')]))).rejects.toThrow('columns');
  await expect(parseCsv(Buffer.concat([encode([data]), Buffer.from(',"unclosed')]))).rejects.toThrow('quoting');
  await expect(parseCsv(encode([]))).rejects.toThrow('between 1');
  await expect(parseCsv(Buffer.alloc(5 * 1024 * 1024 + 1))).rejects.toThrow('5 MB');
  await expect(parseCsv(Buffer.from([0xff]))).rejects.toThrow('UTF-8');
});

test('country codes and filter dates are validated and calendar dates use Japan time', () => {
  expect(countryCode(' au ')).toBe('AU');
  for (const code of ['1', '../AU', '<>', {}, ['AU']]) expect(() => countryCode(code)).toThrow();
  expect(japanDate('2026-11-01T15:00:00Z')).toBe('2026-11-02');
  expect(parseDate('2026-11-02')).toBe('2026-11-02');
  for (const date of ['2026-02-30', '2026-13-01', 'invalid', []]) expect(() => parseDate(date)).toThrow();
});
