(() => {
  const fileInput = document.getElementById('inputfile');
  if (!fileInput) {
    return;
  }

  const exportBtn = document.getElementById('export-btn');
  const removeToyBtn = document.getElementById('remove-toy-btn');
  const autoTaricBtn = document.getElementById('auto-taric-btn');
  const reviewTaricBtn = document.getElementById('review-taric-btn');
  const copySummaryBtn = document.getElementById('copy-summary-btn');
  const rowsContainer = document.getElementById('ie-rows');
  const statusEl = document.getElementById('file-status');
  const toolStatusEl = document.getElementById('tool-status');
  const reviewOverlay = document.getElementById('review-overlay');
  const reviewCloseBtn = document.getElementById('review-close-btn');
  const reviewNextBtn = document.getElementById('review-next-btn');
  const reviewProgress = document.getElementById('review-progress');
  const reviewOrder = document.getElementById('review-order');
  const reviewRow = document.getElementById('review-row');
  const reviewItemNumber = document.getElementById('review-item-number');
  const reviewItemName = document.getElementById('review-item-name');
  const reviewOriginalHs = document.getElementById('review-original-hs');
  const reviewCurrentHs = document.getElementById('review-current-hs');
  const reviewMatchStatus = document.getElementById('review-match-status');
  const reviewInput = document.getElementById('review-input');
  const taricMappingsEl = document.getElementById('taric-mappings');

  let initialTaricMappings = [];
  try {
    initialTaricMappings = JSON.parse(taricMappingsEl ? taricMappingsEl.textContent : '[]') || [];
  } catch (err) {
    initialTaricMappings = [];
  }

  let rows = [];
  let rowDelimiter = '\r\n';
  let fieldDelimiter = ',';
  let fileName = '';
  let csvType = 'japanPost';
  let hasQuotedFields = false;
  let items = [];
  let reviewQueue = [];
  let reviewIndex = -1;
  let exportInFlight = false;
  let automationHasRun = false;
  let taricLookup = {
    jan: new Map(),
    nameHs: new Map(),
  };

  const janPattern = /\(\s*JAN\s*([0-9]{8,14})\s*\)\s*$/i;

  const setStatus = (text) => {
    statusEl.textContent = text || '';
  };

  const setToolStatus = (text) => {
    toolStatusEl.textContent = text || '';
  };

  const collapseWhitespace = (value) => String(value || '').replace(/\s+/g, ' ').trim();

  const sanitizeCode = (value) => collapseWhitespace(value);

  const stripJanSuffix = (value) => collapseWhitespace(String(value || '').replace(/\s*\(\s*JAN\s*[0-9]{8,14}\s*\)\s*$/i, ' '));

  const stripToyPrefix = (value) => collapseWhitespace(String(value || '').replace(/^toy\b[\s-]*/i, ' '));

  const cleanItemName = (value) => stripToyPrefix(stripJanSuffix(value));

  const normalizeItemName = (value) => stripToyPrefix(stripJanSuffix(value)).toLowerCase();

  const extractJanCode = (value) => {
    const match = String(value || '').match(janPattern);
    return match ? match[1] : '';
  };

  const buildNameKey = (normalizedName, sourceHsCode) => `${normalizedName}__${sourceHsCode}`;

  const parseDateValue = (value) => {
    if (!value) {
      return 0;
    }
    const time = new Date(value).getTime();
    return Number.isNaN(time) ? 0 : time;
  };

  const shouldReplaceMapping = (existing, incoming) => {
    if (!existing) {
      return true;
    }
    const existingUses = Number(existing.uses || 0);
    const incomingUses = Number(incoming.uses || 0);
    if (incomingUses !== existingUses) {
      return incomingUses > existingUses;
    }
    return parseDateValue(incoming.updatedAt) >= parseDateValue(existing.updatedAt);
  };

  const upsertTaricLookup = (entry, force) => {
    if (!entry || !entry.mappingType) {
      return;
    }

    if (entry.mappingType === 'jan' && entry.janCode) {
      const existing = taricLookup.jan.get(entry.janCode);
      if (force || shouldReplaceMapping(existing, entry)) {
        taricLookup.jan.set(entry.janCode, entry);
      }
      return;
    }

    if (entry.mappingType === 'name_hs' && entry.itemNameNormalized && entry.sourceHsCode) {
      const key = buildNameKey(entry.itemNameNormalized, entry.sourceHsCode);
      const existing = taricLookup.nameHs.get(key);
      if (force || shouldReplaceMapping(existing, entry)) {
        taricLookup.nameHs.set(key, entry);
      }
    }
  };

  const rebuildTaricLookup = () => {
    taricLookup = {
      jan: new Map(),
      nameHs: new Map(),
    };
    initialTaricMappings.forEach((entry) => {
      upsertTaricLookup(entry, false);
    });
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

  const refreshButtons = () => {
    const hasItems = items.length > 0;
    removeToyBtn.disabled = !hasItems;
    autoTaricBtn.disabled = !hasItems;
    reviewTaricBtn.disabled = !hasItems;
    copySummaryBtn.disabled = !hasItems;
    exportBtn.disabled = !hasItems || exportInFlight;
  };

  const closeReviewModal = () => {
    reviewOverlay.classList.add('d-none');
  };

  const resetState = () => {
    rows = [];
    rowDelimiter = '\r\n';
    fieldDelimiter = ',';
    fileName = '';
    csvType = 'japanPost';
    hasQuotedFields = false;
    items = [];
    reviewQueue = [];
    reviewIndex = -1;
    exportInFlight = false;
    automationHasRun = false;
    rowsContainer.innerHTML = '';
    closeReviewModal();
    reviewInput.value = '';
    setStatus('');
    setToolStatus('');
    refreshButtons();
  };

  const invalidateAutomationResults = (message) => {
    if (!automationHasRun) {
      return;
    }
    automationHasRun = false;
    reviewQueue = [];
    reviewIndex = -1;
    items.forEach((item) => {
      item.lastAutoMatch = 'not_run';
      item.requiresReview = false;
      item.reviewCompleted = false;
    });
    closeReviewModal();
    setToolStatus(message || 'Item names changed. Run HS to TARIC automation again to refresh suggestions.');
  };

  const parseCsvLine = (line) => {
    if (!hasQuotedFields) {
      return line.split(fieldDelimiter);
    }
    const cols = [];
    let field = '';
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      if (char === '"') {
        if (inQuotes && line[i + 1] === '"') {
          field += '"';
          i += 1;
          continue;
        }
        inQuotes = !inQuotes;
        continue;
      }
      if (char === fieldDelimiter && !inQuotes) {
        cols.push(field);
        field = '';
        continue;
      }
      field += char;
    }
    cols.push(field);
    return cols;
  };

  const detectCsvType = (lines) => {
    const sampleLine = lines.find((line) => line.length);
    if (!sampleLine) {
      return { type: 'japanPost', delimiter: ',', quoted: false };
    }
    const quotedLinePattern = /^"(?:[^"]|"")*"(?:,"(?:[^"]|"")*")*$/;
    if (sampleLine.indexOf('\t') !== -1) {
      return { type: 'ePacket', delimiter: '\t', quoted: false };
    }
    if (quotedLinePattern.test(sampleLine)) {
      return { type: 'dhl', delimiter: ',', quoted: true };
    }
    return { type: 'japanPost', delimiter: ',', quoted: false };
  };

  const parseCsv = (text) => {
    const safeText = String(text || '').replace(/^\uFEFF/, '');
    rowDelimiter = detectRowDelimiter(safeText);
    const lines = safeText.split(rowDelimiter);
    const format = detectCsvType(lines);
    csvType = format.type;
    fieldDelimiter = format.delimiter;
    hasQuotedFields = format.quoted;
    rows = lines.map((line) => (line.length ? parseCsvLine(line) : []));
  };

  const formatDhlValue = (value) => {
    const safeValue = value == null ? '' : String(value);
    return `"${safeValue.replace(/"/g, '""')}"`;
  };

  const setItemField = (item, field, value, syncInput) => {
    const safeValue = value == null ? '' : String(value);

    if (field === 'product') {
      item.currentProductName = safeValue;
      if (rows[item.rowIndex]) {
        rows[item.rowIndex][item.productIndex] = safeValue;
      }
      if (syncInput !== false && item.productInput && item.productInput.value !== safeValue) {
        item.productInput.value = safeValue;
      }
      return;
    }

    item.currentHsCode = safeValue;
    if (rows[item.rowIndex]) {
      rows[item.rowIndex][item.hsIndex] = safeValue;
    }
    if (syncInput !== false && item.hsInput && item.hsInput.value !== safeValue) {
      item.hsInput.value = safeValue;
    }

    if (!reviewOverlay.classList.contains('d-none') && reviewQueue[reviewIndex] === item) {
      reviewCurrentHs.value = safeValue;
      reviewInput.value = safeValue;
    }
  };

  const syncRowsFromItems = (trimHs) => {
    items.forEach((item) => {
      if (rows[item.rowIndex]) {
        rows[item.rowIndex][item.productIndex] = item.currentProductName;
      }

      let hsValue = item.currentHsCode;
      if (trimHs) {
        hsValue = sanitizeCode(hsValue);
        item.currentHsCode = hsValue;
        if (item.hsInput && item.hsInput.value !== hsValue) {
          item.hsInput.value = hsValue;
        }
      }

      if (rows[item.rowIndex]) {
        rows[item.rowIndex][item.hsIndex] = hsValue;
      }
    });
  };

  const registerItem = ({ rowIndex, orderNumber, itemNumber, productIndex, hsIndex, productValue, hsValue }) => {
    const item = {
      id: `${rowIndex}_${productIndex}`,
      rowIndex,
      csvRowNumber: rowIndex + 1,
      orderNumber,
      itemNumber,
      productIndex,
      hsIndex,
      originalProductName: productValue || '',
      currentProductName: productValue || '',
      originalHsCode: hsValue || '',
      currentHsCode: hsValue || '',
      lastAutoMatch: 'not_run',
      requiresReview: false,
      reviewCompleted: false,
      productInput: null,
      hsInput: null,
    };
    items.push(item);
    return item;
  };

  const attachFieldListeners = (item) => {
    item.productInput.addEventListener('input', () => {
      const nextValue = item.productInput.value;
      const shouldInvalidate = automationHasRun && nextValue !== item.currentProductName;
      setItemField(item, 'product', nextValue, false);
      if (shouldInvalidate) {
        invalidateAutomationResults('Item names changed. Run HS to TARIC automation again to refresh TARIC suggestions.');
      }
    });

    item.hsInput.addEventListener('input', () => {
      setItemField(item, 'hs', item.hsInput.value, false);
    });
  };

  const createFieldGroup = ({ labelText, colClasses, value }) => {
    const group = document.createElement('div');
    group.classList.add('form-group');
    colClasses.forEach((className) => {
      group.classList.add(className);
    });

    const label = document.createElement('label');
    label.textContent = labelText;
    const input = document.createElement('input');
    input.type = 'text';
    input.classList.add('form-control', 'ie-field', 'ie-dark-input');
    input.value = value || '';

    group.appendChild(label);
    group.appendChild(input);

    return { group, input };
  };

  const buildMultiItemEditor = ({ label, productStartIndex, hsStartIndex }) => {
    const fragment = document.createDocumentFragment();
    let irelandCount = 0;
    let itemCountTotal = 0;

    rows.forEach((row, rowIndex) => {
      if (row.length > 12 && row[12].trim() === 'IE') {
        irelandCount += 1;
        const orderNumber = row[0] || '(missing order)';

        const card = document.createElement('div');
        card.classList.add('card', 'mb-3', 'ie-editor-card');

        const header = document.createElement('div');
        header.classList.add('card-header', 'ie-editor-card-header');
        header.textContent = `Order ${orderNumber}`;
        card.appendChild(header);

        const body = document.createElement('div');
        body.classList.add('card-body', 'ie-editor-card-body');

        let itemIndex = 0;
        let foundItem = false;
        while (true) {
          const productIndex = productStartIndex + (itemIndex * 6);
          const hsIndex = hsStartIndex + (itemIndex * 6);
          if (productIndex >= row.length || hsIndex >= row.length) {
            break;
          }

          const productValue = row[productIndex] || '';
          const hsValue = row[hsIndex] || '';
          itemIndex += 1;

          if (!productValue && !hsValue) {
            continue;
          }

          foundItem = true;
          itemCountTotal += 1;
          const item = registerItem({
            rowIndex,
            orderNumber,
            itemNumber: itemIndex,
            productIndex,
            hsIndex,
            productValue,
            hsValue,
          });

          const rowDiv = document.createElement('div');
          rowDiv.classList.add('form-row');

          const productGroup = createFieldGroup({
            labelText: `Item ${item.itemNumber} product name (col ${productIndex + 1})`,
            colClasses: ['col-md-8'],
            value: productValue,
          });
          item.productInput = productGroup.input;

          const hsGroup = createFieldGroup({
            labelText: `HS code (col ${hsIndex + 1})`,
            colClasses: ['col-md-4'],
            value: hsValue,
          });
          item.hsInput = hsGroup.input;

          attachFieldListeners(item);

          rowDiv.appendChild(productGroup.group);
          rowDiv.appendChild(hsGroup.group);
          body.appendChild(rowDiv);
        }

        if (!foundItem) {
          const warning = document.createElement('div');
          warning.classList.add('alert', 'alert-warning', 'mb-0', 'ie-editor-warning');
          warning.textContent = 'No item columns found for this row.';
          body.appendChild(warning);
        }

        card.appendChild(body);
        fragment.appendChild(card);
      }
    });

    rowsContainer.appendChild(fragment);

    if (irelandCount === 0) {
      setStatus('No Ireland (IE) rows found in this file.');
      return;
    }

    setStatus(`Detected ${label} CSV. Loaded ${rows.length} rows. Showing ${irelandCount} Ireland row(s) with ${itemCountTotal} item(s).`);
  };

  const buildDhlEditor = () => {
    const fragment = document.createDocumentFragment();
    const orderMap = new Map();
    let irelandCount = 0;
    let itemCountTotal = 0;

    const getOrderCard = (orderNumber) => {
      if (orderMap.has(orderNumber)) {
        return orderMap.get(orderNumber);
      }

      const card = document.createElement('div');
      card.classList.add('card', 'mb-3', 'ie-editor-card');

      const header = document.createElement('div');
      header.classList.add('card-header', 'ie-editor-card-header');
      header.textContent = `Order ${orderNumber}`;
      card.appendChild(header);

      const body = document.createElement('div');
      body.classList.add('card-body', 'ie-editor-card-body');
      card.appendChild(body);

      const orderState = { card, body, itemIndex: 0 };
      orderMap.set(orderNumber, orderState);
      fragment.appendChild(card);
      return orderState;
    };

    rows.forEach((row, rowIndex) => {
      if (row.length > 14 && row[14].trim() === 'IE') {
        irelandCount += 1;
        const orderNumber = row[0] || '(missing order)';
        const orderState = getOrderCard(orderNumber);
        orderState.itemIndex += 1;

        const productIndex = 17;
        const hsIndex = 29;
        const productValue = row[productIndex] || '';
        const hsValue = row[hsIndex] || '';
        if (!productValue && !hsValue) {
          return;
        }

        itemCountTotal += 1;
        const item = registerItem({
          rowIndex,
          orderNumber,
          itemNumber: orderState.itemIndex,
          productIndex,
          hsIndex,
          productValue,
          hsValue,
        });

        const rowDiv = document.createElement('div');
        rowDiv.classList.add('form-row');

        const productGroup = createFieldGroup({
          labelText: `Item ${item.itemNumber} product name (col ${productIndex + 1})`,
          colClasses: ['col-md-8'],
          value: productValue,
        });
        item.productInput = productGroup.input;

        const hsGroup = createFieldGroup({
          labelText: `HS code (col ${hsIndex + 1})`,
          colClasses: ['col-md-4'],
          value: hsValue,
        });
        item.hsInput = hsGroup.input;

        attachFieldListeners(item);

        rowDiv.appendChild(productGroup.group);
        rowDiv.appendChild(hsGroup.group);
        orderState.body.appendChild(rowDiv);
      }
    });

    rowsContainer.appendChild(fragment);

    if (irelandCount === 0) {
      setStatus('No Ireland (IE) rows found in this file.');
      return;
    }

    setStatus(`Detected DHL CSV. Loaded ${rows.length} rows. Showing ${irelandCount} Ireland row(s) with ${itemCountTotal} item(s).`);
  };

  const buildEditor = () => {
    rowsContainer.innerHTML = '';
    items = [];
    reviewQueue = [];
    reviewIndex = -1;
    automationHasRun = false;
    closeReviewModal();
    reviewInput.value = '';
    setToolStatus('');

    if (!rows.length) {
      setStatus('No rows found.');
      refreshButtons();
      return;
    }

    if (csvType === 'dhl') {
      buildDhlEditor();
    } else if (csvType === 'ePacket') {
      buildMultiItemEditor({
        label: 'ePacket',
        productStartIndex: 22,
        hsStartIndex: 23,
      });
    } else {
      buildMultiItemEditor({
        label: 'Japan Post',
        productStartIndex: 25,
        hsStartIndex: 29,
      });
    }

    refreshButtons();
  };

  const removeToyFromDisplayName = (value) => {
    const currentValue = String(value || '');
    if (!/^\s*toy\b/i.test(currentValue)) {
      return {
        changed: false,
        value: currentValue,
      };
    }

    const withoutToy = currentValue.replace(/^\s*toy\b[\s-]*/i, '');
    const trimmed = withoutToy.trimStart();
    if (!trimmed) {
      return {
        changed: false,
        value: currentValue,
      };
    }

    return {
      changed: true,
      value: trimmed.charAt(0).toUpperCase() + trimmed.slice(1),
    };
  };

  const applyRemoveToy = () => {
    if (!items.length) {
      alert('Select a CSV file first.');
      return;
    }

    const hadAutomation = automationHasRun;
    let changedCount = 0;
    items.forEach((item) => {
      const result = removeToyFromDisplayName(item.currentProductName);
      if (result.changed && result.value !== item.currentProductName) {
        setItemField(item, 'product', result.value);
        changedCount += 1;
      }
    });

    if (changedCount > 0) {
      invalidateAutomationResults('Item names changed. Run HS to TARIC automation again to refresh TARIC suggestions.');
      setToolStatus(hadAutomation
        ? `Removed "Toy" from ${changedCount} item name(s). Run HS to TARIC automation again.`
        : `Removed "Toy" from ${changedCount} item name(s).`);
      return;
    }

    setToolStatus('No item names started with "Toy".');
  };

  const runTaricAutomation = () => {
    if (!items.length) {
      alert('Select a CSV file first.');
      return;
    }

    let janMatches = 0;
    let nameMatches = 0;
    let unmatched = 0;

    items.forEach((item) => {
      const itemName = item.currentProductName;
      const sourceHsCode = sanitizeCode(item.originalHsCode);
      const janCode = extractJanCode(itemName);
      const janMatch = janCode ? taricLookup.jan.get(janCode) : null;
      const normalizedName = normalizeItemName(itemName);
      const nameKey = normalizedName && sourceHsCode ? buildNameKey(normalizedName, sourceHsCode) : '';
      const nameMatch = nameKey ? taricLookup.nameHs.get(nameKey) : null;

      if (janMatch && sanitizeCode(janMatch.taricCode)) {
        setItemField(item, 'hs', sanitizeCode(janMatch.taricCode));
        item.lastAutoMatch = 'jan';
        item.requiresReview = false;
        item.reviewCompleted = true;
        janMatches += 1;
        return;
      }

      if (nameMatch && sanitizeCode(nameMatch.taricCode)) {
        setItemField(item, 'hs', sanitizeCode(nameMatch.taricCode));
        item.lastAutoMatch = 'name_hs';
        item.requiresReview = true;
        item.reviewCompleted = false;
        nameMatches += 1;
        return;
      }

      setItemField(item, 'hs', item.originalHsCode);
      item.lastAutoMatch = 'unmatched';
      item.requiresReview = true;
      item.reviewCompleted = false;
      unmatched += 1;
    });

    automationHasRun = true;
    reviewQueue = items.filter((item) => item.requiresReview);
    reviewIndex = reviewQueue.length > 0 ? 0 : -1;
    setToolStatus(`TARIC automation finished. ${janMatches} JAN match(es), ${nameMatches} item + HS match(es), ${unmatched} manual item(s).`);
  };

  const getMatchLabel = (item) => {
    if (item.lastAutoMatch === 'jan') {
      return 'JAN to TARIC';
    }
    if (item.lastAutoMatch === 'name_hs') {
      return 'Item name + HS match';
    }
    if (item.lastAutoMatch === 'unmatched') {
      return 'No match';
    }
    return 'Not run';
  };

  const showReviewItem = () => {
    if (!reviewQueue.length || reviewIndex < 0 || reviewIndex >= reviewQueue.length) {
      closeReviewModal();
      setToolStatus('TARIC review complete.');
      return;
    }

    const item = reviewQueue[reviewIndex];
    reviewProgress.textContent = `Review ${reviewIndex + 1} of ${reviewQueue.length}`;
    reviewOrder.value = item.orderNumber;
    reviewRow.value = String(item.csvRowNumber);
    reviewItemNumber.value = String(item.itemNumber);
    reviewItemName.value = item.currentProductName;
    reviewOriginalHs.value = item.originalHsCode;
    reviewCurrentHs.value = item.currentHsCode;
    reviewMatchStatus.value = getMatchLabel(item);
    reviewInput.value = item.currentHsCode;
    reviewNextBtn.textContent = reviewIndex === reviewQueue.length - 1 ? 'Finish' : 'Next';
    reviewOverlay.classList.remove('d-none');
    reviewInput.focus();
    reviewInput.select();
  };

  const openReviewModal = () => {
    if (!items.length) {
      alert('Select a CSV file first.');
      return;
    }

    if (!automationHasRun) {
      runTaricAutomation();
    }

    reviewQueue = items.filter((item) => item.requiresReview);
    if (!reviewQueue.length) {
      setToolStatus('No TARIC review needed. All items matched by JAN.');
      return;
    }

    const firstPending = reviewQueue.findIndex((item) => !item.reviewCompleted);
    reviewIndex = firstPending >= 0 ? firstPending : 0;
    showReviewItem();
  };

  const saveCurrentReview = () => {
    if (!reviewQueue.length || reviewIndex < 0 || reviewIndex >= reviewQueue.length) {
      return false;
    }

    const item = reviewQueue[reviewIndex];
    const nextTaric = sanitizeCode(reviewInput.value);
    if (!nextTaric) {
      alert('Enter a TARIC code before moving to the next item.');
      reviewInput.focus();
      return false;
    }

    setItemField(item, 'hs', nextTaric);
    item.reviewCompleted = true;
    item.requiresReview = true;
    reviewCurrentHs.value = nextTaric;
    return true;
  };

  const advanceReview = () => {
    if (!saveCurrentReview()) {
      return;
    }

    if (reviewIndex >= reviewQueue.length - 1) {
      closeReviewModal();
      setToolStatus(`Reviewed ${reviewQueue.length} TARIC item(s).`);
      return;
    }

    reviewIndex += 1;
    showReviewItem();
  };

  const buildSummaryText = () => {
    const orderSummary = new Map();

    items.forEach((item) => {
      const orderNumber = item.orderNumber || '(missing order)';
      if (!orderSummary.has(orderNumber)) {
        orderSummary.set(orderNumber, {
          orderNumber,
          itemNameEdits: 0,
          taricEdits: 0,
          nonEditCount: 0,
        });
      }

      const summary = orderSummary.get(orderNumber);
      const itemNameEdited = item.currentProductName !== item.originalProductName;
      const taricEdited = sanitizeCode(item.currentHsCode) !== sanitizeCode(item.originalHsCode);

      if (itemNameEdited) {
        summary.itemNameEdits += 1;
      }
      if (taricEdited) {
        summary.taricEdits += 1;
      }
      if (!itemNameEdited && !taricEdited) {
        summary.nonEditCount += 1;
      }
    });

    return Array.from(orderSummary.values())
      .map((summary) => `${summary.orderNumber},${summary.itemNameEdits},${summary.taricEdits},${summary.nonEditCount}`)
      .join('\n');
  };

  const copyTextToClipboard = async (text) => {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      await navigator.clipboard.writeText(text);
      return;
    }

    const listener = (event) => {
      event.clipboardData.setData('text/plain', text);
      event.preventDefault();
    };
    document.addEventListener('copy', listener);
    document.execCommand('copy');
    document.removeEventListener('copy', listener);
  };

  const copyWorkSummary = async () => {
    if (!items.length) {
      alert('Select a CSV file first.');
      return;
    }

    const summaryText = buildSummaryText();
    if (!summaryText) {
      setToolStatus('No Ireland items available for summary copy.');
      return;
    }

    try {
      await copyTextToClipboard(summaryText);
      setToolStatus('Copied work summary to the clipboard.');
    } catch (err) {
      setToolStatus('Could not copy the work summary.');
    }
  };

  const collectMappingsToSave = () => {
    syncRowsFromItems(true);
    return items
      .filter((item) => sanitizeCode(item.currentHsCode) && sanitizeCode(item.currentHsCode) !== sanitizeCode(item.originalHsCode))
      .map((item) => ({
        itemName: item.currentProductName,
        itemNameNormalized: normalizeItemName(item.currentProductName),
        sourceHsCode: sanitizeCode(item.originalHsCode),
        taricCode: sanitizeCode(item.currentHsCode),
        janCode: extractJanCode(item.currentProductName),
      }))
      .filter((entry) => entry.sourceHsCode && entry.taricCode && (entry.janCode || entry.itemNameNormalized));
  };

  const updateLocalMappings = (savedItems) => {
    const timestamp = new Date().toISOString();

    savedItems.forEach((entry) => {
      if (entry.janCode) {
        upsertTaricLookup({
          mappingType: 'jan',
          janCode: entry.janCode,
          itemName: cleanItemName(entry.itemName),
          itemNameNormalized: entry.itemNameNormalized,
          sourceHsCode: entry.sourceHsCode,
          taricCode: entry.taricCode,
          uses: 1,
          updatedAt: timestamp,
        }, true);
      }

      if (entry.itemNameNormalized) {
        upsertTaricLookup({
          mappingType: 'name_hs',
          itemName: cleanItemName(entry.itemName),
          itemNameNormalized: entry.itemNameNormalized,
          sourceHsCode: entry.sourceHsCode,
          taricCode: entry.taricCode,
          uses: 1,
          updatedAt: timestamp,
        }, true);
      }
    });
  };

  const saveMappings = async () => {
    const savedItems = collectMappingsToSave();
    if (!savedItems.length) {
      return {
        message: 'No TARIC edits to save to the mapping database.',
      };
    }

    const response = await fetch('/hs/ireland/save-mappings', {
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
      method: 'POST',
      body: JSON.stringify({ items: savedItems }),
    });

    if (!response.ok) {
      throw new Error('mapping save failed');
    }

    const result = await response.json();
    updateLocalMappings(savedItems);
    return {
      message: `Saved ${result.saved} mapping record(s).`,
    };
  };

  const buildCsvOutput = () => {
    syncRowsFromItems(true);
    return rows.map((cols) => {
      if (!cols.length) {
        return '';
      }
      if (csvType === 'dhl') {
        return cols.map(formatDhlValue).join(fieldDelimiter);
      }
      return cols.join(fieldDelimiter);
    }).join(rowDelimiter);
  };

  const exportCsv = async () => {
    if (!rows.length || !fileName) {
      alert('Select a CSV file first.');
      return;
    }

    exportInFlight = true;
    refreshButtons();

    let mappingMessage = 'No TARIC edits to save to the mapping database.';
    try {
      const saveResult = await saveMappings();
      mappingMessage = saveResult.message;
    } catch (err) {
      mappingMessage = 'CSV exported, but TARIC mappings could not be saved.';
    }

    const output = buildCsvOutput();
    const blob = new Blob([output], { type: 'text/csv;charset=utf-8' });
    saveAs(blob, fileName);
    setToolStatus(mappingMessage);

    exportInFlight = false;
    refreshButtons();
  };

  fileInput.addEventListener('change', () => {
    const file = fileInput.files[0];
    if (!file) {
      resetState();
      return;
    }

    fileName = file.name;
    const reader = new FileReader();
    reader.onload = () => {
      parseCsv(reader.result || '');
      buildEditor();
    };
    reader.onerror = () => {
      resetState();
      setStatus('Could not read file.');
    };
    reader.readAsText(file, 'utf-8');
  });

  removeToyBtn.addEventListener('click', applyRemoveToy);
  autoTaricBtn.addEventListener('click', runTaricAutomation);
  reviewTaricBtn.addEventListener('click', openReviewModal);
  copySummaryBtn.addEventListener('click', copyWorkSummary);
  exportBtn.addEventListener('click', () => {
    exportCsv();
  });
  reviewCloseBtn.addEventListener('click', closeReviewModal);
  reviewNextBtn.addEventListener('click', advanceReview);
  reviewInput.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      advanceReview();
    }
  });
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && !reviewOverlay.classList.contains('d-none')) {
      closeReviewModal();
    }
  });

  rebuildTaricLookup();
  resetState();
})();
