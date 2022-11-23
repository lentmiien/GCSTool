const d = new Date();
const d_str = `${d.getFullYear()}-${d.getMonth() > 8 ? (d.getMonth()+1) : '0' + (d.getMonth()+1)}-${d.getDate() > 9 ? d.getDate() : '0' + d.getDate()}`;
let ait_data = [];

function EnableDanger() {
  const danger_action = document.getElementsByClassName("danger_action");
  for (let i = 0; i < danger_action.length; i++) {
    danger_action[i].disabled = false;
  }
}

function AIT_CheckUpdates() {
  const indata = document.getElementById("ait_input").value;

  // Parse input
  const rows = indata.split('\n');
  const use_data = [];
  rows.forEach((r, i) => {
    const cells = r.split('\t');
    if (i > 0) {
      const c_str = cells[5].split('-').join('');
      const pks = isNaN(parseInt(cells[6])) ? 0 : parseInt(cells[6]);
      const pal = isNaN(parseInt(cells[7])) ? 0 : parseInt(cells[7]);
      if (c_str.length > 0) {
        use_data.push({
          container: c_str,
          packages: pks > pal ? pks : pal,
          pallets: pks > pal ? pal : pks,
          arrival_estimate: cells[10],
          arrival: cells[11],
          status: cells[12],
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
          up_date: "2020-01-01",
          value: ""
        },
        packages: {
          up_date: "2020-01-01",
          value: 0
        },
        pallets: {
          up_date: "2020-01-01",
          value: 0
        },
        arrival_estimate: {
          up_date: "2020-01-01",
          label: "",
          value: ""
        },
        arrival: {
          up_date: "2020-01-01",
          label: "",
          value: ""
        },
        status: {
          up_date: "2020-01-01",
          value: ""
        }
      });
    }
  }

  // Compare data
  const updated_i = [];
  for (let i = 0; i < ait_data.length; i++) {
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
    document.getElementById("ait_updates").innerHTML = "<h3>No changes</h3>";
  } else {
    // Display middle edit field
    let html_str = [];
    updated_i.forEach(i => {
      html_str.push(`<div><b>${ait_data[i].container.value}</b><br><span>Estimate: ${ait_data[i].arrival_estimate.label}</span><br><input type="text" class="form-control arrival_estimate" data-i="${i}" value="${ait_data[i].arrival_estimate.value}"><br><span>Arrive: ${ait_data[i].arrival.label}</span><br><input type="text" class="form-control arrival" data-i="${i}" value="${ait_data[i].arrival.value}"></div>`);
    });
    document.getElementById("ait_updates").innerHTML = html_str.join("<hr>");
  }
}

function AIT_SaveAndGenerateOutput() {
  const arrival_estimate = document.getElementsByClassName("arrival_estimate");
  const arrival = document.getElementsByClassName("arrival");

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
  for (let i = ait_data.length-1; i >= 0 && max > 0; i--) {
    max--;
    outputs.push(`<tr><td data-update="${ait_data[i].container.up_date}">${ait_data[i].container.value}</td><td data-update="${ait_data[i].packages.up_date}">${ait_data[i].packages.value}</td><td data-update="${ait_data[i].pallets.up_date}">${ait_data[i].pallets.value}</td><td data-update="${ait_data[i].arrival_estimate.up_date}">${ait_data[i].arrival_estimate.value}</td><td data-update="${ait_data[i].arrival.up_date}">${ait_data[i].arrival.value}</td><td data-update="${ait_data[i].status.up_date}">${ait_data[i].status.value}</td></tr>`);
  }
  document.getElementById("ait_output").value = `<table class="table table-dark table-striped"><thead><tr><th>Container</th><th>Packages</th><th>Pallets</th><th>Estimared arrival</th><th>Confirmed arrived</th><th>Status</th></tr></thead><tbody>${outputs.join('')}</tbody></table>`;

  console.log(ait_data);
}

function AIT_GetSavedData() {
  if (localStorage.hasOwnProperty('ait_data') == true) {
    document.getElementById("ait_input").value = localStorage.getItem('ait_data');
  }
}
function AIT_SaveToLocalstorage() {
  localStorage.setItem('ait_data', document.getElementById("ait_input").value);
}
function AIT_ClearLocalstorage() {
  localStorage.setItem('ait_data', "[]");
}