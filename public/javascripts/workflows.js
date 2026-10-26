(function () {
  'use strict';

  function rows(parent, selector) { return Array.from(parent.querySelectorAll(selector)); }
  function field(row, name) { return row.querySelector(`[data-field="${name}"]`); }

  const editor = document.querySelector('[data-editor]');
  if (editor) {
    const initializedPreviews = new WeakSet();
    function initializePreviews(root) {
      rows(root, '[data-markdown-editor]').forEach(wrapper => {
        if (initializedPreviews.has(wrapper)) return;
        initializedPreviews.add(wrapper);
        const source = wrapper.querySelector('[data-markdown-source]');
        const details = wrapper.querySelector('[data-markdown-preview]');
        const output = wrapper.querySelector('[data-markdown-output]');
        const status = wrapper.querySelector('[data-markdown-status]');
        let timer;
        let revision = 0;
        async function preview(version) {
          if (!details.open) return;
          const text = source.value;
          output.setAttribute('aria-busy', 'true');
          status.textContent = 'Updating preview…';
          try {
            const response = await fetch('/workflows/preview', {
              method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ _csrf: editor.elements._csrf.value, text }),
            });
            if (!response.ok) throw new Error('Preview unavailable');
            const result = await response.json();
            if (version !== revision) return;
            // Only insert the server's sanitized Markdown, never raw editor input.
            output.innerHTML = result.html;
            status.textContent = text.trim() ? '' : 'Nothing to preview yet.';
          } catch (_) {
            if (version === revision) {
              output.textContent = '';
              status.textContent = 'Preview unavailable. Edit the text or reopen the preview to retry.';
            }
          } finally {
            if (version === revision) output.removeAttribute('aria-busy');
          }
        }
        source.addEventListener('input', () => {
          revision += 1;
          clearTimeout(timer);
          if (details.open) {
            status.textContent = 'Updating preview…';
            const version = revision;
            timer = setTimeout(() => preview(version), 250);
          }
        });
        details.addEventListener('toggle', () => {
          revision += 1;
          clearTimeout(timer);
          if (details.open) preview(revision);
          else output.removeAttribute('aria-busy');
        });
      });
    }
    initializePreviews(editor);
    const steps = document.getElementById('workflow-step-rows');
    const required = document.getElementById('workflow-required-rows');
    const trigger = editor.querySelector('[data-trigger]');
    const schedule = editor.querySelector('[data-schedule]');
    function refresh() {
      rows(steps, '[data-step-row]').forEach((row, index) => { row.querySelector('legend').textContent = `Task ${index + 1}`; });
      schedule.hidden = trigger.value !== 'scheduled';
      rows(schedule, '[data-schedule-field]').forEach(input => { input.required = !schedule.hidden; });
      schedule.querySelector('[data-weekdays]').hidden = schedule.querySelector('[data-schedule-field="frequency"]').value !== 'weekly';
      rows(required, '[data-field="defaultValue"]').forEach(input => { input.required = !schedule.hidden; });
    }
    editor.addEventListener('change', refresh);
    editor.addEventListener('click', event => {
      const button = event.target.closest('button');
      if (!button) return;
      if (button.hasAttribute('data-add-step')) {
        if (steps.children.length >= 50) return alert('Use at most 50 tasks.');
        steps.append(document.getElementById('workflow-step-template').content.cloneNode(true));
        initializePreviews(steps.lastElementChild);
      }
      if (button.hasAttribute('data-add-required')) {
        if (required.children.length >= 20) return alert('Use at most 20 required variables.');
        required.append(document.getElementById('workflow-required-template').content.cloneNode(true));
      }
      const row = button.closest('[data-step-row], [data-required-row]');
      if (row && button.hasAttribute('data-remove-row')) row.remove();
      if (row && button.dataset.move === 'up' && row.previousElementSibling) row.previousElementSibling.before(row);
      if (row && button.dataset.move === 'down' && row.nextElementSibling) row.nextElementSibling.after(row);
      refresh();
    });
    editor.addEventListener('submit', event => {
      const stepData = rows(steps, '[data-step-row]').map(row => ({
        id: field(row, 'id').value || undefined,
        title: field(row, 'title').value, description: field(row, 'description').value,
        archived: field(row, 'archived').checked,
        assignees: rows(row, '[data-assignee]:checked').map(input => Number(input.value)),
      }));
      if (!stepData.length) { event.preventDefault(); return alert('Add at least one task.'); }
      editor.elements.steps.value = JSON.stringify(stepData);
      editor.elements.requiredVariables.value = JSON.stringify(rows(required, '[data-required-row]').map(row => ({
        name: field(row, 'name').value, defaultValue: field(row, 'defaultValue').value,
      })));
      const scheduleData = {};
      rows(schedule, '[data-schedule-field]').forEach(input => { scheduleData[input.dataset.scheduleField] = input.value; });
      scheduleData.weekdays = rows(schedule, '[data-weekday]:checked').map(input => Number(input.value));
      editor.elements.schedule.value = JSON.stringify(scheduleData);
    });
    refresh();
  }

  rows(document, '[data-variable-form]').forEach(form => {
    const customRows = form.querySelector('[data-custom-rows]');
    const addCustom = form.querySelector('[data-add-custom]');
    function refreshCustom() {
      addCustom.hidden = customRows.children.length >= 3;
    }
    addCustom.addEventListener('click', () => {
      if (customRows.children.length >= 3) return;
      const row = form.querySelector('[data-custom-template]').content.cloneNode(true);
      customRows.append(row);
      customRows.lastElementChild.querySelector('input').focus();
      refreshCustom();
    });
    customRows.addEventListener('click', event => {
      const button = event.target.closest('[data-remove-custom]');
      if (button) {
        button.closest('[data-custom-row]').remove();
        refreshCustom();
      }
    });
    form.addEventListener('submit', event => {
      const custom = rows(form, '[data-custom-row]').map(row => ({
        name: row.querySelector('[data-custom-name]').value.trim(),
        value: row.querySelector('[data-custom-value]').value.trim(),
      })).filter(variable => variable.name || variable.value);
      if (custom.some(variable => !variable.name || !variable.value)) {
        event.preventDefault();
        return alert('Give each custom variable both a name and a value, or leave both fields empty.');
      }
      form.elements.custom.value = JSON.stringify(custom);
      if (form.elements.values) form.elements.values.value = JSON.stringify(rows(form, '[data-required-value]').map(input => input.value));
    });
    rows(form, '[data-variable-submit]').forEach(button => { button.disabled = false; });
  });
  rows(document, '.workflow-action').forEach(form => {
    form.addEventListener('submit', event => {
      if (event.submitter && event.submitter.value === 'reject' && !form.elements.comment.value.trim()) {
        event.preventDefault();
        form.elements.comment.setCustomValidity('Explain the error before returning this task.');
        form.elements.comment.reportValidity();
      }
    });
    form.elements.comment.addEventListener('input', () => form.elements.comment.setCustomValidity(''));
    rows(form, 'button').forEach(button => button.addEventListener('click', () => form.elements.comment.setCustomValidity('')));
  });
  rows(document, '[data-cancel-run]').forEach(form => form.addEventListener('submit', event => {
    if (!confirm('Cancel this workflow? Its task history will be preserved.')) event.preventDefault();
  }));
  const link = document.querySelector('[data-run-link]');
  if (link) {
    link.value = new URL(link.value, window.location.origin).href;
    link.addEventListener('click', () => link.select());
  }
}());
