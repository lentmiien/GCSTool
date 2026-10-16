const fs = require('fs');
const vm = require('vm');
const { JSDOM } = require('jsdom');
const pug = require('pug');
const appCompactor = require('../public/javascripts/shipping_csv_compactor');
const template = fs.readFileSync('export_tools/shipping_csv_compactor_ja.html', 'utf8');
const placeholder = '/* SHIPPING_COMPACTOR_COUNTRIES */ []';
const standaloneScript = (html) => html.match(/<script>([\s\S]*?)<\/script>/)[1];
const loadStandalone = (codes) => {
  const context = { module: { exports: {} } };
  const html = codes === undefined ? template : template.replace(placeholder, JSON.stringify(codes));
  vm.runInNewContext(standaloneScript(html), context);
  return context.module.exports;
};

function multiRow(type, country, order = 'order-1', weights = ['.100', '.300']) {
  const row = Array(type === 'ePacket' ? 22 : 25).fill('');
  row[0] = order;
  row[12] = country;
  const items = type === 'ePacket'
    ? [['First', '950300', 'JP', '2', '100', weights[0]], ['Second', '950300', 'JP', '1', '100', weights[1]]]
    : [['First', '2', '100', weights[0], '950300', 'JP'], ['Second', '1', '100', weights[1], '950300', 'JP']];
  return row.concat(...items).join(type === 'ePacket' ? '\t' : ',');
}

function dhlRow(country, number, { order = 'order-1', quoted = true, quantity = '1' } = {}) {
  const row = Array(30).fill('');
  row[0] = order;
  row[14] = country;
  row[16] = String(number);
  row[17] = 'Item';
  row[19] = '100';
  row[20] = quantity;
  row[29] = '950300';
  return row.map((cell, index) => quoted || index === 17 ? `"${cell}"` : cell).join(',');
}

describe.each([
  ['app', appCompactor],
  ['standalone', loadStandalone(['IE', 'GR'])],
])('%s compactor country filtering', (name, api) => {
  test.each(['japanPost', 'ePacket'])('%s combines eligible items and preserves excluded rows verbatim', (type) => {
    const excluded = multiRow(type, 'US', 'excluded');
    const missing = multiRow(type, '', 'missing');
    const eligible = multiRow(type, ' ie ');
    const input = `\uFEFF${excluded}\r\n${eligible}\r\n${missing}\r\n`;
    const result = api.compactCsv(input, ['IE']);
    expect(result.type).toBe(type);
    expect(result.stats.itemsExcluded).toBe(4);
    expect(result.stats.duplicateItemsRemoved).toBe(1);
    const lines = result.csv.slice(1).split('\r\n');
    expect(lines[0]).toBe(excluded);
    expect(lines[2]).toBe(missing);
    expect(lines[3]).toBe('');
    expect(result.preview.orders[1].after).toEqual([
      expect.objectContaining({ name: 'First', quantity: '3', unitWeight: '.167' }),
    ]);
    expect(result.preview.orders[0].after).toEqual(result.preview.orders[0].before);
  });

  test('DHL preserves excluded quoting, item numbers, order and blank rows', () => {
    const excluded = [dhlRow('US', 8, { quoted: false }), dhlRow('US', 42)];
    const missing = dhlRow('', 17);
    const input = `\uFEFF${excluded[0]}\r\n${dhlRow('IE', 5)}\r\n\r\n${excluded[1]}\r\n${dhlRow('IE', 7)}\r\n${missing}\r\n`;
    const result = api.compactCsv(input, ['IE']);
    expect(result.type).toBe('dhl');
    expect(result.stats.rowsRemoved).toBe(1);
    expect(result.stats.itemsExcluded).toBe(3);
    expect(result.csv).toBe(`\uFEFF${excluded[0]}\r\n${dhlRow('IE', 1, { quantity: '2' })}\r\n\r\n${excluded[1]}\r\n${missing}\r\n`);
    expect(result.preview.totalOrders).toBe(3);
  });

  test('DHL groups and renumbers different eligible destinations separately', () => {
    const input = ['IE', 'GR', 'IE', 'GR'].map((country, i) => dhlRow(country, i + 8)).join('\n');
    expect(api.compactCsv(input, ['IE', 'GR']).csv).toBe([
      dhlRow('IE', 1, { quantity: '2' }), dhlRow('GR', 1, { quantity: '2' }),
    ].join('\n'));
  });

  test.each(['japanPost', 'ePacket', 'dhl'])('%s with no matching countries is an unchanged successful download', (type) => {
    const input = type === 'dhl'
      ? `${dhlRow('US', 10, { quoted: false })}\n${dhlRow('US', 12)}\n`
      : `${multiRow(type, 'US')}\n`;
    expect(api.compactCsv(input, ['IE']).csv).toBe(input);
    expect(api.compactCsv(input, []).csv).toBe(input);
  });

  test('retains quantity validation and Japan Post zero weights', () => {
    const zeroWeight = multiRow('japanPost', 'IE', 'zero', ['0', '0']);
    expect(api.compactCsv(zeroWeight, ['IE']).preview.orders[0].after[0].unitWeight).toBe('0');
    const invalid = [dhlRow('IE', 1, { quantity: 'bad' }), dhlRow('IE', 2)].join('\n');
    const result = api.compactCsv(invalid, ['IE']);
    expect(result.csv).toBe(invalid);
    expect(result.stats.skippedGroups).toBe(1);
  });
});

test('downloaded standalone defaults to embedded countries; raw template processes none', () => {
  const input = multiRow('japanPost', 'IE');
  expect(loadStandalone(['IE']).compactCsv(input).stats.duplicateItemsRemoved).toBe(1);
  expect(loadStandalone(['GR']).compactCsv(input).csv).toBe(input);
  expect(loadStandalone().compactCsv(input).csv).toBe(input);
});

test('built-in page exposes the saved list to the browser and links to settings and download', () => {
  const html = pug.renderFile('views/hs_shipping_compactor.pug', {
    countryCodes: ['IE', 'GR'], role: 'admin', __: (value) => value,
  });
  const dom = new JSDOM(html, { runScripts: 'outside-only' });
  dom.window.eval(fs.readFileSync('public/javascripts/shipping_csv_compactor.js', 'utf8'));
  expect(dom.window.ShippingCsvCompactor.compactCsv(multiRow('japanPost', 'IE')).stats.duplicateItemsRemoved).toBe(1);
  expect(dom.window.ShippingCsvCompactor.compactCsv(multiRow('japanPost', 'US')).stats.duplicateItemsRemoved).toBe(0);
  expect(dom.window.document.querySelector('a[href="/hs/compact/download"]')).not.toBeNull();
  expect(dom.window.document.querySelector('a[href="/admin/app-settings#SHIPPING_COMPACTOR_COUNTRIES"]')).not.toBeNull();
  dom.window.close();
});

test('standalone shows its embedded country list and initializes its UI offline', () => {
  const html = template.replace(placeholder, JSON.stringify(['IE', 'GR']));
  const dom = new JSDOM(html, { runScripts: 'dangerously' });
  expect(dom.window.document.getElementById('shipping-compact-countries').textContent).toContain('IE, GR');
  expect(dom.window.ShippingCsvCompactor.compactCsv(multiRow('ePacket', 'IE')).stats.duplicateItemsRemoved).toBe(1);
  dom.window.close();
});
