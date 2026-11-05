(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require('./smallest-box-data'));
  else root.MultiBoxData = factory(root.SmallestBoxData);
}(typeof window !== 'undefined' ? window : this, function (smallestBox) {
  'use strict';
  const columns = ['id', 'width', 'height', 'depth', 'quantity', 'weight', 'value', 'rotation', 'shrink', 'soft', 'fragile'];
  const defaults = { quantity: 1, weight: 0, value: 0, rotation: 'orthogonal', shrink: 0, soft: false, fragile: false };

  // Quoted cells may contain commas, escaped quotes and line breaks.
  function csvRows(text) {
    const rows = [];
    let row = [];
    let cell = '';
    let quoted = false;
    let closed = false;
    function finishCell() { row.push(cell.trim()); cell = ''; closed = false; }
    function finishRow() { finishCell(); if (row.some((value) => value !== '')) rows.push(row); row = []; }
    for (let i = 0; i < text.length; i++) {
      const char = text[i];
      if (quoted) {
        if (char === '"' && text[i + 1] === '"') { cell += '"'; i++; }
        else if (char === '"') { quoted = false; closed = true; }
        else cell += char;
      } else if (char === ',') finishCell();
      else if (char === '\n' || char === '\r') {
        if (char === '\r' && text[i + 1] === '\n') i++;
        finishRow();
      } else if (char === '"' && !cell.trim() && !closed) { cell = ''; quoted = true; }
      else if (char === '"' || (closed && char.trim())) throw new Error('Invalid CSV quoting. Wrap cells containing commas in double quotes.');
      else if (!closed) cell += char;
    }
    if (quoted) throw new Error('CSV contains an unclosed quoted cell.');
    finishRow();
    return rows;
  }

  function number(value, label, min, max, integer = false) {
    if (typeof value === 'string' && !/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?$/i.test(value)) throw new Error(`${label} must be a number.`);
    const result = Number(value);
    if (!Number.isFinite(result) || result < min || result > max || (integer && !Number.isInteger(result))) {
      throw new Error(`${label} must be ${integer ? 'a whole number' : 'a number'} from ${min} to ${max}.`);
    }
    return result;
  }

  function validateItems(items) {
    const ids = new Set();
    let total = 0;
    items.forEach((item) => {
      if (!item.id || item.id.length > 120 || ids.has(item.id)) throw new Error('Use unique item IDs of 1–120 characters.');
      ids.add(item.id);
      for (const key of ['width', 'height', 'depth']) item[key] = number(item[key], `${item.id}: ${key} (mm)`, 0.1, 1000000) / 10;
      item.quantity = number(item.quantity, `${item.id}: quantity`, 1, 500, true);
      item.weight = number(item.weight, `${item.id}: weight (kg)`, 0, 1e12);
      item.value = number(item.value, `${item.id}: value`, 0, 2e9);
      item.shrink = number(item.shrink, `${item.id}: shrink (%)`, 0, 95);
      if (!['none', 'orthogonal', 'free'].includes(item.rotation)) throw new Error(`${item.id}: rotation must be none, orthogonal, or free.`);
      for (const key of ['soft', 'fragile']) {
        if (item[key] === 'true') item[key] = true;
        if (item[key] === 'false') item[key] = false;
        if (typeof item[key] !== 'boolean') throw new Error(`${item.id}: ${key} must be true or false.`);
      }
      total += item.quantity;
    });
    if (!items.length || items.length > 500 || total > 500) throw new Error('Use 1–500 total items, including quantities.');
    return items;
  }

  function parseItems(text, format = 'paste') {
    if (typeof text !== 'string' || !text.trim()) throw new Error('Paste at least one item.');
    if (text.length > 262144) throw new Error('The item list exceeds 256 KiB.');
    let items;
    if (format === 'paste') {
      items = smallestBox.parseItems(text, { maxTypes: 500, maxItems: 500, maxIdLength: 120, maxWeight: 1e12, maxTextLength: 262144 })
        .map((item) => ({ ...defaults, id: item.id, width: item.w, height: item.h, depth: item.d, weight: item.weight, quantity: item.qty }));
    } else if (format === 'csv') {
      const rows = csvRows(text.replace(/^\uFEFF/, ''));
      const header = (rows.shift() || []).map((value) => value.toLowerCase());
      if (new Set(header).size !== header.length || header.some((value) => !columns.includes(value))
        || ['id', 'width', 'height', 'depth'].some((value) => !header.includes(value))) {
        throw new Error(`CSV needs a header with id,width,height,depth. Supported columns: ${columns.join(',')}.`);
      }
      items = rows.map((row, index) => {
        if (row.length !== header.length) throw new Error(`CSV row ${index + 2}: expected ${header.length} cells, found ${row.length}.`);
        const item = { ...defaults };
        header.forEach((key, col) => { if (row[col] !== '' || !Object.prototype.hasOwnProperty.call(defaults, key)) item[key] = row[col]; });
        return item;
      });
    } else throw new Error('Choose the item list or CSV input format.');
    return validateItems(items);
  }

  // API vectors may be serialized as arrays or named X/Y/Z components.
  function vector(value) {
    const values = Array.isArray(value) ? value : value && [value.x, value.y, value.z];
    return values && values.length === 3 && values.every(Number.isFinite) ? values : null;
  }

  function placement(item) {
    if (item.soft) return null;
    const center = vector(item.center);
    const dimensions = vector(item.dimensions);
    const raw = item.orientation && item.orientation.matrix;
    const matrix = Array.isArray(raw) ? raw.flat() : null;
    if (!center || !dimensions || dimensions.some((size) => size <= 0)
      || !matrix || matrix.length !== 9 || !matrix.every(Number.isFinite)) return null;
    return { center, dimensions, matrix };
  }

  return { parseItems, placement, vector };
}));
