(() => {
  const fileInput = document.getElementById('inputfile');
  const exportBtn = document.getElementById('export-btn');
  const rowsContainer = document.getElementById('ie-rows');
  const statusEl = document.getElementById('file-status');

  let rows = [];
  let rowDelimiter = '\r\n';
  let fileName = '';

  const setStatus = (text) => {
    statusEl.textContent = text || '';
  };

  const detectRowDelimiter = (text) => {
    if (text.indexOf('\r\n') !== -1) {
      return '\r\n';
    }
    if (text.indexOf('\n') !== -1) {
      return '\n';
    }
    return '\r\n';
  };

  const resetState = () => {
    rows = [];
    rowDelimiter = '\r\n';
    fileName = '';
    rowsContainer.innerHTML = '';
    exportBtn.disabled = true;
    setStatus('');
  };

  const parseCsv = (text) => {
    rowDelimiter = detectRowDelimiter(text);
    const lines = text.split(rowDelimiter);
    rows = lines.map(line => (line.length ? line.split(',') : []));
  };

  const buildEditor = () => {
    rowsContainer.innerHTML = '';
    exportBtn.disabled = true;

    if (!rows.length) {
      setStatus('No rows found.');
      return;
    }

    const fragment = document.createDocumentFragment();
    let irelandCount = 0;
    let itemCountTotal = 0;

    rows.forEach((row, rowIndex) => {
      if (row.length > 12 && row[12].trim() === 'IE') {
        irelandCount++;
        const orderNumber = row[0] || '(missing order)';

        const card = document.createElement('div');
        card.classList.add('card', 'mb-3', 'ie-editor-card');

        const header = document.createElement('div');
        header.classList.add('card-header', 'ie-editor-card-header');
        header.textContent = `Order ${orderNumber}`;
        card.appendChild(header);

        const body = document.createElement('div');
        body.classList.add('card-body', 'ie-editor-card-body');

        let itemIndex = 0;
        let foundItem = false;
        while (true) {
          const productIndex = 25 + (itemIndex * 6);
          const hsIndex = 29 + (itemIndex * 6);
          if (productIndex >= row.length || hsIndex >= row.length) {
            break;
          }
          foundItem = true;
          itemCountTotal++;

          const rowDiv = document.createElement('div');
          rowDiv.classList.add('form-row');

          const productGroup = document.createElement('div');
          productGroup.classList.add('form-group', 'col-md-8');
          const productLabel = document.createElement('label');
          productLabel.textContent = `Item ${itemIndex + 1} product name (col ${productIndex + 1})`;
          const productInput = document.createElement('input');
          productInput.type = 'text';
          productInput.classList.add('form-control', 'ie-field', 'ie-dark-input');
          productInput.value = row[productIndex] || '';
          productInput.dataset.rowIndex = rowIndex.toString();
          productInput.dataset.colIndex = productIndex.toString();
          productGroup.appendChild(productLabel);
          productGroup.appendChild(productInput);

          const hsGroup = document.createElement('div');
          hsGroup.classList.add('form-group', 'col-md-4');
          const hsLabel = document.createElement('label');
          hsLabel.textContent = `HS code (col ${hsIndex + 1})`;
          const hsInput = document.createElement('input');
          hsInput.type = 'text';
          hsInput.classList.add('form-control', 'ie-field', 'ie-dark-input');
          hsInput.value = row[hsIndex] || '';
          hsInput.dataset.rowIndex = rowIndex.toString();
          hsInput.dataset.colIndex = hsIndex.toString();
          hsGroup.appendChild(hsLabel);
          hsGroup.appendChild(hsInput);

          rowDiv.appendChild(productGroup);
          rowDiv.appendChild(hsGroup);
          body.appendChild(rowDiv);

          itemIndex++;
        }

        if (!foundItem) {
          const warning = document.createElement('div');
          warning.classList.add('alert', 'alert-warning', 'mb-0', 'ie-editor-warning');
          warning.textContent = 'No item columns found for this row.';
          body.appendChild(warning);
        }

        card.appendChild(body);
        fragment.appendChild(card);
      }
    });

    rowsContainer.appendChild(fragment);

    if (irelandCount === 0) {
      setStatus('No Ireland (IE) rows found in this file.');
      return;
    }

    setStatus(`Loaded ${rows.length} rows. Showing ${irelandCount} Ireland row(s) with ${itemCountTotal} item(s).`);
    exportBtn.disabled = false;
  };

  const applyEdits = () => {
    const inputs = document.querySelectorAll('.ie-field');
    inputs.forEach((input) => {
      const rowIndex = Number(input.dataset.rowIndex);
      const colIndex = Number(input.dataset.colIndex);
      if (!Number.isNaN(rowIndex) && !Number.isNaN(colIndex) && rows[rowIndex]) {
        rows[rowIndex][colIndex] = input.value;
      }
    });
  };

  const exportCsv = () => {
    if (!rows.length || !fileName) {
      alert('Select a CSV file first.');
      return;
    }
    applyEdits();
    const output = rows.map(cols => cols.join(',')).join(rowDelimiter);
    const blob = new Blob([output], { type: 'text/csv;charset=utf-8' });
    saveAs(blob, fileName);
  };

  fileInput.addEventListener('change', () => {
    const file = fileInput.files[0];
    if (!file) {
      resetState();
      return;
    }
    fileName = file.name;
    const reader = new FileReader();
    reader.onload = () => {
      parseCsv(String(reader.result || ''));
      buildEditor();
    };
    reader.onerror = () => {
      resetState();
      setStatus('Could not read file.');
    };
    reader.readAsText(file, 'utf-8');
  });

  exportBtn.addEventListener('click', exportCsv);
})();
