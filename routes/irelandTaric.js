const express = require('express');
const crypto = require('crypto');
const { configuration, object, CODE, fail } = require('../services/irelandTaricProtocol');
const { publicJob } = require('../services/irelandTaricWorker');
function csrfToken(req) {
  return crypto.createHmac('sha256', process.env.SESSION_SECRET).update(`ireland-taric:${req.sessionID}`).digest('hex');
}
function createRouter(store, configured = configuration) {
  const router = express.Router();
  const rates = new Map();
  router.use((req, res, next) => {
    res.set('Cache-Control', 'private, no-store');
    if (!req.isAuthenticated || !req.isAuthenticated() || !req.user || !req.user.id) return res.status(401).json({ error: 'UNAUTHORIZED' });
    // Same access policy as /hs/ireland; all job reads/writes are additionally owner scoped.
    req.taricOwner = String(req.user.id);
    if (Object.keys(req.query).length) return res.status(400).json({ error: 'INVALID_REQUEST' });
    if (req.method === 'POST') {
      const token = req.get('X-CSRF-Token') || '';
      const expected = csrfToken(req);
      if (!/^[a-f0-9]{64}$/.test(token) || !crypto.timingSafeEqual(Buffer.from(token), Buffer.from(expected))) return res.status(403).json({ error: 'CSRF_FAILED' });
      if (!req.is('application/json') || Buffer.byteLength(JSON.stringify(req.body || {})) > 4096) return res.status(413).json({ error: 'INVALID_REQUEST' });
    }
    const now = Date.now();
    for (const [key, value] of rates) if (value.until <= now) rates.delete(key);
    const rate = rates.get(req.taricOwner) || { count: 0, until: now + 60000 };
    rate.count += 1;
    rates.set(req.taricOwner, rate);
    if (rate.count > 120 || rates.size > 10000) return res.status(429).set('Retry-After', '30').json({ error: 'LOCAL_RATE_LIMITED' });
    next();
  });
  const handle = fn => async (req, res) => {
    try { await fn(req, res); } catch (error) {
      res.status(error.safeCode ? error.status : 503).json({ error: error.safeCode || 'STORAGE_FAILED' });
    }
  };
  router.post('/requests', handle(async (req, res) => {
    configured();
    res.status(202).json(publicJob(await store.create(req.taricOwner, req.body)));
  }));
  // A single keepalive POST persists a final choice even if the initial browser
  // registration response is still pending. Both operations replay the same ID.
  router.post('/selections', handle(async (req, res) => {
    object(req.body, ['request', 'selected_code']);
    if (typeof req.body.selected_code !== 'string' || !CODE.test(req.body.selected_code)) fail('INVALID_FEEDBACK');
    const job = await store.create(req.taricOwner, req.body.request);
    res.status(202).json(publicJob(await store.selection(req.taricOwner, job.id, { selected_code: req.body.selected_code })));
  }));
  router.get('/feedback', handle(async (req, res) => {
    res.json({ jobs: (await store.list(req.taricOwner)).map(publicJob) });
  }));
  router.get('/requests/:id', handle(async (req, res) => {
    res.json(publicJob(await store.get(req.taricOwner, req.params.id)));
  }));
  router.post('/requests/:id/selection', handle(async (req, res) => {
    res.status(202).json(publicJob(await store.selection(req.taricOwner, req.params.id, req.body)));
  }));
  router.post('/requests/:id/resume', handle(async (req, res) => {
    object(req.body, []);
    res.status(202).json(publicJob(await store.resume(req.taricOwner, req.params.id)));
  }));
  router.use((_req, res) => res.status(404).json({ error: 'NOT_FOUND' }));
  return router;
}
module.exports = { createRouter, csrfToken };
