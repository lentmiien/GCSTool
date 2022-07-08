const sections_lookup = JSON.parse(document.getElementById('sections_lookup').innerHTML);
const headings_lookup = JSON.parse(document.getElementById('headings_lookup').innerHTML);
const entries = JSON.parse(document.getElementById('entries').innerHTML);
const entries_lookup = entries.map(entry => entry.name);

// Setup edit part
function Setup() {
  // Get edit area and clear everything
  const edit = document.getElementById('edit');
  edit.innerHTML = "";

  // Prepare edit field
  const table = CreateElement('table', null, ['table', 'table-dark', 'table-striped']);
  const thead = CreateElement('thead', null, null);
  const th_row = CreateElement('tr', null, null);
  const th_th1 = CreateElement('th', null, null);
  const th_th2 = CreateElement('th', null, null);
  const th_th3 = CreateElement('th', null, null);
  const th_th4 = CreateElement('th', null, null);
  th_th1.innerText = '';
  th_th2.innerText = 'Invoice';
  th_th3.innerText = 'HS code';
  th_th4.innerText = 'Action';

  th_row.appendChild(th_th1);
  th_row.appendChild(th_th2);
  th_row.appendChild(th_th3);
  th_row.appendChild(th_th4);
  thead.appendChild(th_row);

  const tbody = CreateElement('tbody', null, null);
  const input = document.getElementById('input').value.split('\n');
  input.forEach((entry, i) => {
    const index = entries_lookup.indexOf(entry);

    const td_row = CreateElement('tr', null, null);
    const td_td1 = CreateElement('td', null, ['new_hs']);
    const td_td2 = CreateElement('td', `i_${i}`, null);
    const td_td3 = CreateElement('td', `hs_${i}`, ['output_hs']);
    const td_td4 = CreateElement('td', null, null);
    const edit_btn = CreateElement('button', `btn_${i}`, ['btn', index == -1 ? "btn-danger" : "btn-success"]);

    td_td1.innerText = index == -1 ? 'NEW' : '';
    td_td2.innerText = entry;
    td_td3.innerText = index >= 0 ? entries[index].code : '---';
    td_td4.innerText = '';
    edit_btn.innerText = 'Edit';
    edit_btn.addEventListener('click', e => { Edit(entry, i); });

    td_td4.appendChild(edit_btn);
    td_row.appendChild(td_td1);
    td_row.appendChild(td_td2);
    td_row.appendChild(td_td3);
    td_row.appendChild(td_td4);
    tbody.appendChild(td_row);
  });

  table.appendChild(thead);
  table.appendChild(tbody);
  edit.appendChild(table);
}

// Popup controls
let current_name = null;
let current_hs = '---'
let current_id = null;
function Edit(name, id) {
  // Loop through data.list and find t == data.list[i].tracking
  // Display a fullscreen popup with all details and a close button
  current_name = name;
  current_id = id;

  DisplayPopup();
}

function DisplayPopup() {
  const popup = document.createElement("div");
  popup.id = "popup";
  popup.classList.add("fullscreen-popup");

  const exists = entries_lookup.indexOf(current_name);
  if (exists >= 0) {
    current_hs = entries[exists].code;
  } else {
    current_hs = '---';
  }
  current_hs = document.getElementById(`hs_${current_id}`).innerText;

  const query = current_name.toLowerCase().match(/\b(\w+)\b/g)

  popup.innerHTML = `<button class="btn btn-warning popup-close" onclick="ClosePopup()">Close</button>
  <div>
  <h3>Invoice name: ${current_name}</h3>
  <h3>Current HS code: <span id="current_hs">${current_hs}</span></h3>
  </div>`;

  let table_exist = '<table class="table table-dark table-striped"><thead><tr style="background-color:#005500;"><th></th><th>Name (Previously used)</th><th>HS code</th><th>Uses</th></tr></thead><tbody>';
  const unique_entries = [];
  const unique_entries_lookup = [];
  entries.forEach(entry => {
    const index = unique_entries_lookup.indexOf(entry.code);
    if (index == -1) {
      unique_entries_lookup.push(entry.code);
      unique_entries.push({
        name: entry.name.toLowerCase(),
        code: entry.code,
        uses: entry.uses
      });
    } else {
      unique_entries[index].name += `, ${entry.name.toLowerCase()}`;
      unique_entries[index].uses += entry.uses;
    }
  });
  unique_entries.sort((a, b) => {
    if (a.uses > b.uses) return -1;
    if (a.uses < b.uses) return 1;
    return 0;
  });
  unique_entries.forEach(ue => {
    let disp_name = ue.name;
    query.forEach(q => {
      disp_name = disp_name.split(q).join(`<span class="highlight">${q}</span>`);
    });
    table_exist += `<tr><td><input type="radio" name="hs_code" onclick="document.getElementById('current_hs').innerText=${ue.code};"></td><td>${disp_name}</td><td>${ue.code}</td><td>${ue.uses}</td></tr>`;
  });
  table_exist += '</tbody></table>';

  let table_all = '<table class="table table-dark table-striped"><thead><tr style="background-color:#550000;"><th></th><th>Name (All HS codes)</th><th>HS code</th><th>Uses</th></tr></thead><tbody>';
  const hs_keys = Object.keys(headings_lookup);
  hs_keys.forEach(key => {
    if (key.length == 6) {
      table_all += `<tr><td><input type="radio" name="hs_code" onclick="document.getElementById('current_hs').innerText=${key};"></td><td>${headings_lookup[key].description}</td><td>${key}</td><td>?</td></tr>`;
    }
  });
  table_all += '</tbody></table>';
//style="overflow-y: scroll;height:40%;"
  popup.innerHTML += `
  <div><button class="btn btn-primary mr-3" onclick="document.getElementById('old').classList.remove('hidden');document.getElementById('new').classList.add('hidden');">Previously used HS codes</button><button class="btn btn-primary"  onclick="document.getElementById('old').classList.add('hidden');document.getElementById('new').classList.remove('hidden');">All HS codes</button></div>
  <div id="old" style="overflow-y: scroll;height:80%;">${table_exist}</div>
  <div id="new" class="hidden" style="overflow-y: scroll;height:80%;">${table_all}</div>
  `;

  document.body.appendChild(popup);
}

function ClosePopup() {
  // Save changes accordingly
  // if current_id has value, then only save there
  // if current_id == null, then save to all entries with same name
  const HSCODE = document.getElementById('current_hs').innerText;
  if (HSCODE != '---') {
    const output = document.getElementsByClassName('output_hs');
    for (let i = 0; i < output.length; i++) {
      const row_name = document.getElementById(`i_${i}`).innerText;
      if (row_name === current_name) {
        document.getElementById(`hs_${i}`).innerText = HSCODE;
        document.getElementById(`hs_${i}`).title = HSCODE in headings_lookup ? headings_lookup[HSCODE].description : 'Undefined';
        document.getElementById(`btn_${i}`).classList.remove('btn-danger');
        document.getElementById(`btn_${i}`).classList.add('btn-success');
      }
    }
  }
  document.getElementById("popup").remove();
}

// Put output in copy buffer
function Copy() {
  const output = document.getElementsByClassName('output_hs');
  let copy_string = '';
  for (let i = 0; i < output.length; i++) {
    if (output[i].innerText === '---') {
      alert(`Entry #${i} is unfinished!`);
      return;
    }
    copy_string += `${output[i].innerText}\r\n`;
  }

  // Copy to clipboard
  function listener(e) {
    // e.clipboardData.setData('text/html', output);
    e.clipboardData.setData('text/plain', copy_string);
    e.preventDefault();
  }
  document.addEventListener('copy', listener);
  document.execCommand('copy');
  document.removeEventListener('copy', listener);
}

// Helper functions
function CreateElement(type, id, classes) {
  const element = document.createElement(type);
  if (id) element.id = id;
  if (classes) {
    classes.forEach(c => {
      element.classList.add(c);
    });
  }
  return element;
}