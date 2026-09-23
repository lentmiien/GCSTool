const http = require('http');
const { createTransport } = require('../services/irelandTaricProtocol');
const job = { id: '1'.repeat(32), upstreamId: '2'.repeat(32) };
let server, origin, handler;
beforeAll(async () => {
  server = http.createServer((req, res) => handler(req, res));
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  origin = `http://127.0.0.1:${server.address().port}`;
});
afterAll(async () => { await new Promise(resolve => server.close(resolve)); });
test('real transport refuses redirects instead of following an untrusted Location', async () => {
  let calls = 0;
  handler = (req, res) => { calls += 1; res.writeHead(302, { Location: `${origin}/must-not-fetch` }); res.end(); };
  expect((await createTransport(() => ({ origin, key: 'SYNTHETIC_ONLY' }))('poll', job)).status).toBe(302);
  expect(calls).toBe(1);
});
test('real transport bounds response bodies and omits raw error data', async () => {
  handler = (req, res) => { res.writeHead(200); res.end('PRIVATE'.repeat(30000)); };
  const result = await createTransport(() => ({ origin, key: 'SYNTHETIC_ONLY' }))('poll', job);
  expect(result).toMatchObject({ status: 502, data: { error: 'TRANSPORT_FAILED' } });
  expect(JSON.stringify(result)).not.toContain('PRIVATE');
});
test('absolute deadline aborts a transport even if it never times out itself', async () => {
  jest.useFakeTimers();
  try {
    const transport = createTransport(() => ({ origin, key: 'SYNTHETIC_ONLY' }), {
      request: options => new Promise((resolve, reject) => {
        options.signal.addEventListener('abort', () => reject(new Error('PRIVATE_HEADERS')));
      }),
    });
    const pending = transport('poll', job);
    await jest.advanceTimersByTimeAsync(15000);
    expect(await pending).toMatchObject({ status: 502, data: { error: 'TRANSPORT_FAILED' } });
  } finally { jest.useRealTimers(); }
});
