(function () {
  'use strict';
  const root = document.querySelector('.jp-tool');
  const byId = id => document.getElementById(id);
  const services = [['parcel.air', 'Parcel · air'], ['parcel.surface', 'Parcel · surface'], ['ems', 'EMS']];
  const fields = [['size.length', 'Maximum length'], ['size.lengthPlusGirth', 'Length + girth'], ['weight', 'Maximum weight']];
  const date = value => value ? new Date(value).toLocaleString('en-GB', { timeZone: 'Asia/Tokyo', hour12: false }) : '—';
  function valueAt(data, path) {
    let value = data;
    for (const part of path.split('.')) {
      if (typeof value === 'string') return value;
      value = value && value[part];
    }
    return value && typeof value === 'object' ? `${value.value} ${value.unit}` : value == null ? '—' : String(value);
  }
  function element(tag, text, className) {
    const node = document.createElement(tag);
    if (text !== undefined) node.textContent = text;
    if (className) node.className = className;
    return node;
  }
  function status(id, text, error = false) {
    const node = byId(id);
    node.textContent = text;
    node.classList.toggle('jp-error', error);
  }
  async function request(path, body) {
    const response = await fetch(`/japan-post/api/${path}`, body === undefined ? {} : {
      method: 'POST', headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': root.dataset.csrf }, body: JSON.stringify(body),
    });
    const data = await response.json().catch(() => { throw new Error('The request failed or your session expired. Reload the page and try again.'); });
    if (!response.ok) throw new Error(data.error || 'Request failed. Please try again.');
    return data;
  }
  function cards(data, previous) {
    const container = element('div', undefined, 'jp-limit-cards');
    services.forEach(([path, label]) => {
      const card = element('div', undefined, 'jp-limit-card');
      card.append(element('h3', label));
      const service = path.split('.').reduce((value, key) => value[key], data);
      const oldService = previous && path.split('.').reduce((value, key) => value[key], previous);
      if (service.unavailable) {
        const message = element(oldService && !oldService.unavailable ? 'strong' : 'p', 'Unavailable', 'jp-unavailable');
        if (oldService && !oldService.unavailable) message.title = 'Previously: size and weight limits were listed';
        card.append(message);
        container.append(card);
        return;
      }
      if (oldService && oldService.unavailable) card.append(element('strong', 'Limits now listed', 'jp-changed'));
      const list = element('dl');
      fields.forEach(([field, title]) => {
        const value = valueAt(data, `${path}.${field}`);
        const old = previous && valueAt(previous, `${path}.${field}`);
        list.append(element('dt', title));
        const description = element('dd');
        if (previous && value !== old) {
          const strong = element('strong', value, 'jp-changed');
          strong.title = `Previously: ${old}`;
          description.append(strong);
        } else description.textContent = value;
        list.append(description);
      });
      card.append(list);
      container.append(card);
    });
    return container;
  }
  function showResult(cid, latest, history) {
    byId('jp-result').hidden = false;
    byId('jp-history-panel').hidden = false;
    byId('jp-country-name').textContent = latest.data.countryName;
    byId('jp-source').href = `https://www.post.japanpost.jp/cgi-kokusai/country.php?cid=${cid}`;
    byId('jp-result-dates').textContent = `CID ${cid} · Last updated ${date(latest.detectedAt)} · Last checked ${date(latest.lastCheckedAt)} JST`;
    byId('jp-limits').replaceWith(Object.assign(cards(latest.data, history[0] && history[0].data), { id: 'jp-limits' }));
    byId('jp-json').textContent = JSON.stringify({ cid: Number(cid), ...latest.data }, null, 2);
    byId('jp-warnings').replaceChildren(...latest.data.warnings.map(warning => element('p', warning, 'jp-warning')));
    const panel = byId('jp-history');
    panel.replaceChildren();
    if (!history.length) panel.append(element('p', 'No previous versions. This is the first recorded set of values.', 'jp-muted'));
    history.forEach((entry, index) => {
      const detail = element('details');
      detail.append(element('summary', `${date(entry.detectedAt)} JST · ${entry.data.countryName}`));
      detail.append(element('p', `Last checked ${date(entry.lastCheckedAt)} JST`, 'jp-muted'));
      detail.append(cards(entry.data, history[index + 1] && history[index + 1].data));
      const json = element('details');
      json.append(element('summary', 'Version JSON'), element('pre', JSON.stringify(entry.data, null, 2)));
      detail.append(json);
      panel.append(detail);
    });
  }
  let fetching = false;
  let lookupVersion = 0;
  byId('jp-fetch-form').addEventListener('submit', async event => {
    event.preventDefault();
    if (fetching) return;
    fetching = true;
    lookupVersion++;
    const button = event.currentTarget.querySelector('button');
    button.disabled = true;
    const cid = byId('jp-cid').value;
    status('jp-fetch-status', `Fetching CID ${cid}…`);
    byId('jp-result').hidden = true;
    byId('jp-history-panel').hidden = true;
    try {
      const result = await request('fetch', { cid });
      showResult(cid, result.latest, result.history);
      status('jp-fetch-status', result.fromCache ? 'Already checked today; showing cached values.'
        : result.changed ? 'Fetched and saved a new version.' : 'Values are unchanged; last checked time updated.');
      window.history.replaceState(null, '', `/japan-post?cid=${cid}`);
    } catch (error) {
      status('jp-fetch-status', error.message, true);
      try {
        const cached = await request(`countries/${encodeURIComponent(cid)}`);
        if (cached.history.length) {
          showResult(cid, cached.history[0], cached.history.slice(1));
          status('jp-fetch-status', `${error.message} Showing the previously cached values.`, true);
        }
      } catch (_) { /* Keep the original fetch error visible. */ }
    } finally { fetching = false; button.disabled = false; }
  });

  let refreshing = false;
  async function refreshSchedules() {
    if (refreshing) return;
    refreshing = true;
    try {
      const { schedules } = await request('schedules');
      const tbody = byId('jp-queue');
      tbody.replaceChildren();
      status('jp-queue-status', schedules.length ? `${schedules.length} scheduled checks. Refreshes every 15 seconds.` : 'No scheduled checks yet.');
      schedules.forEach(job => {
        const row = element('tr');
        const link = element('a', String(job.cid));
        link.href = `/japan-post?cid=${job.cid}`;
        const cid = element('td');
        cid.append(link);
        row.append(cid, element('td', `${job.scheduledDate} 07:00`), element('td', job.status),
          element('td', date(job.finishedAt)), element('td', job.error || '—'));
        const action = element('td');
        if (job.status === 'pending') {
          const cancel = element('button', 'Cancel', 'btn btn-sm btn-outline-secondary');
          cancel.type = 'button';
          cancel.addEventListener('click', async () => {
            cancel.disabled = true;
            try { await request(`schedules/${job.id}/cancel`, {}); await refreshSchedules(); }
            catch (error) { status('jp-queue-status', error.message, true); cancel.disabled = false; }
          });
          action.append(cancel);
        }
        row.append(action);
        tbody.append(row);
      });
    } catch (error) { status('jp-queue-status', error.message, true); }
    finally { refreshing = false; }
  }
  byId('jp-schedule-form').addEventListener('submit', async event => {
    event.preventDefault();
    const button = event.currentTarget.querySelector('button');
    button.disabled = true;
    try {
      const result = await request('schedules', { cids: byId('jp-cids').value, date: byId('jp-date').value });
      status('jp-schedule-status', `${result.count} country IDs scheduled or already recorded for this date.`);
      await refreshSchedules();
    } catch (error) { status('jp-schedule-status', error.message, true); }
    finally { button.disabled = false; }
  });
  byId('jp-refresh').addEventListener('click', refreshSchedules);
  refreshSchedules();
  setInterval(() => { if (!document.hidden) refreshSchedules(); }, 15000);

  const initialCid = new URLSearchParams(window.location.search).get('cid');
  if (/^[1-9]\d{0,8}$/.test(initialCid || '')) {
    byId('jp-cid').value = initialCid;
    request(`countries/${initialCid}`).then(result => {
      if (lookupVersion) return;
      if (result.history.length) {
        showResult(initialCid, result.history[0], result.history.slice(1));
        status('jp-fetch-status', 'Showing saved values. Press Fetch to check for updates.');
      }
    }).catch(error => { if (!lookupVersion) status('jp-fetch-status', error.message, true); });
  }
})();
