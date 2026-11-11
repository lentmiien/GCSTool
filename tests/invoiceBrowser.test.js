/** @jest-environment jsdom */
const fs = require('fs');
const pug = require('pug');
const script = fs.readFileSync('public/javascripts/pdf_invoice.js', 'utf8');

beforeEach(() => {
  window.Loaded = () => {};
  document.documentElement.innerHTML = pug.renderFile('views/pdf_invoice.pug', {
    name_to_hs: { Figure: '9503.00' }, name_list: ['Figure'], hs_list: ['9503.00'], shippingMethods: ['DHL'],
  });
  window.eval(script);
});

function change(id, value) {
  const input = document.getElementById(id);
  if (typeof value === 'boolean') input.checked = value;
  else input.value = value;
  input.dispatchEvent(new Event('change', { bubbles: true }));
}

test('commercial defaults omit HS and PID details; customs enables HS but keeps PID opt-in', () => {
  expect(document.getElementById('invoice_type').value).toBe('commercial');
  expect(new FormData(document.querySelector('form')).getAll('include_hs')).toEqual(['off']);
  expect(document.getElementById('item0_m_pid').disabled).toBe(true);
  change('invoice_type', 'customs');
  expect(new FormData(document.querySelector('form')).getAll('include_hs')).toEqual(['off', 'on']);
  expect(document.getElementById('include_pid').checked).toBe(false);
  expect(document.getElementById('customs_hint').hidden).toBe(false);
  expect(document.getElementById('customs_hint').textContent).toContain('only needed for EU countries');
  change('include_hs', false);
  expect(new FormData(document.querySelector('form')).getAll('include_hs')).toEqual(['off']);
  change('invoice_type', 'commercial');
  expect(document.getElementById('customs_hint').hidden).toBe(true);
});

test('PID toggle updates existing and new rows, requires M/NS only, and preserves entered values', () => {
  change('include_pid', true);
  window.AddItemRow();
  for (const index of [0, 1]) {
    expect(document.getElementById(`item${index}_m_pid`).required).toBe(true);
    expect(document.getElementById(`item${index}_ns_pid`).required).toBe(true);
    expect(document.getElementById(`item${index}_s_pid`).required).toBe(false);
    expect(document.getElementById(`item${index}_s_pid`).disabled).toBe(false);
  }
  change('item0_m_pid', 'MERCHANT-001');
  change('include_pid', false);
  window.AddItemRow();
  expect(document.getElementById('item2_m_pid').disabled).toBe(true);
  expect(new FormData(document.querySelector('form')).has('item0_m_pid')).toBe(false);
  change('include_pid', true);
  expect(document.getElementById('item0_m_pid').value).toBe('MERCHANT-001');
  expect(document.getElementById('item2_m_pid').required).toBe(true);
  change('item0_invoice', 'Figure');
  expect(document.getElementById('item0_hs').value).toBe('9503.00');
});
