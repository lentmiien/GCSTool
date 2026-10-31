const axios = require('axios');
const { isDeepStrictEqual } = require('util');
const { createHash } = require('crypto');
const { Op, fn, col } = require('sequelize');
const { parseCountry, normalizeCountry } = require('../utils/japanPostParser');

const sourceUrl = cid => `https://www.post.japanpost.jp/cgi-kokusai/country.php?cid=${cid}`;
const japanDate = value => new Date(new Date(value).getTime() + 9 * 3600000).toISOString().slice(0, 10);
const plain = row => row.get({ plain: true });
const cacheRecord = row => ({ ...plain(row), data: normalizeCountry(row.data) });
function fail(message, status = 400) { const error = new Error(message); error.status = status; throw error; }
function parseCid(value) {
  if (!['string', 'number'].includes(typeof value) || !/^[1-9]\d{0,8}$/.test(String(value))) fail('Enter a positive CID of up to 9 digits.');
  return Number(value);
}
function parseDate(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)
    || !Number.isFinite(Date.parse(value)) || new Date(value).toISOString().slice(0, 10) !== value) fail('Enter a valid date.');
  return value;
}

async function download(cid) {
  try {
    const response = await axios.get(sourceUrl(cid), {
      timeout: 30000, maxRedirects: 0, maxContentLength: 5 * 1024 * 1024,
      responseType: 'text', headers: { 'User-Agent': 'GCSTool JapanPost country limits', Accept: 'text/html' },
    });
    return response.data;
  } catch (_) {
    fail('Japan Post could not be fetched. Please try again later; existing cache is preserved.', 502);
  }
}

function createService({ sequelize, JapanPostCache: Cache, JapanPostSchedule: Schedule }, options = {}) {
  const now = options.now || (() => new Date());
  const fetchHtml = options.download || download;
  const lockName = `gcs-japan-post-${createHash('sha256').update(sequelize.config.database).digest('hex').slice(0, 24)}`;

  // A connection-scoped MySQL lock serializes writers and workers across processes.
  // It is released on disconnect too, so a restarted worker can recover running jobs.
  async function locked(action, skipBusy = false) {
    const connection = await sequelize.connectionManager.getConnection();
    const query = (sql, values) => new Promise((resolve, reject) => {
      connection.query(sql, values, (error, rows) => error ? reject(error) : resolve(rows));
    });
    let acquired = false;
    let reusable = true;
    try {
      acquired = Number((await query('SELECT GET_LOCK(?, 0) AS acquired', [lockName]))[0].acquired) === 1;
      if (!acquired) {
        if (skipBusy) return null;
        fail('Another Japan Post operation is running. Try again shortly.', 429);
      }
      return await action();
    } finally {
      if (acquired) {
        try { await query('SELECT RELEASE_LOCK(?)', [lockName]); }
        catch (_) { reusable = false; }
      }
      if (reusable) await sequelize.connectionManager.releaseConnection(connection);
      else await sequelize.connectionManager.destroyConnection(connection);
    }
  }

  async function history(cid) {
    return (await Cache.findAll({ where: { cid }, order: [['id', 'DESC']] })).map(cacheRecord);
  }

  async function fetchCountry(cid) {
    const latest = await Cache.findOne({ where: { cid }, order: [['id', 'DESC']] });
    if (latest && japanDate(latest.lastCheckedAt) === japanDate(now())) {
      return { cid, sourceUrl: sourceUrl(cid), fromCache: true, changed: false, latest: cacheRecord(latest), history: (await history(cid)).slice(1) };
    }
    const data = parseCountry(await fetchHtml(cid));
    const checkedAt = now();
    const changed = !latest || !isDeepStrictEqual(normalizeCountry(latest.data), data);
    const current = changed
      ? await Cache.create({ cid, data, detectedAt: checkedAt, lastCheckedAt: checkedAt })
      : await latest.update({ lastCheckedAt: checkedAt });
    return { cid, sourceUrl: sourceUrl(cid), fromCache: false, changed, latest: cacheRecord(current), history: (await history(cid)).slice(1) };
  }

  async function viewer(filters = {}) {
    const from = filters.from ? parseDate(filters.from) : '';
    const to = filters.to ? parseDate(filters.to) : '';
    if (from && to && from > to) fail('The start date must be before the end date.');
    // Group in SQL before loading JSON; historical versions do not inflate the viewer.
    const latestIds = await Cache.findAll({ attributes: [[fn('MAX', col('id')), 'id']], group: ['cid'], raw: true });
    if (!latestIds.length) return [];
    const latest = await Cache.findAll({ where: { id: { [Op.in]: latestIds.map(row => row.id) } }, order: [['cid', 'ASC']] });
    const previousIds = await Cache.findAll({
      attributes: [[fn('MAX', col('id')), 'id']],
      where: { id: { [Op.notIn]: latestIds.map(row => row.id) } }, group: ['cid'], raw: true,
    });
    const previous = previousIds.length ? await Cache.findAll({ where: { id: { [Op.in]: previousIds.map(row => row.id) } } }) : [];
    const byCid = new Map(previous.map(row => [row.cid, normalizeCountry(row.data)]));
    const search = String(filters.q || '').trim().toLowerCase();
    return latest.map(row => ({ ...cacheRecord(row), previous: byCid.get(row.cid) || null })).filter(row => {
      const updated = japanDate(row.detectedAt);
      return (!search || String(row.cid).includes(search) || row.data.countryName.toLowerCase().includes(search))
        && (!from || updated >= from) && (!to || updated <= to)
        && (filters.changed !== '1' || row.previous)
        && (filters.stale !== '1' || japanDate(row.lastCheckedAt) !== japanDate(now()));
    });
  }

  async function schedule(cids, date) {
    parseDate(date);
    if (date < japanDate(now())) fail('Choose today or a future date in Japan time.');
    if (typeof cids !== 'string' || cids.length > 4000) fail('Enter up to 250 CIDs separated by spaces or commas.');
    const ids = [...new Set(cids.trim().split(/[\s,]+/).map(parseCid))];
    if (ids.length > 250) fail('Schedule at most 250 CIDs at a time.');
    return locked(() => sequelize.transaction(async transaction => {
      for (const cid of ids) {
        const [job] = await Schedule.findOrCreate({ where: { cid, scheduledDate: date },
          defaults: { dueAt: new Date(`${date}T07:00:00+09:00`) }, transaction });
        // Keep the last attempt time so an immediate retry cannot bypass spacing.
        if (['failed', 'cancelled'].includes(job.status)) await job.update({ status: 'pending', error: null }, { transaction });
      }
      return { count: ids.length };
    }));
  }

  async function tick() {
    return locked(async () => {
      const last = await Schedule.findOne({ where: { finishedAt: { [Op.ne]: null } }, order: [['finishedAt', 'DESC']] });
      if (last && now().getTime() - last.finishedAt.getTime() < 15000) return;
      const job = await Schedule.findOne({ where: { status: { [Op.in]: ['pending', 'running'] }, dueAt: { [Op.lte]: now() } },
        order: [['dueAt', 'ASC'], ['id', 'ASC']] });
      if (!job) return;
      // A prior process may have stopped mid-request. Allow its last request to settle.
      if (job.status === 'running' && now().getTime() - job.updatedAt.getTime() < 45000) return;
      await job.update({ status: 'running', error: null });
      try {
        await fetchCountry(job.cid);
        await job.update({ status: 'completed', finishedAt: now() });
      } catch (error) {
        await job.update({ status: 'failed', finishedAt: now(), error: error.status ? error.message.slice(0, 500) : 'Fetch or database update failed. Reschedule to retry.' });
      }
    }, true);
  }

  return {
    fetch: value => { const cid = parseCid(value); return locked(() => fetchCountry(cid)); },
    history: value => history(parseCid(value)), viewer, schedule, tick,
    schedules: () => Schedule.findAll({ order: [['dueAt', 'DESC'], ['id', 'DESC']], limit: 500 }).then(rows => rows.map(plain)),
    cancel: id => locked(async () => {
      const [count] = await Schedule.update({ status: 'cancelled' }, { where: { id: parseCid(id), status: 'pending' } });
      if (!count) fail('Only pending schedules can be cancelled.', 409);
    }),
  };
}

function startScheduler(service) {
  let busy = false;
  let lastWarning = 0;
  const tick = async () => {
    if (busy) return;
    busy = true;
    try { await service.tick(); }
    catch (_) {
      if (Date.now() - lastWarning > 60000) {
        console.warn('Japan Post scheduler unavailable; pending work will retry.');
        lastWarning = Date.now();
      }
    } finally { busy = false; }
  };
  const timer = setInterval(tick, 1000);
  timer.unref();
  tick();
  return () => clearInterval(timer);
}

module.exports = { createService, startScheduler, download, sourceUrl, japanDate, parseCid, parseDate };
