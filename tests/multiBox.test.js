jest.mock('../sequelize', () => ({ AppSetting: { findOne: jest.fn() } }));
jest.mock('axios');
const axios = require('axios');
const express = require('express');
const session = require('express-session');
const request = require('supertest');
const { AppSetting } = require('../sequelize');
const { parseItems, placement } = require('../public/javascripts/multi-box-data');
const { buildRequest } = require('../services/multiBox');
const router = require('../routes/multibox');
const { input, jobId, catalog, rigid, queued, completed } = require('./fixtures/multiBox');
const csvHeader = 'id,width,height,depth,quantity,weight,value,rotation,shrink,soft,fragile';

function appFor(user = { id: 1 }) {
  const app = express();
  app.use(express.json());
  app.use(session({ secret: 'test-multi-box-session-secret', resave: false, saveUninitialized: false }));
  app.use((req, res, next) => { req.user = user; next(); });
  app.set('views', 'views');
  app.set('view engine', 'pug');
  app.use('/multi-box', router);
  return app;
}
beforeEach(() => {
  axios.mockReset();
  AppSetting.findOne.mockResolvedValue({ value: 'synthetic-private-key' });
});

test('converts pasted W×D×H mm to named API cm fields, merging quantities with defaults', () => {
  expect(parseItems(`${input}\nGOODS-04825603 .07kg_235×154×9\n3`)).toEqual([{
    id: 'GOODS-04825603', width: 23.5, height: 0.9, depth: 15.4, quantity: 5, weight: 0.07,
    value: 0, rotation: 'orthogonal', shrink: 0, soft: false, fragile: false,
  }]);
  expect(parseItems('item 0kg 1×2×3\n500')[0].quantity).toBe(500);
  expect(() => parseItems('item 0kg 1×2×3\n501')).toThrow('500 total');
  expect(() => parseItems('item 0kg 0.09×2×3\n1')).toThrow('width');
});

test('CSV exposes all item fields and handles quotes, BOM, CRLF and blank defaults', () => {
  const items = parseItems(`\uFEFF${csvHeader}\r\n"Poster, ""A""",440,30,30,2,.18,1500,free,0,false,true\r\nSweater,280,60,220,,,0,orthogonal,20,true,false\r\n`, 'csv');
  expect(items[0]).toEqual({ id: 'Poster, "A"', width: 44, height: 3, depth: 3, quantity: 2, weight: 0.18, value: 1500, rotation: 'free', shrink: 0, soft: false, fragile: true });
  expect(items[1]).toMatchObject({ width: 28, height: 6, depth: 22, quantity: 1, weight: 0, shrink: 20, soft: true });
  expect(parseItems('id,depth,width,height\na,200,300,100', 'csv')[0]).toMatchObject({ width: 30, height: 10, depth: 20 });
});

test.each([
  ['id,width,height,unknown\na,1,2,3', 'header'],
  ['id,width,height,depth,width\na,1,2,3,4', 'header'],
  ['id,width,height,depth\na,1,2', 'cells'],
  ['id,width,height,depth\n"unclosed,1,2,3', 'unclosed'],
  ['id,width,height,depth\n"a"oops,1,2,3', 'quoting'],
  ['id,width,height,depth\na,,2,3', 'number'],
  ['id,width,height,depth\na,NaN,2,3', 'number'],
  ['id,width,height,depth\na,1,2,3\na,1,2,3', 'unique'],
  [`${csvHeader}\na,1,2,3,1,0,0,diagonal,0,false,false`, 'rotation'],
  [`${csvHeader}\na,1,2,3,1,0,0,free,96,false,false`, 'shrink'],
  [`${csvHeader}\na,1,2,3,1,0,0,free,0,yes,false`, 'true or false'],
  [`${csvHeader}\na,1,2,3,1,-1,0,free,0,false,false`, 'weight'],
  [`${csvHeader}\na,1,2,3,1,0,2000000001,free,0,false,false`, 'value'],
  [`${csvHeader}\na,1,2,3,300,0,0,free,0,false,false\nb,1,2,3,201,0,0,free,0,false,false`, '500'],
])('rejects invalid CSV: %s', (text, message) => expect(() => parseItems(text, 'csv')).toThrow(message));

test('converts only length options and emits the API request shape', () => {
  expect(buildRequest({ provideitems: input, options: { approach: 'space', margin: 10, maxSide: 600, maxSum: 1500, maxWeight: 10, maxValue: 5000 }, boxIds: ['Box S'] })).toEqual({
    items: parseItems(input), options: { approach: 'space', margin: 1, maxSide: 60, maxSum: 150, maxWeight: 10, maxValue: 5000 }, boxIds: ['Box S'],
  });
  expect(buildRequest({ provideitems: input }).options).toEqual({ approach: 'boxes', margin: 1, maxSide: null, maxSum: null, maxWeight: null, maxValue: null });
  expect(buildRequest({ provideitems: input, options: { margin: 0, maxWeight: 0, maxValue: 0 } }).options.margin).toBe(0);
  for (const options of [{ margin: null }, { margin: '10' }, { margin: -1 }, { margin: 100001 }, { maxSide: 0 }, { maxValue: 1e13 }, { approach: 'invalid' }, []]) {
    expect(() => buildRequest({ provideitems: input, options })).toThrow();
  }
  for (const boxIds of [[], ['a', 'a'], Array(51).fill('a'), [''], [42]]) expect(() => buildRequest({ provideitems: input, boxIds })).toThrow('box IDs');
});

test('preview data retains free rotation, accepts vector objects, and excludes soft items', () => {
  const matrix = [[0.707, 0, 0.707], [0, 1, 0], [-0.707, 0, 0.707]];
  expect(placement({ ...rigid, center: { x: 1, y: 2, z: 3 }, orientation: { matrix } })).toEqual({ center: [1, 2, 3], dimensions: rigid.dimensions, matrix: matrix.flat() });
  expect(placement({ ...rigid, soft: true })).toBeNull();
  expect(placement({ ...rigid, center: [0, NaN, 0] })).toBeNull();
  expect(placement({ id: 'soft' })).toBeNull();
});

test('requires authentication for page, catalog, submission and polling', async () => {
  const app = appFor(null);
  for (const path of ['', '/containers', `/jobs/${jobId}`]) expect((await request(app).get(`/multi-box${path}`)).status).toBe(401);
  expect((await request(app).post('/multi-box/jobs').send({ provideitems: input })).status).toBe(401);
  expect(axios).not.toHaveBeenCalled();
});

test('loads the new page and shared cm catalog using the existing server-side key', async () => {
  axios.mockResolvedValue({ status: 200, data: catalog });
  const app = appFor();
  expect((await request(app).get('/multi-box')).text).toContain('Multi-box packer');
  const response = await request(app).get('/multi-box/containers');
  expect(response.body).toEqual(catalog);
  expect(response.headers['cache-control']).toBe('private, no-store');
  expect(axios.mock.calls[0][0]).toMatchObject({ method: 'GET', url: 'https://my.lentmiien.com/api/binpacking-multi/containers', maxRedirects: 0, headers: { Authorization: 'Bearer synthetic-private-key' } });
  expect(response.text).not.toContain('synthetic-private-key');
});

test('submits once, persists session ownership, polls only owned jobs, and returns all boxes', async () => {
  const app = appFor();
  const owner = request.agent(app);
  const foreign = request.agent(app);
  axios.mockResolvedValueOnce({ status: 202, data: { ...queued } });
  const submitted = await owner.post('/multi-box/jobs').send({ provideitems: input });
  expect(submitted.status).toBe(202);
  expect(submitted.headers['retry-after']).toBe('5');
  expect(submitted.body.statusUrl).toBe(`/multi-box/jobs/${jobId}`);
  expect(axios.mock.calls[0][0].data.items[0].height).toBe(0.9);
  expect((await foreign.get(`/multi-box/jobs/${jobId}`)).status).toBe(404);
  expect((await owner.get('/multi-box/jobs/invalid')).status).toBe(400);
  expect(axios).toHaveBeenCalledTimes(1);
  axios.mockResolvedValueOnce({ status: 200, data: { ...completed } });
  const response = await owner.get(`/multi-box/jobs/${jobId}`);
  expect(response.body.result.boxes).toHaveLength(2);
  expect(axios.mock.calls[1][0].url).toBe(`https://my.lentmiien.com/api/binpacking-multi/jobs/${jobId}`);
});

test.each([400, 401, 403, 413, 429, 503])('safely forwards HTTP %s and Retry-After without submission retries', async (status) => {
  axios.mockResolvedValue({ status, data: { message: 'synthetic-private-key' }, headers: { 'retry-after': '17' } });
  const response = await request(appFor()).post('/multi-box/jobs').send({ provideitems: input });
  expect(response.status).toBe(status);
  expect(response.headers['retry-after']).toBe('17');
  expect(response.text).not.toContain('synthetic-private-key');
  expect(axios).toHaveBeenCalledTimes(1);
});

test('network errors explain ambiguous submissions, and malformed plans are rejected', async () => {
  axios.mockRejectedValueOnce(new Error('synthetic-private-key'));
  let response = await request(appFor()).post('/multi-box/jobs').send({ provideitems: input });
  expect(response.status).toBe(503);
  expect(response.text).toContain('may have been accepted');
  expect(response.text).not.toContain('synthetic-private-key');
  expect(axios).toHaveBeenCalledTimes(1);
  axios.mockResolvedValueOnce({ status: 202, data: { ...completed, result: { boxes: [{}], unplaced: [] } } });
  response = await request(appFor()).post('/multi-box/jobs').send({ provideitems: input });
  expect(response.status).toBe(502);
});

test('rejects missing credentials and malformed input without contacting the provider', async () => {
  AppSetting.findOne.mockResolvedValueOnce(null);
  expect((await request(appFor()).get('/multi-box/containers')).status).toBe(503);
  expect((await request(appFor()).post('/multi-box/jobs').send({ provideitems: 'bad' })).status).toBe(400);
  expect(axios).not.toHaveBeenCalled();
});

test('enforces the UTF-8 byte limit after expanding optional defaults into the API payload', () => {
  const text = `id,width,height,depth,weight,value\n${Array.from({ length: 500 }, (_, index) => `${'界'.repeat(116)}${index},1000000,1000000,1000000,1000000000000,2000000000`).join('\n')}`;
  expect(text.length).toBeLessThan(262144);
  expect(() => buildRequest({ provideitems: text, format: 'csv' })).toThrow('256 KiB');
});
