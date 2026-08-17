'use strict';

const DAY_MS = 24 * 60 * 60 * 1000;
const MAX_PATTERN_STAGES = 9;

const SHIPPING_METHODS = Object.freeze({
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
});

const KNOWN_STAGE_RANK = Object.freeze({
  accepted: 10,
  dispatched: 20,
  outbound_customs: 30,
  arrival_destination: 40,
  inbound_customs: 50,
  customs_processing: 55,
  customs_released: 60,
  in_transit: 70,
  available_pickup: 80,
  delivery_attempt: 85,
  out_for_delivery: 90,
  delivered: 100,
  returned: 100,
});

function toTimestamp(value) {
  if (value instanceof Date) {
    const timestamp = value.getTime();
    return Number.isFinite(timestamp) ? timestamp : 0;
  }

  if (typeof value === 'number' || (typeof value === 'string' && /^\d+(\.\d+)?$/.test(value.trim()))) {
    const numeric = Number(value);
    if (!Number.isFinite(numeric) || numeric <= 0) {
      return 0;
    }
    if (numeric >= 1000000000 && numeric < 100000000000) {
      return numeric * 1000;
    }
    return numeric;
  }

  if (typeof value === 'string' && value.trim()) {
    const parsed = Date.parse(value.trim());
    return Number.isFinite(parsed) ? parsed : 0;
  }

  return 0;
}

function isTruthyDatabaseBoolean(value) {
  return value === true || value === 1 || value === '1';
}

function isDeliveredRow(row) {
  return Boolean(row && (isTruthyDatabaseBoolean(row.delivered) || toTimestamp(row.delivereddate) > 0));
}

function round(value, digits = 1) {
  if (!Number.isFinite(value)) {
    return null;
  }
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

function quantile(sortedValues, percentile) {
  if (sortedValues.length === 0) {
    return null;
  }
  if (sortedValues.length === 1) {
    return sortedValues[0];
  }

  const index = (sortedValues.length - 1) * percentile;
  const lowerIndex = Math.floor(index);
  const upperIndex = Math.ceil(index);
  if (lowerIndex === upperIndex) {
    return sortedValues[lowerIndex];
  }

  const weight = index - lowerIndex;
  return sortedValues[lowerIndex] * (1 - weight) + sortedValues[upperIndex] * weight;
}

function distributionStats(values) {
  const sorted = values
    .map(Number)
    .filter((value) => Number.isFinite(value) && value >= 0)
    .sort((left, right) => left - right);

  if (sorted.length === 0) {
    return {
      sampleSize: 0,
      min: null,
      max: null,
      average: null,
      median: null,
      p25: null,
      p75: null,
      p90: null,
      outlierHigh: null,
    };
  }

  const p25 = quantile(sorted, 0.25);
  const p75 = quantile(sorted, 0.75);
  const p90 = quantile(sorted, 0.90);
  const interquartileRange = p75 - p25;

  return {
    sampleSize: sorted.length,
    min: round(sorted[0]),
    max: round(sorted[sorted.length - 1]),
    average: round(sorted.reduce((total, value) => total + value, 0) / sorted.length),
    median: round(quantile(sorted, 0.5)),
    p25: round(p25),
    p75: round(p75),
    p90: round(p90),
    outlierHigh: round(Math.max(p90, p75 + 1.5 * interquartileRange)),
  };
}

function calculateDelayThreshold(stats) {
  if (!stats || stats.sampleSize === 0 || stats.median === null) {
    return null;
  }

  if (stats.sampleSize < 3) {
    return round(Math.max(stats.median * 1.5, stats.median + 3, 7));
  }

  return round(Math.max(
    stats.p90 || 0,
    stats.outlierHigh || 0,
    (stats.median || 0) * 1.25,
    1
  ));
}

function safeJsonParse(value) {
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

function findHistoryEvents(payload, depth = 0) {
  if (!payload || depth > 4) {
    return [];
  }
  if (Array.isArray(payload)) {
    return payload;
  }
  if (typeof payload !== 'object') {
    return [];
  }

  const directArrayKeys = ['events', 'history', 'updates', 'checkpoints', 'activities', 'scans'];
  for (const key of directArrayKeys) {
    if (Array.isArray(payload[key])) {
      return payload[key];
    }
  }

  if (Array.isArray(payload.shipments)) {
    const shipmentEvents = payload.shipments.flatMap((shipment) => findHistoryEvents(shipment, depth + 1));
    if (shipmentEvents.length > 0) {
      return shipmentEvents;
    }
  }

  const nestedKeys = ['data', 'result', 'response', 'tracking', 'trackingDetails', 'shipment'];
  for (const key of nestedKeys) {
    if (payload[key]) {
      const events = findHistoryEvents(payload[key], depth + 1);
      if (events.length > 0) {
        return events;
      }
    }
  }

  return [];
}

function firstTextValue(values) {
  for (const value of values) {
    if (typeof value === 'string' && value.trim()) {
      return value.trim();
    }
    if (value && typeof value === 'object') {
      const nested = firstTextValue([value.description, value.label, value.name, value.status]);
      if (nested) {
        return nested;
      }
    }
  }
  return '';
}

function collectLocationParts(value, parts, depth = 0) {
  if (!value || depth > 3) {
    return;
  }
  if (typeof value === 'string') {
    if (value.trim()) {
      parts.push(value.trim());
    }
    return;
  }
  if (Array.isArray(value)) {
    value.forEach((item) => collectLocationParts(item, parts, depth + 1));
    return;
  }
  if (typeof value !== 'object') {
    return;
  }

  [
    'name', 'location', 'country', 'countryCode', 'office', 'city', 'state',
    'province', 'prefecture', 'region', 'facility', 'branch', 'address',
    'addressLocality', 'postalCode', 'postcode',
  ].forEach((key) => {
    if (Object.prototype.hasOwnProperty.call(value, key)) {
      collectLocationParts(value[key], parts, depth + 1);
    }
  });
}

function extractLocation(event) {
  const parts = [];
  [
    event.location, event.activityLocation, event.address, event.country,
    event.office, event.city, event.state, event.province, event.facility,
  ].forEach((value) => collectLocationParts(value, parts));

  return Array.from(new Set(parts)).join(' · ');
}

function extractDescription(event) {
  return firstTextValue([
    event.description,
    event.desciption,
    event.statusDescription,
    event.status,
    event.event,
    event.activity,
    event.message,
    event.remark,
    event.details,
    event.type,
  ]);
}

function normalizeDescription(value) {
  return String(value || '')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function titleCase(value) {
  return String(value || '')
    .split(' ')
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

function canonicalizeEvent(description) {
  const normalized = normalizeDescription(description);
  if (!normalized) {
    return { key: 'unknown_update', label: 'Other update', known: false };
  }

  const patterns = [
    ['returned', 'Returned', /(return(ed|ing)? (to|back)|return.*(sender|shipper)|sent back|undeliverable)/],
    ['out_for_delivery', 'Out for delivery', /(out for delivery|with delivery courier|delivery today)/],
    ['delivery_attempt', 'Delivery attempt', /(delivery attempt|attempted delivery|could not be delivered|recipient absent|addressee absent)/],
    ['available_pickup', 'Available for pickup', /(available for (pick ?up|collection)|ready for (pick ?up|collection)|awaiting collection)/],
    ['delivered', 'Delivered', /(^| )(delivered|delivery completed|final delivery|signed for|handed to recipient|pickup completed|pick up completed)( |$)/],
    ['customs_released', 'Released from customs', /(released from customs|customs.*released|clearance (processing )?complete|cleared customs|import clearance success|customs clearance finished)/],
    ['inbound_customs', 'Inbound customs', /(inbound customs|import customs|inward office of exchange|presented to import customs|held by import customs|arrival at customs in destination)/],
    ['outbound_customs', 'Outbound customs', /(outbound customs|export customs|outward office of exchange|presented to export customs|held by export customs|export clearance)/],
    ['customs_processing', 'Customs processing', /(customs clearance|customs processing|customs inspection|held at customs|customs status)/],
    ['arrival_destination', 'Arrived in destination country', /(arriv(ed|al) (at|in).*(destination|delivery country)|received at destination|inbound into destination)/],
    ['dispatched', 'Dispatched from origin', /(dispatch|despatch|handed over to airline|depart(ed)? from origin|departure from origin|exported from|flight departure)/],
    ['accepted', 'Accepted by carrier', /(posting collection|acceptance|accepted by|picked up by|shipment (information )?received|collection from sender|item posted)/],
    ['in_transit', 'In transit', /(in transit|transportation|forwarded|processing at|processed at|departed facility|arrived at facility|transfer|linehaul|on the way)/],
  ];

  for (const [key, label, pattern] of patterns) {
    if (pattern.test(normalized)) {
      return { key, label, known: true };
    }
  }

  const compactWords = normalized.split(' ').slice(0, 9).join(' ');
  return {
    key: `event_${compactWords.replace(/\s+/g, '_').slice(0, 72)}`,
    label: titleCase(compactWords).slice(0, 80),
    known: false,
  };
}

function normalizeHistory(rawHistory, row = {}) {
  const payload = safeJsonParse(rawHistory);
  const rawEvents = findHistoryEvents(payload);
  const normalizedEvents = rawEvents.map((event) => {
    const source = event && typeof event === 'object' ? event : {};
    return {
      timestamp: toTimestamp(
        source.timestamp
        || source.datetime
        || source.dateTime
        || source.eventTime
        || source.eventDateTime
        || source.occurredAt
        || source.date
        || source.time
      ),
      description: extractDescription(source),
      location: extractLocation(source),
      synthetic: false,
    };
  }).filter((event) => event.timestamp > 0 || event.description || event.location);

  const statusTimestamp = toTimestamp(row.delivereddate)
    || toTimestamp(row.shippeddate)
    || toTimestamp(row.lastchecked);
  const statusDescription = firstTextValue([row.status]);

  if (statusDescription && normalizedEvents.length === 0) {
    normalizedEvents.push({
      timestamp: statusTimestamp,
      description: statusDescription,
      location: '',
      synthetic: true,
    });
  }

  if (isDeliveredRow(row) && toTimestamp(row.delivereddate) > 0) {
    const hasDeliveryEvent = normalizedEvents.some(
      (event) => event.timestamp > 0 && canonicalizeEvent(event.description).key === 'delivered'
    );
    if (!hasDeliveryEvent) {
      const syntheticDeliveryDescription = /(return|sender|shipper)/i.test(statusDescription)
        ? statusDescription
        : 'Delivered';
      normalizedEvents.push({
        timestamp: toTimestamp(row.delivereddate),
        description: syntheticDeliveryDescription,
        location: row.country || '',
        synthetic: true,
      });
    }
  }

  normalizedEvents.sort((left, right) => {
    if (!left.timestamp && !right.timestamp) {
      return left.description.localeCompare(right.description);
    }
    if (!left.timestamp) {
      return -1;
    }
    if (!right.timestamp) {
      return 1;
    }
    return left.timestamp - right.timestamp;
  });

  const seen = new Set();
  return normalizedEvents.filter((event) => {
    const key = `${event.timestamp}|${normalizeDescription(event.description)}|${normalizeDescription(event.location)}`;
    if (seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  });
}

function buildEventSequence(events) {
  const sequence = [];

  events.forEach((event) => {
    const stage = canonicalizeEvent(event.description);
    const previous = sequence[sequence.length - 1];
    if (previous && previous.key === stage.key) {
      previous.lastTimestamp = Math.max(previous.lastTimestamp, event.timestamp || 0);
      previous.latestDescription = event.description || previous.latestDescription;
      previous.latestLocation = event.location || previous.latestLocation;
      previous.eventCount += 1;
      return;
    }

    sequence.push({
      key: stage.key,
      label: stage.label,
      known: stage.known,
      firstTimestamp: event.timestamp || 0,
      lastTimestamp: event.timestamp || 0,
      latestDescription: event.description || stage.label,
      latestLocation: event.location || '',
      eventCount: 1,
    });
  });

  return sequence;
}

function formatShippingMethod(grouplabel) {
  if (grouplabel === null || grouplabel === undefined || grouplabel === '') {
    return 'No tracking match';
  }
  return SHIPPING_METHODS[grouplabel] || `Unknown method (${grouplabel})`;
}

function alignPattern(patternStages, sequence) {
  const matches = new Array(patternStages.length).fill(null);
  let sequenceIndex = 0;

  patternStages.forEach((stage, patternIndex) => {
    for (let index = sequenceIndex; index < sequence.length; index += 1) {
      if (sequence[index].key === stage.key) {
        matches[patternIndex] = sequence[index];
        sequenceIndex = index + 1;
        break;
      }
    }
  });

  return matches;
}

function stageSort(left, right) {
  const positionDifference = left.averagePosition - right.averagePosition;
  if (Math.abs(positionDifference) > 0.08) {
    return positionDifference;
  }

  const leftRank = KNOWN_STAGE_RANK[left.key];
  const rightRank = KNOWN_STAGE_RANK[right.key];
  if (leftRank !== undefined && rightRank !== undefined && leftRank !== rightRank) {
    return leftRank - rightRank;
  }

  if (left.supportCount !== right.supportCount) {
    return right.supportCount - left.supportCount;
  }
  return left.label.localeCompare(right.label);
}

function detectPattern(shipments) {
  const deliveredCandidates = shipments.filter(
    (shipment) => shipment.delivered && shipment.sequence.length >= 2
  );
  const allCandidates = shipments.filter((shipment) => shipment.sequence.length >= 2);
  const baseline = deliveredCandidates.length >= 2 ? deliveredCandidates : allCandidates;
  const sourceLabel = deliveredCandidates.length >= 2
    ? 'completed shipments'
    : 'all shipments with tracking history';

  if (baseline.length === 0) {
    return {
      stages: [],
      confidencePercent: 0,
      sampleSize: 0,
      sourceLabel,
      minimumSupport: 0,
    };
  }

  const stageLookup = new Map();
  baseline.forEach((shipment) => {
    const seen = new Set();
    const denominator = Math.max(shipment.sequence.length - 1, 1);
    shipment.sequence.forEach((stage, index) => {
      if (seen.has(stage.key)) {
        return;
      }
      seen.add(stage.key);
      if (!stageLookup.has(stage.key)) {
        stageLookup.set(stage.key, {
          key: stage.key,
          label: stage.label,
          known: stage.known,
          supportCount: 0,
          positionTotal: 0,
        });
      }
      const aggregate = stageLookup.get(stage.key);
      aggregate.supportCount += 1;
      aggregate.positionTotal += index / denominator;
    });
  });

  const minimumSupport = baseline.length >= 8
    ? Math.max(3, Math.ceil(baseline.length * 0.4))
    : (baseline.length >= 3 ? 2 : 1);

  let candidates = Array.from(stageLookup.values())
    .filter((stage) => stage.supportCount >= minimumSupport)
    .map((stage) => ({
      ...stage,
      averagePosition: stage.positionTotal / stage.supportCount,
      supportPercent: round((stage.supportCount / baseline.length) * 100),
    }));

  if (candidates.length > MAX_PATTERN_STAGES) {
    const retainedKeys = new Set(candidates
      .sort((left, right) => {
        const leftTerminal = left.key === 'delivered' || left.key === 'returned';
        const rightTerminal = right.key === 'delivered' || right.key === 'returned';
        if (leftTerminal !== rightTerminal) {
          return leftTerminal ? -1 : 1;
        }
        if (left.known !== right.known) {
          return left.known ? -1 : 1;
        }
        return right.supportCount - left.supportCount;
      })
      .slice(0, MAX_PATTERN_STAGES)
      .map((stage) => stage.key));
    candidates = candidates.filter((stage) => retainedKeys.has(stage.key));
  }

  candidates.sort(stageSort);
  const confidencePercent = candidates.length > 0
    ? round(candidates.reduce((total, stage) => total + stage.supportPercent, 0) / candidates.length)
    : 0;

  return {
    stages: candidates.map((stage, index) => ({
      key: stage.key,
      label: stage.label,
      index,
      supportCount: stage.supportCount,
      supportPercent: stage.supportPercent,
    })),
    confidencePercent,
    sampleSize: baseline.length,
    sourceLabel,
    minimumSupport,
  };
}

function buildTransitionStats(pattern, shipments) {
  const transitions = [];

  for (let index = 0; index < pattern.stages.length - 1; index += 1) {
    const durations = [];
    shipments.forEach((shipment) => {
      const matches = alignPattern(pattern.stages, shipment.sequence);
      const from = matches[index];
      const to = matches[index + 1];
      if (!from || !to || !from.firstTimestamp || !to.firstTimestamp) {
        return;
      }
      const days = (to.firstTimestamp - from.firstTimestamp) / DAY_MS;
      if (days >= 0 && days <= 730) {
        durations.push(days);
      }
    });

    const stats = distributionStats(durations);
    transitions.push({
      index,
      fromKey: pattern.stages[index].key,
      fromLabel: pattern.stages[index].label,
      toKey: pattern.stages[index + 1].key,
      toLabel: pattern.stages[index + 1].label,
      ...stats,
      delayThreshold: calculateDelayThreshold(stats),
    });
  }

  return transitions;
}

function buildUpdateGapStats(shipments) {
  const gaps = [];
  shipments.forEach((shipment) => {
    const timestamps = Array.from(new Set(
      shipment.events.map((event) => event.timestamp).filter((timestamp) => timestamp > 0)
    )).sort((left, right) => left - right);
    for (let index = 1; index < timestamps.length; index += 1) {
      const days = (timestamps[index] - timestamps[index - 1]) / DAY_MS;
      if (days > 0 && days <= 180) {
        gaps.push(days);
      }
    }
  });
  const stats = distributionStats(gaps);
  return {
    ...stats,
    delayThreshold: calculateDelayThreshold(stats),
  };
}

function predictionConfidence(sampleSize) {
  if (sampleSize >= 8) {
    return 'high';
  }
  if (sampleSize >= 3) {
    return 'medium';
  }
  return 'low';
}

function buildPrediction(shipment, matches, pattern, transitions, updateGapStats, now) {
  if (shipment.delivered) {
    return null;
  }

  let currentPatternIndex = -1;
  matches.forEach((match, index) => {
    if (match) {
      currentPatternIndex = index;
    }
  });

  if (currentPatternIndex >= 0 && currentPatternIndex < pattern.stages.length - 1) {
    const transition = transitions[currentPatternIndex];
    const currentMatch = matches[currentPatternIndex];
    if (transition && transition.sampleSize > 0 && currentMatch.lastTimestamp > 0) {
      const baseTimestamp = currentMatch.lastTimestamp;
      const overdueAt = transition.delayThreshold === null
        ? 0
        : baseTimestamp + transition.delayThreshold * DAY_MS;
      return {
        kind: 'pattern_transition',
        fromStage: transition.fromLabel,
        nextStage: transition.toLabel,
        estimateAt: baseTimestamp + transition.median * DAY_MS,
        rangeStartAt: baseTimestamp + transition.p25 * DAY_MS,
        rangeEndAt: baseTimestamp + transition.p75 * DAY_MS,
        overdueAt,
        overdue: overdueAt > 0 && now > overdueAt,
        overdueDays: overdueAt > 0 && now > overdueAt ? Math.ceil((now - overdueAt) / DAY_MS) : 0,
        confidence: predictionConfidence(transition.sampleSize),
        sampleSize: transition.sampleSize,
      };
    }
  }

  const latestEvent = shipment.events
    .filter((event) => event.timestamp > 0)
    .slice(-1)[0];
  if (latestEvent && updateGapStats.sampleSize > 0) {
    const overdueAt = updateGapStats.delayThreshold === null
      ? 0
      : latestEvent.timestamp + updateGapStats.delayThreshold * DAY_MS;
    return {
      kind: 'typical_update_gap',
      fromStage: canonicalizeEvent(latestEvent.description).label,
      nextStage: 'Next carrier update',
      estimateAt: latestEvent.timestamp + updateGapStats.median * DAY_MS,
      rangeStartAt: latestEvent.timestamp + updateGapStats.p25 * DAY_MS,
      rangeEndAt: latestEvent.timestamp + updateGapStats.p75 * DAY_MS,
      overdueAt,
      overdue: overdueAt > 0 && now > overdueAt,
      overdueDays: overdueAt > 0 && now > overdueAt ? Math.ceil((now - overdueAt) / DAY_MS) : 0,
      confidence: predictionConfidence(updateGapStats.sampleSize),
      sampleSize: updateGapStats.sampleSize,
    };
  }

  return null;
}

function prepareShipment(source, now) {
  const row = source.row || null;
  const events = normalizeHistory(source.history, row || {});
  const sequence = buildEventSequence(events);
  const delivered = isDeliveredRow(row);
  const shippedAt = toTimestamp(row && row.shippeddate);
  const deliveredAt = delivered ? toTimestamp(row && row.delivereddate) : 0;
  const durationEnd = delivered ? deliveredAt : now;
  const daysInShipment = shippedAt > 0 && durationEnd > 0 && durationEnd >= shippedAt
    ? (durationEnd - shippedAt) / DAY_MS
    : null;

  return {
    entryId: Number(source.entry.id),
    tracking: String(source.entry.tracking || ''),
    matched: Boolean(row),
    matchCount: Number(source.matchCount || 0),
    matchSelectionReason: source.matchSelectionReason || '',
    row,
    events,
    hasCarrierHistory: events.some((event) => event.synthetic !== true && event.timestamp > 0),
    sequence,
    delivered,
    shippedAt,
    deliveredAt,
    daysInShipment,
    country: row && row.country ? String(row.country) : '',
    status: row && row.status ? String(row.status) : (row ? 'No status' : 'No tracking match'),
    grouplabel: row && row.grouplabel !== null && row.grouplabel !== undefined
      ? Number(row.grouplabel)
      : null,
    methodName: formatShippingMethod(row ? row.grouplabel : null),
  };
}

function addFlag(flags, id, severity, title, detail) {
  if (flags.some((flag) => flag.id === id)) {
    return;
  }
  flags.push({ id, severity, title, detail });
}

function analyzeShipment(shipment, methodAnalysis, now) {
  const { pattern, transitions, updateGapStats, durationStats } = methodAnalysis;
  const matches = alignPattern(pattern.stages, shipment.sequence);
  let currentPatternIndex = -1;
  matches.forEach((match, index) => {
    if (match) {
      currentPatternIndex = index;
    }
  });

  const patternKeys = new Set(pattern.stages.map((stage) => stage.key));
  const missingStages = pattern.stages
    .filter((stage, index) => index < currentPatternIndex && !matches[index])
    .map((stage) => stage.label);
  const extraStages = Array.from(new Map(
    shipment.sequence
      .filter((stage) => !patternKeys.has(stage.key))
      .map((stage) => [stage.key, stage.label])
  ).values());

  const timestampedEvents = shipment.events.filter((event) => event.timestamp > 0);
  const latestEvent = timestampedEvents.length > 0
    ? timestampedEvents[timestampedEvents.length - 1]
    : (shipment.events[shipment.events.length - 1] || null);
  const latestStage = latestEvent ? canonicalizeEvent(latestEvent.description) : null;
  const prediction = buildPrediction(
    shipment,
    matches,
    pattern,
    transitions,
    updateGapStats,
    now
  );
  const flags = [];

  if (!shipment.matched) {
    addFlag(
      flags,
      'no_tracking_match',
      'warning',
      'No tracking database match',
      'This number is in the group but has no matching row in the tracking table.'
    );
  } else if (!shipment.hasCarrierHistory) {
    addFlag(
      flags,
      'no_history',
      'warning',
      'No usable tracking history',
      'The tracking row exists, but no timestamped carrier update could be read.'
    );
  }

  if (!shipment.delivered && /(exception|failed|held|undeliverable|return|customs issue|clearance delay)/i.test(shipment.status)) {
    addFlag(
      flags,
      'carrier_exception',
      'warning',
      'Carrier status needs review',
      `Current carrier status: ${shipment.status}`
    );
  }

  if (prediction && prediction.overdue) {
    addFlag(
      flags,
      'overdue_next_update',
      prediction.overdueDays >= 7 ? 'critical' : 'warning',
      `Overdue for ${prediction.nextStage.toLowerCase()}`,
      `${prediction.overdueDays} day${prediction.overdueDays === 1 ? '' : 's'} beyond the method-specific upper timing threshold.`
    );
  }

  if (missingStages.length > 0) {
    addFlag(
      flags,
      'missing_pattern_stages',
      'info',
      'Pattern stages not recorded',
      `Carrier history skipped ${missingStages.join(', ')} before the current observed stage.`
    );
  }

  if (
    shipment.daysInShipment !== null
    && durationStats.sampleSize >= 3
    && durationStats.outlierHigh !== null
    && shipment.daysInShipment > durationStats.outlierHigh
  ) {
    addFlag(
      flags,
      shipment.delivered ? 'slow_delivery' : 'long_active_transit',
      shipment.delivered ? 'info' : 'warning',
      shipment.delivered ? 'Unusually long delivery' : 'Longer than normal in shipment',
      `${round(shipment.daysInShipment)} days versus a ${durationStats.p90}-day 90th percentile for delivered shipments using this method.`
    );
  }

  transitions.forEach((transition, index) => {
    const from = matches[index];
    const to = matches[index + 1];
    if (!from || !to || transition.sampleSize < 3 || transition.outlierHigh === null) {
      return;
    }
    const transitionDays = (to.firstTimestamp - from.firstTimestamp) / DAY_MS;
    if (transitionDays > transition.outlierHigh) {
      addFlag(
        flags,
        `slow_transition_${index}`,
        'info',
        `Slow ${transition.fromLabel} → ${transition.toLabel}`,
        `${round(transitionDays)} days versus a typical ${transition.p25}–${transition.p75} days.`
      );
    }
  });

  const primarySeverity = flags.some((flag) => flag.severity === 'critical')
    ? 'critical'
    : (flags.some((flag) => flag.severity === 'warning') ? 'warning' : 'normal');
  const statusBucket = !shipment.matched
    ? 'no_match'
    : (shipment.delivered ? 'delivered' : (primarySeverity === 'normal' ? 'in_transit' : 'attention'));

  return {
    entryId: shipment.entryId,
    tracking: shipment.tracking,
    matched: shipment.matched,
    hasCarrierHistory: shipment.hasCarrierHistory,
    matchCount: shipment.matchCount,
    matchSelectionReason: shipment.matchSelectionReason,
    grouplabel: shipment.grouplabel,
    methodName: shipment.methodName,
    country: shipment.country || 'Unknown',
    carrier: shipment.row && shipment.row.carrier ? String(shipment.row.carrier) : '',
    status: shipment.status,
    delivered: shipment.delivered,
    shippedAt: shipment.shippedAt,
    deliveredAt: shipment.deliveredAt,
    daysInShipment: shipment.daysInShipment === null ? null : round(shipment.daysInShipment),
    latestUpdate: latestEvent ? {
      timestamp: latestEvent.timestamp,
      description: latestEvent.description || (latestStage && latestStage.label) || 'Carrier update',
      location: latestEvent.location || '',
      stage: latestStage ? latestStage.label : 'Other update',
    } : null,
    currentPatternStage: currentPatternIndex >= 0 ? pattern.stages[currentPatternIndex].label : null,
    patternProgress: pattern.stages.length > 0 && currentPatternIndex >= 0
      ? round(((currentPatternIndex + 1) / pattern.stages.length) * 100)
      : 0,
    missingStages,
    extraStages,
    prediction,
    flags,
    severity: primarySeverity,
    statusBucket,
    recentEvents: shipment.events.slice(-5).reverse().map((event) => ({
      timestamp: event.timestamp,
      description: event.description || 'Carrier update',
      location: event.location || '',
    })),
  };
}

function analyzeMethod(shipments, now) {
  const pattern = detectPattern(shipments);
  const transitions = buildTransitionStats(pattern, shipments);
  const updateGapStats = buildUpdateGapStats(shipments);
  const deliveredDurations = shipments
    .filter((shipment) => shipment.delivered && shipment.daysInShipment !== null)
    .map((shipment) => shipment.daysInShipment);
  const durationStats = distributionStats(deliveredDurations);
  const analysis = { pattern, transitions, updateGapStats, durationStats };
  const shipmentReports = shipments.map((shipment) => analyzeShipment(shipment, analysis, now));

  const stageFunnel = pattern.stages.map((stage, index) => {
    const reachedCount = shipments.filter((shipment) => {
      const matches = alignPattern(pattern.stages, shipment.sequence);
      return Boolean(matches[index]);
    }).length;
    return {
      key: stage.key,
      label: stage.label,
      reachedCount,
      reachedPercent: shipments.length > 0 ? round((reachedCount / shipments.length) * 100) : 0,
    };
  });

  return {
    pattern,
    transitions,
    updateGapStats,
    durationStats,
    stageFunnel,
    shipmentReports,
  };
}

function addCalendarMonth(timestamp) {
  if (!timestamp) {
    return 0;
  }
  const date = new Date(timestamp);
  const originalDay = date.getUTCDate();
  date.setUTCDate(1);
  date.setUTCMonth(date.getUTCMonth() + 1);
  const daysInTargetMonth = new Date(Date.UTC(
    date.getUTCFullYear(),
    date.getUTCMonth() + 1,
    0
  )).getUTCDate();
  date.setUTCDate(Math.min(originalDay, daysInTargetMonth));
  return date.getTime();
}

function buildAnalyticsReport(sources, options = {}) {
  const now = toTimestamp(options.now) || Date.now();
  const preparedShipments = sources.map((source) => prepareShipment(source, now));
  const groupsByMethod = new Map();

  preparedShipments.forEach((shipment) => {
    const methodKey = shipment.grouplabel === null ? 'unmatched' : String(shipment.grouplabel);
    if (!groupsByMethod.has(methodKey)) {
      groupsByMethod.set(methodKey, []);
    }
    groupsByMethod.get(methodKey).push(shipment);
  });

  const methods = [];
  let shipmentReports = [];
  Array.from(groupsByMethod.entries()).forEach(([methodKey, shipments]) => {
    const methodAnalysis = analyzeMethod(shipments, now);
    shipmentReports = shipmentReports.concat(methodAnalysis.shipmentReports);
    const deliveredCount = shipments.filter((shipment) => shipment.delivered).length;
    const warningCount = methodAnalysis.shipmentReports.filter(
      (shipment) => shipment.severity === 'warning' || shipment.severity === 'critical'
    ).length;

    methods.push({
      id: methodKey,
      grouplabel: methodKey === 'unmatched' ? null : Number(methodKey),
      name: shipments[0].methodName,
      shipmentCount: shipments.length,
      deliveredCount,
      inTransitCount: shipments.length - deliveredCount,
      deliveryRate: shipments.length > 0 ? round((deliveredCount / shipments.length) * 100) : 0,
      attentionCount: warningCount,
      durationStats: methodAnalysis.durationStats,
      updateGapStats: methodAnalysis.updateGapStats,
      pattern: methodAnalysis.pattern,
      transitions: methodAnalysis.transitions,
      stageFunnel: methodAnalysis.stageFunnel,
    });
  });

  methods.sort((left, right) => {
    if (left.grouplabel === null) {
      return 1;
    }
    if (right.grouplabel === null) {
      return -1;
    }
    return right.shipmentCount - left.shipmentCount || left.name.localeCompare(right.name);
  });

  const severityRank = { critical: 0, warning: 1, normal: 2 };
  shipmentReports.sort((left, right) => {
    if (severityRank[left.severity] !== severityRank[right.severity]) {
      return severityRank[left.severity] - severityRank[right.severity];
    }
    if (left.delivered !== right.delivered) {
      return left.delivered ? 1 : -1;
    }
    const leftTimestamp = left.latestUpdate ? left.latestUpdate.timestamp : 0;
    const rightTimestamp = right.latestUpdate ? right.latestUpdate.timestamp : 0;
    return leftTimestamp - rightTimestamp || left.tracking.localeCompare(right.tracking);
  });

  const shipmentCount = shipmentReports.length;
  const matchedCount = shipmentReports.filter((shipment) => shipment.matched).length;
  const deliveredCount = shipmentReports.filter((shipment) => shipment.delivered).length;
  const attentionShipments = shipmentReports.filter(
    (shipment) => shipment.severity === 'warning' || shipment.severity === 'critical'
  );
  const deliveredDays = shipmentReports
    .filter((shipment) => shipment.delivered && shipment.daysInShipment !== null)
    .map((shipment) => shipment.daysInShipment);
  const allShipmentDays = shipmentReports
    .filter((shipment) => shipment.daysInShipment !== null)
    .map((shipment) => shipment.daysInShipment);
  const activeDays = shipmentReports
    .filter((shipment) => !shipment.delivered && shipment.daysInShipment !== null)
    .map((shipment) => shipment.daysInShipment);
  const deliveredStats = distributionStats(deliveredDays);
  const allShipmentStats = distributionStats(allShipmentDays);
  const activeStats = distributionStats(activeDays);
  const lastDeliveredAt = shipmentReports.reduce(
    (latest, shipment) => Math.max(latest, shipment.deliveredAt || 0),
    0
  );
  const allDelivered = shipmentCount > 0 && deliveredCount === shipmentCount;

  const statusMix = [
    {
      key: 'delivered',
      label: 'Delivered',
      count: shipmentReports.filter((shipment) => shipment.statusBucket === 'delivered').length,
    },
    {
      key: 'in_transit',
      label: 'In transit',
      count: shipmentReports.filter((shipment) => shipment.statusBucket === 'in_transit').length,
    },
    {
      key: 'attention',
      label: 'Needs attention',
      count: shipmentReports.filter((shipment) => shipment.statusBucket === 'attention').length,
    },
    {
      key: 'no_match',
      label: 'No match',
      count: shipmentReports.filter((shipment) => shipment.statusBucket === 'no_match').length,
    },
  ];

  const countries = new Map();
  shipmentReports.forEach((shipment) => {
    const country = shipment.country || 'Unknown';
    countries.set(country, (countries.get(country) || 0) + 1);
  });
  const countryDistribution = Array.from(countries.entries())
    .map(([country, count]) => ({ country, count }))
    .sort((left, right) => right.count - left.count || left.country.localeCompare(right.country));

  const summary = {
    shipmentCount,
    matchedCount,
    noMatchCount: shipmentCount - matchedCount,
    deliveredCount,
    inTransitCount: shipmentCount - deliveredCount,
    deliveryRate: shipmentCount > 0 ? round((deliveredCount / shipmentCount) * 100) : 0,
    attentionCount: attentionShipments.length,
    criticalCount: attentionShipments.filter((shipment) => shipment.severity === 'critical').length,
    methodCount: methods.filter((method) => method.grouplabel !== null).length,
    countryCount: countryDistribution.length,
    averageDaysInShipment: allShipmentStats.average,
    medianDaysInShipment: allShipmentStats.median,
    averageDeliveredDays: deliveredStats.average,
    medianDeliveredDays: deliveredStats.median,
    p90DeliveredDays: deliveredStats.p90,
    averageActiveDays: activeStats.average,
    lastDeliveredAt,
    allDelivered,
    autoArchiveEligibleAt: allDelivered ? addCalendarMonth(lastDeliveredAt) : 0,
    historyCoverageCount: shipmentReports.filter((shipment) => shipment.hasCarrierHistory).length,
  };

  return {
    generatedAt: now,
    summary,
    statusMix,
    deliveredDurationStats: deliveredStats,
    countryDistribution,
    methods,
    attention: attentionShipments.map((shipment) => ({
      entryId: shipment.entryId,
      tracking: shipment.tracking,
      methodName: shipment.methodName,
      country: shipment.country,
      status: shipment.status,
      latestUpdate: shipment.latestUpdate,
      prediction: shipment.prediction,
      severity: shipment.severity,
      flags: shipment.flags.filter((flag) => flag.severity !== 'info'),
    })),
    shipments: shipmentReports,
    algorithm: {
      version: 1,
      description: 'Carrier descriptions are normalized into comparable stages. Common stages are ordered by their observed position in completed shipments when available, then transition timing uses robust quartiles and 90th-percentile thresholds.',
      maximumPatternStages: MAX_PATTERN_STAGES,
    },
  };
}

module.exports = {
  DAY_MS,
  SHIPPING_METHODS,
  toTimestamp,
  isDeliveredRow,
  distributionStats,
  canonicalizeEvent,
  normalizeHistory,
  buildEventSequence,
  detectPattern,
  buildAnalyticsReport,
  addCalendarMonth,
};
