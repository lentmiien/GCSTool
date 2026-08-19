const TEAM_OPTIONS = Object.freeze([
  { value: 'ohami_gcs_mail', label: 'GCS Mail Team', shortLabel: 'Mail' },
  { value: 'ohami_gcs_order', label: 'GCS Order Team', shortLabel: 'Order' },
  { value: 'ohami_gcs_korea', label: 'GCS Korea Team', shortLabel: 'Korea' },
  { value: 'ohami_gcs_boss', label: 'GCS Management', shortLabel: 'Management' },
]);

const TEAM_VALUES = Object.freeze(TEAM_OPTIONS.map((team) => team.value));
const RANGE_OPTIONS = Object.freeze([7, 14, 31]);
const OFF_STATUSES = new Set(['off', 'holiday', 'vacation']);

const SCHEDULE_LABELS = Object.freeze({
  work: 'Working',
  telwork: 'Remote work',
  halfoff_e: 'Working (morning)',
  halfoff_m: 'Working (afternoon)',
  '2hoff_e': 'Working (partial day)',
  '2hoff_m': 'Working (partial day)',
  off: 'Day off',
  holiday: 'Holiday',
  vacation: 'Vacation',
  not_set: 'Schedule not set',
  no_staff_record: 'Not in staff schedule',
});

function isValidDateString(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false;
  }
  const year = Number.parseInt(value.slice(0, 4), 10);
  if (year < 1000) {
    return false;
  }
  const date = new Date(`${value}T00:00:00.000Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

function addDays(dateString, numberOfDays) {
  const date = new Date(`${dateString}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + numberOfDays);
  return date.toISOString().slice(0, 10);
}

function getJapanToday() {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Tokyo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date());
  const lookup = {};
  parts.forEach((part) => {
    lookup[part.type] = part.value;
  });
  return `${lookup.year}-${lookup.month}-${lookup.day}`;
}

function getDayOfWeek(dateString) {
  return new Date(`${dateString}T00:00:00.000Z`).getUTCDay();
}

function formatDateLabel(dateString) {
  return new Intl.DateTimeFormat('en-US', {
    timeZone: 'UTC',
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  }).format(new Date(`${dateString}T00:00:00.000Z`));
}

function getTeamLabel(teamValue, short = false) {
  const team = TEAM_OPTIONS.find((option) => option.value === teamValue);
  if (!team) {
    return teamValue || 'No team';
  }
  return short ? team.shortLabel : team.label;
}

function classifyScheduleStatus(status) {
  if (OFF_STATUSES.has(status)) {
    return 'off';
  }
  if (status === 'not_set' || status === 'no_staff_record' || !status) {
    return 'unknown';
  }
  if (status === 'work' || status === 'telwork') {
    return 'working';
  }
  return 'partial';
}

function getScheduleLabel(status) {
  return SCHEDULE_LABELS[status] || String(status || SCHEDULE_LABELS.not_set).replace(/_/g, ' ');
}

module.exports = {
  OFF_STATUSES,
  RANGE_OPTIONS,
  TEAM_OPTIONS,
  TEAM_VALUES,
  addDays,
  classifyScheduleStatus,
  formatDateLabel,
  getDayOfWeek,
  getJapanToday,
  getScheduleLabel,
  getTeamLabel,
  isValidDateString,
};
