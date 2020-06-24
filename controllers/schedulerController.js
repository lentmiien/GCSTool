const async = require('async');
// Require necessary database models
const { Staff, Holiday, Schedule2 } = require('../sequelize');

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
      },
      function (err, results) {
        res.render('scheduler', { data: results });
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
      dayoff1: req.body.dayoff1,
      dayoff2: req.body.dayoff2,
    };
    Staff.create(input_data).then(() => {
      res.render('s_added', { message: 'Staff added!' });
    });
  } else {
    res.render('s_added', { message: 'Only admin users can add staff.' });
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
exports.display_personal_schedule = function (req, res) {
  const schedule = {};
  Schedule2.findAll({ where: { staffId: req.params.id } }).then((schedule_data) => {
    schedule_data.forEach((entry) => {
      const date = entry.date.split('-');
      if (parseInt(date[0]) == 2020) {
        schedule[`${parseInt(date[0])}-${parseInt(date[1]) - 1}-${parseInt(date[2])}`] = entry.work;
      }
    });
    res.render('s_personal_schedule', { id: req.params.id, schedule });
  });
};

// Generate 1 year schedule
exports.generate_personal_schedule = function (req, res) {
  if (req.user.role === 'admin') {
    Staff.findAll({ where: { id: req.params.id } }).then((staff) => {
      let d = new Date(2020, 0, 1);
      while (d.getFullYear() == 2020) {
        const element = `${d.getFullYear()}-${d.getMonth() > 8 ? d.getMonth() + 1 : '0' + (d.getMonth() + 1)}-${
          d.getDate() > 9 ? d.getDate() : '0' + d.getDate()
        }`;
        let work = 'work';
        if (d.getDay() == staff[0].dayoff1 || d.getDay() == staff[0].dayoff2) {
          work = 'off';
        }
        Schedule2.findAll({ where: { date: element, staffId: req.params.id } }).then((s) => {
          if (s.length == 0) {
            // Add new schedule
            Schedule2.create({ date: element, work: work, staffId: req.params.id });
          } else {
            // Update existing schedule
            Schedule2.update({ work: work }, { where: { id: s[0].id } });
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
        // Add new schedule
        Schedule2.create({ date: req.body.date, work: req.body.status, staffId: req.body.staff }).then(() => {
          res.json({ date: req.body.date, status: req.body.status, staff: req.body.staff });
        });
      } else {
        // Update existing schedule
        Schedule2.update({ work: req.body.status }, { where: { id: s[0].id } }).then(() => {
          res.json({ date: req.body.date, status: req.body.status, staff: req.body.staff });
        });
      }
    });
  } else {
    // TODO: implement
    res.json({ date: 0, status: 0, staff: 0 });
  }
};
