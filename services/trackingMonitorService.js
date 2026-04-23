"use strict";

const amiamiCountries = require('../data/amiami_countries.json');
const {
  Tracking,
  Trackhist0,
  Trackhist1,
  Trackhist2,
  Trackhist3,
  Trackhist4,
  TrackingMonitorGroup,
  TrackingMonitorEntry,
  TrackingMonitorShortcut,
  fn,
  literal,
} = require('../sequelize');

const TRACKHIST_MODELS = [Trackhist0, Trackhist1, Trackhist2, Trackhist3, Trackhist4];
const ONE_DAY_MS = 24 * 60 * 60 * 1000;
const DHL_GROUPLABEL = 22;
const MANUAL_OVERRIDE_HISTORY_TABLE = -1;

const SHIPPING_METHOD_GROUPS = {
  19: 'EMS',
  20: 'Air Small Packet Registered',
  21: 'Air Parcel',
  22: 'DHL',
  23: 'SAL Registered',
  24: 'SAL Parcel',
  25: 'Surface Parcel',
  80: 'Surface Mail (Premium)',
  100: 'ECMS',
  101: 'International ePacket Light',
};

const DELIVERY_OUTCOME = {
  DESTINATION: 'destination_delivered',
  RETURN: 'return_delivered',
  OTHER_COUNTRY: 'other_country_delivered',
  UNKNOWN: 'delivery_location_unknown',
  NOT_DELIVERED: 'not_delivered',
  NO_MATCH: 'no_tracking_match',
};

const DELIVERY_OUTCOME_LABELS = {
  [DELIVERY_OUTCOME.DESTINATION]: 'Delivered in destination country',
  [DELIVERY_OUTCOME.RETURN]: 'Return delivered in Japan',
  [DELIVERY_OUTCOME.OTHER_COUNTRY]: 'Delivered in another country',
  [DELIVERY_OUTCOME.UNKNOWN]: 'Delivered, location unresolved',
  [DELIVERY_OUTCOME.NOT_DELIVERED]: 'Not delivered',
  [DELIVERY_OUTCOME.NO_MATCH]: 'No tracking match',
};

const MANUAL_OVERRIDE_OUTCOMES = new Set([
  DELIVERY_OUTCOME.DESTINATION,
  DELIVERY_OUTCOME.RETURN,
]);

const MATCH_SELECTION_LABELS = {
  no_match: 'No match',
  single_match: 'Single match',
  latest_before_monitor_entry: 'Newest match before monitor entry date',
  latest_available_no_prior_match: 'Newest available match',
};

const COUNTRY_NAME_GROUPS = buildCountryNameGroups(amiamiCountries);
const COUNTRY_ALIAS_LOOKUP = buildCountryAliasLookup({
  ...COUNTRY_NAME_GROUPS,
  JAPAN: ['JAPAN', 'KANAGAWA', 'TOKYO'],
  'UNITED STATES': ['UNITED STATES', 'UNITED STATES OF AMERICA', 'USA', 'AMERICA'],
  'UNITED KINGDOM': ['UNITED KINGDOM', 'GREAT BRITAIN', 'BRITAIN', 'ENGLAND'],
  'KOREA, REPUBLIC OF': ['KOREA, REPUBLIC OF', 'KOREA REPUBLIC OF', 'REPUBLIC OF KOREA', 'SOUTH KOREA'],
  'RUSSIAN FEDERATION': ['RUSSIAN FEDERATION', 'RUSSIA'],
  'UNITED ARAB EMIRATES': ['UNITED ARAB EMIRATES', 'UAE'],
  'HONG KONG': ['HONG KONG', 'HONGKONG', 'HONG KONG SAR'],
  CZECHIA: ['CZECHIA', 'CZECH REPUBLIC'],
  TAIWAN: ['TAIWAN', 'REPUBLIC OF CHINA', 'TAIWAN ROC'],
  'VIET NAM': ['VIET NAM', 'VIETNAM'],
});

const COUNTRY_TEXT_MATCHERS = Object.entries(COUNTRY_ALIAS_LOOKUP)
  .map(([aliasKey, canonical]) => ({ aliasKey, canonical }))
  .filter((entry) => entry.aliasKey.length >= 4)
  .sort((a, b) => b.aliasKey.length - a.aliasKey.length);

function createError(message, status = 400) {
  const error = new Error(message);
  error.status = status;
  return error;
}

function normalizeTrackingValue(value) {
  if (typeof value !== 'string') {
    return '';
  }

  return value.replace(/^"+|"+$/g, '').trim().toUpperCase();
}

function parseTrackingInput(rawText, uploadFile) {
  const chunks = [];

  if (typeof rawText === 'string' && rawText.trim()) {
    chunks.push(rawText);
  }

  if (uploadFile && uploadFile.data) {
    chunks.push(uploadFile.data.toString('utf8'));
  }

  const seen = new Set();
  const trackingNumbers = [];

  chunks.forEach((chunk) => {
    const rows = chunk.replace(/\r/g, '\n').split('\n');
    rows.forEach((row) => {
      const trimmed = row.trim();
      if (!trimmed) {
        return;
      }

      let candidate = trimmed;
      if (/[,;\t]/.test(candidate)) {
        candidate = candidate.split(/[,;\t]/)[0];
      }

      candidate = normalizeTrackingValue(candidate);
      if (!candidate || candidate === 'TRACKING' || candidate === 'TRACKING NUMBER' || candidate === 'TRACKINGNUMBER') {
        return;
      }

      if (!seen.has(candidate)) {
        seen.add(candidate);
        trackingNumbers.push(candidate);
      }
    });
  });

  return trackingNumbers;
}

function toTimestamp(value) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : 0;
}

function hasCachedSnapshot(entry) {
  return toTimestamp(entry?.cachedAt) > 0;
}

function hasFullCacheCoverage(entries) {
  return entries.every((entry) => hasCachedSnapshot(entry));
}

function isDeliveredTrackingRow(row) {
  return Boolean(row && row.delivered && toTimestamp(row.delivereddate) > 0);
}

function isDhlRow(row) {
  if (!row) {
    return false;
  }

  return Number(row.grouplabel) === DHL_GROUPLABEL || String(row.carrier || '').trim().toUpperCase() === 'DHL';
}

function formatShippingMethodName(grouplabel) {
  if (grouplabel === null || grouplabel === undefined || grouplabel === '') {
    return 'No tracking match';
  }

  return SHIPPING_METHOD_GROUPS[grouplabel] || `Unknown (${grouplabel})`;
}

function buildCountryAliasLookup(groups) {
  const lookup = {};
  Object.entries(groups).forEach(([canonical, aliases]) => {
    aliases.forEach((alias) => {
      lookup[normalizeCountryKey(alias)] = canonical;
    });
    lookup[normalizeCountryKey(canonical)] = canonical;
  });
  return lookup;
}

function buildCountryNameGroups(rows) {
  const groups = {};

  rows.forEach((row) => {
    if (!Array.isArray(row) || typeof row[1] !== 'string') {
      return;
    }

    const canonical = row[1].trim().toUpperCase();
    if (!canonical) {
      return;
    }

    if (!groups[canonical]) {
      groups[canonical] = [];
    }

    groups[canonical].push(row[1]);
  });

  return groups;
}

function normalizeCountryKey(value) {
  if (typeof value !== 'string') {
    return '';
  }

  return value
    .toUpperCase()
    .replace(/&/g, ' AND ')
    .replace(/[^A-Z0-9]+/g, '')
    .trim();
}

function canonicalizeCountry(value) {
  if (typeof value !== 'string') {
    return '';
  }

  const trimmed = value.trim();
  if (!trimmed) {
    return '';
  }

  const normalizedKey = normalizeCountryKey(trimmed);
  return COUNTRY_ALIAS_LOOKUP[normalizedKey] || trimmed.toUpperCase().replace(/\s+/g, ' ').trim();
}

function countriesMatch(left, right) {
  const normalizedLeft = canonicalizeCountry(left);
  const normalizedRight = canonicalizeCountry(right);
  return Boolean(normalizedLeft && normalizedRight && normalizedLeft === normalizedRight);
}

function inferCountryFromText(value) {
  if (typeof value !== 'string' || !value.trim()) {
    return '';
  }

  const normalizedText = normalizeCountryKey(value);
  if (!normalizedText) {
    return '';
  }

  for (const matcher of COUNTRY_TEXT_MATCHERS) {
    if (normalizedText.includes(matcher.aliasKey)) {
      return matcher.canonical;
    }
  }

  return '';
}

function parseHistoryTimestamp(value) {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) {
      return 0;
    }

    const asNumber = Number(trimmed);
    if (Number.isFinite(asNumber)) {
      return asNumber;
    }

    const parsed = Date.parse(trimmed);
    return Number.isFinite(parsed) ? parsed : 0;
  }

  if (value instanceof Date) {
    const timestamp = value.getTime();
    return Number.isFinite(timestamp) ? timestamp : 0;
  }

  return 0;
}

function parseJson(value) {
  if (!value) {
    return null;
  }

  if (typeof value === 'object') {
    return value;
  }

  if (typeof value !== 'string') {
    return null;
  }

  try {
    return JSON.parse(value);
  } catch (_error) {
    return null;
  }
}

function pickHistoryArray(payload) {
  if (Array.isArray(payload)) {
    return payload;
  }

  if (!payload || typeof payload !== 'object') {
    return [];
  }

  if (Array.isArray(payload.data)) {
    return payload.data;
  }
  if (Array.isArray(payload.events)) {
    return payload.events;
  }
  if (Array.isArray(payload.history)) {
    return payload.history;
  }
  if (Array.isArray(payload.updates)) {
    return payload.updates;
  }

  return [];
}

function pushLocationPart(parts, value, depth = 0) {
  if (!value || depth > 2) {
    return;
  }

  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (trimmed) {
      parts.push(trimmed);
    }
    return;
  }

  if (Array.isArray(value)) {
    value.forEach((item) => pushLocationPart(parts, item, depth + 1));
    return;
  }

  if (typeof value !== 'object') {
    return;
  }

  [
    'name',
    'location',
    'country',
    'office',
    'city',
    'state',
    'province',
    'prefecture',
    'region',
    'facility',
    'branch',
    'address',
    'postcode',
    'postalCode',
    'zipCode',
  ].forEach((key) => {
    if (key in value) {
      pushLocationPart(parts, value[key], depth + 1);
    }
  });
}

function extractHistoryLocation(update) {
  const parts = [];
  [
    update.location,
    update.country,
    update.office,
    update.city,
    update.state,
    update.province,
    update.prefecture,
    update.region,
    update.address,
    update.activityLocation,
  ].forEach((value) => pushLocationPart(parts, value));

  return Array.from(new Set(parts)).join(' | ');
}

function extractHistoryDescription(update) {
  const fields = [
    update.description,
    update.desciption,
    update.status,
    update.event,
    update.message,
    update.remark,
  ];

  for (const value of fields) {
    if (typeof value === 'string' && value.trim()) {
      return value.trim();
    }
  }

  return '';
}

function normalizeHistoryEvents(rawHistory) {
  const payload = parseJson(rawHistory);
  const events = pickHistoryArray(payload);

  return events
    .map((event) => {
      const location = extractHistoryLocation(event || {});
      const explicitCountry = canonicalizeCountry(
        typeof event?.country === 'string' ? event.country : ''
      );
      const inferredCountry = explicitCountry || inferCountryFromText(location);

      return {
        timestamp: parseHistoryTimestamp(event?.timestamp ?? event?.date ?? event?.datetime ?? event?.time),
        description: extractHistoryDescription(event || {}),
        location,
        country: inferredCountry,
      };
    })
    .filter((event) => event.timestamp > 0 || event.description || event.location || event.country)
    .sort((left, right) => right.timestamp - left.timestamp);
}

function isDeliveryLikeDescription(description) {
  if (typeof description !== 'string') {
    return false;
  }

  const normalized = description.trim().toLowerCase();
  if (!normalized) {
    return false;
  }

  return (
    normalized.includes('deliver')
    || normalized.includes('signed')
    || normalized.includes('letterbox')
    || normalized.includes('pickup completed')
    || normalized.includes('pick-up completed')
  );
}

function isReturnLikeDescription(description) {
  if (typeof description !== 'string') {
    return false;
  }

  const normalized = description.trim().toLowerCase();
  if (!normalized) {
    return false;
  }

  return (
    normalized.includes('return')
    || normalized.includes('sender')
    || normalized.includes('shipper')
    || normalized.includes('back to')
  );
}

function pickRelevantDeliveryEvent(events) {
  const eventsWithLocation = events.filter((event) => event.location || event.country);
  const deliveryEventsWithLocation = eventsWithLocation.filter((event) => isDeliveryLikeDescription(event.description));
  if (deliveryEventsWithLocation.length > 0) {
    return deliveryEventsWithLocation[0];
  }

  const deliveryEvents = events.filter((event) => isDeliveryLikeDescription(event.description));
  if (deliveryEvents.length > 0) {
    return deliveryEvents[0];
  }

  if (eventsWithLocation.length > 0) {
    return eventsWithLocation[0];
  }

  return events[0] || null;
}

function analyzeDeliveredHistory(sourceRow, rawHistory) {
  const events = normalizeHistoryEvents(rawHistory);
  const event = pickRelevantDeliveryEvent(events);
  const destinationCountry = canonicalizeCountry(sourceRow.country);
  const deliveryCountry = canonicalizeCountry(event?.country || inferCountryFromText(event?.location || ''));
  const deliveryLocation = event?.location || '';
  const deliveryEventDescription = event?.description || '';
  const deliveryEventTimestamp = event?.timestamp || 0;

  let deliveryOutcome = DELIVERY_OUTCOME.UNKNOWN;
  if (countriesMatch(deliveryCountry, destinationCountry) || countriesMatch(inferCountryFromText(deliveryLocation), destinationCountry)) {
    deliveryOutcome = DELIVERY_OUTCOME.DESTINATION;
  } else if (
    countriesMatch(deliveryCountry, 'JAPAN')
    || countriesMatch(inferCountryFromText(deliveryLocation), 'JAPAN')
    || isReturnLikeDescription(deliveryEventDescription)
  ) {
    deliveryOutcome = DELIVERY_OUTCOME.RETURN;
  } else if (deliveryCountry) {
    deliveryOutcome = DELIVERY_OUTCOME.OTHER_COUNTRY;
  }

  return {
    deliveryOutcome,
    deliveryCountry,
    deliveryLocation,
    deliveryEventDescription,
    deliveryEventTimestamp,
    historyEventCount: events.length,
  };
}

function analyzeDeliveredDhlStatus(sourceRow) {
  const normalizedStatus = typeof sourceRow.status === 'string'
    ? sourceRow.status.trim().toLowerCase()
    : '';
  const destinationCountry = canonicalizeCountry(sourceRow.country);

  if (normalizedStatus === 'returned to shipper') {
    return {
      deliveryOutcome: DELIVERY_OUTCOME.RETURN,
      deliveryCountry: 'JAPAN',
      deliveryLocation: 'JAPAN',
      deliveryEventDescription: sourceRow.status || 'Returned to shipper',
      deliveryEventTimestamp: toTimestamp(sourceRow.delivereddate),
      historyEventCount: 0,
    };
  }

  if (normalizedStatus === 'delivered' || isDeliveredTrackingRow(sourceRow)) {
    return {
      deliveryOutcome: DELIVERY_OUTCOME.DESTINATION,
      deliveryCountry: destinationCountry,
      deliveryLocation: sourceRow.country || destinationCountry,
      deliveryEventDescription: sourceRow.status || 'Delivered',
      deliveryEventTimestamp: toTimestamp(sourceRow.delivereddate),
      historyEventCount: 0,
    };
  }

  return {
    deliveryOutcome: DELIVERY_OUTCOME.UNKNOWN,
    deliveryCountry: '',
    deliveryLocation: '',
    deliveryEventDescription: sourceRow.status || '',
    deliveryEventTimestamp: toTimestamp(sourceRow.delivereddate),
    historyEventCount: 0,
  };
}

function analyzeDeliveredShipment(sourceRow, rawHistory) {
  if (isDhlRow(sourceRow)) {
    return analyzeDeliveredDhlStatus(sourceRow);
  }

  return analyzeDeliveredHistory(sourceRow, rawHistory);
}

function hasUsableDhlDeliveredCache(entry, sourceRow) {
  const expected = analyzeDeliveredDhlStatus(sourceRow);
  return Boolean(
    Number(entry.cachedTrackingId || 0) === Number(sourceRow.id || 0)
    && toTimestamp(entry.cachedAt) > 0
    && entry.cachedDeliveryOutcome === expected.deliveryOutcome
    && canonicalizeCountry(entry.cachedDeliveryCountry || '') === canonicalizeCountry(expected.deliveryCountry || '')
  );
}

function isManualOverrideEntry(entry) {
  return Boolean(
    entry
    && Number(entry.cachedHistoryTable) === MANUAL_OVERRIDE_HISTORY_TABLE
    && toTimestamp(entry.cachedAt) > 0
    && MANUAL_OVERRIDE_OUTCOMES.has(entry.cachedDeliveryOutcome)
  );
}

function hasUsableManualOverride(entry) {
  return isManualOverrideEntry(entry);
}

function sortTrackingRows(left, right) {
  const addedDiff = toTimestamp(right.addeddate) - toTimestamp(left.addeddate);
  if (addedDiff !== 0) {
    return addedDiff;
  }

  const shippedDiff = toTimestamp(right.shippeddate) - toTimestamp(left.shippeddate);
  if (shippedDiff !== 0) {
    return shippedDiff;
  }

  return Number(right.id || 0) - Number(left.id || 0);
}

function chooseTrackingMatch(entry, candidates) {
  const sortedCandidates = [...candidates].sort(sortTrackingRows);

  if (sortedCandidates.length === 0) {
    return {
      row: null,
      matchCount: 0,
      selectionReason: 'no_match',
    };
  }

  if (sortedCandidates.length === 1) {
    return {
      row: sortedCandidates[0],
      matchCount: 1,
      selectionReason: 'single_match',
    };
  }

  const beforeEntryCandidates = sortedCandidates.filter((candidate) => toTimestamp(candidate.addeddate) <= toTimestamp(entry.addeddate));
  if (beforeEntryCandidates.length > 0) {
    return {
      row: beforeEntryCandidates[0],
      matchCount: sortedCandidates.length,
      selectionReason: 'latest_before_monitor_entry',
    };
  }

  return {
    row: sortedCandidates[0],
    matchCount: sortedCandidates.length,
    selectionReason: 'latest_available_no_prior_match',
  };
}

function getTrackhistIndex(shippeddate) {
  const shippedTimestamp = toTimestamp(shippeddate);
  if (!shippedTimestamp) {
    return null;
  }

  return new Date(shippedTimestamp).getFullYear() % 5;
}

function hasUsableDeliveredCache(entry, sourceRow) {
  if (isDhlRow(sourceRow)) {
    return hasUsableDhlDeliveredCache(entry, sourceRow);
  }

  return Boolean(
    sourceRow
    && isDeliveredTrackingRow(sourceRow)
    && Number(entry.cachedTrackingId || 0) === Number(sourceRow.id || 0)
    && toTimestamp(entry.cachedAt) > 0
    && entry.cachedDeliveryOutcome
    && !(
      entry.cachedDeliveryOutcome === DELIVERY_OUTCOME.UNKNOWN
      && !canonicalizeCountry(entry.cachedDeliveryCountry || '')
    )
  );
}

function buildManualOverridePayload(match, deliveryOutcome) {
  const sourceRow = match.row || null;
  const destinationCountry = canonicalizeCountry(sourceRow?.country || '');
  const deliveryCountry = deliveryOutcome === DELIVERY_OUTCOME.RETURN
    ? 'JAPAN'
    : (destinationCountry || '');
  const deliveryLocation = deliveryOutcome === DELIVERY_OUTCOME.RETURN
    ? 'Japan'
    : (sourceRow?.country || destinationCountry || 'Destination country');
  const deliveryEventDescription = deliveryOutcome === DELIVERY_OUTCOME.RETURN
    ? 'Manually marked as returned.'
    : 'Manually marked as delivered in destination.';

  return {
    cachedTrackingId: Number(sourceRow?.id || 0),
    cachedMatchCount: match.matchCount,
    cachedSelectionReason: match.selectionReason,
    cachedCountry: sourceRow?.country || '',
    cachedStatus: sourceRow?.status || '',
    cachedShippeddate: toTimestamp(sourceRow?.shippeddate),
    cachedDelivereddate: 0,
    cachedDelivered: false,
    cachedGrouplabel: sourceRow?.grouplabel ?? null,
    cachedDeliveryOutcome: deliveryOutcome,
    cachedDeliveryCountry: deliveryCountry,
    cachedDeliveryLocation: deliveryLocation,
    cachedDeliveryEventDescription: deliveryEventDescription,
    cachedDeliveryEventTimestamp: 0,
    cachedHistoryTable: MANUAL_OVERRIDE_HISTORY_TABLE,
    cachedAt: Date.now(),
  };
}

function buildLiveCachePayload(match) {
  if (!match.row) {
    return {
      cachedTrackingId: 0,
      cachedMatchCount: 0,
      cachedSelectionReason: 'no_match',
      cachedCountry: '',
      cachedStatus: '',
      cachedShippeddate: 0,
      cachedDelivereddate: 0,
      cachedDelivered: false,
      cachedGrouplabel: null,
      cachedDeliveryOutcome: DELIVERY_OUTCOME.NO_MATCH,
      cachedDeliveryCountry: '',
      cachedDeliveryLocation: '',
      cachedDeliveryEventDescription: '',
      cachedDeliveryEventTimestamp: 0,
      cachedHistoryTable: null,
      cachedAt: Date.now(),
    };
  }

  return {
    cachedTrackingId: match.row.id,
    cachedMatchCount: match.matchCount,
    cachedSelectionReason: match.selectionReason,
    cachedCountry: match.row.country || '',
    cachedStatus: match.row.status || '',
    cachedShippeddate: toTimestamp(match.row.shippeddate),
    cachedDelivereddate: toTimestamp(match.row.delivereddate),
    cachedDelivered: Boolean(match.row.delivered),
    cachedGrouplabel: match.row.grouplabel,
    cachedDeliveryOutcome: DELIVERY_OUTCOME.NOT_DELIVERED,
    cachedDeliveryCountry: '',
    cachedDeliveryLocation: '',
    cachedDeliveryEventDescription: '',
    cachedDeliveryEventTimestamp: 0,
    cachedHistoryTable: isDhlRow(match.row) ? null : getTrackhistIndex(match.row.shippeddate),
    cachedAt: Date.now(),
  };
}

function buildCachePayload(entry, match, analysis) {
  return {
    cachedTrackingId: match.row.id,
    cachedMatchCount: match.matchCount,
    cachedSelectionReason: match.selectionReason,
    cachedCountry: match.row.country || '',
    cachedStatus: match.row.status || '',
    cachedShippeddate: toTimestamp(match.row.shippeddate),
    cachedDelivereddate: toTimestamp(match.row.delivereddate),
    cachedDelivered: Boolean(match.row.delivered),
    cachedGrouplabel: match.row.grouplabel,
    cachedDeliveryOutcome: analysis.deliveryOutcome,
    cachedDeliveryCountry: analysis.deliveryCountry || '',
    cachedDeliveryLocation: analysis.deliveryLocation || '',
    cachedDeliveryEventDescription: analysis.deliveryEventDescription || '',
    cachedDeliveryEventTimestamp: toTimestamp(analysis.deliveryEventTimestamp),
    cachedHistoryTable: isDhlRow(match.row) ? null : getTrackhistIndex(match.row.shippeddate),
    cachedAt: Date.now(),
  };
}

function buildRowFromCache(entry, match) {
  const isMatched = Number(entry.cachedTrackingId || 0) > 0;
  return buildReportRow({
    entry,
    matchCount: Number(entry.cachedMatchCount || match?.matchCount || 0),
    selectionReason: entry.cachedSelectionReason || match?.selectionReason || 'no_match',
    matched: isMatched,
    sourceTrackingId: isMatched ? Number(entry.cachedTrackingId || 0) : null,
    country: entry.cachedCountry || '',
    status: entry.cachedStatus || '',
    shippeddate: toTimestamp(entry.cachedShippeddate),
    delivereddate: toTimestamp(entry.cachedDelivereddate),
    delivered: Boolean(entry.cachedDelivered),
    grouplabel: entry.cachedGrouplabel,
    deliveryOutcome: entry.cachedDeliveryOutcome || DELIVERY_OUTCOME.UNKNOWN,
    deliveryCountry: entry.cachedDeliveryCountry || '',
    deliveryLocation: entry.cachedDeliveryLocation || '',
    deliveryEventDescription: entry.cachedDeliveryEventDescription || '',
    deliveryEventTimestamp: toTimestamp(entry.cachedDeliveryEventTimestamp),
    historyTable: entry.cachedHistoryTable,
    fromCache: true,
    manualOverride: isManualOverrideEntry(entry),
  });
}

function isManualOverrideNoMatchEntry(entry) {
  return Boolean(
    hasUsableManualOverride(entry)
    && Number(entry.cachedTrackingId || 0) === 0
  );
}

function canSetManualOutcome(entry, match) {
  if (isManualOverrideNoMatchEntry(entry)) {
    return true;
  }

  if (hasUsableManualOverride(entry)) {
    return false;
  }

  if (!match.row) {
    return true;
  }

  if (hasUsableDeliveredCache(entry, match.row) || isDeliveredTrackingRow(match.row)) {
    return false;
  }

  return buildLiveRow(entry, match).deliveryOutcome === DELIVERY_OUTCOME.NOT_DELIVERED;
}

function canDeleteEntry(entry, match) {
  if (isManualOverrideNoMatchEntry(entry)) {
    return true;
  }

  if (hasUsableManualOverride(entry)) {
    return false;
  }

  return !match.row;
}

function buildReportRow(payload) {
  const shippeddate = toTimestamp(payload.shippeddate);
  const delivereddate = toTimestamp(payload.delivereddate);
  const delivered = Boolean(payload.delivered && delivereddate > 0);
  const transitDays = shippeddate > 0 && delivereddate > shippeddate
    ? Math.round(((delivereddate - shippeddate) / ONE_DAY_MS) * 10) / 10
    : null;

  return {
    entryId: payload.entry.id,
    tracking: payload.entry.tracking,
    monitorAddeddate: toTimestamp(payload.entry.addeddate),
    matched: payload.matched,
    matchCount: payload.matchCount,
    selectionReason: payload.selectionReason,
    selectionReasonLabel: MATCH_SELECTION_LABELS[payload.selectionReason] || payload.selectionReason,
    sourceTrackingId: payload.sourceTrackingId || null,
    country: payload.country || '',
    status: payload.status || '',
    shippeddate,
    delivereddate,
    delivered,
    grouplabel: payload.grouplabel ?? null,
    shippingMethodName: formatShippingMethodName(payload.grouplabel),
    deliveryOutcome: payload.deliveryOutcome,
    deliveryOutcomeLabel: DELIVERY_OUTCOME_LABELS[payload.deliveryOutcome] || payload.deliveryOutcome,
    deliveryCountry: payload.deliveryCountry || '',
    deliveryLocation: payload.deliveryLocation || '',
    deliveryEventDescription: payload.deliveryEventDescription || '',
    deliveryEventTimestamp: toTimestamp(payload.deliveryEventTimestamp),
    historyTable: payload.historyTable ?? null,
    transitDays,
    fromCache: Boolean(payload.fromCache),
    manualOverride: Boolean(payload.manualOverride),
  };
}

function buildLiveRow(entry, match) {
  if (!match.row) {
    return buildReportRow({
      entry,
      matchCount: 0,
      selectionReason: 'no_match',
      matched: false,
      sourceTrackingId: null,
      country: '',
      status: '',
      shippeddate: 0,
      delivereddate: 0,
      delivered: false,
      grouplabel: null,
      deliveryOutcome: DELIVERY_OUTCOME.NO_MATCH,
      deliveryCountry: '',
      deliveryLocation: '',
      deliveryEventDescription: '',
      deliveryEventTimestamp: 0,
      historyTable: null,
      fromCache: false,
    });
  }

  return buildReportRow({
    entry,
    matchCount: match.matchCount,
    selectionReason: match.selectionReason,
    matched: true,
    sourceTrackingId: match.row.id,
    country: match.row.country || '',
    status: match.row.status || '',
    shippeddate: match.row.shippeddate,
    delivereddate: match.row.delivereddate,
    delivered: Boolean(match.row.delivered),
    grouplabel: match.row.grouplabel,
    deliveryOutcome: isDeliveredTrackingRow(match.row) ? DELIVERY_OUTCOME.UNKNOWN : DELIVERY_OUTCOME.NOT_DELIVERED,
    deliveryCountry: '',
    deliveryLocation: '',
    deliveryEventDescription: '',
    deliveryEventTimestamp: 0,
    historyTable: getTrackhistIndex(match.row.shippeddate),
    fromCache: false,
  });
}

function buildDeliveredRow(entry, match, analysis) {
  return buildReportRow({
    entry,
    matchCount: match.matchCount,
    selectionReason: match.selectionReason,
    matched: true,
    sourceTrackingId: match.row.id,
    country: match.row.country || '',
    status: match.row.status || '',
    shippeddate: match.row.shippeddate,
    delivereddate: match.row.delivereddate,
    delivered: Boolean(match.row.delivered),
    grouplabel: match.row.grouplabel,
    deliveryOutcome: analysis.deliveryOutcome,
    deliveryCountry: analysis.deliveryCountry || '',
    deliveryLocation: analysis.deliveryLocation || '',
    deliveryEventDescription: analysis.deliveryEventDescription || '',
    deliveryEventTimestamp: analysis.deliveryEventTimestamp || 0,
    historyTable: isDhlRow(match.row) ? null : getTrackhistIndex(match.row.shippeddate),
    fromCache: false,
  });
}

function buildMethodBucket(grouplabel) {
  return {
    grouplabel,
    shippingMethodName: formatShippingMethodName(grouplabel),
    totalEntries: 0,
    matchedEntries: 0,
    missingEntries: 0,
    deliveredEntries: 0,
    destinationDeliveredEntries: 0,
    returnDeliveredEntries: 0,
    otherCountryDeliveredEntries: 0,
    deliveryLocationUnknownEntries: 0,
    inTransitEntries: 0,
    noTrackingMatchEntries: 0,
    totalTransitDays: 0,
    transitDayCount: 0,
  };
}

function addRowToMethodBucket(bucket, row) {
  bucket.totalEntries += 1;

  if (row.matched) {
    bucket.matchedEntries += 1;
  } else {
    bucket.missingEntries += 1;
  }

  if (row.delivered) {
    bucket.deliveredEntries += 1;
  }

  if (row.transitDays !== null) {
    bucket.totalTransitDays += row.transitDays;
    bucket.transitDayCount += 1;
  }

  if (row.deliveryOutcome === DELIVERY_OUTCOME.DESTINATION) {
    bucket.destinationDeliveredEntries += 1;
  } else if (row.deliveryOutcome === DELIVERY_OUTCOME.RETURN) {
    bucket.returnDeliveredEntries += 1;
  } else if (row.deliveryOutcome === DELIVERY_OUTCOME.OTHER_COUNTRY) {
    bucket.otherCountryDeliveredEntries += 1;
  } else if (row.deliveryOutcome === DELIVERY_OUTCOME.UNKNOWN) {
    bucket.deliveryLocationUnknownEntries += 1;
  } else if (row.deliveryOutcome === DELIVERY_OUTCOME.NOT_DELIVERED) {
    bucket.inTransitEntries += 1;
  } else if (row.deliveryOutcome === DELIVERY_OUTCOME.NO_MATCH) {
    bucket.noTrackingMatchEntries += 1;
  }
}

function finalizeMethodBucket(bucket) {
  return {
    ...bucket,
    averageTransitDays: bucket.transitDayCount > 0
      ? Math.round((bucket.totalTransitDays / bucket.transitDayCount) * 10) / 10
      : null,
  };
}

function sortMethodStats(left, right) {
  const leftLabel = left.grouplabel === null ? Number.MAX_SAFE_INTEGER : Number(left.grouplabel);
  const rightLabel = right.grouplabel === null ? Number.MAX_SAFE_INTEGER : Number(right.grouplabel);
  return leftLabel - rightLabel;
}

function buildMethodStats(rows) {
  const methodBuckets = new Map();

  rows.forEach((row) => {
    const key = row.grouplabel === null ? 'no-match' : String(row.grouplabel);
    if (!methodBuckets.has(key)) {
      methodBuckets.set(key, buildMethodBucket(row.grouplabel));
    }
    addRowToMethodBucket(methodBuckets.get(key), row);
  });

  return Array.from(methodBuckets.values())
    .map(finalizeMethodBucket)
    .sort(sortMethodStats);
}

function buildReportSummary(rows) {
  const summary = {
    totalEntries: rows.length,
    matchedEntries: 0,
    missingEntries: 0,
    deliveredEntries: 0,
    destinationDeliveredEntries: 0,
    returnDeliveredEntries: 0,
    otherCountryDeliveredEntries: 0,
    deliveryLocationUnknownEntries: 0,
    inTransitEntries: 0,
    noTrackingMatchEntries: 0,
    reusedTrackingEntries: 0,
    cacheHitEntries: 0,
    cacheWriteEntries: 0,
    totalTransitDays: 0,
    transitDayCount: 0,
  };

  rows.forEach((row) => {
    if (row.matched) {
      summary.matchedEntries += 1;
    } else {
      summary.missingEntries += 1;
    }

    if (row.delivered) {
      summary.deliveredEntries += 1;
    }

    if (row.transitDays !== null) {
      summary.totalTransitDays += row.transitDays;
      summary.transitDayCount += 1;
    }

    if (row.matchCount > 1) {
      summary.reusedTrackingEntries += 1;
    }

    if (row.fromCache) {
      summary.cacheHitEntries += 1;
    }

    if (row.deliveryOutcome === DELIVERY_OUTCOME.DESTINATION) {
      summary.destinationDeliveredEntries += 1;
    } else if (row.deliveryOutcome === DELIVERY_OUTCOME.RETURN) {
      summary.returnDeliveredEntries += 1;
    } else if (row.deliveryOutcome === DELIVERY_OUTCOME.OTHER_COUNTRY) {
      summary.otherCountryDeliveredEntries += 1;
    } else if (row.deliveryOutcome === DELIVERY_OUTCOME.UNKNOWN) {
      summary.deliveryLocationUnknownEntries += 1;
    } else if (row.deliveryOutcome === DELIVERY_OUTCOME.NOT_DELIVERED) {
      summary.inTransitEntries += 1;
    } else if (row.deliveryOutcome === DELIVERY_OUTCOME.NO_MATCH) {
      summary.noTrackingMatchEntries += 1;
    }
  });

  return {
    ...summary,
    averageTransitDays: summary.transitDayCount > 0
      ? Math.round((summary.totalTransitDays / summary.transitDayCount) * 10) / 10
      : null,
  };
}

function roundPercentage(value) {
  return Math.round(Number(value || 0) * 10) / 10;
}

function buildOutcomeMix(source) {
  const destinationDeliveredEntries = Number(source.destinationDeliveredEntries || 0);
  const returnDeliveredEntries = Number(source.returnDeliveredEntries || 0);
  const inTransitEntries = Number(source.inTransitEntries || 0);
  const comparableEntries = destinationDeliveredEntries + returnDeliveredEntries + inTransitEntries;

  return {
    comparableEntries,
    destinationPercent: comparableEntries > 0
      ? roundPercentage((destinationDeliveredEntries / comparableEntries) * 100)
      : 0,
    returnPercent: comparableEntries > 0
      ? roundPercentage((returnDeliveredEntries / comparableEntries) * 100)
      : 0,
    inTransitPercent: comparableEntries > 0
      ? roundPercentage((inTransitEntries / comparableEntries) * 100)
      : 0,
  };
}

function buildUncachedComparisonRow(entry) {
  return buildReportRow({
    entry,
    matchCount: 0,
    selectionReason: 'no_match',
    matched: false,
    sourceTrackingId: null,
    country: '',
    status: '',
    shippeddate: 0,
    delivereddate: 0,
    delivered: false,
    grouplabel: null,
    deliveryOutcome: DELIVERY_OUTCOME.NOT_DELIVERED,
    deliveryCountry: '',
    deliveryLocation: '',
    deliveryEventDescription: '',
    deliveryEventTimestamp: 0,
    historyTable: null,
    fromCache: false,
  });
}

function buildLiveComparisonRow(entry, match) {
  if (!match || !match.row) {
    return buildUncachedComparisonRow(entry);
  }

  return buildReportRow({
    entry,
    matchCount: match.matchCount,
    selectionReason: match.selectionReason,
    matched: true,
    sourceTrackingId: match.row.id,
    country: match.row.country || '',
    status: match.row.status || '',
    shippeddate: match.row.shippeddate,
    delivereddate: 0,
    delivered: false,
    grouplabel: match.row.grouplabel,
    deliveryOutcome: DELIVERY_OUTCOME.NOT_DELIVERED,
    deliveryCountry: '',
    deliveryLocation: '',
    deliveryEventDescription: '',
    deliveryEventTimestamp: 0,
    historyTable: isDhlRow(match.row) ? null : getTrackhistIndex(match.row.shippeddate),
    fromCache: false,
  });
}

function buildComparisonRow(entry, liveMatch = null) {
  const hasCache = toTimestamp(entry.cachedAt) > 0;
  const baseRow = hasCache
    ? buildRowFromCache(entry, null)
    : buildLiveComparisonRow(entry, liveMatch);
  const resolvedOutcome = baseRow.deliveryOutcome === DELIVERY_OUTCOME.DESTINATION
    || baseRow.deliveryOutcome === DELIVERY_OUTCOME.RETURN;
  const compareOutcome = resolvedOutcome
    ? baseRow.deliveryOutcome
    : DELIVERY_OUTCOME.NOT_DELIVERED;

  return {
    ...baseRow,
    delivered: resolvedOutcome,
    transitDays: resolvedOutcome ? baseRow.transitDays : null,
    deliveryOutcome: compareOutcome,
    deliveryOutcomeLabel: DELIVERY_OUTCOME_LABELS[compareOutcome] || compareOutcome,
  };
}

function normalizeGroupIdList(rawGroupIds) {
  const tokens = Array.isArray(rawGroupIds)
    ? rawGroupIds.flatMap((value) => String(value || '').split(','))
    : String(rawGroupIds || '').split(',');

  const seen = new Set();
  const groupIds = [];

  tokens.forEach((token) => {
    const trimmed = token.trim();
    if (!trimmed) {
      return;
    }

    const numericId = Number(trimmed);
    if (!Number.isInteger(numericId) || numericId <= 0) {
      throw createError('Invalid monitor group selection.', 400);
    }

    if (!seen.has(numericId)) {
      seen.add(numericId);
      groupIds.push(numericId);
    }
  });

  return groupIds;
}

function parseShortcutGroupIds(rawGroupIds) {
  try {
    return normalizeGroupIdList(rawGroupIds);
  } catch (_error) {
    throw createError('Saved shortcut contains invalid group IDs.', 500);
  }
}

function serializeShortcutGroupIds(groupIds) {
  return normalizeGroupIdList(groupIds).join(',');
}

function buildShortcutPayload(shortcut) {
  const plainShortcut = typeof shortcut?.get === 'function'
    ? shortcut.get({ plain: true })
    : (shortcut || {});
  const groupIds = parseShortcutGroupIds(plainShortcut.groupIds || '');

  return {
    ...plainShortcut,
    id: Number(plainShortcut.id || 0),
    label: typeof plainShortcut.label === 'string' ? plainShortcut.label : '',
    groupIds,
  };
}

async function loadMonitorGroupsByIds(rawGroupIds) {
  const groupIds = normalizeGroupIdList(rawGroupIds);
  if (groupIds.length === 0) {
    return new Map();
  }

  const groups = await TrackingMonitorGroup.findAll({
    where: { id: groupIds },
    raw: true,
  });

  return new Map(groups.map((group) => [Number(group.id), group]));
}

async function assertMonitorGroupsExist(rawGroupIds, errorMessage = 'One or more selected monitor groups no longer exist.') {
  const groupIds = normalizeGroupIdList(rawGroupIds);
  const groupLookup = await loadMonitorGroupsByIds(groupIds);
  const missingGroupIds = groupIds.filter((groupId) => !groupLookup.has(Number(groupId)));

  if (missingGroupIds.length > 0) {
    throw createError(errorMessage, 404);
  }

  return groupLookup;
}

function buildShortcutView(shortcut, groupLookup) {
  const groups = shortcut.groupIds.map((groupId, index) => {
    const group = groupLookup.get(Number(groupId)) || null;
    return {
      id: Number(groupId),
      selectionIndex: index + 1,
      label: group?.label || `Missing group #${groupId}`,
      exists: Boolean(group),
      entryCount: group ? Number(group.entryCount || 0) : 0,
      lastViewedAt: group ? toTimestamp(group.lastViewedAt) : 0,
    };
  });

  return {
    ...shortcut,
    groupCount: groups.length,
    missingGroupCount: groups.filter((group) => !group.exists).length,
    groups,
  };
}

async function findShortcutModel(shortcutId) {
  const shortcut = await TrackingMonitorShortcut.findByPk(shortcutId);
  if (!shortcut) {
    throw createError('Tracking monitor shortcut not found.', 404);
  }

  return shortcut;
}

async function listShortcuts() {
  const shortcuts = await TrackingMonitorShortcut.findAll({
    order: [['updatedAt', 'DESC'], ['createdAt', 'DESC']],
    raw: true,
  });

  const shortcutPayloads = shortcuts.map((shortcut) => buildShortcutPayload(shortcut));
  const allGroupIds = Array.from(new Set(
    shortcutPayloads.flatMap((shortcut) => shortcut.groupIds)
  ));
  const groupLookup = await loadMonitorGroupsByIds(allGroupIds);

  return shortcutPayloads.map((shortcut) => buildShortcutView(shortcut, groupLookup));
}

async function createShortcut({ label, rawGroupIds }) {
  const normalizedLabel = typeof label === 'string' ? label.trim() : '';
  const groupIds = normalizeGroupIdList(rawGroupIds);

  if (!normalizedLabel) {
    throw createError('Shortcut label is required.');
  }

  if (groupIds.length < 2) {
    throw createError('Select at least two monitor groups before saving a shortcut.');
  }

  await assertMonitorGroupsExist(groupIds);

  const shortcut = await TrackingMonitorShortcut.create({
    label: normalizedLabel,
    groupIds: serializeShortcutGroupIds(groupIds),
  });

  return buildShortcutPayload(shortcut);
}

async function updateShortcutSelection(shortcutId, { rawGroupIds, mode }) {
  const shortcutModel = await findShortcutModel(shortcutId);
  const shortcut = buildShortcutPayload(shortcutModel);
  const selectedGroupIds = normalizeGroupIdList(rawGroupIds);
  const normalizedMode = typeof mode === 'string' ? mode.trim() : '';

  if (normalizedMode !== 'append' && normalizedMode !== 'replace') {
    throw createError('Invalid shortcut update mode.', 400);
  }

  if (normalizedMode === 'replace') {
    if (selectedGroupIds.length < 2) {
      throw createError('Select at least two monitor groups to replace the shortcut.');
    }

    await assertMonitorGroupsExist(selectedGroupIds);
    await shortcutModel.update({
      groupIds: serializeShortcutGroupIds(selectedGroupIds),
    });
    return buildShortcutPayload(shortcutModel);
  }

  if (selectedGroupIds.length === 0) {
    throw createError('Select at least one monitor group to append to the shortcut.');
  }

  const existingGroupLookup = await loadMonitorGroupsByIds(shortcut.groupIds);
  const missingExistingGroups = shortcut.groupIds.filter((groupId) => !existingGroupLookup.has(Number(groupId)));
  if (missingExistingGroups.length > 0) {
    throw createError('This shortcut contains missing groups. Replace it with the current selection to repair it.', 400);
  }

  await assertMonitorGroupsExist(selectedGroupIds);

  const mergedGroupIds = [...shortcut.groupIds];
  const seenGroupIds = new Set(mergedGroupIds);
  selectedGroupIds.forEach((groupId) => {
    if (!seenGroupIds.has(groupId)) {
      seenGroupIds.add(groupId);
      mergedGroupIds.push(groupId);
    }
  });

  if (mergedGroupIds.length === shortcut.groupIds.length) {
    throw createError('The selected groups are already included in this shortcut.');
  }

  if (mergedGroupIds.length < 2) {
    throw createError('A saved shortcut must contain at least two monitor groups.');
  }

  await shortcutModel.update({
    groupIds: serializeShortcutGroupIds(mergedGroupIds),
  });

  return buildShortcutPayload(shortcutModel);
}

async function renameShortcut(shortcutId, label) {
  const shortcut = await findShortcutModel(shortcutId);
  const normalizedLabel = typeof label === 'string' ? label.trim() : '';

  if (!normalizedLabel) {
    throw createError('Shortcut label is required.');
  }

  await shortcut.update({ label: normalizedLabel });

  return buildShortcutPayload(shortcut);
}

async function deleteShortcut(shortcutId) {
  const shortcut = await findShortcutModel(shortcutId);
  const payload = buildShortcutPayload(shortcut);
  await shortcut.destroy();
  return payload;
}

async function getShortcutComparisonReport(shortcutId) {
  const shortcut = buildShortcutPayload(await findShortcutModel(shortcutId));

  if (shortcut.groupIds.length < 2) {
    throw createError('Saved shortcut must contain at least two monitor groups.', 400);
  }

  const groupLookup = await loadMonitorGroupsByIds(shortcut.groupIds);
  const shortcutView = buildShortcutView(shortcut, groupLookup);
  if (shortcutView.missingGroupCount > 0) {
    throw createError('One or more groups in this saved shortcut no longer exist. Replace the shortcut selection to repair it.', 404);
  }

  return {
    shortcut: shortcutView,
    report: await getGroupComparisonReport(shortcut.groupIds),
  };
}

async function loadComparisonLiveMatches(entries) {
  const uncachedEntries = entries.filter((entry) => toTimestamp(entry.cachedAt) <= 0);
  if (uncachedEntries.length === 0) {
    return new Map();
  }

  const trackingNumbers = Array.from(new Set(
    uncachedEntries
      .map((entry) => normalizeTrackingValue(entry.tracking))
      .filter(Boolean)
  ));
  const trackingLookup = await loadTrackingRowsByNumber(trackingNumbers);
  const matchLookup = new Map();

  uncachedEntries.forEach((entry) => {
    const candidates = trackingLookup.get(normalizeTrackingValue(entry.tracking)) || [];
    matchLookup.set(Number(entry.id), chooseTrackingMatch(entry, candidates));
  });

  return matchLookup;
}

async function loadTrackingRowsByNumber(trackingNumbers) {
  if (trackingNumbers.length === 0) {
    return new Map();
  }

  const sourceRows = await Tracking.findAll({
    where: { tracking: trackingNumbers },
    raw: true,
  });

  const lookup = new Map();
  sourceRows.forEach((row) => {
    const key = normalizeTrackingValue(row.tracking);
    if (!lookup.has(key)) {
      lookup.set(key, []);
    }
    lookup.get(key).push(row);
  });

  return lookup;
}

async function loadHistoryRows(needsHistory) {
  const trackingByTable = new Map();
  needsHistory.forEach(({ match }) => {
    const historyTable = getTrackhistIndex(match.row.shippeddate);
    if (historyTable === null || TRACKHIST_MODELS[historyTable] === undefined) {
      return;
    }

    if (!trackingByTable.has(historyTable)) {
      trackingByTable.set(historyTable, new Set());
    }
    trackingByTable.get(historyTable).add(match.row.tracking);
  });

  const historyLookup = new Map();

  await Promise.all(Array.from(trackingByTable.entries()).map(async ([historyTable, values]) => {
    const model = TRACKHIST_MODELS[historyTable];
    const rows = await model.findAll({
      where: { tracking: Array.from(values) },
      raw: true,
    });

    rows.forEach((row) => {
      historyLookup.set(`${historyTable}:${normalizeTrackingValue(row.tracking)}`, row.data);
    });
  }));

  return historyLookup;
}

async function loadTrackingMatchForEntry(entry) {
  const normalizedTracking = normalizeTrackingValue(entry.tracking);
  const trackingLookup = await loadTrackingRowsByNumber([normalizedTracking]);
  const candidates = trackingLookup.get(normalizedTracking) || [];
  return chooseTrackingMatch(entry, candidates);
}

async function loadTrackingMatchesForEntries(entries) {
  if (entries.length === 0) {
    return new Map();
  }

  const trackingNumbers = Array.from(new Set(
    entries
      .map((entry) => normalizeTrackingValue(entry.tracking))
      .filter(Boolean)
  ));
  const trackingLookup = await loadTrackingRowsByNumber(trackingNumbers);
  const matchLookup = new Map();

  entries.forEach((entry) => {
    const candidates = trackingLookup.get(normalizeTrackingValue(entry.tracking)) || [];
    matchLookup.set(Number(entry.id), chooseTrackingMatch(entry, candidates));
  });

  return matchLookup;
}

async function listGroups() {
  const [groups, cachedCounts] = await Promise.all([
    TrackingMonitorGroup.findAll({
      order: [['createdAt', 'DESC']],
      raw: true,
    }),
    TrackingMonitorEntry.findAll({
      attributes: [
        'groupId',
        [fn('SUM', literal('CASE WHEN cachedAt > 0 THEN 1 ELSE 0 END')), 'cachedEntryCount'],
        [
          fn(
            'SUM',
            literal(`CASE WHEN cachedAt > 0 AND cachedDeliveryOutcome = '${DELIVERY_OUTCOME.DESTINATION}' THEN 1 ELSE 0 END`)
          ),
          'destinationDeliveredEntryCount',
        ],
        [
          fn(
            'SUM',
            literal(`CASE WHEN cachedAt > 0 AND cachedDeliveryOutcome = '${DELIVERY_OUTCOME.RETURN}' THEN 1 ELSE 0 END`)
          ),
          'returnDeliveredEntryCount',
        ],
      ],
      group: ['groupId'],
      raw: true,
    }),
  ]);

  const groupSummaryLookup = new Map();
  cachedCounts.forEach((row) => {
    groupSummaryLookup.set(Number(row.groupId), {
      cachedEntryCount: Number(row.cachedEntryCount || 0),
      destinationDeliveredEntryCount: Number(row.destinationDeliveredEntryCount || 0),
      returnDeliveredEntryCount: Number(row.returnDeliveredEntryCount || 0),
    });
  });

  return groups.map((group) => {
    const entryCount = Number(group.entryCount || 0);
    const groupSummary = groupSummaryLookup.get(Number(group.id)) || {};
    const destinationDeliveredEntryCount = Number(groupSummary.destinationDeliveredEntryCount || 0);
    const returnDeliveredEntryCount = Number(groupSummary.returnDeliveredEntryCount || 0);

    return {
      ...group,
      entryCount,
      lastViewedAt: toTimestamp(group.lastViewedAt),
      cachedEntryCount: Number(groupSummary.cachedEntryCount || 0),
      // Match the compare page by treating every unresolved entry as still in transit here.
      inTransitEntryCount: Math.max(entryCount - destinationDeliveredEntryCount - returnDeliveredEntryCount, 0),
    };
  });
}

async function createGroup({ label, note, trackingInput, trackingUpload }) {
  const normalizedLabel = typeof label === 'string' ? label.trim() : '';
  const normalizedNote = typeof note === 'string' ? note.trim() : '';
  const trackingNumbers = parseTrackingInput(trackingInput, trackingUpload);

  if (!normalizedLabel) {
    throw createError('Group label is required.');
  }

  if (trackingNumbers.length === 0) {
    throw createError('At least one tracking number is required.');
  }

  const now = Date.now();
  const group = await TrackingMonitorGroup.create({
    label: normalizedLabel,
    note: normalizedNote,
    entryCount: trackingNumbers.length,
  });

  await TrackingMonitorEntry.bulkCreate(trackingNumbers.map((tracking) => ({
    groupId: group.id,
    tracking,
    addeddate: now,
  })));

  return {
    group,
    trackingNumbers,
  };
}

async function getGroup(groupId) {
  const group = await TrackingMonitorGroup.findByPk(groupId, { raw: true });
  if (!group) {
    throw createError('Tracking monitor group not found.', 404);
  }
  return group;
}

function buildGroupPayload(group) {
  return {
    ...group.get({ plain: true }),
    entryCount: Number(group.get('entryCount') || 0),
    lastViewedAt: toTimestamp(group.get('lastViewedAt')),
  };
}

async function buildGroupReport(group, rows, options = {}) {
  const summary = buildReportSummary(rows);
  if (Number.isInteger(options.cacheWriteEntries) && options.cacheWriteEntries >= 0) {
    summary.cacheWriteEntries = options.cacheWriteEntries;
  }

  const methodStats = buildMethodStats(rows);
  await group.update({ lastViewedAt: Date.now() });

  return {
    group: buildGroupPayload(group),
    summary,
    methodStats,
    rows,
    usedCachedSnapshot: options.usedCachedSnapshot === true,
  };
}

async function syncGroupEntryCount(group) {
  const remainingCount = await TrackingMonitorEntry.count({
    where: { groupId: group.id },
  });
  await group.update({ entryCount: remainingCount });
  return remainingCount;
}

async function getGroupReport(groupId, options = {}) {
  const group = await TrackingMonitorGroup.findByPk(groupId);
  if (!group) {
    throw createError('Tracking monitor group not found.', 404);
  }

  const entries = await TrackingMonitorEntry.findAll({
    where: { groupId: group.id },
    order: [['createdAt', 'ASC'], ['tracking', 'ASC']],
  });

  if (options.useCachedSnapshot === true && hasFullCacheCoverage(entries)) {
    const rows = entries
      .map((entry) => buildRowFromCache(entry, null))
      .sort((left, right) => left.tracking.localeCompare(right.tracking));

    return buildGroupReport(group, rows, {
      cacheWriteEntries: 0,
      usedCachedSnapshot: true,
    });
  }

  const trackingNumbers = Array.from(new Set(entries.map((entry) => normalizeTrackingValue(entry.tracking))));
  const trackingLookup = await loadTrackingRowsByNumber(trackingNumbers);

  const deliveredToAnalyze = [];
  const prebuiltRows = [];
  const cacheWrites = [];

  entries.forEach((entry) => {
    const candidates = trackingLookup.get(normalizeTrackingValue(entry.tracking)) || [];
    const match = chooseTrackingMatch(entry, candidates);

    if (hasUsableManualOverride(entry)) {
      prebuiltRows.push(buildRowFromCache(entry, match));
      return;
    }

    if (!match.row) {
      prebuiltRows.push(buildLiveRow(entry, match));
      cacheWrites.push(entry.update(buildLiveCachePayload(match)));
      return;
    }

    if (hasUsableDeliveredCache(entry, match.row)) {
      prebuiltRows.push(buildRowFromCache(entry, match));
      return;
    }

    if (isDeliveredTrackingRow(match.row)) {
      deliveredToAnalyze.push({ entry, match });
      return;
    }

    prebuiltRows.push(buildLiveRow(entry, match));
    cacheWrites.push(entry.update(buildLiveCachePayload(match)));
  });

  const historyLookup = await loadHistoryRows(
    deliveredToAnalyze.filter(({ match }) => !isDhlRow(match.row))
  );

  const deliveredRows = deliveredToAnalyze.map(({ entry, match }) => {
    const historyTable = isDhlRow(match.row) ? null : getTrackhistIndex(match.row.shippeddate);
    const rawHistory = historyTable === null
      ? null
      : historyLookup.get(`${historyTable}:${normalizeTrackingValue(match.row.tracking)}`) || null;

    const analysis = analyzeDeliveredShipment(match.row, rawHistory);
    const cachePayload = buildCachePayload(entry, match, analysis);
    cacheWrites.push(entry.update(cachePayload));

    return buildDeliveredRow(entry, match, analysis);
  });

  if (cacheWrites.length > 0) {
    await Promise.all(cacheWrites);
  }

  const rows = [...prebuiltRows, ...deliveredRows].sort((left, right) => left.tracking.localeCompare(right.tracking));

  return buildGroupReport(group, rows, {
    cacheWriteEntries: cacheWrites.length,
    usedCachedSnapshot: false,
  });
}

function buildGroupComparisonReport(group, entries, selectionIndex, liveMatchLookup) {
  const comparisonRows = entries.map((entry) => buildComparisonRow(
    entry,
    liveMatchLookup.get(Number(entry.id)) || null
  ));
  const comparisonSummary = buildReportSummary(comparisonRows);
  const totalEntries = entries.length;
  const cachedEntryCount = entries.filter((entry) => hasCachedSnapshot(entry)).length;
  const uncachedEntryCount = Math.max(totalEntries - cachedEntryCount, 0);

  const summary = {
    ...comparisonSummary,
    totalEntries,
    cachedEntryCount,
    uncachedEntryCount,
    cachedCoveragePercent: totalEntries > 0
      ? roundPercentage((cachedEntryCount / totalEntries) * 100)
      : 0,
    chart: buildOutcomeMix(comparisonSummary),
  };

  const methodStats = buildMethodStats(comparisonRows)
    .filter((stat) => stat.grouplabel !== null)
    .map((stat) => ({
      ...stat,
      chart: buildOutcomeMix(stat),
    }));

  return {
    id: Number(group.id),
    label: group.label,
    note: group.note || '',
    createdAt: group.createdAt,
    lastViewedAt: toTimestamp(group.lastViewedAt),
    selectionIndex,
    summary,
    methodStats,
  };
}

function buildComparisonSummary(groupReports) {
  const summary = {
    groupCount: groupReports.length,
    totalEntries: 0,
    cachedEntryCount: 0,
    uncachedEntryCount: 0,
    deliveredEntries: 0,
    destinationDeliveredEntries: 0,
    returnDeliveredEntries: 0,
    otherCountryDeliveredEntries: 0,
    deliveryLocationUnknownEntries: 0,
    inTransitEntries: 0,
    noTrackingMatchEntries: 0,
    totalTransitDays: 0,
    transitDayCount: 0,
  };

  groupReports.forEach((groupReport) => {
    const groupSummary = groupReport.summary;
    summary.totalEntries += Number(groupSummary.totalEntries || 0);
    summary.cachedEntryCount += Number(groupSummary.cachedEntryCount || 0);
    summary.uncachedEntryCount += Number(groupSummary.uncachedEntryCount || 0);
    summary.deliveredEntries += Number(groupSummary.deliveredEntries || 0);
    summary.destinationDeliveredEntries += Number(groupSummary.destinationDeliveredEntries || 0);
    summary.returnDeliveredEntries += Number(groupSummary.returnDeliveredEntries || 0);
    summary.otherCountryDeliveredEntries += Number(groupSummary.otherCountryDeliveredEntries || 0);
    summary.deliveryLocationUnknownEntries += Number(groupSummary.deliveryLocationUnknownEntries || 0);
    summary.inTransitEntries += Number(groupSummary.inTransitEntries || 0);
    summary.noTrackingMatchEntries += Number(groupSummary.noTrackingMatchEntries || 0);
    summary.totalTransitDays += Number(groupSummary.totalTransitDays || 0);
    summary.transitDayCount += Number(groupSummary.transitDayCount || 0);
  });

  return {
    ...summary,
    cachedCoveragePercent: summary.totalEntries > 0
      ? roundPercentage((summary.cachedEntryCount / summary.totalEntries) * 100)
      : 0,
    averageTransitDays: summary.transitDayCount > 0
      ? Math.round((summary.totalTransitDays / summary.transitDayCount) * 10) / 10
      : null,
    chart: buildOutcomeMix(summary),
  };
}

function buildMethodComparisonSections(groupReports) {
  const sections = new Map();

  groupReports.forEach((groupReport) => {
    groupReport.methodStats.forEach((stat) => {
      const key = String(stat.grouplabel);
      if (!sections.has(key)) {
        sections.set(key, {
          grouplabel: stat.grouplabel,
          shippingMethodName: stat.shippingMethodName,
          points: [],
        });
      }

      sections.get(key).points.push({
        groupId: groupReport.id,
        groupLabel: groupReport.label,
        selectionIndex: groupReport.selectionIndex,
        totalEntries: stat.totalEntries,
        summary: stat,
      });
    });
  });

  return Array.from(sections.values())
    .sort((left, right) => Number(left.grouplabel) - Number(right.grouplabel))
    .map((section) => ({
      ...section,
      points: section.points.sort((left, right) => left.selectionIndex - right.selectionIndex),
    }));
}

async function getGroupComparisonReport(rawGroupIds) {
  const groupIds = normalizeGroupIdList(rawGroupIds);
  if (groupIds.length < 2) {
    throw createError('Select at least two monitor groups to compare.', 400);
  }

  const [groups, entries] = await Promise.all([
    TrackingMonitorGroup.findAll({
      where: { id: groupIds },
      raw: true,
    }),
    TrackingMonitorEntry.findAll({
      where: { groupId: groupIds },
      order: [['groupId', 'ASC'], ['createdAt', 'ASC'], ['tracking', 'ASC']],
      raw: true,
    }),
  ]);

  const groupLookup = new Map(groups.map((group) => [Number(group.id), group]));
  const missingGroupIds = groupIds.filter((groupId) => !groupLookup.has(Number(groupId)));
  if (missingGroupIds.length > 0) {
    throw createError('One or more selected monitor groups no longer exist.', 404);
  }

  const entriesByGroupId = new Map(groupIds.map((groupId) => [Number(groupId), []]));
  entries.forEach((entry) => {
    const groupId = Number(entry.groupId);
    if (!entriesByGroupId.has(groupId)) {
      entriesByGroupId.set(groupId, []);
    }
    entriesByGroupId.get(groupId).push(entry);
  });

  const liveMatchLookup = await loadComparisonLiveMatches(entries);

  const groupReports = groupIds.map((groupId, index) => buildGroupComparisonReport(
    groupLookup.get(Number(groupId)),
    entriesByGroupId.get(Number(groupId)) || [],
    index + 1,
    liveMatchLookup
  ));

  return {
    selectedGroupIds: groupIds,
    groups: groupReports,
    summary: buildComparisonSummary(groupReports),
    methodSections: buildMethodComparisonSections(groupReports),
    uncachedGroups: groupReports
      .filter((groupReport) => groupReport.summary.uncachedEntryCount > 0)
      .map((groupReport) => ({
        id: groupReport.id,
        label: groupReport.label,
        uncachedEntryCount: groupReport.summary.uncachedEntryCount,
        totalEntries: groupReport.summary.totalEntries,
      })),
  };
}

async function setManualOutcome(groupId, entryId, deliveryOutcome) {
  const normalizedOutcome = typeof deliveryOutcome === 'string'
    ? deliveryOutcome.trim()
    : '';

  if (!MANUAL_OVERRIDE_OUTCOMES.has(normalizedOutcome)) {
    throw createError('Invalid manual outcome.', 400);
  }

  const group = await getGroup(groupId);
  const entry = await TrackingMonitorEntry.findOne({
    where: {
      id: entryId,
      groupId: group.id,
    },
  });

  if (!entry) {
    throw createError('Tracking monitor entry not found.', 404);
  }

  const match = await loadTrackingMatchForEntry(entry);
  if (!canSetManualOutcome(entry, match)) {
    throw createError('Manual outcome can only be set for in-transit or no-source-row entries.', 400);
  }

  await entry.update(buildManualOverridePayload(match, normalizedOutcome));

  return {
    groupId: group.id,
    entryId: entry.id,
    deliveryOutcome: normalizedOutcome,
  };
}

function hasCachedNoTrackingMatch(entry) {
  return Boolean(
    hasCachedSnapshot(entry)
    && entry.cachedDeliveryOutcome === DELIVERY_OUTCOME.NO_MATCH
  );
}

function hasCachedUnmatchedEntry(entry) {
  return Boolean(
    hasCachedSnapshot(entry)
    && Number(entry.cachedTrackingId || 0) === 0
  );
}

async function deleteEntriesAndSyncGroup(group, entryIds) {
  if (entryIds.length === 0) {
    await syncGroupEntryCount(group);
    return 0;
  }

  const deletedCount = await TrackingMonitorEntry.destroy({
    where: {
      groupId: group.id,
      id: entryIds,
    },
  });
  await syncGroupEntryCount(group);
  return deletedCount;
}

async function deleteEntry(groupId, entryId, options = {}) {
  const group = await TrackingMonitorGroup.findByPk(groupId);
  if (!group) {
    throw createError('Tracking monitor group not found.', 404);
  }

  const entry = await TrackingMonitorEntry.findOne({
    where: {
      id: entryId,
      groupId: group.id,
    },
  });

  if (!entry) {
    throw createError('Tracking monitor entry not found.', 404);
  }

  if (options.useCachedStatus === true) {
    if (!hasCachedUnmatchedEntry(entry)) {
      throw createError('Delete is only available for entries without a cached tracking match.', 400);
    }
  } else {
    const match = await loadTrackingMatchForEntry(entry);
    if (!canDeleteEntry(entry, match)) {
      throw createError('Delete is only available for no-source-row entries.', 400);
    }
  }

  await deleteEntriesAndSyncGroup(group, [Number(entry.id)]);

  return {
    groupId: group.id,
    entryId: entry.id,
  };
}

async function deleteNoMatchEntries(groupId, options = {}) {
  const group = await TrackingMonitorGroup.findByPk(groupId);
  if (!group) {
    throw createError('Tracking monitor group not found.', 404);
  }

  const entries = await TrackingMonitorEntry.findAll({
    where: { groupId: group.id },
  });

  let entryIds = [];

  if (options.useCachedStatus === true) {
    entryIds = entries
      .filter((entry) => hasCachedNoTrackingMatch(entry))
      .map((entry) => Number(entry.id));
  } else {
    const matchLookup = await loadTrackingMatchesForEntries(entries);

    entries.forEach((entry) => {
      if (hasUsableManualOverride(entry)) {
        return;
      }

      const match = matchLookup.get(Number(entry.id));
      if (!match?.row) {
        entryIds.push(Number(entry.id));
      }
    });
  }

  const deletedCount = await deleteEntriesAndSyncGroup(group, entryIds);

  return {
    groupId: group.id,
    deletedCount,
  };
}

module.exports = {
  SHIPPING_METHOD_GROUPS,
  DELIVERY_OUTCOME,
  DELIVERY_OUTCOME_LABELS,
  normalizeTrackingValue,
  toTimestamp,
  isDeliveredTrackingRow,
  isDhlRow,
  formatShippingMethodName,
  canonicalizeCountry,
  analyzeDeliveredShipment,
  getTrackhistIndex,
  normalizeGroupIdList,
  listGroups,
  listShortcuts,
  createGroup,
  createShortcut,
  getGroup,
  getGroupReport,
  getGroupComparisonReport,
  getShortcutComparisonReport,
  updateShortcutSelection,
  renameShortcut,
  deleteShortcut,
  setManualOutcome,
  deleteEntry,
  deleteNoMatchEntries,
};
