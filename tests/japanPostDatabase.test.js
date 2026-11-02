// Opt in to disposable MySQL only. Never load .env or the app's sequelize.js.
const Sequelize = require('sequelize');
const fs = require('fs');
const path = require('path');
const express = require('express');
const request = require('supertest');
const cheerio = require('cheerio');
const { createService } = require('../services/japanPost');
const { parseCsv, columns } = require('../utils/japanPostCsv');
const createRouter = require('../routes/japanpost');
const sample = fs.readFileSync('tests/fixtures/japan-post-countries.csv');
const encode = rows => Buffer.from([columns, ...rows.map(row => columns.map(key => row[key]))]
  .map(row => row.map(value => `"${value.replace(/"/g, '""')}"`).join(',')).join('\n'));
const suite = process.env.JAPAN_POST_TEST_MYSQL_PORT ? describe : describe.skip;

suite('Japan Post CSV versions and HTTP on disposable MySQL', () => {
  let db, models, service, clock, app, records;
  const token = 'a'.repeat(64);
  beforeAll(async () => {
    db = new Sequelize('gcs_japanpost_test', 'root', '', { host: '127.0.0.1', port: Number(process.env.JAPAN_POST_TEST_MYSQL_PORT), dialect: 'mysql', logging: false });
    models = { sequelize: db, JapanPostCsvCache: require('../models/japanPostCsvCache')(db, Sequelize) };
    await db.sync({ force: true });
    records = await parseCsv(sample);
  });
  afterAll(async () => { if (db) await db.close(); });
  beforeEach(async () => {
    await models.JapanPostCsvCache.destroy({ where: {} });
    clock = new Date('2026-11-02T00:00:00Z');
    service = createService(models, { now: () => clock });
    app = express();
    app.set('view engine', 'pug');
    app.set('views', path.join(__dirname, '../views'));
    app.use(require('express-fileupload')());
    app.use((req, res, next) => {
      req.user = req.get('x-guest') ? null : { userid: 'Tester' };
      req.session = { japanPostCsrf: token };
      Object.assign(res.locals, { signedIn: true, name: 'Tester', role: 'user', currentPath: '/japan-post' });
      next();
    });
    app.use('/japan-post', createRouter(service));
    app.use((error, req, res, next) => res.status(error.status || 500).send(error.message));
  });
  const upload = (buffer = sample) => request(app).post('/japan-post/api/import').set('X-CSRF-Token', token).attach('csvFile', buffer, 'countries.csv');

  test('full export, identical upload and changed non-viewer field retain accurate versions', async () => {
    expect(await service.importCsv(sample, 'countries.csv')).toMatchObject({ total: 255, added: 255, updated: 0, unchanged: 0 });
    const first = (await service.history('AU'))[0];
    clock = new Date('2026-11-03T00:00:00Z');
    expect(await service.importCsv(sample, 'copy.csv')).toMatchObject({ added: 0, updated: 0, unchanged: 255 });
    expect(await models.JapanPostCsvCache.count()).toBe(255);
    const same = (await service.history('au'))[0];
    expect(same.id).toBe(first.id);
    expect(same.detectedAt).toEqual(first.detectedAt);
    expect(same.lastCheckedAt).toEqual(clock);
    const au = { ...records.find(row => row.countryCode === 'AU').data, '発送可能地域(日本語表記）': 'Changed delivery area' };
    // Same-day uploads must still detect new content.
    expect(await service.importCsv(encode([au]), 'updated.csv')).toMatchObject({ total: 1, updated: 1 });
    const history = await service.history('AU');
    expect(history).toHaveLength(2);
    expect(history[1].data).toEqual(first.data);
    expect(history[0].data).toEqual(au);
    expect((await service.overview()).countries).toBe(255); // Missing countries are retained.
    expect(await service.viewer({ q: 'オーストラリア', changed: '1' })).toHaveLength(1);
    expect(await service.viewer({ from: '2026-11-03' })).toHaveLength(1);
    clock = new Date('2026-11-04T00:00:00Z');
    expect(await service.viewer({ stale: '1' })).toHaveLength(255);
    expect(await service.viewer({ to: '2026-11-01' })).toHaveLength(0);
    await expect(service.viewer({ from: '2026-11-05', to: '2026-11-01' })).rejects.toThrow('start date');
  });

  test('invalid uploads and a failed transaction leave all cached values and timestamps intact', async () => {
    await service.importCsv(sample);
    const before = await service.history('AU');
    clock = new Date('2026-11-03T00:00:00Z');
    await expect(service.importCsv(Buffer.from('invalid'))).rejects.toThrow();
    const au = { ...records.find(row => row.countryCode === 'AU').data, EMS_最大重量: '25' };
    const update = jest.spyOn(models.JapanPostCsvCache, 'update').mockRejectedValueOnce(new Error('Simulated write failure'));
    try { await expect(service.importCsv(encode([au, records[0].data]))).rejects.toThrow('Simulated'); }
    finally { update.mockRestore(); }
    expect(await service.history('AU')).toEqual(before);
    expect(await models.JapanPostCsvCache.count()).toBe(255);
  });

  test('concurrent imports serialize and retries do not create duplicate versions', async () => {
    const results = await Promise.allSettled([service.importCsv(sample), createService(models).importCsv(sample)]);
    expect(results.some(result => result.status === 'fulfilled')).toBe(true);
    for (const result of results.filter(result => result.status === 'rejected')) expect(result.reason.status).toBe(429);
    await service.importCsv(sample);
    expect(await models.JapanPostCsvCache.count()).toBe(255);
  });

  test('authenticated multipart upload, details and database show new country codes and converted limits', async () => {
    expect((await upload()).status).toBe(200);
    const page = await request(app).get('/japan-post/database?q=AU');
    expect(page.status).toBe(200);
    const $ = cheerio.load(page.text);
    const row = $('tbody tr').filter((i, el) => $(el).find('a').text() === 'AU');
    expect(row.find('a').attr('href')).toBe('/japan-post/countries/AU');
    expect(row.find('.jp-air').map((i, el) => $(el).text()).get()).toEqual(['20 kg', '1.05 m', '2 m']);
    expect(row.find('.jp-sal').text()).toBe('Unavailable');
    const detail = await request(app).get('/japan-post/countries/AU');
    expect(detail.status).toBe(200);
    expect(detail.text).toContain('105 cm');
    expect(cheerio.load(detail.text)('#jp-current + .jp-detail-sections .jp-field')).toHaveLength(61);
    const api = await request(app).get('/japan-post/api/countries/AU');
    expect(api.body.history[0].data['ＥＭＳサイズ・長さ']).toBe('105');
    expect((await request(app).get('/japan-post/countries/ZZ')).status).toBe(404);
    expect((await request(app).get('/japan-post')).text).toContain('Import Japan Post CSV');
    expect((await request(app).post('/japan-post/api/fetch').set('X-CSRF-Token', token)).status).toBe(404);
    expect((await request(app).get('/japan-post/api/schedules')).status).toBe(404);
  });

  test('changed cells, status transitions and escaped history are rendered from the CSV versions', async () => {
    const au = records.find(row => row.countryCode === 'AU').data;
    await service.importCsv(encode([au]));
    const updated = { ...au, '最大重量(小包み・航空便）': '25', EMS取扱フラグ: '0', '発送可能地域(英語表記）': '<script>alert(1)</script>' };
    clock = new Date();
    await service.importCsv(encode([updated]));
    const page = await request(app).get('/japan-post/database');
    const $ = cheerio.load(page.text);
    expect($('tbody .jp-recent-cell')).toHaveLength(2);
    expect($('tbody .jp-air strong').text()).toBe('25 kg');
    expect($('tbody .jp-ems strong').text()).toBe('Unavailable');
    const detail = await request(app).get('/japan-post/countries/AU');
    expect(detail.text).toContain('&lt;script&gt;alert(1)&lt;/script&gt;');
    expect(detail.text).toContain('3 changed fields');
    expect(detail.text).not.toContain('<script>alert(1)</script>');
    expect(detail.text).toContain('Version 2');
  });

  test('upload rejects missing CSRF, guests, wrong file types and duplicate codes', async () => {
    expect((await request(app).post('/japan-post/api/import').attach('csvFile', sample, 'data.csv')).status).toBe(403);
    expect((await request(app).get('/japan-post').set('x-guest', '1')).status).toBe(401);
    expect((await request(app).post('/japan-post/api/import').set('X-CSRF-Token', token).attach('csvFile', sample, 'data.html')).status).toBe(400);
    expect((await upload(encode([records[0].data, records[0].data]))).status).toBe(400);
    expect(await models.JapanPostCsvCache.count()).toBe(0);
  });
});
