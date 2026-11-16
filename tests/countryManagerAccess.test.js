const express = require('express');
const request = require('supertest');
const path = require('path');
const cheerio = require('cheerio');
const createRouter = require('../routes/country');
const { resolveCountry, mappingCountries, cutoff, sources } = require('../utils/countryManager');

const token = 'a'.repeat(64);
let app, service;

beforeEach(() => {
  const country = { countryCode: '001', countryName: 'Test country' };
  const state = {
    website: [country],
    internal: [{ ...country, DHL: true, AIT: false, ECMS: null }],
    mappings: [],
    exceptions: [{ countryCode: '001', method: 'DHL', enabled: false, reason: 'Temporary suspension' }],
  };
  service = {
    read: jest.fn(async query => ({
      state, rows: [resolveCountry(country, state, [])], allCountries: [country], jp: [],
      revision: 1, at: cutoff(query.at), baseline: new Date('2026-11-01'), hiddenMethods: ['ECMS'],
      mappingCountries: mappingCountries(state), autoMapCandidates: [],
      missingInternal: 0, missingMapping: 1, missingJapanPost: 0,
    })),
    history: jest.fn().mockResolvedValue([]),
    save: jest.fn().mockResolvedValue({ changed: 1, revision: 2 }),
    importCsv: jest.fn().mockResolvedValue({ changed: 1, revision: 2 }),
    saveMethodVisibility: jest.fn().mockResolvedValue({ changed: 1, revision: 2 }),
  };
  app = express();
  app.set('view engine', 'pug');
  app.set('views', path.join(__dirname, '../views'));
  app.use(express.json());
  app.use(require('express-fileupload')());
  app.use((req, res, next) => {
    req.user = req.get('x-guest') ? null : { userid: 'Tester', role: req.get('x-role') || 'user' };
    req.session = { countryManagerCsrf: token };
    Object.assign(res.locals, { signedIn: Boolean(req.user), name: 'Tester', role: req.user && req.user.role, currentPath: req.path });
    next();
  });
  app.use('/country', createRouter(service));
});

test.each(['/country', '/country/countries', '/country?q=Test&at=2026-11-01'])('regular users can view %s without manager controls', async url => {
  const response = await request(app).get(url);
  expect(response.status).toBe(200);
  const $ = cheerio.load(response.text);
  expect($('html').attr('data-color-mode')).toBe('dark');
  expect($('#country-manager h1').text()).toBe('Shipping availability');
  expect($('.cm-matrix a').text()).toBe('Test country');
  expect($('.cm-matrix a').attr('href')).toMatch(/^\/country\/country\/001/);
  expect($('.cm-matrix [data-method="ECMS"][hidden]')).toHaveLength(2);
  expect($('.cm-matrix').text()).toContain('Unavailable ★');
  expect($('.cm-filters input[name="q"]')).toHaveLength(1);
  expect($('.cm-filters input[name="at"]')).toHaveLength(1);
  expect($('#country-manager form[method="post"], #cm-exceptions, #cm-method-visibility, .cm-source')).toHaveLength(0);
  expect($('#country-manager').text()).not.toContain('Data tools');
  expect($('#country-manager').attr('data-csrf')).toBeUndefined();
  expect($('script[src="/javascripts/country-manager.js"]')).toHaveLength(0);
  expect($('.dropdown-menu[aria-labelledby="adminDropdown"] a[href="/country"]')).toHaveLength(0);
  if (url.includes('?')) expect(service.read).toHaveBeenCalledWith({ q: 'Test', at: '2026-11-01' });
});

test.each(['user', 'admin'])('%s can view country details and history', async role => {
  for (const url of ['/country/country/001', '/country/country/001?at=2026-11-01', '/country/history']) {
    const response = await request(app).get(url).set('x-role', role);
    expect(response.status).toBe(200);
    const $ = cheerio.load(response.text);
    expect($('#main-content form[method="post"]')).toHaveLength(0);
    if (url.includes('/001')) {
      expect(response.text).toContain('Temporary suspension');
      expect(response.text).toContain('Recorded history');
      expect(service.history).toHaveBeenCalledWith('001');
    }
  }
});

test('admins retain manager sections, navigation and current editing; historical views stay read-only', async () => {
  const current = await request(app).get('/country').set('x-role', 'admin');
  expect(current.status).toBe(200);
  const $ = cheerio.load(current.text);
  expect($('#country-manager h1').text()).toBe('Country & shipping-method manager');
  expect($('#cm-exceptions .cm-edit').length).toBeGreaterThan(0);
  expect($('#cm-method-visibility .cm-edit')).toHaveLength(1);
  expect($('#source-website, #source-internal, #source-mappings')).toHaveLength(3);
  expect($('#country-manager').attr('data-csrf')).toBe(token);
  expect($('.dropdown-menu[aria-labelledby="adminDropdown"] a[href="/country"]')).toHaveLength(1);
  const historical = await request(app).get('/country?at=2026-11-01').set('x-role', 'admin');
  expect(historical.status).toBe(200);
  expect(cheerio.load(historical.text)('#country-manager form[method="post"]')).toHaveLength(0);
});

const writes = sources.flatMap(source => [
  [`/country/api/${source}/save`, { action: 'save', countryCode: '001', countryName: 'Updated' }],
  [`/country/api/${source}/save`, { action: 'delete', countryCode: '001' }],
  [`/country/api/${source}/import`, null],
]).concat([
  ['/country/api/mappings/auto-map', {}],
  ['/country/api/method-visibility', { visibleMethods: ['DHL'] }],
]);

test.each(writes)('only admins with a valid CSRF token can write to %s (%j)', async (url, body) => {
  function send(role, csrf = token, guest = false) {
    const call = request(app).post(url).set('x-role', role).set('X-CSRF-Token', csrf);
    if (guest) call.set('x-guest', '1');
    return body === null
      ? call.field('revision', '1').attach('csvFile', Buffer.from('country,country_code\nTest,001'), 'test.csv')
      : call.send({ revision: 1, ...body, role: 'admin', canManageCountries: true });
  }
  expect((await send('admin', token, true)).status).toBe(401);
  const denied = await send('user');
  expect(denied.status).toBe(403);
  expect(denied.body.error).toContain('Administrator access');
  expect((await send('admin', '')).status).toBe(403);
  expect((await send('admin', 'b'.repeat(64))).status).toBe(403);
  for (const method of ['save', 'importCsv', 'saveMethodVisibility']) expect(service[method]).not.toHaveBeenCalled();
  expect((await send('admin')).status).toBe(200);
  const method = body === null ? 'importCsv' : url.endsWith('/method-visibility') ? 'saveMethodVisibility' : 'save';
  expect(service[method]).toHaveBeenCalledTimes(1);
  if (method !== 'saveMethodVisibility') expect(service[method].mock.calls[0][method === 'save' ? 2 : 3]).toBe('Tester');
});

test.each(['/country', '/country/country/001', '/country/history'])('viewing %s still requires app login', async url => {
  expect((await request(app).get(url).set('x-guest', '1')).status).toBe(401);
  expect(service.read).not.toHaveBeenCalled();
  expect(service.history).not.toHaveBeenCalled();
});
