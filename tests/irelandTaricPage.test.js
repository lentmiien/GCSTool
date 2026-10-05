jest.mock('../sequelize', () => ({ Op: require('sequelize').Op, HSCodeList: { findAll: jest.fn(async () => []), bulkCreate: jest.fn() },
  IrelandTaricMapping: { findAll: jest.fn(async () => []) }, IrelandTaricExplanation: { findAll: jest.fn(async () => []) } }));
jest.mock('csvtojson', () => () => ({ fromFile: async () => [] }));
const express = require('express');
const request = require('supertest');
const axios = require('axios');
const controller = require('../controllers/hsController');
const { IrelandTaricMapping } = require('../sequelize');
test('initial GET renders mappings and CSRF without predictor or AmiAmi HTTP calls', async () => {
  process.env.SESSION_SECRET = 'SYNTHETIC_SESSION_SECRET';
  const outgoing = jest.spyOn(axios, 'request');
  const app = express();
  app.set('views', 'views'); app.set('view engine', 'pug');
  app.get('/hs/ireland', (req, res, next) => { req.sessionID = 'synthetic'; res.locals.__ = value => value; next(); }, controller.ireland_editor);
  const result = await request(app).get('/hs/ireland');
  expect(result.status).toBe(200);
  expect(result.text).toContain('AI TARIC predictor');
  expect(result.text).toContain('/hs/ireland/taric-codes.csv');
  expect(result.text).not.toMatch(/TARIC_TOOL_KEY|TARIC_TOOL_BASE_URL|SYNTHETIC_SESSION_SECRET/);
  expect(outgoing).not.toHaveBeenCalled();
  outgoing.mockRestore();
});

test('TARIC export downloads a single column of unique codes', async () => {
  IrelandTaricMapping.findAll.mockResolvedValueOnce([
    { taricCode: '9503001000' },
    { taricCode: '9503001000' },
    { taricCode: '4901990000' },
    { taricCode: '' },
    { taricCode: null },
  ]);
  const app = express();
  app.get('/hs/ireland/taric-codes.csv', controller.ireland_export_taric_codes);

  const result = await request(app).get('/hs/ireland/taric-codes.csv');

  expect(result.status).toBe(200);
  expect(result.headers['content-type']).toMatch(/^text\/csv/);
  expect(result.headers['content-disposition']).toContain('attachment; filename="ireland-taric-codes.csv"');
  expect(result.text).toBe('taricCode\r\n"4901990000"\r\n"9503001000"\r\n');
});
