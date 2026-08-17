// Require used packages
const express = require('express');
const router = express.Router();
const passport = require('passport');
const LocalStrategy = require('passport-local').Strategy;
const { verifyPassword } = require('./utils/password');

// Require necessary database models
const { User } = require('./sequelize');

// Export variable
const pp = {};

// Various initialize
passport.use(
  new LocalStrategy(async (username, password, done) => {
    try {
      if (typeof username !== 'string' || typeof password !== 'string' || username.length > 100 || password.length > 128) {
        return done(null, false);
      }

      const user = await User.findOne({ where: { userid: username } });
      if (!user || !(await verifyPassword(password, user.password))) {
        return done(null, false);
      }
      return done(null, user);
    } catch (error) {
      return done(error);
    }
  })
);

passport.serializeUser((user, done) => {
  done(null, user.id);
});

passport.deserializeUser(async (id, done) => {
  try {
    const user = await User.findOne({ where: { id } });
    return done(null, user || false);
  } catch (error) {
    return done(error);
  }
});

router.get('/', (req, res) => res.render('login', {}));
router.post('/', passport.authenticate('local', { successRedirect: '/', failureRedirect: '/login' }));

// Export modules that are required elsewhere
pp.passport = passport;
pp.router = router;
module.exports = pp;
