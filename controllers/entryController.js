const async = require('async');

const { body, validationResult } = require('express-validator');

// Require necessary database models
const { Entry, Content } = require('../sequelize');

// Display all Entries
exports.entry_list = function (req, res) {
  async.parallel(
    {
      entry: function (callback) {
        Entry.findAll({
          include: [{ model: Content }],
          where: { team: req.user.team },
          order: [
            ['tag', 'ASC'],
            ['category', 'DESC'],
            ['ismaster', 'DESC'],
            ['updatedAt', 'DESC'],
          ],
        }).then((entry) => callback(null, entry));
      },
    },
    function (err, results) {
      if (err) {
        return next(err);
      }
      let search = '';
      if (req.query.search) {
        search = req.query.search;
        console.log(search);
      }

      // Successful, so render.
      res.render('entry', { entries: results.entry });
    }
  );
};

// Display Entry create form on GET
exports.entry_create_get = function (req, res) {
  res.render('entryadd', { request: {} });
};

// Copy entry
exports.entry_createcopy_get = function (req, res) {
  async.parallel(
    {
      entry: function (callback) {
        Entry.findAll({
          where: { id: req.params.id },
          include: [{ model: Content }],
        }).then((entry) => callback(null, entry[0]));
      },
    },
    function (err, results) {
      if (err) {
        return next(err);
      }
      if (results.entry == null) {
        // No results.
        res.redirect('/entry');
      }
      // Input data in req.body
      Object.keys(results.entry.dataValues).forEach((key, index) => {
        req.body[key] = results.entry.dataValues[key];
      });
      for (let ci = 0; ci < results.entry.dataValues['contents'].length; ci++) {
        req.body['content' + (ci + 1)] = results.entry.dataValues['contents'][ci].dataValues.data;
      }
      // Successful, so render.
      res.render('entryadd', { request: req.body });
    }
  );
};

// Handle Entry create on POST.
exports.entry_create_post = [
  // Validation fields
  body('title').isLength({ min: 1 }).trim().withMessage('A title is needed.'),
  body('content1').isLength({ min: 1 }).trim().withMessage('Content 1 is needed.'),

  (req, res) => {
    // Extract the validation errors from a request.
    const errors = validationResult(req);

    if (!errors.isEmpty()) {
      res.render('entryadd', { errors: errors.array(), request: req.body });
      return;
    } else {
      // Guest users can not add data
      if (req.user.role === 'guest') {
        res.render('entryadded', { warning: 'Non-registered users can not add data...' });
      } else {
        // Add data to database
        const input_data = {
          creator: req.user.userid,
          category: req.body.category,
          ismaster: req.body.ismaster ? 1 : 0,
          tag: req.body.tag,
          team: req.body.team,
          title: req.body.title,
          contents: [],
        };

        input_data.contents.push({ data: req.body.content1 });
        if (req.body.content2.length > 0) {
          input_data.contents.push({ data: req.body.content2 });
        }
        if (req.body.content3.length > 0) {
          input_data.contents.push({ data: req.body.content3 });
        }
        if (req.body.content4.length > 0) {
          input_data.contents.push({ data: req.body.content4 });
        }
        if (req.body.content5.length > 0) {
          input_data.contents.push({ data: req.body.content5 });
        }

        // ismaster can only be added by approved staff
        let warning = '';
        if (input_data.ismaster == 1 && !(req.user.role === 'admin')) {
          input_data.ismaster = 0;
          warning = 'You can not add master data, added as personal data instead.';
        }

        Entry.create(input_data, { include: Entry.Content }).then((d) => {
          res.render('entryadded', { warning: warning });
        });
      }
    }
  },
];

// Display Entry delete form on GET.
exports.entry_delete_get = function (req, res) {
  //res.send('NOT IMPLEMENTED: Entry delete GET');

  async.parallel(
    {
      entry: function (callback) {
        Entry.findAll({
          where: { id: req.params.id },
          include: [{ model: Content }],
        }).then((entry) => callback(null, entry[0]));
      },
    },
    function (err, results) {
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
exports.entry_delete_post = (req, res) => {
  // Load data to be deleted from database
  async.parallel(
    {
      entry: function (callback) {
        Entry.findAll({
          where: { id: req.params.id },
          include: [{ model: Content }],
        }).then((entry) => callback(null, entry[0]));
      },
    },
    function (err, results) {
      if (err) {
        return next(err);
      }
      if (results.entry == null) {
        // No results.
        res.redirect('/entry');
      }

      // Guest users can not remove data
      if (req.user.role === 'guest') {
        res.render('entrydeleted', { warning: 'Non-registered users can not remove data...' });
      } else {
        // Successful, so continue.
        // ismaster can only be deleted by approved staff
        let warning = '';
        if (results.entry.ismaster == 1 && !(req.user.role === 'admin')) {
          warning = 'You can not delete master data.';
          res.render('entrydeleted', { warning: warning });
        } else {
          // Delete data from database
          Content.destroy({ where: { entryId: req.params.id } }).then((d) => {
            Entry.destroy({
              where: { id: req.params.id },
            }).then((d) => res.render('entrydeleted', { warning: warning }));
          });
        }
      }
    }
  );
};

// Display Entry update form on GET.
exports.entry_update_get = function (req, res) {
  //res.send('NOT IMPLEMENTED: Entry update GET');

  async.parallel(
    {
      entry: function (callback) {
        Entry.findAll({
          where: { id: req.params.id },
          include: [{ model: Content }],
        }).then((entry) => callback(null, entry[0]));
      },
    },
    function (err, results) {
      if (err) {
        return next(err);
      }
      if (results.entry == null) {
        // No results.
        res.redirect('/entry');
      }
      // Successful, so render.
      res.render('entryupdate', { entry: results.entry });
    }
  );
};

// Handle Entry update on POST.
exports.entry_update_post = [
  // Validation fields
  body('title').isLength({ min: 1 }).trim().withMessage('A title is needed.'),

  (req, res) => {
    // Extract the validation errors from a request.
    const errors = validationResult(req);

    if (!errors.isEmpty()) {
      res.render('entryupdate', { errors: errors.array() });
      return;
    } else {
      async.parallel(
        {
          entry: function (callback) {
            Entry.findAll({
              where: { id: req.params.id },
              include: [{ model: Content }],
            }).then((entry) => callback(null, entry[0]));
          },
        },
        function (err, results) {
          if (err) {
            return next(err);
          }
          if (results.entry == null) {
            // No results.
            res.redirect('/entry');
          }

          // Guest users can not update data
          if (req.user.role === 'guest') {
            res.render('entryupdated', { warning: 'Non-registered users can not update data...' });
          } else {
            // Successful, so continue.
            // ismaster can only be updated by approved staff
            const update_data = {
              category: req.body.category,
              ismaster: req.body.ismaster ? 1 : 0,
              tag: req.body.tag,
              team: req.body.team,
              title: req.body.title,
            };

            // ismaster can only be updated by approved staff
            let warning = '';
            if (false && results.entry.ismaster == 1 && !(req.user.role === 'admin')) {
              warning = 'You can not update master data.';
              res.render('entryupdated', { warning: warning });
            } else {
              // Update database data
              Entry.update(update_data, {
                where: { id: req.params.id },
              }).then((d) =>
                async.parallel(
                  {
                    content1: function (callback) {
                      if (req.body.contentid1 != undefined) {
                        if (req.body.content1.length > 0) {
                          Content.update({ data: req.body.content1 }, { where: { id: req.body.contentid1 } }).then((r) =>
                            callback(null, r)
                          );
                        } else {
                          Content.destroy({
                            where: { id: req.body.contentid1 },
                          }).then((r) => callback(null, r));
                        }
                      } else {
                        if (req.body.content1.length > 0) {
                          Content.create({
                            data: req.body.content1,
                            entryId: req.params.id,
                          }).then((r) => callback(null, r));
                        } else {
                          callback(null, null);
                        }
                      }
                    },
                    content2: function (callback) {
                      if (req.body.contentid2 != undefined) {
                        if (req.body.content2.length > 0) {
                          Content.update({ data: req.body.content2 }, { where: { id: req.body.contentid2 } }).then((r) =>
                            callback(null, r)
                          );
                        } else {
                          Content.destroy({
                            where: { id: req.body.contentid2 },
                          }).then((r) => callback(null, r));
                        }
                      } else {
                        if (req.body.content2.length > 0) {
                          Content.create({
                            data: req.body.content2,
                            entryId: req.params.id,
                          }).then((r) => callback(null, r));
                        } else {
                          callback(null, null);
                        }
                      }
                    },
                    content3: function (callback) {
                      if (req.body.contentid3 != undefined) {
                        if (req.body.content3.length > 0) {
                          Content.update({ data: req.body.content3 }, { where: { id: req.body.contentid3 } }).then((r) =>
                            callback(null, r)
                          );
                        } else {
                          Content.destroy({
                            where: { id: req.body.contentid3 },
                          }).then((r) => callback(null, r));
                        }
                      } else {
                        if (req.body.content3.length > 0) {
                          Content.create({
                            data: req.body.content3,
                            entryId: req.params.id,
                          }).then((r) => callback(null, r));
                        } else {
                          callback(null, null);
                        }
                      }
                    },
                    content4: function (callback) {
                      if (req.body.contentid4 != undefined) {
                        if (req.body.content4.length > 0) {
                          Content.update({ data: req.body.content4 }, { where: { id: req.body.contentid4 } }).then((r) =>
                            callback(null, r)
                          );
                        } else {
                          Content.destroy({
                            where: { id: req.body.contentid4 },
                          }).then((r) => callback(null, r));
                        }
                      } else {
                        if (req.body.content4.length > 0) {
                          Content.create({
                            data: req.body.content4,
                            entryId: req.params.id,
                          }).then((r) => callback(null, r));
                        } else {
                          callback(null, null);
                        }
                      }
                    },
                    content5: function (callback) {
                      if (req.body.contentid5 != undefined) {
                        if (req.body.content5.length > 0) {
                          Content.update({ data: req.body.content5 }, { where: { id: req.body.contentid5 } }).then((r) =>
                            callback(null, r)
                          );
                        } else {
                          Content.destroy({
                            where: { id: req.body.contentid5 },
                          }).then((r) => callback(null, r));
                        }
                      } else {
                        if (req.body.content5.length > 0) {
                          Content.create({
                            data: req.body.content5,
                            entryId: req.params.id,
                          }).then((r) => callback(null, r));
                        } else {
                          callback(null, null);
                        }
                      }
                    },
                  },
                  function (err, results) {
                    if (err) {
                      return next(err);
                    }
                    // Successful, so render.
                    res.render('entryupdated', { warning: warning });
                  }
                )
              );
            }
          }
        }
      );
    }
  },
];

// Backup
exports.backup = function (req, res) {
  async.parallel(
    {
      entry: function (callback) {
        Entry.findAll({
          include: [{ model: Content }],
          where: { team: req.params.team },
          order: [
            ['tag', 'ASC'],
            ['category', 'DESC'],
            ['ismaster', 'DESC'],
            ['updatedAt', 'DESC'],
          ],
        }).then((entry) => callback(null, entry));
      },
    },
    function (err, results) {
      if (err) {
        return next(err);
      }

      // Successful, so render.
      res.render('backup', { data: JSON.stringify(results.entry) });
    }
  );
};

// Handle Entry create on POST.
exports.restore = async (req, res) => {
  // Aquire form data #restore (JSON format) and parse to JSON
  const data = await JSON.parse(req.body.restore);

  // Only admin are allowed to add date
  if (req.user.role === 'admin') {
    // Prepare data to add to database
    const input_data = [];
    data.forEach((d) => {
      const index = input_data.length;
      input_data.push({
        creator: d.creator,
        category: d.category,
        ismaster: d.ismaster,
        tag: d.tag,
        team: d.team,
        title: d.title,
        contents: [],
      });
      for (let i = 0; i < d.contents.length; i++) {
        input_data[index].contents.push({
          data: d.contents[i].data,
        });
      }
    });

    // Bulk add all data to database
    Entry.bulkCreate(input_data, { include: Entry.Content });
  }

  // Redirect to start page
  res.redirect('/');
};
