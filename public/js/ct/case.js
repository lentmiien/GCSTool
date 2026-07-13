(() => {
  const caseForm = document.getElementById('case-form');
  const editor = document.getElementById('defect-item-editor');
  const hiddenField = document.getElementById('defect_items');
  if (!caseForm || !editor || !hiddenField) return;

  const codeField = document.getElementById('defect_item_code');
  const descriptionField = document.getElementById('defect_item_description');
  const addButton = document.getElementById('defect-item-add');
  const cancelButton = document.getElementById('defect-item-cancel');
  const placeholderButton = document.getElementById('defect-item-placeholder');
  const errorBox = document.getElementById('defect-item-error');
  const table = document.getElementById('defect-item-table');
  const tableBody = table.querySelector('tbody');
  const emptyMessage = document.getElementById('defect-item-empty');
  const complaintSelect = document.getElementById('customer_complaint')
    || document.getElementById('customer_complaint_edit');
  const solvedDate = document.getElementById('solved_date');
  const solution = document.getElementById('solution');
  const solutionMarker = document.querySelector('[data-solved-required-marker]');
  let editIndex = null;
  let rows = [];
  let activeRequiredFields = [];

  try {
    const parsedRows = JSON.parse(hiddenField.value || '[]');
    if (Array.isArray(parsedRows)) rows = parsedRows;
  } catch (error) {
    rows = [];
  }

  let placeholderItem = {
    itemCode: 'ITEM-NOT-CONFIRMED',
    description: 'Customer has not confirmed which item is defective yet.',
    placeholder: true,
  };
  try {
    placeholderItem = JSON.parse(editor.dataset.placeholderItem);
  } catch (error) {
    // The default is identical to the server-defined placeholder.
  }

  const showError = (message) => {
    errorBox.textContent = message;
    errorBox.classList.remove('d-none');
  };

  const clearError = () => {
    errorBox.textContent = '';
    errorBox.classList.add('d-none');
  };

  const resetEditor = () => {
    editIndex = null;
    codeField.value = '';
    descriptionField.value = '';
    addButton.textContent = 'Add item';
    cancelButton.classList.add('d-none');
    clearError();
  };

  const createActionButton = (label, className, action, index) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = className;
    button.textContent = label;
    button.dataset.action = action;
    button.dataset.index = String(index);
    return button;
  };

  const renderRows = () => {
    hiddenField.value = JSON.stringify(rows);
    tableBody.textContent = '';

    rows.forEach((row, index) => {
      const tableRow = document.createElement('tr');
      if (row.placeholder) tableRow.classList.add('ct-placeholder-row');

      const codeCell = document.createElement('td');
      if (row.placeholder) {
        codeCell.textContent = row.itemCode;
        const badge = document.createElement('span');
        badge.className = 'badge ct-placeholder-badge ml-2';
        badge.textContent = 'Placeholder';
        codeCell.appendChild(badge);
      } else {
        const itemLink = document.createElement('a');
        itemLink.href = `/ct/analytics/item/${encodeURIComponent(row.itemCode)}`;
        itemLink.className = 'ct-defect-item-link';
        itemLink.textContent = row.itemCode;
        itemLink.title = `View analytics for ${row.itemCode}`;
        codeCell.appendChild(itemLink);
      }

      const descriptionCell = document.createElement('td');
      descriptionCell.textContent = row.description || 'Description needed';
      if (!row.description) descriptionCell.classList.add('text-danger');

      const actionsCell = document.createElement('td');
      actionsCell.className = 'text-nowrap';
      if (!row.placeholder) {
        actionsCell.appendChild(createActionButton('Edit', 'btn btn-sm btn-outline-primary mr-1', 'edit', index));
      }
      actionsCell.appendChild(createActionButton('Delete', 'btn btn-sm btn-outline-danger', 'delete', index));

      tableRow.appendChild(codeCell);
      tableRow.appendChild(descriptionCell);
      tableRow.appendChild(actionsCell);
      tableBody.appendChild(tableRow);
    });

    const hasRows = rows.length > 0;
    table.classList.toggle('d-none', !hasRows);
    emptyMessage.classList.toggle('d-none', hasRows);
  };

  const addCurrentItem = () => {
    const itemCode = codeField.value.trim();
    const description = descriptionField.value.trim();
    if (!itemCode || !description) {
      showError('Enter both an item code and a defect description.');
      (!itemCode ? codeField : descriptionField).focus();
      return false;
    }

    const nextRow = { itemCode, description, placeholder: false };
    if (editIndex === null) {
      rows = rows.filter((row) => !row.placeholder);
      rows.push(nextRow);
    } else {
      rows[editIndex] = nextRow;
      rows = rows.filter((row) => !row.placeholder);
    }

    resetEditor();
    renderRows();
    return true;
  };

  addButton.addEventListener('click', addCurrentItem);
  cancelButton.addEventListener('click', resetEditor);

  placeholderButton.addEventListener('click', () => {
    if (rows.some((row) => !row.placeholder)) {
      showError('A placeholder is not needed after a real defect item has been added.');
      return;
    }
    rows = [{ ...placeholderItem }];
    resetEditor();
    renderRows();
  });

  tableBody.addEventListener('click', (event) => {
    const button = event.target.closest('button[data-action]');
    if (!button) return;

    const index = Number(button.dataset.index);
    if (!Number.isInteger(index) || !rows[index]) return;

    if (button.dataset.action === 'delete') {
      rows.splice(index, 1);
      resetEditor();
      renderRows();
      return;
    }

    editIndex = index;
    codeField.value = rows[index].itemCode || '';
    descriptionField.value = rows[index].description || '';
    addButton.textContent = 'Update item';
    cancelButton.classList.remove('d-none');
    clearError();
    codeField.focus();
  });

  const getComplaintOption = () => {
    if (!complaintSelect) return null;
    if (complaintSelect.value) return complaintSelect.options[complaintSelect.selectedIndex];

    const originalComplaint = caseForm.dataset.originalComplaint;
    if (!originalComplaint) return complaintSelect.options[complaintSelect.selectedIndex];
    return Array.from(complaintSelect.options).find((option) => option.value === originalComplaint) || null;
  };

  const getEffectiveComplaint = () => {
    if (complaintSelect && complaintSelect.value) return complaintSelect.value;
    return caseForm.dataset.originalComplaint || '';
  };

  const getRequiredFields = () => {
    const option = getComplaintOption();
    if (!option || !option.dataset.requiredFields) return [];
    try {
      const fields = JSON.parse(option.dataset.requiredFields);
      return Array.isArray(fields) ? fields : [];
    } catch (error) {
      return [];
    }
  };

  const updateRequirements = () => {
    activeRequiredFields = getRequiredFields();
    document.querySelectorAll('[data-required-marker]').forEach((marker) => {
      marker.classList.toggle('d-none', activeRequiredFields.indexOf(marker.dataset.requiredMarker) === -1);
    });

    ['customer_id', 'customer_complaint_comment', 'shipping_method', 'shipping_date'].forEach((fieldName) => {
      const field = document.getElementById(fieldName);
      if (field) field.required = activeRequiredFields.indexOf(fieldName) >= 0;
    });

    const itemRequired = activeRequiredFields.indexOf('defect_items') >= 0;
    placeholderButton.classList.toggle('d-none', !itemRequired);
    editor.classList.toggle('ct-required-section', itemRequired);

    const hasComplaint = Boolean(getEffectiveComplaint());
    const requiredList = document.getElementById('complaint-required-list');
    const emptyState = document.getElementById('complaint-required-empty');
    requiredList.classList.toggle('d-none', !hasComplaint);
    emptyState.classList.toggle('d-none', hasComplaint);
    document.querySelectorAll('[data-required-summary]').forEach((item) => {
      item.classList.toggle('d-none', activeRequiredFields.indexOf(item.dataset.requiredSummary) === -1);
    });
    const noExtraRequirements = document.querySelector('[data-no-extra-requirements]');
    noExtraRequirements.classList.toggle('d-none', activeRequiredFields.length > 0);
  };

  const updateSolutionRequirement = () => {
    const required = Boolean(solvedDate && solvedDate.value);
    if (solution) solution.required = required;
    if (solutionMarker) solutionMarker.classList.toggle('d-none', !required);
  };

  if (complaintSelect) complaintSelect.addEventListener('change', updateRequirements);
  if (solvedDate) solvedDate.addEventListener('change', updateSolutionRequirement);

  caseForm.addEventListener('submit', (event) => {
    const hasUnaddedItem = codeField.value.trim() || descriptionField.value.trim();
    if (hasUnaddedItem && !addCurrentItem()) {
      event.preventDefault();
      return;
    }

    if (activeRequiredFields.indexOf('defect_items') >= 0 && rows.length === 0) {
      event.preventDefault();
      showError('Add a defect item, or use “Item not confirmed yet” if the customer has not identified it.');
      editor.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  });

  renderRows();
  updateRequirements();
  updateSolutionRequirement();
})();
