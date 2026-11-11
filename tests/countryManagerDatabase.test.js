// Only an explicitly configured disposable database is used. Never import app.js or sequelize.js.
const Sequelize = require('sequelize');
const express = require('express');
const request = require('supertest');
const path = require('path');
const cheerio = require('cheerio');
const { methods } = require('../utils/countryManager');
const { createService } = require('../services/countryManager');
const createRouter = require('../routes/country');
const suite = process.env.COUNTRY_MANAGER_TEST_MYSQL_PORT ? describe : describe.skip;

suite('country manager database, history and HTTP', () => {
  let db, models, service, clock, app;
  const token = 'a'.repeat(64);
  beforeAll(async () => {
    db = new Sequelize('gcs_country_test', 'root', '', { host: '127.0.0.1', port: Number(process.env.COUNTRY_MANAGER_TEST_MYSQL_PORT), dialect: 'mysql', logging: false });
    models = { sequelize: db, ...require('../models/countryManager')(db, Sequelize),
      OfficialCountryList: require('../models/OfficialCountryList')(db, Sequelize),
      InternalCountryList: require('../models/InternalCountryList')(db, Sequelize),
      JapanPostCsvCache: require('../models/japanPostCsvCache')(db, Sequelize),
      AppSetting: require('../models/appSetting')(db, Sequelize) };
    await db.sync({ force: true });
  });
  afterAll(async () => { if (db) await db.close(); });
  beforeEach(async () => {
    for (const model of Object.values(models).filter(value => value !== db)) await model.destroy({ where: {} });
    await models.OfficialCountryList.create({ countryCode: '001', countryName: 'Website name' });
    await models.InternalCountryList.bulkCreate([
      { countryCode: '001', countryName: 'Old internal', countryNameJ: '旧', DHLAvailability: 0, AITAvailability: 0, createdAt: new Date('2026-01-01') },
      { countryCode: '001', countryName: 'Internal name', countryNameJ: '国', DHLAvailability: 1, AITAvailability: 0, createdAt: new Date('2026-02-01') },
      { countryCode: '002', countryName: 'Internal only', DHLAvailability: 0, AITAvailability: 1 },
    ]);
    await models.JapanPostCsvCache.bulkCreate(['US', 'AU'].map(countryCode => ({ countryCode,
      data: { '国名（英語）': countryCode, 'EMS取扱フラグ': countryCode === 'US' ? '1' : '0' }, sourceName: 'test.csv', detectedAt: new Date('2026-10-01'), lastCheckedAt: new Date('2026-10-01') })));
    clock = new Date('2026-11-01T00:00:00Z');
    service = createService(models, { now: () => clock });
    app = express();
    app.set('view engine', 'pug');
    app.set('views', path.join(__dirname, '../views'));
    app.use(express.json());
    app.use(require('express-fileupload')());
    app.use((req, res, next) => {
      req.user = req.get('x-guest') ? null : { userid: 'Tester' };
      req.session = { countryManagerCsrf: token };
      Object.assign(res.locals, { signedIn: true, name: 'Tester', role: 'user', currentPath: '/country' });
      next();
    });
    app.use('/country', createRouter(service));
    app.use((error, req, res, next) => res.status(error.status || 500).send(error.message));
  });
  async function save(source, input) {
    const { revision } = await service.read();
    clock = new Date(clock.getTime() + 1000);
    return service.save(source, { revision, action: 'save', ...input }, 'Tester');
  }
  const value = (view, method) => view.rows[0].methods.find(row => row.key === method).value;

  test('first access from concurrent service instances creates exactly one baseline', async () => {
    const views = await Promise.all([service.read(), createService(models, { now: () => clock }).read()]);
    expect(views.map(view => view.revision)).toEqual([1, 1]);
    expect(await models.CountryManagerVersion.count()).toBe(4);
  });

  test('baseline uses website scope and latest internal row, retains codes and marks missing data unknown', async () => {
    const view = await service.read();
    expect(view.rows.map(row => row.countryCode)).toEqual(['001']);
    expect(view.state.internal).toHaveLength(2);
    expect(view.rows[0].countryName).toBe('Website name');
    expect(value(view, 'DHL')).toBe(true);
    expect(value(view, 'ECMS')).toBe(null);
    expect(value(view, 'ems')).toBe(null);
    expect(await models.InternalCountryList.count()).toBe(3);
    await service.read();
    expect(await models.CountryManagerVersion.count()).toBe(4);
    expect((await service.read({ at: '2026-10-31' })).rows).toEqual([]);
  });

  test('mapping, Japan Post changes, override and removal reproduce historical availability', async () => {
    await save('mappings', { countryCode: '001', jpCode: 'US' });
    const mappedAt = clock.toISOString();
    expect(value(await service.read(), 'ems')).toBe(true);
    await save('exceptions', { countryCode: '001', method: 'ems', enabled: '0', reason: 'Temporary block' });
    const blockedAt = clock.toISOString();
    await save('mappings', { countryCode: '001', jpCode: 'AU' });
    await save('exceptions', { countryCode: '001', method: 'ems', enabled: '1', reason: 'Manual enable' });
    expect(value(await service.read(), 'ems')).toBe(true);
    await save('exceptions', { action: 'delete', countryCode: '001', method: 'ems' });
    expect(value(await service.read(), 'ems')).toBe(false);
    expect(value(await service.read({ at: mappedAt }), 'ems')).toBe(true);
    expect(value(await service.read({ at: blockedAt }), 'ems')).toBe(false);
    clock = new Date(clock.getTime() + 1000);
    await models.JapanPostCsvCache.create({ countryCode: 'AU', data: { '国名（英語）': 'AU', 'EMS取扱フラグ': '1' }, sourceName: 'updated.csv', detectedAt: clock, lastCheckedAt: clock });
    expect(value(await service.read(), 'ems')).toBe(true);
    expect((await service.history('001')).some(event => event.source === 'Japan Post' && event.note.includes('AU'))).toBe(true);
    expect(value(await service.read({ at: blockedAt }), 'ems')).toBe(false);
  });

  test('CSV replacements track every field, missing countries and unchanged imports', async () => {
    const website = Buffer.from('country,country_code\nRenamed,001\nNew country,003');
    const baseline = await service.read();
    clock = new Date('2026-11-02');
    await service.importCsv('website', { revision: baseline.revision }, website, 'Tester');
    const internal = Buffer.from('country,country_code,country_j,DHL,AIT,ECMS\nNew name,001,新,1,1,0');
    await service.importCsv('internal', { revision: (await service.read()).revision }, internal, 'Tester');
    expect((await service.read()).state.internal).toEqual([{ countryCode: '001', countryName: 'New name', countryNameJ: '新', DHL: true, AIT: true, ECMS: false }]);
    const count = await models.CountryManagerVersion.count();
    expect(await service.importCsv('internal', { revision: (await service.read()).revision }, internal, 'Tester')).toMatchObject({ changed: 0 });
    expect(await models.CountryManagerVersion.count()).toBe(count);
    expect((await service.read({ at: '2026-11-01' })).rows[0].countryName).toBe('Website name');
    expect((await service.history()).some(event => event.changes.some(row => row.countryCode === '002' && row.action === 'Removed'))).toBe(true);
    await save('website', { action: 'delete', countryCode: '001' });
    expect((await service.read()).rows.map(row => row.countryCode)).toEqual(['003']);
  });

  test('all writes roll back on failure and stale concurrent saves cannot overwrite one another', async () => {
    const { revision } = await service.read();
    const update = jest.spyOn(models.CountryManagerState.prototype, 'update').mockRejectedValueOnce(new Error('Simulated failure'));
    try { await expect(service.save('website', { action: 'save', revision, countryCode: '001', countryName: 'Lost' }, 'Tester')).rejects.toThrow('Simulated'); }
    finally { update.mockRestore(); }
    expect((await service.read()).rows[0].countryName).toBe('Website name');
    expect(await models.CountryManagerVersion.count()).toBe(4);
    const results = await Promise.allSettled(['First', 'Second'].map(countryName => service.save('website', { action: 'save', revision, countryCode: '001', countryName }, 'Tester')));
    expect(results.filter(result => result.status === 'fulfilled')).toHaveLength(1);
    expect(results.find(result => result.status === 'rejected').reason.status).toBe(409);
    expect(await models.CountryManagerVersion.count()).toBe(5);
  });

  test('references must exist, many internal codes can share a JP code, orphan exceptions remain removable', async () => {
    await expect(save('mappings', { countryCode: '001', jpCode: 'ZZ' })).rejects.toThrow('no imported');
    await expect(save('exceptions', { countryCode: 'missing', method: 'DHL', enabled: '0', reason: 'Test' })).rejects.toThrow('first');
    for (const countryCode of ['001', '002']) await save('mappings', { countryCode, jpCode: 'US' });
    for (const countryCode of ['001', '002']) await save('exceptions', { countryCode, method: 'DHL', enabled: '0', reason: 'Test' });
    await save('internal', { action: 'delete', countryCode: '002' });
    await save('exceptions', { action: 'delete', countryCode: '001', method: 'DHL' });
    await save('exceptions', { action: 'delete', countryCode: '002', method: 'DHL' });
    expect((await service.read()).state.exceptions).toEqual([]);
  });

  test('HTTP enforces auth and CSRF, imports valid files, renders escaped history and disables historical editing', async () => {
    expect((await request(app).get('/country').set('x-guest', '1')).status).toBe(401);
    expect((await request(app).post('/country/api/website/save').send({})).status).toBe(403);
    const initial = await request(app).get('/country');
    expect(initial.status).toBe(200);
    expect(initial.text).toContain('Exceptions (0)');
    const revision = (await service.read()).revision;
    const result = await request(app).post('/country/api/website/import').set('X-CSRF-Token', token).field('revision', String(revision)).attach('csvFile', Buffer.from('country,country_code\n<script>alert(1)</script>,001'), 'test.csv');
    expect(result.status).toBe(200);
    const current = await request(app).get('/country');
    expect(current.text).toContain('&lt;script&gt;');
    expect(current.text).not.toContain('<script>alert(1)</script>');
    expect((await request(app).get('/country/country/001')).status).toBe(200);
    expect((await request(app).get('/country/history')).status).toBe(200);
    const historical = await request(app).get('/country?at=2026-11-01');
    expect(historical.status).toBe(200);
    expect(historical.text).not.toContain('class="cm-edit');
    expect((await request(app).post('/country/japanPostCountryList/update').set('X-CSRF-Token', token)).status).toBe(404);
  });

  test('auto-mapping adds website matches atomically, preserves existing links, and records history only for changes', async () => {
    await save('website', { countryCode: '001', countryName: ' us ' });
    await save('website', { countryCode: '003', countryName: 'AU' });
    await save('mappings', { countryCode: '003', jpCode: 'US' });
    await save('internal', { countryCode: '002', countryName: 'AU', DHL: '1', AIT: '0', ECMS: '' });
    const before = await service.read();
    clock = new Date(clock.getTime() + 1000);
    const send = revision => request(app).post('/country/api/mappings/auto-map').set('X-CSRF-Token', token).send({ revision });
    expect((await request(app).post('/country/api/mappings/auto-map').send({ revision: before.revision })).status).toBe(403);
    expect((await send(before.revision)).body.changed).toBe(1);
    const after = await service.read();
    expect(after.state.mappings).toEqual([{ countryCode: '001', jpCode: 'US' }, { countryCode: '003', jpCode: 'US' }]);
    expect(after.mappingCountries.map(row => row.countryCode)).toEqual(['002', '001', '003']);
    expect(value(after, 'ems')).toBe(true);
    expect((await service.read({ at: new Date(clock.getTime() - 1).toISOString() })).state.mappings).toHaveLength(1);
    const history = await service.history('001');
    expect(history[0].note).toBe('Auto-mapped exact English names');
    const count = await models.CountryManagerVersion.count();
    expect((await send(before.revision)).status).toBe(409);
    expect((await send(after.revision)).body.changed).toBe(0);
    expect(await models.CountryManagerVersion.count()).toBe(count);
  });

  test('auto-mapping rolls back the entire batch when recording the revision fails', async () => {
    await save('website', { countryCode: '001', countryName: 'US' });
    await save('website', { countryCode: '003', countryName: 'AU' });
    const before = await service.read();
    expect(before.autoMapCandidates).toHaveLength(2);
    const update = jest.spyOn(models.CountryManagerState.prototype, 'update').mockRejectedValueOnce(new Error('Simulated failure'));
    try { await expect(service.save('mappings', { revision: before.revision, action: 'auto-map' }, 'Tester')).rejects.toThrow('Simulated'); }
    finally { update.mockRestore(); }
    expect((await service.read()).state.mappings).toEqual([]);
    expect((await service.read()).revision).toBe(before.revision);
  });

  test('method visibility is shared across service instances and current/historical pages without changing availability', async () => {
    const before = await service.read();
    expect(before.hiddenMethods).toEqual([]);
    const selection = methods.filter(method => !['DHL', 'salParcel'].includes(method.key)).map(method => method.key);
    const endpoint = '/country/api/method-visibility';
    expect((await request(app).post(endpoint).send({ revision: before.revision, visibleMethods: selection })).status).toBe(403);
    const response = await request(app).post(endpoint).set('X-CSRF-Token', token).send({ revision: before.revision, visibleMethods: selection });
    expect(response.status).toBe(200);
    expect(response.body.changed).toBe(1);
    const fresh = createService(models, { now: () => clock });
    const after = await fresh.read();
    expect(after.hiddenMethods).toEqual(['DHL', 'salParcel']);
    expect(value(after, 'DHL')).toBe(true);
    expect(await models.CountryManagerVersion.count()).toBe(4);
    for (const url of ['/country', '/country?at=2026-11-01']) {
      const page = await request(app).get(url);
      expect(page.status).toBe(200);
      const $ = cheerio.load(page.text);
      expect($('.cm-matrix [data-method="DHL"][hidden]')).toHaveLength(2);
      expect($('.cm-matrix [data-method="ems"][hidden]')).toHaveLength(0);
    }
    await expect(fresh.saveMethodVisibility({ revision: before.revision, visibleMethods: selection })).rejects.toMatchObject({ status: 409 });
    await expect(fresh.saveMethodVisibility({ revision: after.revision, visibleMethods: ['invalid'] })).rejects.toThrow('supported');
    expect(await fresh.saveMethodVisibility({ revision: after.revision, visibleMethods: selection })).toMatchObject({ changed: 0 });
    await fresh.saveMethodVisibility({ revision: after.revision });
    expect((await service.read()).hiddenMethods).toHaveLength(methods.length);
    await fresh.saveMethodVisibility({ revision: (await service.read()).revision, visibleMethods: methods.map(method => method.key) });
    expect((await service.read()).hiddenMethods).toEqual([]);
  });

  test('shared visibility rolls back on failure and serializes competing edits', async () => {
    const { revision } = await service.read();
    const update = jest.spyOn(models.CountryManagerState.prototype, 'update').mockRejectedValueOnce(new Error('Simulated failure'));
    try { await expect(service.saveMethodVisibility({ revision, visibleMethods: 'DHL' })).rejects.toThrow('Simulated'); }
    finally { update.mockRestore(); }
    expect((await service.read()).hiddenMethods).toEqual([]);
    const results = await Promise.allSettled(['DHL', 'ECMS'].map(visibleMethods => service.saveMethodVisibility({ revision, visibleMethods })));
    expect(results.filter(result => result.status === 'fulfilled')).toHaveLength(1);
    expect(results.find(result => result.status === 'rejected').reason.status).toBe(409);
  });

  test('exceptions start collapsed with unique country names and mapping rows and choices prioritize unmapped codes', async () => {
    await save('website', { countryCode: '003', countryName: 'Unmapped website' });
    await save('mappings', { countryCode: '001', jpCode: 'US' });
    await save('exceptions', { countryCode: '001', method: 'DHL', enabled: '0', reason: 'First reason' });
    await save('exceptions', { countryCode: '001', method: 'ems', enabled: '0', reason: 'Second reason' });
    const page = await request(app).get('/country');
    expect(page.status).toBe(200);
    const $ = cheerio.load(page.text);
    expect($('#cm-exceptions').attr('open')).toBeUndefined();
    expect($('#cm-exceptions > summary .cm-exception-country').map((_, entry) => $(entry).text()).get()).toEqual(['Website name']);
    expect($('#cm-exceptions > summary').text()).not.toContain('First reason');
    const tableCodes = $('#source-mappings > .table-responsive tbody tr > td:first-child').map((_, entry) => $(entry).text()).get();
    expect(tableCodes).toEqual(['003', '002', '001']);
    const optionCodes = $('#source-mappings .cm-add select[name="countryCode"] option').map((_, entry) => $(entry).attr('value')).get();
    expect(optionCodes).toEqual(['', '003', '002', '001']);
  });
});
