const async = require('async');

// Require necessary database models
const { Entry, Content, User, Op } = require('../sequelize');

// Load admin data
exports.all = function (req, res, next) {
  if (req.user == undefined) {
    res.locals.role = 'guest';
    res.locals.name = 'Guest';
  } else {
    res.locals.role = req.user.role;
    res.locals.name = req.user.userid;
  }
  next();
};

exports.index = function (req, res) {
  let d = new Date();
  d = new Date(d.getFullYear(), d.getMonth() - 1, d.getDate());
  Entry.findAll({
    include: [{ model: Content }],
    order: [['updatedAt', 'DESC']],
    where: {
      //team: req.user['team'],
      updatedAt: {
        [Op.gt]: d,
      },
    },
  }).then((updated_within_last_month) => {
    const filtered = updated_within_last_month.filter((data) => data.ismaster == true || data.creator == req.user.userid);
    res.render('index', { entries: filtered });
  });
};

exports.about = function (req, res) {
  res.render('about', {});
};

exports.admin_get = function (req, res) {
  if (req.user.role === 'guest') {
    res.render('admin', { users: [] });
  } else {
    User.findAll().then((users) => {
      res.render('admin', { users: users });
    });
  }
};

exports.adduser = (req, res) => {
  if (req.user.role === 'admin') {
    User.create({ userid: req.body.newuserid, team: req.body.newteam, role: req.body.newrole }).then(() => {
      res.redirect('/admin');
    });
  } else {
    res.render('s_added', { message: 'Only admin staff can add users...' });
  }
};

exports.removeuser = (req, res) => {
  if (req.user.role === 'admin') {
    if (req.params.userid == 1) {
      res.redirect('/admin');
    } else {
      // Destroy data by this user [Issue #21]
      User.findAll({ where: { id: req.params.userid } }).then((user) => {
        console.log(user);
        Entry.findAll({
          where: {
            creator: user[0].userid,
            ismaster: false,
          },
          include: [{ model: Content }],
        }).then((data) => {
          data.forEach((d) => {
            Content.destroy({ where: { entryId: d.id } }).then((d2) => {
              Entry.destroy({
                where: { id: d.id },
              });
            });
          });
        });
        // Destroy user
        User.destroy({ where: { id: req.params.userid } }).then(() => {
          res.redirect('/admin');
        });
      });
    }
  } else {
    res.render('s_added', { message: 'Only admin staff can remove users...' });
  }
};
