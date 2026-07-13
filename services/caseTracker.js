const { ct, Op } = require('../sequelize');

const REQUIRED_FIELD_DEFINITIONS = [
  { key: 'customer_id', label: 'Customer ID' },
  { key: 'customer_complaint_comment', label: 'Complaint comment' },
  { key: 'shipping_method', label: 'Shipping method' },
  { key: 'shipping_date', label: 'Shipping date' },
  { key: 'defect_items', label: 'Defect items and descriptions' },
];
const REQUIRED_FIELD_KEYS = REQUIRED_FIELD_DEFINITIONS.map((field) => field.key);
const PLACEHOLDER_ITEM = {
  itemCode: 'ITEM-NOT-CONFIRMED',
  description: 'Customer has not confirmed which item is defective yet.',
  placeholder: true,
};
const MAX_DEFECT_ITEMS = 25;
const DAY_IN_MILLISECONDS = 24 * 60 * 60 * 1000;
const MONTH_NAMES = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];
const UNCLASSIFIED_COMPLAINT = 'Unclassified';
const MISSING_SHIPPING_METHOD = 'Not recorded';

function sanitizeText(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function emptyToNull(value) {
  const sanitized = sanitizeText(value);
  return sanitized || null;
}

function todayDate() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function normalizeDate(value) {
  const sanitized = sanitizeText(value);
  if (!sanitized || !/^\d{4}-\d{2}-\d{2}$/.test(sanitized)) {
    return null;
  }

  const [year, month, day] = sanitized.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  if (Number.isNaN(date.getTime())) {
    return null;
  }

  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) {
    return null;
  }

  return sanitized;
}

function parseDateOnly(value) {
  let sanitized = '';
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    sanitized = [
      value.getUTCFullYear(),
      String(value.getUTCMonth() + 1).padStart(2, '0'),
      String(value.getUTCDate()).padStart(2, '0'),
    ].join('-');
  } else if (typeof value === 'string') {
    sanitized = value.trim().slice(0, 10);
  }

  if (!/^\d{4}-\d{2}-\d{2}$/.test(sanitized)) {
    return null;
  }

  const [year, month, day] = sanitized.split('-').map(Number);
  const timestamp = Date.UTC(year, month - 1, day);
  const date = new Date(timestamp);
  if (
    date.getUTCFullYear() !== year
    || date.getUTCMonth() !== month - 1
    || date.getUTCDate() !== day
  ) {
    return null;
  }

  return {
    day,
    key: sanitized,
    month,
    monthIndex: year * 12 + month - 1,
    timestamp,
    year,
  };
}

function shiftDateByMonths(value, monthOffset) {
  const parsed = parseDateOnly(value);
  if (!parsed) {
    return null;
  }

  const targetMonthIndex = parsed.year * 12 + parsed.month - 1 + monthOffset;
  const targetYear = Math.floor(targetMonthIndex / 12);
  const targetMonth = targetMonthIndex - targetYear * 12;
  const lastDayOfTargetMonth = new Date(Date.UTC(targetYear, targetMonth + 1, 0)).getUTCDate();
  const targetDay = Math.min(parsed.day, lastDayOfTargetMonth);

  return [
    targetYear,
    String(targetMonth + 1).padStart(2, '0'),
    String(targetDay).padStart(2, '0'),
  ].join('-');
}

function buildRecentComplaintWindow(monthCount) {
  const endDate = todayDate();
  return {
    endDate,
    startDate: shiftDateByMonths(endDate, -monthCount),
  };
}

function filterCasesByComplaintWindow(caseRows, window) {
  return caseRows.filter((caseRow) => {
    const complaintDate = parseDateOnly(caseRow.complaint_date);
    return complaintDate
      && complaintDate.key >= window.startDate
      && complaintDate.key <= window.endDate;
  });
}

function roundToOneDecimal(value) {
  return Math.round(value * 10) / 10;
}

function percentage(count, total) {
  return total > 0 ? roundToOneDecimal((count / total) * 100) : 0;
}

function percentile(sortedValues, percentileValue) {
  if (sortedValues.length === 0) {
    return null;
  }

  const position = (sortedValues.length - 1) * percentileValue;
  const lowerIndex = Math.floor(position);
  const upperIndex = Math.ceil(position);
  if (lowerIndex === upperIndex) {
    return sortedValues[lowerIndex];
  }

  const weight = position - lowerIndex;
  return sortedValues[lowerIndex] + (sortedValues[upperIndex] - sortedValues[lowerIndex]) * weight;
}

function withRelativeBarSize(rows) {
  const maximum = rows.reduce((highest, row) => Math.max(highest, row.count), 0);
  return rows.map((row) => ({
    ...row,
    relativePercent: maximum > 0 ? roundToOneDecimal((row.count / maximum) * 100) : 0,
  }));
}

function buildBreakdown(values) {
  const counts = new Map();
  values.forEach((value) => {
    const label = sanitizeText(value) || UNCLASSIFIED_COMPLAINT;
    counts.set(label, (counts.get(label) || 0) + 1);
  });

  const rows = Array.from(counts.entries())
    .map(([label, count]) => ({
      count,
      label,
      percent: percentage(count, values.length),
    }))
    .sort((left, right) => right.count - left.count || left.label.localeCompare(right.label));

  return rows;
}

function buildMonthSeries(caseRows, fieldName) {
  const counts = new Map();
  const parsedDates = [];

  caseRows.forEach((caseRow) => {
    const parsed = parseDateOnly(caseRow[fieldName]);
    if (!parsed) {
      return;
    }

    parsedDates.push(parsed);
    counts.set(parsed.monthIndex, (counts.get(parsed.monthIndex) || 0) + 1);
  });

  if (parsedDates.length === 0) {
    return [];
  }

  const firstMonth = parsedDates.reduce(
    (earliest, date) => Math.min(earliest, date.monthIndex),
    parsedDates[0].monthIndex
  );
  const lastMonth = parsedDates.reduce(
    (latest, date) => Math.max(latest, date.monthIndex),
    parsedDates[0].monthIndex
  );
  const rows = [];

  for (let monthIndex = firstMonth; monthIndex <= lastMonth; monthIndex += 1) {
    const year = Math.floor(monthIndex / 12);
    const month = monthIndex % 12;
    rows.push({
      count: counts.get(monthIndex) || 0,
      key: `${year}-${String(month + 1).padStart(2, '0')}`,
      label: `${MONTH_NAMES[month]} ${year}`,
      shortLabel: `${MONTH_NAMES[month].slice(0, 3)} '${String(year).slice(-2)}`,
    });
  }

  return withRelativeBarSize(rows);
}

function buildDayOfMonthSeries(caseRows) {
  const counts = Array(31).fill(0);
  let datedCases = 0;

  caseRows.forEach((caseRow) => {
    const parsed = parseDateOnly(caseRow.complaint_date);
    if (parsed) {
      counts[parsed.day - 1] += 1;
      datedCases += 1;
    }
  });

  return withRelativeBarSize(counts.map((count, index) => ({
    count,
    day: index + 1,
    label: `Day ${index + 1}`,
    percent: percentage(count, datedCases),
    shortLabel: String(index + 1),
  })));
}

function buildDurationAnalysis(caseRows, startField, endField, buckets) {
  const durations = [];
  let missingCount = 0;
  let invalidOrderCount = 0;

  caseRows.forEach((caseRow) => {
    const startDate = parseDateOnly(caseRow[startField]);
    const endDate = parseDateOnly(caseRow[endField]);
    if (!startDate || !endDate) {
      missingCount += 1;
      return;
    }

    const duration = Math.round((endDate.timestamp - startDate.timestamp) / DAY_IN_MILLISECONDS);
    if (duration < 0) {
      invalidOrderCount += 1;
      return;
    }

    durations.push(duration);
  });

  durations.sort((left, right) => left - right);
  const distribution = buckets.map((bucket) => {
    const count = durations.filter((duration) => duration >= bucket.minimum && duration <= bucket.maximum).length;
    return {
      count,
      label: bucket.label,
      percent: percentage(count, durations.length),
    };
  });

  return {
    average: durations.length > 0
      ? roundToOneDecimal(durations.reduce((total, duration) => total + duration, 0) / durations.length)
      : null,
    distribution,
    invalidOrderCount,
    maximum: durations.length > 0 ? durations[durations.length - 1] : null,
    median: durations.length > 0 ? roundToOneDecimal(percentile(durations, 0.5)) : null,
    minimum: durations.length > 0 ? durations[0] : null,
    missingCount,
    p90: durations.length > 0 ? roundToOneDecimal(percentile(durations, 0.9)) : null,
    sampleSize: durations.length,
  };
}

function buildClaimSolutionMatrix(caseRows) {
  const matrix = new Map();
  const solutionTotals = new Map();

  caseRows.forEach((caseRow) => {
    const complaintType = getEffectiveComplaint(caseRow) || UNCLASSIFIED_COMPLAINT;
    const solution = sanitizeText(caseRow.solution)
      || (parseDateOnly(caseRow.solved_date) ? 'Solution not recorded' : 'Open / no solution');

    if (!matrix.has(complaintType)) {
      matrix.set(complaintType, { cells: new Map(), total: 0 });
    }

    const complaintRow = matrix.get(complaintType);
    complaintRow.total += 1;
    complaintRow.cells.set(solution, (complaintRow.cells.get(solution) || 0) + 1);
    solutionTotals.set(solution, (solutionTotals.get(solution) || 0) + 1);
  });

  const columns = Array.from(solutionTotals.entries())
    .sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]))
    .map(([label, total]) => ({ label, total }));

  const rows = Array.from(matrix.entries())
    .map(([complaintType, row]) => ({
      cells: columns.map((column) => {
        const count = row.cells.get(column.label) || 0;
        return {
          count,
          percent: percentage(count, row.total),
        };
      }),
      complaintType,
      total: row.total,
    }))
    .sort((left, right) => right.total - left.total || left.complaintType.localeCompare(right.complaintType));

  return { columns, rows };
}

function isRealDefectItem(item) {
  return item.itemCode
    && !item.placeholder
    && item.itemCode.toUpperCase() !== PLACEHOLDER_ITEM.itemCode;
}

function buildItemSummary(caseRows) {
  const items = new Map();
  let itemizedCases = 0;

  caseRows.forEach((caseRow, caseIndex) => {
    const itemRows = parseStoredDefectItems(caseRow.defect_items, caseRow.defect_description)
      .filter(isRealDefectItem);
    if (itemRows.length === 0) {
      return;
    }

    itemizedCases += 1;
    const complaintType = getEffectiveComplaint(caseRow) || UNCLASSIFIED_COMPLAINT;
    const complaintDate = parseDateOnly(caseRow.complaint_date);

    itemRows.forEach((item) => {
      const normalizedCode = item.itemCode.toUpperCase();
      if (!items.has(normalizedCode)) {
        items.set(normalizedCode, {
          caseIndexes: new Set(),
          complaintTypes: new Set(),
          itemCode: item.itemCode,
          latestComplaintDate: '',
          occurrenceCount: 0,
        });
      }

      const summary = items.get(normalizedCode);
      summary.caseIndexes.add(caseIndex);
      summary.complaintTypes.add(complaintType);
      summary.occurrenceCount += 1;
      if (complaintDate && complaintDate.key > summary.latestComplaintDate) {
        summary.latestComplaintDate = complaintDate.key;
      }
    });
  });

  const repeatedItems = Array.from(items.values())
    .map((item) => ({
      caseCount: item.caseIndexes.size,
      complaintTypes: Array.from(item.complaintTypes).sort((left, right) => left.localeCompare(right)).join(', '),
      itemCode: item.itemCode,
      latestComplaintDate: item.latestComplaintDate,
      occurrenceCount: item.occurrenceCount,
      url: `/ct/analytics/item/${encodeURIComponent(item.itemCode)}`,
    }))
    .filter((item) => item.caseCount >= 2)
    .sort((left, right) => (
      right.caseCount - left.caseCount
      || right.occurrenceCount - left.occurrenceCount
      || right.latestComplaintDate.localeCompare(left.latestComplaintDate)
      || left.itemCode.localeCompare(right.itemCode)
    ));

  return {
    itemizedCases,
    rows: repeatedItems.slice(0, 25),
    totalRepeatedItems: repeatedItems.length,
  };
}

function buildItemAnalytics(caseRows, requestedItemCode) {
  const normalizedItemCode = sanitizeText(requestedItemCode).toUpperCase();
  if (!normalizedItemCode || normalizedItemCode === PLACEHOLDER_ITEM.itemCode) {
    return null;
  }

  const entries = [];
  const matchingCases = [];

  caseRows.forEach((caseRow) => {
    const matchingItems = parseStoredDefectItems(caseRow.defect_items, caseRow.defect_description)
      .filter((item) => isRealDefectItem(item) && item.itemCode.toUpperCase() === normalizedItemCode);
    if (matchingItems.length === 0) {
      return;
    }

    const complaintDate = parseDateOnly(caseRow.complaint_date);
    const solvedDate = parseDateOnly(caseRow.solved_date);
    const orderNumber = sanitizeText(caseRow.order_number);
    matchingCases.push(caseRow);

    matchingItems.forEach((item) => {
      entries.push({
        caseUrl: `/ct/case/${encodeURIComponent(orderNumber)}`,
        complaintDate: complaintDate ? complaintDate.key : '',
        complaintType: getEffectiveComplaint(caseRow) || UNCLASSIFIED_COMPLAINT,
        description: item.description || 'No description recorded.',
        isOpen: !solvedDate,
        itemCode: item.itemCode,
        orderNumber,
        solution: sanitizeText(caseRow.solution) || (solvedDate ? 'Not recorded' : '—'),
        solvedDate: solvedDate ? solvedDate.key : '',
        status: solvedDate ? 'Solved' : 'Open',
      });
    });
  });

  if (entries.length === 0) {
    return null;
  }

  entries.sort((left, right) => (
    right.complaintDate.localeCompare(left.complaintDate)
    || left.orderNumber.localeCompare(right.orderNumber)
    || left.description.localeCompare(right.description)
  ));

  const complaintTypes = buildBreakdown(matchingCases.map((caseRow) => (
    getEffectiveComplaint(caseRow) || UNCLASSIFIED_COMPLAINT
  )));
  const complaintDates = matchingCases
    .map((caseRow) => parseDateOnly(caseRow.complaint_date))
    .filter(Boolean)
    .sort((left, right) => left.timestamp - right.timestamp);
  const monthlyClaims = buildMonthSeries(matchingCases, 'complaint_date');
  const peakMonth = monthlyClaims.reduce((peak, month) => (
    !peak
    || month.count > peak.count
    || (month.count === peak.count && month.key > peak.key)
      ? month
      : peak
  ), null);
  const peakMonthTieCount = peakMonth
    ? monthlyClaims.filter((month) => month.count === peakMonth.count).length
    : 0;
  const recentWindow = buildRecentComplaintWindow(6);
  const recentCases = filterCasesByComplaintWindow(matchingCases, recentWindow);
  const solvedCaseCount = matchingCases.filter((caseRow) => Boolean(parseDateOnly(caseRow.solved_date))).length;

  return {
    complaintTypes,
    entries,
    itemCode: entries[0].itemCode,
    monthlyClaims,
    recentWindow,
    summary: {
      caseCount: matchingCases.length,
      dateRange: complaintDates.length > 0
        ? `${complaintDates[0].key} – ${complaintDates[complaintDates.length - 1].key}`
        : 'No complaint dates recorded',
      entryCount: entries.length,
      latestComplaintDate: complaintDates.length > 0
        ? complaintDates[complaintDates.length - 1].key
        : '',
      openCaseCount: matchingCases.length - solvedCaseCount,
      peakMonth,
      peakMonthTieCount,
      recentCaseCount: recentCases.length,
      solvedCaseCount,
      solvedRate: percentage(solvedCaseCount, matchingCases.length),
    },
  };
}

function buildRepeatCustomerSummary(caseRows) {
  const customerCounts = new Map();
  caseRows.forEach((caseRow) => {
    const customerId = sanitizeText(caseRow.customer_id);
    if (customerId) {
      customerCounts.set(customerId, (customerCounts.get(customerId) || 0) + 1);
    }
  });

  const repeatCounts = Array.from(customerCounts.values()).filter((count) => count >= 2);
  const repeatCaseCount = repeatCounts.reduce((total, count) => total + count, 0);
  return {
    customerCount: customerCounts.size,
    repeatCaseCount,
    repeatCasePercent: percentage(repeatCaseCount, caseRows.length),
    repeatCustomerCount: repeatCounts.length,
  };
}

function buildShippingComplaintRows(shippingCases) {
  const complaintRows = new Map();

  shippingCases.forEach((caseRow) => {
    const complaintType = getEffectiveComplaint(caseRow) || UNCLASSIFIED_COMPLAINT;
    if (!complaintRows.has(complaintType)) {
      complaintRows.set(complaintType, {
        complaintType,
        methods: new Map(),
        missingDates: 0,
        missingMethods: 0,
        totalCases: 0,
      });
    }

    const summary = complaintRows.get(complaintType);
    const method = sanitizeText(caseRow.shipping_method);
    summary.totalCases += 1;
    if (method) {
      summary.methods.set(method, (summary.methods.get(method) || 0) + 1);
    } else {
      summary.missingMethods += 1;
    }
    if (!parseDateOnly(caseRow.shipping_date)) {
      summary.missingDates += 1;
    }
  });

  return Array.from(complaintRows.values())
    .map((row) => {
      const leadingMethod = Array.from(row.methods.entries())
        .sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]))[0];
      return {
        complaintType: row.complaintType,
        leadingMethod: leadingMethod ? leadingMethod[0] : MISSING_SHIPPING_METHOD,
        leadingMethodCount: leadingMethod ? leadingMethod[1] : 0,
        missingDates: row.missingDates,
        missingMethods: row.missingMethods,
        totalCases: row.totalCases,
      };
    })
    .sort((left, right) => right.totalCases - left.totalCases || left.complaintType.localeCompare(right.complaintType));
}

function buildCoverageRow(label, count, total) {
  return {
    count,
    label,
    percent: percentage(count, total),
    total,
  };
}

function formatDateTime(value) {
  if (!value) {
    return '';
  }

  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) {
    return '';
  }

  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');

  return `${year}-${month}-${day} ${hours}:${minutes}`;
}

function getEffectiveComplaint(caseData) {
  return sanitizeText(caseData.customer_complaint_edit) || sanitizeText(caseData.customer_complaint);
}

function normalizeRequiredFields(value) {
  let values = value;
  if (!Array.isArray(values)) {
    const sanitized = sanitizeText(values);
    if (!sanitized) {
      values = [];
    } else if (sanitized.startsWith('[')) {
      try {
        values = JSON.parse(sanitized);
      } catch (error) {
        values = [];
      }
    } else {
      values = [sanitized];
    }
  }

  if (!Array.isArray(values)) {
    return [];
  }

  return REQUIRED_FIELD_KEYS.filter((key) => values.indexOf(key) >= 0);
}

function toComplaintType(row) {
  const data = row.toJSON ? row.toJSON() : { ...row };
  return {
    ...data,
    requiredFields: normalizeRequiredFields(data.required_fields),
  };
}

function buildComplaintOptions(rows, extraValues) {
  const options = rows.map((row) => toComplaintType(row));
  extraValues.forEach((value) => {
    const sanitized = sanitizeText(value);
    if (sanitized && !options.some((option) => option.name === sanitized)) {
      options.unshift({ name: sanitized, requiredFields: [] });
    }
  });
  return options;
}

function buildValueOptions(rows, extraValues) {
  const values = rows.map((row) => row.name);
  extraValues.forEach((value) => {
    const sanitized = sanitizeText(value);
    if (sanitized && values.indexOf(sanitized) === -1) {
      values.unshift(sanitized);
    }
  });
  return values;
}

function buildRequirements(complaintText, complaintTypes) {
  const complaint = sanitizeText(complaintText);
  const match = complaintTypes.find((row) => row.name === complaint);
  return {
    requiredFields: match ? normalizeRequiredFields(match.required_fields) : [],
  };
}

function normalizeDefectItem(row) {
  if (!row || typeof row !== 'object') {
    return { itemCode: '', description: '', placeholder: false };
  }

  const itemCode = sanitizeText(row.itemCode || row.item_code).slice(0, 255);
  const description = sanitizeText(row.description || row.defect).slice(0, 1000);
  const placeholder = row.placeholder === true && itemCode === PLACEHOLDER_ITEM.itemCode;

  if (placeholder) {
    return { ...PLACEHOLDER_ITEM };
  }

  return { itemCode, description, placeholder: false };
}

function parseLegacyDefectItems(value, legacyDescription) {
  const description = sanitizeText(legacyDescription);
  return sanitizeText(value)
    .split(/[,\n]/)
    .map((itemCode) => sanitizeText(itemCode))
    .filter(Boolean)
    .map((itemCode) => ({ itemCode, description, placeholder: false }));
}

function parseStoredDefectItems(value, legacyDescription) {
  const sanitized = sanitizeText(value);
  if (!sanitized) {
    return [];
  }

  if (sanitized.startsWith('[')) {
    try {
      const parsed = JSON.parse(sanitized);
      if (Array.isArray(parsed)) {
        return parsed.map(normalizeDefectItem).filter((row) => row.itemCode || row.description);
      }
    } catch (error) {
      // Fall through to the legacy comma-separated representation.
    }
  }

  return parseLegacyDefectItems(sanitized, legacyDescription);
}

function parseSubmittedDefectItems(value, legacyDescription) {
  const sanitized = sanitizeText(value);
  if (!sanitized) {
    return { rows: [], errors: [] };
  }

  let submittedRows;
  if (sanitized.startsWith('[')) {
    try {
      submittedRows = JSON.parse(sanitized);
    } catch (error) {
      return { rows: [], errors: ['Defect item data is invalid. Please add the items again.'] };
    }
    if (!Array.isArray(submittedRows)) {
      return { rows: [], errors: ['Defect item data is invalid. Please add the items again.'] };
    }
  } else {
    submittedRows = parseLegacyDefectItems(sanitized, legacyDescription);
  }

  const errors = [];
  let rows = submittedRows.slice(0, MAX_DEFECT_ITEMS).map(normalizeDefectItem);
  if (submittedRows.length > MAX_DEFECT_ITEMS) {
    errors.push(`A case can contain no more than ${MAX_DEFECT_ITEMS} defect items.`);
  }

  rows = rows.filter((row, index) => {
    if (!row.itemCode || !row.description) {
      errors.push(`Defect item ${index + 1} needs both an item code and a description.`);
      return false;
    }
    return true;
  });

  const hasRealItem = rows.some((row) => !row.placeholder);
  if (hasRealItem) {
    rows = rows.filter((row) => !row.placeholder);
  } else if (rows.length > 1) {
    rows = [rows[0]];
  }

  return { rows, errors };
}

function serializeDefectItems(rows) {
  return JSON.stringify(rows.map((row) => ({
    itemCode: row.itemCode,
    description: row.description,
    placeholder: row.placeholder === true,
  })));
}

function buildDefectDescription(rows) {
  return rows.map((row) => `${row.itemCode}: ${row.description}`).join('\n');
}

function hydrateCaseDefectItems(caseData) {
  const rows = parseStoredDefectItems(caseData.defect_items, caseData.defect_description);
  caseData.defect_item_rows = rows;
  caseData.defect_items_json = serializeDefectItems(rows);
  return caseData;
}

function toPlainCase(caseEntry) {
  const data = caseEntry.toJSON ? caseEntry.toJSON() : { ...caseEntry };
  data.customer_id = data.customer_id || '';
  data.customer_complaint = data.customer_complaint || '';
  data.customer_complaint_edit = data.customer_complaint_edit || '';
  data.customer_complaint_comment = data.customer_complaint_comment || '';
  data.shipping_method = data.shipping_method || '';
  data.shipping_date = data.shipping_date || '';
  data.complaint_date = data.complaint_date || '';
  data.defect_items = data.defect_items || '';
  data.defect_description = data.defect_description || '';
  data.solution = data.solution || '';
  data.solved_date = data.solved_date || '';
  data.effective_complaint = getEffectiveComplaint(data);
  data.is_open = !data.solved_date;
  data.created_at_display = formatDateTime(data.createdAt);
  data.updated_at_display = formatDateTime(data.updatedAt);
  return hydrateCaseDefectItems(data);
}

class CaseTrackerService {
  normalizeOrderNumber(orderNumber) {
    return sanitizeText(orderNumber);
  }

  async getLookupRows() {
    const [complaintTypes, solutionTypes, shippingMethods] = await Promise.all([
      ct.ComplaintType.findAll({ order: [['name', 'ASC']] }),
      ct.SolutionType.findAll({ order: [['name', 'ASC']] }),
      ct.ShippingMethod.findAll({ order: [['name', 'ASC']] }),
    ]);

    return { complaintTypes, solutionTypes, shippingMethods };
  }

  async getDashboard() {
    const [openCases, complaintTypes, solutionTypes, totalCases] = await Promise.all([
      ct.Case.findAll({
        where: {
          solved_date: {
            [Op.is]: null,
          },
        },
        order: [['complaint_date', 'ASC'], ['updatedAt', 'ASC']],
      }),
      ct.ComplaintType.findAll({ order: [['name', 'ASC']] }),
      ct.SolutionType.findAll({ order: [['name', 'ASC']] }),
      ct.Case.count(),
    ]);

    return {
      openCases: openCases.map((entry) => toPlainCase(entry)),
      complaintTypes,
      solutionTypes,
      totalCases,
    };
  }

  async openCase(orderNumber) {
    const normalizedOrderNumber = this.normalizeOrderNumber(orderNumber);
    if (!normalizedOrderNumber) {
      throw new Error('Order number is required.');
    }

    let caseEntry;
    let created = false;

    try {
      const result = await ct.Case.findOrCreate({
        where: { order_number: normalizedOrderNumber },
        defaults: {
          order_number: normalizedOrderNumber,
          complaint_date: todayDate(),
        },
      });
      caseEntry = result[0];
      created = result[1];
    } catch (error) {
      if (error && error.name === 'SequelizeUniqueConstraintError') {
        caseEntry = await ct.Case.findOne({ where: { order_number: normalizedOrderNumber } });
      } else {
        throw error;
      }
    }

    if (!caseEntry) {
      throw new Error('Failed to open case.');
    }

    return {
      caseEntry: toPlainCase(caseEntry),
      created,
    };
  }

  async getCaseView(orderNumber, draftCase, extras) {
    const normalizedOrderNumber = this.normalizeOrderNumber(orderNumber);
    if (!normalizedOrderNumber) {
      return null;
    }

    const [caseEntry, lookupRows] = await Promise.all([
      ct.Case.findOne({ where: { order_number: normalizedOrderNumber } }),
      this.getLookupRows(),
    ]);

    if (!caseEntry) {
      return null;
    }

    const storedCase = toPlainCase(caseEntry);
    const caseDetails = hydrateCaseDefectItems({
      ...storedCase,
      ...(draftCase || {}),
    });

    caseDetails.effective_complaint = getEffectiveComplaint(caseDetails);
    caseDetails.is_open = !caseDetails.solved_date;
    caseDetails.created_at_display = storedCase.created_at_display;
    caseDetails.updated_at_display = storedCase.updated_at_display;

    let relatedCases = [];
    if (caseDetails.customer_id) {
      const relatedRows = await ct.Case.findAll({
        where: {
          customer_id: caseDetails.customer_id,
          order_number: {
            [Op.ne]: normalizedOrderNumber,
          },
        },
        order: [['complaint_date', 'DESC'], ['updatedAt', 'DESC']],
      });

      relatedCases = relatedRows.map((entry) => toPlainCase(entry));
    }

    const complaintOptions = buildComplaintOptions(lookupRows.complaintTypes, [
      caseDetails.customer_complaint,
      caseDetails.customer_complaint_edit,
    ]);
    const solutionOptions = buildValueOptions(lookupRows.solutionTypes, [caseDetails.solution]);
    const shippingMethodOptions = buildValueOptions(lookupRows.shippingMethods, [caseDetails.shipping_method]);

    return {
      caseDetails,
      relatedCases,
      complaintTypes: complaintOptions,
      solutionTypes: solutionOptions,
      shippingMethods: shippingMethodOptions,
      requirements: buildRequirements(caseDetails.effective_complaint, lookupRows.complaintTypes),
      requiredFieldDefinitions: REQUIRED_FIELD_DEFINITIONS,
      placeholderItem: PLACEHOLDER_ITEM,
      hasComplaintTypes: lookupRows.complaintTypes.length > 0,
      hasSolutionTypes: lookupRows.solutionTypes.length > 0,
      hasShippingMethods: lookupRows.shippingMethods.length > 0,
      errors: extras && extras.errors ? extras.errors : [],
      message: extras && extras.message ? extras.message : null,
    };
  }

  async updateCase(orderNumber, payload) {
    const normalizedOrderNumber = this.normalizeOrderNumber(orderNumber);
    if (!normalizedOrderNumber) {
      return { ok: false, notFound: true };
    }

    const [caseEntry, lookupRows] = await Promise.all([
      ct.Case.findOne({ where: { order_number: normalizedOrderNumber } }),
      this.getLookupRows(),
    ]);

    if (!caseEntry) {
      return { ok: false, notFound: true };
    }

    const errors = [];
    const originalComplaint = sanitizeText(caseEntry.customer_complaint);
    const currentComplaintEdit = sanitizeText(caseEntry.customer_complaint_edit);
    const currentSolution = sanitizeText(caseEntry.solution);
    const currentShippingMethod = sanitizeText(caseEntry.shipping_method);

    const allowedComplaintValues = buildValueOptions(lookupRows.complaintTypes, [
      originalComplaint,
      currentComplaintEdit,
    ]);
    const allowedSolutionValues = buildValueOptions(lookupRows.solutionTypes, [currentSolution]);
    const allowedShippingMethods = buildValueOptions(lookupRows.shippingMethods, [currentShippingMethod]);

    let nextOriginalComplaint = originalComplaint || null;
    const requestedOriginalComplaint = sanitizeText(payload.customer_complaint);
    if (!nextOriginalComplaint && requestedOriginalComplaint) {
      if (allowedComplaintValues.indexOf(requestedOriginalComplaint) === -1) {
        errors.push('Select a valid customer complaint.');
      } else {
        nextOriginalComplaint = requestedOriginalComplaint;
      }
    }

    let nextComplaintEdit = null;
    const requestedComplaintEdit = sanitizeText(payload.customer_complaint_edit);
    if (requestedComplaintEdit) {
      if (!nextOriginalComplaint) {
        errors.push('Set the original customer complaint before using complaint edit.');
      } else if (allowedComplaintValues.indexOf(requestedComplaintEdit) === -1) {
        errors.push('Select a valid complaint edit value.');
      } else {
        nextComplaintEdit = requestedComplaintEdit;
      }
    }

    let nextSolution = null;
    const requestedSolution = sanitizeText(payload.solution);
    if (requestedSolution) {
      if (allowedSolutionValues.indexOf(requestedSolution) === -1) {
        errors.push('Select a valid solution.');
      } else {
        nextSolution = requestedSolution;
      }
    }

    const shippingMethod = sanitizeText(payload.shipping_method);
    if (shippingMethod && allowedShippingMethods.indexOf(shippingMethod) === -1) {
      errors.push('Select a valid shipping method.');
    }

    const complaintDateInput = sanitizeText(payload.complaint_date);
    const complaintDate = complaintDateInput
      ? normalizeDate(complaintDateInput)
      : normalizeDate(caseEntry.complaint_date || todayDate());
    if (complaintDateInput && !complaintDate) {
      errors.push('Complaint date must be a valid date.');
    }
    if (!complaintDate) {
      errors.push('Complaint date is required.');
    }

    const shippingDateInput = sanitizeText(payload.shipping_date);
    const shippingDate = shippingDateInput ? normalizeDate(shippingDateInput) : null;
    if (shippingDateInput && !shippingDate) {
      errors.push('Shipping date must be a valid date.');
    }

    const solvedDateInput = sanitizeText(payload.solved_date);
    const solvedDate = solvedDateInput ? normalizeDate(solvedDateInput) : null;
    if (solvedDateInput && !solvedDate) {
      errors.push('Solved date must be a valid date.');
    }

    const defectItemsResult = parseSubmittedDefectItems(payload.defect_items, payload.defect_description);
    errors.push(...defectItemsResult.errors);

    const nextCase = {
      order_number: caseEntry.order_number,
      customer_id: sanitizeText(payload.customer_id),
      customer_complaint: nextOriginalComplaint || '',
      customer_complaint_edit: nextComplaintEdit || '',
      customer_complaint_comment: sanitizeText(payload.customer_complaint_comment),
      shipping_method: shippingMethod,
      shipping_date: shippingDateInput || '',
      complaint_date: complaintDateInput || complaintDate || '',
      defect_items: serializeDefectItems(defectItemsResult.rows),
      defect_description: buildDefectDescription(defectItemsResult.rows),
      solution: nextSolution || '',
      solved_date: solvedDateInput || '',
    };

    const effectiveComplaint = getEffectiveComplaint(nextCase);
    const requirements = buildRequirements(effectiveComplaint, lookupRows.complaintTypes);
    const requiredValues = {
      customer_id: nextCase.customer_id,
      customer_complaint_comment: nextCase.customer_complaint_comment,
      shipping_method: nextCase.shipping_method,
      shipping_date: shippingDate,
      defect_items: defectItemsResult.rows.length > 0,
    };

    REQUIRED_FIELD_DEFINITIONS.forEach((field) => {
      if (requirements.requiredFields.indexOf(field.key) >= 0 && !requiredValues[field.key]) {
        const verb = field.key === 'defect_items' ? 'are' : 'is';
        errors.push(`${field.label} ${verb} required for this complaint type.`);
      }
    });

    if (solvedDate && !nextSolution) {
      errors.push('Solution is required when a case is marked as solved.');
    }

    if (errors.length > 0) {
      return {
        ok: false,
        viewModel: await this.getCaseView(normalizedOrderNumber, nextCase, {
          errors,
          message: 'Case was not saved.',
        }),
      };
    }

    await caseEntry.update({
      customer_id: emptyToNull(nextCase.customer_id),
      customer_complaint: emptyToNull(nextCase.customer_complaint),
      customer_complaint_edit: emptyToNull(nextCase.customer_complaint_edit),
      customer_complaint_comment: emptyToNull(nextCase.customer_complaint_comment),
      shipping_method: emptyToNull(nextCase.shipping_method),
      shipping_date: shippingDate,
      complaint_date: complaintDate,
      defect_items: defectItemsResult.rows.length > 0 ? nextCase.defect_items : null,
      defect_description: emptyToNull(nextCase.defect_description),
      solution: emptyToNull(nextCase.solution),
      solved_date: solvedDate,
    });

    return { ok: true };
  }

  async getAdminView() {
    const { complaintTypes, solutionTypes, shippingMethods } = await this.getLookupRows();
    return {
      complaintTypes: complaintTypes.map((row) => toComplaintType(row)),
      solutionTypes: solutionTypes.map((row) => row.toJSON()),
      shippingMethods: shippingMethods.map((row) => row.toJSON()),
      requiredFieldDefinitions: REQUIRED_FIELD_DEFINITIONS,
    };
  }

  async addComplaintType(payload) {
    const sanitized = sanitizeText(payload && payload.name);
    if (!sanitized) {
      return { ok: false, message: 'Complaint type name is required.' };
    }

    const existing = await ct.ComplaintType.findOne({ where: { name: sanitized } });
    if (existing) {
      return { ok: false, message: 'Complaint type already exists.' };
    }

    try {
      await ct.ComplaintType.create({
        name: sanitized,
        required_fields: JSON.stringify(normalizeRequiredFields(payload.required_fields)),
      });
    } catch (error) {
      if (error && error.name === 'SequelizeUniqueConstraintError') {
        return { ok: false, message: 'Complaint type already exists.' };
      }
      throw error;
    }
    return { ok: true, message: 'Complaint type added.' };
  }

  async updateComplaintType(id, payload) {
    const complaintType = await ct.ComplaintType.findByPk(id);
    if (!complaintType) {
      return { ok: false, message: 'Complaint type not found.' };
    }

    await complaintType.update({
      required_fields: JSON.stringify(normalizeRequiredFields(payload.required_fields)),
    });
    return { ok: true, message: 'Complaint type requirements saved.' };
  }

  async deleteComplaintType(id) {
    await ct.ComplaintType.destroy({ where: { id } });
    return { ok: true, message: 'Complaint type deleted.' };
  }

  async addShippingMethod(name) {
    const sanitized = sanitizeText(name);
    if (!sanitized) {
      return { ok: false, message: 'Shipping method name is required.' };
    }

    const existing = await ct.ShippingMethod.findOne({ where: { name: sanitized } });
    if (existing) {
      return { ok: false, message: 'Shipping method already exists.' };
    }

    try {
      await ct.ShippingMethod.create({ name: sanitized });
    } catch (error) {
      if (error && error.name === 'SequelizeUniqueConstraintError') {
        return { ok: false, message: 'Shipping method already exists.' };
      }
      throw error;
    }
    return { ok: true, message: 'Shipping method added.' };
  }

  async deleteShippingMethod(id) {
    await ct.ShippingMethod.destroy({ where: { id } });
    return { ok: true, message: 'Shipping method deleted.' };
  }

  async addSolutionType(name) {
    const sanitized = sanitizeText(name);
    if (!sanitized) {
      return { ok: false, message: 'Solution type name is required.' };
    }

    const existing = await ct.SolutionType.findOne({ where: { name: sanitized } });
    if (existing) {
      return { ok: false, message: 'Solution type already exists.' };
    }

    try {
      await ct.SolutionType.create({ name: sanitized });
    } catch (error) {
      if (error && error.name === 'SequelizeUniqueConstraintError') {
        return { ok: false, message: 'Solution type already exists.' };
      }
      throw error;
    }
    return { ok: true, message: 'Solution type added.' };
  }

  async deleteSolutionType(id) {
    await ct.SolutionType.destroy({ where: { id } });
    return { ok: true, message: 'Solution type deleted.' };
  }

  async getAnalyticsView() {
    const [caseRows, complaintTypeRows] = await Promise.all([
      ct.Case.findAll({
        attributes: [
          'customer_id',
          'customer_complaint',
          'customer_complaint_edit',
          'shipping_method',
          'shipping_date',
          'complaint_date',
          'defect_items',
          'defect_description',
          'solution',
          'solved_date',
        ],
        order: [['complaint_date', 'ASC']],
        raw: true,
      }),
      ct.ComplaintType.findAll({
        attributes: ['name', 'required_fields'],
        raw: true,
      }),
    ]);

    const totalCases = caseRows.length;
    const solvedCases = caseRows.filter((caseRow) => Boolean(parseDateOnly(caseRow.solved_date)));
    const openCases = totalCases - solvedCases.length;
    const classifiedCases = caseRows.filter((caseRow) => Boolean(getEffectiveComplaint(caseRow))).length;
    const complaintTypes = buildBreakdown(caseRows.map((caseRow) => (
      getEffectiveComplaint(caseRow) || UNCLASSIFIED_COMPLAINT
    )));
    const shippingComplaintTypes = new Set(
      complaintTypeRows
        .filter((complaintType) => normalizeRequiredFields(complaintType.required_fields).includes('shipping_method'))
        .map((complaintType) => complaintType.name)
    );
    const shippingCases = caseRows.filter((caseRow) => shippingComplaintTypes.has(getEffectiveComplaint(caseRow)));
    const shippingMethods = buildBreakdown(shippingCases.map((caseRow) => (
      sanitizeText(caseRow.shipping_method) || MISSING_SHIPPING_METHOD
    )));
    const itemWindow = buildRecentComplaintWindow(6);
    const recentItemCases = filterCasesByComplaintWindow(caseRows, itemWindow);
    const itemCoverageSummary = buildItemSummary(caseRows);
    const itemSummary = {
      ...buildItemSummary(recentItemCases),
      periodEnd: itemWindow.endDate,
      periodStart: itemWindow.startDate,
    };
    const repeatCustomers = buildRepeatCustomerSummary(caseRows);
    const processingTime = buildDurationAnalysis(solvedCases, 'complaint_date', 'solved_date', [
      { label: '0–2 days', minimum: 0, maximum: 2 },
      { label: '3–7 days', minimum: 3, maximum: 7 },
      { label: '8–14 days', minimum: 8, maximum: 14 },
      { label: '15–30 days', minimum: 15, maximum: 30 },
      { label: '31+ days', minimum: 31, maximum: Infinity },
    ]);
    const customerReportDelay = buildDurationAnalysis(shippingCases, 'shipping_date', 'complaint_date', [
      { label: '0–3 days', minimum: 0, maximum: 3 },
      { label: '4–7 days', minimum: 4, maximum: 7 },
      { label: '8–14 days', minimum: 8, maximum: 14 },
      { label: '15–30 days', minimum: 15, maximum: 30 },
      { label: '31–60 days', minimum: 31, maximum: 60 },
      { label: '61+ days', minimum: 61, maximum: Infinity },
    ]);
    const complaintDates = caseRows
      .map((caseRow) => parseDateOnly(caseRow.complaint_date))
      .filter(Boolean)
      .sort((left, right) => left.timestamp - right.timestamp);
    const shippingMethodRecorded = shippingCases.filter((caseRow) => sanitizeText(caseRow.shipping_method)).length;
    const shippingDateRecorded = shippingCases.filter((caseRow) => Boolean(parseDateOnly(caseRow.shipping_date))).length;
    const solvedWithSolution = solvedCases.filter((caseRow) => sanitizeText(caseRow.solution)).length;
    const customerIdRecorded = caseRows.filter((caseRow) => sanitizeText(caseRow.customer_id)).length;

    return {
      claimSolutionMatrix: buildClaimSolutionMatrix(caseRows),
      complaintTypes,
      coverage: [
        buildCoverageRow('Current complaint type', classifiedCases, totalCases),
        buildCoverageRow('Customer ID', customerIdRecorded, totalCases),
        buildCoverageRow('Shipping method (eligible cases)', shippingMethodRecorded, shippingCases.length),
        buildCoverageRow('Shipping date (eligible cases)', shippingDateRecorded, shippingCases.length),
        buildCoverageRow('Solution (solved cases)', solvedWithSolution, solvedCases.length),
        buildCoverageRow('Defect item details', itemCoverageSummary.itemizedCases, totalCases),
      ],
      customerReportDelay,
      dayOfMonthComplaints: buildDayOfMonthSeries(caseRows),
      itemSummary,
      monthlyComplaints: buildMonthSeries(caseRows, 'complaint_date'),
      pagetitle: 'Case analytics',
      processingTime,
      repeatCustomers,
      shippingComplaintRows: buildShippingComplaintRows(shippingCases),
      shippingComplaintTypeCount: shippingComplaintTypes.size,
      shippingMethods,
      shippingMonths: buildMonthSeries(shippingCases, 'shipping_date'),
      summary: {
        classifiedCases,
        dateRange: complaintDates.length > 0
          ? `${complaintDates[0].key} – ${complaintDates[complaintDates.length - 1].key}`
          : 'No complaint dates recorded',
        openCases,
        shippingCases: shippingCases.length,
        solvedCases: solvedCases.length,
        solvedRate: percentage(solvedCases.length, totalCases),
        totalCases,
      },
      totalCases,
    };
  }

  async getItemAnalyticsView(itemCode) {
    const caseRows = await ct.Case.findAll({
      attributes: [
        'order_number',
        'customer_complaint',
        'customer_complaint_edit',
        'complaint_date',
        'defect_items',
        'defect_description',
        'solution',
        'solved_date',
      ],
      order: [['complaint_date', 'ASC'], ['order_number', 'ASC']],
      raw: true,
    });
    const analytics = buildItemAnalytics(caseRows, itemCode);
    if (!analytics) {
      return null;
    }

    return {
      ...analytics,
      pagetitle: `Item analytics: ${analytics.itemCode}`,
    };
  }
}

module.exports = CaseTrackerService;
