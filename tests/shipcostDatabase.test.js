// Explicit disposable database only; never load .env or sync the application's DB.
const Sequelize = require('sequelize');
const fs = require('fs');
const express = require('express');
const request = require('supertest');
const { createService } = require('../services/shipcost');
const { parseCsv } = require('../utils/japanPostRatesCsv');
const { toRows, select } = require('../public/javascripts/shipcost-chart');
const sample = fs.readFileSync('tests/fixtures/japan-post-ems-rates.csv');
const suite = process.env.SHIPCOST_TEST_MYSQL_PORT ? describe : describe.skip;
const csv = (rows, headers = ['重量', '新_第一地帯_料金', '新_第二地帯_料金']) => Buffer.from([headers, ...rows].map(row => row.join(',')).join('\n'));

suite('full shipping charts on disposable MySQL', () => {
  let db, models, service, app, chart;
  const token = 'a'.repeat(64);
  beforeAll(async () => {
    db = new Sequelize('gcs_shipcost_test', 'root', '', { host: '127.0.0.1', port: Number(process.env.SHIPCOST_TEST_MYSQL_PORT), dialect: 'mysql', logging: false });
    models = { sequelize: db, Shipcost: require('../models/shipcost')(db, Sequelize), ShipcostChart: require('../models/shipcostChart')(db, Sequelize) };
    await db.sync({ force: true });
    chart = (await parseCsv(sample, 'EMS')).chart;
    jest.doMock('../sequelize', () => models);
    const router = require('../routes/shipcost');
    app = express();
    app.set('view engine', 'pug');
    app.set('views', `${__dirname}/../views`);
    app.use(express.json());
    app.use(require('express-fileupload')());
    app.use((req, res, next) => {
      req.user = req.get('x-guest') ? null : { userid: 'Tester' };
      req.session = { shipcostCsrf: token };
      next();
    });
    app.use('/shipcost', router);
    app.use((error, req, res, next) => res.status(error.status || 500).send(error.message));
  });
  beforeEach(async () => {
    await models.Shipcost.destroy({ where: {} });
    await models.ShipcostChart.destroy({ where: {} });
    service = createService(models, { now: () => new Date('2026-11-03T00:00:00Z') });
  });
  afterAll(async () => { if (db) await db.close(); });
  const upload = (buffer = sample, method = 'EMS') => request(app).post('/shipcost/api/import').set('X-CSRF-Token', token).field('method', method).attach('csvFile', buffer, 'rates.csv');

  test('new import stores all cells; duplicate import changes neither rows nor versions', async () => {
    expect(await service.importCsv(sample, 'EMS', 'rates.csv')).toMatchObject({ unchanged: false, rows: 42, columns: 5 });
    const before = await models.ShipcostChart.findAll({ raw: true });
    expect(await models.Shipcost.count()).toBe(210);
    expect(await service.importCsv(sample, 'EMS', 'copy.csv')).toMatchObject({ unchanged: true });
    expect(await models.Shipcost.count()).toBe(210);
    expect(await models.ShipcostChart.findAll({ raw: true })).toEqual(before);
  });

  test('matching existing legacy rates cause no write; changed chart preserves baseline and other methods', async () => {
    await models.Shipcost.bulkCreate([...toRows(chart, 'EMS', 20231001), ...toRows(chart, 'Air parcel', 20231001)]);
    expect((await service.importCsv(sample, 'EMS', 'same.csv')).unchanged).toBe(true);
    expect(await models.ShipcostChart.count()).toBe(0);
    const changed = Buffer.from(sample.toString().replace('"1450"', '"1451"'));
    expect((await service.importCsv(changed, 'EMS', 'new.csv')).changes.cells).toEqual([{ weight: 500, zone: 'zone1', before: 1450, after: 1451 }]);
    expect(await models.ShipcostChart.count()).toBe(2);
    expect((await service.history('EMS'))[1].chart).toEqual(chart);
    const stored = await service.data();
    expect(select(stored.rows, stored.versions).EMS.chart.rates[0][0]).toBe(1451);
    expect(select(stored.rows, stored.versions)['Air parcel'].chart).toEqual(chart);
    expect(select(stored.rows, stored.versions, 20231101).EMS.chart).toEqual(chart);
  });

  test('removed and added rows/columns create full charts; same-day reimports and manual updates stay consistent', async () => {
    await service.importCsv(sample, 'EMS', 'first.csv');
    const result = await service.importCsv(csv([[1000, 123], [30000, 456]], ['重量', '新_第六地帯_料金']), 'EMS', 'redefined.csv');
    expect(result.changes.removedColumns).toHaveLength(5);
    let stored = await service.data();
    const current = select(stored.rows, stored.versions).EMS.chart;
    expect(current.zones.map(zone => zone.key)).toEqual(['zone6']);
    expect(current.weights).toEqual([1000, 30000]);
    expect((await service.history('EMS'))).toHaveLength(2);
    const manual = toRows(current, 'EMS', 20261103);
    manual[0].cost = 124;
    await service.saveManual('EMS', manual);
    stored = await service.data();
    expect(select(stored.rows, stored.versions).EMS.chart.rates).toEqual([[124], [456]]);
    expect((await service.importCsv(sample, 'EMS', 'restored.csv')).unchanged).toBe(false);
    expect((await service.history('EMS'))).toHaveLength(4);
  });

  test('validation and database failures roll back the entire update, including baseline creation', async () => {
    await models.Shipcost.bulkCreate(toRows(chart, 'EMS', 20231001));
    const before = await models.Shipcost.findAll({ raw: true });
    await expect(service.importCsv(csv([[500, 100, '']]), 'EMS', 'invalid.csv')).rejects.toThrow();
    const write = jest.spyOn(models.Shipcost, 'bulkCreate').mockRejectedValueOnce(new Error('Simulated failure'));
    try { await expect(service.importCsv(csv([[500, 100, 200]]), 'EMS', 'changed.csv')).rejects.toThrow('Simulated'); }
    finally { write.mockRestore(); }
    expect(await models.ShipcostChart.count()).toBe(0);
    expect(await models.Shipcost.findAll({ raw: true })).toEqual(before);
  });

  test('simultaneous imports serialize and cannot create duplicate versions', async () => {
    const results = await Promise.allSettled([service.importCsv(sample, 'EMS', 'one.csv'), createService(models).importCsv(sample, 'EMS', 'two.csv')]);
    expect(results.some(result => result.status === 'fulfilled')).toBe(true);
    for (const result of results.filter(result => result.status === 'rejected')) expect(result.reason.status).toBe(429);
    await service.importCsv(sample, 'EMS', 'retry.csv');
    expect(await models.ShipcostChart.count()).toBe(1);
    expect(await models.Shipcost.count()).toBe(210);
  });

  test('multipart upload, DB-first manager, viewer, history and manual endpoint render saved data', async () => {
    expect((await upload()).status).toBe(200);
    const manager = await request(app).get('/shipcost');
    expect(manager.status).toBe(200);
    expect(manager.text).toContain('Import Japan Post rates');
    expect(manager.text).toContain('77700');
    expect((await request(app).get('/shipcost/view')).text).toContain('77700');
    expect((await request(app).get('/shipcost/history?method=EMS')).text).toContain('rates.csv');
    expect((await upload()).body.unchanged).toBe(true);
    const manual = toRows(chart, 'EMS', 20990101);
    manual[0].cost = 1499;
    const update = await request(app).post('/shipcost/savetodb').set('X-CSRF-Token', token).send({ method: 'EMS', data_array: manual });
    expect(update.status).toBe(200);
    const history = await request(app).get('/shipcost/history?method=EMS');
    expect(history.status).toBe(200);
    expect(history.text).toContain('rate-changed');
    expect(history.text).toContain('1499');
    expect((await upload()).status).toBe(400); // Cannot overwrite future chart with backdated data.
  });

  test('rejects unauthenticated, missing CSRF, wrong types, malformed charts and unsupported methods', async () => {
    expect((await request(app).get('/shipcost').set('x-guest', '1')).status).toBe(401);
    expect((await request(app).post('/shipcost/api/import').attach('csvFile', sample, 'rates.csv')).status).toBe(403);
    expect((await request(app).post('/shipcost/api/import').set('X-CSRF-Token', token).field('method', 'EMS').attach('csvFile', sample, 'rates.txt')).status).toBe(400);
    expect((await upload(sample, 'DHL')).status).toBe(400);
    expect((await upload(csv([[500, 100, '']]))).status).toBe(400);
    expect((await request(app).post('/shipcost/savetodb').set('X-CSRF-Token', token).send({ method: 'EMS', data_array: [] })).status).toBe(400);
    expect(await models.ShipcostChart.count()).toBe(0);
  });
});
