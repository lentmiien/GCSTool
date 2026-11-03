(function () {
  const form = document.getElementById('rate-import-form');
  if (!form) return;
  const status = document.getElementById('rate-import-status');
  const button = form.querySelector('button');
  let busy = false;
  form.addEventListener('submit', async event => {
    event.preventDefault();
    if (busy) return;
    const file = document.getElementById('rate-file').files[0];
    if (!file) { status.textContent = 'Choose a CSV file.'; return; }
    busy = true;
    button.disabled = true;
    document.getElementById('rate-refresh').hidden = true;
    status.textContent = 'Validating and importing the complete chart…';
    try {
      const response = await fetch('/shipcost/api/import', { method: 'POST', headers: { 'X-CSRF-Token': form.dataset.csrf }, body: new FormData(form) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Import failed. Please try again.');
      const change = result.changes;
      status.textContent = `${result.method}: ${result.rows} weight rows × ${result.columns} zones. ` + (result.unchanged
        ? 'The chart is identical. The current chart was kept; no new history version was created.'
        : `Saved a complete new chart. Rows: +${change.addedRows.length}/−${change.removedRows.length}; columns: +${change.addedColumns.length}/−${change.removedColumns.length}; renamed columns: ${change.renamedColumns.length}; changed existing cells: ${change.cells.length}.`) +
        (result.ignoredColumns.length ? ` Ignored ${result.ignoredColumns.length} legacy zone columns.` : '');
      document.getElementById('rate-refresh').hidden = false;
      // The editor still contains the pre-upload values. Require a refresh before
      // allowing a stale manual chart to overwrite the newly imported version.
      document.querySelectorAll('[data-rate-save]').forEach(control => { control.disabled = true; });
    } catch (error) {
      status.textContent = error.message;
    } finally {
      busy = false;
      button.disabled = false;
    }
  });
}());
