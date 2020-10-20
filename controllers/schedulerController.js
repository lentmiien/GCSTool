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

// Display add holiday form on GET
exports.add_holiday_get = function (req, res) {
  res.render('s_holidayadd', {});
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
          res.render('s_added', { message: 'Holiday added!' });
        });
      } else {
        res.render('s_added', { message: 'Only admin users can add holidays.' });
      }
    }
  });
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

  // Process input
  if (req.user.role === 'admin') {
    Staff.findAll({ where: { id: update_id } }).then((staff) => {
      let s_date = startdate.split('-');
      let e_date = enddate.split('-');
      let d = new Date(parseInt(s_date[0]), parseInt(s_date[1]) - 1, parseInt(s_date[2]));
      let ed = new Date(parseInt(e_date[0]), parseInt(e_date[1]) - 1, parseInt(e_date[2]));
      while (d.getTime() <= ed.getTime()) {
        const element = `${d.getFullYear()}-${d.getMonth() > 8 ? d.getMonth() + 1 : '0' + (d.getMonth() + 1)}-${
          d.getDate() > 9 ? d.getDate() : '0' + d.getDate()
        }`;
        let work = days[d.getDay()];
        Schedule2.findAll({ where: { date: element, staffId: update_id } }).then((s) => {
          if (s.length == 0) {
            // Add new schedule
            Schedule2.create({ date: element, work: work, staffId: update_id });
          } else {
            // Update existing schedule, only if work, telwork or off
            if (s[0].work == 'work' || s[0].work == 'telwork' || s[0].work == 'off') {
              Schedule2.update({ work: work }, { where: { id: s[0].id } });
            } else if (!(s[0].work == 'holiday' || s[0].work == 'vacation') && work == 'off') {
              Schedule2.update({ work: work }, { where: { id: s[0].id } });
            }
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
    const staff_id = {};
    staff.forEach(s => {
      staff_id[s.id] = s.name;
    });
    res.render('scheduler_change_log', { log: scheduler_change_log, staff_id });
  });
};

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
            schedule[index][team] = {staff: 0, kanri: 0};
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
                }
              }
            });
          });
        }
        res.render('analyze_schedule', { data: schedule, teams, year: req.query.year });
      }
    );
  } else {
    res.redirect('/scheduler');
  }
};
