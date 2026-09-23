const crypto = require('crypto');
const axios = require('axios');
const { isIP } = require('net');
const ID = /^[a-f0-9]{32}$/;
const CODE = /^[0-9]{10}$/;
const ERROR_CODES = new Set(('ADMISSION_BUSY ADMISSION_UNCERTAIN METADATA_UNAVAILABLE CLEANUP_PENDING BACKEND_RECLAIM_FAILED OWNERSHIP_LOST GATEWAY_UPGRADE_REQUIRED READINESS_UNVERIFIED INFERENCE_UNCERTAIN WARM_SESSION_NOT_READY RECOVERY_REQUIRED UNAUTHORIZED FORBIDDEN RELEASE_CLOSED TOKEN_BUDGET QUEUE_FULL RATE_LIMITED INTERRUPTED CANCELLED STALE PROVIDER_FAILED INVALID_REQUEST INVALID_FEEDBACK NOT_FOUND IDEMPOTENCY_CONFLICT JAN_AMBIGUOUS EVIDENCE_NOT_FOUND IDENTITY_MISMATCH IDENTITY_UNVERIFIABLE EVIDENCE_INVALID EVIDENCE_INCOMPLETE FETCH_DISABLED FETCH_FAILED FETCH_LIMITED EVIDENCE_RACE STORAGE_FAILED PROVIDER_DISABLED CONFIG_NOT_READY INVALID_RESULT CATALOG_REJECTED HTTP_ACCESS_DENIED TLS_CHAIN_UNTRUSTED').split(' '));
function fail(code, status = 400) {
  const error = new Error(code);
  error.safeCode = code;
  error.status = status;
  throw error;
}
function object(value, keys) {
  if (!value || typeof value !== 'object' || Array.isArray(value) || Object.keys(value).some(key => !keys.includes(key))) fail('INVALID_REQUEST');
}
function normalize(value) {
  object(value, ['id', 'run_id', 'item_id', 'revision', 'jan', 'descriptive_name', 'input_hs_code']);
  if (typeof value.id !== 'string' || !ID.test(value.id) || typeof value.run_id !== 'string' || !ID.test(value.run_id) || typeof value.item_id !== 'string'
    || !/^[0-9]+_[0-9]+$/.test(value.item_id) || value.item_id.length > 40
    || !Number.isInteger(value.revision) || value.revision < 0 || value.revision > 20) fail('INVALID_REQUEST');
  if (typeof value.jan !== 'string' || !/^(?:[0-9]{8}|[0-9]{13})$/.test(value.jan)) fail('INVALID_JAN');
  if (typeof value.descriptive_name !== 'string' || !value.descriptive_name.trim()
    || value.descriptive_name.length > 500 || /[\x00-\x1f\x7f]/.test(value.descriptive_name)) fail('INVALID_NAME');
  const hs = typeof value.input_hs_code === 'string' ? value.input_hs_code.replace(/[.\s]/g, '') : '';
  if (!/^[0-9]{6}$/.test(hs)) fail('INVALID_HS');
  return { id: value.id, run_id: value.run_id, item_id: value.item_id, revision: value.revision,
    jan: value.jan, descriptive_name: value.descriptive_name.trim(), input_hs_code: hs };
}
const digest = value => crypto.createHash('sha256').update(JSON.stringify(value)).digest('hex');
function configuration(env = process.env) {
  try {
    const base = new URL(env.TARIC_TOOL_BASE_URL);
    const privateHttp = base.protocol === 'http:' && isIP(base.hostname) === 4 && /^(127\.|10\.|192\.168\.|172\.(1[6-9]|2[0-9]|3[01])\.)/.test(base.hostname);
    if ((!privateHttp && base.protocol !== 'https:') || base.username || base.password || base.search || base.hash
      || !['/', '/api/taric/v1', '/api/taric/v1/'].includes(base.pathname)
      || !/^ttk_[A-Za-z0-9_-]{43}$/.test(env.TARIC_TOOL_KEY || '')) throw new Error();
    return { origin: base.origin, key: env.TARIC_TOOL_KEY };
  } catch (_) { fail('CONFIG_NOT_READY', 503); }
}
const boundedText = (value, max) => typeof value === 'string' ? value.slice(0, max) : '';
function project(body) {
  if (!body || typeof body.id !== 'string' || !ID.test(body.id) || !['queued', 'running', 'complete', 'failed', 'interrupted'].includes(body.state)
    || body.test !== true) fail('INVALID_RESPONSE', 502);
  const result = body.result;
  const suggestion = body.state === 'complete' && result && typeof result.taric_code === 'string' && CODE.test(result.taric_code)
    && typeof result.description === 'string' && result.description.length > 0 && result.description.length <= 255
    && result.description_source === 'model_generated' && result.verification === 'unverified'
    && result.training_approved === false
    ? { code: result.taric_code, description: result.description } : null;
  // Never forward envelopes, visibleText (which can contain malformed provider output), tools or facts.
  const proposal = body.diagnostics && body.diagnostics.proposal;
  const rejected = !suggestion && proposal && typeof proposal.taric_code === 'string' && CODE.test(proposal.taric_code)
    ? { label: 'UNVALIDATED / REJECTED', code: proposal.taric_code, description: boundedText(proposal.description, 255) } : null;
  const resolution = body.evidence && body.evidence.provenance && body.evidence.provenance.resolution;
  return { requestId: body.id, state: body.state, suggestion, rejected,
    error: ERROR_CODES.has(body.error) ? body.error : ['complete', 'failed', 'interrupted'].includes(body.state) && !suggestion ? 'INVALID_RESULT' : null,
    adapter: /^[A-Za-z0-9_.-]{1,100}$/.test(body.adapter || '') ? body.adapter : '',
    provenance: ['local_jan', 'local_item_code', 'online_item_code'].includes(resolution) ? resolution : null };
}
function retryAfter(value, now = Date.now()) {
  const seconds = /^\d+$/.test(String(value)) ? Number(value) : (Date.parse(value) - now) / 1000;
  return Number.isFinite(seconds) ? Math.max(2, seconds) * 1000 : 0;
}
function createTransport(config = () => configuration(), http = axios) {
  let settings;
  return async (action, job) => {
    // Normalize the fixed operator configuration once per worker, never from a request.
    const { origin, key } = settings || (settings = config());
    if (!ID.test(job.id) || (action !== 'submit' && !ID.test(job.upstreamId || ''))) fail('INVALID_REQUEST');
    const suffix = action === 'submit' ? '' : `/${job.upstreamId}${action === 'feedback' ? '/feedback' : ''}`;
    if (!['submit', 'poll', 'feedback'].includes(action)) fail('INVALID_REQUEST');
    const input = job.input;
    const body = action === 'submit' ? { jan: input.jan, descriptive_name: input.descriptive_name,
      input_hs_code: input.input_hs_code, test: true } : action === 'feedback' ? { selected_code: job.selectedCode } : undefined;
    const controller = new AbortController();
    const deadline = setTimeout(() => controller.abort(), 15000);
    try {
      const response = await http.request({ url: `${origin}/api/taric/v1/requests${suffix}`,
        method: action === 'poll' ? 'GET' : 'POST', data: body,
        headers: { Authorization: `Bearer ${key}`, ...(body ? { 'Content-Type': 'application/json',
          'Idempotency-Key': digest(`${action}:${job.id}`) } : {}) },
        signal: controller.signal, timeout: 15000, maxRedirects: 0, maxContentLength: 131072, maxBodyLength: 4096,
        proxy: false, validateStatus: () => true });
      return { status: response.status, data: response.data,
        retryMs: retryAfter(response.headers['retry-after']) };
    } catch (_) { return { status: 502, data: { error: 'TRANSPORT_FAILED' }, retryMs: 0 }; }
    finally { clearTimeout(deadline); }
  };
}
module.exports = { ID, CODE, ERROR_CODES, fail, object, normalize, digest, configuration, project, retryAfter, createTransport };
