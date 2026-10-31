// Opt in to disposable MySQL only. Never load .env or the app's sequelize.js.
const Sequelize = require('sequelize');
const fs = require('fs');
const path = require('path');
const express = require('express');
const request = require('supertest');
const cheerio = require('cheerio');
const { createService } = require('../services/japanPost');
const createRouter = require('../routes/japanpost');
const { parseCountry } = require('../utils/japanPostParser');
const suite = process.env.JAPAN_POST_TEST_MYSQL_PORT ? describe : describe.skip;
const australia = fs.readFileSync(path.join(__dirname, 'fixtures/japan-post-14.html'), 'utf8');
const ireland = fs.readFileSync(path.join(__dirname, 'fixtures/japan-post-105.html'), 'utf8');

suite('Japan Post cache, queue and HTTP on disposable MySQL', () => {
  let db, models, service, clock, download, app;
  const token = 'a'.repeat(64);
  const advance = milliseconds => { clock = new Date(clock.getTime() + milliseconds); };
  beforeAll(async () => {
    db = new Sequelize('gcs_japanpost_test', 'root', '', { host: '127.0.0.1', port: Number(process.env.JAPAN_POST_TEST_MYSQL_PORT), dialect: 'mysql', logging: false });
    models = { sequelize: db, JapanPostCache: require('../models/japanPostCache')(db, Sequelize), JapanPostSchedule: require('../models/japanPostSchedule')(db, Sequelize) };
    await db.sync({ force: true });
  });
  afterAll(async () => { if (db) await db.close(); });
  beforeEach(async () => {
    await models.JapanPostCache.destroy({ where: {} });
    await models.JapanPostSchedule.destroy({ where: {} });
    clock = new Date('2026-10-30T21:59:59Z'); // 06:59:59 JST on October 31.
    download = jest.fn(async cid => cid === 14 ? australia : ireland);
    service = createService(models, { now: () => clock, download });
    app = express();
    app.set('view engine', 'pug');
    app.set('views', path.join(__dirname, '../views'));
    app.use(express.json());
    app.use((req, res, next) => {
      req.user = req.get('x-guest') ? null : { userid: 'Tester' };
      req.session = { japanPostCsrf: token };
      Object.assign(res.locals, { signedIn: true, name: 'Tester', role: 'user', currentPath: '/japan-post' });
      next();
    });
    app.use('/japan-post', createRouter(service));
    app.use((error, req, res, next) => res.status(error.status || 500).send(error.message));
  });
  const post = (url, body) => request(app).post(`/japan-post/api/${url}`).set('X-CSRF-Token', token).send(body);

  test('same-day reuse, unchanged-day touch, changed version and accurate previous data', async () => {
    const first = await service.fetch(14);
    expect(first.changed).toBe(true);
    expect((await service.fetch(14)).fromCache).toBe(true);
    expect(download).toHaveBeenCalledTimes(1);
    advance(86400000);
    const same = await service.fetch(14);
    expect(same.changed).toBe(false);
    expect(same.latest.id).toBe(first.latest.id);
    expect(same.latest.detectedAt).toEqual(first.latest.detectedAt);
    expect(same.latest.lastCheckedAt).toEqual(clock);
    advance(86400000);
    download.mockResolvedValue(australia.replace(/20kgまで/g, '25kgまで'));
    const changed = await service.fetch(14);
    expect(changed.history).toHaveLength(1);
    expect(changed.history[0].data.parcel.air.weight.value).toBe(20);
    expect(changed.latest.data.parcel.air.weight.value).toBe(25);
    const rows = await service.viewer();
    expect(rows).toHaveLength(1);
    expect(rows[0].previous.parcel.air.weight.value).toBe(20);
    expect(await service.viewer({ from: '2026-11-03' })).toHaveLength(0);
    expect(await service.viewer({ q: 'Australia', changed: '1' })).toHaveLength(1);
    expect(await service.viewer({ stale: '1' })).toHaveLength(0);
    advance(86400000);
    expect(await service.viewer({ stale: '1' })).toHaveLength(1);
  });

  test('upstream failure preserves cache and locks prevent duplicate concurrent writes', async () => {
    await service.fetch(105);
    advance(86400000);
    download.mockRejectedValueOnce(new Error('Unavailable'));
    await expect(service.fetch(105)).rejects.toThrow('Unavailable');
    expect((await service.history(105))[0].lastCheckedAt).not.toEqual(clock);
    const results = await Promise.allSettled([service.fetch(105), createService(models, { now: () => clock, download }).fetch(105)]);
    expect(results.some(result => result.status === 'fulfilled')).toBe(true);
    expect(await models.JapanPostCache.count()).toBe(1);
    expect((await service.fetch(105)).fromCache).toBe(true);
  });

  test('legacy cache gains unavailable status today without a fetch or a synthetic history entry', async () => {
    const html = fs.readFileSync(path.join(__dirname, 'fixtures/japan-post-234.html'), 'utf8');
    const data = parseCountry(html);
    for (const service of [data.parcel.air, data.parcel.surface, data.ems]) delete service.unavailable;
    data.warnings = ['Parcel surface: some limits were not found. Check the source page.', 'EMS: source text retained where numeric parsing was not possible.'];
    await models.JapanPostCache.create({ cid: 234, data, detectedAt: clock, lastCheckedAt: clock });
    const cached = await service.fetch(234);
    expect(cached.fromCache).toBe(true);
    expect(download).not.toHaveBeenCalled();
    expect(cached.latest.data.ems.unavailable).toBe(true);
    expect(cached.latest.data.parcel.surface.unavailable).toBe(true);
    expect(cached.latest.data.warnings).toEqual([]);
    expect((await service.history(234))[0].data.ems.unavailable).toBe(true);
    expect((await service.viewer())[0].data.ems.unavailable).toBe(true);
    const viewer = cheerio.load((await request(app).get('/japan-post/database')).text);
    expect(viewer('td[colspan="3"]').map((_, el) => viewer(el).text()).get()).toEqual(['Unavailable', 'Unavailable']);
    advance(86400000);
    download.mockResolvedValueOnce(html);
    expect((await service.fetch(234)).changed).toBe(false);
    expect(await models.JapanPostCache.count()).toBe(1);
    expect((await models.JapanPostCache.findOne()).data).toEqual(data);
  });

  test('a change to unavailable is saved and highlighted in the viewer', async () => {
    const html = fs.readFileSync(path.join(__dirname, 'fixtures/japan-post-235.html'), 'utf8');
    const data = parseCountry(html);
    data.ems = { ...data.parcel.air };
    await models.JapanPostCache.create({ cid: 235, data, detectedAt: clock, lastCheckedAt: clock });
    advance(86400000);
    download.mockResolvedValueOnce(html);
    expect((await service.fetch(235)).changed).toBe(true);
    expect(await models.JapanPostCache.count()).toBe(2);
    const viewer = cheerio.load((await request(app).get('/japan-post/database')).text);
    expect(viewer('td[colspan="3"] strong').text()).toBe('Unavailable');
    expect(viewer('td strong')).toHaveLength(1);
  });

  test('starts at 07:00 JST, persists 15-second spacing and works across scheduler instances', async () => {
    await service.schedule('14, 105, 14', '2026-10-31');
    await service.tick();
    expect(download).not.toHaveBeenCalled();
    advance(1000);
    const restarted = createService(models, { now: () => clock, download });
    await Promise.all([service.tick(), restarted.tick()]);
    expect(download).toHaveBeenCalledTimes(1);
    advance(14999);
    await restarted.tick();
    expect(download).toHaveBeenCalledTimes(1);
    advance(1);
    await restarted.tick();
    expect(download).toHaveBeenCalledTimes(2);
    expect((await service.schedules()).map(job => job.status)).toEqual(['completed', 'completed']);
    await service.schedule('14 105', '2026-10-31');
    await restarted.tick();
    expect(download).toHaveBeenCalledTimes(2);
  });

  test('recovers interrupted work, skips today’s cached fetch, and continues after failures', async () => {
    await service.fetch(14);
    await service.schedule('14 105 106', '2026-10-31');
    await models.JapanPostSchedule.update({ status: 'running', updatedAt: new Date(clock.getTime() - 60000) }, { where: { cid: 14 }, silent: true });
    advance(1000);
    await service.tick();
    expect(download).toHaveBeenCalledTimes(1);
    advance(15000);
    download.mockRejectedValueOnce(new Error('Network error'));
    await service.tick();
    expect((await models.JapanPostSchedule.findOne({ where: { cid: 105 } })).status).toBe('failed');
    advance(15000);
    await service.tick();
    expect((await models.JapanPostSchedule.findOne({ where: { cid: 106 } })).status).toBe('completed');
    await service.schedule('105', '2026-10-31');
    expect((await models.JapanPostSchedule.findOne({ where: { cid: 105 } })).status).toBe('pending');
  });

  test('requeuing a failed fetch cannot erase the 15-second cooldown', async () => {
    advance(1000);
    await service.schedule('105', '2026-10-31');
    download.mockRejectedValueOnce(new Error('Network error'));
    await service.tick();
    await service.schedule('105', '2026-10-31');
    await service.tick();
    expect(download).toHaveBeenCalledTimes(1);
    advance(15000);
    await service.tick();
    expect(download).toHaveBeenCalledTimes(2);
    expect((await service.schedules())[0].status).toBe('completed');
  });

  test('routes validate input and CSRF, return JSON, and bold only changed viewer values', async () => {
    expect((await post('fetch', { cid: '14&other=x' })).status).toBe(400);
    expect(download).not.toHaveBeenCalled();
    expect((await request(app).post('/japan-post/api/fetch').send({ cid: 14 })).status).toBe(403);
    expect((await request(app).post('/japan-post/api/fetch').set('X-CSRF-Token', 'ä'.repeat(64)).send({ cid: 14 })).status).toBe(403);
    expect((await request(app).get('/japan-post').set('x-guest', '1')).status).toBe(401);
    expect((await post('schedules', { cids: '14', date: '2026-02-30' })).status).toBe(400);
    expect((await post('schedules', { cids: '14', date: '2026-10-30' })).status).toBe(400);
    const first = await post('fetch', { cid: 14 });
    expect(first.status).toBe(200);
    expect(first.body.latest.data.countryName).toContain('Australia');
    advance(86400000);
    download.mockResolvedValue(australia.replace('20kgまで', '21kgまで'));
    expect((await post('fetch', { cid: 14 })).status).toBe(200);
    const viewer = await request(app).get('/japan-post/database');
    expect(viewer.status).toBe(200);
    const $ = cheerio.load(viewer.text);
    expect($('td strong').map((_, el) => $(el).text()).get()).toEqual(['21 kg']);
    expect($('td strong').attr('title')).toBe('Previously: 20 kg');
    expect((await request(app).get('/japan-post')).status).toBe(200);
    expect((await request(app).get('/japan-post/api/countries/14')).body.history).toHaveLength(2);
    await post('schedules', { cids: '14', date: '2026-11-02' });
    const job = (await service.schedules())[0];
    expect((await post(`schedules/${job.id}/cancel`, {})).status).toBe(200);
    expect((await post(`schedules/${job.id}/cancel`, {})).status).toBe(409);
  });
});
