const csv = require('csvtojson');
const axios = require('axios');
const Jimp = require('jimp');
const { PDFDocument, StandardFonts, rgb } = require('pdf-lib');

const PRODUCT_DETAILS_URL = 'https://my.lentmiien.com/api/productDetails';
const PRODUCT_DETAILS_TIMEOUT_MS = 20000;
const PRODUCT_DETAILS_API_KEY_ENV_VARS = ['LENTMIIEN_API_KEY', 'PRODUCT_DETAILS_API_KEY'];

const COLUMN_COUNT = 2;
const ROW_COUNT = 4;
const ROWS_PER_ENTRY = 2;
const ENTRIES_PER_PAGE = Math.max(1, Math.floor(ROW_COUNT / ROWS_PER_ENTRY));
const PAGE_MARGINS = { top: 48, right: 48, bottom: 48, left: 48 };
const ROW_GAP = 12;
const COLUMN_GAP = 24;
const CELL_PADDING = 12;
const TITLE_FONT_SIZE = 12;
const TITLE_LINE_HEIGHT = TITLE_FONT_SIZE * 1.2;
const DESCRIPTION_FONT_SIZE = 10;
const DESCRIPTION_LINE_HEIGHT = DESCRIPTION_FONT_SIZE * 1.35;
const FALLBACK_IMAGE_TEXT = {
  empty: 'No image',
  error: 'Image unavailable',
};
const HEADER_TOKENS = new Set([
  'title',
  'name',
  'item',
  'code',
  'sku',
  'image',
  'img',
  'url',
  'link',
  'picture',
  'description',
  'desc',
  'text',
  'notes',
  'spec',
  'specs',
  'content',
  'cost',
  'price',
]);

async function parseCsv(buffer) {
  const content = buffer.toString('utf-8');
  const rows = await csv({
    output: 'csv',
    trim: true,
    ignoreEmpty: false,
  }).fromString(content);

  const normalizedRows = rows.map(normalizeRow);
  const firstDataRowIndex = normalizedRows.findIndex((row) => rowHasData(row));
  if (firstDataRowIndex === -1) {
    throw new Error('No rows found in the uploaded CSV.');
  }

  const hasHeader = looksLikeHeader(normalizedRows[firstDataRowIndex]);
  const startIndex = firstDataRowIndex + (hasHeader ? 1 : 0);

  const regularItems = [];
  const bonusItems = [];
  let parsingBonusItems = false;

  for (let i = startIndex; i < normalizedRows.length; i += 1) {
    const row = normalizedRows[i];
    if (!rowHasData(row)) {
      if (!parsingBonusItems && regularItems.length > 0) {
        parsingBonusItems = true;
      }
      continue;
    }

    const [col1 = '', col2 = '', col3 = '', col4 = '', col5 = '', col6 = '', col7 = ''] = row;

    if (!parsingBonusItems) {
      if (!col1) {
        throw new Error(`Missing item code in row ${i + 1}.`);
      }
      regularItems.push({
        code: col1,
        imageUrl: col2,
        name: col3,
        specs: col4,
        content: col5,
        description: col6,
        costRaw: col7,
        costValue: parseCost(col7),
      });
    } else {
      bonusItems.push({
        title: col1 || col3,
        imageUrl: col2,
        description: col3 || col1,
      });
    }
  }

  if (regularItems.length === 0 && bonusItems.length === 0) {
    throw new Error('CSV does not contain any usable rows.');
  }

  return { regularItems, bonusItems };
}

function looksLikeHeader(row) {
  if (!row || row.length === 0) {
    return false;
  }
  const normalized = row
    .map((cell) => (cell || '').trim().toLowerCase())
    .filter((value) => value.length > 0);

  if (normalized.length === 0) {
    return false;
  }

  let headerishCells = 0;

  normalized.forEach((value) => {
    if (value.length > 40) {
      return;
    }
    if (/\d/.test(value)) {
      return;
    }
    const tokens = value.split(/\s+/).filter(Boolean);
    if (tokens.length === 0) {
      return;
    }
    const allTokensAreHeader = tokens.every((token) => HEADER_TOKENS.has(token));
    if (allTokensAreHeader) {
      headerishCells += 1;
    }
  });

  return headerishCells >= Math.ceil(normalized.length / 2);
}

function stringifyCell(value) {
  if (value === null || value === undefined) {
    return '';
  }
  if (typeof value === 'string') {
    return value.trim();
  }
  return String(value).trim();
}

function normalizeRow(row) {
  if (!Array.isArray(row)) {
    return [];
  }
  return row.map((cell) => stringifyCell(cell));
}

function rowHasData(row) {
  return Array.isArray(row) && row.some((cell) => cell && cell.length > 0);
}

function parseCost(value) {
  const normalized = stringifyCell(value);
  if (!normalized) {
    return null;
  }
  const numeric = Number(normalized.replace(/[^\d.-]+/g, ''));
  if (Number.isFinite(numeric)) {
    return numeric;
  }
  return null;
}

function resolveProductDetailsApiKey() {
  for (const envVar of PRODUCT_DETAILS_API_KEY_ENV_VARS) {
    if (process.env[envVar] && process.env[envVar].trim()) {
      return process.env[envVar].trim();
    }
  }
  return null;
}

function buildProductDetailsPayload(items) {
  return items.map((item) => [
    item.code,
    item.name || '',
    item.specs || '',
    item.content || '',
    item.description || '',
    Number.isFinite(item.costValue) ? item.costValue : item.costRaw || '',
  ]);
}

async function fetchProductDetails(items) {
  if (!items || items.length === 0) {
    return [];
  }

  const apiKey = resolveProductDetailsApiKey();
  if (!apiKey) {
    throw new Error(`Product details API key is missing. Set ${PRODUCT_DETAILS_API_KEY_ENV_VARS.join(' or ')} in the environment.`);
  }

  const payload = buildProductDetailsPayload(items);

  try {
    const response = await axios.post(PRODUCT_DETAILS_URL, payload, {
      headers: { 'authorization': `Bearer ${apiKey}` },
      timeout: PRODUCT_DETAILS_TIMEOUT_MS,
    });
    if (!Array.isArray(response.data)) {
      throw new Error('Unexpected response format from product details API.');
    }
    return response.data;
  } catch (error) {
    const status = error?.response?.status;
    const detail = status ? ` (status ${status})` : '';
    throw new Error(`Failed to fetch product details from API${detail}.`);
  }
}

function buildApiLookup(apiProducts) {
  const lookup = new Map();
  if (!Array.isArray(apiProducts)) {
    return lookup;
  }
  apiProducts.forEach((product) => {
    if (product && typeof product === 'object' && product.product_code) {
      lookup.set(stringifyCell(product.product_code), product);
    }
  });
  return lookup;
}

function mergeEntriesWithApiData(regularItems, apiProducts, bonusItems) {
  const apiLookup = buildApiLookup(apiProducts);

  const entries = regularItems.map((item, index) => {
    const apiProduct = apiLookup.get(item.code) || (Array.isArray(apiProducts) ? apiProducts[index] : null);
    return {
      title: item.code || item.name || 'Item',
      imageUrl: item.imageUrl,
      description: buildDescriptionFromApi(item, apiProduct),
    };
  });

  bonusItems.forEach((bonus) => {
    entries.push({
      title: bonus.title || 'Bonus item',
      imageUrl: bonus.imageUrl,
      description: bonus.description || '',
    });
  });

  return entries;
}

function buildDescriptionFromApi(item, apiProduct) {
  const values = [];
  const priceText = formatPrice(item.costRaw, item.costValue);
  let priceAdded = false;

  const pushLabeled = (label, value) => {
    const normalized = stringifyCell(value);
    if (normalized) {
      values.push(`${label}: ${normalized}`);
    }
  };

  if (apiProduct && typeof apiProduct === 'object') {
    Object.entries(apiProduct).forEach(([key, value]) => {
      if (key === 'product_code') {
        return;
      }
      if (key === 'price') {
        if (priceText) {
          pushLabeled('Price', priceText);
          priceAdded = true;
        }
        return;
      }
      pushLabeled(formatLabel(key), value);
    });
  }

  if (values.length === 0) {
    pushLabeled('Name', item.name);
    pushLabeled('Specs', item.specs);
    pushLabeled('Content', item.content);
    pushLabeled('Description', item.description);
  }

  if (priceText && !priceAdded) {
    pushLabeled('Price', priceText);
  }

  return values.join('\n').trim();
}

function formatPrice(rawValue, numericValue) {
  if (Number.isFinite(numericValue)) {
    return `${numericValue} JPY`;
  }
  const raw = stringifyCell(rawValue);
  if (raw) {
    if (/JPY/i.test(raw)) {
      return raw;
    }
    return `${raw} JPY`;
  }
  return '';
}

function formatLabel(key) {
  const normalized = stringifyCell(key);
  if (!normalized) {
    return 'Value';
  }
  return normalized
    .split(/[_\s]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

async function fetchAndProcessImage(url, maxWidth, maxHeight) {
  if (!url) {
    return null;
  }

  try {
    const response = await axios.get(url, { responseType: 'arraybuffer', timeout: 15000 });
    const imageBuffer = Buffer.from(response.data);
    const image = await Jimp.read(imageBuffer);

    const { width, height } = image.bitmap;
    if (!width || !height) {
      return FALLBACK_IMAGE_TEXT.error;
    }

    const widthScale = maxWidth > 0 ? maxWidth / width : 1;
    const heightScale = maxHeight > 0 ? maxHeight / height : 1;
    const scale = Math.min(1, widthScale, heightScale);

    if (scale > 0 && scale < 1) {
      image.scale(scale);
    }

    image.quality(90);
    return await image.getBufferAsync(Jimp.MIME_JPEG);
  } catch (error) {
    return FALLBACK_IMAGE_TEXT.error;
  }
}

function wrapText(text, font, fontSize, maxWidth, maxLines) {
  if (!text) {
    return { lines: [], truncated: false };
  }

  const paragraphs = text.split(/\r?\n/);
  const lines = [];
  let truncated = false;

  const pushLine = (line) => {
    if (lines.length >= maxLines) {
      truncated = true;
      return false;
    }
    lines.push(line);
    return true;
  };

  for (const paragraph of paragraphs) {
    const words = paragraph.split(/\s+/).filter(Boolean);
    if (words.length === 0) {
      if (!pushLine('')) {
        break;
      }
      continue;
    }

    let currentLine = '';

    const flushCurrentLine = () => {
      if (!currentLine) {
        return true;
      }
      const accepted = pushLine(currentLine);
      currentLine = '';
      return accepted;
    };

    for (const word of words) {
      const candidate = currentLine ? `${currentLine} ${word}` : word;
      if (font.widthOfTextAtSize(candidate, fontSize) <= maxWidth) {
        currentLine = candidate;
        continue;
      }

      if (!flushCurrentLine()) {
        break;
      }

      if (font.widthOfTextAtSize(word, fontSize) <= maxWidth) {
        currentLine = word;
        continue;
      }

      // Word longer than the line: split at character level.
      let remaining = word;
      while (remaining.length > 0) {
        let idx = remaining.length;
        let acceptedChunk = '';
        while (idx > 0) {
          const chunk = remaining.slice(0, idx);
          if (font.widthOfTextAtSize(chunk, fontSize) <= maxWidth) {
            acceptedChunk = chunk;
            break;
          }
          idx -= 1;
        }
        if (!acceptedChunk) {
          // Cannot fit any characters; give up to avoid infinite loop.
          truncated = true;
          remaining = '';
          break;
        }
        if (!pushLine(acceptedChunk)) {
          remaining = '';
          break;
        }
        remaining = remaining.slice(acceptedChunk.length);
      }
    }

    if (lines.length >= maxLines) {
      break;
    }

    if (currentLine) {
      if (!flushCurrentLine()) {
        break;
      }
    }
  }

  if (truncated && lines.length > 0) {
    const lastIndex = lines.length - 1;
    const ellipsis = '…';
    if (!lines[lastIndex].endsWith(ellipsis)) {
      let candidate = lines[lastIndex];
      while (candidate.length > 0 && font.widthOfTextAtSize(`${candidate}${ellipsis}`, fontSize) > maxWidth) {
        candidate = candidate.slice(0, -1);
      }
      lines[lastIndex] = candidate.length > 0 ? `${candidate}${ellipsis}` : ellipsis;
    }
  }

  return { lines, truncated };
}

function drawTextBlock(page, options) {
  const {
    text,
    font,
    fontSize,
    x,
    yTop,
    maxWidth,
    maxHeight,
    lineHeight,
    color = rgb(0, 0, 0),
  } = options;

  const maxLines = Math.max(1, Math.floor(maxHeight / lineHeight));
  const wrapped = wrapText(text, font, fontSize, maxWidth, maxLines);
  let cursorY = yTop - fontSize;

  wrapped.lines.forEach((line) => {
    page.drawText(line, {
      x,
      y: cursorY,
      size: fontSize,
      font,
      color,
    });
    cursorY -= lineHeight;
  });
}

async function buildPdf(entries) {
  const pdfDoc = await PDFDocument.create();
  const fontRegular = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  let page = null;
  let pageMetrics = null;

  const allocatePage = () => {
    page = pdfDoc.addPage();
    const { width, height } = page.getSize();
    const contentWidth = width - (PAGE_MARGINS.left + PAGE_MARGINS.right);
    const contentHeight = height - (PAGE_MARGINS.top + PAGE_MARGINS.bottom);
    const rowHeight = (contentHeight - ROW_GAP * (ROW_COUNT - 1)) / ROW_COUNT;
    const columnWidth = (contentWidth - COLUMN_GAP * (COLUMN_COUNT - 1)) / COLUMN_COUNT;

    pageMetrics = {
      width,
      height,
      contentWidth,
      contentHeight,
      columnWidth,
      rowHeight,
      startX: PAGE_MARGINS.left,
      startY: height - PAGE_MARGINS.top,
    };
  };

  for (let index = 0; index < entries.length; index += 1) {
    const entry = entries[index];
    const pageEntryIndex = index % ENTRIES_PER_PAGE;
    if (pageEntryIndex === 0) {
      allocatePage();
    }

    const rowGroup = pageEntryIndex * ROWS_PER_ENTRY;

    const row1Top = pageMetrics.startY - rowGroup * (pageMetrics.rowHeight + ROW_GAP);
    const row2Top = row1Top - (pageMetrics.rowHeight + ROW_GAP);

    const leftColumnX = pageMetrics.startX;
    const rightColumnX = pageMetrics.startX + pageMetrics.columnWidth + COLUMN_GAP;

    // Title block (Row 1, Column 1)
    drawTextBlock(page, {
      text: entry.title,
      font: fontBold,
      fontSize: TITLE_FONT_SIZE,
      x: leftColumnX + CELL_PADDING,
      yTop: row1Top - CELL_PADDING,
      maxWidth: pageMetrics.columnWidth - CELL_PADDING * 2,
      maxHeight: pageMetrics.rowHeight - CELL_PADDING * 2,
      lineHeight: TITLE_LINE_HEIGHT,
    });

    // Image block (Row 1, Column 2)
    const imageArea = {
      x: rightColumnX + CELL_PADDING,
      yTop: row1Top - CELL_PADDING,
      width: pageMetrics.columnWidth - CELL_PADDING * 2,
      height: pageMetrics.rowHeight - CELL_PADDING * 2,
    };

    if (!entry.imageUrl) {
      drawFallbackText(page, fontRegular, imageArea, FALLBACK_IMAGE_TEXT.empty);
    } else {
      const processedImage = await fetchAndProcessImage(entry.imageUrl, imageArea.width, imageArea.height);

      if (Buffer.isBuffer(processedImage)) {
        const embedded = await pdfDoc.embedJpg(processedImage);
        let drawWidth = embedded.width;
        let drawHeight = embedded.height;

        const widthRatio = imageArea.width / drawWidth;
        const heightRatio = imageArea.height / drawHeight;
        const scale = Math.min(1, widthRatio, heightRatio);
        drawWidth *= scale;
        drawHeight *= scale;

        const drawX = imageArea.x + (imageArea.width - drawWidth) / 2;
        const drawY = imageArea.yTop - drawHeight;

        page.drawImage(embedded, {
          x: drawX,
          y: drawY,
          width: drawWidth,
          height: drawHeight,
        });
      } else if (processedImage === FALLBACK_IMAGE_TEXT.error) {
        drawFallbackText(page, fontRegular, imageArea, FALLBACK_IMAGE_TEXT.error);
      } else {
        drawFallbackText(page, fontRegular, imageArea, FALLBACK_IMAGE_TEXT.empty);
      }
    }

    // Description block (Row 2, spans both columns)
    drawTextBlock(page, {
      text: entry.description,
      font: fontRegular,
      fontSize: DESCRIPTION_FONT_SIZE,
      x: leftColumnX + CELL_PADDING,
      yTop: row2Top - CELL_PADDING,
      maxWidth: pageMetrics.columnWidth * 2 + COLUMN_GAP - CELL_PADDING * 2,
      maxHeight: pageMetrics.rowHeight - CELL_PADDING * 2,
      lineHeight: DESCRIPTION_LINE_HEIGHT,
    });
  }

  if (!page) {
    allocatePage();
  }

  const pdfBytes = await pdfDoc.save();
  return Buffer.from(pdfBytes);
}

function drawFallbackText(page, font, area, text) {
  const textWidth = font.widthOfTextAtSize(text, TITLE_FONT_SIZE);
  const x = area.x + Math.max((area.width - textWidth) / 2, 0);
  const y = area.yTop - (area.height / 2) - TITLE_FONT_SIZE / 2;
  page.drawText(text, {
    x,
    y,
    size: TITLE_FONT_SIZE,
    font,
    color: rgb(0.6, 0.6, 0.6),
  });
}

async function generateImageGridPdf(buffer) {
  const { regularItems, bonusItems } = await parseCsv(buffer);
  const apiProducts = await fetchProductDetails(regularItems);
  const entries = mergeEntriesWithApiData(regularItems, apiProducts, bonusItems);
  return buildPdf(entries);
}

module.exports = {
  generateImageGridPdf,
};
