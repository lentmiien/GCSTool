(function () {
  'use strict';
  const root = document.getElementById('country-manager');
  if (!root) return;
  const status = document.getElementById('cm-status');
  const flashKey = 'gcs-country-manager-flash';
  try {
    const message = window.sessionStorage.getItem(flashKey);
    window.sessionStorage.removeItem(flashKey);
    if (message) {
      status.textContent = message;
      status.className = 'cm-status alert alert-success';
    }
  } catch (_) { /* Saving works when browser storage is unavailable. */ }
  let saving = false;
  root.addEventListener('submit', async function (event) {
    const form = event.target;
    if (!form.matches('.cm-edit')) return;
    event.preventDefault();
    if (saving) return;
    if (form.dataset.confirm && !window.confirm(form.dataset.confirm)) return;
    saving = true;
    const buttons = Array.from(root.querySelectorAll('.cm-edit button')).map(button => ({ button, disabled: button.disabled }));
    buttons.forEach(({ button }) => { button.disabled = true; });
    status.textContent = 'Saving…';
    status.className = 'cm-status alert alert-info';
    try {
      const response = await fetch(form.getAttribute('action'), { method: 'POST', headers: { 'X-CSRF-Token': root.dataset.csrf }, body: new FormData(form) });
      let result;
      try { result = await response.json(); }
      catch (_) { throw new Error('The server did not return a save result. Reload the page and sign in again if needed.'); }
      if (!response.ok) throw new Error(result.error || 'Could not save. Reload and try again.');
      // Update all form revisions so unchanged saves also remain safe.
      root.querySelectorAll('input[name="revision"]').forEach(input => { input.value = result.revision; });
      if (result.changed) {
        try { window.sessionStorage.setItem(flashKey, result.message || 'Changes saved.'); }
        catch (_) { /* The saved data will still appear after reloading. */ }
        const section = form.closest('.cm-source, .cm-method-visibility, .cm-exceptions');
        if (section && section.id) window.history.replaceState(null, '', `#${section.id}`);
        window.location.reload();
      } else {
        status.textContent = result.message || 'No changes to save.';
        status.className = 'cm-status alert alert-info';
      }
    } catch (error) {
      status.textContent = error.message || 'Could not save. Reload and try again.';
      status.className = 'cm-status alert alert-danger';
      status.scrollIntoView({ block: 'center', behavior: 'smooth' });
    } finally {
      saving = false;
      buttons.forEach(({ button, disabled }) => { button.disabled = disabled; });
    }
  });
  function openSection() {
    const section = document.getElementById(window.location.hash.slice(1));
    if (section && section.matches('details')) section.open = true;
  }
  openSection();
  window.addEventListener('hashchange', openSection);
})();
