/** @jest-environment jsdom */
const fs = require('fs');
const script = fs.readFileSync(require.resolve('../public/javascripts/ireland_taric_queue.js'), 'utf8');
const settle = async () => { for (let i = 0; i < 12; i += 1) await Promise.resolve(); };
beforeEach(() => {
  jest.useFakeTimers();
  document.body.innerHTML = '<div id="taric-queue-warning" hidden></div><p id="taric-queue-message"></p><button id="taric-queue-clear" disabled></button><p id="taric-queue-notice"></p><input id="taric-csrf" value="session-token">';
});
afterEach(() => { jest.clearAllTimers(); jest.useRealTimers(); });

test('queue warning refreshes, enables only on server approval, and clears with CSRF', async () => {
  const state = { count: 22, waitingMs: 3600000, stalledMs: 60000, canClear: false };
  global.fetch = jest.fn(async (_url, options) => ({ ok: true, json: async () => options.method === 'POST' ? { cleared: 22 } : state }));
  window.eval(script);
  await settle();
  const button = document.getElementById('taric-queue-clear');
  expect(document.getElementById('taric-queue-warning').hidden).toBe(false);
  expect(document.getElementById('taric-queue-message').textContent).toContain('60 minute(s)');
  expect(button.disabled).toBe(true);
  state.stalledMs = 960000;
  state.canClear = true;
  await jest.advanceTimersByTimeAsync(30000);
  expect(button.disabled).toBe(false);
  button.click();
  await settle();
  expect(global.fetch).toHaveBeenCalledWith('/hs/ireland/predictor/queue/clear', expect.objectContaining({
    method: 'POST', body: '{}', headers: expect.objectContaining({ 'X-CSRF-Token': 'session-token' }),
  }));
  expect(document.getElementById('taric-queue-notice').textContent).toContain('Cleared 22');
});
