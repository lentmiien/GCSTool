const async = require('async');
const axios = require('axios');
var parseString = require('xml2js').parseString;

// Require necessary database models
const { Entry, Content, User, Op } = require('../sequelize');

const timekeeper = [];

const jpnews = {
  lastupdated: 0,
  data: {}
};

// Load admin data
exports.all = function (req, res, next) {
  res.locals.role = req.user.role;
  res.locals.name = req.user.userid;

  // Acquire JP news (at most once every 6 hours)
  if (Date.now() - jpnews.lastupdated > (1000 * 60 * 60 * 6)) {
    jpnews.lastupdated = Date.now();
    axios.get('https://www.post.japanpost.jp/rss/int.xml')
      .then(function (response) {
        // handle success
        jpnews.data['raw'] = response.data;
        // xml to json
        parseString(response.data, (err, result) => {
          jpnews.data['json'] = result.rss.channel[0].item;
        });
      })
      .catch(function (error) {
        // handle error
        console.log(error);
      });
  }
  res.locals.jp = jpnews.data['json'];

  // Time keeper
  if (req.user.userid) {
    const d = new Date(Date.now() + (1000 * 60 * 60 * 9)); // +9 hours for Japanese time
    let exist = false;
    const dstr = `${d.getFullYear()}-${d.getMonth() > 8 ? d.getMonth() + 1 : '0' + (d.getMonth() + 1)}-${d.getDate() > 9 ? d.getDate() : '0' + d.getDate()}`;
    timekeeper.forEach((entry) => {
      if (entry.datestr === dstr) {
        exist = true;
        if (entry[req.user.userid]) {
          entry[req.user.userid].last = Date.now();
        } else {
          entry[req.user.userid] = {
            first: Date.now(),
            last: Date.now(),
          };
        }
      }
    });
    if (!exist) {
      // Create new
      const input = { datestr: dstr };
      input[req.user.userid] = {
        first: Date.now(),
        last: Date.now(),
      };
      timekeeper.push(input);

      // Remove old entries
      if (timekeeper.length > 31) {
        timekeeper.shift();
      }
    }
  }

  next();
};

exports.view_timekeeper = (req, res) => {
  if (req.user.role === 'admin') {
    timekeeper.sort((a, b) => {
      if (a.datestr < b.datestr) {
        return 1;
      } else if (a.datestr > b.datestr) {
        return -1;
      } else {
        return 0;
      }
    });
    res.render('timekeeper', { timekeeper });
  } else {
    res.redirect('/');
  }
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
    User.create({ userid: req.body.newuserid, password: '', team: req.body.newteam, role: req.body.newrole }).then(() => {
      res.redirect('/admin');
    });
  } else {
    res.render('s_added', { message: 'Only admin staff can add users...' });
  }
};

exports.change_name = (req, res) => {
  const id_to_change = parseInt(req.params.id);
  const change_to_name = req.params.name;
  if (req.user.role === 'admin' && id_to_change > 1) {
    User.update({ userid: change_to_name }, { where: { id: id_to_change } });
    return res.json({ status: 'OK' });
  }
  return res.json({ status: 'FAILED' });
};

exports.reset_password = (req, res) => {
  const id_to_reset = parseInt(req.params.id);
  if (req.user.role === 'admin' && id_to_reset > 1) {
    User.update({ password: '' }, { where: { id: id_to_reset } });
    return res.json({ status: 'OK' });
  }
  return res.json({ status: 'FAILED' });
};

exports.change_team = (req, res) => {
  const id_to_change = parseInt(req.params.id);
  const change_to_team = req.params.team;
  if (req.user.role === 'admin' && id_to_change > 1) {
    User.update({ team: change_to_team }, { where: { id: id_to_change } });
    return res.json({ status: 'OK' });
  }
  return res.json({ status: 'FAILED' });
};

exports.make_admin = (req, res) => {
  const id_to_change = parseInt(req.params.id);
  if (req.user.role === 'admin' && id_to_change > 1) {
    User.update({ role: 'admin' }, { where: { id: id_to_change } });
    return res.json({ status: 'OK' });
  }
  return res.json({ status: 'FAILED' });
};

exports.make_user = (req, res) => {
  const id_to_change = parseInt(req.params.id);
  if (req.user.role === 'admin' && id_to_change > 1) {
    User.update({ role: 'user' }, { where: { id: id_to_change } });
    return res.json({ status: 'OK' });
  }
  return res.json({ status: 'FAILED' });
};

exports.removeuser = (req, res) => {
  if (req.user.role === 'admin') {
    if (req.params.userid == 1) {
      res.redirect('/admin');
    } else {
      // Destroy data by this user [Issue #21]
      User.findAll({ where: { id: req.params.userid } }).then((user) => {
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
