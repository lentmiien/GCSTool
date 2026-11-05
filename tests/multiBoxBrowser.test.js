/** @jest-environment jsdom */
const fs = require('fs');
const pug = require('pug');
const { input, jobId, catalog, queued, completed, rigid } = require('./fixtures/multiBox');
const template = pug.compileFile('views/multibox.pug');
const scripts = ['smallest-box-data', 'multi-box-data', 'multi-box'].map((name) => fs.readFileSync(`public/javascripts/${name}.js`, 'utf8'));
const el = (id) => document.getElementById(`mb-${id}`);
const tick = async () => { for (let i = 0; i < 30; i++) await Promise.resolve(); };
const response = (data, status = 200, retry = null) => ({ ok: status < 300, status, headers: { get: () => retry }, json: async () => data });
let previews;
let preview;
beforeEach(async () => {
  jest.useFakeTimers();
  sessionStorage.clear();
  window.Loaded = () => {};
  document.documentElement.innerHTML = template();
  preview = { reset: jest.fn() };
  previews = { dispose: jest.fn(), add: jest.fn(() => preview) };
  window.createMultiBoxPreviews = jest.fn(() => previews);
  window.fetch = jest.fn().mockResolvedValueOnce(response(catalog));
  scripts.forEach((script) => window.eval(script));
  await tick();
});
afterEach(() => { jest.clearAllTimers(); jest.useRealTimers(); });
function submit() {
  el('form').dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
}

test('polls every five seconds, blocks duplicates, then renders a preview and details for every box', async () => {
  expect(el('generate').disabled).toBe(false);
  expect(el('catalog').textContent).toContain('30 × 20 × 25 cm');
  el('items').value = input;
  window.fetch.mockResolvedValueOnce(response(queued, 202, '5'));
  submit(); submit();
  await tick();
  expect(window.fetch).toHaveBeenCalledTimes(2);
  expect(el('inputs').disabled).toBe(true);
  expect(el('status').textContent).toContain('Queued');
  expect(sessionStorage.getItem('multi-box-job')).toBe(jobId);
  jest.advanceTimersByTime(4999);
  await tick();
  expect(window.fetch).toHaveBeenCalledTimes(2);
  window.fetch.mockResolvedValueOnce(response({ ...queued, status: 'running', progress: { phase: 'packing', done: 1, total: 2, boxes: 1 } }));
  jest.advanceTimersByTime(1);
  await tick();
  expect(el('status').textContent).toContain('1/2');
  window.fetch.mockResolvedValueOnce(response(completed));
  jest.advanceTimersByTime(5000);
  await tick();
  expect(el('result').hidden).toBe(false);
  expect(el('boxes').children).toHaveLength(2);
  expect(el('boxes').textContent).toContain('0.39 kg');
  expect(el('boxes').textContent).toContain('23.5 × 0.9 × 15.4 cm');
  expect(el('boxes').textContent).toContain('Center (X, Y, Z): 12.75, 1.45, 8.7 cm');
  expect(previews.add).toHaveBeenCalledTimes(2);
  expect(el('unplaced').hidden).toBe(true);
  expect(el('inputs').disabled).toBe(false);
  el('boxes').querySelector('button').click();
  expect(preview.reset).toHaveBeenCalled();
  jest.advanceTimersByTime(10000);
  expect(window.fetch).toHaveBeenCalledTimes(4);
});

test('sends CSV, mm options and selected catalog IDs for server-side conversion', async () => {
  el('format').value = 'csv';
  el('format').dispatchEvent(new Event('change'));
  expect(el('csv-help').hidden).toBe(false);
  el('items').value = 'id,width,height,depth,soft,shrink\nSweater,280,60,220,true,20';
  el('margin').value = '15';
  el('maxSide').value = '600';
  el('all-boxes').checked = false;
  el('all-boxes').dispatchEvent(new Event('change'));
  el('catalog').querySelector('input').checked = true;
  window.fetch.mockResolvedValueOnce(response(completed, 202));
  submit();
  await tick();
  expect(JSON.parse(window.fetch.mock.calls[1][1].body)).toEqual({
    provideitems: el('items').value, format: 'csv', options: { approach: 'boxes', margin: 15, maxSide: 600, maxSum: null, maxWeight: null, maxValue: null }, boxIds: ['Box S'],
  });
});

test('retains partial plans, soft item details and weight warnings without inventing placements', async () => {
  const job = JSON.parse(JSON.stringify(completed));
  job.result.boxes[0].items.push({ id: 'Sweater', soft: true, shrink: 20, weight: 0.3 });
  job.result.boxes[0].weightEstimate.exceedsMaxLoadWeight = true;
  job.result.unplaced = [{ id: 'Oversize', reason: 'No eligible box' }];
  el('items').value = input;
  window.fetch.mockResolvedValueOnce(response(job, 202));
  submit();
  await tick();
  expect(el('unplaced').hidden).toBe(false);
  expect(el('unplaced').textContent).toContain('Oversize — No eligible box');
  expect(el('status').textContent).toContain('partial plan');
  expect(el('boxes').textContent).toContain('Soft item — no fixed 3D position');
  expect(el('boxes').textContent).toContain('exceed this box’s maximum load');
  expect(el('boxes').children).toHaveLength(2);
});

test('handles all-unplaced and failed jobs without claiming a complete shipment', async () => {
  el('items').value = input;
  window.fetch.mockResolvedValueOnce(response({ ...completed, result: { boxes: [], unplaced: [{ id: 'Oversize' }] } }, 202));
  submit();
  await tick();
  expect(el('boxes').children).toHaveLength(0);
  expect(el('unplaced').hidden).toBe(false);
  expect(el('summary').textContent).toContain('0 boxes · 0 packed items');
  window.fetch.mockResolvedValueOnce(response({ ...queued, status: 'failed', error: { message: 'Packing failed.' } }, 202));
  submit();
  await tick();
  expect(el('status').textContent).toBe('Packing failed.');
  expect(el('result').hidden).toBe(true);
  expect(el('generate').disabled).toBe(false);
});

test('poll failures offer checking the same job and never resubmit', async () => {
  el('items').value = input;
  window.fetch.mockResolvedValueOnce(response(queued, 202));
  submit();
  await tick();
  window.fetch.mockRejectedValueOnce(new TypeError('offline'));
  jest.advanceTimersByTime(5000);
  await tick();
  expect(el('resume').hidden).toBe(false);
  expect(el('status').textContent).toContain('No new job');
  window.fetch.mockResolvedValueOnce(response(completed));
  el('resume').click();
  await tick();
  expect(window.fetch.mock.calls[3][0]).toBe(`/multi-box/jobs/${jobId}`);
  expect(window.fetch.mock.calls.filter(([, options]) => options.method === 'POST')).toHaveLength(1);
  expect(el('resume').hidden).toBe(true);
});

test('honors Retry-After and does not retry submissions', async () => {
  el('items').value = input;
  window.fetch.mockResolvedValueOnce(response({ message: 'Rate limit' }, 429, '17'));
  submit();
  await tick();
  expect(el('generate').disabled).toBe(true);
  expect(el('generate').textContent).toBe('Try again in 17s');
  jest.advanceTimersByTime(17000);
  await tick();
  expect(el('generate').disabled).toBe(false);
  expect(window.fetch).toHaveBeenCalledTimes(2);
});

test('clears old previews and renders untrusted labels as text with a WebGL fallback', async () => {
  el('items').value = input;
  window.fetch.mockResolvedValueOnce(response(completed, 202));
  submit();
  await tick();
  const hostile = { ...completed, result: { ...completed.result, boxes: [{ ...completed.result.boxes[0], items: [{ ...rigid, id: '<img src=x onerror=alert(1)>' }] }], unplaced: [{ id: '<script>bad</script>' }] } };
  window.createMultiBoxPreviews.mockImplementationOnce(() => { throw new Error('WebGL disabled'); });
  window.fetch.mockResolvedValueOnce(response(hostile, 202));
  submit();
  await tick();
  expect(previews.dispose).toHaveBeenCalled();
  expect(el('boxes').textContent).toContain('Enable WebGL');
  expect(el('boxes').textContent).toContain('<img src=x onerror=alert(1)>');
  expect(el('boxes').querySelector('img')).toBeNull();
  expect(el('unplaced').querySelector('script')).toBeNull();
});

test('rejects malformed inputs and an empty box selection before submission', async () => {
  el('items').value = 'bad';
  submit();
  await tick();
  expect(window.fetch).toHaveBeenCalledTimes(1);
  el('items').value = input;
  el('all-boxes').checked = false;
  submit();
  await tick();
  expect(el('status').textContent).toContain('Select 1–50');
  expect(window.fetch).toHaveBeenCalledTimes(1);
});

test('restores the latest job after reload without resubmitting or replacing its status with catalog readiness', async () => {
  sessionStorage.setItem('multi-box-job', jobId);
  document.documentElement.innerHTML = template();
  window.fetch.mockReset();
  window.fetch.mockResolvedValueOnce(response({ ...queued, status: 'failed', error: { message: 'Packing failed.' } }))
    .mockResolvedValueOnce(response(catalog));
  scripts.forEach((script) => window.eval(script));
  await tick();
  expect(window.fetch.mock.calls[0][0]).toBe(`/multi-box/jobs/${jobId}`);
  expect(window.fetch.mock.calls.some(([, options]) => options.method === 'POST')).toBe(false);
  expect(el('status').textContent).toBe('Packing failed.');
  expect(el('generate').disabled).toBe(false);
});
