const axios = require('axios');
const { APP_SETTING_KEYS } = require('./appSettings');
const { PackingError } = require('./smallestBox');
const { parseItems } = require('../public/javascripts/multi-box-data');
const jobIdPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function buildRequest(body = {}) {
  let items;
  try { items = parseItems(body.provideitems, body.format); }
  catch (error) { throw new PackingError(error.message); }
  const source = body.options === undefined ? {} : body.options;
  if (!source || typeof source !== 'object' || Array.isArray(source)) throw new PackingError('Invalid packing options.');
  const options = { approach: source.approach === undefined ? 'boxes' : source.approach };
  if (!['boxes', 'space'].includes(options.approach)) throw new PackingError('Choose boxes or space as the packing approach.');
  // All length inputs are mm; only the upstream payload and results use cm.
  const ranges = { margin: [0, 100000, 10], maxSide: [0.1, 1e13, 10], maxSum: [0.1, 1e13, 10], maxWeight: [0, 1e12, 1], maxValue: [0, 1e12, 1] };
  for (const [key, [min, max, divisor]] of Object.entries(ranges)) {
    const value = source[key] === undefined ? (key === 'margin' ? 10 : null) : source[key];
    if (value === null && key !== 'margin') { options[key] = null; continue; }
    if (!Number.isFinite(value) || value < min || value > max) throw new PackingError(`${key} must be a number from ${min} to ${max}.`);
    options[key] = value / divisor;
  }
  const payload = { items, options };
  if (body.boxIds !== undefined) {
    if (!Array.isArray(body.boxIds) || !body.boxIds.length || body.boxIds.length > 50
      || new Set(body.boxIds).size !== body.boxIds.length
      || body.boxIds.some((id) => typeof id !== 'string' || !id.trim() || id.length > 120)) {
      throw new PackingError('Select 1–50 unique box IDs, or use all eligible boxes.');
    }
    payload.boxIds = body.boxIds;
  }
  if (Buffer.byteLength(JSON.stringify(payload)) > 256 * 1024) throw new PackingError('The packing request exceeds 256 KiB.', 413);
  return payload;
}

async function callApi(AppSetting, path, payload) {
  const setting = await AppSetting.findOne({ where: { key: APP_SETTING_KEYS.SMALLEST_BOX_API_KEY } });
  const apiKey = setting && setting.value.trim();
  if (!apiKey) throw new PackingError('An administrator must configure SMALLEST_BOX_API_KEY in App settings before using this tool.', 503);
  let response;
  try {
    response = await axios({
      method: payload ? 'POST' : 'GET',
      url: `https://my.lentmiien.com/api/binpacking-multi${path}`,
      headers: { Authorization: `Bearer ${apiKey}`, Accept: 'application/json' },
      ...(payload ? { data: payload } : {}),
      timeout: 30000,
      maxRedirects: 0,
      maxContentLength: 8 * 1024 * 1024,
      validateStatus: () => true,
    });
  } catch (_error) {
    // Never expose Axios errors: they contain the shared Authorization header.
    throw new PackingError(payload
      ? 'The submission could not be confirmed. It may have been accepted; it has not been retried. Wait before submitting again.'
      : 'The packing service could not be reached. Try checking the job again later.', 503, payload ? '60' : '5');
  }
  if (response.status !== (payload ? 202 : 200)) {
    const messages = {
      400: 'The packing service rejected the input. Check the items and packing options.',
      401: 'The packing API key is invalid or expired. Ask an administrator to update it in App settings.',
      403: 'The packing API key does not have permission for this request.',
      404: path.startsWith('/jobs/') ? 'This job is missing or expired. Results are retained for seven days.' : 'The multi-box packing endpoint is unavailable on my.lentmiien.com.',
      413: 'The packing request exceeds 256 KiB.',
      429: 'The packing service is busy or its request limit was reached. Wait before trying again.',
      503: 'The packing service is temporarily unavailable. Try again later.',
    };
    throw new PackingError(messages[response.status] || 'The packing service returned an unexpected response.', messages[response.status] ? response.status : 502,
      response.headers && response.headers['retry-after']);
  }
  const data = response.data;
  if (!data || typeof data !== 'object' || (path === '/containers' ? !Array.isArray(data.containers)
    : !jobIdPattern.test(data.jobId) || !['queued', 'running', 'completed', 'failed'].includes(data.status))) {
    throw new PackingError('The packing service returned an invalid response.', 502);
  }
  if (data.status === 'completed' && (!data.result || !Array.isArray(data.result.boxes) || !Array.isArray(data.result.unplaced)
    || data.result.boxes.some((box) => !box || !Array.isArray(box.dimensions) || box.dimensions.length !== 3
      || box.dimensions.some((size) => !Number.isFinite(size) || size <= 0) || !Array.isArray(box.items) || box.items.some((item) => !item || typeof item !== 'object') || !box.weightEstimate))) {
    throw new PackingError('The packing service returned an incomplete plan.', 502);
  }
  // Do not make the browser follow upstream URLs or expose upstream failure details.
  if (path !== '/containers') {
    data.statusUrl = `/multi-box/jobs/${data.jobId}`;
    if (data.status === 'failed') data.error = { message: 'Packing failed. Check your items and options before starting a new job.' };
  }
  return data;
}

module.exports = { buildRequest, callApi, jobIdPattern };
