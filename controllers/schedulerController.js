const async = require('async');
// Require necessary database models
const { Staff, Holiday, Schedule } = require('../sequelize');

// Display all Entries
exports.view = function(req, res) {
  if (req.body.role === 'guest') {
    res.render('scheduler', {
      data: {
        staff: [{ name: 'sample staff', dayoff1: 0, dayoff2: 6, schedules: [] }],
        holidays: []
      },
      request: req.body
    });
  } else {
    async.parallel(
      {
        staff: function(callback) {
          Staff.findAll({ include: [{ model: Schedule }] }).then(staff => callback(null, staff));
        },
        holidays: function(callback) {
          Holiday.findAll().then(holidays => callback(null, holidays));
        }
      },
      function(err, results) {
        res.render('scheduler', { data: results, request: req.body });
      }
    );
  }
};

// Display add holiday form on GET
exports.add_holiday_get = function(req, res) {
  res.render('s_holidayadd', { request: req.body });
};

// Handle add holiday create on POST.
exports.add_holiday_post = function(req, res) {
  Holiday.findAll({ where: { date: req.body.date } }).then(r => {
    if (r.length > 0) {
      res.render('s_added', { message: 'Holiday already existing!', request: req.body });
    } else {
      const input_data = {
        date: req.body.date
      };

      if (req.body.role === 'admin') {
        Holiday.create(input_data).then(() => {
          res.render('s_added', { message: 'Holiday added!', request: req.body });
        });
      } else {
        res.render('s_added', { message: 'Only admin users can add holidays.', request: req.body });
      }
    }
  });
};

// Display add schedule form on GET
exports.add_schedule_get = function(req, res) {
  Staff.findAll().then(staff => {
    res.render('s_scheduleadd', { staff: staff, request: req.body });
  });
};

// Handle add schedule create on POST.
exports.add_schedule_post = function(req, res) {
  if (req.body.role === 'admin') {
    Schedule.findAll({ where: { date: req.body.date, staffId: req.body.staff } }).then(s => {
      if (s.length == 0) {
        // Add new schedule
        Schedule.create({ date: req.body.date, work: req.body.work, staffId: req.body.staff }).then(() => {
          res.render('s_added', { message: 'Schedule added!', request: req.body });
        });
      } else {
        // Update existing schedule
        Schedule.update({ work: req.body.work }, { where: { id: s[0].id } }).then(() => {
          res.render('s_added', { message: 'Schedule updated!', request: req.body });
        });
      }
    });
  } else {
    res.render('s_added', { message: 'Only admin users can add schedules.', request: req.body });
  }
};

// Display add staff form on GET
exports.add_staff_get = function(req, res) {
  res.render('s_staffadd', { request: req.body });
};

// Handle add staff create on POST.
exports.add_staff_post = function(req, res) {
  if (req.body.role === 'admin') {
    const input_data = {
      name: req.body.name,
      dayoff1: req.body.dayoff1,
      dayoff2: req.body.dayoff2
    };
    Staff.create(input_data).then(() => {
      res.render('s_added', { message: 'Staff added!', request: req.body });
    });
  } else {
    res.render('s_added', { message: 'Only admin users can add staff.', request: req.body });
  }
};

// Display remove staff form on GET
exports.remove_staff_get = function(req, res) {
  Staff.findAll().then(staff => {
    res.render('s_staffremove', { staff: staff, request: req.body });
  });
};

// Handle remove staff create on POST.
exports.remove_staff_post = function(req, res) {
  if (req.body.role === 'admin') {
    Staff.destroy({ where: { id: req.body.staff } }).then(() => {
      Schedule.destroy({ where: { staffId: req.body.staff } }).then(() => {
        res.render('s_added', { message: 'Staff removed!', request: req.body });
      });
    });
  } else {
    res.render('s_added', { message: 'Only admin users can remove staff.', request: req.body });
  }
};
