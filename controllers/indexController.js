const async = require('async');
const axios = require('axios');
var parseString = require('xml2js').parseString;

// Require necessary database models
const { Entry, Content, User, Username, Op, Staff, Holiday, Schedule2 } = require('../sequelize');

const timekeeper = [];

const jpnews = {
  lastupdated: 0,
  data: {}
};

// Load admin data
exports.all = async function (req, res, next) {
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

  // Load workschedule
  res.locals.workschedule = { days: [] };
  const schedule = await Staff.findAll({ include: [{ model: Schedule2 }], where: { name: req.user.userid } });
  let today = new Date();
  today = new Date(today.getFullYear(), today.getMonth(), today.getDate(), today.getHours() + 9);// Add 9 hours for Japanese time
  for(let i = 0; i < 7; i++) {
    const mm = today.getMonth() > 8 ? (today.getMonth()+1).toString() : '0' + (today.getMonth()+1);
    const dd = today.getDate() > 9 ? (today.getDate()).toString() : '0' + (today.getDate());
    res.locals.workschedule.days.push({
      category: null,
      date: `${today.getFullYear()}-${mm}-${dd}`,
      schedule: null
    });
    today = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1, today.getHours());// +1 day loop
  }
  for(let i = 0; i < res.locals.workschedule.days.length; i++) {
    schedule[0].schedule2s.forEach(s => {
      if(s.date == res.locals.workschedule.days[i].date) {
        // full / mix / off
        res.locals.workschedule.days[i].category = s.work.indexOf('work') >= 0 ? 'ws_full' : (s.work == 'off' || s.work == 'holiday' || s.work == 'vacation') ? 'ws_off' : 'ws_mix';
        res.locals.workschedule.days[i].schedule = s.work;
      }
    });
  }

  // Holiday schedule next week
  res.locals.holidays_next_week = [];
  const date_lookup = [];
  const staff_schedule = await Staff.findAll({ include: [{ model: Schedule2 }] });
  const holidays = await Holiday.findAll();
  const names = await Username.findAll();
  const work_statuses = ["work", "halfoff_e", "halfoff_m", "2hoff_e", "2hoff_m", "telwork"];

  const d = new Date();
  const sd = new Date(d.getFullYear(), d.getMonth(), d.getDate() + (7-d.getDay()));
  const ed = new Date(d.getFullYear(), d.getMonth(), d.getDate() + (14-d.getDay()));
  const sd_str = `${sd.getFullYear()}-${sd.getMonth() > 8 ? (sd.getMonth()+1) : '0'+(sd.getMonth()+1)}-${sd.getDate() > 9 ? sd.getDate() : '0'+sd.getDate()}`;
  const ed_str = `${ed.getFullYear()}-${ed.getMonth() > 8 ? (ed.getMonth()+1) : '0'+(ed.getMonth()+1)}-${ed.getDate() > 9 ? ed.getDate() : '0'+ed.getDate()}`;

  const namesLookup = {};
  for (let i = 0; i < names.length; i++) {
    namesLookup[names[i].userid] = names[i].name;
  }

  holidays.forEach(h => {
    if (h.date >= sd_str && h.date <= ed_str) {
      date_lookup.push(h.date);
      res.locals.holidays_next_week.push({
        date: h.date,
        work_staff: [],
        staff_names: [],
        message_title: "",
        message_body: "",
      });
    }
  });
  staff_schedule.forEach(s => {
    s.schedule2s.forEach(c => {
      //{date, work}
      const index = date_lookup.indexOf(c.date);
      if (index >= 0) {
        // off, vacation, holiday
        // work, halfoff_e, halfoff_m, 2hoff_e, 2hoff_m, telwork
        if (work_statuses.indexOf(c.work) >= 0) {
          res.locals.holidays_next_week[index].work_staff.push(s.name);
          res.locals.holidays_next_week[index].staff_names.push(namesLookup[s.name] ? namesLookup[s.name] : `[${s.name}]`);
        }
      }
    });
  });
  const months = ["１", "２", "３", "４", "５", "６", "７", "８", "９", "１０", "１１", "１２"];
  const dates = ["０", "１", "２", "３", "４", "５", "６", "７", "８", "９", "１０", "１１", "１２", "１３", "１４", "１５", "１６", "１７", "１８", "１９", "２０", "２１", "２２", "２３", "２４", "２５", "２６", "２７", "２８", "２９", "３０", "３１"];
  const days = ["日", "月", "火", "水", "木", "金", "土"];
  for (let i = 0; i < res.locals.holidays_next_week.length; i++) {
    const hd = new Date(res.locals.holidays_next_week[i].date);
    res.locals.holidays_next_week[i].message_title = `依頼／${months[hd.getMonth()]}月${dates[hd.getDate()]}日の在宅勤務　リモート制限解除（ＶＰＮ接続）`;
    res.locals.holidays_next_week[i].message_body = `ＶＰＮ接続を維持してください。\n\n${months[hd.getMonth()]}月${dates[hd.getDate()]}日（${days[hd.getDay()]}）：\n${res.locals.holidays_next_week[i].staff_names.join('\n')}`;
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
