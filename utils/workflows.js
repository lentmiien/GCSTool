const { randomUUID } = require('crypto');

function fail(message, status = 400) {
  const error = new Error(message);
  error.status = status;
  throw error;
}

function text(value, label, max, required = true) {
  if (typeof value !== 'string' || value.length > max || (required && !value.trim())) {
    fail(`${label} ${required ? 'is required and ' : ''}must be at most ${max} characters.`);
  }
  return value.trim();
}

function integer(value, min, max, label) {
  if (!/^\d+$/.test(String(value)) || !Number.isSafeInteger(Number(value)) || Number(value) < min || Number(value) > max) {
    fail(`Invalid ${label}.`);
  }
  return Number(value);
}

function parseJson(value) {
  if (typeof value !== 'string') return value;
  try { return JSON.parse(value); } catch (_) { return fail('Invalid form data.'); }
}

function japanDate(now = new Date()) {
  return new Date(now.getTime() + 9 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

function validDate(value) {
  return typeof value === 'string' && /^20\d{2}-\d{2}-\d{2}$/.test(value)
    && Number.isFinite(Date.parse(value)) && new Date(value).toISOString().slice(0, 10) === value;
}

function validateSchedule(input) {
  const schedule = parseJson(input);
  if (!schedule || !['daily', 'weekly', 'monthly'].includes(schedule.frequency)) fail('Choose a schedule frequency.');
  if (!validDate(schedule.startDate)) fail('Choose a valid first date between 2000 and 2099.');
  if (typeof schedule.time !== 'string' || !/^([01]\d|2[0-3]):[0-5]\d$/.test(schedule.time)) fail('Choose a valid time.');
  const result = { frequency: schedule.frequency, startDate: schedule.startDate, time: schedule.time,
    interval: integer(schedule.interval, 1, 60, 'schedule interval') };
  if (result.frequency === 'weekly') {
    if (!Array.isArray(schedule.weekdays) || !schedule.weekdays.length) fail('Select at least one weekday.');
    result.weekdays = [...new Set(schedule.weekdays.map(day => integer(day, 0, 6, 'weekday')))].sort();
  }
  return result;
}

// Wall-clock recurrence in Asia/Tokyo (UTC+9, no daylight saving).
// Monthly dates such as the 31st clamp to the last day of shorter months.
function nextOccurrence(schedule, after) {
  const anchor = new Date(`${schedule.startDate}T00:00:00Z`);
  const afterDate = after ? japanDate(new Date(after)) : schedule.startDate;
  const candidate = new Date(`${afterDate < schedule.startDate ? schedule.startDate : afterDate}T00:00:00Z`);
  const dayMs = 86400000;
  const anchorMonday = anchor.getTime() - ((anchor.getUTCDay() + 6) % 7) * dayMs;
  for (let i = 0; i < 1900; i++, candidate.setUTCDate(candidate.getUTCDate() + 1)) {
    const days = Math.round((candidate - anchor) / dayMs);
    const months = (candidate.getUTCFullYear() - anchor.getUTCFullYear()) * 12 + candidate.getUTCMonth() - anchor.getUTCMonth();
    const lastDay = new Date(Date.UTC(candidate.getUTCFullYear(), candidate.getUTCMonth() + 1, 0)).getUTCDate();
    const matches = schedule.frequency === 'daily' ? days % schedule.interval === 0
      : schedule.frequency === 'weekly' ? Math.floor((candidate.getTime() - anchorMonday) / (7 * dayMs)) % schedule.interval === 0 && schedule.weekdays.includes(candidate.getUTCDay())
        : months % schedule.interval === 0 && candidate.getUTCDate() === Math.min(anchor.getUTCDate(), lastDay);
    const instant = new Date(`${candidate.toISOString().slice(0, 10)}T${schedule.time}:00+09:00`);
    if (matches && (!after || instant > new Date(after))) return instant;
  }
  fail('Could not calculate the next scheduled start.');
}

function validateDefinition(input, userIds, previous) {
  const steps = parseJson(input.steps);
  const variables = parseJson(input.requiredVariables);
  if (!Array.isArray(steps) || !steps.length || steps.length > 50) fail('Add between 1 and 50 tasks.');
  if (!Array.isArray(variables) || variables.length > 20) fail('Use at most 20 required variables.');
  const seen = new Set();
  const normalizedSteps = steps.map(step => {
    if (!step || typeof step !== 'object') fail('Invalid task.');
    const id = step.id || randomUUID();
    if (step.id && (!previous || !previous.steps.some(old => old.id === id))) fail('Unknown task ID.');
    if (seen.has(id)) fail('Duplicate task.');
    seen.add(id);
    if (!Array.isArray(step.assignees)) fail('Invalid staff list.');
    const assignees = [...new Set(step.assignees.map(id => integer(id, 1, 2147483647, 'staff member')))];
    if (assignees.some(id => !userIds.has(id))) fail('Unknown staff member.');
    return { id, archived: step.archived === true, title: text(step.title, 'Task title', 160), description: text(step.description, 'Task description', 10000), assignees };
  });
  if (previous && previous.steps.some(step => !seen.has(step.id))) fail('Archive existing tasks instead of removing them, so ongoing runs can still be staffed.');
  const names = new Set();
  const requiredVariables = variables.map(variable => {
    if (!variable || typeof variable !== 'object') fail('Invalid variable.');
    const name = text(variable.name, 'Variable name', 80);
    if (names.has(name.toLowerCase())) fail('Variable names must be unique.');
    names.add(name.toLowerCase());
    return { name, defaultValue: text(variable.defaultValue || '', 'Default value', 1000, input.trigger === 'scheduled') };
  });
  if (!['manual', 'scheduled'].includes(input.trigger)) fail('Invalid trigger.');
  const result = {
    name: text(input.name, 'Workflow name', 160), description: text(input.description || '', 'Description', 10000, false),
    steps: normalizedSteps, requiredVariables, trigger: input.trigger,
    locked: input.locked === true || input.locked === 'true', enabled: input.enabled === true || input.enabled === 'true',
    archived: input.archived === true || input.archived === 'true',
    schedule: null, nextStart: null,
  };
  if (!result.archived && !normalizedSteps.some(step => !step.archived)) fail('Keep at least one unarchived task, or archive the workflow.');
  if (result.trigger === 'scheduled') {
    result.schedule = validateSchedule(input.schedule);
    const unchanged = previous && previous.trigger === 'scheduled' && JSON.stringify(validateSchedule(previous.schedule)) === JSON.stringify(result.schedule);
    result.nextStart = unchanged ? previous.nextStart : nextOccurrence(result.schedule);
  }
  return result;
}

function validateVariables(definitions, values, custom) {
  if (!Array.isArray(values) || values.length !== definitions.length) fail('Fill in every required variable.');
  if (!Array.isArray(custom) || custom.length > 3) fail('Use at most 3 custom variables.');
  const names = new Set(definitions.map(variable => variable.name.toLowerCase()));
  return definitions.map((variable, i) => ({ name: variable.name, value: text(values[i], variable.name, 1000), required: true }))
    .concat(custom.map(variable => {
      if (!variable || typeof variable !== 'object') fail('Invalid custom variable.');
      const name = text(variable.name, 'Custom variable name', 80);
      if (names.has(name.toLowerCase())) fail('Variable names must be unique.');
      names.add(name.toLowerCase());
      return { name, value: text(variable.value, name, 1000), required: false };
    }));
}

function assertRevision(record, revision) {
  if (record.revision !== integer(revision, 0, 2147483647, 'revision')) fail('This page is out of date. Reload before trying again.', 409);
}

function transition(run, task, action, comment) {
  if (run.status !== 'open' || task.position !== run.activePosition || task.state !== 'active') fail('This task is no longer active. Reload the page.', 409);
  if (!['complete', 'reject'].includes(action)) fail('Invalid task action.');
  if (action === 'reject' && task.position === 0) fail('The first task cannot be returned. Ask an admin to cancel this workflow if needed.');
  if (action === 'reject' && !comment.trim()) fail('Explain the error in the comment before returning this task.');
  return task.position + (action === 'complete' ? 1 : -1);
}

module.exports = { fail, text, integer, parseJson, japanDate, validDate, validateSchedule, nextOccurrence, validateDefinition, validateVariables, assertRevision, transition };
