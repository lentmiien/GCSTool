const body = {
  title: "",
  thread_id: 0,
  messages: [],
};

let data;
let completed = [];

// Detect input file and generate HS editor
window.addEventListener('load', function () {
  // These variables are used to store the input data
  const file = {
    dom: document.getElementById('csv'),
    binary: null,
  };

  // Use the FileReader API to access file content
  const reader = new FileReader();

  // Because FileReader is asynchronous, store its
  // result when it finishes to read the file
  reader.addEventListener('load', async function () {
    file.binary = reader.result;

    // Convert input data (csv) to JSON data
    // const filedata = new Uint8Array(file.binary);
    // const decoder = new TextDecoder('utf-16le');
    // const text = decoder.decode(filedata);
    // data = csvToJson(text);
    data = csvToJson(file.binary.toString());
    console.log(data);

    // TODO Display "#input_output" section, with first 5 rows of data
    const input_output = document.getElementById("input_output");
    input_output.innerHTML = "";

    // Table header
    const table = document.createElement("table");
    table.classList.add("table", "table-striped");
    const thead = document.createElement("thead");
    const tr = document.createElement("tr");
    ["id", "long_name"].forEach(d => {
      const th = document.createElement("th");
      th.innerText = d;
      tr.append(th);
    });
    const th = document.createElement("th");
    tr.append(th);
    thead.append(tr);
    table.append(thead);
    input_output.append(table);

    // Table input/output select
    const tbody = document.createElement("tbody");
    const tr_io = document.createElement("tr");
    ["id", "long_name"].forEach((d, i) => {
      const td = document.createElement("td");
      const check = document.createElement("input");
      check.type = "checkbox";
      check.name = "input";
      check.dataset.index = i;
      check.dataset.label = d;
      const check_span = document.createElement("span");
      check_span.innerText = "Input, ";
      const radio = document.createElement("input");
      radio.type = "radio";
      radio.name = "output";
      radio.dataset.index = i;
      radio.dataset.label = d;
      const radio_span = document.createElement("span");
      radio_span.innerText = "Output";
      td.append(check, check_span, radio, radio_span);
      tr_io.append(td);
    });
    const td = document.createElement("td");
    const radio = document.createElement("input");
    radio.type = "radio";
    radio.name = "output";
    radio.dataset.index = data[0].length;
    radio.dataset.label = "New";
    const radio_span = document.createElement("span");
    radio_span.innerText = "Output";
    td.append(radio, radio_span);
    tr_io.append(td);
    tbody.append(tr_io);
    table.append(tbody);

    // 5 rows of data (show as sample)
    for (let i = 0; i < 5 && i < data.length ; i++) {
      const tr_data = document.createElement("tr");
      data[i].forEach(d => {
        const td_cell = document.createElement("td");
        td_cell.innerText = d;
        tr_data.append(td_cell);
      });
      const td_cell = document.createElement("td");
      tr_data.append(td_cell);
      tbody.append(tr_data);
    }
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

const csvToJson = (string) => {
  let row_delimiter = '\n';
  if (string.indexOf('\r\n')) {
    row_delimiter = '\r\n';
  }
  const output = [];
  const rows = string.split(row_delimiter);
  rows.forEach(row => {
    if (row.length > 0) {
      const cols = row.split('","'); 
      const data = [];
      // SHOPCODE
      data.push(cols[0].substring(1)); // Remove " at start of string
      // ITEM NAME
      data.push((cols[1].substring(0, cols[1].length-1)).split('""').join('"')); // Remove " at end of string and replace "" with "
      output.push(data);
    }
  });
  return output;
};

async function Process() {
  // Get input
  const inputs = document.getElementsByName("input");
  const outputs = document.getElementsByName("output");
  const method = document.getElementById("method").value;
  const length = document.getElementById("length").value;
  let messages = [];
  const title = document.getElementById("title").value;
  let thread_id = 0;

  // Generate prompt message
  if (method === "shorten_names") {
    messages.push({ role: 'system', content: `You are tasked with condensing lengthy product names into succinct, descriptive titles, ${length-20}-${length} characters long. Users will present you with item details in a JSON array, each object containing an "id" and a "long_name" attribute. Your goal is to create a short yet informative representation of each item's name, emphasizing key elements like brand, model, special features, or unique identifiers while discarding less crucial information. Ensure the "id" from the original item is preserved in your response to maintain a clear link between the input and output. The output should be structured in a JSON array, with each object holding two attributes: "id" mirroring the original and "short_name" for your condensed version of the product name.` });
  }
  if (method === "check_translations") {
    alert("Not yet implemented");
  }

  // Output element
  const out = document.getElementById("output_div");
  out.innerHTML = "";
  const out_table = document.createElement("table");
  out_table.classList.add("table", "table-striped");
  const out_thead = document.createElement("thead");
  const out_tbody = document.createElement("tbody");
  const out_tr = document.createElement("tr");
  const out_th1 = document.createElement("th");
  out_th1.innerText = "SHOP CODE";
  const out_th2 = document.createElement("th");
  out_th2.innerText = "Long name";
  const out_th3 = document.createElement("th");
  out_th3.innerText = "Short name";
  out.append(out_table);
  out_table.append(out_thead, out_tbody);
  out_thead.append(out_tr);
  out_tr.append(out_th1, out_th2, out_th3);

  // Itterate over input CSV data
  // Send to server in batches
  let batch = [];
  let batch_lookup = [];
  let sort_array = [];
  for (let i = 0; i < data.length; i++) {
    sort_array.push(data[i][0]);
    if (data[i][1].length <= length) {
      completed.push({
        id: data[i][0],
        long_name: data[i][1],
        short_name: data[i][1],
      });
    } else {
      batch.push({
        id: data[i][0],
        long_name: data[i][1],
      });
      batch_lookup.push(data[i][0]);
    }

    if (batch.length === 10 || i === data.length - 1) {
      messages.push({ role: 'user', content: `\`\`\`json\n${JSON.stringify(batch, null, 2)}\n\`\`\`\n\nPlease respond in JSON format, maintaining the original "id" for each item and using "short_name" as the attribute name for the shortened item name.` });
      let response = await fetch(`/chatgpt/language_tools/send`, {
        method: 'POST', // *GET, POST, PUT, DELETE, etc.
        cache: 'no-cache', // *default, no-cache, reload, force-cache, only-if-cached
        headers: {
          'Content-Type': 'application/json'
        },
        referrerPolicy: 'no-referrer', // no-referrer, *no-referrer-when-downgrade, origin, origin-when-cross-origin, same-origin, strict-origin, strict-origin-when-cross-origin, unsafe-url
        body: JSON.stringify({title, thread_id, messages}) // body data type must match "Content-Type" header
      });
      let response_data = await response.json();
      thread_id = response_data.thread_id;
      messages.push(response_data.messages[response_data.messages.length-1]);

      // Process response
      const msg = response_data.messages[response_data.messages.length-1].content;
      // Use data inbetween '```json' and '```'
      let row_delimiter = '\n';
      if (msg.indexOf('\r\n') >= 0) row_delimiter = '\r\n';
      const msg_rows = msg.split(row_delimiter);
      const JSON_rows = [];
      let use_row = false;
      for (let x = 0; x < msg_rows.length; x++) {
        if (msg_rows[x].indexOf('```') >= 0) {
          use_row = !use_row;
        } else if (use_row) {
          JSON_rows.push(msg_rows[x]);
        }
      }
      const JSON_raw = JSON_rows.join('\n');
      const JSON_data = JSON.parse(JSON_raw);

      JSON_data.forEach(d => {
        const index = batch_lookup.indexOf(d.id);
        if (index >= 0) {
          batch[index]["short_name"] = d.short_name;
        }
      });

      batch.forEach(entry => {
        completed.push(entry);
        const entry_tr = document.createElement("tr");
        const entry_td1 = document.createElement("td");
        entry_td1.innerText = entry.id;
        const entry_td2 = document.createElement("td");
        entry_td2.innerText = entry.long_name;
        const entry_td3 = document.createElement("td");
        entry_td3.innerText = entry.short_name;
        out_tbody.append(entry_tr);
        entry_tr.append(entry_td1, entry_td2, entry_td3);
      });
      // output_div.innerHTML += `<pre>${JSON.stringify(batch, null, 2)}</pre>`;

      batch = [];
      batch_lookup = [];
    }
  }
  completed.sort((a,b) => {
    const a_i = sort_array.indexOf(a.id);
    const b_i = sort_array.indexOf(b.id);
    if (a_i < b_i) return -1;
    if (a_i > b_i) return 1;
    return 0;
  });
}

function SaveCompleted() {
  let csvdata = '';
  completed.forEach(d => {
    csvdata += `"${d.id}","${d.short_name.split('"').join('""')}","${d.long_name.split('"').join('""')}"\n`;
  });

  saveDynamicDataToFile(csvdata, "shortened_name_output.csv");
}

function saveDynamicDataToFile(data, filename) {
  var blob = new Blob([data], { type: 'text/csv;charset=utf-8' });
  saveAs(blob, filename);
}
