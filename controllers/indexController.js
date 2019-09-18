const async = require('async');

// Require necessary database models
const { Admin } = require('../sequelize');

// Load admin data
exports.all = function(req, res, next) {
  Admin.findAll().then(admin => {
    req.body['admin'] = admin;
    next();
  });
};

exports.index = function(req, res) {
  res.render('index', { title: 'GCS Tool', request: req.body });
};

exports.about = function(req, res) {
  res.render('about', { title: 'GCS Tool', request: req.body });
};
