const labels = JSON.parse(document.getElementById("labels").innerHTML);
const data = JSON.parse(document.getElementById("data").innerHTML);
const table_date = document.getElementById("table_date");
const controls = document.getElementById("controls");
const output = document.getElementById("output");

function GenerateTables() {
  // Clear previous
  controls.innerHTML = "";
  output.innerHTML = "";
  
  const date = new Date(table_date.value);
  const methods = [];
  data.forEach(d => {
    if (methods.indexOf(d.method) == -1) methods.push(d.method);
  });

  methods.forEach((m, i) => {
    // Controls
    const b = document.createElement('button');
    b.innerText = m;
    b.classList.add("btn", "btn-primary", "mr-3", "mb-1");
    b.addEventListener("click", () => { ShowTable(`${m}`) });

    controls.append(b);

    // Output (table)
    const div = document.createElement('div');
    div.classList.add("rate_table");
    div.dataset.method = m;
    if (i == 0) {
      div.style.display = "block";
    } else {
      div.style.display = "none";
    }
    const h = document.createElement('h3');
    h.innerText = m;
    const t = document.createElement('table');
    t.classList.add("table", "table-dark", "table-striped");
    // Fillout table
    const zones = []
    const weights = []
    const this_data = data.filter(x => x.method == m);
    this_data.forEach(td => {
      if (zones.indexOf(td.zone) == -1) zones.push(td.zone);
      if (weights.indexOf(td.uptoweight_g) == -1) weights.push(td.uptoweight_g);
    });
    let zone_labels = null;
    if (zones.length == 4) zone_labels = "_4zones";
    if (zones.length == 5) zone_labels = "_5zones";
    if (zones.length == 7) zone_labels = "_dhlzones";
    if (zones.length == 1) zone_labels = "_usaonly";
    zones.sort((a, b) => {
      if (a < b) return -1;
      if (a > b) return 1;
      return 0;
    });
    weights.sort((a, b) => {
      if (a < b) return -1;
      if (a > b) return 1;
      return 0;
    });
    const values = [];
    zones.forEach((a, b) => {
      values.push([]);
      weights.forEach((c, d) => {
        values[b].push({cost:0,date:0})
      })
    });
    const cut = date.getFullYear()*10000 + (date.getMonth()+1)*100 + date.getDate();
    this_data.forEach(td => {
      const z = zones.indexOf(td.zone);
      const w = weights.indexOf(td.uptoweight_g);
      if (values[z][w].date < td.costdate && td.costdate <= cut) {
        values[z][w].date = td.costdate;
        values[z][w].cost = td.cost;
      }
    });
    // thead
    const thead = document.createElement("thead");
    const th_row = document.createElement("tr");
    thead.append(th_row);
    const th_th = document.createElement("th");
    th_row.append(th_th);
    th_th.innerText = "Weight";
    zones.forEach((z, g) => {
      const th_th_z = document.createElement("th");
      th_row.append(th_th_z);
      th_th_z.innerText = labels[zone_labels][g];
    });
    t.append(thead);
    // tbody
    const tbody = document.createElement("thead");
    weights.forEach((w, a) => {
      const tb_row = document.createElement("tr");
      tbody.append(tb_row);
      const tb_th = document.createElement("th");
      tb_row.append(tb_th);
      tb_th.innerText = `Up to ${w}g`;
      zones.forEach((z, b) => {
        const tb_td = document.createElement("td");
        tb_row.append(tb_td);
        tb_td.innerText = values[b][a].cost;
      });
    });
    t.append(tbody);
    div.append(h, t);
    output.append(div);
  });
}
GenerateTables();

function ShowTable(method) {
  const tables = document.getElementsByClassName("rate_table");
  for (let i = 0; i < tables.length; i++) {
    if (tables[i].dataset.method == method) {
      tables[i].style.display = "block";
    } else {
      tables[i].style.display = "none";
    }
  }
}