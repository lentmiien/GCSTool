const { createHash } = require('crypto');
const { parseCsv, manualChart, validateMethod, fail } = require('../utils/japanPostRatesCsv');
const { select, compare, toRows } = require('../public/javascripts/shipcost-chart');
const today = (value = new Date()) => Number(new Date(new Date(value).getTime() + 9 * 3600000).toISOString().slice(0, 10).replace(/-/g, ''));
function validateDate(value) {
  const text = String(value);
  const iso = `${text.slice(0, 4)}-${text.slice(4, 6)}-${text.slice(6, 8)}`;
  if (!/^\d{8}$/.test(text) || !Number.isFinite(Date.parse(iso)) || new Date(iso).toISOString().slice(0, 10) !== iso) fail('Enter a valid update date.');
  return Number(value);
}
function createService({ sequelize, Shipcost, ShipcostChart }, options = {}) {
  const now = options.now || (() => new Date());
  async function data(transaction) {
    if (!transaction) return sequelize.transaction({ isolationLevel: 'REPEATABLE READ' }, data);
    const [rows, versions] = await Promise.all([
      Shipcost.findAll({ raw: true, transaction }),
      ShipcostChart.findAll({ raw: true, order: [['costdate', 'ASC'], ['id', 'ASC']], transaction }),
    ]);
    return { rows, versions };
  }
  // MySQL advisory locks also protect the first upload and concurrent app processes.
  async function locked(method, action) {
    const lockName = `gcs-rates-${createHash('sha256').update(`${sequelize.config.database}:${method}`).digest('hex').slice(0, 40)}`;
    const connection = await sequelize.connectionManager.getConnection();
    const query = (sql, values) => new Promise((resolve, reject) => connection.query(sql, values, (error, rows) => error ? reject(error) : resolve(rows)));
    let acquired = false;
    let reusable = true;
    try {
      acquired = Number((await query('SELECT GET_LOCK(?, 0) AS acquired', [lockName]))[0].acquired) === 1;
      if (!acquired) fail('Another update for this shipping method is running. Try again shortly.', 429);
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
  async function save(method, chart, costdate, sourceName, sourceHeaders = [], preserveLabels = false) {
    validateDate(costdate);
    const filename = String(sourceName).split(/[\\/]/).pop().replace(/[\x00-\x1f\x7f]/g, '').slice(0, 255) || 'Rate chart';
    return locked(method, () => sequelize.transaction(async transaction => {
      const stored = await data(transaction);
      const previous = select(stored.rows, stored.versions)[method];
      if (preserveLabels && previous) chart.zones = chart.zones.map(zone => previous.chart.zones.find(old => old.key === zone.key) || zone);
      const changes = compare(previous && previous.chart, chart);
      const result = { method, unchanged: changes.identical, rows: chart.weights.length, columns: chart.zones.length, changes };
      if (changes.identical) return result;
      if (previous && costdate < previous.costdate) fail('The update date cannot precede the latest saved chart.');
      if (previous && !stored.versions.some(version => version.method === method)) {
        await ShipcostChart.create({ method, costdate: previous.costdate, chart: previous.chart, sourceName: 'Existing database before CSV imports', sourceHeaders: [] }, { transaction });
      }
      const version = await ShipcostChart.create({ method, costdate, chart, sourceName: filename, sourceHeaders }, { transaction });
      // Keep the existing rate table populated, while version-aware readers use the
      // complete snapshot to exclude deleted weights/zones and resolve same-day edits.
      await Shipcost.bulkCreate(toRows(chart, method, costdate), { transaction });
      return { ...result, versionId: version.id };
    }));
  }
  async function importCsv(buffer, method, sourceName) {
    const parsed = await parseCsv(buffer, method);
    return { ...await save(method, parsed.chart, today(now()), sourceName, parsed.sourceHeaders), ignoredColumns: parsed.ignoredColumns };
  }
  async function saveManual(method, rows) {
    const chart = manualChart(method, rows);
    const costdate = validateDate(rows[0].costdate);
    if (rows.some(row => row.costdate !== costdate)) fail('All chart entries must use the same update date.');
    return save(method, chart, costdate, 'Manual update', [], true);
  }
  async function history(method) {
    validateMethod(method, true);
    const stored = await data();
    const versions = stored.versions.filter(version => version.method === method);
    if (!versions.length) {
      const current = select(stored.rows, [])[method];
      if (current) versions.push({ ...current, method, sourceName: 'Existing database', sourceHeaders: [] });
    }
    return versions.map((version, i) => ({ ...version, changes: i ? compare(versions[i - 1].chart, version.chart) : null })).reverse();
  }
  return { data, importCsv, saveManual, history };
}
module.exports = { createService, today, validateDate };
