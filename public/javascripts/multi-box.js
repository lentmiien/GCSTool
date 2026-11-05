(function () {
  'use strict';
  const $ = (id) => document.getElementById(`mb-${id}`);
  const format = (value) => Number.isFinite(value) ? value.toLocaleString(undefined, { maximumFractionDigits: 3 }) : '—';
  const dimensions = (values) => `${values.map(format).join(' × ')} cm`;
  const itemName = (item) => String(item.id || item.itemId || 'Unnamed item');
  let catalogReady = false;
  let busy = false;
  let loadingCatalog = false;
  let retryUntil = 0;
  let retryTimer;
  let pollTimer;
  let jobId = null;
  let previews;
  const choices = new Map();
  const colors = new Map();
  const storageKey = 'multi-box-job';

  function element(tag, text, className) {
    const node = document.createElement(tag);
    if (text !== undefined) node.textContent = text;
    if (className) node.className = className;
    return node;
  }
  function status(message, type = 'info') {
    $('status').textContent = message;
    $('status').className = `alert alert-${type}`;
  }
  function updateButtons() {
    const seconds = Math.max(0, Math.ceil((retryUntil - Date.now()) / 1000));
    $('inputs').disabled = busy;
    $('generate').disabled = busy || !catalogReady || seconds > 0;
    $('generate').textContent = busy ? 'Packing…' : seconds ? `Try again in ${seconds}s` : 'Generate';
    $('refresh').disabled = busy || loadingCatalog || seconds > 0;
    $('resume').disabled = busy || seconds > 0;
    clearTimeout(retryTimer);
    if (seconds) retryTimer = setTimeout(updateButtons, 1000);
  }
  function rememberJob(id) {
    jobId = id;
    try {
      if (id) sessionStorage.setItem(storageKey, id);
      else sessionStorage.removeItem(storageKey);
    } catch (_error) { /* Storage may be disabled; current-page polling still works. */ }
  }
  async function api(path, options = {}) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 45000);
    try {
      const response = await fetch(`/multi-box${path}`, { credentials: 'same-origin', cache: 'no-store', ...options, signal: controller.signal });
      if (response.redirected) throw new Error('Your session has ended or needs attention. Reload to sign in.');
      const retry = response.headers.get('Retry-After');
      const delay = retry && /^\d+$/.test(retry) ? Number(retry) * 1000 : retry ? Date.parse(retry) - Date.now() : 5000;
      const wait = Number.isFinite(delay) ? Math.max(5000, delay) : 5000;
      if (!response.ok && (retry || response.status === 429)) { retryUntil = Date.now() + wait; updateButtons(); }
      let data;
      try { data = await response.json(); }
      catch (_error) { throw new Error('The server returned an unreadable response. Try again later.'); }
      if (!response.ok) throw new Error(data.message || 'The request failed. Try again later.');
      return { data, wait };
    } catch (error) {
      if (error.name === 'AbortError' || error instanceof TypeError) {
        throw new Error(options.method === 'POST'
          ? 'Submission could not be confirmed and may have been accepted. It has not been retried; wait before submitting again.'
          : 'Could not reach the server. Check your connection, then check the existing job again.');
      }
      throw error;
    } finally { clearTimeout(timeout); }
  }
  function colorFor(item) {
    const id = itemName(item);
    if (!colors.has(id)) colors.set(id, `hsl(${(colors.size * 137.508) % 360}, 65%, 60%)`);
    return colors.get(id);
  }
  function clearResult() {
    if (previews) previews.dispose();
    previews = null;
    colors.clear();
    $('boxes').replaceChildren();
    $('summary').replaceChildren();
    $('unplaced').replaceChildren();
    $('unplaced').hidden = true;
    $('result').hidden = true;
    $('empty').hidden = false;
  }
  function metric(host, value, label) {
    const node = element('div', undefined, 'sb-metric');
    node.append(element('strong', value), element('span', label));
    host.appendChild(node);
  }
  function showResult(result) {
    if (!result || !Array.isArray(result.boxes) || !Array.isArray(result.unplaced)) throw new Error('The service returned an invalid packing plan.');
    clearResult();
    $('empty').hidden = true;
    $('result').hidden = false;
    const summary = element('div', undefined, 'card-body');
    summary.append(element('p', result.unplaced.length ? 'Packing incomplete' : 'Packing complete', 'sb-eyebrow'));
    const packedCount = result.boxes.reduce((sum, box) => sum + box.items.length, 0);
    summary.append(element('h2', `${result.boxes.length} boxes · ${packedCount} packed items`, 'h4'));
    summary.append(element('p', 'All dimensions below are width × height × depth in cm. Coordinates: X = width, Y = height, Z = depth.', 'text-muted mb-0'));
    $('summary').appendChild(summary);
    if (result.unplaced.length) {
      $('unplaced').hidden = false;
      $('unplaced').append(element('h3', `${result.unplaced.length} unplaced items`, 'h5'), element('p', 'This plan does not pack everything. Review these items and the box limits before shipping.'));
      const list = element('ul', undefined, 'mb-0');
      result.unplaced.forEach((item) => list.appendChild(element('li', `${itemName(item)}${item.reason ? ` — ${typeof item.reason === 'string' ? item.reason : JSON.stringify(item.reason)}` : ''}`)));
      $('unplaced').appendChild(list);
    }
    if (result.boxes.length) {
      try { previews = window.createMultiBoxPreviews(); }
      catch (_error) { previews = null; }
    }
    result.boxes.forEach((box, index) => {
      const card = element('article', undefined, 'card mb-3 mb-box-card');
      const body = element('div', undefined, 'card-body');
      body.append(element('h3', `Box ${index + 1} · ${box.type}`, 'h4 mb-box-title'));
      body.append(element('p', `${box.id} · ${dimensions(box.dimensions)} · ${box.items.length} items`, 'text-muted'));
      const weights = box.weightEstimate || {};
      if (Array.isArray(box.innerDimensions)) body.appendChild(element('p', `Usable interior: ${dimensions(box.innerDimensions)}`, 'small text-muted'));
      if (box.fallback || (box.fallbackReasons && box.fallbackReasons.length)) {
        body.appendChild(element('p', `Fallback box: review this packing before shipping.${box.fallbackReasons && box.fallbackReasons.length ? ` ${box.fallbackReasons.join('; ')}` : ''}`, 'alert alert-warning'));
      }
      const metrics = element('div', undefined, 'sb-metrics');
      metric(metrics, `${format(weights.estimatedShipmentWeight)} kg`, 'Estimated shipment weight');
      metric(metrics, `${format(weights.itemWeight)} kg`, 'Item weight');
      metric(metrics, `${format(weights.estimatedCushionWeight)} kg`, 'Estimated cushion weight');
      body.append(metrics, element('p', `Empty box: ${format(weights.emptyBoxWeight)} kg · Max load (items + cushion): ${format(weights.maxLoadWeight)} kg · Empty volume: ${format(weights.emptyVolumeCm3)} cm³`, 'small text-muted'));
      if (Number.isFinite(box.value)) body.appendChild(element('p', `Item value: ${format(box.value)} · Maximum value: ${format(box.maxValue)}`, 'small text-muted'));
      if (weights.exceedsMaxLoadWeight) body.append(element('p', 'Estimated items + cushion exceed this box’s maximum load. Review before shipping.', 'alert alert-warning'));
      const host = element('div', undefined, 'sb-preview');
      host.tabIndex = 0;
      host.setAttribute('aria-label', `3D preview of box ${index + 1}. Drag to rotate and scroll to zoom.`);
      const reset = element('button', 'Reset view', 'btn btn-sm btn-outline-secondary my-2');
      reset.type = 'button';
      body.append(host, reset, element('p', 'Drag to rotate · Scroll or pinch to zoom · Right-drag to pan', 'small text-muted'));
      const missing = box.items.filter((item) => !window.MultiBoxData.placement(item));
      if (missing.length) body.append(element('p', `${missing.length} items have no 3D placement (including soft items). They are assigned to this box and listed below; the preview only shows positioned items.`, 'small text-muted'));
      body.appendChild(element('h4', 'Items in this box', 'h6 mt-3'));
      box.items.forEach((item) => {
        const row = element('div', undefined, 'sb-placement');
        const swatch = element('span', undefined, 'sb-swatch');
        swatch.style.backgroundColor = colorFor(item);
        const details = element('div');
        details.appendChild(element('strong', item.label || itemName(item)));
        const placement = window.MultiBoxData.placement(item);
        const notes = [];
        if (placement) {
          notes.push(`${dimensions(placement.dimensions)} · Center (X, Y, Z): ${placement.center.map(format).join(', ')} cm`);
          notes.push(`Orientation matrix: ${placement.matrix.map(format).join(', ')}`);
          const position = window.MultiBoxData.vector(item.position);
          if (position) notes.push(`Position (X, Y, Z): ${position.map(format).join(', ')} cm`);
        } else {
          notes.push(item.soft ? 'Soft item — no fixed 3D position' : '3D placement unavailable');
          const sizes = window.MultiBoxData.vector(item.dimensions);
          if (sizes) notes.push(dimensions(sizes));
        }
        if (item.requiresFallback) notes.push('Requires fallback — review this item before shipping.');
        const properties = ['weight', 'value', 'rotation', 'shrink', 'soft', 'fragile'].filter((key) => item[key] !== undefined)
          .map((key) => `${key}: ${item[key]}${key === 'weight' ? ' kg' : key === 'shrink' ? '%' : ''}`);
        if (properties.length) notes.push(properties.join(' · '));
        details.appendChild(element('small', notes.join('\n'), 'mb-item-details'));
        row.append(swatch, details);
        body.appendChild(row);
      });
      card.appendChild(body);
      $('boxes').appendChild(card);
      try {
        if (!previews) throw new Error('WebGL unavailable');
        const preview = previews.add(host, box, colorFor);
        reset.addEventListener('click', preview.reset);
      } catch (_error) {
        host.replaceChildren(element('p', '3D preview unavailable. Enable WebGL to see the packing. Box and item details are listed below.', 'p-3'));
        reset.disabled = true;
      }
    });
    status(result.unplaced.length ? `Packing finished with ${result.unplaced.length} unplaced items. Review the partial plan below.`
      : `Packing complete: ${packedCount} items across ${result.boxes.length} boxes.`, result.unplaced.length ? 'warning' : 'success');
  }
  function handleJob(job, wait) {
    if (!job || !/^[0-9a-f-]{36}$/i.test(job.jobId) || !['queued', 'running', 'completed', 'failed'].includes(job.status)) throw new Error('The server returned an invalid job.');
    rememberJob(job.jobId);
    $('resume').hidden = true;
    if (job.status === 'completed') { showResult(job.result); busy = false; }
    else if (job.status === 'failed') { status(job.error && job.error.message || 'Packing failed. Try adjusting the items and options.', 'danger'); busy = false; }
    else {
      const progress = job.progress;
      const detail = progress ? ` · ${progress.phase || 'Working'}${Number.isFinite(progress.done) && Number.isFinite(progress.total) ? ` ${progress.done}/${progress.total}` : ''}${Number.isFinite(progress.boxes) ? ` · ${progress.boxes} boxes` : ''}` : '';
      status(`${job.status === 'queued' ? `Queued${job.queuePosition ? ` · position ${job.queuePosition}` : ''}` : 'Packing'}${detail}. Checking again in ${Math.ceil(wait / 1000)} seconds…`);
      pollTimer = setTimeout(checkJob, wait);
    }
    updateButtons();
  }
  async function checkJob() {
    if (!jobId) return;
    clearTimeout(pollTimer);
    busy = true;
    $('resume').hidden = true;
    updateButtons();
    try {
      const { data, wait } = await api(`/jobs/${encodeURIComponent(jobId)}`);
      handleJob(data, wait);
    } catch (error) {
      busy = false;
      $('resume').hidden = false;
      status(`${error.message} No new job has been submitted.`, 'danger');
      updateButtons();
    }
  }
  async function loadCatalog() {
    loadingCatalog = true;
    catalogReady = false;
    updateButtons();
    try {
      const { data } = await api('/containers');
      if (!Array.isArray(data.containers)) throw new Error('The box catalog is invalid.');
      const previous = new Set([...choices].filter(([, input]) => input.checked).map(([id]) => id));
      choices.clear();
      $('catalog').replaceChildren();
      data.containers.forEach((box) => {
        const label = element('label', undefined, 'mb-box-choice');
        const input = element('input');
        input.type = 'checkbox';
        input.className = 'mr-2';
        input.checked = previous.has(box.id);
        input.disabled = $('all-boxes').checked;
        choices.set(box.id, input);
        label.append(input, document.createTextNode(box.id), element('small', `${dimensions([box.width, box.height, box.depth])} · empty ${format(box.emptyWeight)} kg · item capacity ${box.max_weight == null ? 'unlimited' : `${format(box.max_weight)} kg`}`));
        if (box.tags && box.tags.length) label.appendChild(element('small', box.tags.join(', ')));
        $('catalog').appendChild(label);
      });
      catalogReady = data.containers.length > 0;
      $('catalog-status').textContent = `${data.containers.length} eligible box types · revision ${data.revision} · ${data.excludedContainers || 0} excluded. Packing uses the latest catalog.`;
      if (!jobId && !busy && $('result').hidden) status(catalogReady ? 'Ready. Paste items and Generate.' : 'No eligible boxes are available.', catalogReady ? 'info' : 'warning');
    } catch (error) {
      $('catalog-status').textContent = 'Box catalog unavailable. Refresh to try again.';
      if (!busy) status(error.message, 'danger');
    } finally { loadingCatalog = false; updateButtons(); }
  }
  $('form').addEventListener('submit', async (event) => {
    event.preventDefault();
    if (busy || !catalogReady || Date.now() < retryUntil) return;
    try {
      const provideitems = $('items').value;
      const inputFormat = $('format').value;
      window.MultiBoxData.parseItems(provideitems, inputFormat);
      const options = { approach: $('approach').value, margin: $('margin').valueAsNumber };
      if (!Number.isFinite(options.margin) || options.margin < 0 || options.margin > 100000) throw new Error('Margin must be a number from 0 to 100,000 mm.');
      for (const key of ['maxSide', 'maxSum', 'maxWeight', 'maxValue']) {
        options[key] = $(key).value === '' ? null : $(key).valueAsNumber;
        if (options[key] !== null && (!Number.isFinite(options[key]) || !$(key).checkValidity())) throw new Error(`Check ${key}.`);
      }
      const payload = { provideitems, format: inputFormat, options };
      if (!$('all-boxes').checked) {
        payload.boxIds = [...choices].filter(([, input]) => input.checked).map(([id]) => id);
        if (!payload.boxIds.length || payload.boxIds.length > 50) throw new Error('Select 1–50 box types, or use all eligible boxes.');
      }
      clearTimeout(pollTimer);
      clearResult();
      rememberJob(null);
      $('resume').hidden = true;
      busy = true;
      updateButtons();
      status('Submitting packing job…');
      const { data, wait } = await api('/jobs', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
      handleJob(data, wait);
    } catch (error) {
      busy = false;
      if (jobId) $('resume').hidden = false;
      status(error.message, 'danger');
      updateButtons();
    }
  });
  $('format').addEventListener('change', () => {
    const csv = $('format').value === 'csv';
    $('csv-help').hidden = !csv;
    $('paste-help').hidden = csv;
    $('items').placeholder = csv ? 'id,width,height,depth,quantity,weight,value,rotation,shrink,soft,fragile\nPoster tube,440,30,30,1,0.18,1500,free,0,false,true' : 'GOODS-04825603 .07kg 235×154×9\n1';
  });
  $('all-boxes').addEventListener('change', () => choices.forEach((input) => { input.disabled = $('all-boxes').checked; }));
  $('refresh').addEventListener('click', loadCatalog);
  $('resume').addEventListener('click', checkJob);
  window.addEventListener('pagehide', (event) => {
    if (event.persisted) return;
    clearTimeout(pollTimer);
    clearTimeout(retryTimer);
    if (previews) previews.dispose();
  });
  try { jobId = sessionStorage.getItem(storageKey); } catch (_error) { /* Optional restoration. */ }
  if (jobId) checkJob();
  loadCatalog();
}());
