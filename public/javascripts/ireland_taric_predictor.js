/* Server-only credentials. No request is made until show() or an explicit feedback check. */
(() => {
  const messages = {
    INVALID_JAN: 'JAN must contain exactly 8 or 13 digits. Leading zeros are kept.',
    INVALID_HS: 'The original input HS must be six digits (dots and spaces are allowed). TARIC is not substituted.',
    INVALID_NAME: 'A source item description of 1–500 characters is required.',
    EVIDENCE_NOT_FOUND: 'No stored AmiAmi evidence matches this JAN. Continue manually; the final choice can still be reported.',
    JAN_AMBIGUOUS: 'This JAN matches multiple stored items. Continue manually; the final choice can still be reported.',
    CATALOG_REJECTED: 'The candidate is outside the pilot’s limited training-derived catalog. This does not establish global TARIC legality.',
    ADMISSION_BUSY: 'The predictor is reserved. Continue manually. A terminal failed request needs an explicit new attempt to predict again.',
    RECOVERY_REQUIRED: 'The upstream predictor needs operator recovery. Continue manually.',
    INFERENCE_UNCERTAIN: 'The upstream predictor needs operator recovery. Continue manually.',
    FETCH_FAILED: 'JAN evidence could not be retrieved. Continue manually.',
    UNAUTHORIZED: 'Predictor authentication failed. Ask the GCS operator to check the server key.',
    FORBIDDEN: 'Predictor access was denied. Ask the GCS operator to check access.',
    CSRF_FAILED: 'The session has changed. Save/export your CSV, then reload before another prediction.',
    CONFIG_NOT_READY: 'The server predictor configuration is unavailable. Continue manually.',
    RATE_LIMITED: 'The predictor is rate limited. Queued work will retry.',
    LOCAL_RATE_LIMITED: 'Too many local requests. Wait briefly and retry.',
    LOCAL_QUEUE_FULL: 'The local predictor queue is full. Continue manually and retry later.',
    STORAGE_FAILED: 'GCS could not persist predictor work. Keep this page open and retry feedback; CSV saving is independent.',
    DELIVERY_EXPIRED: 'The delivery deadline expired. Check/retry the saved request.',
    TRANSPORT_FAILED: 'The predictor connection failed. Continue manually; queued work uses bounded retries.',
    SELECTION_IMMUTABLE: 'That request already has a final choice. A changed choice needs a new item revision.',
    IDEMPOTENCY_CONFLICT: 'The upstream request already has different final feedback. Your CSV choice is saved; ask the operator to inspect the conflict.',
    INVALID_RESULT: 'The predictor returned no usable suggestion. Continue manually.',
    HTTP_ACCESS_DENIED: 'The evidence service denied access. Continue manually.',
    TLS_CHAIN_UNTRUSTED: 'The evidence service connection could not be verified. Continue manually.',
    RETRY_LIMIT: 'The saved request has reached its retry limit. Your CSV choice is unaffected.',
  };
  const explain = code => messages[code] || 'Prediction unavailable. Continue with manual TARIC selection.';
  const id = () => Array.from(crypto.getRandomValues(new Uint8Array(16)), byte => byte.toString(16).padStart(2, '0')).join('');
  const wait = ms => new Promise(resolve => setTimeout(resolve, ms));
  window.createIrelandTaricPredictor = ({ selectCode, splitName }) => {
    const el = name => document.getElementById(name);
    const status = el('predictor-status');
    const result = el('predictor-result');
    const rejected = el('predictor-rejected');
    const use = el('predictor-use');
    const retry = el('predictor-retry');
    const feedbackStatus = el('taric-feedback-status');
    const feedbackList = el('taric-feedback-list');
    let runId = id();
    let active = null;
    let generation = 0;
    const records = new Set();
    async function request(path, body) {
      const abort = new AbortController();
      const timeout = setTimeout(() => abort.abort(), 10000);
      try {
        const response = await fetch(`/hs/ireland/predictor${path}`, { method: body === undefined ? 'GET' : 'POST',
          credentials: 'same-origin', cache: 'no-store', signal: abort.signal,
          headers: body === undefined ? {} : { 'Content-Type': 'application/json', 'X-CSRF-Token': el('taric-csrf').value },
          ...(body === undefined ? {} : { body: JSON.stringify(body), keepalive: true }) });
        const data = await response.json();
        if (!response.ok) throw Object.assign(new Error(), { code: data.error });
        return data;
      } catch (error) { throw Object.assign(new Error(), { code: messages[error.code] ? error.code : 'TRANSPORT_FAILED' }); }
      finally { clearTimeout(timeout); }
    }
    function summary() {
      const selected = [...records].filter(record => record.selected);
      if (!selected.length) return;
      const unsaved = selected.filter(record => !record.durable).length;
      feedbackStatus.textContent = unsaved
        ? `AI feedback: ${unsaved} final choice(s) not yet durably queued. Keep this page open and use Check queued AI feedback to retry. CSV saving/export is independent.`
        : `AI feedback: ${selected.length} final choice(s) durably queued in GCS. Use Check queued AI feedback for delivery status.`;
    }
    function render(record) {
      if (active !== record) return;
      use.classList.add('d-none');
      retry.classList.add('d-none');
      result.textContent = '';
      rejected.textContent = '';
      const job = record.job;
      if (record.localError) {
        status.textContent = explain(record.localError);
        retry.classList.remove('d-none');
        return;
      }
      if (!job) { status.textContent = 'Queuing test prediction… You can select a code and continue now.'; return; }
      const output = job.output;
      const error = job.error || (output && output.error);
      status.textContent = error ? `${explain(error)} (${error})`
        : job.state === 'terminal' ? 'Test prediction complete. Human confirmation is required.'
          : 'Waiting for the test predictor… Cold starts may take 20–30 seconds. You can continue manually.';
      if (job.feedback !== 'none') status.textContent += ` Feedback: ${job.feedback}.`;
      if (job.state === 'rejected' && !job.hasRequestId) status.textContent += ' No upstream request ID was issued, so linked feedback cannot be sent.';
      if (output && output.suggestion) {
        result.textContent = `${output.suggestion.code} — ${output.suggestion.description} (model-generated; unverified; ${output.adapter || 'test adapter'}; evidence: ${output.provenance || 'not supplied'}).`;
        use.classList.remove('d-none');
      }
      if (output && output.rejected) {
        rejected.textContent = `UNVALIDATED / REJECTED candidate: ${output.rejected.code} — ${output.rejected.description}. Not an approved recommendation.`;
      }
      if (['terminal', 'rejected', 'paused'].includes(job.state)) retry.classList.remove('d-none');
    }
    async function ensure(record) {
      if (record.registered) return;
      if (!record.submitting) {
        record.submitting = request('/requests', record.input).then(job => {
          record.job = job;
          record.registered = true;
          record.localError = null;
        }).finally(() => { record.submitting = null; });
      }
      return record.submitting;
    }
    async function watch(record, view) {
      const deadline = Date.now() + 120000;
      try {
        await ensure(record);
        while (active === record && generation === view) {
          render(record);
          if (['terminal', 'rejected', 'paused'].includes(record.job.state)) return;
          if (Date.now() >= deadline) {
            status.textContent = 'Stopped waiting after two minutes. Remote work was not cancelled; feedback can still be delivered. Check the same request to resume waiting.';
            retry.classList.remove('d-none');
            return;
          }
          await wait(3000);
          if (active !== record || generation !== view) return;
          if (!record.polling) record.polling = request(`/requests/${record.input.id}`).finally(() => { record.polling = null; });
          record.job = await record.polling;
        }
      } catch (error) { record.localError = error.code; if (generation === view) render(record); }
    }
    function makeRecord(item) {
      const source = splitName(item.originalProductName);
      const revision = item.taricPrediction ? item.taricPrediction.input.revision + 1 : 0;
      const record = { input: { id: id(), run_id: runId, item_id: item.id, revision,
        jan: source.janCode, descriptive_name: source.itemName.trim(), input_hs_code: item.originalHsCode }, item };
      records.add(record);
      item.taricPrediction = record;
      return record;
    }
    function show(item) {
      generation += 1;
      active = null;
      result.textContent = '';
      rejected.textContent = '';
      use.classList.add('d-none');
      retry.classList.add('d-none');
      const source = splitName(item.originalProductName);
      if (!source.janCode) {
        status.textContent = 'No JAN in the source item. AI lookup and linked feedback are unavailable; continue manually.';
        return;
      }
      const hs = String(item.originalHsCode).replace(/[.\s]/g, '');
      const invalid = !/^(?:[0-9]{8}|[0-9]{13})$/.test(source.janCode) ? 'INVALID_JAN'
        : !/^[0-9]{6}$/.test(hs) ? 'INVALID_HS'
          : !source.itemName.trim() || source.itemName.trim().length > 500 || /[\x00-\x1f\x7f]/.test(source.itemName) ? 'INVALID_NAME' : null;
      if (invalid) { status.textContent = explain(invalid); return; }
      active = item.taricPrediction || makeRecord(item);
      render(active);
      watch(active, generation);
    }
    async function deliver(record) {
      if (record.delivering || record.durable) return;
      record.delivering = true;
      for (let attempt = 0; attempt < 3; attempt += 1) {
        try {
          record.job = await request('/selections', { request: record.input, selected_code: record.selected });
          record.registered = true;
          record.durable = true;
          break;
        } catch (error) {
          record.feedbackError = error.code;
          if (attempt < 2) await wait(1000 * (attempt + 1));
        }
      }
      record.delivering = false;
      summary();
    }
    async function selected(item, code) {
      if (!/^[0-9]{10}$/.test(code) || !item.taricPrediction) return;
      let record = item.taricPrediction;
      // One immutable final choice per upstream ID. A revisit with a different choice is a fresh revision.
      if (record.selected && record.selected !== code) record = makeRecord(item);
      record.selected = code;
      summary();
      // Wait briefly for local durability only. An upstream outage never delays CSV work.
      let timer;
      await Promise.race([deliver(record), new Promise(resolve => { timer = setTimeout(resolve, 2000); })]);
      clearTimeout(timer);
    }
    use.addEventListener('click', () => {
      const suggestion = active && active.job && active.job.output && active.job.output.suggestion;
      if (suggestion) selectCode(suggestion.code);
    });
    retry.addEventListener('click', async () => {
      const record = active;
      if (!record) return;
      retry.disabled = true;
      try {
        if (record.job && ['terminal', 'rejected'].includes(record.job.state) && !record.selected) {
          active = makeRecord(record.item); // Explicit new attempt after a definite terminal outcome only.
        } else if (record.job && (record.job.state === 'paused' || record.job.feedback === 'failed')) {
          record.job = await request(`/requests/${record.input.id}/resume`, {});
        }
        // Resume/check unknown acceptance with the identical ID/body. Never automatically submit a new request.
        if (active === record || (active && active.item === record.item)) {
          active.localError = null;
          generation += 1;
          render(active);
          watch(active, generation);
        }
      } catch (error) { record.localError = error.code; render(record); }
      finally { retry.disabled = false; }
    });
    el('taric-feedback-refresh').addEventListener('click', async () => {
      for (const record of records) if (record.selected && !record.durable) deliver(record);
      feedbackList.textContent = 'Checking saved feedback…';
      try {
        const data = await request('/feedback');
        feedbackList.textContent = '';
        if (!data.jobs.length) feedbackList.textContent = 'No saved AI requests yet. Items without a JAN cannot have linked feedback.';
        data.jobs.forEach(job => {
          const row = document.createElement('p');
          row.className = 'small';
          row.textContent = `Run ${job.run_id.slice(0, 8)}, item ${job.item_id}, revision ${job.revision}: ${job.selected_code || 'no final choice'} — feedback ${job.feedback}${job.error ? ` (${job.error})` : ''}. ${job.feedback === 'unavailable' ? 'No upstream request ID exists; linked feedback cannot be sent. ' : ''}`;
          if (job.feedback === 'failed' || job.state === 'paused') {
            const button = document.createElement('button');
            button.className = 'btn btn-sm btn-secondary';
            button.textContent = 'Retry delivery';
            button.addEventListener('click', async () => {
              button.disabled = true;
              try { await request(`/requests/${job.id}/resume`, {}); row.textContent += ' Retry queued.'; }
              catch (error) { row.textContent += ` ${explain(error.code)}`; }
            });
            row.appendChild(button);
          }
          feedbackList.appendChild(row);
        });
      } catch (error) { feedbackList.textContent = explain(error.code); }
    });
    return { show, selected, close() { active = null; generation += 1; },
      newRun() { runId = id(); active = null; generation += 1; } };
  };
})();
