/** @jest-environment jsdom */
jest.mock('../sequelize', () => ({
  Entry: { findAll: jest.fn() },
  Content: {},
  pmt: { PMTEntry: { findAll: jest.fn() } },
  Op: { gt: Symbol.for('gt'), or: Symbol.for('or') },
}));

const fs = require('fs');
const pug = require('pug');
const { Entry, pmt, Op } = require('../sequelize');
const controller = require('../controllers/indexController');
const render = pug.compileFile('views/index.pug');
const record = data => ({ get: () => data });
const rawTemplate = '\n# Reply\n\n**Hello** | 日本語 & <script>example</script>\n';
const rssItem = (title, date, link = 'https://www.post.japanpost.jp/news/example.html') => ({
  title: [title], pubDate: [date], link: [link],
});

async function mount({ role = 'user', jp = [], holidays = [] } = {}) {
  const locals = { jp, role, name: 'alice', holidays_next_week: holidays };
  const res = { locals, render: jest.fn((_view, data) => {
    document.documentElement.innerHTML = render({ ...locals, ...data });
  }) };
  const next = jest.fn();
  await controller.index({ user: { userid: 'alice', team: 'mail', role } }, res, next);
  expect(next).not.toHaveBeenCalled();
  return res.render.mock.calls[0][1];
}

beforeEach(() => {
  jest.useFakeTimers().setSystemTime(new Date('2026-10-05T12:00:00Z'));
  window.Loaded = () => {};
  window.eval(fs.readFileSync('public/javascripts/GCSTool.js', 'utf8'));
  Entry.findAll.mockResolvedValue([record({
    id: 1, title: 'Content update', category: 'manual', tag: '_work_related_',
    createdAt: new Date('2026-09-10'), updatedAt: new Date('2026-10-02'),
    ismaster: true, creator: 'alice', contents: [{ id: 2, data: '<p>Second</p>' }, { id: 1, data: '<p>First</p>' }],
  })]);
  pmt.PMTEntry.findAll.mockResolvedValue(['Policy', 'Manual', 'Template'].map((type, index) => record({
    id: index + 1, type, title: `${type} update`, category: '_work_related_',
    content_md: type === 'Template' ? rawTemplate : '# Guidance\n\n**Read this**\n\n<script>alert(1)</script>',
    current_version: 2, createdAt: new Date('2026-09-15'), updatedAt: new Date(`2026-10-0${index + 1}`),
  })));
});

afterEach(() => { jest.useRealTimers(); });

test('merges recent news newest first and keeps content visibility rules', async () => {
  const data = await mount({ jp: [
    rssItem('Recent postal update', 'Sun, 04 Oct 2026 09:00:00 GMT'),
    rssItem('Older postal update', 'Sat, 01 Aug 2026 09:00:00 GMT'),
    rssItem('Unsafe link', 'Sun, 04 Oct 2026 09:00:00 GMT', 'javascript:alert(1)'),
  ] });
  expect(data.newsItems.map(item => item.title)).toEqual([
    'Recent postal update', 'Template update', 'Content update', 'Manual update', 'Policy update',
  ]);
  const contentWhere = Entry.findAll.mock.calls[0][0].where;
  expect(contentWhere.team).toBe('mail');
  expect(contentWhere[Op.or]).toEqual([{ ismaster: true }, { creator: 'alice' }]);
  expect(contentWhere.updatedAt[Op.gt]).toEqual(new Date(2026, 8, 5));
  expect(pmt.PMTEntry.findAll.mock.calls[0][0].where).toEqual({ updatedAt: contentWhere.updatedAt });
  expect(document.querySelector('.home-summary-label + strong').textContent).toBe('5');
  expect(document.querySelector('#entry1 .home-entry-manual').textContent).toBe('First');
  const postalLink = document.querySelector('.home-updates .home-japan-post-update');
  expect(postalLink.tagName).toBe('A');
  expect(postalLink.target).toBe('_blank');
  expect(postalLink.rel).toBe('noopener noreferrer');
  expect(document.querySelector('#older-japan-post-news').classList.contains('show')).toBe(false);
  expect(document.querySelector('#older-japan-post-news').textContent).toContain('Older postal update');
  expect(document.querySelector('#older-japan-post-news').textContent).not.toContain('Unsafe link');
  expect(document.querySelector('.app-notice-region')).toBeNull();
});

test('admin content query remains team scoped without private-entry restriction', async () => {
  await mount({ role: 'admin' });
  expect(Entry.findAll.mock.calls[0][0].where.team).toBe('mail');
  expect(Entry.findAll.mock.calls[0][0].where[Op.or]).toBeUndefined();
});

test('library entries expand independently, render safe Markdown, and copy exact template text', async () => {
  await mount();
  for (const id of [1, 2]) {
    const detail = document.querySelector(`#pmt-entry${id}`);
    expect(detail.style.display).toBe('none');
    document.querySelector(`[aria-controls="pmt-entry${id}"]`).click();
    expect(detail.style.display).toBe('block');
    expect(document.querySelector(`[aria-controls="pmt-entry${id}"]`).getAttribute('aria-expanded')).toBe('true');
    expect(detail.querySelector('h1').textContent).toBe('Guidance');
    expect(detail.querySelector('strong').textContent).toBe('Read this');
    expect(detail.querySelector('script')).toBeNull();
    document.querySelector(`[aria-controls="pmt-entry${id}"]`).click();
    expect(detail.style.display).toBe('none');
  }
  expect(document.querySelector('#entry1').style.display).toBe('none');
  document.querySelector('[aria-controls="pmt-entry3"]').click();
  const textarea = document.querySelector('#pmt-entry3 textarea');
  expect(textarea.value).toBe(rawTemplate);
  document.execCommand = jest.fn(() => true);
  textarea.click();
  expect(document.execCommand).toHaveBeenCalledWith('copy');
  expect(textarea.value.slice(textarea.selectionStart, textarea.selectionEnd)).toBe(rawTemplate);
  expect(document.querySelector('#pmt-entry3 a').getAttribute('href')).toBe('/pmt/details/3');
});

test('holiday work is pinned before updates, with admin copy controls preserved', async () => {
  await mount({ role: 'admin', holidays: [{
    date: '2026-10-12', work_staff: ['alice'], message_title: 'Holiday work', message_body: 'Staff|Alice',
  }] });
  const notice = document.querySelector('.home-pinned-notice');
  expect(notice.textContent).toContain('次の10日間の祝日出勤');
  expect(notice.textContent).toContain('2026-10-12: alice');
  expect(notice.nextElementSibling.className).toBe('home-entry-list');
  expect(notice.querySelectorAll('button')).toHaveLength(3);
  expect(document.querySelectorAll('#holiday-news-title')).toHaveLength(1);
});

test('empty staffing is hidden and an empty news feed renders cleanly', async () => {
  Entry.findAll.mockResolvedValue([]);
  pmt.PMTEntry.findAll.mockResolvedValue([]);
  await mount({ holidays: [{ date: '2026-10-12', work_staff: [] }] });
  expect(document.querySelector('.home-pinned-notice')).toBeNull();
  expect(document.querySelector('.app-empty-state').textContent).toContain('No recent updates');
  expect(document.querySelector('.home-news')).toBeNull();
});

test('database failures use the normal error handler', async () => {
  const error = new Error('Unavailable');
  pmt.PMTEntry.findAll.mockRejectedValueOnce(error);
  const next = jest.fn();
  const res = { locals: {}, render: jest.fn() };
  await controller.index({ user: { userid: 'alice', team: 'mail' } }, res, next);
  expect(next).toHaveBeenCalledWith(error);
  expect(res.render).not.toHaveBeenCalled();
});
