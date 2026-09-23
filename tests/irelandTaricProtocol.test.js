const { normalize, configuration, project, createTransport, retryAfter } = require('../services/irelandTaricProtocol');
const input = { id: '1'.repeat(32), run_id: '2'.repeat(32), item_id: '0_25', revision: 0,
  jan: '00123456', descriptive_name: 'SYNTHETIC mug', input_hs_code: '6912.00' };
const terminal = { id: 'a'.repeat(32), state: 'complete', test: true,
  result: { taric_code: '6912002111', description: '<img src=x onerror=alert(1)>', description_source: 'model_generated', verification: 'unverified', training_approved: false } };
test('preserves JAN strings and normalizes only six-digit HS; rejects unsafe overrides', () => {
  expect(normalize(input)).toMatchObject({ jan: '00123456', input_hs_code: '691200' });
  expect(normalize({ ...input, jan: '0012345678901', input_hs_code: '69 12.00' }).jan).toBe('0012345678901');
  for (const hs of ['69120021', '6912002111', '', '６９１２００', '6912x00']) expect(() => normalize({ ...input, input_hs_code: hs })).toThrow('INVALID_HS');
  for (const jan of ['', '123', 12345678]) expect(() => normalize({ ...input, jan })).toThrow('INVALID_JAN');
  expect(() => normalize({ ...input, descriptive_name: '' })).toThrow('INVALID_NAME');
  for (const field of ['test', 'item_code', 'url', 'model']) expect(() => normalize({ ...input, [field]: false })).toThrow('INVALID_REQUEST');
});
test('static HTTPS origin only, safe configuration errors', () => {
  const key = `ttk_${'x'.repeat(43)}`;
  expect(configuration({ TARIC_TOOL_KEY: key, TARIC_TOOL_BASE_URL: 'https://example.invalid/api/taric/v1' }).origin).toBe('https://example.invalid');
  for (const url of ['http://example.invalid', 'https://user:pass@example.invalid', 'https://example.invalid/path', 'https://example.invalid/?url=x']) {
    expect(() => configuration({ TARIC_TOOL_KEY: key, TARIC_TOOL_BASE_URL: url })).toThrow('CONFIG_NOT_READY');
  }
  expect(() => configuration({})).toThrow('CONFIG_NOT_READY');
});
test('projects only shipped suggestion and bounded rejected proposal', () => {
  const projected = project({ ...terminal, poll_url: 'http://evil.invalid', raw_content: 'SECRET', reasoning: 'HIDDEN' });
  expect(projected.suggestion.code).toBe('6912002111');
  expect(JSON.stringify(projected)).not.toMatch(/SECRET|HIDDEN|evil/);
  expect(project({ ...terminal, state: 'failed', result: null, error: 'CATALOG_REJECTED', diagnostics: {
    visibleText: 'PRIVATE ENVELOPE', proposal: { taric_code: '0000000000', description: 'x'.repeat(999) } } }).rejected.description).toHaveLength(255);
  expect(project({ ...terminal, state: 'failed', result: null, error: 'JAN_AMBIGUOUS' }).error).toBe('JAN_AMBIGUOUS');
  expect(() => project({ ...terminal, test: false })).toThrow('INVALID_RESPONSE');
});
test('transport forces test, fixes paths, bounds responses, and uses distinct stable keys', async () => {
  const http = { request: jest.fn(async () => ({ status: 202, data: terminal, headers: { 'retry-after': '9999' } })) };
  const transport = createTransport(() => ({ origin: 'https://example.invalid', key: 'SYNTHETIC' }), http);
  const job = { id: input.id, input: { ...input, test: false, item_code: 'BAD' }, upstreamId: terminal.id, selectedCode: '0000000000' };
  await transport('submit', job); await transport('submit', job); await transport('poll', job); await transport('feedback', job);
  const calls = http.request.mock.calls.map(call => call[0]);
  expect(calls[0].data).toEqual({ jan: input.jan, descriptive_name: input.descriptive_name, input_hs_code: input.input_hs_code, test: true });
  expect(calls[0].headers['Idempotency-Key']).toBe(calls[1].headers['Idempotency-Key']);
  expect(calls[3].headers['Idempotency-Key']).not.toBe(calls[0].headers['Idempotency-Key']);
  expect(calls[3].data).toEqual({ selected_code: '0000000000' });
  expect(calls[2].url).toBe(`https://example.invalid/api/taric/v1/requests/${terminal.id}`);
  expect(calls[0]).toMatchObject({ maxRedirects: 0, timeout: 15000, maxContentLength: 131072, proxy: false });
  await expect(transport('poll', { ...job, upstreamId: '../../evil' })).rejects.toThrow('INVALID_REQUEST');
  expect(retryAfter('9999')).toBe(9999000);
  http.request.mockRejectedValue(new Error('SECRET'));
  expect(JSON.stringify(await transport('poll', job))).not.toContain('SECRET');
});
test.each(['EVIDENCE_NOT_FOUND', 'JAN_AMBIGUOUS', 'FETCH_FAILED', 'ADMISSION_BUSY', 'RECOVERY_REQUIRED', 'CATALOG_REJECTED', 'RATE_LIMITED'])('terminal %s retains a feedback-eligible ID', error => {
  expect(project({ ...terminal, state: 'failed', result: null, error })).toMatchObject({ requestId: terminal.id, error, suggestion: null });
});
