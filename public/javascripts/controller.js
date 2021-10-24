// Globals
let data;
let hs_lookup;
let section_lookup;

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

    // Send nessecary data to server API and receive HS code suggestions
    const request_data = []; // List of all item names
    // Populate list
    data.forEach(row => {
      for (let i = 25; i < row.length-1; i+=6) {
        if (request_data.indexOf(row[i]) == -1 && row[i]) {
          request_data.push(row[i]);
        }
      }
    });
    // Send to server ans await response
    fetch('/hs/suggestions', {
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json'
        },
        method: "POST",
        body: JSON.stringify(request_data)
      })
      .then((response) => {
        return response.json();
      })
      .then((myJson) => {
        hs_lookup = myJson.headings_lookup;
        section_lookup = myJson.sections_lookup;

        // Generate HS editor HTML code and show to user
        const hsinputdom = document.getElementById('hsinput');
        hsinputdom.innerHTML = '';// First reset (in case of previous usage)
        // Generate HS editor HTML and put in "hsinputdom"
        data.forEach(row => {
          let inputs = '';
          let cnt = 0;
          let card_status = 'card-done';
          for (let i = 25; i < row.length-1; i+=6) {
            const key = row[i];
            let first_code = ((row[i+4].length == 6) ? row[i+4] : null);
            let selected = false;
            cnt++;
            // The "thing" you are looking for
            if (myJson.suggestions[key].recommended.length == 0) {
              card_status = 'card-new';
            }
            inputs += `<hr><b class="${myJson.suggestions[key].recommended.length > 0 ? 'pill' : 'new_pill'}">${key}</b><br><br>`;
            // Select box
            // myJson.suggestions[key] has "recommended" and "close_matches", that has "code" and count numbers
            let recommended = '';
            let recommended_radio = '';
            myJson.suggestions[key].recommended.forEach(r => {
              if (!first_code) first_code = r.code;
              // TODO create "recommended_radio"
              recommended += `<option value="${r.code}"${first_code == r && !selected ? ' selected="selected"' : ''}>${r.code}: ${hs_lookup[r.code].description}</option>`;
              if (first_code == r.code && !selected) selected = true;
            });
            let close_matches = '';
            myJson.suggestions[key].close_matches.forEach(cm => {
              if (!first_code) first_code = cm.code;
              close_matches += `<option value="${cm.code}"${first_code == cm.code && !selected ? ' selected="selected"' : ''}>${cm.code}: ${hs_lookup[cm.code].description}</option>`;
              if (first_code == cm.code && !selected) selected = true;
            });
            let previous = '';
            myJson.suggestions.previous.forEach(prev => {
              if (!first_code) first_code = prev.code;
              previous += `<option value="${prev.code}"${first_code == prev.code && !selected ? ' selected="selected"' : ''}>${prev.code}(${prev.uses}): ${prev.name}</option>`;
              if (first_code == prev.code && !selected) selected = true;
            });
            let all = `<option value="freetext">- Text input -</option>`;
            let other = `<br><input id="${row[0]}_${cnt}_freetext" type="text" onkeyup="UpdateThis(this,'${row[0]}','${cnt}')">`;
            // Object.keys(hs_lookup).forEach(k => {
            //   if (k.length == 6) {
            //     if (!first_code) first_code = k;
            //     all += `<option value="${k}"${first_code == k && !selected ? ' selected="selected"' : ''}>${k}: ${hs_lookup[k].description}</option>`;
            //   }
            // });
            inputs += `${recommended_radio}<select id="${row[0]}_${cnt}" class="${row[0]}" onchange="UpdateThis(this,'${row[0]}','${cnt}')"><optgroup label="Recommended">${recommended}</optgroup><optgroup label="Closest matches">${close_matches}</optgroup><optgroup label="Previously used">${previous}</optgroup><optgroup label="All">${all}</optgroup></select>${other}<br>`;
            // Text for current selection
            inputs += `<p id="${row[0]}_${cnt}_section">${hs_lookup[first_code].section}: ${section_lookup[hs_lookup[first_code].section]}</p>`;
            inputs += `<p id="${row[0]}_${cnt}_level2">${hs_lookup[hs_lookup[first_code].parent].parent}: ${hs_lookup[hs_lookup[hs_lookup[first_code].parent].parent].description}</p>`;
            inputs += `<p id="${row[0]}_${cnt}_level4">${hs_lookup[first_code].parent}: ${hs_lookup[hs_lookup[first_code].parent].description}</p>`;
            inputs += `<p id="${row[0]}_${cnt}_level6">${first_code}: ${hs_lookup[first_code].description}</p>`;
          }
          hsinputdom.innerHTML += `<div class="card ${card_status}"><h3>${row[0]}</h3>${inputs}</div>`;
        });
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


// Edit HS codes
function UpdateRecommended(element, base_id, number) {
  /* For recommended radio buttons */
  // TODO Update value of hs select box, to match the radio button clicked
  // TODO Then basically do the same as "UpdateThis"
}
function UpdateThis(element, base_id, number) {
  let base_hs = element.value;
  if (base_hs == "freetext") {
    base_hs = document.getElementById(`${base_id}_${number}_freetext`).value;
  }

  // If select box, clear input
  if (base_hs == document.getElementById(`${base_id}_${number}`).value) {
    document.getElementById(`${base_id}_${number}_freetext`).value = '';
  }

  // If input, clear select box
  if (base_hs == document.getElementById(`${base_id}_${number}_freetext`).value) {
    document.getElementById(`${base_id}_${number}`).value = 'freetext';
  }

  if (base_hs.length == 6 && base_hs in hs_lookup) {
    //${row[0]}_${cnt}_section
    document.getElementById(`${base_id}_${number}_section`).innerHTML = `${hs_lookup[base_hs].section}: ${section_lookup[hs_lookup[base_hs].section]}`;
    //${row[0]}_${cnt}_level2
    document.getElementById(`${base_id}_${number}_level2`).innerHTML = hs_lookup[hs_lookup[base_hs].parent].parent + ': ' + hs_lookup[hs_lookup[hs_lookup[base_hs].parent].parent].description;
    //${row[0]}_${cnt}_level4
    document.getElementById(`${base_id}_${number}_level4`).innerHTML = hs_lookup[base_hs].parent + ': ' + hs_lookup[hs_lookup[base_hs].parent].description;
    //${row[0]}_${cnt}_level6
    document.getElementById(`${base_id}_${number}_level6`).innerHTML = base_hs + ': ' + hs_lookup[base_hs].description;
  } else {
    document.getElementById(`${base_id}_${number}_section`).innerHTML = `[${base_hs}] is not a valid HS code!`;
    document.getElementById(`${base_id}_${number}_level2`).innerHTML = '';
    document.getElementById(`${base_id}_${number}_level4`).innerHTML = '';
    document.getElementById(`${base_id}_${number}_level6`).innerHTML = '';
  }

  // TODO Clear recommended radio buttons
}

// Generate output, also send data to server so that suggestions can be saved for next time
function Generate() {
  // Aquire data from HS editor
  // Update input file "data" with HS editor data
  const output_array = [];
  const previous_array = [];
  data.forEach((row, index) => {
    let cnt = 0;
    for (let i = 25; i < row.length-1; i+=6) {
      cnt++;
      // id="${row[0]}_${cnt}"
      let hscode = document.getElementById(`${row[0]}_${cnt}`).value;
      if (hscode == 'freetext') {
        hscode = document.getElementById(`${row[0]}_${cnt}_freetext`).value;
      }
      data[index][i+4] = hscode;
      previous_array.push({ name: row[i], code: hscode })
    }
    output_array.push(data[index].join(','));
  });
  // Generate output data
  output_array.push('');// Add an empty row at end
  const output_data = output_array.join(row_delimiter);

  // TODO: Send used data to server for saving in recommended object
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