(function () {
  'use strict';
  const root = document.querySelector('.jp-tool');
  const form = document.getElementById('jp-import-form');
  const status = document.getElementById('jp-import-status');
  let importing = false;
  form.addEventListener('submit', async event => {
    event.preventDefault();
    if (importing) return;
    const file = document.getElementById('jp-csv').files[0];
    const result = document.getElementById('jp-import-result');
    result.hidden = true;
    status.classList.remove('jp-error');
    if (!file || file.size > 5 * 1024 * 1024) {
      status.textContent = 'Choose a CSV file of 5 MB or smaller.';
      status.classList.add('jp-error');
      return;
    }
    importing = true;
    const button = form.querySelector('button');
    button.disabled = true;
    status.textContent = 'Validating and importing countries…';
    try {
      const body = new FormData();
      body.append('csvFile', file);
      const response = await fetch('/japan-post/api/import', {
        method: 'POST', headers: { 'X-CSRF-Token': root.dataset.csrf }, body,
      });
      const data = await response.json().catch(() => { throw new Error('The upload failed or your session expired. Reload and try again.'); });
      if (!response.ok) throw new Error(data.error || 'The import failed. Please try again.');
      for (const key of ['added', 'updated', 'unchanged']) document.getElementById(`jp-${key}`).textContent = data[key];
      document.getElementById('jp-country-count').textContent = Number(document.getElementById('jp-country-count').textContent) + data.added;
      document.getElementById('jp-last-checked').textContent = new Date(data.checkedAt).toLocaleString('en-GB', { timeZone: 'Asia/Tokyo', hour12: false });
      status.textContent = `Imported ${data.total} countries successfully.`;
      result.hidden = false;
      form.reset();
    } catch (error) {
      status.textContent = error.message;
      status.classList.add('jp-error');
    } finally { importing = false; button.disabled = false; }
  });
})();
