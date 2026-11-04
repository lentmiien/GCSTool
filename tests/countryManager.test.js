const { parseImport, normalize, resolveCountry, cutoff, changes } = require('../utils/countryManager');
const state = () => ({ website: [], internal: [], mappings: [], exceptions: [] });
const country = { countryCode: '001', countryName: 'Test' };

test('CSV parsing preserves internal codes and supports quoted names, UTF-8 BOM and multiline names', async () => {
  expect(await parseImport('website', Buffer.from('\ufeffcountry,country_code\r\n"Test, island",001\r\n"Multi\nline",002'))).toEqual([
    { countryCode: '001', countryName: 'Test, island' }, { countryCode: '002', countryName: 'Multi\nline' },
  ]);
  const rows = await parseImport('internal', Buffer.from('country,country_code,country_j,DHL,AIT,ECMS\nTest,001,,0,1,'));
  expect(rows[0]).toMatchObject({ countryCode: '001', countryNameJ: '', DHL: false, AIT: true, ECMS: null });
});

test.each([
  ['website', 'country,country_code\nTest,001\nOther,001'],
  ['website', 'country,country_code\nTest'],
  ['website', 'country,country_code\n"Test,001'],
  ['website', 'country,country_code\nTest,001,extra'],
  ['internal', 'country,country_code,country_j,DHL,AIT\nTest,1,,1,1'],
  ['internal', 'country,country_code,country_j,DHL,AIT,ECMS\nTest,1,,2,1,0'],
  ['mappings', 'country_code,jp_code\n001,USA'],
])('rejects invalid %s import', async (source, text) => {
  await expect(parseImport(source, Buffer.from(text))).rejects.toThrow();
});

test('requires an exception reason and known method and strict flag values', () => {
  expect(() => normalize('exceptions', { countryCode: '001', method: 'EMS', enabled: '1', reason: 'Test' })).toThrow();
  expect(() => normalize('exceptions', { countryCode: '001', method: 'ems', enabled: '1', reason: ' ' })).toThrow();
  expect(() => normalize('internal', { ...country, DHL: 'true', AIT: '0', ECMS: '' })).toThrow();
  expect(normalize('mappings', { countryCode: '001', jpCode: 'us' })).toEqual({ countryCode: '001', jpCode: 'US' });
});

test('unknown remains distinct from unavailable and exceptions override either source in both directions', () => {
  const data = state();
  expect(resolveCountry(country, data, []).methods.every(method => method.value === null)).toBe(true);
  data.internal.push({ ...country, DHL: true, AIT: false, ECMS: null });
  data.mappings.push({ countryCode: '001', jpCode: 'US' });
  const jp = [{ countryCode: 'US', data: { EMS取扱フラグ: '0', '小形包装物(航空便)取扱フラグ': '1', '小形包装物（書留）（航空便）取扱フラグ': '0' } }];
  data.exceptions.push({ countryCode: '001', method: 'DHL', enabled: false, reason: 'Block' }, { countryCode: '001', method: 'ems', enabled: true, reason: 'Special arrangement' });
  const result = Object.fromEntries(resolveCountry(country, data, jp).methods.map(method => [method.key, method]));
  expect(result.DHL).toMatchObject({ base: true, value: false });
  expect(result.ems).toMatchObject({ base: false, value: true });
  expect(result.airSmallPacket.value).toBe(false);
  expect(result.airSmallPacketUnregistered.value).toBe(true);
  expect(result.salSmallPacket.value).toBe(null);
  expect(result.ECMS.value).toBe(null);
  data.exceptions = [];
  expect(resolveCountry(country, data, jp).methods.find(method => method.key === 'ems').value).toBe(false);
});

test('registered SAL uses both transport and registration flags; no inference from category or positive limits', () => {
  const data = { ...state(), mappings: [{ countryCode: '001', jpCode: 'US' }] };
  const jp = [{ countryCode: 'US', data: { '小形包装物(SAL)取扱フラグ': '1', 'SAL書留フラグ': '1', 'EMS取扱フラグ': '', 'EMS_最大重量': '30' } }];
  let result = resolveCountry(country, data, jp).methods;
  expect(result.find(method => method.key === 'salSmallPacket').value).toBe(true);
  expect(result.find(method => method.key === 'ems').value).toBe(null);
  jp[0].data['小形包装物(SAL)取扱フラグ'] = '0';
  result = resolveCountry(country, data, jp).methods;
  expect(result.find(method => method.key === 'salSmallPacket').value).toBe(false);
});

test('historical dates use Japan end-of-day and reject invalid dates and arrays', () => {
  expect(cutoff('2026-11-03').toISOString()).toBe('2026-11-03T14:59:59.999Z');
  expect(cutoff('2026-11-03T00:00:00.001Z').toISOString()).toBe('2026-11-03T00:00:00.001Z');
  for (const value of ['2026-02-30', 'junk', ['2026-11-03']]) expect(() => cutoff(value)).toThrow();
});

test('history captures additions, renames and removals', () => {
  const diff = changes([country, { countryCode: '002', countryName: 'Removed' }], [{ ...country, countryName: 'Renamed' }, { countryCode: '003', countryName: 'Added' }]);
  expect(diff.map(row => row.action)).toEqual(['Changed', 'Removed', 'Added']);
  expect(diff[0].fields).toContainEqual({ field: 'countryName', before: 'Test', after: 'Renamed' });
});
