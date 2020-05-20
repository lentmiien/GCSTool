// Require used packages
const express = require('express');
const router = express.Router();
const passport = require('passport');
const LocalStrategy = require('passport-local').Strategy;
const bcrypt = require('bcrypt');

// Require necessary database models
const { User } = require('./sequelize');

// Export variable
const pp = {};

// Various initialize
passport.use(
  new LocalStrategy(async (username, password, done) => {
    User.findAll({ where: { userid: username } }).then(async (u) => {
      if (u.length == 0) {
        return done(null, false);
      }
      try {
        const usepsw = u[0].password ? u[0].password : '';
        if (await bcrypt.compare(password, usepsw)) {
          return done(null, u[0]);
        } else {
          if (usepsw.length == 0) {
            const hashed_password = await bcrypt.hash(password, 10);
            User.update({ password: hashed_password }, { where: { userid: username } });
            return done(null, u[0]);
          }
          return done(null, false);
        }
      } catch (e) {
        return done(e);
      }
    });
  })
);

passport.serializeUser((user, done) => {
  done(null, user.id);
});

passport.deserializeUser((id, done) => {
  User.findOne({ where: { id } }).then((u) => {
    done(null, u);
  });
});

router.get('/', (req, res) => res.render('login', {}));
router.post('/', passport.authenticate('local', { successRedirect: '/', failureRedirect: '/login' }));

// Export modules that are required elsewhere
pp.passport = passport;
pp.router = router;
module.exports = pp;
