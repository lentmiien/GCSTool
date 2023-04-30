var createError = require('http-errors');
var express = require('express');
var path = require('path');
var cookieParser = require('cookie-parser');
var logger = require('morgan');
var session = require('express-session');

const pp = require('./passport_init');

var indexRouter = require('./routes/index');
var entryRouter = require('./routes/entry');
var schedulerRouter = require('./routes/scheduler');
var meetingRouter = require('./routes/meeting');
var countryRouter = require('./routes/country');
var apiRouter = require('./routes/api');
var binpackRouter = require('./routes/binpack');
var hsRouter = require('./routes/hs');
var trackerRouter = require('./routes/tracker');
var shipcostRouter = require('./routes/shipcost');
var lennartRouter = require('./routes/lennart');
var formRouter = require('./routes/form');
const chatgptRouter = require('./routes/chatgpt');

var app = express();

const {} = require('./sequelize');

// view engine setup
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'pug');

app.use(logger('dev'));
app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ limit: '2mb', extended: false }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));
const sessionMiddleware = session({ secret: process.env.SESSION_SECRET, resave: false, saveUninitialized: false, cookie: { maxAge: 8640000000 } });
app.use(sessionMiddleware);
app.use(pp.passport.initialize());
app.use(pp.passport.session());

app.use('/login', requireNotAuthenticated, pp.router);
app.use('/', requireAuthenticated, indexRouter);
app.use('/entry', requireAuthenticated, entryRouter);
app.use('/scheduler', requireAuthenticated, schedulerRouter);
app.use('/meeting', requireAuthenticated, meetingRouter);
app.use('/country', requireAuthenticated, countryRouter);
app.use('/api', requireAuthenticated, apiRouter);
app.use('/binpack', requireAuthenticated, binpackRouter);
app.use('/hs', requireAuthenticated, hsRouter);
app.use('/tracker', requireAuthenticated, trackerRouter);
app.use('/shipcost', requireAuthenticated, shipcostRouter);
app.use('/lennart', requireAuthenticated, lennartRouter);
app.use('/form', requireAuthenticated, formRouter);
app.use('/chatgpt', requireAuthenticated, chatgptRouter);

app.get('/logout', (req, res, next) => {
  req.logOut(function(err) {
    if (err) { return next(err); }
    res.redirect('/');
  });
});

// catch 404 and forward to error handler
app.use(function (req, res, next) {
  next(createError(404));
});

// error handler
app.use(function (err, req, res, next) {
  // set locals, only providing error in development
  res.locals.message = err.message;
  res.locals.error = req.app.get('env') === 'development' ? err : {};

  // render the error page
  res.status(err.status || 500);
  res.render('error', { request: req.body });
});

// Autenthication checks
function requireAuthenticated(req, res, next) {
  if (req.isAuthenticated()) {
    return next();
  }
  res.locals.role = 'guest';
  res.locals.name = 'Guest';
  res.redirect('/login');
}
function requireNotAuthenticated(req, res, next) {
  if (req.isAuthenticated()) {
    return res.redirect('/');
  }
  res.locals.role = 'guest';
  res.locals.name = 'Guest';
  next();
}

module.exports = {app, sessionMiddleware};
