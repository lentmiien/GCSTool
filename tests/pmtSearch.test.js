jest.mock('../sequelize', () => ({
  pmt: { PMTEntry: { findAll: jest.fn() }, PMTLog: { findAll: jest.fn() } },
  Entry: { findAll: jest.fn() },
  Content: {},
  Op: require('sequelize').Op,
}));

const express = require('express');
const request = require('supertest');
const { Sequelize } = require('sequelize');
const { pmt, Entry } = require('../sequelize');
const service = require('../services/DocMgmtService');
const parseSearchTerms = require('../utils/parseSearchTerms');
const queryGenerator = new Sequelize('test', 'test', '', { dialect: 'mysql', logging: false })
  .getQueryInterface().queryGenerator;

beforeEach(() => {
  pmt.PMTEntry.findAll.mockResolvedValue([]);
  pmt.PMTLog.findAll.mockResolvedValue([]);
  Entry.findAll.mockResolvedValue([]);
});

test.each([
  ['word1', ['word1']],
  ['word1 word2', ['word1', 'word2']],
  ['"word1 word2"', ['word1 word2']],
  ['"word1 word2" word3', ['word1 word2', 'word3']],
  [' word1\tword2\n"word3 word4" ', ['word1', 'word2', 'word3 word4']],
  ['"word1 word2" "word3 word4"', ['word1 word2', 'word3 word4']],
  ['word1 "word2 word3', ['word1', 'word2 word3']],
  ['  ""  ', []],
  ['"日本語 テンプレート" 100% foo_bar', ['日本語 テンプレート', '100%', 'foo_bar']],
])('search %j requires every word or complete phrase in either database field', async (search, terms) => {
  expect(parseSearchTerms(search)).toEqual(terms);
  await service.fetchEntries({ search });
  const options = pmt.PMTEntry.findAll.mock.calls[0][0];
  const sql = queryGenerator.selectQuery('pmt_entries', options);
  if (terms.length) {
    const clauses = terms.map(term =>
      `(LOCATE(${queryGenerator.escape(term)}, \`title\`) > 0 OR LOCATE(${queryGenerator.escape(term)}, \`content_md\`) > 0)`);
    expect(sql).toContain(`WHERE (${clauses.join(' AND ')})`);
    expect(options.limit).toBeUndefined();
  } else {
    expect(sql).not.toContain('WHERE');
    expect(options.limit).toBe(25);
  }
});

test('text search combines with Type and Category and safely escapes literal input', async () => {
  await service.fetchEntries({ type: 'Template', category: '_work_related_', search: '"100%_\\path\'s"' });
  const sql = queryGenerator.selectQuery('pmt_entries', pmt.PMTEntry.findAll.mock.calls[0][0]);
  expect(sql).toContain("`type` = 'Template'");
  expect(sql).toContain("`category` = '_work_related_'");
  expect(sql).toContain(`LOCATE(${queryGenerator.escape("100%_\\path's")}, \`content_md\`) > 0`);
  expect(sql).not.toContain('LIKE');
});

function app() {
  const application = express();
  application.use((req, res, next) => {
    req.user = { userid: 'alice', role: 'user', team: 'mail' };
    res.render = (_view, locals) => res.json(locals);
    next();
  });
  application.use('/pmt', require('../routes/pmt'));
  return application;
}

test('GET /pmt retains the search and filters legacy records with the same word and phrase rules', async () => {
  Entry.findAll.mockResolvedValue([
    { id: 1, title: 'word1 word2', contents: [{ data: 'word3' }] },
    { id: 2, title: 'word3', contents: [{ data: 'WORD1 WORD2' }] },
    { id: 3, title: 'word1 word2', contents: [{ data: 'unrelated' }] },
    { id: 4, title: 'word1 word3', contents: [{ data: 'word2' }] },
  ].map(entry => ({ get: () => ({ category: 'template', ...entry }) })));
  const response = await request(app()).get('/pmt').query({ search: '"word1 word2" word3', type: 'Template' }).expect(200);
  expect(response.body.query.search).toBe('"word1 word2" word3');
  expect(response.body.entries.map(entry => entry.id)).toEqual([1, 2]);
  expect(pmt.PMTEntry.findAll.mock.calls[0][0].limit).toBeUndefined();
});

test.each([{ search: ['word1', 'word2'] }, { search: { nested: 'word1' } }])('non-string search parameters are ignored safely: %j', async query => {
  const response = await request(app()).get('/pmt').query(query).expect(200);
  expect(response.body.query.search).toBe('');
  expect(pmt.PMTEntry.findAll.mock.calls[0][0].limit).toBe(25);
});
