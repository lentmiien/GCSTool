const {
  OFF_STATUSES,
  addDays,
  getDayOfWeek,
  getJapanToday,
  isValidDateString,
} = require('./dailyTasks');

const TEAM_LEADER_NAMES = new Set(['Lennart', 'Nick', 'Hwang', 'Yokoyama']);
const WARNING_LEVEL_RANK = Object.freeze({
  warning: 1,
  'strong-warning': 2,
  emergency: 3,
});

function normalizeAnalysisYear(value, fallbackYear) {
  const candidate = String(value || '').trim();
  if (/^\d{4}$/.test(candidate)) {
    const year = Number.parseInt(candidate, 10);
    if (year >= 1000 && year <= 9999) {
      return year;
    }
  }
  return fallbackYear;
}

function resolveScheduleAnalysisPeriod(yearValue, startDateValue, todayValue = getJapanToday()) {
  const today = isValidDateString(todayValue) ? todayValue : getJapanToday();
  const currentYear = Number.parseInt(today.slice(0, 4), 10);
  const year = normalizeAnalysisYear(yearValue, currentYear);
  const firstDate = `${year}-01-01`;
  const endDate = `${year}-12-31`;
  const defaultStartDate = year === currentYear ? today : firstDate;
  const hasRequestedStartDate = startDateValue !== undefined
    && startDateValue !== null
    && String(startDateValue).trim() !== '';

  if (!hasRequestedStartDate) {
    return {
      endDate,
      startDate: defaultStartDate,
      startDateError: null,
      year,
    };
  }

  const requestedStartDate = String(startDateValue).trim();
  if (isValidDateString(requestedStartDate) && requestedStartDate.slice(0, 4) === String(year)) {
    return {
      endDate,
      startDate: requestedStartDate,
      startDateError: null,
      year,
    };
  }

  return {
    endDate,
    startDate: defaultStartDate,
    startDateError: `Start date must be a valid date in ${year}. The default start date is shown instead.`,
    year,
  };
}

function normalizeDateOnly(value) {
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value.toISOString().slice(0, 10);
  }
  if (typeof value !== 'string') {
    return null;
  }
  const date = value.trim().slice(0, 10);
  return isValidDateString(date) ? date : null;
}

function getTeamWarningLevel(team, regularStaffCount, dayOfWeek) {
  if (dayOfWeek === 0) {
    return null;
  }

  if (team === 'ohami_gcs_mail') {
    if (regularStaffCount >= 3) return null;
    if (regularStaffCount === 2) return 'warning';
    if (regularStaffCount === 1) return 'strong-warning';
    return 'emergency';
  }

  if (team === 'ohami_gcs_order') {
    return regularStaffCount >= 2 ? null : 'warning';
  }

  if (team === 'ohami_gcs_korea') {
    return regularStaffCount >= 1 ? null : 'warning';
  }

  return null;
}

function createWarningStats() {
  return {
    emergency: 0,
    highestSeverity: null,
    strongWarning: 0,
    total: 0,
    warning: 0,
  };
}

function recordWarning(stats, warningLevel) {
  if (!warningLevel) {
    return;
  }

  stats.total++;
  if (warningLevel === 'strong-warning') {
    stats.strongWarning++;
  } else {
    stats[warningLevel]++;
  }

  if (
    !stats.highestSeverity
    || WARNING_LEVEL_RANK[warningLevel] > WARNING_LEVEL_RANK[stats.highestSeverity]
  ) {
    stats.highestSeverity = warningLevel;
  }
}

function buildScheduleAnalysis({
  endDate,
  holidayRows = [],
  staffRows = [],
  startDate,
  userRows = [],
}) {
  const teams = [];
  const teamSet = new Set();
  const userTeams = new Map();

  userRows.forEach((user) => {
    const userid = typeof user.userid === 'string' ? user.userid : '';
    const team = typeof user.team === 'string' ? user.team : '';
    if (!userid || !team) {
      return;
    }

    userTeams.set(userid, team);
    if (!teamSet.has(team)) {
      teamSet.add(team);
      teams.push(team);
    }
  });

  const warningStats = Object.create(null);
  teams.forEach((team) => {
    warningStats[team] = createWarningStats();
  });

  if (!isValidDateString(startDate) || !isValidDateString(endDate) || startDate > endDate) {
    return { data: [], teams, warningStats };
  }

  const holidays = new Set();
  holidayRows.forEach((holiday) => {
    const date = normalizeDateOnly(holiday && typeof holiday === 'object' ? holiday.date : holiday);
    if (date && date >= startDate && date <= endDate) {
      holidays.add(date);
    }
  });

  const workingStaff = new Map();
  staffRows.forEach((staff) => {
    const staffName = typeof staff.name === 'string' ? staff.name : '';
    const team = userTeams.get(staffName);
    if (!staffName || !team || !teamSet.has(team)) {
      return;
    }

    const scheduleDays = Array.isArray(staff.schedule2s) ? staff.schedule2s : [];
    scheduleDays.forEach((scheduleDay) => {
      const date = normalizeDateOnly(scheduleDay.date);
      if (!date || date < startDate || date > endDate || OFF_STATUSES.has(scheduleDay.work)) {
        return;
      }

      if (!workingStaff.has(date)) {
        workingStaff.set(date, new Map());
      }
      const dateTeams = workingStaff.get(date);
      if (!dateTeams.has(team)) {
        dateTeams.set(team, new Map());
      }
      dateTeams.get(team).set(staffName, {
        isLeader: TEAM_LEADER_NAMES.has(staffName),
        name: staffName,
      });
    });
  });

  const data = [];
  for (let date = startDate; date <= endDate;) {
    const day = getDayOfWeek(date);
    const dateTeams = workingStaff.get(date);
    const teamData = Object.create(null);

    teams.forEach((team) => {
      const membersByName = dateTeams && dateTeams.get(team);
      const members = membersByName
        ? Array.from(membersByName.values()).sort((left, right) => left.name.localeCompare(right.name))
        : [];
      const regularStaffCount = members.reduce(
        (count, member) => count + (member.isLeader ? 0 : 1),
        0
      );
      const warningLevel = getTeamWarningLevel(team, regularStaffCount, day);

      teamData[team] = {
        members,
        regularStaffCount,
        warningLevel,
      };
      recordWarning(warningStats[team], warningLevel);
    });

    data.push({
      date,
      day,
      isHoliday: holidays.has(date),
      teams: teamData,
    });

    if (date === endDate) {
      break;
    }
    date = addDays(date, 1);
  }

  return { data, teams, warningStats };
}

module.exports = {
  buildScheduleAnalysis,
  getTeamWarningLevel,
  resolveScheduleAnalysisPeriod,
};
