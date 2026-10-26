const rules = require('../utils/workflows');
const base = () => ({ name: 'GST', description: '', enabled: true, trigger: 'manual', requiredVariables: [],
  steps: [{ title: 'Gather', description: 'Gather the data', assignees: [1] }] });
const schedule = (overrides = {}) => rules.validateSchedule({ frequency: 'monthly', startDate: '2026-01-31', time: '09:00', interval: 1, ...overrides });

test('quarterly starts use the anchor month and Japan midnight', () => {
  const value = schedule({ startDate: '2026-02-01', time: '00:00', interval: 3 });
  expect(rules.nextOccurrence(value).toISOString()).toBe('2026-01-31T15:00:00.000Z');
  expect(rules.nextOccurrence(value, rules.nextOccurrence(value)).toISOString()).toBe('2026-04-30T15:00:00.000Z');
});

test('monthly recurrence clamps short months without drifting', () => {
  const value = schedule();
  const february = rules.nextOccurrence(value, rules.nextOccurrence(value));
  expect(february.toISOString()).toBe('2026-02-28T00:00:00.000Z');
  expect(rules.nextOccurrence(value, february).toISOString()).toBe('2026-03-31T00:00:00.000Z');
  expect(rules.nextOccurrence(schedule({ startDate: '2028-01-31' }), '2028-01-31T00:00:00Z').toISOString()).toBe('2028-02-29T00:00:00.000Z');
});

test('weekly selected weekdays respect anchor date and multiweek intervals', () => {
  const value = schedule({ frequency: 'weekly', startDate: '2026-10-28', weekdays: [1, 5], interval: 2 });
  const first = rules.nextOccurrence(value);
  expect(first.toISOString()).toBe('2026-10-30T00:00:00.000Z');
  expect(rules.nextOccurrence(value, first).toISOString()).toBe('2026-11-09T00:00:00.000Z');
  const monday = schedule({ frequency: 'weekly', startDate: '2026-10-26', weekdays: [1], interval: 1 });
  expect(rules.nextOccurrence(monday, rules.nextOccurrence(monday)).toISOString()).toBe('2026-11-02T00:00:00.000Z');
});

test('daily recurrence crosses year boundary at configured Japan time', () => {
  const value = schedule({ frequency: 'daily', startDate: '2026-12-31', time: '23:30', interval: 2 });
  expect(rules.nextOccurrence(value, rules.nextOccurrence(value)).toISOString()).toBe('2027-01-02T14:30:00.000Z');
});

test.each([
  { startDate: '2026-02-30' }, { time: '24:00' }, { interval: 0 }, { interval: 61 },
  { frequency: 'weekly', weekdays: [] }, { frequency: 'weekly', weekdays: [7] },
])('invalid schedules are rejected: %j', invalid => {
  expect(() => schedule(invalid)).toThrow();
});

test('definitions accept unassigned tasks and archived tasks, but reject forged staff and lost task identities', () => {
  const input = base();
  input.steps[0].assignees = [];
  const result = rules.validateDefinition(input, new Set([1]));
  expect(result.steps[0].assignees).toEqual([]);
  expect(() => rules.validateDefinition({ ...input, steps: [{ ...input.steps[0], assignees: [99] }] }, new Set([1]))).toThrow('Unknown staff');
  expect(() => rules.validateDefinition(input, new Set([1]), result)).toThrow('Archive existing tasks');
  expect(() => rules.validateDefinition({ ...input, steps: [{ ...input.steps[0], archived: true }] }, new Set([1]))).toThrow('unarchived');
  expect(rules.validateDefinition({ ...input, archived: true, steps: [{ ...input.steps[0], archived: true }] }, new Set([1])).archived).toBe(true);
});

test('required defaults are mandatory for automatic starts and unchanged schedules retain their cursor', () => {
  const input = { ...base(), trigger: 'scheduled', schedule: schedule(), requiredVariables: [{ name: 'Period', defaultValue: '' }] };
  expect(() => rules.validateDefinition(input, new Set([1]))).toThrow('Default value');
  input.requiredVariables[0].defaultValue = '{month}';
  const previous = rules.validateDefinition(input, new Set([1]));
  previous.schedule = { interval: previous.schedule.interval, time: previous.schedule.time, startDate: previous.schedule.startDate, frequency: previous.schedule.frequency };
  previous.nextStart = new Date('2027-01-31T00:00:00Z');
  const result = rules.validateDefinition({ ...input, steps: previous.steps }, new Set([1]), previous);
  expect(result.nextStart).toEqual(previous.nextStart);
});

test('variables require values, enforce three custom slots, and reject duplicate names', () => {
  const required = [{ name: 'Order' }];
  expect(() => rules.validateVariables(required, [' '], [])).toThrow('required');
  expect(() => rules.validateVariables(required, ['123'], [{ name: 'order', value: 'x' }])).toThrow('unique');
  expect(() => rules.validateVariables([], [], Array(4).fill({ name: 'x', value: 'y' }))).toThrow('at most 3');
  expect(rules.validateVariables(required, ['123'], [{ name: 'Country', value: 'AU' }])).toEqual([
    { name: 'Order', value: '123', required: true }, { name: 'Country', value: 'AU', required: false },
  ]);
});

test('transitions reject first-step returns, missing errors, inactive tasks, and stale pages', () => {
  const run = { status: 'open', activePosition: 0, revision: 2 };
  const task = { state: 'active', position: 0 };
  expect(() => rules.transition(run, task, 'reject', 'error')).toThrow('first task');
  expect(() => rules.transition({ ...run, activePosition: 1 }, { ...task, position: 1 }, 'reject', '')).toThrow('Explain');
  expect(() => rules.transition({ ...run, status: 'cancelled' }, task, 'complete', '')).toThrow('no longer active');
  expect(() => rules.assertRevision(run, 1)).toThrow('out of date');
  expect(rules.transition(run, task, 'complete', '')).toBe(1);
});
