const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const SEED = 0x5a17c0de;
const ORDER_COUNT = 5000;
const LARGE_ORDER_COUNT = 50;
const OUTPUT_DIRECTORY = path.join(__dirname, '..', 'test_data', 'shipping_compactor');

function createRandom(seed) {
  let state = seed >>> 0;
  return function random() {
    state += 0x6d2b79f5;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

function randomInteger(random, minimum, maximum) {
  return Math.floor(random() * (maximum - minimum + 1)) + minimum;
}

function randomEntry(random, entries) {
  return entries[randomInteger(random, 0, entries.length - 1)];
}

function shuffle(random, entries) {
  for (let index = entries.length - 1; index > 0; index -= 1) {
    const swapIndex = randomInteger(random, 0, index);
    const current = entries[index];
    entries[index] = entries[swapIndex];
    entries[swapIndex] = current;
  }
  return entries;
}

function padNumber(value, width) {
  return String(value).padStart(width, '0');
}

function buildCatalog() {
  const codes = [
    '392640',
    '392690',
    '420292',
    '491110',
    '610910',
    '611120',
    '630790',
    '691200',
    '732690',
    '950300',
    '950440',
    '950490',
    '3926400000',
    '3926909790',
    '4202929890',
    '4911109000',
    '6109100010',
    '6111209000',
    '6307909899',
    '6912002510',
    '7326909890',
    '9503007000',
    '9504400000',
    '9504908000',
  ];
  const prices = [
    '350', '480', '600', '750', '900', '1100', '1250', '1400',
    '1600', '1800', '2200', '2500', '2800', '3200', '3800', '4500',
    '5200', '6000', '6800', '7500', '8200', '9000', '10500', '12000',
  ];
  const seriesNames = [
    'Astra', 'Bloom', 'Clover', 'Dawn', 'Echo', 'Flora',
    'Galaxy', 'Harbor', 'Iris', 'Jade', 'Kite', 'Luna',
    'Maple', 'Nova', 'Ocean', 'Pixel', 'Quartz', 'Ribbon',
    'Sakura', 'Terra', 'Umbra', 'Velvet', 'Willow', 'Zenith',
  ];
  const itemTypes = [
    'Acrylic Stand',
    'Art Book',
    'Character Figure',
    'Collector Card Set',
    'Key Holder',
    'Mini Plush',
    'Poster Set',
    'Tote Bag',
  ];

  return Array.from({ length: 96 }, (_unused, index) => {
    const codeIndex = index % codes.length;
    const priceVariant = Math.floor(index / codes.length);
    const priceIndex = (codeIndex * 3 + priceVariant * 5) % prices.length;
    return {
      id: `SKU-${padNumber(index + 1, 4)}`,
      hsCode: codes[codeIndex],
      unitPrice: prices[priceIndex],
      baseName: `${seriesNames[codeIndex]} ${itemTypes[index % itemTypes.length]} ${padNumber(index + 1, 3)}`,
    };
  });
}

function chooseProducts(random, catalog, orderIndex, count) {
  const selected = [];
  const selectedIds = new Set();
  const anchor = catalog[orderIndex % 16];
  selected.push(anchor);
  selectedIds.add(anchor.id);

  while (selected.length < count) {
    const product = randomEntry(random, catalog);
    if (!selectedIds.has(product.id)) {
      selected.push(product);
      selectedIds.add(product.id);
    }
  }
  return selected;
}

function buildItems(random, catalog, orderIndex, itemCount) {
  const uniqueItemCount = itemCount === 1
    ? 1
    : Math.max(1, Math.min(itemCount - 1, Math.round(itemCount * (0.35 + random() * 0.15))));
  const selectedProducts = chooseProducts(random, catalog, orderIndex, uniqueItemCount);
  const occurrences = selectedProducts.slice();

  if (occurrences.length < itemCount) {
    occurrences.push(selectedProducts[0]);
  }
  while (occurrences.length < itemCount) {
    occurrences.push(randomEntry(random, selectedProducts));
  }
  shuffle(random, occurrences);

  const descriptions = [
    'Standard Release',
    'Blue Package',
    'Collector Edition',
    'Display Version',
    'Gift Set',
    'Limited Release',
    'Retail Package',
    'Warehouse Batch',
  ];
  const quantityChoices = [1, 1, 1, 2, 2, 3, 3, 4, 5, 6, 8, 10, 12];
  const occurrenceCounts = new Map();
  const items = occurrences.map((product, itemIndex) => {
    occurrenceCounts.set(product.id, (occurrenceCounts.get(product.id) || 0) + 1);
    return {
      productId: product.id,
      itemName: `${product.baseName} ${randomEntry(random, descriptions)}`,
      hsCode: product.hsCode,
      unitPrice: product.unitPrice,
      quantity: randomEntry(random, quantityChoices),
      sourceLineNumber: itemIndex + 1,
    };
  });

  return {
    items,
    uniqueItemCount,
    duplicateGroupCount: Array.from(occurrenceCounts.values()).filter((count) => count > 1).length,
  };
}

function buildOrders() {
  const random = createRandom(SEED);
  const catalog = buildCatalog();
  const orderIndexes = Array.from({ length: ORDER_COUNT }, (_unused, index) => index);
  const largeOrderIndexes = new Set(shuffle(random, orderIndexes.slice()).slice(0, LARGE_ORDER_COUNT));
  const countries = ['IE', 'GR', 'US', 'GB', 'DE', 'FR', 'CA', 'AU', 'SE', 'JP'];
  const orders = [];

  for (let index = 0; index < ORDER_COUNT; index += 1) {
    const isLarge = largeOrderIndexes.has(index);
    const itemCount = isLarge
      ? randomInteger(random, 50, 100)
      : randomInteger(random, 1, 10);
    const itemData = buildItems(random, catalog, index, itemCount);
    const date = new Date(Date.UTC(2026, 0, 1 + (index % 365))).toISOString().slice(0, 10);
    orders.push({
      orderNumber: `STRESS-${padNumber(index + 1, 6)}`,
      trackingReference: `TEST${padNumber(index + 1, 10)}`,
      recipient: `Stress Recipient ${padNumber(index + 1, 5)}`,
      countryCode: randomEntry(random, countries),
      date,
      isLarge,
      uniqueItemCount: itemData.uniqueItemCount,
      duplicateGroupCount: itemData.duplicateGroupCount,
      items: itemData.items,
    });
  }

  return { catalog, orders };
}

function buildJapanPostRow(order) {
  const columns = Array(25).fill('');
  columns[0] = order.orderNumber;
  columns[1] = order.trackingReference;
  columns[2] = 'JAPAN POST STRESS SAMPLE';
  columns[3] = order.date;
  columns[4] = order.recipient;
  columns[5] = `Test Address ${order.orderNumber}`;
  columns[6] = 'Test City';
  columns[7] = '1000001';
  columns[8] = 'Japan';
  columns[9] = 'JPY';
  columns[10] = 'Merchandise';
  columns[11] = 'Air';
  columns[12] = order.countryCode;
  columns[13] = 'Stress Test';
  columns[14] = 'AUTOMATIC';
  columns[20] = String(order.items.length);
  columns[24] = order.isLarge ? 'LARGE ORDER' : 'REGULAR ORDER';

  order.items.forEach((item) => {
    columns.push(
      item.itemName,
      String(item.quantity),
      item.unitPrice,
      item.productId,
      item.hsCode,
      `LINE-${padNumber(item.sourceLineNumber, 3)}`
    );
  });
  return columns.join(',');
}

function buildEPacketRow(order) {
  const columns = Array(22).fill('');
  columns[0] = order.orderNumber;
  columns[1] = order.trackingReference;
  columns[2] = 'EPACKET STRESS SAMPLE';
  columns[3] = order.date;
  columns[4] = order.recipient;
  columns[5] = `Test Address ${order.orderNumber}`;
  columns[6] = 'Test City';
  columns[7] = '1000001';
  columns[8] = 'Japan';
  columns[9] = 'JPY';
  columns[10] = 'Merchandise';
  columns[11] = 'Registered';
  columns[12] = order.countryCode;
  columns[13] = 'Stress Test';
  columns[14] = 'AUTOMATIC';
  columns[20] = String(order.items.length);
  columns[21] = order.isLarge ? 'LARGE ORDER' : 'REGULAR ORDER';

  order.items.forEach((item) => {
    columns.push(
      item.itemName,
      item.hsCode,
      item.productId,
      String(item.quantity),
      item.unitPrice,
      ((item.sourceLineNumber % 20 + 1) / 100).toFixed(3).replace(/^0\./, '.')
    );
  });
  return columns.join('\t');
}

function quoteDhlValue(value) {
  return `"${String(value == null ? '' : value).replace(/"/g, '""')}"`;
}

function buildDhlRows(order) {
  return order.items.map((item, itemIndex) => {
    const columns = Array(30).fill('');
    columns[0] = order.orderNumber;
    columns[1] = order.trackingReference;
    columns[2] = order.date;
    columns[3] = order.recipient;
    columns[4] = `Test Address ${order.orderNumber}`;
    columns[5] = 'Test City';
    columns[6] = '1000001';
    columns[7] = 'Japan';
    columns[8] = '0000000000';
    columns[9] = 'stress@example.invalid';
    columns[10] = 'DHL STRESS SAMPLE';
    columns[11] = 'JPY';
    columns[12] = 'STRESS-DATA';
    columns[13] = order.isLarge ? 'LARGE ORDER' : 'REGULAR ORDER';
    columns[14] = order.countryCode;
    columns[15] = 'DAP';
    columns[16] = String(itemIndex + 1);
    columns[17] = item.itemName;
    columns[18] = item.productId;
    columns[19] = item.unitPrice;
    columns[20] = String(item.quantity);
    columns[21] = 'JP';
    columns[22] = '0.20';
    columns[23] = 'Merchandise';
    columns[28] = `LINE-${padNumber(item.sourceLineNumber, 3)}`;
    columns[29] = item.hsCode;
    return columns.map(quoteDhlValue).join(',');
  });
}

function hashText(text) {
  return crypto.createHash('sha256').update(text, 'utf8').digest('hex');
}

function formatBytes(bytes) {
  return `${(bytes / 1024 / 1024).toFixed(2)} MiB`;
}

function buildSummary(catalog, orders, files) {
  const inputItemEntries = orders.reduce((total, order) => total + order.items.length, 0);
  const expectedCompactedEntries = orders.reduce((total, order) => total + order.uniqueItemCount, 0);
  const combinedGroups = orders.reduce((total, order) => total + order.duplicateGroupCount, 0);
  const totalQuantity = orders.reduce((orderTotal, order) => (
    orderTotal + order.items.reduce((itemTotal, item) => itemTotal + item.quantity, 0)
  ), 0);
  const regularItemDistribution = {};
  const largeItemDistribution = {};
  const identityOrders = new Map();

  orders.forEach((order) => {
    const distribution = order.isLarge ? largeItemDistribution : regularItemDistribution;
    distribution[order.items.length] = (distribution[order.items.length] || 0) + 1;
    const orderIdentities = new Set(order.items.map((item) => `${item.hsCode}\u0000${item.unitPrice}`));
    orderIdentities.forEach((identity) => {
      identityOrders.set(identity, (identityOrders.get(identity) || 0) + 1);
    });
  });

  return {
    seed: `0x${SEED.toString(16)}`,
    orderCount: orders.length,
    regularOrderCount: orders.filter((order) => !order.isLarge).length,
    largeOrderCount: orders.filter((order) => order.isLarge).length,
    largeOrderPercentage: (orders.filter((order) => order.isLarge).length / orders.length) * 100,
    regularOrderItemRange: [1, 10],
    largeOrderItemRange: [50, 100],
    catalogIdentityCount: catalog.length,
    identitiesUsedAcrossMultipleOrders: Array.from(identityOrders.values()).filter((count) => count > 1).length,
    ordersWithCollapsibleEntries: orders.filter((order) => order.items.length > order.uniqueItemCount).length,
    inputItemEntries,
    expectedCompactedEntries,
    expectedDuplicateItemsRemoved: inputItemEntries - expectedCompactedEntries,
    expectedCombinedGroups: combinedGroups,
    inputTotalQuantity: totalQuantity,
    expectedOutputTotalQuantity: totalQuantity,
    regularItemDistribution,
    largeItemDistribution,
    matchingScope: 'Items may only be combined within the same order.',
    files,
  };
}

function buildReadme(summary) {
  return `# Shipping CSV compactor stress samples

These deterministic files contain the same ${summary.orderCount} logical orders rendered in all three supported upload formats. The seed is \`${summary.seed}\`.

- ${summary.regularOrderCount} regular orders contain 1-10 item entries.
- ${summary.largeOrderCount} large orders (${summary.largeOrderPercentage}%) contain 50-100 item entries.
- ${summary.inputItemEntries} item entries should compact to ${summary.expectedCompactedEntries} entries.
- ${summary.expectedDuplicateItemsRemoved} duplicate entries across ${summary.expectedCombinedGroups} matching groups should be removed.
- ${summary.ordersWithCollapsibleEntries} orders contain at least one collapsible match.
- Quantities vary and total ${summary.inputTotalQuantity} before and after compaction.

The same HS/TARIC-code and unit-price identities deliberately recur across many different orders. They must remain separate between orders; matching is valid only within one order.

| File | Delimiter/layout | Input rows | Expected output rows | Size |
| --- | --- | ---: | ---: | ---: |
| \`${summary.files.japanPost.name}\` | Comma, six-column item blocks | ${summary.files.japanPost.inputRows} | ${summary.files.japanPost.expectedOutputRows} | ${formatBytes(summary.files.japanPost.bytes)} |
| \`${summary.files.ePacket.name}\` | Tab, six-column item blocks | ${summary.files.ePacket.inputRows} | ${summary.files.ePacket.expectedOutputRows} | ${formatBytes(summary.files.ePacket.bytes)} |
| \`${summary.files.dhl.name}\` | Quoted comma CSV, one item per row | ${summary.files.dhl.inputRows} | ${summary.files.dhl.expectedOutputRows} | ${formatBytes(summary.files.dhl.bytes)} |

Regenerate the files from the repository root with:

\`\`\`sh
npm run generate:shipping-compactor-samples
\`\`\`

See \`expected_summary.json\` for exact distributions, SHA-256 hashes, and expected compactor metrics.
`;
}

function writeSampleFile(name, content, inputRows, expectedOutputRows) {
  const filePath = path.join(OUTPUT_DIRECTORY, name);
  fs.writeFileSync(filePath, content, 'utf8');
  return {
    name,
    inputRows,
    expectedOutputRows,
    bytes: Buffer.byteLength(content, 'utf8'),
    sha256: hashText(content),
  };
}

function main() {
  const { catalog, orders } = buildOrders();
  fs.mkdirSync(OUTPUT_DIRECTORY, { recursive: true });

  const japanPostContent = `${orders.map(buildJapanPostRow).join('\r\n')}\r\n`;
  const ePacketContent = `${orders.map(buildEPacketRow).join('\r\n')}\r\n`;
  const dhlLines = orders.reduce((lines, order) => lines.concat(buildDhlRows(order)), []);
  const dhlContent = `${dhlLines.join('\r\n')}\r\n`;
  const expectedCompactedEntries = orders.reduce((total, order) => total + order.uniqueItemCount, 0);

  const files = {
    japanPost: writeSampleFile(
      'japan_post_5000_orders.csv',
      japanPostContent,
      orders.length,
      orders.length
    ),
    ePacket: writeSampleFile(
      'epacket_5000_orders.csv',
      ePacketContent,
      orders.length,
      orders.length
    ),
    dhl: writeSampleFile(
      'dhl_5000_orders.csv',
      dhlContent,
      dhlLines.length,
      expectedCompactedEntries
    ),
  };
  const summary = buildSummary(catalog, orders, files);
  fs.writeFileSync(
    path.join(OUTPUT_DIRECTORY, 'expected_summary.json'),
    `${JSON.stringify(summary, null, 2)}\n`,
    'utf8'
  );
  fs.writeFileSync(path.join(OUTPUT_DIRECTORY, 'README.md'), buildReadme(summary), 'utf8');

  console.log(`Generated shipping compactor stress samples in ${OUTPUT_DIRECTORY}`);
  console.log(JSON.stringify({
    orderCount: summary.orderCount,
    largeOrderCount: summary.largeOrderCount,
    inputItemEntries: summary.inputItemEntries,
    expectedCompactedEntries: summary.expectedCompactedEntries,
    expectedDuplicateItemsRemoved: summary.expectedDuplicateItemsRemoved,
    expectedCombinedGroups: summary.expectedCombinedGroups,
    files: summary.files,
  }, null, 2));
}

main();
