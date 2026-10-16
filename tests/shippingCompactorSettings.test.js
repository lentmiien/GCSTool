jest.mock('../sequelize', () => ({
  AppSetting: { findOne: jest.fn(), findByPk: jest.fn(), create: jest.fn(), findAll: jest.fn() },
  HSCodeList: { findAll: jest.fn(async () => []), bulkCreate: jest.fn() },
}));
jest.mock('csvtojson', () => () => ({ fromFile: async () => [] }));
const express = require('express');
const request = require('supertest');
const vm = require('vm');
const { AppSetting } = require('../sequelize');
const controller = require('../controllers/hsController');
const settingsController = require('../controllers/appSettingsController');
const {
  APP_SETTING_KEYS, DEFAULT_APP_SETTINGS, parseShippingCompactorCountries,
  getShippingCompactorCountries, seedAppSettings,
} = require('../services/appSettings');
const key = APP_SETTING_KEYS.SHIPPING_COMPACTOR_COUNTRIES;

function appFor(role = 'admin') {
  const app = express();
  app.use(express.urlencoded({ extended: false }));
  app.set('views', 'views');
  app.set('view engine', 'pug');
  app.use((req, res, next) => {
    req.user = { role };
    res.locals.role = role;
    res.locals.__ = (value) => value;
    next();
  });
  app.get('/hs/compact', controller.shipping_compactor);
  app.get('/hs/compact/download', controller.shipping_compactor_download);
  app.get('/admin/app-settings', settingsController.index);
  app.post('/admin/app-settings', settingsController.create);
  app.post('/admin/app-settings/:id', settingsController.update);
  app.use((error, req, res, next) => res.status(500).send('Settings unavailable'));
  return app;
}

test('parses comma-separated codes, normalizes case and removes duplicates', () => {
  expect(parseShippingCompactorCountries('ie, GR, ie, , de\n')).toEqual(['IE', 'GR', 'DE']);
  expect(parseShippingCompactorCountries('')).toEqual([]);
  expect(() => parseShippingCompactorCountries('IE, <script>')).toThrow('two-letter');
  expect(() => parseShippingCompactorCountries('IE GR')).toThrow('comma-separated');
});

test('seeds an editable broad Europe default without overwriting existing values', async () => {
  const model = { findOrCreate: jest.fn() };
  await seedAppSettings(model);
  expect(model.findOrCreate).toHaveBeenCalledWith({ where: { key }, defaults: { value: DEFAULT_APP_SETTINGS[key] } });
  AppSetting.findOne.mockResolvedValue(null);
  const countries = await getShippingCompactorCountries(AppSetting);
  expect(countries).toEqual(expect.arrayContaining(['IE', 'GR', 'GB', 'NO', 'CH', 'TR', 'UA']));
  expect(countries).not.toContain('US');
  AppSetting.findOne.mockResolvedValue({ value: '' });
  expect(await getShippingCompactorCountries(AppSetting)).toEqual([]);
});

test('page and each fresh HTML download use the current database setting', async () => {
  const app = appFor();
  AppSetting.findOne.mockResolvedValue({ value: 'ie, gr, IE' });
  const page = await request(app).get('/hs/compact');
  expect(page.status).toBe(200);
  expect(page.text).toContain('Processed countries: IE, GR');
  for (const value of ['IE, GR', 'DE', '']) {
    AppSetting.findOne.mockResolvedValue({ value });
    const response = await request(app).get('/hs/compact/download');
    expect(response.status).toBe(200);
    expect(response.headers['content-type']).toMatch(/^text\/html/);
    expect(response.headers['content-disposition']).toContain('attachment; filename="shipping_csv_compactor_ja.html"');
    expect(response.headers['cache-control']).toBe('no-store');
    expect(response.text).toContain(`const configuredCountryCodes = ${JSON.stringify(parseShippingCompactorCountries(value))};`);
    expect(response.text).not.toContain('/* SHIPPING_COMPACTOR_COUNTRIES */');
    const context = { module: { exports: {} } };
    vm.runInNewContext(response.text.match(/<script>([\s\S]*?)<\/script>/)[1], context);
    expect(typeof context.module.exports.compactCsv).toBe('function');
  }
});

test('database failures and malformed stored codes cannot produce an unfiltered download', async () => {
  const app = appFor();
  AppSetting.findOne.mockRejectedValueOnce(new Error('offline'));
  expect((await request(app).get('/hs/compact')).status).toBe(500);
  AppSetting.findOne.mockResolvedValue({ value: '</script>' });
  expect((await request(app).get('/hs/compact/download')).status).toBe(500);
});

test('admin can save a normalized list or empty list, but invalid codes are rejected', async () => {
  const update = jest.fn();
  AppSetting.findByPk.mockResolvedValue({ key, update });
  const app = appFor();
  let response = await request(app).post('/admin/app-settings/1').type('form').send({ value: 'ie, gr, IE' });
  expect(response.status).toBe(303);
  expect(update).toHaveBeenLastCalledWith({ value: 'IE, GR' });
  response = await request(app).post('/admin/app-settings/1').type('form').send({ value: '' });
  expect(update).toHaveBeenLastCalledWith({ value: '' });
  response = await request(app).post('/admin/app-settings/1').type('form').send({ value: 'IE, USA' });
  expect(response.headers.location).toContain('?error=');
  expect(update).toHaveBeenCalledTimes(2);
  response = await request(app).post('/admin/app-settings').type('form').send({ key, value: 'de, FR, de' });
  expect(response.status).toBe(303);
  expect(AppSetting.create).toHaveBeenCalledWith({ key, value: 'DE, FR' });
});

test('country settings render a textarea and remain admin-only', async () => {
  AppSetting.findAll.mockResolvedValue([{ id: 1, key, value: 'IE, GR' }]);
  const response = await request(appFor()).get('/admin/app-settings');
  expect(response.status).toBe(200);
  expect(response.text).toContain('<textarea');
  expect(response.text).toContain(`id="${key}"`);
  const denied = await request(appFor('staff')).post('/admin/app-settings/1').type('form').send({ value: 'IE' });
  expect(denied.status).toBe(403);
  expect(AppSetting.findByPk).not.toHaveBeenCalled();
});
