jest.mock('../sequelize', () => ({ AppSetting: {}, HSCodeList: {} }));

const { PDFDocument, PDFPage } = require('pdf-lib');
const { generate_invoice: generateInvoice } = require('../controllers/apiController');

function invoiceBody(overrides = {}) {
  return {
    order: 'TEST-001', address: 'Sample Customer\nBerlin\nGermany',
    paydate: '2026-11-01', shipdate: '2026-11-02', payment_method: 'PayPal',
    shipping_method: 'DHL', tracking: '1234567890', shipping: '2000',
    gst_type: '', gst: '0', amiami_point: '0', remarks: '',
    item0_invoice: 'Collectible figure', item0_hs: '9503.00', item0_q: '2',
    item0_rate: '3000', item0_remarks: 'Factory sealed',
    item0_m_pid: 'MERCHANT-001', item0_ns_pid: 'MAKER-001', item0_s_pid: '4901234567890',
    ...overrides,
  };
}

let drawn;
beforeEach(() => {
  drawn = [];
  const drawText = PDFPage.prototype.drawText;
  jest.spyOn(PDFPage.prototype, 'drawText').mockImplementation(function (text, options) {
    drawn.push({ text, ...options, page: this });
    return drawText.call(this, text, options);
  });
});
afterEach(() => jest.restoreAllMocks());

async function generate(body) {
  const res = { setHeader: jest.fn(), send: jest.fn(), status: jest.fn().mockReturnThis() };
  await generateInvoice({ body }, res);
  return res;
}

test('legacy requests keep Commercial Invoice and omit disabled fields even with supplied PID values', async () => {
  const res = await generate(invoiceBody());
  const texts = drawn.map(entry => entry.text);
  expect(texts).toContain('Commercial Invoice');
  expect(texts).not.toContain('HS Code');
  expect(texts.join('\n')).not.toContain('MERCHANT-001');
  expect(texts).toContain('8,000 JPY');
  expect((await PDFDocument.load(res.send.mock.calls[0][0])).getPageCount()).toBe(1);
});

test.each([undefined, 'on', ['off', 'on'], 'off'])(
  'customs defaults HS on and honors an explicit override: %j', async includeHs => {
    await generate(invoiceBody({ invoice_type: 'customs', include_hs: includeHs }));
    const texts = drawn.map(entry => entry.text);
    expect(texts).toContain('Customs Invoice');
    expect(texts.includes('HS Code')).toBe(includeHs !== 'off');
    expect(texts.includes('9503.00')).toBe(includeHs !== 'off');
  },
);

test('enabled PID details are labeled and S-PID can be omitted', async () => {
  await generate(invoiceBody({ include_pid: 'on', item0_s_pid: undefined }));
  const texts = drawn.map(entry => entry.text).join('\n');
  expect(texts).toContain('M-PID (Merchant Product ID): MERCHANT-001');
  expect(texts).toContain('NS-PID (Non-standardised Manufacturer ID): MAKER-001');
  expect(texts).not.toContain('S-PID (Standardised');
});

test.each([
  { item0_m_pid: '' }, { item0_ns_pid: '   ' }, { item0_m_pid: ['bad'] }, { item0_s_pid: 'x'.repeat(201) },
])('rejects incomplete or invalid enabled PID details: %j', async fields => {
  const res = await generate(invoiceBody({ include_pid: 'on', ...fields }));
  expect(res.status).toHaveBeenCalledWith(400);
  expect(res.send).toHaveBeenCalledWith(expect.stringContaining('Item 1:'));
  expect(drawn).toHaveLength(0);
});

test('long identifiers wrap without truncation and each item stays together on multipage invoices', async () => {
  const body = invoiceBody({ include_pid: 'on', invoice_type: 'customs' });
  for (let i = 0; i < 12; i++) {
    Object.assign(body, {
      [`item${i}_invoice`]: `Figure ${i}`, [`item${i}_hs`]: '9503.00',
      [`item${i}_q`]: '2', [`item${i}_rate`]: '3000', [`item${i}_remarks`]: 'Factory sealed',
      [`item${i}_m_pid`]: `${i}-` + 'M'.repeat(198), [`item${i}_ns_pid`]: `MAKER-${i}`,
      [`item${i}_s_pid`]: `49012345678${i}`,
    });
    // Keep all identifiers within the supported 200-character limit.
    body[`item${i}_m_pid`] = body[`item${i}_m_pid`].slice(0, 200);
  }
  const res = await generate(body);
  expect((await PDFDocument.load(res.send.mock.calls[0][0])).getPageCount()).toBeGreaterThan(1);
  for (let i = 0; i < 12; i++) {
    const nameIndex = drawn.findIndex(entry => entry.text === `Figure ${i}`);
    const endIndex = drawn.findIndex((entry, index) => index > nameIndex && entry.text.startsWith('S-PID'));
    const item = drawn.slice(nameIndex, endIndex + 1);
    expect(item.every(entry => entry.page === item[0].page && entry.y >= 50)).toBe(true);
    const pidLines = item.slice(
      item.findIndex(entry => entry.text.startsWith('M-PID')),
      item.findIndex(entry => entry.text.startsWith('NS-PID')),
    );
    expect(pidLines.map(entry => entry.text).join('')).toContain(body[`item${i}_m_pid`]);
    item.filter(entry => entry.size === 10).forEach(entry => {
      expect(entry.x + entry.font.widthOfTextAtSize(entry.text, entry.size)).toBeLessThan(555);
    });
  }
});
