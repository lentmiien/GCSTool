const async = require('async');
// Require necessary database models
const { Staff, Holiday, Schedule } = require('../sequelize');

// Display all Entries
exports.view = function(req, res) {
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
};

// Display add holiday form on GET
exports.add_holiday_get = function(req, res) {
  res.render('s_holidayadd', { request: req.body });
};

// Handle add holiday create on POST.
exports.add_holiday_post = function(req, res) {
  Holiday.findAll({ where: { date: req.body.date } }).then(r => {
    if (r.length > 0) {
      res.render('s_holidayadded', { message: 'Holiday already existing!', request: req.body });
    } else {
      const input_data = {
        date: req.body.date
      };

      if (req.body.creator != 'Lennart') {
        res.render('s_holidayadded', { message: 'You can not add holidays!', request: req.body });
      } else {
        Holiday.create(input_data).then(() => {
          res.render('s_holidayadded', { message: 'Holiday added!', request: req.body });
        });
      }
    }
  });
};

// // Display Entry delete form on GET.
// exports.entry_delete_get = function (req, res) {
//     res.send('NOT IMPLEMENTED: Entry delete GET');
// };

// // Handle Entry delete on POST.
// exports.entry_delete_post = function (req, res) {
//     res.send('NOT IMPLEMENTED: Entry delete POST');
// };

// // Display Entry update form on GET.
// exports.entry_update_get = function (req, res) {
//     res.send('NOT IMPLEMENTED: Entry update GET');
// };

// // Handle Entry update on POST.
// exports.entry_update_post = function (req, res) {
//     res.send('NOT IMPLEMENTED: Entry update POST');
// };
