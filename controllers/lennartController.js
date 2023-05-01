// Constants
const AIT_UPDATES_CONTENT_ID = -1;

// Require necessary database models
const { Content } = require('../sequelize');

// Run for every connection (verify/log users, etc.)
exports.all = function (req, res, next) {
  // This endpoint is for Lennart test stuff
  if (req.user.userid == 'Lennart') {
    next();
  } else {
    res.redirect('/');
  }
};

// Landing page
exports.index = (req, res) => {
  res.render('lennart_top');
};

// Update the AIT manual content, need to set AIT_UPDATES_CONTENT_ID to correct id value to work
exports.updateait = (req, res) => {
  if (AIT_UPDATES_CONTENT_ID != -1) {
    Content.update({ data: req.body.data }, { where: { id: AIT_UPDATES_CONTENT_ID } }).then(() => {
      res.json({ status: 'updated!' });
    });
  } else {
    res.json({ status: "Can't update index -1, please set AIT_UPDATES_CONTENT_ID to correct value and restart server..." });
  }
};
