const fs = require('fs');
const path = require('path');
const { parseCountry, parseSize, parseWeight, normalizeCountry, isUnavailable } = require('../utils/japanPostParser');
const { japanDate, parseCid, parseDate } = require('../services/japanPost');
const fixture = cid => fs.readFileSync(path.join(__dirname, `fixtures/japan-post-${cid}.html`), 'utf8');

test('Australia sample keeps English territories and extracts the three service limits', () => {
  const result = parseCountry(fixture(14));
  expect(result.countryName).toBe('Australia (Incl. Christmas Isl, Cocos (Keeling) Isls, Norfork Isl, Lord Howe Isl and Australian Antarctic Territories)');
  expect(result.parcel.air).toEqual({ size: { length: { value: 1.05, unit: 'm' }, lengthPlusGirth: { value: 2, unit: 'm' } }, weight: { value: 20, unit: 'kg' }, unavailable: false });
  expect(result.parcel.surface).toEqual(result.parcel.air);
  expect(result.ems.size.lengthPlusGirth).toEqual({ value: 3, unit: 'm' });
  expect(result.ems.weight).toEqual({ value: 20, unit: 'kg' });
  expect(result.warnings).toEqual([]);
});

test('downloaded CID 105 separates Ireland from the appended French name', () => {
  const result = parseCountry(fixture(105));
  expect(result.countryName).toBe('Ireland');
  for (const service of [result.parcel.air, result.parcel.surface, result.ems]) {
    expect(service).toEqual({ size: { length: { value: 1.5, unit: 'm' }, lengthPlusGirth: { value: 3, unit: 'm' } }, weight: { value: 30, unit: 'kg' }, unavailable: false });
  }
});

test.each([
  [203, 'Ukraine', [1.05, 2, 30], [1.05, 2, 30], [1.5, 3, 30]],
  [65, 'Estonia', [1.5, 3, 30], [1.5, 3, 30], [1.5, 3, 30]],
  [36, 'Cameroon', [1.5, 3, 30], [1.5, 3, 30], null],
  [115, 'Kyrgyzstan', [1.5, 3, 20], [1.5, 3, 30], null],
  [177, 'Seychelles(Aldabra, Deroches,Farquhar)', [1.05, 2, 30], [1.05, 2, 30], null],
  [25, 'Belgium', [1.5, 3, 30], [1.5, 3, 30], [1.5, 3, 30]],
  [132, 'Morocco', [1.05, 2, 30], [1.05, 2, 30], [1.5, 3, 30]],
  [204, 'Uruguay', [1.5, 3, 30], null, [1.05, 2, 30]],
  [186, 'Suriname', [1.05, 2, 30], [1.05, 2, 30], null],
  [98, 'Haiti', [1.5, 3, 30], [1.05, 2, 30], null],
  [223, 'French Guiana', [1.5, 3, 30], [1.5, 3, 30], [1.5, 3, 30]],
  [26, 'Belize', [1.5, 3, 25], [1.5, 3, 25], null],
  [63, 'Ecuador', [1.05, 2, 30], null, [1.5, 3, 30]],
  [143, 'Nepal', [1.05, 2, 20], [1.05, 2, 20], [1.5, 3, 30]],
  [31, 'Brazil', [1.05, 2, 30], [1.05, 2, 30], [1.5, 3, 30]],
  [130, 'Mali', [1.05, 2, 30], [1.05, 2, 30], null],
  [234, 'Curaçao', [1.5, 3, 30], null, null],
  [235, 'Sint Maarten', [1.5, 3, 30], [1.5, 3, 30], null],
  [236, 'Caribbean Netherlands (Bonaire, Saba, Sint Eustatius)', [1.5, 3, 25], [1.5, 3, 25], null],
])('CID %i parses notices, English names, limits and unavailable services', (cid, name, air, surface, ems) => {
  const result = parseCountry(fixture(cid));
  expect(result.countryName).toBe(name);
  expect(result.warnings).toEqual([]);
  [result.parcel.air, result.parcel.surface, result.ems].forEach((service, index) => {
    const expected = [air, surface, ems][index];
    expect(service.unavailable).toBe(expected === null);
    if (expected) {
      expect(service.size).toEqual({ length: { value: expected[0], unit: 'm' }, lengthPlusGirth: { value: expected[1], unit: 'm' } });
      expect(service.weight).toEqual({ value: expected[2], unit: 'kg' });
    }
  });
});

test('unavailable markers apply only to their service, independently of zero weight', () => {
  // EMS has an explicit marker even if its weight cell is absent.
  const result = parseCountry(fixture(235).replace(/>0kgまで</g, '>&nbsp;<'));
  expect(result.ems).toMatchObject({ unavailable: true, size: '取り扱いなし', weight: null });
  expect(result.parcel.air.unavailable).toBe(false);
  expect(result.parcel.surface.unavailable).toBe(false);
  expect(result.warnings).toEqual([]);
  for (const marker of ['取り扱いなし', '取扱いなし', '取扱なし', '取り扱わない']) {
    expect(isUnavailable({ size: marker, weight: null })).toBe(true);
  }
  expect(isUnavailable({ size: null, weight: { value: 0, unit: 'kg' } })).toBe(true);
  expect(isUnavailable({ size: null, weight: '０kgまで 取り扱わない' })).toBe(true);
  expect(isUnavailable({ size: null, weight: null })).toBe(false);
  expect(isUnavailable({ size: null, weight: { value: 20, unit: 'kg' } })).toBe(false);
});

test('unrelated unavailability text cannot mark another service unavailable', () => {
  const html = fixture(14).replace('長さ1.05m　長さと横周の合計2m', '')
    .replace('<div><table', '<p>保険付小包は取り扱いなし</p><div><table');
  const result = parseCountry(html);
  expect(result.parcel.air.unavailable).toBe(false);
  expect(result.parcel.air.size).toBe(null);
  expect(result.warnings).toContain('Parcel air: some limits were not found. Check the source page.');
});

test('normalizing legacy cached data adds status without mutation or false parse warnings', () => {
  const legacy = parseCountry(fixture(234));
  for (const service of [legacy.parcel.air, legacy.parcel.surface, legacy.ems]) delete service.unavailable;
  legacy.warnings = ['Parcel surface: some limits were not found. Check the source page.', 'EMS: source text retained where numeric parsing was not possible.', 'An unrelated warning.'];
  const original = JSON.stringify(legacy);
  const normalized = normalizeCountry(legacy);
  expect(normalized.parcel.surface.unavailable).toBe(true);
  expect(normalized.ems.unavailable).toBe(true);
  expect(normalized.parcel.air.unavailable).toBe(false);
  expect(normalized.warnings).toEqual(['An unrelated warning.']);
  expect(JSON.stringify(legacy)).toBe(original);
});

test('normalizes full-width quantities and retains conditional or unfamiliar text', () => {
  expect(parseSize('長さ１０５cm　長さと横周の合計２００cm')).toEqual({ length: { value: 105, unit: 'cm' }, lengthPlusGirth: { value: 200, unit: 'cm' } });
  expect(parseWeight('２．５kgまで')).toEqual({ value: 2.5, unit: 'kg' });
  expect(parseWeight('500g以下')).toEqual({ value: 500, unit: 'g' });
  expect(parseSize('地域により異なる')).toBe('地域により異なる');
  expect(parseWeight('20kgまで（一部地域は10kg）')).toBe('20kgまで(一部地域は10kg)');
  const result = parseCountry(fixture(14).replace('20kgまで', '地域により異なる'));
  expect(result.parcel.air.weight).toBe('地域により異なる');
  expect(result.warnings.length).toBe(1);
});

test('keeps rowspanned notes and ignores SAL and unrelated tables', () => {
  const html = fixture(14).replace('<td class="arrange-c">&nbsp;</td>', '<td class="arrange-c">一部地域を除く</td>');
  expect(parseCountry(html).parcel.air.size).toContain('一部地域を除く');
  expect(parseCountry(html).parcel.surface.size.length.value).toBe(1.05);
});

test('rejects error pages and invalid inputs, and uses the Japan calendar boundary', () => {
  expect(() => parseCountry('<html><h1>Service unavailable</h1></html>')).toThrow(/recognizable/);
  for (const cid of ['-1', '1.5', '1&url=x', '0', [], [14], {}, '9999999999']) expect(() => parseCid(cid)).toThrow();
  expect(parseCid('105')).toBe(105);
  for (const date of ['2026-02-30', '2026-13-01', '', ['2026-10-31']]) expect(() => parseDate(date)).toThrow();
  expect(japanDate('2026-10-30T14:59:59Z')).toBe('2026-10-30');
  expect(japanDate('2026-10-30T15:00:00Z')).toBe('2026-10-31');
});
