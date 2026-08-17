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
const { isTemporaryPassword } = require('./utils/password');

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
var bulkTrackerRouter = require('./routes/bulkTracker');
var shippingMonitorCompareRouter = require('./routes/shippingMonitorCompare');
var shipcostRouter = require('./routes/shipcost');
var lennartRouter = require('./routes/lennart');
var formRouter = require('./routes/form');
const chatgptRouter = require('./routes/chatgpt');
const ctRouter = require('./routes/ct');
const pmtRouter = require('./routes/pmt');
const imagePdfRouter = require('./routes/imagePdf');
const dhlCompensationRouter = require('./routes/dhl_compensation');

var app = express();
const MAX_UPLOAD_BYTES = 20 * 1024 * 1024;

if (process.env.SESSION_COOKIE_SECURE === 'true') {
  app.set('trust proxy', 1);
}

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
const sessionMiddleware = session({
  secret: process.env.SESSION_SECRET,
  store: sessionStore,
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.SESSION_COOKIE_SECURE === 'true',
    maxAge: 30 * 24 * 60 * 60 * 1000,
  },
});
app.use(sessionMiddleware);
app.use(pp.passport.initialize());
app.use(pp.passport.session());
app.use((req, res, next) => {
  res.locals.role = req.user && req.user.role ? req.user.role : 'guest';
  res.locals.name = req.user && req.user.userid ? req.user.userid : 'Guest';
  res.locals.signedIn = Boolean(req.user);
  res.locals.passwordChangeRequired = Boolean(req.user && isTemporaryPassword(req.user.password));
  res.locals.currentPath = req.path;
  next();
});
const authenticatedFileUpload = fileUpload({
  abortOnLimit: true,
  limits: {
    fileSize: MAX_UPLOAD_BYTES,
    files: 10,
    fields: 100,
  },
  uploadTimeout: 60000,
});
app.use((req, res, next) => {
  if (!req.isAuthenticated()) {
    return next();
  }
  return authenticatedFileUpload(req, res, next);
});
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
app.use('/bulk-tracker', requireAuthenticated, bulkTrackerRouter);
app.use('/shipping-monitor-compare', requireAuthenticated, shippingMonitorCompareRouter);
app.use('/shipping-monitor-shortcuts', requireAuthenticated, shippingMonitorCompareRouter);
app.use('/shipcost', requireAuthenticated, shipcostRouter);
app.use('/lennart', requireAuthenticated, lennartRouter);
app.use('/form', requireAuthenticated, formRouter);
app.use('/chatgpt', requireAuthenticated, chatgptRouter);
app.use('/ct', requireAuthenticated, ctRouter);
app.use('/pmt', requireAuthenticated, pmtRouter);
app.use('/image-pdf', requireAuthenticated, imagePdfRouter);
app.use('/dhl-compensation', requireAuthenticated, dhlCompensationRouter);

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

  // Redirect only to a same-origin path from this application.
  const referrer = req.get('Referrer');
  let redirectTarget = '/';
  if (referrer) {
    try {
      const referrerUrl = new URL(referrer, `${req.protocol}://${req.get('host')}`);
      if (referrerUrl.host === req.get('host')) {
        redirectTarget = `${referrerUrl.pathname}${referrerUrl.search}`;
      }
    } catch (_error) {
      redirectTarget = '/';
    }
  }
  res.redirect(redirectTarget);
});


app.get('/logout', (req, res, next) => {
  req.logOut(function (err) {
    if (err) {
      return next(err);
    }
    req.session.destroy((sessionError) => {
      if (sessionError) {
        return next(sessionError);
      }
      res.clearCookie('connect.sid');
      res.redirect('/login');
    });
  });
});

// catch 404 and forward to error handler
app.use(function (req, res, next) {
  next(createError(404));
});

// error handler
app.use(function (err, req, res, next) {
  const status = err.status || 500;
  const isDevelopment = req.app.get('env') === 'development';
  res.locals.message = !isDevelopment && status >= 500
    ? 'The application could not complete this request.'
    : err.message;
  res.locals.error = isDevelopment ? err : { status };

  // render the error page
  res.status(status);
  res.render('error', { request: req.body });
});

// Autenthication checks
function requireAuthenticated(req, res, next) {
  if (req.isAuthenticated()) {
    const requestPath = req.originalUrl.split('?')[0].replace(/\/+$/, '') || '/';
    const passwordRouteAllowed = requestPath === '/change-password' || requestPath === '/logout';
    if (isTemporaryPassword(req.user.password) && !passwordRouteAllowed) {
      return res.redirect('/change-password');
    }
    return next();
  }
  res.locals.role = 'guest';
  res.locals.name = 'Guest';
  res.locals.signedIn = false;
  res.redirect('/login');
}
function requireNotAuthenticated(req, res, next) {
  if (req.isAuthenticated()) {
    return res.redirect('/');
  }
  res.locals.role = 'guest';
  res.locals.name = 'Guest';
  res.locals.signedIn = false;
  next();
}

module.exports = { app, sessionMiddleware };
