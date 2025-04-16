var createError = require('http-errors');
var express = require('express');
var path = require('path');
var cookieParser = require('cookie-parser');
const i18n = require('i18n');
var logger = require('morgan');
var session = require('express-session');
const Sequelize = require('sequelize');
const SequelizeStore = require('connect-session-sequelize')(session.Store);
const fileUpload = require('express-fileupload');

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
const ctRouter = require('./routes/ct');
const pmtRouter = require('./routes/pmt');

var app = express();

const {} = require('./sequelize');

// Configure i18n
i18n.configure({
  locales: ['en', 'jp', 'sv'], // Supported languages
  directory: __dirname + '/locales', // Path for translation files
  defaultLocale: 'en',              // Default language
  cookie: 'lang',                   // Optional: store language in cookies
  autoReload: true,                 // Reload translation files automatically
  updateFiles: true                 // Allow adding new keys to JSON
});

// Setup session store
const sequelize = new Sequelize(process.env.DB_NAME_GCS, process.env.DB_USER, process.env.DB_PASS, {
  host: process.env.DB_HOST,
  dialect: 'mysql',
  logging: false,
});
const sessionStore = new SequelizeStore({
  db: sequelize,
  checkExpirationInterval: 15*60*1000,
  expiration: 8640000000
});

// view engine setup
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'pug');

app.use(
  logger('combined', {
    skip: function (req, res) {
      return res.statusCode < 400;
    },
  })
);
app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ limit: '2mb', extended: false }));
app.use(cookieParser());
app.use(i18n.init);
app.use(express.static(path.join(__dirname, 'public')));
app.use(fileUpload());
const sessionMiddleware = session({
  secret: process.env.SESSION_SECRET,
  store: sessionStore,
  resave: false,
  // proxy: true,
  saveUninitialized: false,
  cookie: { secure: false, maxAge: 8640000000 },
});
app.use(sessionMiddleware);
app.use(pp.passport.initialize());
app.use(pp.passport.session());
sessionStore.sync();

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
app.use('/ct', requireAuthenticated, ctRouter);
app.use('/pmt', requireAuthenticated, pmtRouter);

app.get('/lang/:lang', (req, res) => {
  const { lang } = req.params;

  // Validate if the requested language is supported
  if (!['en', 'jp', 'sv'].includes(lang)) {
    return res.status(400).send('Language not supported.');
  }

  // Set a cookie with the selected language. 
  // maxAge is the lifetime of the cookie in milliseconds. Example: 10 years.
  res.cookie('lang', lang, {
    maxAge: 10 * 365 * 24 * 60 * 60 * 1000, // 10 years (in milliseconds)
    httpOnly: true, // Prevent client-side JavaScript from accessing it (optional, for security)
  });

  // Also set the locale for the current request and response
  res.setLocale(lang);

  // Redirect back to the previous page (or home if no referrer)
  res.redirect('back');
});


app.get('/logout', (req, res, next) => {
  req.logOut(function (err) {
    if (err) {
      return next(err);
    }
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

module.exports = { app, sessionMiddleware };
