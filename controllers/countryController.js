const { randomBytes, timingSafeEqual } = require('crypto');
const { fail } = require('../utils/japanPostCsv');
const { methods, sources, headers, label } = require('../utils/countryManager');
const formatDate = value => value ? new Date(value).toLocaleString('en-GB', { timeZone: 'Asia/Tokyo', hour12: false }) + ' JST' : '—';
const displayValue = value => value === null || value === undefined ? '—' : typeof value === 'boolean' ? label(value) : String(value);
function paginate(events, value) {
  const pages = Math.max(1, Math.ceil(events.length / 40));
  const page = Math.min(pages, Math.max(1, Number.parseInt(value, 10) || 1));
  return { events: events.slice((page - 1) * 40, page * 40), page, pages, total: events.length };
}

function createController(service) {
  const handle = action => async (req, res, next) => {
    try { await action(req, res); }
    catch (error) {
      if (req.path.startsWith('/api/')) return res.status(error.status || 503).json({ error: error.status ? error.message : 'Could not save country data. Please try again.' });
      next(error);
    }
  };
  return {
    prepare(req, res, next) {
      res.set('Cache-Control', 'private, no-store');
      if (!req.user) return res.status(401).json({ error: 'Sign in to use the country manager.' });
      if (!req.session.countryManagerCsrf) req.session.countryManagerCsrf = randomBytes(32).toString('hex');
      if (req.method === 'POST') {
        const token = req.get('X-CSRF-Token') || '';
        const expected = req.session.countryManagerCsrf;
        if (Buffer.byteLength(token) !== Buffer.byteLength(expected) || !timingSafeEqual(Buffer.from(token), Buffer.from(expected))) {
          return res.status(403).json({ error: 'This page has expired. Reload and try again.' });
        }
      }
      Object.assign(res.locals, { countryManagerCsrf: req.session.countryManagerCsrf, methods, sources, headers, label, formatDate, displayValue });
      next();
    },
    index: handle(async (req, res) => res.render('country_control_panel', {
      pagetitle: 'Country & shipping-method manager', ...await service.read(req.query), filters: req.query,
    })),
    details: handle(async (req, res) => {
      const view = await service.read(req.query);
      const country = view.allCountries.find(row => row.countryCode === req.params.countryCode);
      if (!country) fail('This country is not in the website or internal list at the selected time.', 404);
      const { resolveCountry } = require('../utils/countryManager');
      res.render('country_manager_detail', { ...view, country: resolveCountry(country, view.state, view.jp),
        isWebsite: view.state.website.some(row => row.countryCode === country.countryCode), filters: req.query,
        ...paginate(await service.history(country.countryCode), req.query.page), pagetitle: `${country.countryName} · Shipping availability` });
    }),
    history: handle(async (req, res) => res.render('country_manager_history', {
      ...paginate(await service.history(req.query.countryCode), req.query.page), countryCode: req.query.countryCode || '', pagetitle: 'Country manager history',
    })),
    save: handle(async (req, res) => {
      if (req.body.action === 'import') fail('Use the CSV import endpoint.');
      res.json(await service.save(req.params.source, req.body, req.user.userid));
    }),
    autoMap: handle(async (req, res) => {
      const result = await service.save('mappings', { revision: req.body.revision, action: 'auto-map' }, req.user.userid);
      res.json({ ...result, message: result.changed ? `Added ${result.changed} country mapping${result.changed === 1 ? '' : 's'}.` : 'No new exact English-name matches. Remaining countries can be mapped manually.' });
    }),
    saveMethodVisibility: handle(async (req, res) => {
      const result = await service.saveMethodVisibility(req.body);
      res.json({ ...result, message: result.changed ? 'Shipping method columns saved for everyone.' : 'No changes to the shared shipping method columns.' });
    }),
    importCsv: handle(async (req, res) => {
      const file = req.files && req.files.csvFile;
      if (!file || Array.isArray(file) || Object.keys(req.files).length !== 1 || file.truncated) fail('Choose one complete CSV file up to 5 MB.');
      res.json(await service.importCsv(req.params.source, req.body, file.data, req.user.userid));
    }),
  };
}
module.exports = { createController };
