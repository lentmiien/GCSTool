const async = require('async');
// Require necessary database models
const { Staff, Holiday, Schedule } = require('../sequelize');

// Display all Entries
exports.index = function(req, res) {
  //res.send('NOT IMPLEMENTED: Entry List');

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

// // Display Entry create form on GET
// exports.entry_create_get = function (req, res) {
//     res.send('NOT IMPLEMENTED: Entry create GET');
// };

// // Handle Entry create on POST.
// exports.entry_create_post = function (req, res) {
//     res.send('NOT IMPLEMENTED: Entry create POST');
// };

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
