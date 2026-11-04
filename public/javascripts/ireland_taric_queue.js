(() => {
  const warning = document.getElementById('taric-queue-warning');
  if (!warning) return;
  const message = document.getElementById('taric-queue-message');
  const button = document.getElementById('taric-queue-clear');
  const notice = document.getElementById('taric-queue-notice');
  let busy = false;
  const duration = ms => {
    const minutes = Math.floor(ms / 60000);
    return minutes < 1 ? 'less than a minute' : `${minutes} minute(s)`;
  };
  async function request(path, clear = false) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 10000);
    try {
      const response = await fetch(`/hs/ireland/predictor/queue${path}`, {
        method: clear ? 'POST' : 'GET', credentials: 'same-origin', cache: 'no-store', signal: controller.signal,
        ...(clear ? { headers: { 'Content-Type': 'application/json',
          'X-CSRF-Token': document.getElementById('taric-csrf').value }, body: '{}' } : {}),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'STORAGE_FAILED');
      return data;
    } finally { clearTimeout(timer); }
  }
  async function refresh() {
    if (busy) return;
    busy = true;
    button.disabled = true;
    try {
      const data = await request('');
      warning.hidden = data.count === 0;
      message.textContent = `${data.count} item(s) queued or outstanding. Oldest item has waited ${duration(data.waitingMs)}. No queue activity for ${duration(data.stalledMs)}.`;
      button.disabled = !data.canClear;
    } catch (_) {
      notice.textContent = 'AI queue status could not be checked. Refresh the page to retry.';
    } finally { busy = false; }
  }
  button.addEventListener('click', async () => {
    if (busy || button.disabled) return;
    busy = true;
    button.disabled = true;
    try {
      const data = await request('/clear', true);
      notice.textContent = `Cleared ${data.cleared} queued item(s). You can start a new prediction.`;
    } catch (error) {
      notice.textContent = error.message === 'QUEUE_NOT_STALLED'
        ? 'The queue has resumed activity or has not stopped for over 15 minutes. It was not cleared.'
        : error.message === 'QUEUE_WORKER_BUSY'
          ? 'A worker is currently processing a request. Try clearing again shortly.'
          : 'The queue could not be cleared. Reload the page and retry.';
    } finally { busy = false; await refresh(); }
  });
  refresh();
  setInterval(refresh, 30000);
})();
