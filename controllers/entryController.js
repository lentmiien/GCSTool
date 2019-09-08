// Require necessary database models
const { Entry, Content, Staff, Holiday, Schedule } = require('../sequelize');

// Display all Entries
exports.entry_list = function(req, res) {
  //res.send('NOT IMPLEMENTED: Entry List');

  Entry.findAll({ include: [{ model: Content }] }).then(users => res.render('users', { users: users }));
};

// Display Entry create form on GET
exports.entry_create_get = function(req, res) {
  res.send('NOT IMPLEMENTED: Entry create GET');
};

// Handle Entry create on POST.
exports.entry_create_post = function(req, res) {
  res.send('NOT IMPLEMENTED: Entry create POST');
};

// Display Entry delete form on GET.
exports.entry_delete_get = function(req, res) {
  res.send('NOT IMPLEMENTED: Entry delete GET');
};

// Handle Entry delete on POST.
exports.entry_delete_post = function(req, res) {
  res.send('NOT IMPLEMENTED: Entry delete POST');
};

// Display Entry update form on GET.
exports.entry_update_get = function(req, res) {
  res.send('NOT IMPLEMENTED: Entry update GET');
};

// Handle Entry update on POST.
exports.entry_update_post = function(req, res) {
  res.send('NOT IMPLEMENTED: Entry update POST');
};
