const async = require('async');

const { body, validationResult } = require('express-validator');
const { sanitizeBody } = require('express-validator');

// Require necessary database models
const { Entry, Content, Staff, Holiday, Schedule } = require('../sequelize');

// Display all Entries
exports.entry_list = function(req, res) {
  //res.send('NOT IMPLEMENTED: Entry List');

  Entry.findAll({ include: [{ model: Content }] }).then(data => res.render('entry', { entries: data }));
};

// Display Entry create form on GET
exports.entry_create_get = function(req, res) {
  //res.send('NOT IMPLEMENTED: Entry create GET');

  res.render('entryadd', {});
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
  //sanitizeBody('content1').escape(),

  (req, res) => {
    // Extract the validation errors from a request.
    const errors = validationResult(req);

    if (!errors.isEmpty()) {
      res.render('entryadd', { content: req.body, errors: errors.array() });
      return;
    } else {
      // Add data to database
      const input_data = {
        creator: req.body.creator,
        category: req.body.category,
        ismaster: req.body.ismaster ? 1 : 0,
        tag: req.body.tag,
        team: req.body.team,
        title: req.body.title,
        contents: []
      };
      //for (let i = 0; i < d.data.Content.length; i++) {
      input_data.contents.push({ data: req.body.content1 });
      //}

      // ismaster can only be added by approved staff
      let warning = '';
      if (input_data.ismaster == 1 && input_data.creator != 'Lennart') {
        input_data.ismaster = 0;
        warning = 'Can not add master data, added as personal data instead.';
      }

      Entry.create(input_data, { include: Entry.Content }).then(d => res.render('entryadded', { warning: warning }));
    }
  }
];

// Display Entry delete form on GET.
exports.entry_delete_get = function(req, res) {
  //res.send('NOT IMPLEMENTED: Entry delete GET');

  async.parallel(
    {
      entry: function(callback) {
        Entry.findAll({
          where: { id: req.params.id },
          include: [{ model: Content }]
        }).then(entry => callback(null, entry[0]));
      }
    },
    function(err, results) {
      if (err) {
        return next(err);
      }
      if (results.entry == null) {
        // No results.
        res.redirect('/entry');
      }
      // Successful, so render.
      res.render('entrydelete', { entry: results.entry });
    }
  );
};

// Handle Entry delete on POST.
exports.entry_delete_post = [
  // Validation fields
  body('creator')
    .isLength({ min: 1 })
    .trim()
    .withMessage('User ID is needed.')
    .isAlphanumeric()
    .withMessage('User ID has non-alphanumeric characters.'),

  // Sanitize fields
  sanitizeBody('creator').escape(),

  (req, res) => {
    // Extract the validation errors from a request.
    const errors = validationResult(req);

    if (!errors.isEmpty()) {
      res.render('entrydelete', { errors: errors.array() });
      return;
    } else {
      // Load data to be deleted from database
      async.parallel(
        {
          entry: function(callback) {
            Entry.findAll({
              where: { id: req.params.id },
              include: [{ model: Content }]
            }).then(entry => callback(null, entry[0]));
          }
        },
        function(err, results) {
          if (err) {
            return next(err);
          }
          if (results.entry == null) {
            // No results.
            res.redirect('/entry');
          }

          // Successful, so continue.
          // ismaster can only be deleted by approved staff
          let warning = '';
          if (results.entry.ismaster == 1 && req.body.creator != 'Lennart') {
            warning = 'You can not delete master data.';
            res.render('entrydeleted', { warning: warning });
          } else {
            // Delete data from database
            Content.destroy({ where: { entryId: req.params.id } }).then(d => {
              Entry.destroy({
                where: { id: req.params.id }
              }).then(d => res.render('entrydeleted', { warning: warning }));
            });
          }
        }
      );
    }
  }
];
/*entry_delete_post = function(req, res) {
  res.send('NOT IMPLEMENTED: Entry delete POST');
};*/

// Display Entry update form on GET.
exports.entry_update_get = function(req, res) {
  res.send('NOT IMPLEMENTED: Entry update GET');
};

// Handle Entry update on POST.
exports.entry_update_post = function(req, res) {
  res.send('NOT IMPLEMENTED: Entry update POST');
};
