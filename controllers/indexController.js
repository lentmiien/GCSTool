const async = require('async');

// Require necessary database models
const { Entry, Content, Admin, Op } = require('../sequelize');

// Load admin data
exports.all = function(req, res, next) {
  Admin.findAll().then(admin => {
    req.body['admin'] = admin;
    req.body['isadmin'] = false;
    if (!(req.body.creator === undefined)) {
      admin.forEach(ad => {
        if (ad.userid === req.body.creator) {
          req.body['isadmin'] = true;
        }
      });
    }
    next();
  });
};

exports.index = function(req, res) {
  let d = new Date();
  d = new Date(d.getFullYear(), d.getMonth() - 1, d.getDate());
  Entry.findAll({
    include: [{ model: Content }],
    order: [['updatedAt', 'DESC']],
    where: {
      updatedAt: {
        [Op.gt]: d.getFullYear() + '-' + (d.getMonth() + 1) + '-' + d.getDate()
      }
    }
  }).then(entry => {
    res.render('index', { title: 'GCS Tool', request: req.body, entries: entry });
  });
};

exports.about = function(req, res) {
  res.render('about', { title: 'GCS Tool', request: req.body });
};

exports.admin_get = function(req, res) {
  res.render('admin', { request: req.body });
};

exports.adminadd_get = function(req, res) {
  res.render('adminadd', { request: req.body });
};

exports.adminadd_post = function(req, res) {
  if (req.body.isadmin == false) {
    res.render('s_added', { message: 'Only admin staff can add admin staff...', request: req.body });
  } else {
    Admin.create({ userid: req.body.userid }).then(() => {
      res.render('s_added', { message: req.body.userid + ' added!', request: req.body });
    });
  }
};

exports.adminremove_get = function(req, res) {
  res.render('adminremove', { request: req.body });
};

exports.adminremove_post = function(req, res) {
  if (req.body.isadmin == false) {
    res.render('s_added', { message: 'Only admin staff can remove admin staff...', request: req.body });
  } else {
    Admin.destroy({ where: { id: req.body.userid } }).then(() => {
      res.render('s_added', { message: 'Admin user removed.', request: req.body });
    });
  }
};

//////// TEMPORARY ////////
exports.transferpersonal_get = function(req, res) {
  res.render('transferpersonal', { request: req.body });
};

//////// TEMPORARY ////////
exports.transferpersonal_post = function(req, res) {
  // Save the incomming json data as personal data entries in database
  const personal_data = JSON.parse(req.body.personaldata);

  personal_data.Entries.forEach(d => {
    const input_data = {
      creator: req.body.creator,
      category: d.type,
      ismaster: 0,
      tag: d.category,
      team: d.team,
      title: d.data.Title,
      contents: []
    };
    for (let i = 0; i < d.data.Content.length; i++) {
      input_data.contents.push({ data: d.data.Content[i] });
    }
    Entry.create(input_data, { include: Entry.Content });
  });

  res.render('s_added', { message: 'Personal data added to database!', request: req.body });
};
