/** @jest-environment jsdom */
const fs = require('fs');
const pug = require('pug');
const { parseCountry } = require('../utils/japanPostParser');
const template = pug.compileFile('views/japanpost.pug');
const script = fs.readFileSync('public/javascripts/japanpost.js', 'utf8');
const parsed = cid => parseCountry(fs.readFileSync(`tests/fixtures/japan-post-${cid}.html`, 'utf8'));
const record = data => ({ data, detectedAt: '2026-10-31T00:00:00Z', lastCheckedAt: '2026-10-31T00:00:00Z' });
const response = data => ({ ok: true, json: async () => data });
const tick = async () => { for (let i = 0; i < 20; i++) await Promise.resolve(); };

beforeEach(() => {
  jest.useFakeTimers();
  window.history.replaceState(null, '', '/japan-post');
  window.Loaded = () => {};
  document.documentElement.innerHTML = template({ japanPostCsrf: 'token', today: '2026-10-31' });
  window.fetch = jest.fn().mockResolvedValueOnce(response({ schedules: [] }));
});
afterEach(() => { jest.clearAllTimers(); jest.useRealTimers(); });

test('fetched unavailable services replace their limit cards, retain JSON evidence and show history', async () => {
  window.eval(script);
  await tick();
  const current = parsed(234);
  const previous = parsed(234);
  previous.parcel.surface = { ...previous.parcel.air };
  previous.ems = { ...previous.parcel.air };
  window.fetch.mockResolvedValueOnce(response({ latest: record(current), history: [record(previous)], changed: true }));
  document.getElementById('jp-cid').value = '234';
  document.getElementById('jp-fetch-form').dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
  await tick();
  const cards = document.querySelectorAll('#jp-limits .jp-limit-card');
  expect(cards[0].textContent).toContain('30 kg');
  for (const card of [cards[1], cards[2]]) {
    expect(card.querySelector('strong').textContent).toBe('Unavailable');
    expect(card.querySelector('dl')).toBe(null);
    expect(card.textContent).not.toContain('0 kg');
  }
  expect(document.getElementById('jp-warnings').textContent).toBe('');
  const json = JSON.parse(document.getElementById('jp-json').textContent);
  expect(json.ems).toMatchObject({ unavailable: true, size: '取り扱いなし', weight: { value: 0, unit: 'kg' } });
  expect(document.querySelectorAll('#jp-history > details')).toHaveLength(1);
  expect(document.getElementById('jp-history').textContent).toContain('30 kg');
});

test('opening a cached country displays unavailable EMS without submitting a fetch', async () => {
  window.history.replaceState(null, '', '/japan-post?cid=235');
  window.fetch.mockResolvedValueOnce(response({ history: [record(parsed(235))] }));
  window.eval(script);
  await tick();
  expect(document.querySelector('#jp-limits .jp-limit-card:last-child .jp-unavailable').textContent).toBe('Unavailable');
  expect(window.fetch.mock.calls.map(call => call[0])).toEqual(['/japan-post/api/schedules', '/japan-post/api/countries/235']);
});
