(function () {
  'use strict';
  const $ = (id) => document.getElementById(`sb-${id}`);
  const { parseItems, buildLayers } = window.SmallestBoxData;
  let catalogReady = false;
  let busy = false;
  let retryUntil = 0;
  let retryTimer;
  let preview;
  let layers = [];
  let selectedLayer = 0;
  let searchResults;
  const tagControls = new Map();
  const format = (value) => Number(value).toLocaleString(undefined, { maximumFractionDigits: 3 });
  const dimensions = (item) => `${format(item.w)} × ${format(item.d)} × ${format(item.h)} mm`;

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
    $('generate').disabled = busy || !catalogReady || seconds > 0;
    $('generate').textContent = busy ? 'Generating…' : seconds ? `Try again in ${seconds}s` : 'Generate';
    $('refresh').disabled = busy || seconds > 0;
    clearTimeout(retryTimer);
    if (seconds) retryTimer = setTimeout(updateButtons, 1000);
  }

  async function api(path, options = {}) {
    let response;
    try {
      response = await fetch(`/smallest-box${path}`, { credentials: 'same-origin', cache: 'no-store', ...options });
    } catch (_error) {
      throw new Error('Could not reach the server. Check your connection and try again.');
    }
    if (response.redirected) throw new Error('Your session has ended or needs attention. Reload the page to sign in.');
    const retry = response.headers.get('Retry-After');
    if (retry || response.status === 429) {
      const delay = retry && /^\d+$/.test(retry) ? Number(retry) * 1000 : retry ? Date.parse(retry) - Date.now() : 60000;
      retryUntil = Date.now() + (Number.isFinite(delay) ? Math.max(1000, delay) : 60000);
      updateButtons();
    }
    let data;
    try {
      data = await response.json();
    } catch (_error) {
      throw new Error('The server returned an unreadable response. Please try again later.');
    }
    if (!response.ok) throw new Error(data.message || 'The request failed. Please try again later.');
    return data;
  }

  function clearResult() {
    if (preview) preview.dispose();
    preview = null;
    layers = [];
    searchResults = null;
    $('solution').replaceChildren();
    $('solutions-panel').hidden = true;
    $('alternatives-note').hidden = true;
    $('result').hidden = true;
    $('empty').hidden = false;
    $('layers').replaceChildren();
    $('preview').replaceChildren();
  }

  async function loadCatalog() {
    const previous = new Map([...tagControls].map(([tag, control]) => [tag, control.value]));
    catalogReady = false;
    $('refresh').disabled = true;
    $('generate').disabled = true;
    $('catalog-status').textContent = 'Loading box catalog…';
    try {
      const data = await api('/containers');
      if (!Array.isArray(data.containers) || !Array.isArray(data.tags)) throw new Error('The box catalog is invalid. Please refresh it.');
      tagControls.clear();
      $('tags').replaceChildren();
      data.tags.forEach((tag, index) => {
        const row = element('div', undefined, 'sb-tag-row');
        const label = element('label', tag);
        const select = element('select', undefined, 'form-control form-control-sm');
        select.id = `sb-tag-${index}`;
        label.htmlFor = select.id;
        [['', 'Default'], ['require', 'Require'], ['requireNot', 'Require not']].forEach(([value, title]) => {
          const option = element('option', title);
          option.value = value;
          select.appendChild(option);
        });
        select.value = previous.get(tag) || '';
        tagControls.set(tag, select);
        row.append(label, select);
        $('tags').appendChild(row);
      });
      if (!data.tags.length) $('tags').appendChild(element('p', 'No tags in this catalog.', 'text-muted'));
      $('catalog').replaceChildren();
      data.containers.forEach((box) => {
        const row = element('p');
        row.append(element('strong', box.id), element('small', `${dimensions(box)} · empty ${format(box.emptyWeight)} kg · max load including cushion ${format(box.maxLoadWeight)} kg`, 'd-block text-muted'));
        row.appendChild(element('small', (box.tags || []).join(', ') || 'No tags', 'd-block text-muted'));
        $('catalog').appendChild(row);
      });
      $('catalog-status').textContent = `${data.containers.length} boxes · ${data.tags.length} tags · revision ${data.revision}. Searches use the latest saved catalog.`;
      catalogReady = data.containers.length > 0;
      if (!$('result').hidden) status('Box catalog refreshed. The displayed plan belongs to your previous search.');
      else status(catalogReady ? 'Ready. Paste your items, choose any tag filters, then Generate.' : 'The box catalog is empty. Add boxes on the source site, then refresh.', catalogReady ? 'info' : 'warning');
    } catch (error) {
      clearResult();
      $('catalog-status').textContent = 'Box catalog unavailable. Use Refresh boxes to try again.';
      status(error.message, 'danger');
    } finally {
      updateButtons();
    }
  }

  function selectLayer(index) {
    selectedLayer = Math.max(0, Math.min(layers.length - 1, index));
    const layer = layers[selectedLayer];
    if (!layer) return;
    $('layer').value = selectedLayer;
    $('layer').setAttribute('aria-valuetext', `Layer ${selectedLayer + 1}, bottom ${format(layer.z)} millimeters`);
    $('layer-label').textContent = `Layer ${selectedLayer + 1} of ${layers.length} · bottom ${format(layer.z)} mm`;
    $('down').disabled = selectedLayer === 0;
    $('up').disabled = selectedLayer === layers.length - 1;
    [...$('layers').children].forEach((card, i) => {
      card.classList.toggle('is-active', i === selectedLayer);
      card.querySelector('button').setAttribute('aria-pressed', String(i === selectedLayer));
    });
    if (preview) preview.updateLayer(layer.z, $('show-above').checked);
  }

  function showResult(data, items, algorithm) {
    const box = data.container;
    const placements = data.data && data.data.pallets && data.data.pallets[0] && data.data.pallets[0].placements;
    if (!box || !Array.isArray(placements) || !placements.length
      || !['w', 'd', 'h'].every((key) => Number.isFinite(box[key]) && box[key] > 0)
      || placements.some((p) => !items.some((item) => item.id === p.itemId)
        || !['x', 'y', 'z'].every((key) => Number.isFinite(p[key]) && p[key] >= 0)
        || !['w', 'd', 'h'].every((key) => Number.isFinite(p[key]) && p[key] > 0))) {
      throw new Error('The packing service returned invalid placements. Please try again.');
    }
    if (preview) preview.dispose();
    preview = null;
    $('preview').replaceChildren();
    $('layers').replaceChildren();
    const colors = new Map(items.map((item, index) => [item.id, `hsl(${(index * 137.508 + 175) % 360}, 58%, 55%)`]));
    const contentsWeight = items.reduce((sum, item) => sum + item.weight * item.qty, 0);
    const hasShipmentWeight = Number.isFinite(data.estimatedShipmentWeight) && data.estimatedShipmentWeight >= 0;
    const hasCushionWeight = Number.isFinite(data.estimatedCushionWeight) && data.estimatedCushionWeight >= 0;
    const fill = 100 * placements.reduce((sum, p) => sum + p.w * p.d * p.h, 0) / (box.w * box.d * box.h);
    layers = buildLayers(placements);
    $('box-name').textContent = box.id;
    $('box-details').textContent = `${dimensions(box)} · ${(box.tags || []).join(', ') || 'No tags'}`;
    $('metrics').replaceChildren();
    const metrics = [
      [hasShipmentWeight ? `${format(data.estimatedShipmentWeight)} kg` : `${format(contentsWeight + box.emptyWeight)} kg`, hasShipmentWeight ? 'Estimated shipment weight' : 'Items + box (excl. cushion)'],
      [hasCushionWeight ? `${format(data.estimatedCushionWeight)} kg` : 'Not provided', 'Estimated cushion weight'],
      [`${format(contentsWeight)} kg`, 'Item weight'],
      [placements.length, 'Items packed'], [`${format(fill)}%`, 'Volume filled'], [layers.length, 'Layers'],
    ];
    metrics.forEach(([value, label]) => {
      const metric = element('div', undefined, 'sb-metric');
      metric.append(element('strong', value), element('span', label));
      $('metrics').appendChild(metric);
    });
    const meta = data.meta || {};
    $('weight-details').textContent = `Box weight ${format(box.emptyWeight)} kg · Maximum load including cushion ${format(box.maxLoadWeight)} kg. ${hasShipmentWeight ? 'Shipment estimate includes items, box, and cushion; actual weight may vary.' : 'The service did not provide a shipment estimate including cushion.'}`;
    const usable = meta.usableDimensions;
    $('margin-details').textContent = Number.isFinite(meta.safetyMarginMm)
      ? `Safety margin ${format(meta.safetyMarginMm)} mm on each side.${usable ? ` Usable space ${dimensions(usable)}.` : ''}`
      : 'Safety margin was not reported by the service.';
    $('search-details').textContent = `${meta.algorithm || algorithm} · ${meta.attempts ?? '—'} packing attempts across all choices · ${meta.eligibleContainers ?? '—'} eligible boxes · ${meta.filteredContainers ?? '—'} filtered out.`;
    layers.forEach((layer, index) => {
      const card = element('section', undefined, 'sb-layer-card');
      const heading = element('div', undefined, 'sb-layer-heading');
      const button = element('button', `Layer ${index + 1}${index === 0 ? ' (base)' : ''}`, 'btn btn-sm btn-outline-primary');
      button.type = 'button';
      button.addEventListener('click', () => selectLayer(index));
      heading.append(button, element('span', `Bottom ${format(layer.z)} mm · ${layer.items.length} items`));
      card.appendChild(heading);
      layer.items.forEach((placement) => {
        const row = element('div', undefined, 'sb-placement');
        const swatch = element('span', undefined, 'sb-swatch');
        swatch.style.backgroundColor = colors.get(placement.itemId);
        swatch.setAttribute('aria-hidden', 'true');
        const description = element('div');
        description.append(element('strong', placement.itemId), element('small', `Origin (${format(placement.x)}, ${format(placement.y)}, ${format(placement.z)}) mm · placed size ${dimensions(placement)}`));
        row.append(swatch, description);
        card.appendChild(row);
      });
      $('layers').appendChild(card);
    });
    $('empty').hidden = true;
    $('result').hidden = false;
    $('layer').max = layers.length - 1;
    $('show-above').checked = false;
    try {
      preview = window.createSmallestBoxPreview($('preview'), box, placements, colors);
      $('reset-view').disabled = false;
    } catch (_error) {
      $('preview').replaceChildren(element('p', '3D preview is unavailable in this browser. Enable WebGL or use the layer placement list below.', 'p-3'));
      $('reset-view').disabled = true;
    }
    selectLayer(0);
    status(`Viewing ${box.id}. All ${placements.length} items fit in this box.`, 'success');
  }

  function showSolutions(data, items, algorithm) {
    const alternatives = data.alternatives === undefined ? [] : data.alternatives;
    if (!Array.isArray(alternatives) || alternatives.length > 2
      || alternatives.some((solution) => !solution || solution.success !== true || !solution.container)) {
      throw new Error('The packing service returned invalid alternative solutions.');
    }
    searchResults = { solutions: [data, ...alternatives], items, algorithm };
    $('solution').replaceChildren();
    searchResults.solutions.forEach((solution, index) => {
      const weight = Number.isFinite(solution.estimatedShipmentWeight) ? ` · est. ${format(solution.estimatedShipmentWeight)} kg` : '';
      const option = element('option', `${index + 1}. ${solution.container.id}${index === 0 ? ' (primary)' : ''}${weight}`);
      option.value = index;
      $('solution').appendChild(option);
    });
    $('solution').value = '0';
    $('solutions-panel').hidden = searchResults.solutions.length === 1;
    $('alternatives-note').hidden = !data.meta || data.meta.alternativesSearchComplete !== false;
    showResult(data, items, algorithm);
  }

  $('form').addEventListener('submit', async (event) => {
    event.preventDefault();
    if (busy || !catalogReady || Date.now() < retryUntil) return;
    clearResult();
    busy = true;
    $('inputs').disabled = true;
    updateButtons();
    $('result').setAttribute('aria-busy', 'true');
    try {
      const items = parseItems($('items').value);
      const algorithm = $('algorithm').value;
      const safetyMarginMm = $('safety-margin').valueAsNumber;
      if (!Number.isFinite(safetyMarginMm) || safetyMarginMm < 0 || safetyMarginMm > 500000) throw new Error('Safety margin must be a number from 0 to 500,000 mm.');
      if (algorithm === 'bruteforce' && items.reduce((sum, item) => sum + item.qty, 0) > 7) throw new Error('Brute force supports at most 7 total items. Choose LAFF or Plain.');
      const tagFilter = { require: [], requireNot: [] };
      tagControls.forEach((select, tag) => { if (select.value) tagFilter[select.value].push(tag); });
      if (tagFilter.require.length > 20 || tagFilter.requireNot.length > 20) throw new Error('Choose at most 20 tags per filter.');
      status('Searching for box choices… This may take up to 75 seconds.');
      const data = await api('/pack', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ provideitems: $('items').value, algorithm, safetyMarginMm, tagFilter }) });
      if (data.success === false) {
        status(`${data.message || 'No complete packing was found.'} Try another algorithm or change the items, safety margin, or tag filters. A heuristic search may miss a possible fit.`, 'warning');
      } else if (data.success === true) showSolutions(data, items, algorithm);
      else throw new Error('The packing service returned an invalid response.');
    } catch (error) {
      clearResult();
      status(error.message, 'danger');
    } finally {
      busy = false;
      $('inputs').disabled = false;
      $('result').setAttribute('aria-busy', 'false');
      updateButtons();
    }
  });
  $('refresh').addEventListener('click', loadCatalog);
  $('solution').addEventListener('change', () => {
    if (!searchResults) return;
    try {
      const { solutions, items, algorithm } = searchResults;
      showResult(solutions[Number($('solution').value)], items, algorithm);
    } catch (error) {
      clearResult();
      status(error.message, 'danger');
    }
  });
  $('down').addEventListener('click', () => selectLayer(selectedLayer - 1));
  $('up').addEventListener('click', () => selectLayer(selectedLayer + 1));
  $('layer').addEventListener('input', () => selectLayer(Number($('layer').value)));
  $('show-above').addEventListener('change', () => selectLayer(selectedLayer));
  $('reset-view').addEventListener('click', () => { if (preview) preview.reset(); });
  window.addEventListener('pagehide', (event) => { if (preview && !event.persisted) preview.dispose(); });
  loadCatalog();
}());
