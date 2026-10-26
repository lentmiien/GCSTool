const cheerio = require('cheerio');
const render = require('../utils/workflowMarkdown');

test('workflow Markdown supports headings, lists, code, tables and line breaks', () => {
  const $ = cheerio.load(render('# Instructions\n\n**Check** these:\n- Invoice\n- Payment\n\n```js\nconst total = 1;\n```\n\n| Country | Total |\n| --- | --- |\n| AU | 100 |\n\nFirst line\nSecond line'));
  expect($('h1').text()).toBe('Instructions');
  expect($('strong').text()).toBe('Check');
  expect($('li').length).toBe(2);
  expect($('pre code').text()).toContain('const total = 1;');
  expect($('td').first().text()).toBe('AU');
  expect($('br').length).toBe(1);
});

test('all safe Markdown and HTML links open in a protected new tab', () => {
  const $ = cheerio.load(render('[Report](https://example.test) [Local](/report) <https://example.test/auto> <a href="../other" target="_self" rel="opener">Other</a>'));
  expect($('a[href]').length).toBe(4);
  $('a[href]').each((_, element) => {
    expect($(element).attr('target')).toBe('_blank');
    expect($(element).attr('rel')).toBe('noopener noreferrer');
  });
});

test('Markdown strips executable HTML and dangerous URLs', () => {
  const $ = cheerio.load(render('<script>alert(1)</script>\n\n<iframe src="https://bad.test"></iframe><img src="x" onerror="alert(1)"><a href="java&#x73;cript:alert(1)" onclick="alert(1)">Bad</a>\n\n[Bad link](javascript:alert)\n\n![Bad image](data:text/html,evil)'));
  expect($('script, iframe, [onclick], [onerror]').length).toBe(0);
  expect($('a[href]').length).toBe(0);
  expect($('img[src^="data:"]').length).toBe(0);
});
