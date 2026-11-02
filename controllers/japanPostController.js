const { randomBytes, timingSafeEqual } = require('crypto');
const { MAX_BYTES, detailSections, limits, fail } = require('../utils/japanPostCsv');
const formatDate = value => value ? new Date(value).toLocaleString('en-GB', { timeZone: 'Asia/Tokyo', hour12: false }) : '—';

function createController(service) {
  const handle = action => async (req, res, next) => {
    try { await action(req, res); }
    catch (error) {
      if (req.path.startsWith('/api/')) return res.status(error.status || 503).json({ error: error.status ? error.message : 'The database is unavailable. Please try again later.' });
      next(error);
    }
  };
  return {
    prepare(req, res, next) {
      res.set('Cache-Control', 'private, no-store');
      if (!req.user) return res.status(401).json({ error: 'Sign in to use Japan Post limits.' });
      if (!req.session.japanPostCsrf) req.session.japanPostCsrf = randomBytes(32).toString('hex');
      if (req.method === 'POST') {
        const token = req.get('X-CSRF-Token') || '';
        const expected = req.session.japanPostCsrf;
        if (Buffer.byteLength(token) !== Buffer.byteLength(expected) || !timingSafeEqual(Buffer.from(token), Buffer.from(expected))) {
          return res.status(403).json({ error: 'This page has expired. Reload and try again.' });
        }
      }
      Object.assign(res.locals, { japanPostCsrf: req.session.japanPostCsrf, formatDate, detailSections });
      next();
    },
    index: handle(async (req, res) => res.render('japanpost', {
      pagetitle: 'Japan Post CSV import · GCS Support Tool', overview: await service.overview(),
    })),
    database: handle(async (req, res) => res.render('japanpost_database', {
      pagetitle: 'Japan Post database · GCS Support Tool', rows: await service.viewer(req.query), filters: req.query,
    })),
    details: handle(async (req, res) => {
      const history = await service.history(req.params.code);
      if (!history.length) fail('No imported data exists for this country code.', 404);
      res.render('japanpost_country', { pagetitle: `${history[0].data['国名（英語）']} · Japan Post`, history, latest: history[0], limits: limits(history[0].data) });
    }),
    importCsv: handle(async (req, res) => {
      const file = req.files && req.files.csvFile;
      if (!file || Array.isArray(file) || Object.keys(req.files).length !== 1) fail('Choose one Japan Post CSV file.');
      if (file.truncated || file.size > MAX_BYTES) fail('The CSV file must be 5 MB or smaller.', 413);
      if (!/\.csv$/i.test(file.name)) fail('Choose a file with the .csv extension.');
      res.json(await service.importCsv(file.data, file.name));
    }),
    history: handle(async (req, res) => res.json({ history: await service.history(req.params.code) })),
  };
}
module.exports = { createController };
