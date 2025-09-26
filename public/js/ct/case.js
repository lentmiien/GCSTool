(() => {
  const itemForm = document.getElementById('item-form');
  if (!itemForm) return;

  const idField = document.getElementById('item_id');
  const codeField = document.getElementById('item_code');
  const defectField = document.getElementById('item_defect');
  const costField = document.getElementById('item_cost');
  const resetButton = document.getElementById('item-reset');
  const submitButton = itemForm.querySelector('button[type="submit"]');

  const clearForm = () => {
    if (idField) idField.value = '';
    if (codeField) codeField.value = '';
    if (defectField) defectField.value = '';
    if (costField) costField.value = '';
    if (submitButton) submitButton.textContent = 'Save item';
  };

  const buttons = itemForm.parentElement.querySelectorAll('button[data-item]');
  buttons.forEach(button => {
    button.addEventListener('click', () => {
      try {
        const payload = JSON.parse(button.dataset.item);
        if (idField) idField.value = payload.id || '';
        if (codeField) codeField.value = payload.item_code || '';
        if (defectField) defectField.value = payload.defect || '';
        if (costField) costField.value = payload.item_cost || '';
        if (submitButton) submitButton.textContent = 'Update item';
      } catch (error) {
        console.error('Failed to parse item payload', error);
      }
    });
  });

  if (resetButton) {
    resetButton.addEventListener('click', clearForm);
  }
})();
