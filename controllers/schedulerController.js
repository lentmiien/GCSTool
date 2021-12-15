const async = require('async');
// Require necessary database models
const { User, Staff, Holiday, Schedule2 } = require('../sequelize');

// Schedule change log
const scheduler_change_log = [];

// Display all Entries
exports.view = function (req, res) {
  if (req.user.role === 'guest') {
    res.render('scheduler', {
      data: {
        staff: [{ name: 'sample staff', dayoff1: 0, dayoff2: 6, schedules: [] }],
        holidays: [],
      },
    });
  } else {
    async.parallel(
      {
        staff: function (callback) {
          Staff.findAll({ include: [{ model: Schedule2 }] }).then((staff) => callback(null, staff));
        },
        holidays: function (callback) {
          Holiday.findAll().then((holidays) => callback(null, holidays));
        },
        users: function (callback) {
          User.findAll().then((users) => callback(null, users));
        },
      },
      function (err, results) {
        results.users.forEach((u) => {
          for (let i = 0; i < results.staff.length; i++) {
            if (u.userid == results.staff[i].name) {
              results.staff[i]['team'] = u.team;
            }
          }
        });
        res.render('scheduler', { data: results });
      }
    );
  }
};
exports.view2week = function (req, res) {
  if (req.user.role === 'guest') {
    res.render('scheduler', {
      data: {
        staff: [{ name: 'sample staff', dayoff1: 0, dayoff2: 6, schedules: [] }],
        holidays: [],
      },
    });
  } else {
    async.parallel(
      {
        staff: function (callback) {
          Staff.findAll({ include: [{ model: Schedule2 }] }).then((staff) => callback(null, staff));
        },
        holidays: function (callback) {
          Holiday.findAll().then((holidays) => callback(null, holidays));
        },
        users: function (callback) {
          User.findAll().then((users) => callback(null, users));
        },
      },
      function (err, results) {
        results.users.forEach((u) => {
          for (let i = 0; i < results.staff.length; i++) {
            if (u.userid == results.staff[i].name) {
              results.staff[i]['team'] = u.team;
            }
          }
        });
        res.render('scheduler_compact', { data: results });
      }
    );
  }
};
exports.viewlastmonth = function (req, res) {
  if (req.user.role === 'guest') {
    res.render('scheduler', {
      data: {
        staff: [{ name: 'sample staff', dayoff1: 0, dayoff2: 6, schedules: [] }],
        holidays: [],
      },
    });
  } else {
    async.parallel(
      {
        staff: function (callback) {
          Staff.findAll({ include: [{ model: Schedule2 }] }).then((staff) => callback(null, staff));
        },
        holidays: function (callback) {
          Holiday.findAll().then((holidays) => callback(null, holidays));
        },
        users: function (callback) {
          User.findAll().then((users) => callback(null, users));
        },
      },
      function (err, results) {
        results.users.forEach((u) => {
          for (let i = 0; i < results.staff.length; i++) {
            if (u.userid == results.staff[i].name) {
              results.staff[i]['team'] = u.team;
            }
          }
        });
        res.render('scheduler_last_month', { data: results });
      }
    );
  }
};

// Display add holiday form on GET
exports.add_holiday_get = function (req, res) {
  Holiday.findAll().then((holidays) => {
    const d = new Date();
    const show_holidays = {};
    show_holidays[d.getFullYear()] = [];
    show_holidays[d.getFullYear() + 1] = [];

    // Acquire holidays
    holidays.forEach(h => {
      const this_year = h.date.split('-')[0];
      if (show_holidays[this_year]) {
        show_holidays[this_year].push({id: h.id, date: h.date});
      }
    });

    // Sort acquired holidays
    show_holidays[d.getFullYear()].sort((a, b) => {
      if (a.date < b.date) return -1;
      else if (a.date > b.date) return 1;
      else return 0;
    });
    show_holidays[d.getFullYear() + 1].sort((a, b) => {
      if (a.date < b.date) return -1;
      else if (a.date > b.date) return 1;
      else return 0;
    });

    res.render('s_holidayadd', {holidays: show_holidays});
  });
};

// Handle add holiday create on POST.
exports.add_holiday_post = function (req, res) {
  Holiday.findAll({ where: { date: req.body.date } }).then((r) => {
    if (r.length > 0) {
      res.render('s_added', { message: 'Holiday already existing!' });
    } else {
      const input_data = {
        date: req.body.date,
      };

      if (req.user.role === 'admin') {
        Holiday.create(input_data).then(() => {
          // res.render('s_added', { message: 'Holiday added!' });
          res.redirect('/scheduler/addholiday');
        });
      } else {
        res.render('s_added', { message: 'Only admin users can add holidays.' });
      }
    }
  });
};

// Delete an holiday
exports.delete_holiday = (req, res) => {
  Holiday.destroy({where: {id: req.body.id}});
  res.json({status: 'OK'});
};

// Display add schedule form on GET
exports.add_schedule_get = function (req, res) {
  Staff.findAll().then((staff) => {
    res.render('s_scheduleadd', { staff: staff });
  });
};

// Handle add schedule create on POST.
exports.add_schedule_post = function (req, res) {
  if (req.user.role === 'admin') {
    if (req.body.dates.length > 0) {
      const date_array = req.body.dates.split(';');
      date_array.forEach((element) => {
        Schedule2.findAll({ where: { date: element, staffId: req.body.staff } }).then((s) => {
          if (s.length == 0) {
            // Add new schedule
            Schedule2.create({ date: element, work: req.body.work, staffId: req.body.staff });
          } else {
            // Update existing schedule
            Schedule2.update({ work: req.body.work }, { where: { id: s[0].id } });
          }
        });
      });
      res.render('s_added', { message: 'Schedule updated!' });
    } else {
      Schedule2.findAll({ where: { date: req.body.date, staffId: req.body.staff } }).then((s) => {
        if (s.length == 0) {
          // Add new schedule
          Schedule2.create({ date: req.body.date, work: req.body.work, staffId: req.body.staff }).then(() => {
            res.render('s_added', { message: 'Schedule added!' });
          });
        } else {
          // Update existing schedule
          Schedule2.update({ work: req.body.work }, { where: { id: s[0].id } }).then(() => {
            res.render('s_added', { message: 'Schedule updated!' });
          });
        }
      });
    }
  } else {
    res.render('s_added', { message: 'Only admin users can add schedules.' });
  }
};

// Display add staff form on GET
exports.add_staff_get = function (req, res) {
  res.render('s_staffadd', {});
};

// Handle add staff create on POST.
exports.add_staff_post = function (req, res) {
  if (req.user.role === 'admin') {
    const input_data = {
      name: req.body.name,
      day0: req.body.nichi,
      day1: req.body.getu,
      day2: req.body.ka,
      day3: req.body.sui,
      day4: req.body.moku,
      day5: req.body.kin,
      day6: req.body.do,
    };
    Staff.create(input_data).then(() => {
      res.render('s_added', { message: 'Staff added!' });
    });
  } else {
    res.render('s_added', { message: 'Only admin users can add staff.' });
  }
};

// Display add staff form on GET
exports.edit_staff_get = function (req, res) {
  if (req.query.id) {
    // Do stuff
    Staff.findAll({ where: { id: req.query.id } }).then((staff) => {
      if (staff.length > 0) {
        res.render('s_staffedit', { staff: staff[0] });
      } else {
        res.redirect('/scheduler/addstaff');
      }
    });
  } else {
    res.redirect('/scheduler/addstaff');
  }
};

// Handle add staff create on POST.
exports.edit_staff_post = function (req, res) {
  if (req.user.role === 'admin') {
    const input_data = {
      name: req.body.name,
      day0: req.body.nichi,
      day1: req.body.getu,
      day2: req.body.ka,
      day3: req.body.sui,
      day4: req.body.moku,
      day5: req.body.kin,
      day6: req.body.do,
    };
    Staff.update(input_data, { where: { id: req.query.id } }).then(() => {
      res.render('s_added', { message: 'Staff edited!' });
    });
  } else {
    res.render('s_added', { message: 'Only admin users can edit staff.' });
  }
};

// Generate schedule
exports.generate_schedule = function (req, res) {
  // Aquire input
  const update_id = req.query.id;
  const days = [req.body.sch0, req.body.sch1, req.body.sch2, req.body.sch3, req.body.sch4, req.body.sch5, req.body.sch6];
  const startdate = req.body.startdate;
  const enddate = req.body.enddate;
  const edit_settings = req.body.settings;//onlywork,onlyworkoff,workoffholiday,all

  // Process input
  if (req.user.role === 'admin') {
    Holiday.findAll().then((holidays) => {
      const hol_list = [];
      holidays.forEach(h => hol_list.push(h.date));
      let s_date = startdate.split('-');
      let e_date = enddate.split('-');
      let d = new Date(parseInt(s_date[0]), parseInt(s_date[1]) - 1, parseInt(s_date[2]));
      let ed = new Date(parseInt(e_date[0]), parseInt(e_date[1]) - 1, parseInt(e_date[2]));
      while (d.getTime() <= ed.getTime()) {
        const element = `${d.getFullYear()}-${d.getMonth() > 8 ? d.getMonth() + 1 : '0' + (d.getMonth() + 1)}-${
          d.getDate() > 9 ? d.getDate() : '0' + d.getDate()
        }`;
        let work = days[d.getDay()];
        if (hol_list.indexOf(element) >= 0 && (edit_settings == "workoffholiday" || edit_settings == "all")) {
          work = "holiday";
        }
        Schedule2.findAll({ where: { date: element, staffId: update_id } }).then((s) => {
          if (s.length == 0) {
            // Add new schedule
            Schedule2.create({ date: element, work: work, staffId: update_id });
          } else if (s[0].work != work) {
            if (s[0].work == 'work' || s[0].work == 'telwork') {
              // work and telwork can be updated with all settings
              Schedule2.update({ work: work }, { where: { id: s[0].id } });
            } else if (s[0].work == 'off' && edit_settings != "onlywork") {
              // off can be modified by all settings, except for onlywork
              Schedule2.update({ work: work }, { where: { id: s[0].id } });
            } else if (s[0].work == 'holiday' && (edit_settings == "workoffholiday" || edit_settings == "all")) {
              // holiday can only be modified by workoffholiday or all settings
              Schedule2.update({ work: work }, { where: { id: s[0].id } });
            } else if (edit_settings == "all") {
              // only all settings can modify the remaining statuses (like reset all)
              Schedule2.update({ work: work }, { where: { id: s[0].id } });
            }
            // Cases not included above can NOT be modified, so ignore
          }
        });

        d = new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1);
      }
    });
    res.render('s_added', { message: 'Schedule updated!' });
  } else {
    res.render('s_added', { message: 'Only admin users can batch update schedules.' });
  }
};

// Display remove staff form on GET
exports.remove_staff_get = function (req, res) {
  Staff.findAll().then((staff) => {
    res.render('s_staffremove', { staff: staff });
  });
};

// Handle remove staff create on POST.
exports.remove_staff_post = function (req, res) {
  if (req.user.role === 'admin') {
    Staff.destroy({ where: { id: req.body.staff } }).then(() => {
      Schedule2.destroy({ where: { staffId: req.body.staff } }).then(() => {
        res.render('s_added', { message: 'Staff removed!' });
      });
    });
  } else {
    res.render('s_added', { message: 'Only admin users can remove staff.' });
  }
};

// Display personal schedule
exports.display_personal_schedule = async function (req, res) {
  const staff_name = await Staff.findOne({ where: { id: req.params.id } });
  const schedule = {};
  Schedule2.findAll({ where: { staffId: req.params.id } }).then((schedule_data) => {
    schedule_data.forEach((entry) => {
      const date = entry.date.split('-');
      if (parseInt(date[0]) == parseInt(req.query.year)) {
        schedule[`${parseInt(date[0])}-${parseInt(date[1]) - 1}-${parseInt(date[2])}`] = entry.work;
      }
    });
    res.render('s_personal_schedule', { id: req.params.id, schedule, schedule_name: staff_name.name, show_year: req.query.year });
  });
};

// Generate 1 year schedule
exports.generate_personal_schedule = function (req, res) {
  let target_year = parseInt(req.query.year);
  if (req.user.role === 'admin') {
    Staff.findAll({ where: { id: req.params.id } }).then((staff) => {
      let d = new Date(target_year, 0, 1);
      while (d.getFullYear() == target_year) {
        const element = `${d.getFullYear()}-${d.getMonth() > 8 ? d.getMonth() + 1 : '0' + (d.getMonth() + 1)}-${
          d.getDate() > 9 ? d.getDate() : '0' + d.getDate()
        }`;
        let work = staff[0][`day${d.getDay()}`];
        Schedule2.findAll({ where: { date: element, staffId: req.params.id } }).then((s) => {
          if (s.length == 0) {
            // Add new schedule
            Schedule2.create({ date: element, work: work, staffId: req.params.id });
          } else {
            // Update existing schedule, only if work, telwork or off
            if (s[0].work == 'work' || s[0].work == 'telwork' || s[0].work == 'off') {
              Schedule2.update({ work: work }, { where: { id: s[0].id } });
            }
          }
        });

        d = new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1);
      }
    });
    res.render('s_added', { message: 'Schedule updated!' });
  } else {
    res.render('s_added', { message: 'Only admin users can add schedules.' });
  }
};

// Display mail team schedule
exports.display_team_schedule = function (req, res) {
  const schedule = {};
  Schedule2.findAll().then((schedule_data) => {
    schedule_data.forEach((entry) => {
      const date = entry.date.split('-');
      if (parseInt(date[0]) == 2020) {
        const d_string = `${parseInt(date[0])}-${parseInt(date[1]) - 1}-${parseInt(date[2])}`;
        if (schedule[d_string] == undefined) {
          schedule[d_string] = {};
          schedule[d_string]['work'] = entry.work == 'off' || entry.work == 'holiday' || entry.work == 'vacation' ? 'closed' : 'open';
          schedule[d_string]['staff'] = 0;
        }
        if (!(entry.work == 'off' || entry.work == 'holiday' || entry.work == 'vacation')) {
          schedule[d_string]['work'] = 'open';
          schedule[d_string]['staff']++;
        }
      }
    });
    res.render('s_team_schedule', { schedule });
  });
};

exports.update_schedule = (req, res) => {
  // input: req.body  (POST request data -> date[2020-01-01], status[work], staff[5])
  // output: res.json({year, month, date, status, staff_id})  (If you are not allowed to change, then return original values)

  // If you are an admin user, then you can update anyones schedule
  // If you are a user, then you can only update your own schedule

  if (req.user.role === 'admin') {
    Schedule2.findAll({ where: { date: req.body.date, staffId: req.body.staff } }).then((s) => {
      if (s.length == 0) {
        // Log
        scheduler_change_log.push({
          change_staff_id: req.body.staff,
          change_date: req.body.date,
          change_from: '---',
          change_to: req.body.status,
          updated_by: req.user.userid,
          updated_date: Date.now(),
        });
        // Add new schedule
        Schedule2.create({ date: req.body.date, work: req.body.status, staffId: req.body.staff }).then(() => {
          res.json({ date: req.body.date, status: req.body.status, staff: req.body.staff });
        });
      } else {
        // Log
        scheduler_change_log.push({
          change_staff_id: req.body.staff,
          change_date: req.body.date,
          change_from: s[0].work,
          change_to: req.body.status,
          updated_by: req.user.userid,
          updated_date: Date.now(),
        });
        // Update existing schedule
        Schedule2.update({ work: req.body.status }, { where: { id: s[0].id } }).then(() => {
          res.json({ date: req.body.date, status: req.body.status, staff: req.body.staff });
        });
      }
    });
  } else {
    Staff.findAll({ where: { id: req.body.staff } }).then((this_staff) => {
      if (this_staff[0].name == req.user.userid) {
        Schedule2.findAll({ where: { date: req.body.date, staffId: req.body.staff } }).then((s) => {
          if (s.length == 0) {
            // Log
            scheduler_change_log.push({
              change_staff_id: req.body.staff,
              change_date: req.body.date,
              change_from: '---',
              change_to: req.body.status,
              updated_by: req.user.userid,
              updated_date: Date.now(),
            });
            // Add new schedule
            Schedule2.create({ date: req.body.date, work: req.body.status, staffId: req.body.staff }).then(() => {
              res.json({ date: req.body.date, status: req.body.status, staff: req.body.staff });
            });
          } else {
            // Log
            scheduler_change_log.push({
              change_staff_id: req.body.staff,
              change_date: req.body.date,
              change_from: s[0].work,
              change_to: req.body.status,
              updated_by: req.user.userid,
              updated_date: Date.now(),
            });
            // Update existing schedule
            Schedule2.update({ work: req.body.status }, { where: { id: s[0].id } }).then(() => {
              res.json({ date: req.body.date, status: req.body.status, staff: req.body.staff });
            });
          }
        });
      } else {
        res.json({ date: 0, status: 0, staff: 0 });
      }
    });
  }
};

exports.view_changelog = (req, res) => {
  Staff.findAll().then((staff) => {
    const change_by_staff = {};
    staff.forEach(s => {
      change_by_staff[s.id] = {
        name: s.name,
        changes: [],
      };
    });
    scheduler_change_log.forEach(log => {
      change_by_staff[log.change_staff_id].changes.push({
        date: log.change_date,
        from: log.change_from,
        to: log.change_to,
        by: log.updated_by,
        timestamp: log.updated_date,
      });
    });
    const keys = Object.keys(change_by_staff);
    keys.forEach(key => {
      change_by_staff[key].changes.sort((a, b) => {
        if (a.timestamp < b.timestamp) {
          return -1;
        } else if (a.timestamp > b.timestamp) {
          return 1;
        } else {
          return 0;
        }
      });
      change_by_staff[key].changes.sort((a, b) => {
        if (a.date < b.date) {
          return -1;
        } else if (a.date > b.date) {
          return 1;
        } else {
          return 0;
        }
      });
    });
    res.render('scheduler_change_log', { change_by_staff, keys });
  });
};
/*
scheduler_change_log.push({
  change_staff_id: req.body.staff,
  change_date: req.body.date,
  change_from: '---',
  change_to: req.body.status,
  updated_by: req.user.userid,
  updated_date: Date.now(),
});
*/

// Analyze for potential problems
exports.analyze_schedule = function (req, res) {
  if (req.user.role === 'admin' || req.user.userid === 'Yokoyama') {
    async.parallel(
      {
        staff: function (callback) {
          Staff.findAll({ include: [{ model: Schedule2 }] }).then((staff) => callback(null, staff));
        },
        holidays: function (callback) {
          Holiday.findAll().then((holidays) => callback(null, holidays));
        },
        users: function (callback) {
          User.findAll().then((users) => callback(null, users));
        },
      },
      function (err, results) {
        const teams = [];
        results.users.forEach((u) => {
          if (teams.indexOf(u.team) == -1) {
            teams.push(u.team);
          }
          for (let i = 0; i < results.staff.length; i++) {
            if (u.userid == results.staff[i].name) {
              results.staff[i]['team'] = u.team;
            }
          }
        });
        const schedule = [];
        let d = new Date(parseInt(req.query.year), 0, 1);
        if (d.getTime() < Date.now()) {
          d = new Date();
        }
        for(; d.getFullYear() == req.query.year; d = new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1)) {
          let dstr = `${d.getFullYear()}-${d.getMonth() > 8 ? (d.getMonth() + 1) : '0' + (d.getMonth() + 1)}-${d.getDate() > 9 ? d.getDate() : '0' + d.getDate()}`;
          const index = schedule.length;
          schedule.push({date : dstr, day: d.getDay()});
          teams.forEach(team => {
            schedule[index][team] = {staff: 0, kanri: 0, stafflist: ''};
          });
          results.staff.forEach(staff => {
            staff.schedule2s.forEach(schedule_day => {
              if(dstr == schedule_day.date) {
                // not (off, holiday, vacation)
                if(!(schedule_day.work == 'off' || schedule_day.work == 'holiday' || schedule_day.work == 'vacation')) {
                  if(staff.name == 'Lennart' || staff.name == 'Nick' || staff.name == 'Hwang' || staff.name == 'Yokoyama') {
                    schedule[index][staff.team].kanri++;
                  } else {
                    schedule[index][staff.team].staff++;
                  }
                  schedule[index][staff.team].stafflist += staff.name + ',';
                }
              }
            });
          });
        }
        const holidays = [];
        results.holidays.forEach(h => {
          if (h.date.split('-')[0] == req.query.year) {
            holidays.push(h.date);
          }
        });
        res.render('analyze_schedule', { data: schedule, teams, year: req.query.year, holidays });
      }
    );
  } else {
    res.redirect('/scheduler');
  }
};

exports.schedule_csv = (req, res) => {
  if (req.user.role === 'admin' || req.user.userid === 'Yokoyama') {
    // Access DB
    async.parallel(
      {
        staff: function (callback) {
          Staff.findAll({ include: [{ model: Schedule2 }] }).then((staff) => callback(null, staff));
        },
        holidays: function (callback) {
          Holiday.findAll().then((holidays) => callback(null, holidays));
        },
      },
      function (err, results) {
        const year = parseInt(req.query.year);
        const holidays = [];
        results.holidays.forEach(holiday => {
          const hdate = new Date(holiday.date);
          if (hdate.getFullYear() == year) {
            holidays.push(holiday.date);
          }
        });
        const year_schedule = [];// 1 row per date, date in first column, followed by 1 column per staff member
        const year_lookup = [];
        for (let d = new Date(year, 0, 1); d.getFullYear() == year; d = new Date(d.getFullYear(), d.getMonth(), d.getDate()+1)) {
          const d_str = `${d.getFullYear()}-${d.getMonth() > 8 ? d.getMonth() + 1 : '0' + (d.getMonth()+1)}-${d.getDate() > 9 ? d.getDate() : '0' + d.getDate()}`;
          year_schedule.push([d_str]);
          year_lookup.push(d_str);
        }
        const year_schedule_headder = ['日付'];// Followed by 1 column per staff member
        const year_schedule_fotter1 = ['合計出勤(242)'];// Followed by 1 column per staff member
        const year_schedule_fotter2 = ['合計定休(102)'];// Followed by 1 column per staff member
        const year_schedule_fotter3 = ['合計祝日(21)'];// Followed by 1 column per staff member
        const schedule_changes = [];// 1 entry per staff member, specifying all changes from default schedule
        results.staff.forEach((staff, i) => {
          year_schedule_headder.push(staff.name);
          year_schedule_fotter1.push(0);
          year_schedule_fotter2.push(0);
          year_schedule_fotter3.push(0);
          schedule_changes.push({
            name: staff.name,
            changes: []
          });
          
          // Loop scheduled
          staff.schedule2s.forEach(schedule_day => {
            const sd = new Date(schedule_day.date);
            if(sd.getFullYear() == year) {
              let regular_schedule = staff[`day${sd.getDay()}`];
              if (holidays.indexOf(schedule_day.date) >= 0) {
                regular_schedule = 'holiday';
              }

              // Populate data
              const index = year_lookup.indexOf(schedule_day.date);
              if (schedule_day.work == 'off') {
                year_schedule_fotter2[i+1]++;
                year_schedule[index][i+1] = "定休";
              } else if (schedule_day.work == 'holiday') {
                year_schedule_fotter3[i+1]++;
                year_schedule[index][i+1] = "祝日";
              } else {
                year_schedule_fotter1[i+1]++;
                year_schedule[index][i+1] = "出勤";
              }
              // Handle changes
              const converter = {
                holiday: "祝日",
                telwork: "出勤",
                work: "出勤",
                vacation: "出勤",
                off: "定休",
              };
              if (converter[regular_schedule] != converter[schedule_day.work]) {
                schedule_changes[i].changes.push([schedule_day.date, `${converter[regular_schedule]}　→　${converter[schedule_day.work]}`]);
              }
            }
          });
        });

        let outdata = year_schedule_headder.join(",") + "\n";
        year_schedule.forEach(entry => {
          outdata += entry.join(",") + "\n";
        });
        outdata += year_schedule_fotter1.join(",") + "\n";
        outdata += year_schedule_fotter2.join(",") + "\n";
        outdata += year_schedule_fotter3.join(",") + "\n";

        schedule_changes.forEach(sc => {
          outdata += "\n" + sc.name + "\n";
          sc.changes.forEach(c => {
            outdata += c.join(",") + "\n";
          });
        });

        // Return CSV data
        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', `attachment; filename="schedule_${year}.csv"`);
        res.send(outdata);
      }
    );
  } else {
    res.redirect('/scheduler');
  }
};