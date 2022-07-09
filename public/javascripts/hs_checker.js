const sections_lookup = JSON.parse(document.getElementById('sections_lookup').innerHTML);
const headings_lookup = JSON.parse(document.getElementById('headings_lookup').innerHTML);
const entries = JSON.parse(document.getElementById('entries').innerHTML);
const entries_lookup = entries.map(entry => entry.name);
const display = document.getElementById("check");
const unique_entries = [];
const unique_entries_details = [];

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

    // TODO: Display view form
    // Generate list of unique entries
    data.forEach(row => {
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
      }
    });

    // Unique entries section
    const u_title = document.createElement("h1");
    u_title.innerText = GetData("_unique_entries_");
    u_title.setAttribute('lg_language','_unique_entries_');
    display.appendChild(u_title);
    const u_description = document.createElement("p");
    u_description.innerText = GetData("_hs_unique_description_");
    u_description.setAttribute('lg_language','_hs_unique_description_');
    display.appendChild(u_description);
    const u_table = document.createElement("table");
    u_table.classList.add("table")
    u_table.classList.add("table-dark")
    u_table.classList.add("table-striped")
    const u_thead = document.createElement("thead");
    const u_throw = document.createElement("tr");
    const u_th0 = document.createElement("th");
    const u_th1 = document.createElement("th");
    u_th1.innerText = GetData("_invoice_");
    u_th1.setAttribute('lg_language','_invoice_');
    const u_th2 = document.createElement("th");
    u_th2.innerText = GetData("_count_previous_");
    u_th2.setAttribute('lg_language','_count_previous_');
    const u_th3 = document.createElement("th");
    u_th3.innerText = GetData("_hs_code_");
    u_th3.setAttribute('lg_language','_hs_code_');
    const u_th4 = document.createElement("th");
    u_th4.innerText = "HS description";
    u_th0.style.width = "10%";
    u_th1.style.width = "20%";
    u_th2.style.width = "10%";
    u_th3.style.width = "10%";
    u_th4.style.width = "50%";
    u_throw.appendChild(u_th0);
    u_throw.appendChild(u_th1);
    u_throw.appendChild(u_th2);
    u_throw.appendChild(u_th3);
    u_throw.appendChild(u_th4);
    u_thead.appendChild(u_throw);
    u_table.appendChild(u_thead);
    const u_tbody = document.createElement("tbody");
    unique_entries_details.forEach((ue, i) => {
      const u_tdrow = document.createElement("tr");
      const u_td0 = document.createElement("td");
      u_td0.classList.add('new_hs');
      u_td0.innerText = ue.prev_use == ue.count ? "NEW" : "";
      const u_td1 = document.createElement("td");
      u_td1.innerText = ue.name;
      const u_td2 = document.createElement("td");
      u_td2.innerText = `${ue.count}/${ue.prev_use}`;
      const u_td3 = document.createElement("td");
      u_td3.id = `u${i}`;
      u_td3.innerText = ue.hs;
      u_td3.title = ue.hs in headings_lookup ? headings_lookup[ue.hs].description : 'Undefined';
      const u_td4 = document.createElement("td");
      u_td4.innerHTML = `${ue.hs.substring(0, 2)}: ${headings_lookup[ue.hs.substring(0, 2)].description}<br><br>${ue.hs.substring(0, 4)}: ${headings_lookup[ue.hs.substring(0, 4)].description}<br><br>${ue.hs}: ${headings_lookup[ue.hs].description}`;
      
      u_tdrow.appendChild(u_td0);
      u_tdrow.appendChild(u_td1);
      u_tdrow.appendChild(u_td2);
      u_tdrow.appendChild(u_td3);
      u_tdrow.appendChild(u_td4);
      u_tbody.appendChild(u_tdrow);
      u_table.appendChild(u_tbody);
    });
    display.appendChild(u_table);
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
