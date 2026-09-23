const crypto = require('crypto');
const { ERROR_CODES, project, createTransport } = require('./irelandTaricProtocol');
function publicJob(job) {
  return { id: job.id, run_id: job.input.run_id, item_id: job.input.item_id, revision: job.input.revision,
    state: job.state, output: job.output || null, error: job.error || null,
    selected_code: job.selectedCode || null, feedback: job.feedback, hasRequestId: Boolean(job.upstreamId) };
}
function createWorker(store, transport = createTransport(), now = Date.now) {
  let busy = false;
  let lastWarning = 0;
  let lastCleanup = 0;
  async function step(job) {
    const nextAt = delay => new Date(Math.min(new Date(job.expiresAt).getTime(), now() + delay));
    if (new Date(job.expiresAt).getTime() <= now()) {
      await store.update(job.id, { state: 'paused', error: 'DELIVERY_EXPIRED',
        ...(job.feedback === 'pending' ? { feedback: 'failed' } : {}) });
      return;
    }
    if (job.state === 'rejected') {
      await store.update(job.id, { feedback: 'unavailable' });
      return;
    }
    if (job.state === 'paused' && !job.upstreamId) {
      await store.update(job.id, { feedback: 'failed' });
      return;
    }
    const action = job.selectedCode && job.upstreamId && job.state === 'terminal' ? 'feedback'
      : job.upstreamId ? 'poll' : 'submit';
    // Persist uncertain admission before sending: a crash still reserves a remote slot.
    if (action === 'submit') await store.update(job.id, { state: 'pending' });
    let response;
    try { response = await transport(action, job); }
    catch (_) { response = { status: 503, data: { error: 'CONFIG_NOT_READY' } }; }
    if ([200, 202].includes(response.status)) {
      if (action === 'feedback') {
        if (response.data && response.data.selected_code === job.selectedCode
          && response.data.verification === 'unverified' && response.data.training_approved === false
          && ['accepted', 'changed', 'manual'].includes(response.data.decision)) {
          await store.update(job.id, { state: 'terminal', feedback: 'sent', error: null, attempts: 0 });
          return;
        }
      } else {
        let output;
        try { output = project(response.data); } catch (_) { /* Retry uncertain acceptance using the same key. */ }
        if (output && (!job.upstreamId || output.requestId === job.upstreamId)) {
          const terminal = ['complete', 'failed', 'interrupted'].includes(output.state);
          const polls = (job.polls || 0) + (action === 'poll' ? 1 : 0);
          const exhausted = !terminal && polls >= 240;
          await store.update(job.id, { polls, upstreamId: output.requestId, output, state: terminal ? 'terminal' : exhausted ? 'paused' : 'pending',
            error: exhausted ? 'DELIVERY_EXPIRED' : output.error, attempts: 0,
            ...(exhausted && job.feedback === 'pending' ? { feedback: 'failed' } : {}),
            nextAt: nextAt(terminal ? 0 : Math.max(response.retryMs || 0, polls < 12 ? 5000 : 30000)) });
          return;
        }
      }
    }
    const incoming = response.data && response.data.error;
    const error = ERROR_CODES.has(incoming) ? incoming : response.status === 401 ? 'UNAUTHORIZED'
      : response.status === 403 ? 'FORBIDDEN' : response.status === 429 ? 'RATE_LIMITED' : 'TRANSPORT_FAILED';
    // A definite pre-admission rejection has no upstream ID. No fabricated feedback association.
    if (action === 'submit' && [400, 401, 403, 404, 409, 422].includes(response.status)
      && incoming !== 'ADMISSION_BUSY') {
      await store.update(job.id, { state: 'rejected', error });
      return;
    }
    const attempts = job.attempts + 1;
    const permanentFeedback = action === 'feedback' && [400, 401, 403, 404].includes(response.status)
      || action === 'feedback' && incoming === 'IDEMPOTENCY_CONFLICT';
    const stopped = attempts >= 8 || permanentFeedback;
    await store.update(job.id, { attempts, error,
      ...(stopped ? action === 'feedback' ? { feedback: 'failed' } : { state: 'paused',
        ...(job.feedback === 'pending' ? { feedback: 'failed' } : {}) } : {}),
      nextAt: nextAt(Math.max(response.retryMs || 0, Math.min(300000, 2000 * (2 ** attempts)))) });
  }
  async function tick() {
    if (busy) return;
    busy = true;
    const token = crypto.randomBytes(16).toString('hex');
    let claimed = false;
    try {
      claimed = await store.claim(token);
      if (!claimed) return;
      const job = await store.due();
      if (job) await step(job);
      if (now() - lastCleanup >= 3600000) {
        await store.cleanup();
        lastCleanup = now();
      }
    } catch (_) {
      // Do not log HTTP/ORM exceptions: they can include headers, SQL or source item facts.
      if (now() - lastWarning >= 60000) {
        console.warn('Ireland TARIC outbox unavailable; queued work will retry.');
        lastWarning = now();
      }
    } finally {
      if (claimed) await store.release(token).catch(() => {});
      busy = false;
    }
  }
  return { step, tick, start() { const timer = setInterval(tick, 2000); timer.unref(); return () => clearInterval(timer); } };
}
module.exports = { createWorker, publicJob };
