const { randomBytes, timingSafeEqual } = require('crypto');
const { japanDate, sourceUrl } = require('../services/japanPost');

const fields = [
  ['countryName', 'Country'],
  ...['parcel.air', 'parcel.surface', 'ems'].flatMap(service => [
    [`${service}.size.length`, 'Length'], [`${service}.size.lengthPlusGirth`, 'Length + girth'], [`${service}.weight`, 'Weight'],
  ]),
];
function fieldValue(data, path) {
  let value = data;
  for (const part of path.split('.')) {
    if (typeof value === 'string') return value;
    value = value && value[part];
  }
  return value && typeof value === 'object' ? `${value.value} ${value.unit}` : value == null ? '—' : String(value);
}
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
      Object.assign(res.locals, { japanPostCsrf: req.session.japanPostCsrf, today: japanDate(new Date()), formatDate, fields, fieldValue, sourceUrl });
      next();
    },
    index: handle(async (req, res) => res.render('japanpost', { pagetitle: 'Japan Post limits · GCS Support Tool' })),
    database: handle(async (req, res) => res.render('japanpost_database', {
      pagetitle: 'Japan Post database · GCS Support Tool', rows: await service.viewer(req.query), filters: req.query,
    })),
    fetch: handle(async (req, res) => res.json(await service.fetch(req.body.cid))),
    history: handle(async (req, res) => res.json({ history: await service.history(req.params.cid) })),
    schedules: handle(async (req, res) => res.json({ schedules: await service.schedules() })),
    schedule: handle(async (req, res) => res.json(await service.schedule(req.body.cids, req.body.date))),
    cancel: handle(async (req, res) => { await service.cancel(req.params.id); res.json({ success: true }); }),
  };
}

module.exports = { createController, fields, fieldValue };
