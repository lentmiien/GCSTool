jest.mock('../sequelize', () => ({ AppSetting: { findOne: jest.fn(), findAll: jest.fn(), findByPk: jest.fn() } }));
jest.mock('axios');
const axios = require('axios');
const express = require('express');
const request = require('supertest');
const { AppSetting } = require('../sequelize');
const { parseItems, buildLayers } = require('../public/javascripts/smallest-box-data');
const { buildRequest } = require('../services/smallestBox');
const router = require('../routes/smallestbox');
const settingsController = require('../controllers/appSettingsController');
const { catalog, result, input } = require('./fixtures/smallestBox');

function appFor(user = { role: 'admin' }) {
  const app = express();
  app.use(express.json());
  app.use(express.urlencoded({ extended: false }));
  app.set('views', 'views');
  app.set('view engine', 'pug');
  app.use((req, res, next) => { req.user = user; next(); });
  app.use('/smallest-box', router);
  app.get('/admin/app-settings', settingsController.index);
  app.post('/admin/app-settings/:id', settingsController.update);
  return app;
}
beforeEach(() => {
  axios.mockReset();
  AppSetting.findOne.mockResolvedValue({ value: 'synthetic-private-key' });
});

test('parses the exact paste format, CRLF, decimals, old underscore format, and repeated IDs', () => {
  const sample = 'GOODS-04825603 .07kg 235×154×9 \r\n1\r\nGOODS-04825608 .06kg 105×95×14 \r\n1\r\nGOODS-04825626 .16kg 156×90×82 \r\n1\r\nGOODS-04825607 .21kg 373×312×122 \r\n1\r\nGOODS-04825622 .29kg 186×85×60 \r\n1\r\nGOODS-04825615 .12kg 206×186×31 \r\n1\r\n';
  expect(parseItems(sample)).toHaveLength(6);
  expect(parseItems(sample)[0]).toEqual({ id: 'GOODS-04825603', weight: 0.07, w: 235, d: 154, h: 9, qty: 1 });
  expect(parseItems('item .5kg_10×20×30 \n2\nitem .5kg 10×20×30\n3')[0].qty).toBe(5);
  expect(parseItems('item 0kg 1.5×2×3\n1')[0].w).toBe(1.5);
});

test.each([
  ['', 'Paste'], ['a .1kg 1×2×3', 'two lines'], ['a .1kg 0×2×3\n1', 'dimensions'],
  ['a .1kg 1×2×3\n1.5', 'whole number'], ['a .1kg 1×2×3\n0', 'whole number'],
  ['a .1kg 1×2×3\n201', '200 total'], ['a 1000001kg 1×2×3\n1', 'weight'],
  ['a .1kg 1×2×3\n1\na .1kg 1×2×4\n1', 'different dimensions'],
  ['a .1kg 1×2×3\n1\n\nb .1kg 1×2×3\n1', 'two lines'],
])('rejects malformed input %j', (text, error) => expect(() => parseItems(text)).toThrow(error));

test('enforces API limits and emits only documented fields', () => {
  expect(buildRequest({ provideitems: input, revision: 99, containers: [], tagFilter: { require: [' Fold-Box '], requireNot: ['tube'] } })).toEqual({
    items: parseItems(input), algorithm: 'laff', tagFilter: { require: ['fold-box'], requireNot: ['tube'] },
  });
  expect(() => buildRequest({ provideitems: 'a 0kg 1×2×3\n8', algorithm: 'bruteforce' })).toThrow('7 total');
  expect(() => buildRequest({ provideitems: input, algorithm: 'invalid' })).toThrow('supported');
  expect(() => buildRequest({ provideitems: input, tagFilter: { require: Array(21).fill('tag') } })).toThrow('20 valid');
  expect(() => buildRequest({ provideitems: input, tagFilter: { requireNot: ['<script>'] } })).toThrow('valid tags');
  expect(() => parseItems(Array.from({ length: 101 }, (_, i) => `item-${i} 0kg 1×2×3\n1`).join('\n'))).toThrow('100 item types');
});

test('layers group by bottom z, regardless of item height, ordered bottom to top', () => {
  const layers = buildLayers(result.data.pallets[0].placements);
  expect(layers.map((layer) => [layer.z, layer.items.length])).toEqual([[0, 2], [50, 1]]);
});

test('requires authentication for page, catalog, and searches', async () => {
  for (const path of ['/smallest-box', '/smallest-box/containers']) expect((await request(appFor(null)).get(path)).status).toBe(401);
  expect((await request(appFor(null)).post('/smallest-box/pack').send({ provideitems: input })).status).toBe(401);
  expect(axios).not.toHaveBeenCalled();
});

test('proxies catalog and searches with a backend key and 75 second timeout', async () => {
  axios.mockResolvedValueOnce({ status: 200, data: catalog }).mockResolvedValueOnce({ status: 200, data: result });
  const app = appFor();
  const boxes = await request(app).get('/smallest-box/containers');
  expect(boxes.body).toEqual(catalog);
  expect(boxes.headers['cache-control']).toBe('private, no-store');
  expect(axios.mock.calls[0][0]).toMatchObject({ method: 'GET', url: 'https://my.lentmiien.com/api/binpacking-smallest/containers', timeout: 75000, maxRedirects: 0, headers: { Authorization: 'Bearer synthetic-private-key' } });
  const packed = await request(app).post('/smallest-box/pack').send({ provideitems: input });
  expect(packed.body).toEqual(result);
  expect(axios.mock.calls[1][0].data.items).toEqual(parseItems(input));
  expect(packed.text).not.toContain('synthetic-private-key');
});

test('missing credentials and invalid input do not make API calls', async () => {
  AppSetting.findOne.mockResolvedValueOnce(null);
  expect((await request(appFor()).get('/smallest-box/containers')).body.message).toContain('App settings');
  expect((await request(appFor()).post('/smallest-box/pack').send({ provideitems: 'bad' })).status).toBe(400);
  expect(axios).not.toHaveBeenCalled();
});

test.each([400, 401, 404, 413, 429, 503])('handles API status %i without leaking upstream credentials', async (status) => {
  axios.mockResolvedValue({ status, data: { message: 'synthetic-private-key' }, headers: { 'retry-after': '17' } });
  const response = await request(appFor()).post('/smallest-box/pack').send({ provideitems: input });
  expect(response.status).toBe(status);
  expect(response.headers['retry-after']).toBe('17');
  expect(response.text).not.toContain('synthetic-private-key');
});

test('supports no-fit, non-JSON responses, network failures, and timeout failures', async () => {
  const app = appFor();
  axios.mockResolvedValueOnce({ status: 200, data: { success: false, message: 'No fit', meta: {} } });
  expect((await request(app).post('/smallest-box/pack').send({ provideitems: input })).body.success).toBe(false);
  axios.mockResolvedValueOnce({ status: 200, data: '<html>Proxy failure</html>' });
  expect((await request(app).get('/smallest-box/containers')).status).toBe(502);
  axios.mockRejectedValueOnce({ code: 'ECONNABORTED', config: { secret: 'synthetic-private-key' } });
  expect((await request(app).get('/smallest-box/containers')).body.message).toContain('timed out');
  axios.mockRejectedValueOnce(new Error('synthetic-private-key'));
  const response = await request(app).get('/smallest-box/containers');
  expect(response.status).toBe(503);
  expect(response.text).not.toContain('synthetic-private-key');
});

test('permits only one search at a time and releases the lock after completion', async () => {
  let finish;
  let started;
  const pending = new Promise((resolve) => { started = resolve; });
  axios.mockImplementationOnce(() => { started(); return new Promise((resolve) => { finish = resolve; }); });
  const app = appFor();
  const first = request(app).post('/smallest-box/pack').send({ provideitems: input }).then((value) => value);
  await pending;
  expect((await request(app).post('/smallest-box/pack').send({ provideitems: input })).status).toBe(429);
  finish({ status: 200, data: result });
  expect((await first).status).toBe(200);
  axios.mockResolvedValueOnce({ status: 200, data: result });
  expect((await request(app).post('/smallest-box/pack').send({ provideitems: input })).status).toBe(200);
});

test('admin key is masked, blank preserves it, explicit removal clears it, and staff cannot edit it', async () => {
  const update = jest.fn();
  const setting = { id: 1, key: 'SMALLEST_BOX_API_KEY', value: 'synthetic-private-key', update };
  AppSetting.findAll.mockResolvedValue([setting]);
  AppSetting.findByPk.mockResolvedValue(setting);
  const app = appFor();
  const page = await request(app).get('/admin/app-settings');
  expect(page.text).toContain('type="password"');
  expect(page.text).not.toContain('synthetic-private-key');
  await request(app).post('/admin/app-settings/1').send({ value: '' });
  expect(update).not.toHaveBeenCalled();
  await request(app).post('/admin/app-settings/1').send({ value: 'replacement' });
  expect(update).toHaveBeenLastCalledWith({ value: 'replacement' });
  await request(app).post('/admin/app-settings/1').send({ clearSecret: 'yes' });
  expect(update).toHaveBeenLastCalledWith({ value: '' });
  expect((await request(appFor({ role: 'staff' })).post('/admin/app-settings/1').send({ value: 'blocked' })).status).toBe(403);
  expect(update).toHaveBeenCalledTimes(2);
});
