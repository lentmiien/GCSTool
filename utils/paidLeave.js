const { getJapanToday } = require('./dailyTasks');

function getPaidLeavePeriod(today = getJapanToday()) {
  const year = Number(today.slice(0, 4));
  const startYear = Number(today.slice(5, 7)) >= 4 ? year : year - 1;
  return {
    startDate: `${startYear}-04-01`,
    endDate: `${startYear + 1}-03-31`,
    throughDate: today,
  };
}

function countPaidLeave(scheduleDays = [], period) {
  return scheduleDays.reduce((totals, day) => {
    if (day.date < period.startDate || day.date > period.endDate) {
      return totals;
    }
    const days = day.work === 'vacation' ? 1
      : day.work === 'halfoff_e' || day.work === 'halfoff_m' ? 0.5 : 0;
    const category = day.date <= period.throughDate ? 'consumed' : 'scheduled';
    totals[category] += days;
    return totals;
  }, { consumed: 0, scheduled: 0 });
}

module.exports = { getPaidLeavePeriod, countPaidLeave };
