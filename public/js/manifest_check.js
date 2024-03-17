// Globals
let data; // To hold data in input file
const verify_content = document.getElementById("verify_content");

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
    verify_content.innerHTML = "";

    // TODO: parse input and populate 'verify_content' with rows that needs to be checked
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
  let output_data = '';

  // Generate csv data to 'output_data'
  const corrections = document.getElementsByClassName('corrections');
  for (let i = 0; i < corrections.length; i++) {
    const row = parseInt(corrections[i].dataset.row);
    const col = parseInt(corrections[i].dataset.col);
    data[row][col] = corrections[i].value;
  }
  data.forEach(d => {
    output_data += `${d.join(',')}\n`;
  });

  // Create output/download file
  saveDynamicDataToFile(output_data);
}

function saveDynamicDataToFile(data) {
  var blob = new Blob([data], { type: 'text/csv;charset=utf-8' });
  saveAs(blob, `${document.getElementById('container').value}_AIT_Manifest.csv`);
}
