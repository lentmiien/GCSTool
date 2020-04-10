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
        if (await bcrypt.compare(password, u[0].password)) {
          return done(null, u[0]);
        } else {
          const hashed_password = await bcrypt.hash(password, 10);
          console.log(hashed_password);
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

router.get('/', (req, res) => res.render('login', { role: 'guest' }));
router.post('/', passport.authenticate('local', { successRedirect: '/', failureRedirect: '/login' }));

// Export modules that are required elsewhere
pp.passport = passport;
pp.router = router;
module.exports = pp;
