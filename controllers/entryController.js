const { body, validationResult } = require('express-validator/check');
const { sanitizeBody } = require('express-validator/filter');

// Require necessary database models
const { Entry, Content, Staff, Holiday, Schedule } = require('../sequelize');

// Display all Entries
exports.entry_list = function(req, res) {
  //res.send('NOT IMPLEMENTED: Entry List');

  Entry.findAll({ include: [{ model: Content }] }).then(users => res.render('entry', { users: users }));
};

// Display Entry create form on GET
exports.entry_create_get = function(req, res) {
  //res.send('NOT IMPLEMENTED: Entry create GET');

  res.render('newentry', {});
};

// Handle Entry create on POST.
exports.entry_create_post = [
  // Validation fields
  body('creator')
    .isLength({ min: 1 })
    .trim()
    .withMessage('User ID is needed.')
    .isAlphanumeric()
    .withMessage('User ID has non-alphanumeric characters.'),
  body('title')
    .isLength({ min: 1 })
    .trim()
    .withMessage('A title is needed.'),
  body('content1')
    .isLength({ min: 1 })
    .trim()
    .withMessage('Content#1 is needed.'),

  // Sanitize fields
  sanitizeBody('creator').escape(),
  sanitizeBody('title').escape(),
  sanitizeBody('content1').escape(),

  (req, res) => {
    // Extract the validation errors from a request.
    const errors = validationResult(req);

    if (!errors.isEmpty()) {
      res.render('newentry', { errors: errors.array() });
      return;
    } else {
      // Add data to database

      res.render('entryadded', {});
    }
  }
];
/*
exports.entry_create_post = function(req, res) {
  //res.send('NOT IMPLEMENTED: Entry create POST');

  // Check sent data
  // If error re-render page with error message
  // res.render('newentry', { error: 'Invalid tag' });

  // If all OK: Save to database
  // Render added page
  res.render('entryadded', {});
};
*/

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
