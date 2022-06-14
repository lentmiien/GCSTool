// Globals
let data; // To hold data in input file
const orders = [];// To hold processed order data
const unique_entries = [];
const unique_entries_details = [];
//sections_lookup, headings_lookup, entries
const sections_lookup = JSON.parse(document.getElementById('sections_lookup').innerHTML);
const headings_lookup = JSON.parse(document.getElementById('headings_lookup').innerHTML);
const entries = JSON.parse(document.getElementById('entries').innerHTML);
entries.sort((a, b) => {
  // Sort by number of uses
  if (a.uses > b.uses) return -1;
  if (a.uses < b.uses) return 1;
  return 0;
});
const entries_lookup = entries.map(entry => entry.name);
const display = document.getElementById("hsinput");

// Detect input file and generate HS editor
window.addEventListener('load', function () {
  // These variables are used to store the input data
  const file = {
    dom: document.getElementById('inputfile'),
    binary: null,
  };

  // Use the FileReader API to access file content
  const reader = new FileReader();

  // Because FileReader is asynchronous, store its
  // result when it finishes to read the file
  reader.addEventListener('load', async function () {
    file.binary = reader.result;

    // Convert input data (csv) to JSON data
    data = csvToJson(file.binary.toString());

    // Clear previous input
    display.innerHTML = "";

    // TODO: Display input form
    // Generate list of unique entries
    data.forEach(row => {
      const order_index = orders.length;
      orders.push({ order: row[0], data: [] });
      for (let i = 25; i < row.length-1; i+=6) {
        const index = unique_entries.indexOf(row[i]);
        const existing = entries_lookup.indexOf(row[i]);
        if (index == -1 && row[i]) {
          unique_entries.push(row[i]);
          unique_entries_details.push({
            name: row[i],
            hs: existing == -1 ? '---' : entries[existing].code,
            prev_use: existing == -1 ? 0 : entries[existing].uses,
            count: 1
          });
        }
        if (index >= 0) {
          unique_entries_details[index].count++;
        }
        if (row[i]) {
          const existing = entries_lookup.indexOf(row[i]);
          orders[order_index].data.push({
            name: row[i],
            hs: existing == -1 ? '---' : entries[existing].code,
            prev_use: existing == -1 ? 0 : entries[existing].uses,
            count: 1
          });
        }
      }
    });

    // Unique entries section
    const u_title = document.createElement("h1");
    u_title.innerText = "Unique entries"
    display.appendChild(u_title);
    const u_description = document.createElement("p");
    u_description.innerText = "*If you update these entries, then all orders below (with same content) will be updated."
    display.appendChild(u_description);
    const u_table = document.createElement("table");
    u_table.classList.add("table")
    u_table.classList.add("table-dark")
    u_table.classList.add("table-striped")
    const u_thead = document.createElement("thead");
    const u_throw = document.createElement("tr");
    const u_th0 = document.createElement("th");
    const u_th1 = document.createElement("th");
    u_th1.innerText = 'Invoice';
    const u_th2 = document.createElement("th");
    u_th2.innerText = 'Count / Previous';
    const u_th3 = document.createElement("th");
    u_th3.innerText = 'HS code';
    const u_th4 = document.createElement("th");
    u_th0.style.width = "10%";
    u_th1.style.width = "50%";
    u_th2.style.width = "10%";
    u_th3.style.width = "20%";
    u_th4.style.width = "10%";
    u_throw.appendChild(u_th0);
    u_throw.appendChild(u_th1);
    u_throw.appendChild(u_th2);
    u_throw.appendChild(u_th3);
    u_throw.appendChild(u_th4);
    u_thead.appendChild(u_throw);
    u_table.appendChild(u_thead);
    const u_tbody = document.createElement("tbody");
    unique_entries_details.forEach((ue, i) => {
      if (ue.prev_use == 0) {
        const u_tdrow = document.createElement("tr");
        const u_td0 = document.createElement("td");
        u_td0.classList.add('new_hs');
        u_td0.innerText = ue.prev_use == 0 ? "NEW" : "";
        const u_td1 = document.createElement("td");
        u_td1.innerText = ue.name;
        const u_td2 = document.createElement("td");
        u_td2.innerText = `${ue.count}/${ue.prev_use}`;
        const u_td3 = document.createElement("td");
        u_td3.id = `u${i}`;
        u_td3.innerText = ue.hs;
        const u_td4 = document.createElement("td");
        const u_td4_edit = document.createElement("button");
        u_td4_edit.innerText = "Edit";
        u_td4_edit.classList.add('btn');
        u_td4_edit.classList.add(ue.prev_use == 0 ? "btn-danger" : "btn-success");
        u_td4_edit.classList.add('lg-edit-button');
        u_td4_edit.dataset.value = ue.name;
        u_td4_edit.addEventListener('click', e => { Edit(ue.name, null); });
        u_td4.appendChild(u_td4_edit);
        
        u_tdrow.appendChild(u_td0);
        u_tdrow.appendChild(u_td1);
        u_tdrow.appendChild(u_td2);
        u_tdrow.appendChild(u_td3);
        u_tdrow.appendChild(u_td4);
        u_tbody.appendChild(u_tdrow);
        u_table.appendChild(u_tbody);
      }
    });
    unique_entries_details.forEach((ue, i) => {
      if (ue.prev_use > 0) {
        const u_tdrow = document.createElement("tr");
        const u_td0 = document.createElement("td");
        u_td0.classList.add('new_hs');
        u_td0.innerText = ue.prev_use == 0 ? "NEW" : "";
        const u_td1 = document.createElement("td");
        u_td1.innerText = ue.name;
        const u_td2 = document.createElement("td");
        u_td2.innerText = `${ue.count}/${ue.prev_use}`;
        const u_td3 = document.createElement("td");
        u_td3.id = `u${i}`;
        u_td3.innerText = ue.hs;
        const u_td4 = document.createElement("td");
        const u_td4_edit = document.createElement("button");
        u_td4_edit.innerText = "Edit";
        u_td4_edit.classList.add('btn');
        u_td4_edit.classList.add(ue.prev_use == 0 ? "btn-danger" : "btn-success");
        u_td4_edit.classList.add('lg-edit-button');
        u_td4_edit.dataset.value = ue.name;
        u_td4_edit.addEventListener('click', e => { Edit(ue.name, null); });
        u_td4.appendChild(u_td4_edit);
        
        u_tdrow.appendChild(u_td0);
        u_tdrow.appendChild(u_td1);
        u_tdrow.appendChild(u_td2);
        u_tdrow.appendChild(u_td3);
        u_tdrow.appendChild(u_td4);
        u_tbody.appendChild(u_tdrow);
        u_table.appendChild(u_tbody);
      }
    });
    display.appendChild(u_table);

    // Add an generate CSV file below unique entries
    // button.btn.btn-primary(onclick="Generate()") Generate CSV
    const generate_csv = document.createElement("button");
    generate_csv.innerText = "Generate CSV";
    generate_csv.classList.add('btn');
    generate_csv.classList.add('btn-primary');
    generate_csv.addEventListener('click', Generate);
    display.appendChild(generate_csv);

    // Orders sections
    const o_title = document.createElement("h1");
    o_title.innerText = "Orders"
    display.appendChild(o_title);
    const o_description = document.createElement("p");
    o_description.innerText = "*Update single entries below. (only the modified row will be changed)"
    display.appendChild(o_description);
    orders.forEach(order => {
      let has_new = false;

      const card = document.createElement('div');
      card.classList.add("card");
      card.classList.add("card-done");// card-new / card-done
      const card_title = document.createElement('h3');
      card_title.innerText = order.order;
      card.appendChild(card_title);

      // Content table
      const o_table = document.createElement("table");
      o_table.classList.add("table")
      o_table.classList.add("table-dark")
      o_table.classList.add("table-striped")
      const o_thead = document.createElement("thead");
      const o_throw = document.createElement("tr");
      const o_th0 = document.createElement("th");
      const o_th1 = document.createElement("th");
      o_th1.innerText = 'Invoice';
      const o_th2 = document.createElement("th");
      o_th2.innerText = 'Count / Previous';
      const o_th3 = document.createElement("th");
      o_th3.innerText = 'HS code';
      const o_th4 = document.createElement("th");
      o_th0.style.width = "10%";
      o_th1.style.width = "50%";
      o_th2.style.width = "10%";
      o_th3.style.width = "20%";
      o_th4.style.width = "10%";
      o_throw.appendChild(o_th0);
      o_throw.appendChild(o_th1);
      o_throw.appendChild(o_th2);
      o_throw.appendChild(o_th3);
      o_throw.appendChild(o_th4);
      o_thead.appendChild(o_throw);
      o_table.appendChild(o_thead);
      const o_tbody = document.createElement("tbody");
      order.data.forEach((oe, i) => {
        if (oe.prev_use == 0) has_new = true;
        const o_tdrow = document.createElement("tr");
        const o_td0 = document.createElement("td");
        o_td0.classList.add('new_hs');
        o_td0.innerText = oe.prev_use == 0 ? "NEW" : "";
        const o_td1 = document.createElement("td");
        o_td1.innerText = oe.name;
        const o_td2 = document.createElement("td");
        o_td2.innerText = `${oe.count}/${oe.prev_use}`;
        const o_td3 = document.createElement("td");
        o_td3.id = `${order.order}_${i}`;
        o_td3.innerText = oe.hs;
        const o_td4 = document.createElement("td");
        const o_td4_edit = document.createElement("button");
        o_td4_edit.id = `${order.order}_${i}_btn`;
        o_td4_edit.innerText = "Edit";
        o_td4_edit.classList.add('btn');
        o_td4_edit.classList.add(oe.prev_use == 0 ? "btn-danger" : "btn-success");
        o_td4_edit.classList.add('lg-edit-button');
        o_td4_edit.dataset.value = oe.name;
        o_td4_edit.addEventListener('click', e => { Edit(oe.name, `${order.order}_${i}`); });
        o_td4.appendChild(o_td4_edit);

        o_tdrow.appendChild(o_td0);
        o_tdrow.appendChild(o_td1);
        o_tdrow.appendChild(o_td2);
        o_tdrow.appendChild(o_td3);
        o_tdrow.appendChild(o_td4);
        o_tbody.appendChild(o_tdrow);
        o_table.appendChild(o_tbody);
      });
      if (has_new) {
        card.classList.remove("card-done");// card-new / card-done
        card.classList.add("card-new");// card-new / card-done
      }
      card.appendChild(o_table);

      display.appendChild(card);
    });
  });

  // At page load, if a file is already selected, read it.
  if (file.dom.files[0]) {
    reader.readAsBinaryString(file.dom.files[0]);
  }

  // If not, read the file once the user selects it.
  file.dom.addEventListener('change', function () {
    if (reader.readyState === FileReader.LOADING) {
      reader.abort();
    }
    reader.readAsBinaryString(file.dom.files[0]);
  });
});

let row_delimiter = '\n';
const csvToJson = (string) => {
  if (string.indexOf('\r\n')) {
    row_delimiter = '\r\n';
  }
  const output = [];
  const rows = string.split(row_delimiter);
  rows.forEach(row => {
    if (row.length > 0) {
      output.push(row.split(','));
    }
  });
  return output;
}

// Generate output, also send data to server so that suggestions can be saved for next time
function Generate() {
  // Update to work with new input form
  // Aquire data from HS editor
  // Update input file "data" with HS editor data
  const output_array = [];
  const previous_array = [];
  let missing_count = 0;
  data.forEach((row, index) => {
    let cnt = 0;
    for (let i = 25; i < row.length-1; i+=6) {
      // id="${row[0]}_${cnt}"
      let hscode = document.getElementById(`${row[0]}_${cnt}`).innerText;
      cnt++;
      if (hscode == '---') {
        missing_count++;
      }
      data[index][i+4] = hscode;
      previous_array.push({ name: row[i], code: hscode })
    }
    output_array.push(data[index].join(','));
  });

  // Make sure that data is complete before proceding
  if (missing_count > 0) {
    alert(`An order is missing one or more HS codes, fix the issue and try again.`);
    return;
  }

  // Generate output data
  output_array.push('');// Add an empty row at end
  const output_data = output_array.join(row_delimiter);

  // Send used data to server for saving in recommended object
  fetch('/hs/previous', {
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json'
        },
        method: "POST",
        body: JSON.stringify(previous_array)
      })
      .then((response) => {
        return response.json();
      })
      .then((myJson) => {
        console.log(myJson);
      });

  // Create output/download file
  saveDynamicDataToFile(output_data);
}

function saveDynamicDataToFile(data) {
  var blob = new Blob([data], { type: 'text/csv;charset=utf-8' });
  saveAs(blob, document.getElementById('inputfile').files[0].name);
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
  if (current_id) {
    current_hs = document.getElementById(current_id).innerText;
  }

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
    if (current_id) {
      document.getElementById(current_id).innerText = HSCODE;
      document.getElementById(current_id+'_btn').classList.remove('btn-danger');
      document.getElementById(current_id+'_btn').classList.add('btn-success');
    } else {
      document.getElementById(`u${unique_entries.indexOf(current_name)}`).innerText = HSCODE;
      orders.forEach(order => {
        order.data.forEach((entry, i) => {
          if (entry.name == current_name) {
            document.getElementById(`${order.order}_${i}`).innerText = HSCODE;
          }
        });
      });
      const buttons = document.getElementsByClassName('lg-edit-button');
      for (let i = 0; i < buttons.length; i++) {
        if (buttons[i].dataset.value == current_name) {
          buttons[i].classList.remove('btn-danger');
          buttons[i].classList.add('btn-success');
        }
      }
    }
  }
  document.getElementById("popup").remove();
}
