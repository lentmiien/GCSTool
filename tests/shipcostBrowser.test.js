/** @jest-environment jsdom */
const fs = require('fs');
const pug = require('pug');
const chartScript = fs.readFileSync('public/javascripts/shipcost-chart.js', 'utf8');
const viewerScript = fs.readFileSync('public/javascripts/shipcostview.js', 'utf8');
const uploadScript = fs.readFileSync('public/javascripts/shipcost-import.js', 'utf8');
const tick = async () => { for (let i = 0; i < 30; i++) await Promise.resolve(); };
const template = pug.compileFile('views/shipcostview.pug');
const chart = { weights: [1000], zones: [{ key: 'zone6', label: 'Zone 6' }], rates: [[777]] };

test('viewer and downloaded CSV select the same complete chart, exclude removed axes, and honor historical dates', () => {
  document.documentElement.innerHTML = template({ labels: {}, rateToday: '20261103', data: [{ id: 1, method: 'EMS', zone: 'zone1', uptoweight_g: 500, cost: 100, costdate: 20200101 }], versions: [{ id: 2, method: 'EMS', chart, costdate: 20261103 }] });
  let downloaded;
  window.Blob = function (parts) { downloaded = parts.join(''); };
  window.saveAs = jest.fn();
  window.eval(chartScript);
  window.eval(viewerScript);
  expect(document.querySelector('#output tbody').textContent).toBe('1000777');
  expect(document.querySelector('#output thead').textContent).toContain('Zone 6');
  window.DownloadCSV();
  expect(downloaded).toBe('"Up to weight (g)","ems_zone6"\r\n"1000","777"');
  document.getElementById('table_date').value = '2020-01-01';
  window.GenerateTables();
  expect(document.querySelector('#output tbody').textContent).toBe('500100');
  window.DownloadCSV();
  expect(downloaded).toContain('ems_zone1');
  expect(downloaded).not.toContain('zone6');
  document.getElementById('table_date').value = '2019-01-01';
  window.GenerateTables();
  expect(document.getElementById('output').textContent).toContain('No saved rates');
});

function importPage() {
  document.documentElement.innerHTML = pug.renderFile('views/shipcost_import.pug', { shipcostCsrf: 'token', importMethods: ['EMS'], online: false });
  const save = document.createElement('button');
  save.dataset.rateSave = '';
  document.body.append(save);
  Object.defineProperty(document.getElementById('rate-file'), 'files', { value: [new File(['csv'], 'rates.csv')] });
  window.fetch = jest.fn();
  window.eval(uploadScript);
}
const submit = () => document.getElementById('rate-import-form').dispatchEvent(new Event('submit', { cancelable: true, bubbles: true }));

test('upload submits a file and method with CSRF, blocks duplicate clicks, and prevents stale manual overwrite', async () => {
  importPage();
  window.fetch.mockResolvedValue({ ok: true, json: async () => ({ method: 'EMS', unchanged: true, rows: 42, columns: 5, changes: {}, ignoredColumns: ['a', 'b', 'c', 'd'] }) });
  submit(); submit();
  await tick();
  expect(window.fetch).toHaveBeenCalledTimes(1);
  const [url, options] = window.fetch.mock.calls[0];
  expect(url).toBe('/shipcost/api/import');
  expect(options.headers['X-CSRF-Token']).toBe('token');
  expect(options.body.get('method')).toBe('EMS');
  expect(document.getElementById('rate-import-status').textContent).toContain('no new history version');
  expect(document.getElementById('rate-import-status').textContent).toContain('Ignored 4');
  expect(document.querySelector('[data-rate-save]').disabled).toBe(true);
  expect(document.getElementById('rate-refresh').hidden).toBe(false);
  expect(document.querySelector('#rate-import-form button').disabled).toBe(false);
});

test('failed import remains retryable and does not claim a saved chart', async () => {
  importPage();
  window.fetch.mockResolvedValue({ ok: false, json: async () => ({ error: 'Duplicate weight 500 g.' }) });
  submit();
  await tick();
  expect(document.getElementById('rate-import-status').textContent).toBe('Duplicate weight 500 g.');
  expect(document.getElementById('rate-refresh').hidden).toBe(true);
  expect(document.querySelector('[data-rate-save]').disabled).toBe(false);
  expect(document.querySelector('#rate-import-form button').disabled).toBe(false);
});
