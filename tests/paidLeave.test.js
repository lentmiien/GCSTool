const { getPaidLeavePeriod, countPaidLeave } = require('../utils/paidLeave');

test.each([
  ['2026-01-01', '2025-04-01', '2026-03-31'],
  ['2026-03-31', '2025-04-01', '2026-03-31'],
  ['2026-04-01', '2026-04-01', '2027-03-31'],
  ['2026-12-31', '2026-04-01', '2027-03-31'],
])('business year containing %s runs from %s through %s', (today, startDate, endDate) => {
  expect(getPaidLeavePeriod(today)).toEqual({ startDate, endDate, throughDate: today });
});

test('business year rolls over at midnight in Japan', () => {
  jest.useFakeTimers();
  try {
    jest.setSystemTime(new Date('2026-03-31T14:59:59Z'));
    expect(getPaidLeavePeriod().startDate).toBe('2025-04-01');
    jest.setSystemTime(new Date('2026-03-31T15:00:00Z'));
    expect(getPaidLeavePeriod()).toEqual({
      startDate: '2026-04-01', endDate: '2027-03-31', throughDate: '2026-04-01',
    });
  } finally {
    jest.useRealTimers();
  }
});

test('counts full and both half days separately before/through today and after today', () => {
  const schedule = [
    { date: '2026-03-31', work: 'vacation' },
    { date: '2026-04-01', work: 'vacation' },
    { date: '2026-10-18', work: 'halfoff_e' },
    { date: '2026-10-19', work: 'halfoff_m' },
    { date: '2026-10-20', work: 'halfoff_m' },
    { date: '2027-01-01', work: 'halfoff_e' },
    { date: '2027-03-31', work: 'vacation' },
    { date: '2027-04-01', work: 'vacation' },
  ];
  expect(countPaidLeave(schedule, getPaidLeavePeriod('2026-10-19')))
    .toEqual({ consumed: 2, scheduled: 2 });
});

test('two-hour leave and other statuses never count, and missing schedules show zero', () => {
  const period = getPaidLeavePeriod('2026-10-19');
  const statuses = ['2hoff_e', '2hoff_m', 'off', 'holiday', 'telwork', 'work', 'unknown'];
  const schedule = ['2026-10-18', '2026-10-20'].flatMap(date => statuses.map(work => ({ date, work })));
  expect(countPaidLeave(schedule, period)).toEqual({ consumed: 0, scheduled: 0 });
  expect(countPaidLeave(undefined, period)).toEqual({ consumed: 0, scheduled: 0 });
});
