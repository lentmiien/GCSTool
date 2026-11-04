/** @jest-environment jsdom */
const fs = require('fs');
const script = fs.readFileSync('public/javascripts/country-manager.js', 'utf8');
const flush = () => new Promise(resolve => setTimeout(resolve, 0));
let form;
beforeEach(() => {
  document.body.innerHTML = `<div id="country-manager" data-csrf="test-token"><div id="cm-status"></div>
    <form class="cm-edit" action="/country/api/internal/save"><input name="action" value="save"><input name="revision" value="1"><input name="countryCode" value="001"><button>Save</button></form>
    <details id="source-mappings"><summary>Mappings</summary></details></div>`;
  form = document.querySelector('form');
  window.fetch = jest.fn();
  window.confirm = jest.fn(() => true);
  Element.prototype.scrollIntoView = jest.fn();
  window.eval(script);
});

test('submits exact form codes with CSRF and updates revision after a no-op save', async () => {
  window.fetch.mockResolvedValue({ ok: true, json: async () => ({ changed: 0, revision: 4 }) });
  form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
  await flush();
  const [, options] = window.fetch.mock.calls[0];
  expect(window.fetch.mock.calls[0][0]).toBe('/country/api/internal/save');
  expect(options.headers['X-CSRF-Token']).toBe('test-token');
  expect(options.body.get('countryCode')).toBe('001');
  expect(form.elements.revision.value).toBe('4');
  expect(document.getElementById('cm-status').textContent).toBe('No changes to save.');
  expect(form.querySelector('button').disabled).toBe(false);
});

test('failed stale save preserves form values and exposes retry instructions safely', async () => {
  window.fetch.mockResolvedValue({ ok: false, json: async () => ({ error: 'The data changed. Reload <script>.' }) });
  form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
  await flush();
  expect(form.elements.countryCode.value).toBe('001');
  expect(document.querySelector('#cm-status script')).toBe(null);
  expect(document.getElementById('cm-status').textContent).toContain('Reload');
  expect(form.querySelector('button').disabled).toBe(false);
});

test('replacement and removal confirmations can cancel without writing', () => {
  form.dataset.confirm = 'Replace the list?';
  window.confirm.mockReturnValue(false);
  form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
  expect(window.fetch).not.toHaveBeenCalled();
});

test('prevents duplicate in-flight saves', async () => {
  let complete;
  window.fetch.mockReturnValue(new Promise(resolve => { complete = resolve; }));
  form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
  form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
  expect(window.fetch).toHaveBeenCalledTimes(1);
  complete({ ok: true, json: async () => ({ changed: 0, revision: 1 }) });
  await flush();
});
