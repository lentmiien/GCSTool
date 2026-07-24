const axios = require('axios');

const AMIAMI_ITEMS_API_URL = 'https://my.lentmiien.com/api/amiami-items';
const AMIAMI_ITEMS_TIMEOUT_MS = 20000;
const ITEM_CACHE_TTL_MS = 6 * 60 * 60 * 1000;
const ITEM_ERROR_CACHE_TTL_MS = 5 * 60 * 1000;
const ITEM_CACHE_MAX_ENTRIES = 500;

const itemCache = new Map();
const pendingItemRequests = new Map();
const jpyFormatter = new Intl.NumberFormat('en-US', {
  maximumFractionDigits: 0,
});

function sanitizeText(value) {
  if (value === null || value === undefined) {
    return '';
  }
  return String(value).trim();
}

function firstNonEmptyValue(...values) {
  for (let index = 0; index < values.length; index += 1) {
    const value = sanitizeText(values[index]);
    if (value) {
      return value;
    }
  }
  return '';
}

function firstArrayValue(value) {
  if (!Array.isArray(value)) {
    return '';
  }
  return value.map(sanitizeText).find(Boolean) || '';
}

function getHttpUrl(value) {
  const candidate = sanitizeText(value);
  if (!candidate) {
    return '';
  }

  try {
    const url = new URL(candidate);
    return url.protocol === 'http:' || url.protocol === 'https:' ? url.href : '';
  } catch (error) {
    return '';
  }
}

function getAmiAmiApiKey() {
  return sanitizeText(process.env.LENTMIIEN_API_KEY);
}

function hasAmiAmiApiKey() {
  return Boolean(getAmiAmiApiKey());
}

async function requestAmiAmiItems(identifiers) {
  const apiKey = getAmiAmiApiKey();
  if (!apiKey) {
    const error = new Error('AmiAmi item lookup is not configured.');
    error.code = 'AMIAMI_API_NOT_CONFIGURED';
    throw error;
  }

  return axios.post(AMIAMI_ITEMS_API_URL, identifiers, {
    headers: {
      Accept: 'application/json',
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    timeout: AMIAMI_ITEMS_TIMEOUT_MS,
    validateStatus: () => true,
  });
}

function getItemRecords(responseData) {
  if (Array.isArray(responseData)) {
    return responseData.filter((record) => record && typeof record === 'object');
  }
  if (!responseData || typeof responseData !== 'object') {
    return [];
  }
  if (Array.isArray(responseData.items)) {
    return responseData.items.filter((record) => record && typeof record === 'object');
  }
  if (responseData.gcode || responseData.details || responseData.listing) {
    return [responseData];
  }
  return [];
}

function getRecordItemCode(record) {
  const details = record.details && typeof record.details === 'object' ? record.details : {};
  const listing = record.listing && typeof record.listing === 'object' ? record.listing : {};
  return firstNonEmptyValue(record.gcode, details.gcode, details.scode, listing.gcode);
}

function findItemRecord(responseData, itemCode) {
  const records = getItemRecords(responseData);
  const normalizedItemCode = sanitizeText(itemCode).toUpperCase();
  const matchingRecord = records.find((record) => (
    getRecordItemCode(record).toUpperCase() === normalizedItemCode
  ));

  if (matchingRecord) {
    return matchingRecord;
  }
  if (records.length === 1 && !getRecordItemCode(records[0])) {
    return records[0];
  }
  return null;
}

function getImageUrls(record, details, listing) {
  const detailImageLinks = Array.isArray(details.imageLinks) ? details.imageLinks : [];
  const orderedDetailLinks = detailImageLinks
    .filter((url) => sanitizeText(url).includes('/main/'))
    .concat(detailImageLinks.filter((url) => sanitizeText(url).includes('/thumb300/')))
    .concat(detailImageLinks.filter((url) => (
      !sanitizeText(url).includes('/main/')
      && !sanitizeText(url).includes('/thumb300/')
      && !sanitizeText(url).includes('/rthumb/')
    )))
    .concat(detailImageLinks);

  return orderedDetailLinks
    .concat([details.imageUrl, listing.imageUrl, record.imageUrl])
    .map(getHttpUrl)
    .filter((url, index, urls) => url && urls.indexOf(url) === index)
    .slice(0, 6);
}

function getCurrentPrice(record, details, listing) {
  const price = details.price && typeof details.price === 'object' ? details.price : {};
  const rawCurrentPrice = firstNonEmptyValue(price.currentJpy, record.currentJpy);
  const numericCurrentPrice = Number(rawCurrentPrice.replace(/,/g, ''));

  if (rawCurrentPrice && Number.isFinite(numericCurrentPrice)) {
    return `${jpyFormatter.format(numericCurrentPrice)} JPY`;
  }

  const priceText = firstNonEmptyValue(listing.priceText, record.priceText);
  if (priceText) {
    return priceText;
  }

  const rawFallbackPrice = firstNonEmptyValue(price.comparisonJpy, price.listJpy);
  const numericFallbackPrice = Number(rawFallbackPrice.replace(/,/g, ''));
  if (rawFallbackPrice && Number.isFinite(numericFallbackPrice)) {
    return `${jpyFormatter.format(numericFallbackPrice)} JPY`;
  }
  return 'Not available';
}

function normalizeItemProduct(record, requestedItemCode) {
  const details = record.details && typeof record.details === 'object' ? record.details : {};
  const listing = record.listing && typeof record.listing === 'object' ? record.listing : {};
  const itemCode = firstNonEmptyValue(
    getRecordItemCode(record),
    requestedItemCode
  );
  const sourceUrl = [
    details.sourceUrl,
    record.url,
    listing.url,
    record.sourceUrl,
  ].map(getHttpUrl).find(Boolean)
    || (itemCode
      ? `https://www.amiami.com/eng/detail?gcode=${encodeURIComponent(itemCode)}`
      : '');

  return {
    brand: firstNonEmptyValue(details.brand, listing.brand, record.brand) || 'Not available',
    imageUrls: getImageUrls(record, details, listing),
    itemCode,
    itemName: firstNonEmptyValue(
      details.itemName,
      listing.itemName,
      record.itemName,
      itemCode
    ),
    price: getCurrentPrice(record, details, listing),
    series: firstNonEmptyValue(
      details.seriesTitle,
      firstArrayValue(details.seriesTitles),
      record.seriesTitle,
      firstArrayValue(details.originalTitles)
    ) || 'Not available',
    sourceUrl,
  };
}

async function fetchItemProduct(itemCode) {
  const response = await requestAmiAmiItems([itemCode]);
  if (response.status < 200 || response.status >= 300) {
    const error = new Error(`AmiAmi item API returned HTTP ${response.status}.`);
    error.code = 'AMIAMI_API_RESPONSE_ERROR';
    throw error;
  }

  const record = findItemRecord(response.data, itemCode);
  if (!record) {
    return {
      product: null,
      status: 'not-found',
    };
  }

  return {
    product: normalizeItemProduct(record, itemCode),
    status: 'found',
  };
}

function getCachedResult(cacheKey) {
  const cacheEntry = itemCache.get(cacheKey);
  if (!cacheEntry) {
    return null;
  }
  if (cacheEntry.expiresAt <= Date.now()) {
    itemCache.delete(cacheKey);
    return null;
  }

  itemCache.delete(cacheKey);
  itemCache.set(cacheKey, cacheEntry);
  return cacheEntry.result;
}

function cacheResult(cacheKey, result, ttl) {
  for (const [key, cacheEntry] of itemCache) {
    if (cacheEntry.expiresAt <= Date.now()) {
      itemCache.delete(key);
    }
  }
  while (itemCache.size >= ITEM_CACHE_MAX_ENTRIES) {
    itemCache.delete(itemCache.keys().next().value);
  }

  itemCache.set(cacheKey, {
    expiresAt: Date.now() + ttl,
    result,
  });
}

async function getCachedItemProduct(itemCode) {
  const cacheKey = sanitizeText(itemCode).toUpperCase();
  if (!cacheKey) {
    return {
      product: null,
      status: 'not-found',
    };
  }

  const cachedResult = getCachedResult(cacheKey);
  if (cachedResult) {
    return cachedResult;
  }
  if (pendingItemRequests.has(cacheKey)) {
    return pendingItemRequests.get(cacheKey);
  }

  const request = fetchItemProduct(cacheKey)
    .then((result) => {
      cacheResult(cacheKey, result, ITEM_CACHE_TTL_MS);
      return result;
    })
    .catch((error) => {
      const result = {
        product: null,
        status: error.code === 'AMIAMI_API_NOT_CONFIGURED'
          ? 'not-configured'
          : 'unavailable',
      };
      cacheResult(cacheKey, result, ITEM_ERROR_CACHE_TTL_MS);
      if (result.status === 'unavailable') {
        console.error(`AmiAmi item lookup failed for ${cacheKey}: ${error.message}`);
      }
      return result;
    })
    .finally(() => {
      pendingItemRequests.delete(cacheKey);
    });

  pendingItemRequests.set(cacheKey, request);
  return request;
}

module.exports = {
  getCachedItemProduct,
  hasAmiAmiApiKey,
  requestAmiAmiItems,
};
