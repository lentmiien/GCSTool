const axios = require('axios');
const { APP_SETTING_KEYS } = require('./appSettings');
const { parseItems } = require('../public/javascripts/smallest-box-data');

class PackingError extends Error {
  constructor(message, status = 400, retryAfter) {
    super(message);
    this.status = status;
    this.retryAfter = retryAfter;
  }
}

function buildRequest(body) {
  let items;
  try {
    items = parseItems(body && body.provideitems);
  } catch (error) {
    throw new PackingError(error.message);
  }
  const algorithm = body.algorithm || 'laff';
  if (!['laff', 'plain', 'bruteforce'].includes(algorithm)) throw new PackingError('Choose a supported algorithm.');
  if (algorithm === 'bruteforce' && items.reduce((sum, item) => sum + item.qty, 0) > 7) {
    throw new PackingError('Brute force supports at most 7 total items. Choose LAFF or Plain.');
  }
  const safetyMarginMm = body.safetyMarginMm === undefined ? 10 : body.safetyMarginMm;
  if (!Number.isFinite(safetyMarginMm) || safetyMarginMm < 0 || safetyMarginMm > 500000) {
    throw new PackingError('Safety margin must be a number from 0 to 500,000 mm.');
  }
  const filter = body.tagFilter || {};
  const tagFilter = {};
  for (const key of ['require', 'requireNot']) {
    const tags = filter[key] === undefined ? [] : filter[key];
    if (!Array.isArray(tags) || tags.length > 20 || tags.some((tag) => typeof tag !== 'string' || !/^[a-z0-9][a-z0-9_-]{0,39}$/i.test(tag.trim()))) {
      throw new PackingError('Each tag filter supports at most 20 valid tags.');
    }
    tagFilter[key] = [...new Set(tags.map((tag) => tag.trim().toLowerCase()))];
  }
  const payload = { items, algorithm, safetyMarginMm, tagFilter };
  if (Buffer.byteLength(JSON.stringify(payload)) > 64 * 1024) throw new PackingError('The packing request exceeds 64 KiB.', 413);
  return payload;
}

async function callApi(AppSetting, payload) {
  const setting = await AppSetting.findOne({ where: { key: APP_SETTING_KEYS.SMALLEST_BOX_API_KEY } });
  const apiKey = setting && setting.value.trim();
  if (!apiKey) throw new PackingError('An administrator must configure SMALLEST_BOX_API_KEY in App settings before using this tool.', 503);
  let response;
  try {
    response = await axios({
      method: payload ? 'POST' : 'GET',
      url: `https://my.lentmiien.com/api/binpacking-smallest${payload ? '' : '/containers'}`,
      headers: { Authorization: `Bearer ${apiKey}`, Accept: 'application/json' },
      ...(payload ? { data: payload } : {}),
      timeout: 75000,
      maxRedirects: 0,
      maxContentLength: 2 * 1024 * 1024,
      validateStatus: () => true,
    });
  } catch (error) {
    // Axios errors include the Authorization header; never log or forward them.
    throw new PackingError(error.code === 'ECONNABORTED'
      ? 'The packing service timed out. Wait a moment before trying again.'
      : 'The packing service could not be reached. Please try again later.', 503);
  }
  if (response.status !== 200) {
    const messages = {
      400: 'The packing service rejected the input. Check items, safety margin, and tag filters.',
      401: 'The packing API key has expired, was revoked, or lacks permissions. Ask an administrator to replace it in App settings.',
      404: payload
        ? 'The packing service at my.lentmiien.com is missing its search endpoint. Update and restart the source site, then try again.'
        : 'The packing service at my.lentmiien.com is missing its box catalog endpoint. Update and restart the source site, then refresh boxes.',
      413: 'The packing request is too large.',
      429: 'The packing service is busy or its request limit was reached. Wait before trying again.',
      503: 'The packing service is temporarily unavailable. Please try again later.',
    };
    const retryAfter = response.headers && response.headers['retry-after'];
    throw new PackingError(messages[response.status] || 'The packing service returned an unexpected error.',
      response.status === 404 ? 502 : messages[response.status] ? response.status : 502, retryAfter);
  }
  const data = response.data;
  if (!data || typeof data !== 'object' || (payload
    ? typeof data.success !== 'boolean'
    : !Array.isArray(data.containers) || !Array.isArray(data.tags))) {
    throw new PackingError('The packing service returned an invalid response.', 502);
  }
  if (payload && data.success) {
    const alternatives = data.alternatives === undefined ? [] : data.alternatives;
    if (!Array.isArray(alternatives) || alternatives.length > 2) {
      throw new PackingError('The packing service returned invalid alternative solutions.', 502);
    }
    if ([data, ...alternatives].some((solution) => !solution || solution.success !== true
      || !solution.container || !solution.data || !Array.isArray(solution.data.pallets)
      || solution.data.pallets.length !== 1 || !solution.data.pallets[0]
      || !Array.isArray(solution.data.pallets[0].placements))) {
      throw new PackingError('The packing service returned an incomplete solution.', 502);
    }
  }
  return data;
}

module.exports = { PackingError, buildRequest, callApi };
