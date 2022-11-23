// Run for every connection (verify/log users, etc.)
exports.all = function (req, res, next) {
  // This endpoint is for Lennart test stuff
  if (req.user.userid == "Lennart") {
    next();
  } else {
    res.redirect("/");
  }
};

// Landing page
exports.index = (req, res) => {
  res.render('lennart_top');
};