(() => {
  const form = document.getElementById('new-case-form');
  const templateSelect = document.getElementById('template_id');
  if (!form || !templateSelect) return;

  const description = document.getElementById('template_description');
  const deadlineField = document.getElementById('deadline');
  const typeField = document.getElementById('type');
  const statusField = document.getElementById('status');
  const solutionField = document.getElementById('solution');

  const templateMap = (window.caseTemplates || []).reduce((map, template) => {
    map[template.id] = template;
    return map;
  }, {});

  const inputs = Array.from(form.querySelectorAll('input, select, textarea'))
    .filter(el => el.name);
  inputs.forEach(el => {
    el.dataset.initialRequired = el.required ? 'true' : 'false';
  });

  const setRequiredFromTemplate = (requiredList) => {
    const requiredSet = new Set(requiredList || []);
    inputs.forEach(el => {
      const baseRequired = el.dataset.initialRequired === 'true';
      el.required = baseRequired || requiredSet.has(el.name);
      if (requiredSet.has(el.name)) {
        el.classList.add('is-template-required');
      } else {
        el.classList.remove('is-template-required');
      }
    });
  };

  const setDeadlineDays = (days) => {
    if (!deadlineField || !days) return;
    const today = new Date();
    const future = new Date(today);
    future.setDate(future.getDate() + Number(days));
    const yyyy = future.getFullYear();
    const mm = String(future.getMonth() + 1).padStart(2, '0');
    const dd = String(future.getDate()).padStart(2, '0');
    deadlineField.value = `${yyyy}-${mm}-${dd}`;
  };

  const applyTemplate = (templateId) => {
    const template = templateMap[templateId];
    if (!template) {
      setRequiredFromTemplate([]);
      if (description) description.textContent = 'Select a template to auto-fill defaults.';
      return;
    }

    const defaults = template.defaults || {};

    if (description) {
      description.textContent = template.description || '';
    }

    if (defaults.type && typeField) {
      typeField.value = defaults.type;
    }

    if (defaults.status && statusField) {
      statusField.value = defaults.status;
    }

    if (defaults.solution && solutionField) {
      solutionField.value = defaults.solution;
    }

    if (defaults.deadlineDays) {
      setDeadlineDays(defaults.deadlineDays);
    }

    setRequiredFromTemplate(defaults.requiredFields || []);
  };

  templateSelect.addEventListener('change', (event) => {
    applyTemplate(event.target.value);
  });

  if (templateSelect.value) {
    applyTemplate(templateSelect.value);
  }
})();
