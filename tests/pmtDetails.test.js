/** @jest-environment jsdom */
jest.mock('../services/DocMgmtService', () => ({
  fetchEntry: jest.fn(),
  fetchRelatedEntries: jest.fn(),
  fetchEntries: jest.fn(),
  fetchAllLogs: jest.fn(),
}));

jest.mock('../services/legacyContentService', () => ({ fetchEntries: jest.fn() }));

const fs = require('fs');
const pug = require('pug');
const service = require('../services/DocMgmtService');
const legacyContent = require('../services/legacyContentService');
const controller = require('../controllers/pmtController');
const render = pug.compileFile('views/pmt/details.pug');
const latestMarkdown = '# Reply\n\n**Hello** & "thanks"!\n\n```html\n<script>alert("test")</script>\n```';
const oldMarkdown = '\n# Old reply\n\n- 日本語\n- [Link](https://example.com)\n';

async function mount(type = 'Template', overrides = {}, relatedEntries) {
  const parent = { id: 1, type: 'Policy', title: 'Parent', content_md: 'Parent guidance' };
  const template = { id: 4, type: 'Template', title: 'Sibling template', content_md: latestMarkdown };
  service.fetchEntry.mockResolvedValue({
    entry: { id: 3, type, title: 'Current document', content_md: latestMarkdown },
    versions: [{ version_number: 1, createdAt: new Date('2026-01-01'), content_md: oldMarkdown }],
    logs: [],
    parents: [{ parent_id: 1 }], parentEntries: [parent],
    children: [], childEntries: [],
    ...overrides,
  });
  service.fetchRelatedEntries.mockResolvedValue(relatedEntries || [template]);
  const locals = await new Promise((resolve, reject) => {
    controller.details({ params: { id: '3' } }, { render: (_view, data) => resolve(data) }, reject);
  });
  document.documentElement.innerHTML = render(locals);
  window.eval(fs.readFileSync('public/js/pmt/pmt.js', 'utf8'));
  window.eval(fs.readFileSync('public/js/pmt/details.js', 'utf8'));
  return locals;
}

beforeEach(() => {
  window.Loaded = () => {};
  Object.defineProperty(navigator, 'clipboard', {
    configurable: true, value: { writeText: jest.fn().mockResolvedValue(undefined) },
  });
});

test.each(['Policy', 'Manual', 'Template'])('%s displays related documents and working preview targets', async type => {
  await mount(type);
  expect(service.fetchRelatedEntries).toHaveBeenCalledWith(3, [1]);
  expect(document.querySelector('.pmt-related-panel').textContent).toContain('Related documents');
  expect(document.querySelector('[data-target="#m4"]').textContent).toContain('Template');
  expect(document.querySelector('#m4 .modal-title').textContent).toBe('Sibling template');
  expect(Boolean(document.querySelector('#copy-markdown'))).toBe(type === 'Template');
  expect(document.querySelector('#m1 [data-md]')).toBeNull();
});

test('template detail copies raw Markdown for latest, historical, and reselected latest versions', async () => {
  await mount();
  const button = document.querySelector('#copy-markdown');
  const version = document.querySelector('#version');
  await window.CopySelectedVersion(button);
  expect(navigator.clipboard.writeText).toHaveBeenLastCalledWith(latestMarkdown);
  expect(button.textContent).toBe('Copied!');
  version.selectedIndex = 1;
  window.UpdateVersion(version);
  expect(button.textContent).toBe('Copy');
  expect(document.querySelector('#content h1').textContent).toBe('Old reply');
  await window.CopySelectedVersion(button);
  expect(navigator.clipboard.writeText).toHaveBeenLastCalledWith(oldMarkdown);
  version.selectedIndex = 0;
  window.UpdateVersion(version);
  await window.CopySelectedVersion(button);
  expect(navigator.clipboard.writeText).toHaveBeenLastCalledWith(latestMarkdown);
});

test('template preview copies original Markdown, including markup, without executing it', async () => {
  await mount('Manual');
  const button = document.querySelector('#m4 .modal-header button[data-md]');
  await window.CopyThis(button, 'md');
  expect(navigator.clipboard.writeText).toHaveBeenCalledWith(latestMarkdown);
  expect(document.querySelector('#m4 .modal-body script')).toBeNull();
});

test('overlapping child and related documents have one modal and child type labels', async () => {
  const children = ['Template', 'Manual', 'Policy'].map((type, index) => ({
    id: index + 4, type, title: type, content_md: type,
  }));
  await mount('Policy', {
    children: children.map(child => ({ child_id: child.id })), childEntries: children,
  });
  expect(document.querySelectorAll('#m4')).toHaveLength(1);
  const heading = [...document.querySelectorAll('h2')].find(node => node.textContent === 'Child documents');
  expect([...heading.nextElementSibling.querySelectorAll('.pmt-document-type')].map(node => node.textContent))
    .toEqual(['Template', 'Manual', 'Policy']);
});

test('a document without parents has no related section', async () => {
  await mount('Manual', { parents: [], parentEntries: [] }, []);
  expect(document.querySelector('.pmt-related-panel').textContent).not.toContain('Related documents');
});

test('a document without siblings shows an empty related section', async () => {
  await mount('Manual', {}, []);
  expect(document.querySelector('.pmt-related-panel').textContent).toContain('Related documents');
  expect(document.querySelector('.pmt-related-panel').textContent).toContain('No other documents');
});

test('an empty historical template copies an empty string', async () => {
  await mount('Template', {
    versions: [{ version_number: 1, createdAt: new Date('2026-01-01'), content_md: '' }],
  });
  const version = document.querySelector('#version');
  version.selectedIndex = 1;
  window.UpdateVersion(version);
  await window.CopySelectedVersion(document.querySelector('#copy-markdown'));
  expect(navigator.clipboard.writeText).toHaveBeenCalledWith('');
});

test('failed clipboard writes report failure and allow retry', async () => {
  await mount();
  navigator.clipboard.writeText.mockRejectedValueOnce(new Error('Permission denied'));
  const button = document.querySelector('#copy-markdown');
  await window.CopySelectedVersion(button);
  expect(button.textContent).toBe('Copy failed — retry');
  expect(button.disabled).toBe(false);
  await window.CopySelectedVersion(button);
  expect(button.textContent).toBe('Copied!');
});

test('HTTP clipboard fallback selects raw text inside the modal and cleans up', async () => {
  await mount();
  Object.defineProperty(navigator, 'clipboard', { configurable: true, value: undefined });
  const button = document.querySelector('#m4 [data-md]');
  document.execCommand = jest.fn(() => {
    const textarea = document.querySelector('#m4 textarea');
    expect(textarea.value).toBe(latestMarkdown);
    expect(textarea.selectionEnd).toBe(latestMarkdown.length);
    return true;
  });
  await window.CopyThis(button, 'md');
  expect(document.execCommand).toHaveBeenCalledWith('copy');
  expect(document.querySelector('textarea')).toBeNull();
  expect(button.textContent).toBe('Copied!');
});

test('template title and body render and copy separately across version changes', async () => {
  const body = '\nDear **customer**,\nThank you!\nRegards,\nSupport\n';
  const content = `Title: Your order & "update"\n${body}`;
  await mount('Template', {
    entry: { id: 3, type: 'Template', title: 'Order reply', content_md: content },
  });
  const checkParts = async () => {
    expect(document.querySelector('#content .pmt-template-title').textContent).toBe('Your order & "update"');
    expect(document.querySelectorAll('#content .pmt-template-body br')).toHaveLength(3);
    expect(document.querySelector('#content .pmt-template-body strong').textContent).toBe('customer');
    await window.CopyThis(document.querySelector('#content [aria-label="Copy title"]'), 'md');
    expect(navigator.clipboard.writeText).toHaveBeenLastCalledWith('Your order & "update"');
    await window.CopyThis(document.querySelector('#content [aria-label="Copy body"]'), 'md');
    expect(navigator.clipboard.writeText).toHaveBeenLastCalledWith(body);
    await window.CopySelectedVersion(document.querySelector('#copy-markdown'));
    expect(navigator.clipboard.writeText).toHaveBeenLastCalledWith(content);
  };
  await checkParts();
  const version = document.querySelector('#version');
  version.selectedIndex = 1;
  window.UpdateVersion(version);
  expect(document.querySelector('#content .pmt-template-title')).toBeNull();
  await window.CopyThis(document.querySelector('#content [aria-label="Copy body"]'), 'md');
  expect(navigator.clipboard.writeText).toHaveBeenLastCalledWith(oldMarkdown);
  version.selectedIndex = 0;
  window.UpdateVersion(version);
  await checkParts();
});

test.each(['Hello\nWorld', 'Title:   \nHello\nWorld', 'Hello\nTitle: Later title\nWorld', ''])('template without an opening title keeps its full body: %j', async content => {
  await mount('Template', {
    entry: { id: 3, type: 'Template', title: 'Reply', content_md: content },
  });
  expect(document.querySelector('#content .pmt-template-title')).toBeNull();
  await window.CopyThis(document.querySelector('#content [aria-label="Copy body"]'), 'md');
  expect(navigator.clipboard.writeText).toHaveBeenLastCalledWith(content);
});

test.each(['Title: Only a title', 'Title: Only a title\r\n'])('title-only templates have an empty body: %j', async content => {
  await mount('Template', {
    versions: [{ version_number: 1, createdAt: new Date('2026-01-01'), content_md: content }],
  });
  const version = document.querySelector('#version');
  version.selectedIndex = 1;
  window.UpdateVersion(version);
  expect(document.querySelector('#content .pmt-template-title').textContent).toBe('Only a title');
  await window.CopyThis(document.querySelector('#content [aria-label="Copy body"]'), 'md');
  expect(navigator.clipboard.writeText).toHaveBeenLastCalledWith('');
});

test('related template previews escape titles, sanitize bodies, and preserve line breaks', async () => {
  const title = '<img src=x onerror="alert(1)">';
  await mount('Manual', {}, [{
    id: 4, type: 'Template', title: 'Reply',
    content_md: `Title: ${title}\r\nHello\r\nWorld\r\n\r\n<script>alert(1)</script>`,
  }]);
  expect(document.querySelector('#m4 .pmt-template-title').textContent).toBe(title);
  expect(document.querySelector('#m4 .modal-body img, #m4 .modal-body script')).toBeNull();
  expect(document.querySelectorAll('#m4 .pmt-template-body br')).toHaveLength(1);
  await window.CopyThis(document.querySelector('#m4 [aria-label="Copy title"]'), 'md');
  expect(navigator.clipboard.writeText).toHaveBeenLastCalledWith(title);
});

test.each(['Policy', 'Manual'])('%s keeps standard Markdown rendering', async type => {
  await mount(type, { entry: { id: 3, type, title: 'Guidance', content_md: 'Title: Example\nHello\nWorld' } });
  expect(document.querySelector('#content .pmt-template-chunk, #content br')).toBeNull();
  expect(document.querySelector('#content').textContent).toContain('Title: Example\nHello\nWorld');
});

test('library renders template chunks while legacy templates remain in textareas', async () => {
  const content = 'Title: Order update\nHello\nWorld';
  service.fetchEntries.mockResolvedValue([
    { id: 3, type: 'Template', title: 'Reply', content_md: content },
  ]);
  service.fetchAllLogs.mockResolvedValue([]);
  legacyContent.fetchEntries.mockResolvedValue([
    { id: 4, source: 'legacy', type: 'Template', title: 'Legacy reply', contents: [{ data: content }] },
  ]);
  const locals = await new Promise((resolve, reject) => {
    controller.top({ query: {} }, { render: (_view, data) => resolve(data) }, reject);
  });
  document.documentElement.innerHTML = pug.renderFile('views/pmt/pmt.pug', locals);
  window.eval(fs.readFileSync('public/js/pmt/pmt.js', 'utf8'));
  expect(document.querySelectorAll('.pmt-template-chunk')).toHaveLength(2);
  expect(document.querySelectorAll('.pmt-template-body br')).toHaveLength(1);
  expect(document.querySelector('textarea').value).toBe(content);
  for (const [selector, expected] of [
    ['[aria-label="Copy title"]', 'Order update'],
    ['[aria-label="Copy body"]', 'Hello\nWorld'],
    ['.pmt-entry-actions [data-md]', content],
  ]) {
    await window.CopyThis(document.querySelector(selector), 'md');
    expect(navigator.clipboard.writeText).toHaveBeenLastCalledWith(expected);
  }
});
