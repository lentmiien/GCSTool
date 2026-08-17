(() => {
  const formatConfigs = {
    japanPost: {
      label: 'Japan Post',
      blockStartIndex: 25,
      blockSize: 6,
      nameOffset: 0,
      quantityOffset: 1,
      priceOffset: 2,
      hsOffset: 4,
    },
    ePacket: {
      label: 'ePacket',
      blockStartIndex: 22,
      blockSize: 6,
      nameOffset: 0,
      hsOffset: 1,
      quantityOffset: 3,
      priceOffset: 4,
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

    group[0].row[group[0].quantityIndex] = String(combinedQuantity);
    group.slice(1).forEach(removeItem);
    stats.combinedEntries += 1;
    stats.duplicateItemsRemoved += group.length - 1;
  };

  const compactMultiItemRows = (rows, config) => {
    const stats = makeStats();
    const maximumOffset = Math.max(
      config.nameOffset,
      config.quantityOffset,
      config.priceOffset,
      config.hsOffset
    );

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
  let outputCsv = '';
  let outputFileName = '';

  const resetOutput = () => {
    outputCsv = '';
    outputFileName = '';
    downloadButton.disabled = true;
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
        downloadButton.disabled = false;
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

  resetOutput();
  setStatus('Select a CSV file to begin.');
})();
