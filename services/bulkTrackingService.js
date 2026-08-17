'use strict';

const {
  sequelize_tracker,
  BulkTrackingGroup,
  BulkTrackingEntry,
  BulkTrackingAnalyticsCache,
  Tracking,
  Trackhist0,
  Trackhist1,
  Trackhist2,
  Trackhist3,
  Trackhist4,
  Op,
  fn,
  literal,
} = require('../sequelize');
const analytics = require('./bulkTrackingAnalytics');

const CACHE_TTL_MS = 12 * 60 * 60 * 1000;
const CACHE_SCHEMA_VERSION = 2;
const MAX_TRACKING_NUMBERS_PER_GROUP = 10000;
const MAX_TRACKING_UPLOAD_BYTES = 2 * 1024 * 1024;
const QUERY_CHUNK_SIZE = 750;
const TRACKHIST_MODELS = [Trackhist0, Trackhist1, Trackhist2, Trackhist3, Trackhist4];
const refreshPromises = new Map();

function createError(message, status = 400) {
  const error = new Error(message);
  error.status = status;
  return error;
}

function normalizeTracking(value) {
  if (typeof value !== 'string') {
    return '';
  }
  return value
    .replace(/^\uFEFF/, '')
    .replace(/^['"]+|['"]+$/g, '')
    .trim()
    .toUpperCase();
}

function parseTrackingInput(rawText, uploadFile) {
  const chunks = [];
  if (typeof rawText === 'string' && rawText.trim()) {
    chunks.push(rawText);
  }
  if (uploadFile && uploadFile.data) {
    if (uploadFile.data.length > MAX_TRACKING_UPLOAD_BYTES) {
      throw createError('The tracking number file must be 2 MB or smaller.');
    }
    chunks.push(uploadFile.data.toString('utf8'));
  }

  const values = [];
  const seen = new Set();
  chunks.forEach((chunk) => {
    String(chunk).replace(/\r/g, '\n').split('\n').forEach((line) => {
      const trimmed = line.trim();
      if (!trimmed) {
        return;
      }

      const normalizedLine = normalizeTracking(trimmed);
      if (normalizedLine === 'TRACKING NUMBER' || normalizedLine === 'TRACKINGNUMBER') {
        return;
      }

      const candidates = /[,;\t]/.test(trimmed)
        ? [trimmed.split(/[,;\t]/)[0]]
        : trimmed.split(/\s+/);
      candidates.forEach((candidate) => {
        const tracking = normalizeTracking(candidate);
        if (
          !tracking
          || tracking === 'TRACKING'
          || tracking === 'TRACKINGNUMBER'
          || tracking === 'TRACKING NUMBER'
        ) {
          return;
        }
        if (tracking.length > 255) {
          throw createError('A tracking number exceeds the 255-character database limit.');
        }
        if (!seen.has(tracking)) {
          seen.add(tracking);
          values.push(tracking);
        }
      });
    });
  });

  if (values.length > MAX_TRACKING_NUMBERS_PER_GROUP) {
    throw createError(`A group can contain at most ${MAX_TRACKING_NUMBERS_PER_GROUP.toLocaleString()} tracking numbers.`);
  }
  return values;
}

function normalizeId(value) {
  const id = Number(value);
  if (!Number.isInteger(id) || id <= 0) {
    throw createError('Invalid bulk tracking group.', 400);
  }
  return id;
}

function toPlain(model) {
  return model && typeof model.get === 'function' ? model.get({ plain: true }) : model;
}

function parseJson(value, fallback = null) {
  if (typeof value !== 'string' || !value) {
    return fallback;
  }
  try {
    return JSON.parse(value);
  } catch (_error) {
    return fallback;
  }
}

function chunkValues(values, size = QUERY_CHUNK_SIZE) {
  const chunks = [];
  for (let index = 0; index < values.length; index += size) {
    chunks.push(values.slice(index, index + size));
  }
  return chunks;
}

async function findRowsInChunks(model, trackingNumbers, options = {}) {
  if (trackingNumbers.length === 0) {
    return [];
  }
  const rows = await Promise.all(chunkValues(trackingNumbers).map((trackingChunk) => model.findAll({
    ...options,
    where: {
      ...(options.where || {}),
      tracking: trackingChunk,
    },
    raw: true,
  })));
  return rows.flat();
}

function sortTrackingRows(left, right) {
  const addedDifference = analytics.toTimestamp(right.addeddate) - analytics.toTimestamp(left.addeddate);
  if (addedDifference !== 0) {
    return addedDifference;
  }
  const shippedDifference = analytics.toTimestamp(right.shippeddate) - analytics.toTimestamp(left.shippeddate);
  if (shippedDifference !== 0) {
    return shippedDifference;
  }
  return Number(right.id || 0) - Number(left.id || 0);
}

function chooseTrackingMatch(entry, candidates) {
  const sorted = [...candidates].sort(sortTrackingRows);
  if (sorted.length === 0) {
    return { row: null, matchCount: 0, matchSelectionReason: 'no_match' };
  }
  if (sorted.length === 1) {
    return { row: sorted[0], matchCount: 1, matchSelectionReason: 'single_match' };
  }

  const membershipTimestamp = analytics.toTimestamp(entry.addedAt);
  const priorRows = sorted.filter(
    (row) => analytics.toTimestamp(row.addeddate) <= membershipTimestamp
  );
  if (priorRows.length > 0) {
    return {
      row: priorRows[0],
      matchCount: sorted.length,
      matchSelectionReason: 'newest_match_before_group_entry',
    };
  }

  return {
    row: sorted[0],
    matchCount: sorted.length,
    matchSelectionReason: 'newest_available_match',
  };
}

function getHistoryTableIndex(shippeddate) {
  const timestamp = analytics.toTimestamp(shippeddate);
  if (!timestamp) {
    return null;
  }
  return new Date(timestamp).getFullYear() % TRACKHIST_MODELS.length;
}

async function loadHistoryLookup(matches) {
  const trackingByTable = new Map();
  matches.forEach((match) => {
    if (!match.row) {
      return;
    }
    const tableIndex = getHistoryTableIndex(match.row.shippeddate);
    if (tableIndex === null) {
      return;
    }
    if (!trackingByTable.has(tableIndex)) {
      trackingByTable.set(tableIndex, new Set());
    }
    trackingByTable.get(tableIndex).add(normalizeTracking(match.row.tracking));
  });

  const lookup = new Map();
  await Promise.all(Array.from(trackingByTable.entries()).map(async ([tableIndex, trackingSet]) => {
    const model = TRACKHIST_MODELS[tableIndex];
    const rows = await findRowsInChunks(model, Array.from(trackingSet), {
      attributes: ['tracking', 'data'],
    });
    rows.forEach((row) => {
      lookup.set(`${tableIndex}:${normalizeTracking(row.tracking)}`, row.data);
    });
  }));
  return lookup;
}

async function loadAnalyticsSources(groupId) {
  const entries = await BulkTrackingEntry.findAll({
    where: { groupId },
    order: [['createdAt', 'ASC'], ['tracking', 'ASC']],
    raw: true,
  });
  const trackingNumbers = Array.from(new Set(entries.map((entry) => normalizeTracking(entry.tracking))));
  const trackingRows = await findRowsInChunks(Tracking, trackingNumbers, {
    attributes: [
      'id',
      'tracking',
      'carrier',
      'country',
      'addeddate',
      'lastchecked',
      'status',
      'shippeddate',
      'delivereddate',
      'delivered',
      'grouplabel',
    ],
  });
  const rowLookup = new Map();
  trackingRows.forEach((row) => {
    const tracking = normalizeTracking(row.tracking);
    if (!rowLookup.has(tracking)) {
      rowLookup.set(tracking, []);
    }
    rowLookup.get(tracking).push(row);
  });

  const matches = entries.map((entry) => chooseTrackingMatch(
    entry,
    rowLookup.get(normalizeTracking(entry.tracking)) || []
  ));
  const historyLookup = await loadHistoryLookup(matches);

  return entries.map((entry, index) => {
    const match = matches[index];
    const tableIndex = match.row ? getHistoryTableIndex(match.row.shippeddate) : null;
    const history = tableIndex === null || !match.row
      ? null
      : historyLookup.get(`${tableIndex}:${normalizeTracking(match.row.tracking)}`) || null;
    return {
      entry,
      row: match.row,
      history,
      matchCount: match.matchCount,
      matchSelectionReason: match.matchSelectionReason,
    };
  });
}

function isCacheStale(cache, now = Date.now()) {
  if (!cache) {
    return true;
  }
  const generatedAt = analytics.toTimestamp(cache.generatedAt);
  return Number(cache.schemaVersion) !== CACHE_SCHEMA_VERSION
    || generatedAt <= 0
    || now - generatedAt > CACHE_TTL_MS;
}

async function refreshGroupCacheNow(groupId) {
  const group = await BulkTrackingGroup.findByPk(groupId, { raw: true });
  if (!group) {
    throw createError('Bulk tracking group not found.', 404);
  }
  if (analytics.toTimestamp(group.archivedAt) > 0) {
    throw createError('Archived groups are intentionally excluded from cache refreshes.', 400);
  }

  const sources = await loadAnalyticsSources(Number(group.id));
  const report = analytics.buildAnalyticsReport(sources);
  report.group = {
    id: Number(group.id),
    name: group.name,
    explanation: group.explanation || '',
    createdBy: group.createdBy || '',
    createdAt: group.createdAt,
    archivedAt: analytics.toTimestamp(group.archivedAt),
    archiveReason: group.archiveReason || '',
  };

  await BulkTrackingAnalyticsCache.upsert({
    groupId: Number(group.id),
    generatedAt: report.generatedAt,
    schemaVersion: CACHE_SCHEMA_VERSION,
    summaryJson: JSON.stringify(report.summary),
    reportJson: JSON.stringify(report),
  });

  return report;
}

async function refreshGroupCache(groupId) {
  const normalizedGroupId = normalizeId(groupId);
  if (refreshPromises.has(normalizedGroupId)) {
    return refreshPromises.get(normalizedGroupId);
  }

  const promise = refreshGroupCacheNow(normalizedGroupId)
    .finally(() => refreshPromises.delete(normalizedGroupId));
  refreshPromises.set(normalizedGroupId, promise);
  return promise;
}

async function mapWithConcurrency(values, concurrency, callback) {
  const results = new Array(values.length);
  let nextIndex = 0;

  async function worker() {
    while (nextIndex < values.length) {
      const index = nextIndex;
      nextIndex += 1;
      results[index] = await callback(values[index], index);
    }
  }

  await Promise.all(Array.from(
    { length: Math.min(concurrency, values.length) },
    () => worker()
  ));
  return results;
}

async function loadEntryCountLookup(groupIds) {
  if (groupIds.length === 0) {
    return new Map();
  }
  const rows = await BulkTrackingEntry.findAll({
    attributes: [
      'groupId',
      [fn('COUNT', literal('*')), 'entryCount'],
    ],
    where: { groupId: groupIds },
    group: ['groupId'],
    raw: true,
  });
  return new Map(rows.map((row) => [Number(row.groupId), Number(row.entryCount || 0)]));
}

async function loadGroupCards(archived) {
  const groups = await BulkTrackingGroup.findAll({
    where: archived
      ? { archivedAt: { [Op.gt]: 0 } }
      : { archivedAt: 0 },
    order: archived
      ? [['archivedAt', 'DESC'], ['createdAt', 'DESC']]
      : [['createdAt', 'DESC']],
    raw: true,
  });
  const groupIds = groups.map((group) => Number(group.id));
  const [caches, entryCountLookup] = await Promise.all([
    groupIds.length > 0
      ? BulkTrackingAnalyticsCache.findAll({
        attributes: ['groupId', 'generatedAt', 'schemaVersion', 'summaryJson'],
        where: { groupId: groupIds },
        raw: true,
      })
      : [],
    loadEntryCountLookup(groupIds),
  ]);
  const cacheLookup = new Map(caches.map((cache) => [Number(cache.groupId), cache]));
  const now = Date.now();

  return groups.map((group) => {
    const cache = cacheLookup.get(Number(group.id)) || null;
    const parsedSummary = cache ? parseJson(cache.summaryJson, null) : null;
    const summary = parsedSummary || {};
    return {
      ...group,
      id: Number(group.id),
      archivedAt: analytics.toTimestamp(group.archivedAt),
      cacheGeneratedAt: cache ? analytics.toTimestamp(cache.generatedAt) : 0,
      cacheStale: isCacheStale(cache, now),
      hasCache: Boolean(cache && parsedSummary),
      entryCount: entryCountLookup.get(Number(group.id)) || 0,
      summary: summary || {},
    };
  });
}

async function autoArchiveCompletedGroups(cards) {
  const now = Date.now();
  const eligibleCards = cards.filter((card) => (
    card.summary
    && card.summary.allDelivered === true
    && analytics.toTimestamp(card.summary.autoArchiveEligibleAt) > 0
    && analytics.toTimestamp(card.summary.autoArchiveEligibleAt) <= now
  ));

  await Promise.all(eligibleCards.map((card) => BulkTrackingGroup.update({
    archivedAt: now,
    archiveReason: 'automatic',
  }, {
    where: {
      id: card.id,
      archivedAt: 0,
    },
  })));

  return eligibleCards.map((card) => card.id);
}

async function prepareLanding() {
  const initialCards = await loadGroupCards(false);
  const staleCards = initialCards.filter((card) => card.cacheStale);
  const refreshErrors = [];

  await mapWithConcurrency(staleCards, 2, async (card) => {
    try {
      await refreshGroupCache(card.id);
    } catch (error) {
      refreshErrors.push({
        groupId: card.id,
        groupName: card.name,
        message: error.message || 'Cache refresh failed.',
      });
    }
  });

  const refreshedCards = await loadGroupCards(false);
  const refreshFailedIds = new Set(refreshErrors.map((error) => error.groupId));
  const autoArchivedGroupIds = await autoArchiveCompletedGroups(
    refreshedCards.filter((card) => !refreshFailedIds.has(card.id))
  );
  const groups = autoArchivedGroupIds.length > 0
    ? await loadGroupCards(false)
    : refreshedCards;
  const archivedCount = await BulkTrackingGroup.count({
    where: { archivedAt: { [Op.gt]: 0 } },
  });

  return {
    groups,
    archivedCount,
    refreshedGroupIds: staleCards
      .map((card) => card.id)
      .filter((groupId) => !refreshErrors.some((error) => error.groupId === groupId)),
    autoArchivedGroupIds,
    refreshErrors,
  };
}

async function createGroup({ name, explanation, trackingInput, trackingUpload, userId }) {
  const normalizedName = typeof name === 'string' ? name.trim() : '';
  const normalizedExplanation = typeof explanation === 'string' ? explanation.trim() : '';
  const trackingNumbers = parseTrackingInput(trackingInput, trackingUpload);
  if (!normalizedName) {
    throw createError('A group name is required.');
  }
  if (normalizedName.length > 120) {
    throw createError('The group name must be 120 characters or fewer.');
  }
  if (normalizedExplanation.length > 5000) {
    throw createError('The group explanation must be 5,000 characters or fewer.');
  }
  if (trackingNumbers.length === 0) {
    throw createError('Add at least one tracking number or upload a text/CSV file.');
  }

  const now = Date.now();
  return sequelize_tracker.transaction(async (transaction) => {
    const group = await BulkTrackingGroup.create({
      name: normalizedName,
      explanation: normalizedExplanation,
      createdBy: String(userId || ''),
      archivedAt: 0,
      archiveReason: '',
      lastMembershipChangeAt: now,
    }, { transaction });
    await BulkTrackingEntry.bulkCreate(trackingNumbers.map((tracking) => ({
      groupId: group.id,
      tracking,
      addedAt: now,
      addedBy: String(userId || ''),
    })), { transaction });
    return {
      group: toPlain(group),
      addedCount: trackingNumbers.length,
    };
  });
}

async function findGroup(groupId, options = {}) {
  const id = normalizeId(groupId);
  const group = await BulkTrackingGroup.findByPk(id, options);
  if (!group) {
    throw createError('Bulk tracking group not found.', 404);
  }
  return group;
}

async function appendTrackingNumbers(groupId, { trackingInput, trackingUpload, userId }) {
  const group = await findGroup(groupId);
  if (analytics.toTimestamp(group.archivedAt) > 0) {
    throw createError('Restore this group before adding more tracking numbers.');
  }

  const trackingNumbers = parseTrackingInput(trackingInput, trackingUpload);
  if (trackingNumbers.length === 0) {
    throw createError('Add at least one tracking number or upload a text/CSV file.');
  }

  const existingRows = await findRowsInChunks(BulkTrackingEntry, trackingNumbers, {
    attributes: ['tracking'],
    where: { groupId: group.id },
  });
  const existing = new Set(existingRows.map((entry) => normalizeTracking(entry.tracking)));
  const newTrackingNumbers = trackingNumbers.filter((tracking) => !existing.has(tracking));
  if (newTrackingNumbers.length === 0) {
    throw createError('All submitted tracking numbers already belong to this group.');
  }

  const currentEntryCount = await BulkTrackingEntry.count({ where: { groupId: group.id } });
  if (currentEntryCount + newTrackingNumbers.length > MAX_TRACKING_NUMBERS_PER_GROUP) {
    throw createError(`A group can contain at most ${MAX_TRACKING_NUMBERS_PER_GROUP.toLocaleString()} tracking numbers.`);
  }

  const now = Date.now();
  await sequelize_tracker.transaction(async (transaction) => {
    await BulkTrackingEntry.bulkCreate(newTrackingNumbers.map((tracking) => ({
      groupId: group.id,
      tracking,
      addedAt: now,
      addedBy: String(userId || ''),
    })), { transaction });
    await group.update({ lastMembershipChangeAt: now }, { transaction });
    await BulkTrackingAnalyticsCache.destroy({
      where: { groupId: group.id },
      transaction,
    });
  });

  return {
    groupId: Number(group.id),
    addedCount: newTrackingNumbers.length,
    duplicateCount: trackingNumbers.length - newTrackingNumbers.length,
  };
}

async function archiveGroup(groupId) {
  const group = await findGroup(groupId);
  if (analytics.toTimestamp(group.archivedAt) <= 0) {
    await group.update({
      archivedAt: Date.now(),
      archiveReason: 'manual',
    });
  }
  return toPlain(group);
}

async function restoreGroup(groupId) {
  const group = await findGroup(groupId);
  await sequelize_tracker.transaction(async (transaction) => {
    await group.update({
      archivedAt: 0,
      archiveReason: '',
    }, { transaction });
    await BulkTrackingAnalyticsCache.update({ generatedAt: 0 }, {
      where: { groupId: group.id },
      transaction,
    });
  });
  return toPlain(group);
}

async function getDashboard(groupId) {
  const group = toPlain(await findGroup(groupId));
  const cache = await BulkTrackingAnalyticsCache.findOne({
    where: { groupId: group.id },
    raw: true,
  });

  if (!cache) {
    return {
      group: {
        ...group,
        archivedAt: analytics.toTimestamp(group.archivedAt),
      },
      report: null,
      needsLandingRefresh: analytics.toTimestamp(group.archivedAt) <= 0,
      cacheStale: true,
    };
  }

  const report = parseJson(cache.reportJson, null);
  if (!report) {
    return {
      group,
      report: null,
      needsLandingRefresh: analytics.toTimestamp(group.archivedAt) <= 0,
      cacheStale: true,
    };
  }

  report.group = {
    ...(report.group || {}),
    id: Number(group.id),
    name: group.name,
    explanation: group.explanation || '',
    archivedAt: analytics.toTimestamp(group.archivedAt),
    archiveReason: group.archiveReason || '',
  };

  return {
    group: report.group,
    report,
    needsLandingRefresh: false,
    cacheStale: isCacheStale(cache),
  };
}

async function listArchivedGroups() {
  return loadGroupCards(true);
}

module.exports = {
  CACHE_TTL_MS,
  CACHE_SCHEMA_VERSION,
  normalizeTracking,
  parseTrackingInput,
  isCacheStale,
  prepareLanding,
  listArchivedGroups,
  createGroup,
  appendTrackingNumbers,
  archiveGroup,
  restoreGroup,
  getDashboard,
  refreshGroupCache,
};
