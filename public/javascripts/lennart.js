const d = new Date();
const d_str = `${d.getFullYear()}-${d.getMonth() > 8 ? d.getMonth() + 1 : '0' + (d.getMonth() + 1)}-${
  d.getDate() > 9 ? d.getDate() : '0' + d.getDate()
}`;
let ait_data = [];

async function fetchUpdateAIT(data) {
  try {
    const url = '/lennart/updateait';
    const requestOptions = {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ data: data }),
    };

    const response = await fetch(url, requestOptions);

    if (!response.ok) {
      throw new Error(`HTTP error: ${response.status}`);
    }

    const jsonResponse = await response.json();
    return jsonResponse;
  } catch (error) {
    console.error('Error during fetch:', error);
  }
}

function EnableDanger() {
  const danger_action = document.getElementsByClassName('danger_action');
  for (let i = 0; i < danger_action.length; i++) {
    danger_action[i].disabled = false;
  }
}

function AIT_CheckUpdates() {
  const indata = document.getElementById('ait_input').value;

  // Parse input
  const rows = indata.split('\n');
  const use_data = [];
  let lastdate = null;
  let container_col = 5;
  let carton_col = 6;
  let pallet_col = 7;
  let estimate_col = 10;
  let arrive_col = 11;
  let status_col = 12;
  rows.forEach((r, i) => {
    const cells = r.split('\t');
    if (i === 0) {
      cells.forEach((data, index) => {
        if (data === 'Container (VV)') container_col = index;
        if (data === 'Cartons in MFST') carton_col = index;
        if (data === 'Pallets shipped from Tokyo') pallet_col = index;
        if (data === 'ETA (VV)') estimate_col = index;
        if (data === 'Recd LAX (CO)') arrive_col = index;
        if (data === 'Status (CO)') status_col = index;
      });
    } else {
      const c_str = cells[container_col].split('-').join('');
      const pks = isNaN(parseInt(cells[carton_col])) ? 0 : parseInt(cells[carton_col]);
      const pal = isNaN(parseInt(cells[pallet_col])) ? 0 : parseInt(cells[pallet_col]);
      const date = cells[estimate_col].split(' ').join('');
      if (date.length > 0) lastdate = date;
      if (c_str.length > 0) {
        use_data.push({
          container: c_str,
          packages: pks > pal ? pks : pal,
          pallets: pks > pal ? pal : pks,
          arrival_estimate: lastdate,
          arrival: cells[arrive_col],
          status: cells[status_col],
        });
      }
    }
  });

  // Load local data
  if (localStorage.hasOwnProperty('ait_data') == true) {
    ait_data = JSON.parse(localStorage.getItem('ait_data'));
  }
  // Add new empty entries
  if (use_data.length > ait_data.length) {
    for (let i = ait_data.length; i < use_data.length; i++) {
      ait_data.push({
        added_date: d_str,
        container: {
          up_date: '2020-01-01',
          value: '',
        },
        packages: {
          up_date: '2020-01-01',
          value: 0,
        },
        pallets: {
          up_date: '2020-01-01',
          value: 0,
        },
        arrival_estimate: {
          up_date: '2020-01-01',
          label: '',
          value: '',
        },
        arrival: {
          up_date: '2020-01-01',
          label: '',
          value: '',
        },
        status: {
          up_date: '2020-01-01',
          value: '',
        },
      });
    }
  }

  // Compare data
  const updated_i = [];
  for (let i = 0; i < use_data.length; i++) {
    let updated = false;
    if (use_data[i].container != ait_data[i].container.value) {
      ait_data[i].container.up_date = d_str;
      ait_data[i].container.value = use_data[i].container;
      updated = true;
    }
    if (use_data[i].packages != ait_data[i].packages.value) {
      ait_data[i].packages.up_date = d_str;
      ait_data[i].packages.value = use_data[i].packages;
      updated = true;
    }
    if (use_data[i].pallets != ait_data[i].pallets.value) {
      ait_data[i].pallets.up_date = d_str;
      ait_data[i].pallets.value = use_data[i].pallets;
      updated = true;
    }
    if (use_data[i].arrival_estimate != ait_data[i].arrival_estimate.label) {
      ait_data[i].arrival_estimate.up_date = d_str;
      ait_data[i].arrival_estimate.label = use_data[i].arrival_estimate;
      updated = true;
    }
    if (use_data[i].arrival != ait_data[i].arrival.label) {
      ait_data[i].arrival.up_date = d_str;
      ait_data[i].arrival.label = use_data[i].arrival;
      updated = true;
    }
    if (use_data[i].status != ait_data[i].status.value) {
      ait_data[i].status.up_date = d_str;
      ait_data[i].status.value = use_data[i].status;
      updated = true;
    }
    if (updated) {
      updated_i.push(i);
    }
  }

  if (updated_i.length === 0) {
    document.getElementById('ait_updates').innerHTML = '<h3>No changes</h3>';
  } else {
    // Display middle edit field
    let html_str = [];
    updated_i.forEach((i) => {
      const e_date = SpecialDateParser(ait_data[i].arrival_estimate.label, ait_data[i].arrival_estimate.value);
      const a_date = SpecialDateParser(ait_data[i].arrival.label, ait_data[i].arrival.value);
      html_str.push(
        `<div><b>${ait_data[i].container.value}</b><br><span>Estimate: ${ait_data[i].arrival_estimate.label}</span><br><input type="text" class="form-control arrival_estimate" data-i="${i}" value="${e_date}"><br><span>Arrive: ${ait_data[i].arrival.label}</span><br><input type="text" class="form-control arrival" data-i="${i}" value="${a_date}"></div>`
      );
    });
    document.getElementById('ait_updates').innerHTML = html_str.join('<hr>');
  }
}

async function AIT_SaveAndGenerateOutput() {
  const arrival_estimate = document.getElementsByClassName('arrival_estimate');
  const arrival = document.getElementsByClassName('arrival');

  for (let j = 0; j < arrival_estimate.length; j++) {
    const i = parseInt(arrival_estimate[j].dataset.i);
    if (ait_data[i].arrival_estimate.value != arrival_estimate[j].value) {
      ait_data[i].arrival_estimate.up_date = d_str;
      ait_data[i].arrival_estimate.value = arrival_estimate[j].value;
    }
    if (ait_data[i].arrival.value != arrival[j].value) {
      ait_data[i].arrival.up_date = d_str;
      ait_data[i].arrival.value = arrival[j].value;
    }
  }

  // Save to localstorage
  localStorage.setItem('ait_data', JSON.stringify(ait_data));

  // Generate output data
  const outputs = [];
  let max = 30;
  for (let i = ait_data.length - 1; i >= 0 && max > 0; i--) {
    max--;
    outputs.push(
      `<tr><td data-update="${ait_data[i].container.up_date}">${ait_data[i].container.value}</td><td data-update="${ait_data[i].packages.up_date}">${ait_data[i].packages.value}</td><td data-update="${ait_data[i].pallets.up_date}">${ait_data[i].pallets.value}</td><td data-update="${ait_data[i].arrival_estimate.up_date}">${ait_data[i].arrival_estimate.value}</td><td data-update="${ait_data[i].arrival.up_date}">${ait_data[i].arrival.value}</td><td data-update="${ait_data[i].status.up_date}">${ait_data[i].status.value}</td></tr>`
    );
  }
  const outputdata = `<table class="table table-dark table-striped"><thead><tr><th>Container</th><th>Packages</th><th>Pallets</th><th>Estimared arrival</th><th>Confirmed/Scheduled arrived</th><th>Status</th></tr></thead><tbody>${outputs.join(
    ''
  )}</tbody></table>`;
  const resp = await fetchUpdateAIT(outputdata);
  document.getElementById('ait_output').value = resp.status;
}

function AIT_GenerateZendeskArticle() {
  const d = new Date(Date.now() - 1000 * 60 * 60 * 24 * 60);
  const cut_date_str = `${d.getFullYear()}-${d.getMonth() > 8 ? d.getMonth() + 1 : '0' + (d.getMonth() + 1)}-${
    d.getDate() > 9 ? d.getDate() : '0' + d.getDate()
  }`;
  const d_new = new Date(Date.now() - 1000 * 60 * 60 * 24 * 7);
  const new_date_str = `${d_new.getFullYear()}-${d_new.getMonth() > 8 ? d_new.getMonth() + 1 : '0' + (d_new.getMonth() + 1)}-${
    d_new.getDate() > 9 ? d_new.getDate() : '0' + d_new.getDate()
  }`;

  const outputs = [];
  for (let i = ait_data.length - 1; i >= 0; i--) {
    if (ait_data[i].container.value !== 'TBA') {
      let date_str = `${ait_data[i].arrival_estimate.value}*`;
      let date_str_update = ait_data[i].arrival_estimate.up_date;
      if (ait_data[i].arrival.value.length == 10) {
        // Change to arrival date to AIT
        // ait_data[i].arrival.value
        date_str = `${ait_data[i].arrival.value}`;
        date_str_update = ait_data[i].arrival.up_date;
      }

      // ait_data[i].status.value
      let status = 'In transit to the USA';
      let status_update = cut_date_str;
      if (ait_data[i].status.value.length > 0) {
        status = 'Received/Processing at USA warehouse';
        if (ait_data[i].status.value.toLowerCase().indexOf('completed') >= 0) {
          status = 'Tracking information Sent';
        }
        status_update = ait_data[i].status.up_date;
      }

      if (date_str > cut_date_str) {
        // Put together output row
        const index = outputs.length;
        outputs.push(
          `<tr style="background-color:${index % 2 === 1 ? '#EEEEEE' : '#FFFFFF'};"><td>${ait_data[i].container.value}</td><td${
            date_str_update > new_date_str ? ' style="font-weight:900;"' : ''
          }>${date_str}</td><td${status_update > new_date_str ? ' style="font-weight:900;"' : ''}>${status}</td></tr>`
        );
      }
    }
  }

  // Set output
  document.getElementById(
    'ait_output'
  ).value = `<table><tr style="background-color:#DDDDDD;"><th style="width:15%;">Container</th><th style="width:30%;">United States arrival date</th><th style="width:55%;">Status</th></tr>${outputs.join(
    ''
  )}</table><p>*Preliminary arrival date to port in United States, date may change and a few more days required to reach warehouse.</p><p><b>Bold entries</b> are recent updates.</p><p><i>Note: If in case the status is updated to "Tracking information Sent", and you still don't receive your tracking number within the next few days, please notify our customer support.</i></p>`;
}

function AIT_GetSavedData() {
  if (localStorage.hasOwnProperty('ait_data') == true) {
    document.getElementById('ait_input').value = localStorage.getItem('ait_data');
  }
}
function AIT_SaveToLocalstorage() {
  localStorage.setItem('ait_data', document.getElementById('ait_input').value);
}
function AIT_ClearLocalstorage() {
  localStorage.setItem('ait_data', '[]');
}

const m_lookup = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
function SpecialDateParser(label, previous) {
  // only support labels of the format: 4-Sep, 20-Sep
  // previous is always an empty string or a date of format YYYY-MM-DD *Default return value if accurate date could not be determined
  const label_parts = label.split('-');
  if (label_parts.length == 2 && (label_parts[0].length == 1 || label_parts[0].length == 2) && label_parts[1].length == 3) {
    let new_year = new Date().getFullYear();
    const new_date = parseInt(label_parts[0]);
    const new_month = m_lookup.indexOf(label_parts[1].toLowerCase()) + 1;
    const testdate1 = new Date(new_year, new_month - 1, new_date);
    const testdate2 = new Date(new_year + 1, new_month - 1, new_date);
    if (testdate1.getTime() > Date.now() - 1000 * 60 * 60 * 24 * 60 && testdate1.getTime() < Date.now() + 1000 * 60 * 60 * 24 * 120) {
      return `${new_year}-${new_month > 9 ? new_month : '0' + new_month}-${new_date > 9 ? new_date : '0' + new_date}`;
    } else if (
      testdate2.getTime() > Date.now() - 1000 * 60 * 60 * 24 * 60 &&
      testdate2.getTime() < Date.now() + 1000 * 60 * 60 * 24 * 120
    ) {
      return `${new_year + 1}-${new_month > 9 ? new_month : '0' + new_month}-${new_date > 9 ? new_date : '0' + new_date}`;
    } else {
      return previous;
    }
  } else {
    return previous;
  }
}
