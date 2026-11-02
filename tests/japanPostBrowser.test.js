/** @jest-environment jsdom */
const fs = require('fs');
const pug = require('pug');
const template = pug.compileFile('views/japanpost.pug');
const script = fs.readFileSync('public/javascripts/japanpost.js', 'utf8');
const tick = async () => { for (let i = 0; i < 20; i++) await Promise.resolve(); };

beforeEach(() => {
  document.documentElement.innerHTML = template({ japanPostCsrf: 'token', overview: { countries: 0 }, formatDate: () => '—' });
  const file = new File(['CSV data'], 'countries.csv', { type: 'text/csv' });
  Object.defineProperty(document.getElementById('jp-csv'), 'files', { value: [file] });
  window.fetch = jest.fn();
  window.eval(script);
});
const submit = () => document.getElementById('jp-import-form').dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));

test('upload sends multipart data with CSRF and displays accurate import counts', async () => {
  window.fetch.mockResolvedValue({ ok: true, json: async () => ({ total: 255, added: 250, updated: 2, unchanged: 3, checkedAt: '2026-11-02T00:00:00Z' }) });
  submit();
  submit();
  expect(window.fetch).toHaveBeenCalledTimes(1);
  await tick();
  const [url, options] = window.fetch.mock.calls[0];
  expect(url).toBe('/japan-post/api/import');
  expect(options.headers['X-CSRF-Token']).toBe('token');
  expect(options.body.get('csvFile').name).toBe('countries.csv');
  expect(document.getElementById('jp-import-result').hidden).toBe(false);
  expect(document.getElementById('jp-added').textContent).toBe('250');
  expect(document.getElementById('jp-updated').textContent).toBe('2');
  expect(document.getElementById('jp-unchanged').textContent).toBe('3');
  expect(document.getElementById('jp-import-status').textContent).toContain('255 countries');
  expect(document.querySelector('#jp-import-form button').disabled).toBe(false);
});

test('invalid import reports the error without displaying success or altering saved counts', async () => {
  window.fetch.mockResolvedValue({ ok: false, json: async () => ({ error: 'Duplicate country code AU.' }) });
  submit();
  await tick();
  expect(document.getElementById('jp-import-status').textContent).toBe('Duplicate country code AU.');
  expect(document.getElementById('jp-import-result').hidden).toBe(true);
  expect(document.getElementById('jp-country-count').textContent).toBe('0');
  expect(document.querySelector('#jp-import-form button').disabled).toBe(false);
});
