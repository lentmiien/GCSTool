(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.SmallestBoxData = factory();
}(typeof window !== 'undefined' ? window : this, function () {
  'use strict';

  function parseItems(text, limits = {}) {
    const { maxTypes = 100, maxItems = 200, maxIdLength = 100, maxWeight = 1000000, maxTextLength = 65536 } = limits;
    const limitMessage = `Use at most ${maxTypes} item types and ${maxItems} total items.`;
    if (typeof text !== 'string' || !text.trim()) throw new Error('Paste at least one item and its quantity.');
    if (text.length > maxTextLength) throw new Error(`The item list is too large. ${limitMessage}`);
    const lines = text.trim().split(/\r\n|\n|\r/).map((line) => line.trim());
    if (lines.length % 2) throw new Error('Each item needs two lines: item details, then quantity.');
    const items = new Map();
    const number = '(\\d+(?:\\.\\d+)?|\\.\\d+)';
    // Also retain the old tool's kg_dimension copy/paste format.
    const pattern = new RegExp(`^(\\S+)\\s+${number}kg(?:\\s+|_)${number}\\s*[×xX]\\s*${number}\\s*[×xX]\\s*${number}$`, 'i');
    let total = 0;
    for (let index = 0; index < lines.length; index += 2) {
      const match = lines[index].match(pattern);
      if (!match) throw new Error(`Line ${index + 1}: use ITEM-ID .07kg 235×154×9.`);
      const [, id, weight, w, d, h] = match;
      const item = { id, weight: Number(weight), w: Number(w), d: Number(d), h: Number(h), qty: Number(lines[index + 1]) };
      if (id.length > maxIdLength) throw new Error(`Line ${index + 1}: item IDs must be at most ${maxIdLength} characters.`);
      if (!Number.isFinite(item.weight) || item.weight > maxWeight || [item.w, item.d, item.h].some((size) => size <= 0 || size > 1000000)) {
        throw new Error(`Line ${index + 1}: dimensions must be greater than 0 and at most 1,000,000 mm; weight must be 0–${maxWeight.toLocaleString('en-US')} kg.`);
      }
      if (!/^\d+$/.test(lines[index + 1]) || !Number.isSafeInteger(item.qty) || item.qty < 1) {
        throw new Error(`Line ${index + 2}: quantity must be a positive whole number.`);
      }
      const existing = items.get(id);
      if (existing) {
        if (['weight', 'w', 'd', 'h'].some((key) => existing[key] !== item[key])) {
          throw new Error(`Item ${id} appears with different dimensions or weight. Use a unique ID for each item type.`);
        }
        existing.qty += item.qty;
      } else items.set(id, item);
      total += item.qty;
      if (items.size > maxTypes || total > maxItems) throw new Error(limitMessage);
    }
    return [...items.values()];
  }

  function buildLayers(placements) {
    const layers = new Map();
    placements.forEach((placement) => {
      if (!layers.has(placement.z)) layers.set(placement.z, []);
      layers.get(placement.z).push(placement);
    });
    return [...layers.entries()].sort((a, b) => a[0] - b[0]).map(([z, items]) => ({ z, items }));
  }

  return { parseItems, buildLayers };
}));
