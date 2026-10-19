/** @jest-environment jsdom */
jest.mock('../sequelize', () => ({
  Staff: { findAll: jest.fn() },
  User: { findAll: jest.fn() },
  Holiday: { findAll: jest.fn() },
  Schedule2: {},
  Op: {},
}));

const pug = require('pug');
const { Staff, User, Holiday } = require('../sequelize');
const controller = require('../controllers/schedulerController');
const render = pug.compileFile('views/scheduler.pug');

afterEach(() => jest.useRealTimers());

test('scheduler shows both totals for each staff member, including empty weekly schedules', async () => {
  jest.useFakeTimers().setSystemTime(new Date('2026-10-19T03:00:00Z'));
  Staff.findAll.mockResolvedValue([
    { id: 1, name: 'Alice', schedule2s: [
      { date: '2026-04-02', work: 'vacation' },
      { date: '2026-10-19', work: 'halfoff_m' },
      { date: '2026-10-20', work: 'vacation' },
      ...[21, 22, 23, 24, 25].map(day => ({ date: `2026-10-${day}`, work: 'work' })),
    ] },
    { id: 2, name: 'Bob', schedule2s: [] },
  ]);
  User.findAll.mockResolvedValue(['Alice', 'Bob'].map(userid => ({ userid, team: 'ohami_gcs_mail' })));
  Holiday.findAll.mockResolvedValue([]);
  const locals = await new Promise(resolve => {
    controller.view({ user: { role: 'user' } }, { render: (_view, data) => resolve(data) });
  });
  document.documentElement.innerHTML = render({ ...locals, role: 'user', name: 'Alice' });
  expect(document.querySelector('.scheduler-paid-leave-note').textContent).toContain('2026-04-01 – 2027-03-31');
  expect(document.querySelector('.scheduler-paid-leave-note').textContent).toContain('2026-10-19 (JST)');
  expect([...document.querySelectorAll('td.scheduler-paid-leave')].map(cell => cell.textContent))
    .toEqual(['1.5', '1', '0', '0']);
  expect(document.querySelectorAll('.scheduler-table thead th')).toHaveLength(10);
  for (const row of document.querySelectorAll('.scheduler-table tbody tr')) {
    expect([...row.cells].reduce((sum, cell) => sum + cell.colSpan, 0)).toBe(10);
  }
});

test('guest scheduler renders without loading staff records', () => {
  const res = { render: jest.fn() };
  controller.view({ user: { role: 'guest' } }, res);
  const locals = res.render.mock.calls[0][1];
  expect(() => render({ ...locals, role: 'guest' })).not.toThrow();
  expect(Staff.findAll).not.toHaveBeenCalled();
});
