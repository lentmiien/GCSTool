// Read-only: random valid opaque ID; no submission, evidence lookup or feedback.
require('dotenv').config();
const crypto = require('crypto');
const { createTransport } = require('../services/irelandTaricProtocol');
(async () => {
  try {
    const result = await createTransport()('poll', {
      id: crypto.randomBytes(16).toString('hex'), upstreamId: crypto.randomBytes(16).toString('hex'),
    });
    const authenticated = result.status === 404 && result.data && result.data.error === 'NOT_FOUND';
    console.log(JSON.stringify({ check: 'read-only scoped random-ID GET', httpStatus: result.status,
      expectedNotFound: Boolean(authenticated), mutations: 0 }));
    if (!authenticated) process.exitCode = 1;
  } catch (_) {
    console.log('TARIC connection check unavailable: check private server configuration.');
    process.exitCode = 1;
  }
})();
