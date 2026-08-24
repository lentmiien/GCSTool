const csv = require('csvtojson');

const IMPORT_START_DATE = '2026-02-02';
const IMPORT_END_DATE = '2026-12-30';
const MAX_CSV_ROWS = 2000;
const MAX_ASSIGNMENTS = 1000;
const WEEKDAYS = Object.freeze([
  'Sunday',
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
]);

function createImportError(message) {
  const error = new Error(message);
  error.status = 400;
  error.code = 'DAILY_TASK_CSV_IMPORT_ERROR';
  return error;
}

function isImportError(error) {
  return Boolean(error && error.code === 'DAILY_TASK_CSV_IMPORT_ERROR');
}

function normalizeSpreadsheetDate(value) {
  const match = /^(\d{4})\/(\d{1,2})\/(\d{1,2})$/.exec(value);
  if (!match) {
    return null;
  }

  const year = Number.parseInt(match[1], 10);
  const month = Number.parseInt(match[2], 10);
  const day = Number.parseInt(match[3], 10);
  const normalized = `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  const parsed = new Date(`${normalized}T00:00:00.000Z`);

  if (!Number.isFinite(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== normalized) {
    return null;
  }
  return normalized;
}

function describeLocation(sourceName, rowIndex, columnIndex) {
  return `${sourceName}, row ${rowIndex + 1}, columns ${columnIndex + 1}-${columnIndex + 3}`;
}

async function parseDailyTaskCsv(content, sourceName = 'CSV file') {
  if (typeof content !== 'string' || content.trim().length === 0) {
    throw createImportError(`${sourceName} is empty.`);
  }

  let rows;
  try {
    rows = await csv({
      noheader: true,
      output: 'csv',
      trim: false,
    }).fromString(content.replace(/^\uFEFF/, ''));
  } catch (_error) {
    throw createImportError(`${sourceName} is not a valid CSV file.`);
  }

  if (rows.length > MAX_CSV_ROWS) {
    throw createImportError(`${sourceName} has too many rows. The limit is ${MAX_CSV_ROWS}.`);
  }

  const assignments = [];
  let ignoredOutOfRange = 0;

  rows.forEach((row, rowIndex) => {
    const cells = row.map((cell) => String(cell || '').trim());
    if (cells.every((cell) => cell.length === 0)) {
      return;
    }

    for (let columnIndex = 0; columnIndex < cells.length; columnIndex += 4) {
      const dateValue = cells[columnIndex] || '';
      const weekdayValue = cells[columnIndex + 1] || '';
      const assigneeName = cells[columnIndex + 2] || '';
      const separatorValue = cells[columnIndex + 3] || '';
      const location = describeLocation(sourceName, rowIndex, columnIndex);

      if (separatorValue) {
        throw createImportError(`${location}: the fourth cell must be an empty separator.`);
      }
      if (!dateValue && !weekdayValue && !assigneeName) {
        continue;
      }
      if (!dateValue) {
        throw createImportError(`${location}: found an incomplete entry without a date.`);
      }

      const date = normalizeSpreadsheetDate(dateValue);
      if (!date) {
        throw createImportError(`${location}: "${dateValue}" is not a valid YYYY/M/D date.`);
      }

      if (date < IMPORT_START_DATE || date > IMPORT_END_DATE) {
        ignoredOutOfRange++;
        continue;
      }

      if (!weekdayValue || !assigneeName) {
        throw createImportError(`${location}: each in-range entry needs a date, weekday, and staff name.`);
      }

      const weekday = WEEKDAYS[new Date(`${date}T00:00:00.000Z`).getUTCDay()];
      if (weekdayValue.toLowerCase() !== weekday.toLowerCase()) {
        throw createImportError(`${location}: ${dateValue} is ${weekday}, not ${weekdayValue}.`);
      }

      assignments.push({
        date,
        assigneeName,
        sourceName,
        row: rowIndex + 1,
      });

      if (assignments.length > MAX_ASSIGNMENTS) {
        throw createImportError(`The uploaded files contain more than ${MAX_ASSIGNMENTS} in-range assignments.`);
      }
    }
  });

  return {
    assignments,
    ignoredOutOfRange,
    sourceName,
  };
}

async function parseDailyTaskCsvFiles(files) {
  if (!Array.isArray(files) || files.length === 0) {
    throw createImportError('Select the CSV files to import.');
  }

  const parsedFiles = [];
  for (const file of files) {
    parsedFiles.push(await parseDailyTaskCsv(file.content, file.sourceName));
  }

  const parsedAssignmentCount = parsedFiles.reduce(
    (total, parsedFile) => total + parsedFile.assignments.length,
    0
  );
  if (parsedAssignmentCount > MAX_ASSIGNMENTS) {
    throw createImportError(`The uploaded files contain more than ${MAX_ASSIGNMENTS} in-range assignments.`);
  }

  const assignmentsByDate = new Map();
  let duplicateRows = 0;

  parsedFiles.forEach((parsedFile) => {
    parsedFile.assignments.forEach((assignment) => {
      const existing = assignmentsByDate.get(assignment.date);
      if (!existing) {
        assignmentsByDate.set(assignment.date, assignment);
        return;
      }
      if (existing.assigneeName !== assignment.assigneeName) {
        throw createImportError(
          `Conflicting assignments for ${assignment.date}: ${existing.assigneeName} in ${existing.sourceName} `
          + `and ${assignment.assigneeName} in ${assignment.sourceName}.`
        );
      }
      duplicateRows++;
    });
  });

  const assignments = Array.from(assignmentsByDate.values())
    .sort((left, right) => left.date.localeCompare(right.date))
    .map(({ date, assigneeName }) => ({ date, assigneeName }));

  if (assignments.length === 0) {
    throw createImportError(
      `The uploaded files contain no assignments between ${IMPORT_START_DATE} and ${IMPORT_END_DATE}.`
    );
  }

  return {
    assignments,
    duplicateRows,
    ignoredOutOfRange: parsedFiles.reduce((total, file) => total + file.ignoredOutOfRange, 0),
  };
}

module.exports = {
  IMPORT_END_DATE,
  IMPORT_START_DATE,
  createImportError,
  isImportError,
  normalizeSpreadsheetDate,
  parseDailyTaskCsv,
  parseDailyTaskCsvFiles,
};
