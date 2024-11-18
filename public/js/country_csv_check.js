const content = document.getElementById("content");

// Detect input file and generate HS editor
window.addEventListener('load', function () {
  // These variables are used to store the input data
  const file = {
    dom: document.getElementById('csvdata'),
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

    let tbody = '';
    data.forEach(order => {
      if (order.length > 0) {
        const cols = order.split('"');
        if (cols.length === 3) {
          // Old format
          const sub_cols = cols[0].split(',');
          const b = cols[1].split(',');
          tbody += `<tr><td>${sub_cols[0]}</td><td>${sub_cols[1]}</td><td class="${b.indexOf('1') >= 0 ? "table-danger" : "bg-success"}">${b.indexOf('1') >= 0 ? "" : "◎"}</td><td class="${b.indexOf('2') >= 0 ? "table-danger" : "bg-success"}">${b.indexOf('2') >= 0 ? "" : "◎"}</td><td class="${b.indexOf('3') >= 0 ? "table-danger" : "bg-success"}">${b.indexOf('3') >= 0 ? "" : "◎"}</td><td class="${b.indexOf('4') >= 0 ? "table-danger" : "bg-success"}">${b.indexOf('4') >= 0 ? "" : "◎"}</td><td class="${b.indexOf('5') >= 0 ? "table-danger" : "bg-success"}">${b.indexOf('5') >= 0 ? "" : "◎"}</td><td class="${b.indexOf('6') >= 0 ? "table-danger" : "bg-success"}">${b.indexOf('6') >= 0 ? "" : "◎"}</td><td class="${b.indexOf('11') >= 0 ? "table-danger" : "bg-success"}">${b.indexOf('11') >= 0 ? "" : "◎"}</td><td class="${b.indexOf('17') >= 0 ? "table-danger" : "bg-success"}">${b.indexOf('17') >= 0 ? "" : "◎"}</td><td class="${b.indexOf('19') >= 0 ? "table-danger" : "bg-success"}">${b.indexOf('19') >= 0 ? "" : "◎"}</td><td class="${b.indexOf('20') >= 0 ? "table-danger" : "bg-success"}">${b.indexOf('20') >= 0 ? "" : "◎"}</td><td class="${b.indexOf('21') >= 0 ? "table-danger" : "bg-success"}">${b.indexOf('21') >= 0 ? "" : "◎"}</td><td class="${b.indexOf('22') >= 0 ? "table-danger" : "bg-success"}">${b.indexOf('22') >= 0 ? "" : "◎"}</td></tr>`;
        } else {
          // Current format
          const b = cols[5].split(',');
          tbody += `<tr><td>${cols[1]}</td><td>${cols[3]}</td><td class="${b.indexOf('1') >= 0 ? "table-danger" : "bg-success"}">${b.indexOf('1') >= 0 ? "" : "◎"}</td><td class="${b.indexOf('2') >= 0 ? "table-danger" : "bg-success"}">${b.indexOf('2') >= 0 ? "" : "◎"}</td><td class="${b.indexOf('3') >= 0 ? "table-danger" : "bg-success"}">${b.indexOf('3') >= 0 ? "" : "◎"}</td><td class="${b.indexOf('4') >= 0 ? "table-danger" : "bg-success"}">${b.indexOf('4') >= 0 ? "" : "◎"}</td><td class="${b.indexOf('5') >= 0 ? "table-danger" : "bg-success"}">${b.indexOf('5') >= 0 ? "" : "◎"}</td><td class="${b.indexOf('6') >= 0 ? "table-danger" : "bg-success"}">${b.indexOf('6') >= 0 ? "" : "◎"}</td><td class="${b.indexOf('11') >= 0 ? "table-danger" : "bg-success"}">${b.indexOf('11') >= 0 ? "" : "◎"}</td><td class="${b.indexOf('17') >= 0 ? "table-danger" : "bg-success"}">${b.indexOf('17') >= 0 ? "" : "◎"}</td><td class="${b.indexOf('19') >= 0 ? "table-danger" : "bg-success"}">${b.indexOf('19') >= 0 ? "" : "◎"}</td><td class="${b.indexOf('20') >= 0 ? "table-danger" : "bg-success"}">${b.indexOf('20') >= 0 ? "" : "◎"}</td><td class="${b.indexOf('21') >= 0 ? "table-danger" : "bg-success"}">${b.indexOf('21') >= 0 ? "" : "◎"}</td><td class="${b.indexOf('22') >= 0 ? "table-danger" : "bg-success"}">${b.indexOf('22') >= 0 ? "" : "◎"}</td></tr>`;
        }
      }
    });

    content.innerHTML = `<table class="table table-striped table-dark"><thead><tr><th>CODE</th><th>COUNTRY</th><th>EMS</th><th>SALSP</th><th>SALSP U</th><th>DOM</th><th>SALP</th><th>AP</th><th>ASP U</th><th>ASP</th><th>DHL</th><th>AIT</th><th>SP</th><th>ECMS</th></tr></thead><tbody>${tbody}</tbody></table>`;
  });

  // At page load, if a file is already selected, read it.
  if (file.dom.files[0]) {
    reader.readAsText(file.dom.files[0]);
  }

  // If not, read the file once the user selects it.
  file.dom.addEventListener('change', function () {
    if (reader.readyState === FileReader.LOADING) {
      reader.abort();
    }
    reader.readAsText(file.dom.files[0]);
  });
});

let row_delimiter = '\n';
const csvToJson = (string) => {
  if (string.indexOf('\r\n') >= 0) {
    row_delimiter = '\r\n';
  }
  // const output = [];
  const rows = string.split(row_delimiter);
  // rows.forEach(row => {
  //   if (row.length > 0) {
  //     output.push(row.split(','));
  //   }
  // });
  return rows;
}
