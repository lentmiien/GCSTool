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
  const reviewAmiAmiEngLink = document.getElementById('review-amiami-eng-link');
  const reviewAmiAmiJpLink = document.getElementById('review-amiami-jp-link');
  const reviewGoogleLink = document.getElementById('review-google-link');
  const reviewBarcodeLinks = document.getElementById('review-barcode-links');
  const reviewOriginalHs = document.getElementById('review-original-hs');
  const reviewCurrentHs = document.getElementById('review-current-hs');
  const reviewMatchStatus = document.getElementById('review-match-status');
  const reviewInput = document.getElementById('review-input');
  const reviewSuggestionsEmpty = document.getElementById('review-suggestions-empty');
  const reviewSuggestionsList = document.getElementById('review-suggestions-list');
  const reviewAmiAmiResponseGroup = document.getElementById('review-amiami-response-group');
  const reviewAmiAmiResponseStatus = document.getElementById('review-amiami-response-status');
  const reviewAmiAmiItems = document.getElementById('review-amiami-items');
  const reviewAmiAmiCopyBtn = document.getElementById('review-amiami-copy-btn');
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
  let workSummaryInFlight = false;
  let automatedWorkflowInProgress = false;
  let automatedWorkflowFinalizing = false;
  let automatedWorkflowToken = 0;
  let automationHasRun = false;
  let amiAmiResponseRenderToken = 0;
  let currentAmiAmiRawResponse = '';
  let taricLookup = {
    jan: new Map(),
    nameHs: new Map(),
  };
  let taricExplanationLookup = new Map();
  let blockedNameHsKeys = new Set();
  const amiAmiResponseCache = new Map();

  const legacyJanPattern = /\s*[\[(]\s*barcode\s*([0-9]{8,14})\s*[\])]\s*$/i;
  const numericJanPattern = /^[0-9]+$/;
  const editableCountryCodes = new Set(['IE', 'GR']);
  const multiItemCountryIndex = 12;
  const dhlCountryIndex = 14;

  const setStatus = (text) => {
    statusEl.textContent = text || '';
  };

  const setToolStatus = (text) => {
    toolStatusEl.textContent = text || '';
  };

  const cancelAutomatedWorkflow = (message) => {
    if (!automatedWorkflowInProgress && !automatedWorkflowFinalizing) {
      return;
    }
    automatedWorkflowToken += 1;
    automatedWorkflowInProgress = false;
    automatedWorkflowFinalizing = false;
    if (message) {
      setToolStatus(message);
    }
    refreshButtons();
  };

  const collapseWhitespace = (value) => String(value || '').replace(/\s+/g, ' ').trim();

  const sanitizeCode = (value) => collapseWhitespace(value);

  const normalizeEditableCountryCode = (value) => collapseWhitespace(value).toUpperCase();

  const isEditableCountryCode = (value) => editableCountryCodes.has(normalizeEditableCountryCode(value));

  const splitItemBarcode = (value) => {
    const itemName = String(value || '');
    const lastSlashIndex = itemName.lastIndexOf('/');

    if (lastSlashIndex !== -1) {
      const janCode = itemName.slice(lastSlashIndex + 1).trim();
      if (numericJanPattern.test(janCode)) {
        return {
          itemName: itemName.slice(0, lastSlashIndex),
          janCode,
        };
      }
    }

    const legacyMatch = itemName.match(legacyJanPattern);
    if (legacyMatch) {
      return {
        itemName: itemName.slice(0, legacyMatch.index),
        janCode: legacyMatch[1],
      };
    }

    return {
      itemName,
      janCode: '',
    };
  };

  const stripJanSuffix = (value) => collapseWhitespace(splitItemBarcode(value).itemName);

  const stripToyPrefix = (value) => collapseWhitespace(String(value || '').replace(/^toy\b[\s-]*/i, ' '));

  const cleanItemName = (value) => {
    const cleanedValue = stripToyPrefix(stripJanSuffix(value));
    if (cleanedValue && cleanedValue === cleanedValue.toLowerCase()) {
      return cleanedValue.charAt(0).toUpperCase() + cleanedValue.slice(1);
    }
    return cleanedValue;
  };

  const normalizeItemName = (value) => stripToyPrefix(stripJanSuffix(value)).toLowerCase();

  const extractJanCode = (value) => splitItemBarcode(value).janCode;

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
      const nextTaricCode = sanitizeCode(entry.taricCode);
      if (blockedNameHsKeys.has(key)) {
        return;
      }
      const existing = taricLookup.nameHs.get(key);
      if (existing && sanitizeCode(existing.taricCode) && nextTaricCode && sanitizeCode(existing.taricCode) !== nextTaricCode) {
        taricLookup.nameHs.delete(key);
        blockedNameHsKeys.add(key);
        return;
      }
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
    taricExplanationLookup = new Map();
    blockedNameHsKeys = new Set();
    initialTaricMappings.forEach((entry) => {
      const taricCode = sanitizeCode(entry.taricCode);
      const explanation = collapseWhitespace(entry.explanation);
      if (taricCode && explanation && !taricExplanationLookup.has(taricCode)) {
        taricExplanationLookup.set(taricCode, explanation);
      }
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
    const workflowLocksTools = automatedWorkflowInProgress || automatedWorkflowFinalizing;
    removeToyBtn.disabled = !hasItems || workflowLocksTools;
    autoTaricBtn.disabled = !hasItems || workflowLocksTools;
    reviewTaricBtn.disabled = !hasItems || workflowLocksTools;
    copySummaryBtn.disabled = !hasItems || workSummaryInFlight || workflowLocksTools;
    exportBtn.disabled = !hasItems || exportInFlight || workflowLocksTools;
  };

  const closeReviewModal = () => {
    amiAmiResponseRenderToken += 1;
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
    workSummaryInFlight = false;
    automatedWorkflowInProgress = false;
    automatedWorkflowFinalizing = false;
    automatedWorkflowToken += 1;
    automationHasRun = false;
    rowsContainer.innerHTML = '';
    closeReviewModal();
    reviewInput.value = '';
    reviewSuggestionsEmpty.textContent = '';
    reviewSuggestionsList.innerHTML = '';
    reviewAmiAmiResponseGroup.classList.add('d-none');
    reviewAmiAmiResponseStatus.textContent = '';
    reviewAmiAmiItems.innerHTML = '';
    reviewAmiAmiCopyBtn.disabled = true;
    reviewAmiAmiCopyBtn.textContent = 'Copy raw response';
    currentAmiAmiRawResponse = '';
    setStatus('');
    setToolStatus('');
    refreshButtons();
  };

  const invalidateAutomationResults = (message) => {
    if (!automationHasRun) {
      return;
    }
    cancelAutomatedWorkflow();
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

  const parseCsvLine = (line, delimiter = fieldDelimiter, quoted = hasQuotedFields) => {
    if (!quoted) {
      return line.split(delimiter);
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
      if (char === delimiter && !inQuotes) {
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
    const sampleLines = lines.filter((line) => line.length);
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
      if (row.length > dhlCountryIndex && isEditableCountryCode(row[dhlCountryIndex])) {
        dhlCountryMatches += 1;
      }
      if (row.length > multiItemCountryIndex && isEditableCountryCode(row[multiItemCountryIndex])) {
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

  const registerItem = ({ rowIndex, countryCode, orderNumber, itemNumber, productIndex, hsIndex, productValue, hsValue }) => {
    const item = {
      id: `${rowIndex}_${productIndex}`,
      rowIndex,
      csvRowNumber: rowIndex + 1,
      countryCode: normalizeEditableCountryCode(countryCode),
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
      if (row.length > multiItemCountryIndex && isEditableCountryCode(row[multiItemCountryIndex])) {
        irelandCount += 1;
        const countryCode = normalizeEditableCountryCode(row[multiItemCountryIndex]);
        const orderNumber = row[0] || '(missing order)';

        const card = document.createElement('div');
        card.classList.add('card', 'mb-3', 'ie-editor-card');

        const header = document.createElement('div');
        header.classList.add('card-header', 'ie-editor-card-header');
        header.textContent = `Order ${orderNumber} (${countryCode})`;
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
            countryCode,
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
      setStatus('No Ireland (IE) or Greece (GR) rows found in this file.');
      return;
    }

    setStatus(`Detected ${label} CSV. Loaded ${rows.length} rows. Showing ${irelandCount} IE/GR row(s) with ${itemCountTotal} item(s).`);
  };

  const buildDhlEditor = () => {
    const fragment = document.createDocumentFragment();
    const orderMap = new Map();
    let irelandCount = 0;
    let itemCountTotal = 0;

    const getOrderCard = (orderKey, orderNumber, countryCode) => {
      if (orderMap.has(orderKey)) {
        return orderMap.get(orderKey);
      }

      const card = document.createElement('div');
      card.classList.add('card', 'mb-3', 'ie-editor-card');

      const header = document.createElement('div');
      header.classList.add('card-header', 'ie-editor-card-header');
      header.textContent = `Order ${orderNumber} (${countryCode})`;
      card.appendChild(header);

      const body = document.createElement('div');
      body.classList.add('card-body', 'ie-editor-card-body');
      card.appendChild(body);

      const orderState = { card, body, itemIndex: 0 };
      orderMap.set(orderKey, orderState);
      fragment.appendChild(card);
      return orderState;
    };

    rows.forEach((row, rowIndex) => {
      if (row.length > dhlCountryIndex && isEditableCountryCode(row[dhlCountryIndex])) {
        irelandCount += 1;
        const countryCode = normalizeEditableCountryCode(row[dhlCountryIndex]);
        const orderNumber = row[0] || '(missing order)';
        const orderState = getOrderCard(`${countryCode}__${orderNumber}`, orderNumber, countryCode);
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
          countryCode,
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
      setStatus('No Ireland (IE) or Greece (GR) rows found in this file.');
      return;
    }

    setStatus(`Detected DHL CSV. Loaded ${rows.length} rows. Showing ${irelandCount} IE/GR row(s) with ${itemCountTotal} item(s).`);
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

  const updateReviewBarcodeLinks = (itemName) => {
    const barcode = extractJanCode(itemName);
    reviewBarcodeLinks.classList.toggle('d-none', !barcode);
    if (!barcode) {
      return;
    }

    const encodedBarcode = encodeURIComponent(barcode);
    const links = [
      {
        element: reviewAmiAmiEngLink,
        url: `https://www.amiami.com/eng/search/list/?s_keywords=${encodedBarcode}`,
        label: 'AmiAmi COM',
      },
      {
        element: reviewAmiAmiJpLink,
        url: `https://slist.amiami.jp/top/search/list?s_keywords=${encodedBarcode}`,
        label: 'AmiAmi JP',
      },
      {
        element: reviewGoogleLink,
        url: `https://www.google.com/search?q=${encodedBarcode}`,
        label: 'Google',
      },
    ];

    links.forEach((link) => {
      link.element.href = link.url;
      link.element.textContent = link.label;
    });
  };

  const requestAmiAmiItems = (barcode) => {
    if (amiAmiResponseCache.has(barcode)) {
      return {
        cached: true,
        request: amiAmiResponseCache.get(barcode),
      };
    }

    const request = fetch('/hs/ireland/amiami-items', {
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
      method: 'POST',
      body: JSON.stringify([barcode]),
    }).then(async (response) => ({
      body: await response.text(),
      ok: response.ok,
      status: response.status,
      statusText: response.statusText,
    })).catch((err) => {
      amiAmiResponseCache.delete(barcode);
      throw err;
    });

    amiAmiResponseCache.set(barcode, request);
    return {
      cached: false,
      request,
    };
  };

  const firstNonEmptyValue = (...values) => {
    for (let i = 0; i < values.length; i++) {
      if (values[i] == null) {
        continue;
      }
      const value = String(values[i]).trim();
      if (value) {
        return value;
      }
    }
    return '';
  };

  const getHttpUrl = (value) => {
    const candidate = firstNonEmptyValue(value);
    if (!candidate) {
      return '';
    }

    try {
      const url = new URL(candidate);
      return url.protocol === 'http:' || url.protocol === 'https:' ? url.href : '';
    } catch (err) {
      return '';
    }
  };

  const appendAmiAmiEmptyMessage = (message) => {
    const empty = document.createElement('p');
    empty.classList.add('ie-amiami-empty');
    empty.textContent = message;
    reviewAmiAmiItems.appendChild(empty);
  };

  const getAmiAmiItemRecords = (parsedResponse) => {
    if (Array.isArray(parsedResponse)) {
      return parsedResponse.filter((entry) => entry && typeof entry === 'object');
    }
    if (!parsedResponse || typeof parsedResponse !== 'object') {
      return [];
    }
    if (Array.isArray(parsedResponse.items)) {
      return parsedResponse.items.filter((entry) => entry && typeof entry === 'object');
    }
    if (parsedResponse.gcode || parsedResponse.details || parsedResponse.listing) {
      return [parsedResponse];
    }
    return [];
  };

  const buildAmiAmiItemCard = (record) => {
    const details = record.details && typeof record.details === 'object' ? record.details : {};
    const listing = record.listing && typeof record.listing === 'object' ? record.listing : {};
    const gcode = firstNonEmptyValue(record.gcode, details.gcode, details.scode, listing.gcode);
    const itemName = firstNonEmptyValue(details.itemName, listing.itemName, record.itemName, gcode, 'Item name unavailable');
    const sourceUrl = [details.sourceUrl, record.url, listing.url, record.sourceUrl]
      .map(getHttpUrl)
      .find((url) => url) || (gcode ? `https://www.amiami.com/eng/detail?gcode=${encodeURIComponent(gcode)}` : '');
    const detailImageLinks = Array.isArray(details.imageLinks) ? details.imageLinks : [];
    const imageUrls = detailImageLinks
      .concat([details.imageUrl, listing.imageUrl, record.imageUrl])
      .map(getHttpUrl)
      .filter((url, index, urls) => url && urls.indexOf(url) === index);

    const card = document.createElement('article');
    card.classList.add('card', 'ie-amiami-item-card');

    const cardBody = document.createElement('div');
    cardBody.classList.add('card-body');

    const codeElement = document.createElement(sourceUrl ? 'a' : 'span');
    codeElement.classList.add('ie-amiami-item-code');
    codeElement.textContent = gcode || 'View AmiAmi item';
    if (sourceUrl) {
      codeElement.href = sourceUrl;
      codeElement.target = '_blank';
      codeElement.rel = 'noopener noreferrer';
    }
    cardBody.appendChild(codeElement);

    const nameElement = document.createElement('p');
    nameElement.classList.add('ie-amiami-item-name');
    nameElement.textContent = itemName;
    cardBody.appendChild(nameElement);
    card.appendChild(cardBody);

    if (!imageUrls.length) {
      const placeholder = document.createElement('p');
      placeholder.classList.add('ie-amiami-image-placeholder');
      placeholder.textContent = 'Image unavailable';
      card.appendChild(placeholder);
      return card;
    }

    const image = document.createElement('img');
    const placeholder = document.createElement('p');
    let imageIndex = 0;
    image.classList.add('ie-amiami-item-image');
    image.alt = itemName;
    placeholder.classList.add('ie-amiami-image-placeholder', 'd-none');
    placeholder.textContent = 'Image unavailable';
    image.addEventListener('error', () => {
      imageIndex += 1;
      if (imageIndex < imageUrls.length) {
        image.src = imageUrls[imageIndex];
        return;
      }
      image.classList.add('d-none');
      placeholder.classList.remove('d-none');
    });
    image.src = imageUrls[imageIndex];
    card.appendChild(image);
    card.appendChild(placeholder);
    return card;
  };

  const renderAmiAmiItemCards = (body, barcode) => {
    reviewAmiAmiItems.innerHTML = '';
    if (!body) {
      appendAmiAmiEmptyMessage(`No AmiAmi item data was returned for ${barcode}.`);
      return;
    }

    let parsedResponse;
    try {
      parsedResponse = JSON.parse(body);
    } catch (err) {
      appendAmiAmiEmptyMessage('The API response could not be formatted. Use "Copy raw response" to inspect it.');
      return;
    }

    const records = getAmiAmiItemRecords(parsedResponse);
    if (!records.length) {
      appendAmiAmiEmptyMessage(`No AmiAmi item data was found for ${barcode}.`);
      return;
    }

    records.forEach((record) => {
      reviewAmiAmiItems.appendChild(buildAmiAmiItemCard(record));
    });
  };

  const copyTextToClipboard = async (text) => {
    if (typeof navigator !== 'undefined' && navigator.clipboard && navigator.clipboard.writeText) {
      try {
        await navigator.clipboard.writeText(text);
        return;
      } catch (err) {
        // Fall back to the legacy copy command when clipboard permission is unavailable.
      }
    }

    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.setAttribute('readonly', '');
    textarea.style.position = 'fixed';
    textarea.style.opacity = '0';
    document.body.appendChild(textarea);
    textarea.select();
    const copied = document.execCommand('copy');
    document.body.removeChild(textarea);
    if (!copied) {
      throw new Error('copy command failed');
    }
  };

  const copyAmiAmiRawResponse = async () => {
    if (!currentAmiAmiRawResponse) {
      return;
    }

    const responseToCopy = currentAmiAmiRawResponse;
    reviewAmiAmiCopyBtn.disabled = true;
    try {
      await copyTextToClipboard(responseToCopy);
      if (responseToCopy !== currentAmiAmiRawResponse) {
        return;
      }
      reviewAmiAmiCopyBtn.textContent = 'Copied';
      setTimeout(() => {
        if (responseToCopy === currentAmiAmiRawResponse) {
          reviewAmiAmiCopyBtn.textContent = 'Copy raw response';
          reviewAmiAmiCopyBtn.disabled = false;
        }
      }, 1500);
    } catch (err) {
      if (responseToCopy === currentAmiAmiRawResponse) {
        reviewAmiAmiCopyBtn.textContent = 'Copy failed';
        reviewAmiAmiCopyBtn.disabled = false;
      }
    }
  };

  const renderAmiAmiResponse = async (itemName) => {
    const barcode = extractJanCode(itemName);
    const renderToken = ++amiAmiResponseRenderToken;
    reviewAmiAmiResponseGroup.classList.toggle('d-none', !barcode);
    reviewAmiAmiResponseStatus.textContent = '';
    reviewAmiAmiItems.innerHTML = '';
    reviewAmiAmiCopyBtn.disabled = true;
    reviewAmiAmiCopyBtn.textContent = 'Copy raw response';
    currentAmiAmiRawResponse = '';
    if (!barcode) {
      return;
    }

    const lookup = requestAmiAmiItems(barcode);
    reviewAmiAmiResponseStatus.textContent = lookup.cached
      ? `Loading cached response for ${barcode}...`
      : `Loading response for ${barcode}...`;

    try {
      const result = await lookup.request;
      if (renderToken !== amiAmiResponseRenderToken) {
        return;
      }

      const cachedLabel = lookup.cached ? ' (cached)' : '';
      const errorLabel = result.ok ? '' : ` ${result.statusText || 'request failed'}`;
      reviewAmiAmiResponseStatus.textContent = `HTTP ${result.status}${errorLabel}${cachedLabel}`;
      currentAmiAmiRawResponse = result.body || '';
      reviewAmiAmiCopyBtn.disabled = !currentAmiAmiRawResponse;
      renderAmiAmiItemCards(result.body, barcode);
    } catch (err) {
      if (renderToken !== amiAmiResponseRenderToken) {
        return;
      }
      reviewAmiAmiResponseStatus.textContent = `Could not fetch AmiAmi API data for ${barcode}.`;
      appendAmiAmiEmptyMessage(err && err.message ? err.message : 'Network request failed.');
    }
  };

  const getMappingItemNameNormalized = (entry) => {
    return normalizeItemName(entry.itemNameNormalized || entry.itemName);
  };

  const getTaricExplanation = (taricCode) => {
    return taricExplanationLookup.get(sanitizeCode(taricCode)) || '';
  };

  const addTaricSuggestion = (lookup, entry, matchLabels) => {
    const taricCode = sanitizeCode(entry.taricCode);
    if (!taricCode) {
      return;
    }

    if (!lookup.has(taricCode)) {
      lookup.set(taricCode, {
        taricCode,
        uses: 0,
        matchLabels: new Set(),
        examples: [],
        explanation: getTaricExplanation(taricCode) || collapseWhitespace(entry.explanation),
      });
    }

    const suggestion = lookup.get(taricCode);
    suggestion.uses += Number(entry.uses || 0);
    matchLabels.forEach((label) => {
      suggestion.matchLabels.add(label);
    });

    const exampleName = cleanItemName(entry.itemName || entry.itemNameNormalized);
    if (exampleName && suggestion.examples.indexOf(exampleName) === -1 && suggestion.examples.length < 3) {
      suggestion.examples.push(exampleName);
    }

    if (!suggestion.explanation) {
      suggestion.explanation = collapseWhitespace(entry.explanation);
    }
  };

  const sortTaricSuggestions = (lookup) => Array.from(lookup.values()).sort((a, b) => {
    if (a.uses !== b.uses) {
      return b.uses - a.uses;
    }
    return a.taricCode.localeCompare(b.taricCode);
  });

  const buildReviewTaricSuggestions = (item) => {
    const targetName = normalizeItemName(item.currentProductName);
    const targetSourceHs = sanitizeCode(item.originalHsCode);
    const exactLookup = new Map();
    const partialLookup = new Map();

    initialTaricMappings.forEach((entry) => {
      const entryName = getMappingItemNameNormalized(entry);
      const entrySourceHs = sanitizeCode(entry.sourceHsCode);
      const nameMatches = targetName && entryName && entryName === targetName;
      const hsMatches = targetSourceHs && entrySourceHs && entrySourceHs === targetSourceHs;
      if (nameMatches && hsMatches) {
        addTaricSuggestion(exactLookup, entry, ['item name', 'original HS']);
      }
    });

    initialTaricMappings.forEach((entry) => {
      const taricCode = sanitizeCode(entry.taricCode);
      if (!taricCode || exactLookup.has(taricCode)) {
        return;
      }

      const entryName = getMappingItemNameNormalized(entry);
      const entrySourceHs = sanitizeCode(entry.sourceHsCode);
      const nameMatches = targetName && entryName && entryName === targetName;
      const hsMatches = targetSourceHs && entrySourceHs && entrySourceHs === targetSourceHs;
      if (!nameMatches && !hsMatches) {
        return;
      }

      addTaricSuggestion(partialLookup, entry, [
        ...(nameMatches ? ['item name'] : []),
        ...(hsMatches ? ['original HS'] : []),
      ]);
    });

    return {
      exact: sortTaricSuggestions(exactLookup),
      partial: sortTaricSuggestions(partialLookup),
    };
  };

  const selectReviewTaricSuggestion = (taricCode) => {
    reviewInput.value = taricCode;
    reviewInput.focus();
    reviewInput.select();
  };

  const appendTaricSuggestionHeading = (title) => {
    const heading = document.createElement('div');
    heading.classList.add('ie-taric-suggestion-section');
    heading.textContent = title;
    reviewSuggestionsList.appendChild(heading);
  };

  const getSuggestionExplanationText = (suggestion) => {
    return suggestion.explanation || 'No explanation saved yet.';
  };

  const getSuggestionDetailText = (suggestion) => {
    const parts = [
      `Used ${suggestion.uses} time(s)`,
      `matched ${Array.from(suggestion.matchLabels).join(' + ')}`,
      getSuggestionExplanationText(suggestion),
    ];
    if (suggestion.examples.length) {
      parts.push(`Example: ${suggestion.examples.join(', ')}`);
    }
    return parts.join('. ');
  };

  const truncateSuggestionText = (value, maxLength) => {
    const text = collapseWhitespace(value);
    if (text.length <= maxLength) {
      return text;
    }
    return `${text.slice(0, maxLength - 1)}...`;
  };

  const appendExactTaricSuggestions = (suggestions) => {
    if (!suggestions.length) {
      return;
    }

    appendTaricSuggestionHeading(`Matching item name + original HS (${suggestions.length})`);
    const list = document.createElement('div');
    list.classList.add('ie-taric-exact-list');

    suggestions.forEach((suggestion) => {
      const row = document.createElement('div');
      row.classList.add('ie-taric-suggestion-row');

      const button = document.createElement('button');
      button.type = 'button';
      button.classList.add('btn', 'btn-sm', 'btn-outline-info', 'ie-taric-suggestion-code');
      button.textContent = suggestion.taricCode;
      button.title = 'Use this TARIC code';
      button.addEventListener('click', () => {
        selectReviewTaricSuggestion(suggestion.taricCode);
      });

      const meta = document.createElement('div');
      meta.classList.add('ie-taric-suggestion-meta');

      const explanation = document.createElement('div');
      explanation.classList.add('ie-taric-suggestion-explanation');
      explanation.textContent = `${getSuggestionExplanationText(suggestion)} (${suggestion.uses} use${suggestion.uses === 1 ? '' : 's'})`;
      meta.appendChild(explanation);

      row.appendChild(button);
      row.appendChild(meta);
      list.appendChild(row);
    });

    reviewSuggestionsList.appendChild(list);
  };

  const appendPartialTaricSuggestions = (suggestions) => {
    if (!suggestions.length) {
      return;
    }

    appendTaricSuggestionHeading(`Matching item name or original HS (${suggestions.length})`);

    const select = document.createElement('select');
    select.classList.add('form-control', 'form-control-sm', 'ie-dark-input');

    const placeholder = document.createElement('option');
    placeholder.value = '';
    placeholder.textContent = 'Select a less-specific TARIC match';
    select.appendChild(placeholder);

    suggestions.forEach((suggestion, index) => {
      const option = document.createElement('option');
      option.value = suggestion.taricCode;
      option.dataset.index = String(index);
      option.textContent = truncateSuggestionText(`${suggestion.taricCode} - ${suggestion.uses} use${suggestion.uses === 1 ? '' : 's'} - ${Array.from(suggestion.matchLabels).join(' + ')} - ${getSuggestionExplanationText(suggestion)}`, 140);
      select.appendChild(option);
    });

    const detail = document.createElement('div');
    detail.classList.add('ie-taric-partial-detail', 'ie-dark-muted');
    detail.textContent = 'Choose a code to fill the TARIC field.';

    select.addEventListener('change', () => {
      const selectedOption = select.selectedOptions[0];
      if (!selectedOption || !selectedOption.value) {
        detail.textContent = 'Choose a code to fill the TARIC field.';
        return;
      }

      const suggestion = suggestions[Number(selectedOption.dataset.index)];
      selectReviewTaricSuggestion(selectedOption.value);
      detail.textContent = suggestion ? getSuggestionDetailText(suggestion) : '';
    });

    reviewSuggestionsList.appendChild(select);
    reviewSuggestionsList.appendChild(detail);
  };

  const renderReviewTaricSuggestions = (item) => {
    reviewSuggestionsList.innerHTML = '';
    const suggestions = buildReviewTaricSuggestions(item);

    if (!suggestions.exact.length && !suggestions.partial.length) {
      reviewSuggestionsEmpty.textContent = 'No previous TARIC codes matched this item name or original HS.';
      return;
    }

    reviewSuggestionsEmpty.textContent = '';
    appendExactTaricSuggestions(suggestions.exact);
    appendPartialTaricSuggestions(suggestions.partial);
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
    updateReviewBarcodeLinks(item.currentProductName);
    reviewOriginalHs.value = item.originalHsCode;
    reviewCurrentHs.value = item.currentHsCode;
    reviewMatchStatus.value = getMatchLabel(item);
    reviewInput.value = item.currentHsCode;
    renderReviewTaricSuggestions(item);
    renderAmiAmiResponse(item.currentProductName);
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
      if (automatedWorkflowInProgress) {
        finishAutomatedWorkflow(automatedWorkflowToken);
      }
      return;
    }

    reviewIndex += 1;
    showReviewItem();
  };

  const buildSummaryRows = () => {
    const orderSummary = new Map();

    items.forEach((item) => {
      const countryCode = item.countryCode || 'IE';
      const orderNumber = item.orderNumber || '(missing order)';
      const summaryKey = `${countryCode}__${orderNumber}`;
      if (!orderSummary.has(summaryKey)) {
        orderSummary.set(summaryKey, {
          countryCode,
          orderNumber,
          itemNameEdits: 0,
          taricEdits: 0,
          nonEditCount: 0,
        });
      }

      const summary = orderSummary.get(summaryKey);
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

    return Array.from(orderSummary.values()).map((summary) => ({
      countryCode: summary.countryCode,
      orderNumber: summary.orderNumber,
      toyRemovedCount: summary.itemNameEdits,
      taricUpdateCount: summary.taricEdits,
      uneditedCount: summary.nonEditCount,
    }));
  };

  const saveWorkSummary = async (options = {}) => {
    const showAlert = options.showAlert !== false;
    const updateStatus = options.updateStatus !== false;

    if (!items.length) {
      const message = 'Select a CSV file first.';
      if (showAlert) {
        alert(message);
      }
      return {
        ok: false,
        message,
      };
    }

    const summaries = buildSummaryRows();
    if (!summaries.length) {
      const message = 'No IE/GR items available for work summary save.';
      if (updateStatus) {
        setToolStatus(message);
      }
      return {
        ok: true,
        message,
      };
    }

    workSummaryInFlight = true;
    refreshButtons();
    try {
      const response = await fetch('/hs/ireland/save-work-summary', {
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
        },
        method: 'POST',
        body: JSON.stringify({ summaries }),
      });
      if (!response.ok) {
        throw new Error('work summary save failed');
      }
      const result = await response.json();
      const message = `Saved ${result.saved} work summary row(s). ${result.created} new, ${result.updated} updated.`;
      if (updateStatus) {
        setToolStatus(message);
      }
      return {
        ok: true,
        message,
      };
    } catch (err) {
      const message = 'Could not save the work summary.';
      if (updateStatus) {
        setToolStatus(message);
      }
      return {
        ok: false,
        message,
      };
    } finally {
      workSummaryInFlight = false;
      refreshButtons();
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
      const addLocalMapping = (mapping) => {
        const localMapping = Object.assign({
          explanation: getTaricExplanation(mapping.taricCode),
        }, mapping);
        initialTaricMappings.push(localMapping);
        upsertTaricLookup(localMapping, true);
      };

      if (entry.janCode) {
        addLocalMapping({
          mappingType: 'jan',
          janCode: entry.janCode,
          itemName: cleanItemName(entry.itemName),
          itemNameNormalized: entry.itemNameNormalized,
          sourceHsCode: entry.sourceHsCode,
          taricCode: entry.taricCode,
          uses: 1,
          updatedAt: timestamp,
        });
      }

      if (entry.itemNameNormalized) {
        addLocalMapping({
          mappingType: 'name_hs',
          itemName: cleanItemName(entry.itemName),
          itemNameNormalized: entry.itemNameNormalized,
          sourceHsCode: entry.sourceHsCode,
          taricCode: entry.taricCode,
          uses: 1,
          updatedAt: timestamp,
        });
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

  const exportCsv = async (options = {}) => {
    const showAlert = options.showAlert !== false;
    const updateStatus = options.updateStatus !== false;

    if (!rows.length || !fileName) {
      const message = 'Select a CSV file first.';
      if (showAlert) {
        alert(message);
      }
      return {
        ok: false,
        message,
      };
    }

    exportInFlight = true;
    refreshButtons();

    let mappingMessage = 'No TARIC edits to save to the mapping database.';
    let mappingSaved = true;
    try {
      const saveResult = await saveMappings();
      mappingMessage = saveResult.message;
    } catch (err) {
      mappingSaved = false;
      mappingMessage = 'CSV exported, but TARIC mappings could not be saved.';
    }

    try {
      const output = buildCsvOutput();
      const blob = new Blob([output], { type: 'text/csv;charset=utf-8' });
      saveAs(blob, fileName);
      if (updateStatus) {
        setToolStatus(mappingMessage);
      }
      return {
        ok: true,
        mappingSaved,
        message: mappingMessage,
      };
    } catch (err) {
      const message = 'Could not export the CSV.';
      if (updateStatus) {
        setToolStatus(message);
      }
      return {
        ok: false,
        mappingSaved,
        message,
      };
    } finally {
      exportInFlight = false;
      refreshButtons();
    }
  };

  const finishAutomatedWorkflow = async (token) => {
    if (automatedWorkflowFinalizing) {
      return;
    }

    automatedWorkflowFinalizing = true;
    refreshButtons();
    setToolStatus('Saving work summary and exporting CSV...');

    try {
      const summaryResult = await saveWorkSummary({
        showAlert: false,
        updateStatus: false,
      });
      if (token !== automatedWorkflowToken) {
        return;
      }

      const exportResult = await exportCsv({
        showAlert: false,
        updateStatus: false,
      });
      if (token !== automatedWorkflowToken) {
        return;
      }

      const messages = ['Automated workflow complete.'];
      if (summaryResult && summaryResult.message) {
        messages.push(summaryResult.message);
      }
      if (exportResult && exportResult.ok && exportResult.mappingSaved !== false) {
        messages.push('CSV exported.');
      }
      if (exportResult && exportResult.message) {
        messages.push(exportResult.message);
      }
      setToolStatus(messages.join(' '));
    } finally {
      if (token === automatedWorkflowToken) {
        automatedWorkflowInProgress = false;
        automatedWorkflowFinalizing = false;
        refreshButtons();
      }
    }
  };

  const startAutomatedWorkflow = () => {
    if (!items.length) {
      return;
    }

    automatedWorkflowToken += 1;
    const token = automatedWorkflowToken;
    automatedWorkflowInProgress = true;
    automatedWorkflowFinalizing = false;
    refreshButtons();
    setToolStatus('Automated workflow started. Removing Toy prefixes and running TARIC automation...');

    applyRemoveToy();
    if (token !== automatedWorkflowToken) {
      return;
    }

    runTaricAutomation();
    if (token !== automatedWorkflowToken) {
      return;
    }

    reviewQueue = items.filter((item) => item.requiresReview);
    if (!reviewQueue.length) {
      setToolStatus('No TARIC review needed. Saving work summary and exporting CSV...');
      finishAutomatedWorkflow(token);
      return;
    }

    const firstPending = reviewQueue.findIndex((item) => !item.reviewCompleted);
    reviewIndex = firstPending >= 0 ? firstPending : 0;
    setToolStatus(`Review ${reviewQueue.length} TARIC item(s). After the last item, the work summary will save and the CSV will export automatically.`);
    showReviewItem();
  };

  fileInput.addEventListener('change', () => {
    const file = fileInput.files[0];
    if (!file) {
      resetState();
      return;
    }

    cancelAutomatedWorkflow();
    fileName = file.name;
    const reader = new FileReader();
    reader.onload = () => {
      parseCsv(reader.result || '');
      buildEditor();
      startAutomatedWorkflow();
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
  copySummaryBtn.addEventListener('click', saveWorkSummary);
  reviewAmiAmiCopyBtn.addEventListener('click', copyAmiAmiRawResponse);
  exportBtn.addEventListener('click', () => {
    exportCsv();
  });
  reviewCloseBtn.addEventListener('click', () => {
    closeReviewModal();
    cancelAutomatedWorkflow('TARIC review closed. Automated workflow stopped.');
  });
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
      cancelAutomatedWorkflow('TARIC review closed. Automated workflow stopped.');
    }
  });

  rebuildTaricLookup();
  resetState();
})();
