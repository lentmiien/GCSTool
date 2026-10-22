/** @jest-environment jsdom */
const fs = require('fs');
const pug = require('pug');
const { catalog, result, input } = require('./fixtures/smallestBox');
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
