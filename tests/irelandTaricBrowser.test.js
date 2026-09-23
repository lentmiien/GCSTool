/** @jest-environment jsdom */
const fs = require('fs');
const pug = require('pug');
const template = pug.compileFile('views/hs_ireland_editor.pug');
const predictorScript = fs.readFileSync('public/javascripts/ireland_taric_predictor.js', 'utf8');
const editorScript = fs.readFileSync('public/javascripts/hs_ie_csv_editor.js', 'utf8');
const tick = async () => { for (let i = 0; i < 20; i += 1) await Promise.resolve(); };
const el = id => document.getElementById(id);
const response = data => ({ ok: true, status: 200, json: async () => data, text: async () => JSON.stringify(data) });
let jobs, saved, readers;
function mount(mappings = []) {
  window.Loaded = () => {};
  document.documentElement.innerHTML = template({ taricMappings: mappings, taricCsrfToken: 'SYNTHETIC_CSRF', __: value => value });
  jobs = new Map(); saved = []; readers = [];
  window.alert = jest.fn(); window.saveAs = jest.fn();
  window.FileReader = class { readAsText(file) { this.result = file.text; readers.push(this); this.onload(); } };
  window.fetch = jest.fn(async (path, options = {}) => {
    const body = options.body ? JSON.parse(options.body) : null;
    if (path === '/hs/ireland/predictor/requests') {
      const job = { id: body.id, input: body, state: 'pending', feedback: 'none' };
      jobs.set(body.id, job); return response(job);
    }
    if (path.endsWith('/predictor/selections')) {
      const input = body.request;
      const job = jobs.get(input.id) || { id: input.id, input, state: 'pending', feedback: 'none' };
      jobs.set(input.id, job);
      saved.push({ id: input.id, code: body.selected_code }); job.feedback = 'pending';
      return response(job);
    }
    if (path.includes('/predictor/requests/')) {
      const id = path.split('/')[5];
      const job = jobs.get(id);
      if (path.endsWith('/selection')) { saved.push({ id, code: body.selected_code }); job.feedback = 'pending'; }
      return response(job);
    }
    return response({ status: 'OK', created: 1, updated: 0, saved: 1 });
  });
  window.eval(predictorScript); window.eval(editorScript);
}
function csv(items) {
  return items.map(([name, hs]) => {
    const row = Array(31).fill(''); row[0] = 'SYNTHETIC_ORDER'; row[12] = 'IE'; row[25] = name; row[29] = hs;
    return row.join(',');
  }).join('\r\n');
}
function load(items) {
  Object.defineProperty(el('inputfile'), 'files', { configurable: true, value: [{ name: 'synthetic.csv', text: csv(items) }] });
  el('inputfile').dispatchEvent(new Event('change'));
}
const predictions = () => window.fetch.mock.calls.filter(call => call[0] === '/hs/ireland/predictor/requests');
beforeEach(() => jest.useFakeTimers());
afterEach(() => { jest.clearAllTimers(); jest.useRealTimers(); });
test('initial rendered page/load has zero calls and no private bootstrap', async () => {
  mount(); await tick();
  expect(window.fetch).not.toHaveBeenCalled();
  expect(template({ __: value => value })).toContain('data-color-mode="dark"');
  expect(document.documentElement.innerHTML).not.toMatch(/TARIC_TOOL_KEY|TARIC_TOOL_BASE_URL|ttk_/);
});
test('all exact JAN automatches preserve export and never request prediction', async () => {
  mount([{ mappingType: 'jan', janCode: '00123456', taricCode: '6912002111', uses: 2 }]);
  load([['Toy mug/00123456', '691200']]); await tick();
  expect(predictions()).toHaveLength(0);
  expect(el('review-overlay').classList.contains('d-none')).toBe(true);
  expect(window.saveAs).toHaveBeenCalled();
  const mapping = window.fetch.mock.calls.find(call => call[0].endsWith('/save-mappings'));
  expect(JSON.parse(mapping[1].body).items[0]).toMatchObject({ janCode: '00123456', sourceHsCode: '691200', taricCode: '6912002111' });
});
test.each([['Mug', '691200', 'No JAN'], ['Mug/00123456', '6912002111', 'original input HS'], ['Mug/1234', '691200', 'exactly 8 or 13']])('invalid source skips predictor but allows manual flow: %s', async (name, hs, message) => {
  mount(); load([[name, hs]]); await tick();
  expect(predictions()).toHaveLength(0);
  expect(el('predictor-status').textContent).toContain(message);
  el('review-input').value = '6912002111'; el('review-next-btn').click(); await tick();
  expect(saved).toHaveLength(0);
  expect(window.saveAs).toHaveBeenCalled();
});
test('name+HS automatic choice remains; predictor uses leading-zero JAN and original HS', async () => {
  mount([{ mappingType: 'name_hs', itemNameNormalized: 'mug', sourceHsCode: '6912.00', taricCode: '6912002111', uses: 2 }]);
  load([['Toy mug/00123456', '6912.00']]); await tick();
  expect(predictions()).toHaveLength(1);
  expect(JSON.parse(predictions()[0][1].body)).toMatchObject({ jan: '00123456', descriptive_name: 'Toy mug', input_hs_code: '6912.00', item_id: '0_25' });
  expect(el('review-input').value).toBe('6912002111');
  const job = [...jobs.values()][0];
  job.state = 'terminal'; job.output = { suggestion: { code: '0000000000', description: '<img src=x onerror=alert(1)>' }, adapter: 'test', provenance: 'local_jan' };
  await jest.advanceTimersByTimeAsync(3000);
  expect(el('review-input').value).toBe('6912002111');
  expect(el('predictor-result').querySelector('img')).toBeNull();
  expect(el('predictor-result').textContent).toContain('<img');
  el('predictor-use').click();
  expect(el('review-input').value).toBe('0000000000');
  expect(saved).toHaveLength(0);
  el('review-next-btn').click(); await tick();
  expect(saved).toEqual([{ id: job.id, code: '0000000000' }]);
});
test('Next before prediction, duplicate JAN rows and late output retain exact item association', async () => {
  mount(); load([['Mug/00123456', '691200'], ['Different mug/00123456', '701300']]); await tick();
  const first = [...jobs.values()][0];
  el('review-input').value = '6912002111'; el('review-next-btn').click(); await tick();
  expect(predictions()).toHaveLength(2);
  const second = [...jobs.values()][1];
  expect(second.id).not.toBe(first.id);
  expect(saved).toEqual([{ id: first.id, code: '6912002111' }]);
  first.state = 'terminal'; first.output = { suggestion: { code: '0000000000', description: 'late' } };
  await jest.advanceTimersByTimeAsync(3000);
  expect(el('review-input').value).toBe('701300');
  expect(el('predictor-result').textContent).not.toContain('late');
  el('review-input').value = '7013000000'; el('review-next-btn').click(); await tick();
  expect(saved[1]).toEqual({ id: second.id, code: '7013000000' });
  expect(window.saveAs).toHaveBeenCalled();
});
test('reopening active item reuses request; changed final choice gets a fresh revision', async () => {
  mount(); load([['Mug/00123456', '691200'], ['Spoon', '821599']]); await tick();
  el('review-close-btn').click(); el('review-taric-btn').click(); await tick();
  expect(predictions()).toHaveLength(1);
  el('review-input').value = '6912002111'; el('review-next-btn').click(); await tick();
  el('review-input').value = '8215990000'; el('review-next-btn').click(); await tick();
  el('review-taric-btn').click(); await tick();
  el('review-input').value = '6912002199'; el('review-next-btn').click(); await tick();
  expect(jobs.size).toBe(2);
  const inputs = [...jobs.values()].map(job => job.input);
  expect(inputs[1].revision).toBe(1);
  expect(inputs[1].run_id).toBe(inputs[0].run_id);
  expect(saved.map(x => x.code)).toEqual(['6912002111', '6912002199']);
});
test('new CSV makes new run; close/cancel and invalid codes send no feedback', async () => {
  mount(); load([['Mug/00123456', '691200']]); await tick();
  const first = [...jobs.values()][0];
  el('review-input').value = ''; el('review-next-btn').click();
  el('review-input').value = 'bad'; el('review-next-btn').click();
  el('review-close-btn').click(); await tick();
  expect(saved).toHaveLength(0);
  load([['New mug/00123456', '691200']]); await tick();
  expect([...jobs.values()][1].input.run_id).not.toBe(first.input.run_id);
  first.state = 'terminal'; first.output = { suggestion: { code: '0000000000', description: 'old csv' } };
  await jest.advanceTimersByTimeAsync(3000);
  expect(el('predictor-result').textContent).not.toContain('old csv');
});
test('rejected candidate is labelled and never selectable as a suggestion', async () => {
  mount(); load([['Mug/00123456', '691200']]); await tick();
  const job = [...jobs.values()][0];
  job.state = 'terminal'; job.error = 'CATALOG_REJECTED'; job.output = { rejected: { code: '0000000000', description: '<script>bad</script>' } };
  await jest.advanceTimersByTimeAsync(3000);
  expect(el('predictor-rejected').textContent).toContain('UNVALIDATED / REJECTED');
  expect(el('predictor-rejected').querySelector('script')).toBeNull();
  expect(el('predictor-use').classList.contains('d-none')).toBe(true);
});
test('local network failure cannot block Next, another item or Finish/export', async () => {
  mount();
  const normalFetch = window.fetch.getMockImplementation();
  window.fetch.mockImplementation((path, options) => path.includes('/predictor/') ? Promise.reject(new Error('offline')) : normalFetch(path, options));
  load([['Mug/00123456', '691200'], ['Spoon', '821599']]); await tick();
  el('review-input').value = '6912002111'; el('review-next-btn').click(); await tick();
  await jest.advanceTimersByTimeAsync(2000);
  expect(el('review-item-name').value).toBe('Spoon');
  el('review-input').value = '8215990000'; el('review-next-btn').click(); await tick();
  expect(window.saveAs).toHaveBeenCalled();
  expect(el('taric-feedback-status').textContent).toContain('not yet durably queued');
  await jest.advanceTimersByTimeAsync(4000);
  expect(el('taric-feedback-status').textContent).toContain('Keep this page open');
});
test('two-minute wait ends without new inference; retry checks identical pending ID', async () => {
  mount(); load([['Mug/00123456', '691200']]); await tick();
  await jest.advanceTimersByTimeAsync(123000);
  expect(el('predictor-status').textContent).toContain('Stopped waiting after two minutes');
  expect(predictions()).toHaveLength(1);
  el('predictor-retry').click(); await tick();
  expect(predictions()).toHaveLength(1);
});
test('uncertain initial POST retry preserves the same idempotency association', async () => {
  mount();
  const normal = window.fetch.getMockImplementation();
  let first = true;
  window.fetch.mockImplementation((path, options) => {
    if (path.endsWith('/predictor/requests') && first) { first = false; return Promise.reject(new Error('lost response')); }
    return normal(path, options);
  });
  load([['Mug/00123456', '691200']]); await tick();
  el('predictor-retry').click(); await tick();
  const attempts = predictions().map(call => JSON.parse(call[1].body));
  expect(attempts).toHaveLength(2);
  expect(attempts[0]).toEqual(attempts[1]);
});
test('double click queues only one final choice and does not advance another item', async () => {
  mount(); load([['Mug/00123456', '691200'], ['Spoon/00123457', '821599']]); await tick();
  el('review-input').value = '6912002111';
  el('review-next-btn').click(); el('review-next-btn').click(); await tick();
  expect(saved).toHaveLength(1);
  expect(el('review-item-name').value).toBe('Spoon/00123457');
  expect(el('review-input').value).toBe('821599');
});
test('final choice posts independently while initial registration has not returned', async () => {
  mount(); const normal = window.fetch.getMockImplementation();
  let resolveInitial;
  window.fetch.mockImplementation((path, options) => path.endsWith('/predictor/requests')
    ? new Promise(resolve => { resolveInitial = () => resolve(normal(path, options)); }) : normal(path, options));
  load([['Mug/00123456', '691200']]); await tick();
  const input = JSON.parse(predictions()[0][1].body);
  el('review-input').value = '6912002111'; el('review-next-btn').click(); await tick();
  expect(saved).toEqual([{ id: input.id, code: '6912002111' }]);
  expect(window.saveAs).toHaveBeenCalled();
  load([['Spoon', '821599']]); await tick();
  resolveInitial(); await tick();
  expect(el('predictor-status').textContent).toContain('No JAN');
  expect(el('review-item-name').value).toBe('Spoon');
});
test('new CSV during a slow local queue acknowledgement cannot advance the new review', async () => {
  mount(); const normal = window.fetch.getMockImplementation();
  let resolveSelection;
  window.fetch.mockImplementation((path, options) => path.endsWith('/predictor/selections')
    ? new Promise(resolve => { resolveSelection = () => resolve(normal(path, options)); }) : normal(path, options));
  load([['Mug/00123456', '691200']]); await tick();
  el('review-input').value = '6912002111'; el('review-next-btn').click(); await tick();
  load([['Spoon', '821599']]); await tick();
  resolveSelection(); await tick();
  expect(el('review-item-name').value).toBe('Spoon');
  expect(el('review-overlay').classList.contains('d-none')).toBe(false);
  expect(saved).toHaveLength(1);
});
