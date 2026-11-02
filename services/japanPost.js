const { isDeepStrictEqual } = require('util');
const { createHash } = require('crypto');
const { Op, fn, col } = require('sequelize');
const { parseCsv, countryCode, limits, fail } = require('../utils/japanPostCsv');

const japanDate = value => new Date(new Date(value).getTime() + 9 * 3600000).toISOString().slice(0, 10);
const plain = row => row.get({ plain: true });
function parseDate(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)
    || !Number.isFinite(Date.parse(value)) || new Date(value).toISOString().slice(0, 10) !== value) fail('Enter a valid date.');
  return value;
}

function createService({ sequelize, JapanPostCsvCache: Cache }, options = {}) {
  const now = options.now || (() => new Date());
  const lockName = `gcs-jp-csv-${createHash('sha256').update(sequelize.config.database).digest('hex').slice(0, 24)}`;

  // Serialize imports across app processes, including first-ever imports with no rows to lock.
  async function locked(action) {
    const connection = await sequelize.connectionManager.getConnection();
    const query = (sql, values) => new Promise((resolve, reject) => {
      connection.query(sql, values, (error, rows) => error ? reject(error) : resolve(rows));
    });
    let acquired = false;
    let reusable = true;
    try {
      acquired = Number((await query('SELECT GET_LOCK(?, 0) AS acquired', [lockName]))[0].acquired) === 1;
      if (!acquired) fail('Another Japan Post import is running. Try again shortly.', 429);
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

  async function latestRecords(transaction) {
    const ids = await Cache.findAll({ attributes: [[fn('MAX', col('id')), 'id']], group: ['countryCode'], raw: true, transaction });
    return ids.length ? Cache.findAll({ where: { id: { [Op.in]: ids.map(row => row.id) } }, order: [['countryCode', 'ASC']], transaction }) : [];
  }

  // A future API downloader can pass its CSV bytes through this same validation/import path.
  async function importCsv(buffer, sourceName = 'Japan Post CSV') {
    const records = await parseCsv(buffer);
    const filename = String(sourceName).split(/[\\/]/).pop().replace(/[\x00-\x1f\x7f]/g, '').slice(0, 255) || 'Japan Post CSV';
    return locked(() => sequelize.transaction(async transaction => {
      const latest = new Map((await latestRecords(transaction)).map(row => [row.countryCode, row]));
      const checkedAt = now();
      const result = { total: records.length, added: 0, updated: 0, unchanged: 0, checkedAt };
      const versions = [];
      const unchangedIds = [];
      for (const record of records) {
        const previous = latest.get(record.countryCode);
        if (!previous || !isDeepStrictEqual(previous.data, record.data)) {
          versions.push({ ...record, sourceName: filename, detectedAt: checkedAt, lastCheckedAt: checkedAt });
          result[previous ? 'updated' : 'added']++;
        } else {
          unchangedIds.push(previous.id);
          result.unchanged++;
        }
      }
      if (versions.length) await Cache.bulkCreate(versions, { transaction });
      if (unchangedIds.length) await Cache.update({ lastCheckedAt: checkedAt }, { where: { id: { [Op.in]: unchangedIds } }, transaction });
      return result;
    }));
  }

  async function history(value) {
    return (await Cache.findAll({ where: { countryCode: countryCode(value) }, order: [['id', 'DESC']] })).map(plain);
  }

  async function viewer(filters = {}) {
    const from = filters.from ? parseDate(filters.from) : '';
    const to = filters.to ? parseDate(filters.to) : '';
    if (from && to && from > to) fail('The start date must be before the end date.');
    // Use one consistent snapshot so an overlapping import cannot become a row's "previous" version.
    return sequelize.transaction({ isolationLevel: 'REPEATABLE READ' }, async transaction => {
      const latest = await latestRecords(transaction);
      if (!latest.length) return [];
      const previousIds = await Cache.findAll({ attributes: [[fn('MAX', col('id')), 'id']],
        where: { id: { [Op.notIn]: latest.map(row => row.id) } }, group: ['countryCode'], raw: true, transaction });
      const previous = previousIds.length ? await Cache.findAll({ where: { id: { [Op.in]: previousIds.map(row => row.id) } }, transaction }) : [];
      const byCode = new Map(previous.map(row => [row.countryCode, row.data]));
      const search = String(filters.q || '').trim().toLowerCase();
      return latest.map(row => ({ ...plain(row), previous: byCode.get(row.countryCode) || null, limits: limits(row.data),
        previousLimits: byCode.has(row.countryCode) ? limits(byCode.get(row.countryCode)) : null,
      })).filter(row => {
        const updated = japanDate(row.detectedAt);
        return (!search || [row.countryCode, row.data['国名（英語）'], row.data['国名（日本語）'], row.data['国名（英語・略称）']].some(value => value.toLowerCase().includes(search)))
          && (!from || updated >= from) && (!to || updated <= to)
          && (filters.changed !== '1' || row.previous)
          && (filters.stale !== '1' || japanDate(row.lastCheckedAt) !== japanDate(now()));
      });
    });
  }

  async function overview() {
    const rows = await latestRecords();
    return { countries: rows.length, lastCheckedAt: rows.reduce((latest, row) => !latest || row.lastCheckedAt > latest ? row.lastCheckedAt : latest, null) };
  }
  return { importCsv, history, viewer, overview };
}
module.exports = { createService, japanDate, parseDate };
