/** @jest-environment jsdom */
jest.mock('../sequelize', () => ({
  Entry: { findAll: jest.fn(), findOne: jest.fn(), create: jest.fn(), bulkCreate: jest.fn() },
  Content: {},
  pmt: { PMTEntry: { findAll: jest.fn() } },
  Op: { or: Symbol.for('or') },
}));
jest.mock('../services/DocMgmtService', () => ({
  fetchEntries: jest.fn(), fetchAllLogs: jest.fn(), fetchPolicies: jest.fn(), createEntry: jest.fn(),
}));

global.TextEncoder = require('util').TextEncoder;
const express = require('express');
const request = require('supertest');
const pug = require('pug');
const fs = require('fs');
const { Entry, pmt, Op } = require('../sequelize');
const service = require('../services/DocMgmtService');
const entryController = require('../controllers/entryController');
const pmtController = require('../controllers/pmtController');
const user = { userid: 'alice', team: 'mail', role: 'user' };
const rawText = '\n# Hello **customer** & 日本語\n<script>example</script>\n';
const record = data => ({ get: () => data });
const legacy = (overrides = {}) => ({
  id: 1, title: 'Legacy <title>', category: 'manual', tag: '_work_related_',
  team: 'mail', creator: 'alice', ismaster: true, updatedAt: new Date('2026-01-01'),
  contents: [{ id: 2, data: '<p>Second</p>' }, { id: 1, data: '<h2>First</h2>' }],
  ...overrides,
});
const render = Object.fromEntries(['entry', 'pmt/pmt', 'pmt/legacy', 'pmt/create'].map(view =>
  [view, pug.compileFile(`views/${view}.pug`)]));

function invoke(handler, { query = {}, params = {}, ...overrides } = {}) {
  return new Promise((resolve, reject) => {
    handler({ user, query, params, ...overrides }, {
      render: (view, data) => resolve({ view, data }),
      redirect: url => resolve({ url }),
    }, reject);
  });
}
function mount({ view, data }) {
  document.documentElement.innerHTML = render[view]({ role: 'user', name: 'alice', ...data });
  window.Loaded = () => {};
  window.eval(fs.readFileSync('public/javascripts/GCSTool.js', 'utf8'));
  window.Loaded = () => {};
}

beforeEach(() => {
  Entry.findAll.mockResolvedValue([record(legacy())]);
  Entry.findOne.mockResolvedValue(record(legacy()));
  service.fetchEntries.mockResolvedValue([]);
  service.fetchAllLogs.mockResolvedValue([]);
  service.fetchPolicies.mockResolvedValue([]);
  pmt.PMTEntry.findAll.mockResolvedValue(['Policy', 'Manual', 'Template'].map((type, index) => record({
    id: index + 1, title: `${type} guidance`, type, category: '_work_related_',
    content_md: type === 'Template' ? rawText : '# Guidance\n\n**Read this**\n<script>bad()</script>',
  })));
});

test('Content includes all PMT entries, uses distinct IDs, and keeps foreign entries read only', async () => {
  mount(await invoke(entryController.entry_list));
  expect(document.querySelectorAll('article.entry')).toHaveLength(4);
  expect(document.querySelector('.app-page-actions button').disabled).toBe(true);
  expect(document.querySelector('#entry1 a[href="/entry/1/update"]')).not.toBeNull();
  for (const id of [1, 2]) {
    const detail = document.querySelector(`#pmt-entry${id}`);
    expect(detail.querySelector('h1').textContent).toBe('Guidance');
    expect(detail.querySelector('script')).toBeNull();
    expect(detail.querySelectorAll('a')).toHaveLength(1);
    expect(detail.querySelector('a').getAttribute('href')).toBe(`/pmt/details/${id}`);
    window.DisplayEntry(`pmt-entry${id}`);
    expect(detail.style.display).toBe('block');
  }
  expect(document.querySelector('#entry1').style.display).toBe('none');
  expect(document.querySelector('#pmt-entry3 textarea').value).toBe(rawText);
  expect(document.querySelector('#pmt-entry3 textarea').readOnly).toBe(true);
  expect(pmt.PMTEntry.findAll.mock.calls[0][0].limit).toBeUndefined();
});

test('Content search, categories, type controls, clear and back include PMT policies', async () => {
  mount(await invoke(entryController.entry_list));
  const policy = document.querySelector('#pmt-entry1').closest('article');
  window.Filter();
  expect(policy.style.display).toBe('block');
  document.querySelector('#s_policy').checked = false;
  window.Filter();
  expect(policy.style.display).toBe('none');
  window.SetFilter('', '_', 'true', 'true', 'true');
  window.SetFilterBack();
  expect(document.querySelector('#s_policy').checked).toBe(false);
  window.Clear();
  document.querySelector('#s_box').value = 'policy+read this';
  window.Filter();
  expect(policy.style.display).toBe('block');
  expect(document.querySelector('#entry1').closest('article').style.display).toBe('none');
  document.querySelector('#s_tag').value = '_feedback_';
  window.Filter();
  expect(policy.style.display).toBe('none');
});

test.each(['user', 'guest', 'admin'])('legacy listing and direct reads preserve %s visibility', async role => {
  const currentUser = { ...user, role };
  await invoke(entryController.entry_list, { user: currentUser });
  await invoke(pmtController.top, { user: currentUser });
  await invoke(pmtController.legacyDetails, { user: currentUser, params: { id: '1' } });
  await invoke(pmtController.create, { user: currentUser, query: { legacy: '1' } });
  for (const { where } of [...Entry.findAll.mock.calls, ...Entry.findOne.mock.calls].map(call => call[0])) {
    expect(where.team).toBe('mail');
    expect(where[Op.or]).toEqual(role === 'admin' ? undefined : [{ ismaster: true }, { creator: 'alice' }]);
  }
});

test('PMT combines both sources without exposing legacy edit, version or dependency controls', async () => {
  service.fetchEntries.mockResolvedValue([{
    id: 1, title: 'Native PMT', type: 'Policy', category: '_work_related_', current_version: 2,
    updatedAt: new Date(), content_md: '# Current',
  }]);
  mount(await invoke(pmtController.top));
  const cards = document.querySelectorAll('.pmt-entry-card');
  expect(cards).toHaveLength(2);
  expect(cards[0].querySelector('a[href="/pmt/edit/1"]')).not.toBeNull();
  expect(cards[1].textContent).toContain('Legacy Content · Read only');
  expect(cards[1].querySelector('a[href="/pmt/legacy/1"]')).not.toBeNull();
  expect(cards[1].querySelector('a[href="/pmt/create?legacy=1"]')).not.toBeNull();
  expect(cards[1].querySelector('a[href="/pmt/edit/1"]')).toBeNull();
  expect(cards[1].querySelector('.entry-manual').innerHTML).toBe('<h2>First</h2>');
});

test.each(['template', 'ccontact'])('%s is a raw legacy Template with every part in the prefilled form', async category => {
  const data = legacy({ category, contents: [{ id: 2, data: 'Next part' }, { id: 1, data: rawText }] });
  Entry.findAll.mockResolvedValue([record(data)]);
  Entry.findOne.mockResolvedValue(record(data));
  mount(await invoke(pmtController.legacyDetails, { params: { id: '1' } }));
  expect(document.querySelector('textarea').value).toBe(rawText);
  expect(document.querySelector('textarea').readOnly).toBe(true);
  mount(await invoke(pmtController.create, { query: { legacy: '1' } }));
  expect(document.querySelector('#title').value).toBe(data.title);
  expect(document.querySelector('#type').value).toBe('Template');
  expect(document.querySelector('#category').value).toBe('_work_related_');
  expect(document.querySelector('#content_md').value).toBe(`${rawText}\n\nNext part`);
  expect(document.querySelector('#content_md').dataset.format).toBe('text');
});

test('PMT type and category filters normalize legacy company contacts', async () => {
  Entry.findAll.mockResolvedValue([record(legacy()), record(legacy({ id: 2, category: 'ccontact' }))]);
  const result = await invoke(pmtController.top, { query: { type: 'Template', category: '_work_related_' } });
  expect(result.data.entries.map(entry => entry.id)).toEqual([2]);
  expect(Entry.findAll.mock.calls[0][0].where.tag).toBe('_work_related_');
  expect((await invoke(pmtController.top, { query: { type: 'Policy' } })).data.entries).toEqual([]);
});

test.each([pmtController.legacyDetails, pmtController.create])('inaccessible legacy entries return 404 and malformed IDs return 400', async handler => {
  Entry.findOne.mockResolvedValue(null);
  await expect(invoke(handler, { query: { legacy: '9' }, params: { id: '9' } })).rejects.toMatchObject({ status: 404 });
  await expect(invoke(handler, { query: { legacy: '../1' }, params: { id: '../1' } })).rejects.toMatchObject({ status: 400 });
});

test('manual prefill uses HTML conversion, templates use Markdown, and Save submits the edited draft', async () => {
  const editor = { setHTML: jest.fn(), setMarkdown: jest.fn(), getMarkdown: jest.fn(() => 'Edited content') };
  window.toastui = { Editor: jest.fn(() => editor) };
  mount(await invoke(pmtController.create, { query: { legacy: '1' } }));
  window.eval(fs.readFileSync('public/js/pmt/create.js', 'utf8'));
  expect(editor.setHTML).toHaveBeenCalledWith('<h2>First</h2>\n\n<p>Second</p>');
  document.querySelector('#form').dispatchEvent(new Event('submit'));
  expect(document.querySelector('#content_md').value).toBe('Edited content');
  expect(Entry.create).not.toHaveBeenCalled();
  expect(service.createEntry).not.toHaveBeenCalled();
});

test('plain PMT creation still supports type and parent selection', async () => {
  service.fetchPolicies.mockResolvedValue([{ id: 5, title: 'Parent & policy' }]);
  mount(await invoke(pmtController.create, { query: { type: 'Manual', parent: '5' } }));
  expect(document.querySelector('#type').value).toBe('Manual');
  expect(document.querySelector('#policies').value).toBe('5');
  expect(document.querySelector('#title').value).toBe('');
  expect(document.querySelector('#content_md').value).toBe('');
});

test('legacy creation and restore writes are blocked while old create links redirect to PMT', async () => {
  const app = express();
  app.use((req, res, next) => { req.user = user; res.render = (_view, data) => res.send(data); next(); });
  app.use('/entry', require('../routes/entry'));
  await request(app).post('/entry/create').send({ title: 'Forbidden' }).expect(403);
  await request(app).post('/entry/restore').send({ restore: '[]' }).expect(403);
  await request(app).get('/entry/create').expect(302).expect('Location', '/pmt/create');
  await request(app).get('/entry/1/createcopy').expect(302).expect('Location', '/pmt/create?legacy=1');
  expect(Entry.create).not.toHaveBeenCalled();
  expect(Entry.bulkCreate).not.toHaveBeenCalled();
});
