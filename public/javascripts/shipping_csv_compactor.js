(() => {
  const PREVIEW_ORDER_LIMIT = 100;

  const formatConfigs = {
    japanPost: {
      label: 'Japan Post',
      blockStartIndex: 25,
      blockSize: 6,
      nameOffset: 0,
      quantityOffset: 1,
      priceOffset: 2,
      weightOffset: 3,
      hsOffset: 4,
      preserveZeroWeight: true,
    },
    ePacket: {
      label: 'ePacket',
      blockStartIndex: 22,
      blockSize: 6,
      nameOffset: 0,
      hsOffset: 1,
      quantityOffset: 3,
      priceOffset: 4,
      weightOffset: 5,
    },
    dhl: {
      label: 'DHL',
      orderIndex: 0,
      itemNumberIndex: 16,
      nameIndex: 17,
      priceIndex: 19,
      quantityIndex: 20,
      hsIndex: 29,
    },
  };

  const detectRowDelimiter = (text) => {
    if (text.indexOf('\r\n') !== -1) {
      return '\r\n';
    }
    if (text.indexOf('\r') !== -1) {
      return '\r';
    }
    if (text.indexOf('\n') !== -1) {
      return '\n';
    }
    return '\r\n';
  };

  const parseCsvLine = (line, delimiter, quoted) => {
    if (!quoted) {
      return line.split(delimiter);
    }

    const columns = [];
    let field = '';
    let inQuotes = false;
    for (let index = 0; index < line.length; index += 1) {
      const character = line[index];
      if (character === '"') {
        if (inQuotes && line[index + 1] === '"') {
          field += '"';
          index += 1;
        } else {
          inQuotes = !inQuotes;
        }
      } else if (character === delimiter && !inQuotes) {
        columns.push(field);
        field = '';
      } else {
        field += character;
      }
    }
    columns.push(field);
    return columns;
  };

  const toCellText = (value) => (value == null ? '' : String(value));

  const detectCsvType = (lines) => {
    const sampleLines = lines.filter((line) => line.length).slice(0, 100);
    const sampleLine = sampleLines[0];
    if (!sampleLine) {
      return { type: 'japanPost', delimiter: ',', quoted: false };
    }
    if (sampleLine.indexOf('\t') !== -1) {
      return { type: 'ePacket', delimiter: '\t', quoted: false };
    }

    let dhlCountryMatches = 0;
    let multiItemCountryMatches = 0;
    sampleLines.forEach((line) => {
      const row = parseCsvLine(line, ',', true);
      if (/^[A-Z]{2}$/i.test(toCellText(row[14]).trim())) {
        dhlCountryMatches += 1;
      }
      if (/^[A-Z]{2}$/i.test(toCellText(row[12]).trim())) {
        multiItemCountryMatches += 1;
      }
    });
    if (dhlCountryMatches > multiItemCountryMatches) {
      return { type: 'dhl', delimiter: ',', quoted: true };
    }
    if (multiItemCountryMatches > dhlCountryMatches) {
      return { type: 'japanPost', delimiter: ',', quoted: false };
    }

    const quotedLinePattern = /^"(?:[^"]|"")*"(?:,"(?:[^"]|"")*")*$/;
    const quotedLineCount = sampleLines.filter((line) => quotedLinePattern.test(line)).length;
    if (quotedLineCount > sampleLines.length / 2) {
      return { type: 'dhl', delimiter: ',', quoted: true };
    }
    return { type: 'japanPost', delimiter: ',', quoted: false };
  };

  const parseCsv = (text) => {
    const inputText = String(text || '');
    const hasBom = inputText.charAt(0) === '\uFEFF';
    const safeText = hasBom ? inputText.slice(1) : inputText;
    const rowDelimiter = detectRowDelimiter(safeText);
    const lines = safeText.split(rowDelimiter);
    const format = detectCsvType(lines);

    return {
      type: format.type,
      delimiter: format.delimiter,
      quoted: format.quoted,
      rowDelimiter,
      hasBom,
      rows: lines.map((line) => (line.length
        ? parseCsvLine(line, format.delimiter, format.quoted)
        : [])),
    };
  };

  const parseQuantity = (value) => {
    const text = toCellText(value).trim();
    if (!/^\d+$/.test(text)) {
      return null;
    }
    const quantity = Number(text);
    if (!Number.isSafeInteger(quantity) || quantity < 0) {
      return null;
    }
    return quantity;
  };

  const parseUnitWeight = (value) => {
    const text = toCellText(value).trim();
    if (!/^(?:\d+(?:\.\d*)?|\.\d+)$/.test(text)) {
      return null;
    }
    const weight = Number(text);
    return Number.isFinite(weight) ? weight : null;
  };

  const buildMatchKey = (hsCode, unitPrice) => JSON.stringify([
    toCellText(hsCode),
    toCellText(unitPrice),
  ]);

  const hasExactMatchValues = (hsCode, unitPrice) => (
    toCellText(hsCode).trim() !== '' && toCellText(unitPrice).trim() !== ''
  );

  const makeStats = () => ({
    itemsFound: 0,
    combinedEntries: 0,
    duplicateItemsRemoved: 0,
    rowsRemoved: 0,
    itemBlocksRemoved: 0,
    skippedGroups: 0,
    warnings: [],
  });

  const addWarning = (stats, message) => {
    stats.skippedGroups += 1;
    if (stats.warnings.length < 5) {
      stats.warnings.push(message);
    }
  };

  const combineGroup = (group, stats, context, removeItem) => {
    if (group.length < 2) {
      return;
    }

    const quantities = group.map((item) => parseQuantity(item.quantity));
    if (quantities.some((quantity) => quantity === null)) {
      addWarning(stats, `${context}: matching items were left separate because a quantity is not a whole number.`);
      return;
    }

    const combinedQuantity = quantities.reduce((total, quantity) => total + quantity, 0);
    if (!Number.isSafeInteger(combinedQuantity)) {
      addWarning(stats, `${context}: matching items were left separate because their combined quantity is too large.`);
      return;
    }

    if (group[0].weightIndex !== undefined) {
      const weights = group.map((item) => parseUnitWeight(item.row[item.weightIndex]));
      if (weights.some((weight) => weight === null) || combinedQuantity === 0) {
        addWarning(stats, `${context}: matching items were left separate because a unit weight is invalid or their combined quantity is zero.`);
        return;
      }
      const totalWeight = weights.reduce((total, weight, index) => total + weight * quantities[index], 0);
      if (!Number.isFinite(totalWeight)) {
        addWarning(stats, `${context}: matching items were left separate because their combined weight is too large.`);
        return;
      }
      // Round only once, after weighting every original item by its quantity.
      const averageWeight = totalWeight / combinedQuantity;
      const roundedWeight = Math.round((averageWeight + Number.EPSILON) * 1000) / 1000;
      group[0].row[group[0].weightIndex] = group[0].preserveZeroWeight && weights.every((weight) => weight === 0)
        ? '0'
        : roundedWeight.toFixed(3).replace(/^0\./, '.');
    }

    group[0].row[group[0].quantityIndex] = String(combinedQuantity);
    group.slice(1).forEach(removeItem);
    stats.combinedEntries += 1;
    stats.duplicateItemsRemoved += group.length - 1;
  };

  const getMaximumItemOffset = (config) => Math.max(
    config.nameOffset,
    config.quantityOffset,
    config.priceOffset,
    config.hsOffset
  );

  const extractMultiItemPreviewItems = (row, config) => {
    const items = [];
    const maximumOffset = getMaximumItemOffset(config);

    for (
      let blockStart = config.blockStartIndex;
      blockStart + maximumOffset < row.length;
      blockStart += config.blockSize
    ) {
      const item = {
        itemNumber: String(items.length + 1),
        name: toCellText(row[blockStart + config.nameOffset]),
        hsCode: toCellText(row[blockStart + config.hsOffset]),
        unitPrice: toCellText(row[blockStart + config.priceOffset]),
        quantity: toCellText(row[blockStart + config.quantityOffset]),
      };
      if (config.weightOffset !== undefined) {
        item.unitWeight = toCellText(row[blockStart + config.weightOffset]);
      }
      if ([item.name, item.hsCode, item.unitPrice, item.quantity].some((value) => value !== '')) {
        items.push(item);
      }
    }

    return items;
  };

  const compactMultiItemRows = (rows, config) => {
    const stats = makeStats();
    const maximumOffset = getMaximumItemOffset(config);

    rows.forEach((row, rowIndex) => {
      const groups = new Map();
      const blockStartsToRemove = [];

      for (
        let blockStart = config.blockStartIndex;
        blockStart + maximumOffset < row.length;
        blockStart += config.blockSize
      ) {
        const name = toCellText(row[blockStart + config.nameOffset]);
        const quantity = toCellText(row[blockStart + config.quantityOffset]);
        const unitPrice = toCellText(row[blockStart + config.priceOffset]);
        const hsCode = toCellText(row[blockStart + config.hsOffset]);
        if ([name, quantity, unitPrice, hsCode].some((value) => value !== '')) {
          stats.itemsFound += 1;
        }
        if (!hasExactMatchValues(hsCode, unitPrice)) {
          continue;
        }

        const key = buildMatchKey(hsCode, unitPrice);
        if (!groups.has(key)) {
          groups.set(key, []);
        }
        groups.get(key).push({
          row,
          blockStart,
          quantity,
          quantityIndex: blockStart + config.quantityOffset,
          weightIndex: config.weightOffset === undefined ? undefined : blockStart + config.weightOffset,
          preserveZeroWeight: config.preserveZeroWeight,
        });
      }

      groups.forEach((group) => {
        combineGroup(group, stats, `CSV row ${rowIndex + 1}`, (item) => {
          blockStartsToRemove.push(item.blockStart);
        });
      });

      blockStartsToRemove
        .sort((first, second) => second - first)
        .forEach((blockStart) => {
          row.splice(blockStart, config.blockSize);
        });
      stats.itemBlocksRemoved += blockStartsToRemove.length;
    });

    return { rows, stats };
  };

  const isDhlItemRow = (row, config) => {
    if (row.length <= config.hsIndex || toCellText(row[config.orderIndex]).trim() === '') {
      return false;
    }

    const hasItemContent = [
      row[config.nameIndex],
      row[config.priceIndex],
      row[config.quantityIndex],
      row[config.hsIndex],
    ].some((value) => toCellText(value) !== '');
    const itemNumber = toCellText(row[config.itemNumberIndex]).trim();
    return hasItemContent && (parseQuantity(row[config.quantityIndex]) !== null || /^\d+$/.test(itemNumber));
  };

  const buildMultiItemPreviewSnapshot = (rows, config) => {
    const orders = [];
    let totalOrders = 0;

    rows.forEach((row, rowIndex) => {
      const items = extractMultiItemPreviewItems(row, config);
      if (!items.length) {
        return;
      }

      totalOrders += 1;
      if (orders.length >= PREVIEW_ORDER_LIMIT) {
        return;
      }

      const orderNumber = toCellText(row[0]).trim();
      orders.push({
        id: `row:${rowIndex}`,
        label: orderNumber ? `Order ${orderNumber}` : `CSV row ${rowIndex + 1}`,
        items,
      });
    });

    return { orders, totalOrders };
  };

  const buildDhlPreviewSnapshot = (rows, config) => {
    const allOrderNumbers = new Set();
    const previewOrdersByNumber = new Map();
    const orders = [];

    rows.forEach((row) => {
      if (!isDhlItemRow(row, config)) {
        return;
      }

      const orderNumber = toCellText(row[config.orderIndex]);
      if (!allOrderNumbers.has(orderNumber)) {
        allOrderNumbers.add(orderNumber);
        if (orders.length < PREVIEW_ORDER_LIMIT) {
          const order = {
            id: `order:${orderNumber}`,
            label: `Order ${orderNumber.trim()}`,
            items: [],
          };
          orders.push(order);
          previewOrdersByNumber.set(orderNumber, order);
        }
      }

      const previewOrder = previewOrdersByNumber.get(orderNumber);
      if (!previewOrder) {
        return;
      }

      previewOrder.items.push({
        itemNumber: toCellText(row[config.itemNumberIndex]) || String(previewOrder.items.length + 1),
        name: toCellText(row[config.nameIndex]),
        hsCode: toCellText(row[config.hsIndex]),
        unitPrice: toCellText(row[config.priceIndex]),
        quantity: toCellText(row[config.quantityIndex]),
      });
    });

    return {
      orders,
      totalOrders: allOrderNumbers.size,
    };
  };

  const buildPreviewSnapshot = (rows, type, config) => (
    type === 'dhl'
      ? buildDhlPreviewSnapshot(rows, config)
      : buildMultiItemPreviewSnapshot(rows, config)
  );

  const buildPreview = (beforeSnapshot, afterSnapshot) => {
    const afterOrdersById = new Map(
      afterSnapshot.orders.map((order) => [order.id, order])
    );

    return {
      limit: PREVIEW_ORDER_LIMIT,
      totalOrders: beforeSnapshot.totalOrders,
      orders: beforeSnapshot.orders.map((order) => {
        const afterOrder = afterOrdersById.get(order.id);
        return {
          label: order.label,
          before: order.items,
          after: afterOrder ? afterOrder.items : [],
        };
      }),
    };
  };

  const compactDhlRows = (rows, config) => {
    const stats = makeStats();
    const orders = new Map();
    const rowIndexesToRemove = new Set();

    rows.forEach((row, rowIndex) => {
      if (!isDhlItemRow(row, config)) {
        return;
      }

      stats.itemsFound += 1;
      const orderNumber = toCellText(row[config.orderIndex]);
      if (!orders.has(orderNumber)) {
        orders.set(orderNumber, {
          groups: new Map(),
        });
      }

      const hsCode = toCellText(row[config.hsIndex]);
      const unitPrice = toCellText(row[config.priceIndex]);
      if (!hasExactMatchValues(hsCode, unitPrice)) {
        return;
      }

      const groupKey = buildMatchKey(hsCode, unitPrice);
      const order = orders.get(orderNumber);
      if (!order.groups.has(groupKey)) {
        order.groups.set(groupKey, []);
      }
      order.groups.get(groupKey).push({
        row,
        rowIndex,
        quantity: row[config.quantityIndex],
        quantityIndex: config.quantityIndex,
      });
    });

    orders.forEach((order, orderNumber) => {
      order.groups.forEach((group) => {
        combineGroup(group, stats, `Order ${orderNumber}`, (item) => {
          rowIndexesToRemove.add(item.rowIndex);
        });
      });
    });

    const compactedRows = rows.filter((row, rowIndex) => !rowIndexesToRemove.has(rowIndex));
    const nextItemNumberByOrder = new Map();
    compactedRows.forEach((row) => {
      if (!isDhlItemRow(row, config)) {
        return;
      }

      const orderNumber = toCellText(row[config.orderIndex]);
      const nextItemNumber = (nextItemNumberByOrder.get(orderNumber) || 0) + 1;
      nextItemNumberByOrder.set(orderNumber, nextItemNumber);
      row[config.itemNumberIndex] = String(nextItemNumber);
    });

    stats.rowsRemoved = rowIndexesToRemove.size;
    return { rows: compactedRows, stats };
  };

  const formatDhlValue = (value) => `"${toCellText(value).replace(/"/g, '""')}"`;

  const buildCsv = (parsed, rows) => {
    const output = rows.map((row) => {
      if (!row.length) {
        return '';
      }
      if (parsed.type === 'dhl') {
        return row.map(formatDhlValue).join(parsed.delimiter);
      }
      return row.join(parsed.delimiter);
    }).join(parsed.rowDelimiter);
    return `${parsed.hasBom ? '\uFEFF' : ''}${output}`;
  };

  const compactCsv = (text) => {
    if (!String(text || '').replace(/^\uFEFF/, '').trim()) {
      throw new Error('The selected CSV file is empty.');
    }

    const parsed = parseCsv(text);
    const config = formatConfigs[parsed.type];
    const beforePreview = buildPreviewSnapshot(parsed.rows, parsed.type, config);
    const result = parsed.type === 'dhl'
      ? compactDhlRows(parsed.rows, config)
      : compactMultiItemRows(parsed.rows, config);

    if (!result.stats.itemsFound) {
      throw new Error(`No ${config.label} item rows were found. Check that this file uses the same format as the Ireland/Greece CSV editor.`);
    }

    return {
      csv: buildCsv(parsed, result.rows),
      type: parsed.type,
      label: config.label,
      stats: result.stats,
      preview: buildPreview(
        beforePreview,
        buildPreviewSnapshot(result.rows, parsed.type, config)
      ),
    };
  };

  const makeOutputFileName = (fileName) => {
    const safeName = toCellText(fileName) || 'shipping.csv';
    if (/\.csv$/i.test(safeName)) {
      return safeName.replace(/\.csv$/i, '_compacted.csv');
    }
    return `${safeName}_compacted.csv`;
  };

  const api = {
    compactCsv,
    makeOutputFileName,
    parseCsv,
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  }
  if (typeof window !== 'undefined') {
    window.ShippingCsvCompactor = api;
  }

  if (typeof document === 'undefined') {
    return;
  }

  const fileInput = document.getElementById('shipping-compact-file');
  if (!fileInput) {
    return;
  }

  const downloadButton = document.getElementById('shipping-compact-download');
  const status = document.getElementById('shipping-compact-status');
  const previewToggle = document.getElementById('shipping-compact-preview-toggle');
  const previewSection = document.getElementById('shipping-compact-preview');
  const previewSummary = document.getElementById('shipping-compact-preview-summary');
  const previewOrders = document.getElementById('shipping-compact-preview-orders');
  let outputCsv = '';
  let outputFileName = '';
  let previewData = null;
  let previewIsRendered = false;

  const removeAllChildren = (element) => {
    while (element.firstChild) {
      element.removeChild(element.firstChild);
    }
  };

  const hidePreview = () => {
    previewSection.classList.add('d-none');
    previewSection.setAttribute('aria-hidden', 'true');
    previewToggle.setAttribute('aria-expanded', 'false');
  };

  const resetPreview = () => {
    previewData = null;
    previewIsRendered = false;
    previewSummary.textContent = '';
    removeAllChildren(previewOrders);
    hidePreview();
  };

  const resetOutput = () => {
    outputCsv = '';
    outputFileName = '';
    downloadButton.disabled = true;
    resetPreview();
  };

  const setStatus = (message, style) => {
    status.textContent = message || '';
    status.classList.remove('alert-success', 'alert-danger', 'alert-warning', 'text-muted');
    if (style === 'success') {
      status.classList.add('alert-success');
    } else if (style === 'danger') {
      status.classList.add('alert-danger');
    } else if (style === 'warning') {
      status.classList.add('alert-warning');
    } else {
      status.classList.add('text-muted');
    }
  };

  const buildResultMessage = (result) => {
    const stats = result.stats;
    const details = [`Detected ${result.label} CSV.`];
    if (stats.duplicateItemsRemoved) {
      details.push(`Combined ${stats.duplicateItemsRemoved} duplicate item(s) across ${stats.combinedEntries} matching group(s).`);
      if (result.type === 'dhl') {
        details.push(`Removed ${stats.rowsRemoved} row(s) and recalculated item numbers.`);
      } else {
        details.push(`Removed ${stats.itemBlocksRemoved} six-column item block(s).`);
      }
    } else {
      details.push('No matching items needed to be combined.');
      if (result.type === 'dhl') {
        details.push('Item numbers were recalculated.');
      }
    }
    if (stats.skippedGroups) {
      details.push(`${stats.skippedGroups} matching group(s) could not be combined. ${stats.warnings.join(' ')}`);
    }
    details.push('The compacted file is ready to download.');
    return details.join(' ');
  };

  const createElement = (tagName, className, textContent) => {
    const element = document.createElement(tagName);
    if (className) {
      element.className = className;
    }
    if (textContent !== undefined) {
      element.textContent = textContent;
    }
    return element;
  };

  const displayPreviewValue = (value) => {
    const text = toCellText(value);
    return text === '' ? '\u2014' : text;
  };

  const appendPreviewCell = (row, tagName, value, className) => {
    const cell = createElement(tagName, className, displayPreviewValue(value));
    if (tagName === 'th') {
      cell.setAttribute('scope', 'row');
    }
    row.appendChild(cell);
  };

  const buildPreviewTable = (items, stage, orderLabel) => {
    const panelClass = stage === 'After'
      ? 'shipping-compact-preview-panel shipping-compact-preview-panel--after'
      : 'shipping-compact-preview-panel';
    const panel = createElement('div', panelClass);
    const itemLabel = items.length === 1 ? 'item' : 'items';
    panel.appendChild(createElement(
      'h4',
      'shipping-compact-preview-panel-heading',
      `${stage} \u00b7 ${items.length} ${itemLabel}`
    ));

    const tableWrapper = createElement('div', 'table-responsive shipping-compact-preview-table-wrap');
    const table = createElement('table', 'table table-sm table-striped shipping-compact-preview-table');
    const caption = createElement('caption', 'sr-only', `${stage} items for ${orderLabel}`);
    const tableHead = document.createElement('thead');
    const headingRow = document.createElement('tr');
    const showWeights = items.some((item) => item.unitWeight !== undefined);
    [
      ['#', 'shipping-compact-preview-number'],
      ['Item name', 'shipping-compact-preview-name'],
      ['HS/TARIC', 'shipping-compact-preview-code'],
      ['Unit price', 'shipping-compact-preview-value'],
      ['Quantity', 'shipping-compact-preview-value'],
      ...(showWeights ? [['Unit weight', 'shipping-compact-preview-value']] : []),
    ].forEach(([label, className]) => {
      const heading = createElement('th', className, label);
      heading.setAttribute('scope', 'col');
      headingRow.appendChild(heading);
    });
    tableHead.appendChild(headingRow);

    const tableBody = document.createElement('tbody');
    items.forEach((item, itemIndex) => {
      const row = document.createElement('tr');
      appendPreviewCell(
        row,
        'th',
        item.itemNumber || String(itemIndex + 1),
        'shipping-compact-preview-number'
      );
      appendPreviewCell(row, 'td', item.name, 'shipping-compact-preview-name');
      appendPreviewCell(row, 'td', item.hsCode, 'shipping-compact-preview-code');
      appendPreviewCell(row, 'td', item.unitPrice, 'shipping-compact-preview-value');
      appendPreviewCell(row, 'td', item.quantity, 'shipping-compact-preview-value');
      if (showWeights) {
        appendPreviewCell(row, 'td', item.unitWeight, 'shipping-compact-preview-value');
      }
      tableBody.appendChild(row);
    });

    table.appendChild(caption);
    table.appendChild(tableHead);
    table.appendChild(tableBody);
    tableWrapper.appendChild(table);
    panel.appendChild(tableWrapper);
    return panel;
  };

  const buildPreviewOrder = (order) => {
    const orderCard = createElement('article', 'card shipping-compact-preview-order mb-3');
    const header = createElement('div', 'card-header shipping-compact-preview-order-header');
    header.appendChild(createElement('h3', 'h6 mb-0', order.label));

    const itemCountChanged = order.before.length !== order.after.length;
    const beforeItemLabel = order.before.length === 1 ? 'item' : 'items';
    const afterItemLabel = order.after.length === 1 ? 'item' : 'items';
    const countBadge = createElement(
      'span',
      `badge badge-${itemCountChanged ? 'success' : 'secondary'}`,
      `${order.before.length} ${beforeItemLabel} \u2192 ${order.after.length} ${afterItemLabel}`
    );
    header.appendChild(countBadge);
    orderCard.appendChild(header);

    const body = createElement('div', 'card-body');
    const columns = createElement('div', 'row');
    const beforeColumn = createElement('div', 'col-lg-6 mb-3 mb-lg-0');
    const afterColumn = createElement('div', 'col-lg-6');
    beforeColumn.appendChild(buildPreviewTable(order.before, 'Before', order.label));
    afterColumn.appendChild(buildPreviewTable(order.after, 'After', order.label));
    columns.appendChild(beforeColumn);
    columns.appendChild(afterColumn);
    body.appendChild(columns);
    orderCard.appendChild(body);
    return orderCard;
  };

  const renderPreview = () => {
    removeAllChildren(previewOrders);
    const fragment = document.createDocumentFragment();
    previewData.orders.forEach((order) => {
      fragment.appendChild(buildPreviewOrder(order));
    });
    previewOrders.appendChild(fragment);

    const shownOrders = previewData.orders.length;
    const totalOrders = previewData.totalOrders;
    if (totalOrders > shownOrders) {
      previewSummary.textContent = `Showing the first ${shownOrders.toLocaleString()} of ${totalOrders.toLocaleString()} orders. The downloaded CSV includes all orders.`;
    } else {
      previewSummary.textContent = `Showing all ${totalOrders.toLocaleString()} orders.`;
    }
    previewIsRendered = true;
  };

  const updatePreviewVisibility = () => {
    if (!previewData || !previewToggle.checked) {
      if (!previewToggle.checked && previewIsRendered) {
        removeAllChildren(previewOrders);
        previewIsRendered = false;
      }
      hidePreview();
      return;
    }

    if (!previewIsRendered) {
      renderPreview();
    }
    previewSection.classList.remove('d-none');
    previewSection.setAttribute('aria-hidden', 'false');
    previewToggle.setAttribute('aria-expanded', 'true');
  };

  fileInput.addEventListener('change', () => {
    const file = fileInput.files[0];
    resetOutput();
    if (!file) {
      setStatus('Select a CSV file to begin.');
      return;
    }

    setStatus('Reading and compacting the CSV file...');
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const result = compactCsv(reader.result || '');
        outputCsv = result.csv;
        outputFileName = makeOutputFileName(file.name);
        previewData = result.preview;
        downloadButton.disabled = false;
        updatePreviewVisibility();
        setStatus(buildResultMessage(result), result.stats.skippedGroups ? 'warning' : 'success');
      } catch (error) {
        setStatus(error && error.message ? error.message : 'Could not compact this CSV file.', 'danger');
      }
    };
    reader.onerror = () => {
      setStatus('Could not read the selected CSV file.', 'danger');
    };
    reader.readAsText(file, 'utf-8');
  });

  downloadButton.addEventListener('click', () => {
    if (!outputCsv || !outputFileName) {
      return;
    }
    const blob = new Blob([outputCsv], { type: 'text/csv;charset=utf-8' });
    saveAs(blob, outputFileName);
  });

  previewToggle.addEventListener('change', updatePreviewVisibility);

  resetOutput();
  setStatus('Select a CSV file to begin.');
})();
