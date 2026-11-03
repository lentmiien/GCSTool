const fs = require('fs');
const { parseCsv, manualChart, MAX_BYTES } = require('../utils/japanPostRatesCsv');
const { compare, select, toRows } = require('../public/javascripts/shipcost-chart');
const { today, validateDate } = require('../services/shipcost');
const sample = fs.readFileSync('tests/fixtures/japan-post-ems-rates.csv');
const encode = rows => Buffer.from(rows.map(row => row.map(value => `"${String(value).replace(/"/g, '""')}"`).join(',')).join('\r\n'));
const small = (headers = ['重量', '新_第一地帯_料金', '新_第二地帯_料金'], rows = [[500, 100, 200], [2000, 300, 400]]) => encode([headers, ...rows]);

test('supplied EMS export selects all 210 current rates, not the four obsolete columns', async () => {
  const { chart, ignoredColumns } = await parseCsv(sample, 'EMS');
  expect(chart.weights).toHaveLength(42);
  expect(chart.zones.map(zone => zone.key)).toEqual(['zone1', 'zone2', 'zone3', 'zone4', 'zone5']);
  expect(chart.weights[0]).toBe(500);
  expect(chart.weights[41]).toBe(30000);
  expect(chart.rates[0]).toEqual([1450, 1900, 3150, 3900, 3600]);
  expect(chart.rates[41]).toEqual([26600, 33350, 65500, 75100, 77700]);
  expect(ignoredColumns).toHaveLength(4);
});

test('maps headers instead of positions; BOM, CRLF, quoted thousands and reordered axes are accepted', async () => {
  const parsed = await parseCsv(Buffer.concat([Buffer.from('\ufeff'), small(['重量', '新_第二地帯_料金', '新_第一地帯_料金'], [[2000, '1,400', 300], [500, 200, 100]])]), 'EMS');
  expect(parsed.chart.weights).toEqual([500, 2000]);
  expect(parsed.chart.rates).toEqual([[100, 200], [300, 1400]]);
});

test('variable zone counts and coarse parcel brackets; small packets stop at 2000 g', async () => {
  const { chart } = await parseCsv(small(['重量', '第一地帯_料金'], [[1000, 100], [30000, 200]]), 'Air parcel');
  expect(chart.zones).toHaveLength(1);
  expect(chart.weights).toEqual([1000, 30000]);
  expect((await parseCsv(small(), 'Air small packet unregistered')).chart.weights).toEqual([500, 2000]);
  await expect(parseCsv(small(undefined, [[2001, 100, 200]]), 'Air small packet unregistered')).rejects.toThrow('2000');
});

test.each([
  ['duplicate weight', small(undefined, [[500, 100, 200], [500, 300, 400]])],
  ['missing cell', small(undefined, [[500, 100]])],
  ['extra cell', small(undefined, [[500, 100, 200, 300]])],
  ['empty rate', small(undefined, [[500, '', 200]])],
  ['non-numeric rate', small(undefined, [[500, 'oops', 200]])],
  ['zero rate', small(undefined, [[500, 0, 200]])],
  ['negative rate', small(undefined, [[500, -100, 200]])],
  ['fraction', small(undefined, [[500, 100.5, 200]])],
  ['overflow', small(undefined, [[500, 2147483648, 200]])],
  ['duplicate header', small(['重量', '新_第一地帯_料金', '新_第一地帯_料金'])],
  ['duplicate zone', small(['重量', '新_第一地帯_料金', '新_第1地帯_料金'])],
  ['unknown column', small(['重量', 'new rate', '新_第一地帯_料金'])],
  ['ambiguous legacy zones', small(['重量', '第二地帯_料金（オセアニア等）', '第二地帯_料金（ヨーロッパ等）'])],
  ['no rows', small(undefined, [])],
  ['invalid encoding', Buffer.from([255, 255])],
  ['oversize', Buffer.alloc(MAX_BYTES + 1)],
])('rejects %s without producing a partial chart', async (_, buffer) => {
  await expect(parseCsv(buffer, 'EMS')).rejects.toThrow();
});

test('compares rows, columns, labels and each cell; irrelevant ordering and old columns do not change current chart', async () => {
  const a = (await parseCsv(small(), 'EMS')).chart;
  const identical = (await parseCsv(small(['重量', '新_第二地帯_料金', '第一地帯_料金', '新_第一地帯_料金'], [[2000, 400, 999, 300], [500, 200, 888, 100]]), 'EMS')).chart;
  expect(compare(a, identical).identical).toBe(true);
  const b = (await parseCsv(small(['重量', '新_第一地帯_料金', '新_第三地帯_料金'], [[500, 101, 200], [1000, 300, 400]]), 'EMS')).chart;
  expect(compare(a, b)).toMatchObject({ identical: false, addedRows: [1000], removedRows: [2000], addedColumns: ['zone3'], removedColumns: ['zone2'], cells: [{ weight: 500, zone: 'zone1', before: 100, after: 101 }] });
  const renamed = JSON.parse(JSON.stringify(a));
  renamed.zones[0].label += ' changed definition';
  expect(compare(a, renamed).renamedColumns).toEqual(['zone1']);
});

test('whole-version selection removes obsolete rows/zones and handles date cutoffs and same-day changes', async () => {
  const first = (await parseCsv(small(), 'EMS')).chart;
  const next = (await parseCsv(small(['重量', '新_第一地帯_料金'], [[1000, 900]]), 'EMS')).chart;
  const legacy = toRows(first, 'EMS', 20200101).map((row, id) => ({ ...row, id }));
  const versions = [{ id: 1, method: 'EMS', costdate: 20261101, chart: first }, { id: 2, method: 'EMS', costdate: 20261101, chart: next }];
  expect(select(legacy, versions, 20190101)).toEqual({});
  expect(select(legacy, versions, 20261031).EMS.chart).toEqual(first);
  expect(select(legacy, versions, 20261101).EMS.chart).toEqual(next);
  expect(select(legacy, versions).EMS.chart).toEqual(next);
});

test('manual saves require complete validated charts, and Japan dates avoid UTC boundary errors', () => {
  const rows = [{ method: 'EMS', zone: 'zone1', uptoweight_g: 500, cost: 200 }, { method: 'EMS', zone: 'zone2', uptoweight_g: 1000, cost: 300 }];
  expect(() => manualChart('EMS', rows)).toThrow('Every weight row');
  expect(() => manualChart('EMS', [rows[0], rows[0]])).toThrow('duplicate');
  expect(() => manualChart('EMS', [{ ...rows[0], cost: '200.5' }])).toThrow();
  expect(() => manualChart('EMS', [{ ...rows[0], method: 'DHL' }])).toThrow();
  expect(today(new Date('2026-11-02T15:01:00Z'))).toBe(20261103);
  expect(() => validateDate(20260230)).toThrow();
});
