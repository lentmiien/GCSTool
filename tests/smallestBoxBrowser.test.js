/** @jest-environment jsdom */
const fs = require('fs');
const pug = require('pug');
const { catalog, result, resultV2, input } = require('./fixtures/smallestBox');
const template = pug.compileFile('views/smallestbox.pug');
const dataScript = fs.readFileSync('public/javascripts/smallest-box-data.js', 'utf8');
const script = fs.readFileSync('public/javascripts/smallest-box.js', 'utf8');
const el = (id) => document.getElementById(`sb-${id}`);
const tick = async () => { for (let i = 0; i < 20; i++) await Promise.resolve(); };
const response = (data, status = 200, retry) => ({ ok: status === 200, status, headers: { get: () => retry }, json: async () => data });
let preview;
beforeEach(async () => {
  window.Loaded = () => {};
  document.documentElement.innerHTML = template();
  preview = { dispose: jest.fn(), updateLayer: jest.fn(), reset: jest.fn() };
  window.createSmallestBoxPreview = jest.fn(() => preview);
  window.fetch = jest.fn().mockResolvedValueOnce(response(catalog));
  window.eval(dataScript);
  window.eval(script);
  await tick();
});
function submit() {
  el('form').dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
}

test('loads tags, sends selected filters, shows rotated placements, and navigates bottom-height layers', async () => {
  expect(el('generate').disabled).toBe(false);
  expect(el('tags').querySelectorAll('select')).toHaveLength(2);
  el('tag-0').value = 'require';
  el('tag-1').value = 'requireNot';
  el('items').value = input;
  window.fetch.mockResolvedValueOnce(response(result));
  submit();
  expect(el('generate').disabled).toBe(true);
  await tick();
  expect(JSON.parse(window.fetch.mock.calls[1][1].body).tagFilter).toEqual({ require: ['fold-box'], requireNot: ['tube'] });
  expect(el('result').hidden).toBe(false);
  expect(el('metrics').textContent).toContain('0.8 kg');
  expect(el('metrics').textContent).toContain('Items + box (excl. cushion)');
  expect(el('solutions-panel').hidden).toBe(true);
  expect(el('layers').children).toHaveLength(2);
  expect(el('layers').textContent).toContain('80 × 50 × 100 mm');
  expect(el('down').disabled).toBe(true);
  el('up').click();
  expect(preview.updateLayer).toHaveBeenLastCalledWith(50, false);
  expect(el('up').disabled).toBe(true);
  el('show-above').checked = true;
  el('show-above').dispatchEvent(new Event('change'));
  expect(preview.updateLayer).toHaveBeenLastCalledWith(50, true);
  el('down').click();
  expect(preview.updateLayer).toHaveBeenLastCalledWith(0, true);
});

test('defaults to 10 mm and switches all solution details without new requests or adding another margin', async () => {
  expect(el('safety-margin').value).toBe('10');
  el('items').value = input;
  window.fetch.mockResolvedValueOnce(response(resultV2));
  submit();
  await tick();
  expect(JSON.parse(window.fetch.mock.calls[1][1].body).safetyMarginMm).toBe(10);
  expect(el('solutions-panel').hidden).toBe(false);
  expect(el('solution').options).toHaveLength(3);
  expect(el('solution').value).toBe('0');
  expect(el('box-name').textContent).toBe('Box S');
  expect(el('metrics').textContent).toContain('0.827 kg');
  expect(el('metrics').textContent).toContain('0.027 kg');
  expect(el('metrics').textContent).toContain('Estimated shipment weight');
  expect(el('margin-details').textContent).toContain('200 × 150 × 100 mm');
  expect(window.createSmallestBoxPreview.mock.calls[0][1]).toEqual(resultV2.container);
  expect(window.createSmallestBoxPreview.mock.calls[0][2]).toEqual(resultV2.data.pallets[0].placements);
  expect(preview.updateLayer).toHaveBeenLastCalledWith(10, false);
  el('up').click();
  expect(preview.updateLayer).toHaveBeenLastCalledWith(60, false);
  // Editing the form must not alter the saved result's items, weights, or colors.
  el('items').value = 'changed 99kg 1×1×1\n1';
  for (const index of [1, 2, 0]) {
    el('solution').value = String(index);
    el('solution').dispatchEvent(new Event('change'));
    const expected = [resultV2, ...resultV2.alternatives][index];
    expect(el('box-name').textContent).toBe(expected.container.id);
    expect(el('metrics').textContent).toContain(`${Number(expected.estimatedShipmentWeight.toFixed(3))} kg`);
    expect(el('metrics').textContent).toContain('0.7 kg');
    expect(window.createSmallestBoxPreview).toHaveBeenLastCalledWith(el('preview'), expected.container, expected.data.pallets[0].placements, expect.any(Map));
    expect(preview.updateLayer).toHaveBeenLastCalledWith(10, false);
    expect(el('layers').children).toHaveLength(index === 2 ? 1 : 2);
    expect(el('down').disabled).toBe(true);
    expect(el('up').disabled).toBe(index === 2);
  }
  expect(preview.dispose).toHaveBeenCalledTimes(3);
  expect(window.fetch).toHaveBeenCalledTimes(2);
});

test('accepts zero and decimal margins and clears choices on a new no-fit search', async () => {
  el('items').value = input;
  el('safety-margin').value = '0';
  window.fetch.mockResolvedValueOnce(response(resultV2));
  submit();
  await tick();
  expect(JSON.parse(window.fetch.mock.calls[1][1].body).safetyMarginMm).toBe(0);
  el('safety-margin').value = '2.5';
  window.fetch.mockResolvedValueOnce(response({ success: false, alternatives: [], message: 'No fit' }));
  submit();
  expect(el('solution').options).toHaveLength(0);
  expect(el('result').hidden).toBe(true);
  await tick();
  expect(JSON.parse(window.fetch.mock.calls[2][1].body).safetyMarginMm).toBe(2.5);
  expect(el('solutions-panel').hidden).toBe(true);
});

test.each(['', '-1', '500001'])('rejects invalid safety margin %j without a search', async (value) => {
  el('items').value = input;
  el('safety-margin').value = value;
  submit();
  await tick();
  expect(el('status').textContent).toContain('Safety margin');
  expect(window.fetch).toHaveBeenCalledTimes(1);
});

test('keeps the incomplete-alternatives note when switching and displays zero weight estimates', async () => {
  const partial = JSON.parse(JSON.stringify(resultV2));
  partial.meta.alternativesSearchComplete = false;
  partial.alternatives[0].estimatedCushionWeight = 0;
  partial.alternatives[0].estimatedShipmentWeight = 0;
  el('items').value = input;
  window.fetch.mockResolvedValueOnce(response(partial));
  submit();
  await tick();
  expect(el('alternatives-note').hidden).toBe(false);
  el('solution').value = '1';
  el('solution').dispatchEvent(new Event('change'));
  expect(el('alternatives-note').hidden).toBe(false);
  expect(el('metrics').children[0].textContent).toBe('0 kgEstimated shipment weight');
  expect(el('metrics').children[1].textContent).toBe('0 kgEstimated cushion weight');
});

test('clears stale results immediately and prevents parallel searches', async () => {
  el('items').value = input;
  window.fetch.mockResolvedValueOnce(response(result));
  submit();
  await tick();
  let finish;
  window.fetch.mockImplementationOnce(() => new Promise((resolve) => { finish = resolve; }));
  submit();
  expect(el('result').hidden).toBe(true);
  expect(preview.dispose).toHaveBeenCalled();
  submit();
  expect(window.fetch).toHaveBeenCalledTimes(3);
  finish(response({ success: false, message: 'No fit' }));
  await tick();
  expect(el('status').textContent).toContain('Try another algorithm');
  expect(el('result').hidden).toBe(true);
});

test('renders untrusted item IDs as text and retains the list when WebGL is unavailable', async () => {
  const hostile = JSON.parse(JSON.stringify(result));
  hostile.data.pallets[0].placements.forEach((p) => { if (p.itemId === 'widget') p.itemId = '<img/src=x>'; });
  el('items').value = input.replace('widget', '<img/src=x>');
  window.createSmallestBoxPreview.mockImplementationOnce(() => { throw new Error('No WebGL'); });
  window.fetch.mockResolvedValueOnce(response(hostile));
  submit();
  await tick();
  expect(el('layers').querySelector('img')).toBeNull();
  expect(el('layers').textContent).toContain('<img/src=x>');
  expect(el('preview').textContent).toContain('Enable WebGL');
  expect(el('result').hidden).toBe(false);
});

test('honors Retry-After without automatically retrying', async () => {
  jest.useFakeTimers();
  el('items').value = input;
  window.fetch.mockResolvedValueOnce(response({ message: 'Slow down' }, 429, '17'));
  submit();
  await tick();
  expect(el('generate').disabled).toBe(true);
  expect(el('generate').textContent).toBe('Try again in 17s');
  jest.advanceTimersByTime(17000);
  expect(el('generate').disabled).toBe(false);
  expect(window.fetch).toHaveBeenCalledTimes(2);
  jest.useRealTimers();
});

test('a failed catalog refresh clears the old solution and disables generation', async () => {
  el('items').value = input;
  window.fetch.mockResolvedValueOnce(response(result));
  submit();
  await tick();
  window.fetch.mockRejectedValueOnce(new Error('offline'));
  el('refresh').click();
  await tick();
  expect(el('result').hidden).toBe(true);
  expect(el('generate').disabled).toBe(true);
  expect(el('status').textContent).toContain('connection');
});
