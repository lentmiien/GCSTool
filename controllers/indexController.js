const async = require('async');

// Require necessary database models
const { Entry, Content, User, Op } = require('../sequelize');

// Load admin data
exports.all = function(req, res, next) {
  req.body['userid'] = 'guest';
  req.body['team'] = 'guest';
  req.body['role'] = 'guest';
  if (!(req.cookies.userid === undefined)) {
    User.findAll({ where: { userid: req.cookies.userid } }).then(users => {
      if (users.length > 0) {
        req.body['userid'] = users[0].userid;
        req.body['team'] = users[0].team;
        req.body['role'] = users[0].role;
      }
      next();
    });
  } else {
    next();
  }
};

exports.index = function(req, res) {
  let d = new Date();
  d = new Date(d.getFullYear(), d.getMonth() - 1, d.getDate());
  Entry.findAll({
    include: [{ model: Content }],
    order: [['updatedAt', 'DESC']],
    where: {
      team: req.body['team'],
      updatedAt: {
        [Op.gt]: d
      }
    }
  }).then(updated_within_last_month => {
    res.render('index', { request: req.body, entries: updated_within_last_month });
  });
};

exports.about = function(req, res) {
  res.render('about', { request: req.body });
};

exports.admin_get = function(req, res) {
  if (req.body.role === 'guest') {
    res.render('admin', { users: [], request: req.body });
  } else {
    User.findAll().then(users => {
      res.render('admin', { users: users, request: req.body });
    });
  }
};

exports.adduser = (req, res) => {
  if (req.body.role === 'admin') {
    User.create({ userid: req.body.newuserid, team: req.body.newteam, role: req.body.newrole }).then(() => {
      res.redirect('/admin');
    });
  } else {
    res.render('s_added', { message: 'Only admin staff can add users...', request: req.body });
  }
};

exports.removeuser = (req, res) => {
  if (req.body.role === 'admin') {
    if (req.params.userid == 1) {
      res.redirect('/admin');
    } else {
      User.destroy({ where: { id: req.params.userid } }).then(() => {
        res.redirect('/admin');
      });
    }
  } else {
    res.render('s_added', { message: 'Only admin staff can remove users...', request: req.body });
  }
};

exports.adminadd_get = function(req, res) {
  res.render('adminadd', { request: req.body });
};

exports.adminadd_post = function(req, res) {
  if (req.body.role === 'admin') {
    User.create({ userid: req.body.newuserid, team: req.body.newteam, role: req.body.newrole }).then(() => {
      res.render('s_added', { message: req.body.newuserid + ' added!', request: req.body });
    });
  } else {
    res.render('s_added', { message: 'Only admin staff can add users...', request: req.body });
  }
};

exports.adminremove_get = function(req, res) {
  User.findAll().then(users => {
    res.render('adminremove', { users: users, request: req.body });
  });
};

exports.adminremove_post = function(req, res) {
  if (req.body.role === 'admin') {
    User.destroy({ where: { id: req.body.userindex } }).then(() => {
      // TODO: Destroy data by this user [Issue #21]
      res.render('s_added', { message: 'User removed.', request: req.body });
    });
  } else {
    res.render('s_added', { message: 'Only admin staff can remove users...', request: req.body });
  }
};

//////// TEMPORARY: Transfer data from old tool ////////
exports.transferpersonal_get = function(req, res) {
  console.log(req.body);
  res.render('transferpersonal', { request: req.body });
};

//////// TEMPORARY: Transfer data from old tool ////////
exports.transferpersonal_post = function(req, res) {
  // Save the incomming json data as personal data entries in database
  const personal_data = JSON.parse(req.body.personaldata);

  personal_data.Entries.forEach(d => {
    const input_data = {
      creator: req.body.userid,
      category: d.type,
      ismaster: 0,
      tag: d.category,
      team: req.body.team,
      title: d.data.Title,
      contents: []
    };
    for (let i = 0; i < d.data.Content.length; i++) {
      input_data.contents.push({ data: d.data.Content[i] });
    }
    console.log(input_data);
    Entry.create(input_data, { include: Entry.Content });
  });

  res.render('s_added', { request: req.body, message: 'Personal data added to database!' });
};
