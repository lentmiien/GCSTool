const data = [];
const data_lookup = [];// Array of only tracking numbers, used when checking for duplicates

const addElement = document.getElementById("add");
const editElement = document.getElementById("edit");
const typeElement = document.getElementById("type");
const valueElement = document.getElementById("value");
const statusElement = document.getElementById("status");
const historyElement = document.getElementById("history");

// Want to select content most of the time, so make that the default behaviour
valueElement.addEventListener("click", e => {
  e.target.select();
});

/*
Example
(data)
{
  track: "EM123456789JP",
  method: "EMS",
  date: "2022-03-23",
  country: "UNITED STATES"
}
　↓
(CSV: filename "Tracking20220323-23.csv")
EM123456789JP;UNITED STATES;EMS;2022-03-23
*/

/*
status format
Total records: 123
Date interval: 2022-03-23 ~ 2022-03-24
Records missing method: 80 (EM123456999JP*one record missing method)
Records missing date: 12 (EM123456000JP*one record missing date)
Records missing country: 5 (EM123456111JP*one record missing country)
[2022-03-23] EMS:123, DHL...
[2022-03-24] EMS...
*/
function UpdateStatus() {
  const output = {
    startDate: "9999-99-99",
    endDate: "0000-00-00",
    recordsMissingMethod: 0,
    oneRecordMissingMethod: "",
    recordsMissingDate: 0,
    oneRecordMissingDate: "",
    recordsMissingCountry: 0,
    oneRecordMissingCountry: "",
    inputArray: [],
    inputArray_lookup: []
  };
  data.forEach(entry => {
    let hasMethod = true;
    let hasDate = true;
    let hasCountry = true;
    if (entry.method == "UNKNOWN") {
      hasMethod = false;
      output.recordsMissingMethod++;
      output.oneRecordMissingMethod = entry.track;
    }
    if (entry.date == "UNKNOWN") {
      hasDate = false;
      output.recordsMissingDate++;
      output.oneRecordMissingDate = entry.track;
    } else {
      if (entry.date < output.startDate) output.startDate = entry.date;
      if (entry.date > output.endDate) output.endDate = entry.date;
    }
    if (entry.country == "UNKNOWN") {
      hasCountry = false;
      output.recordsMissingCountry++;
      output.oneRecordMissingCountry = entry.track;
    }
    if (hasMethod && hasDate) {
      const index = output.inputArray_lookup.indexOf(entry.date);
      if (index == -1) {
        output.inputArray_lookup.push(entry.date);
        output.inputArray.push({
          label: entry.date,
          methods: [{
            label: entry.method,
            count: 1
          }],
          methods_lookup: [ entry.method ]
        });
      } else {
        const subindex = output.inputArray[index].methods_lookup.indexOf(entry.method);
        if (subindex == -1) {
          output.inputArray[index].methods_lookup.push(entry.method);
          output.inputArray[index].methods.push({
            label: entry.method,
            count: 1
          });
        } else {
          output.inputArray[index].methods[subindex].count++;
        }
      }
    }
  });

  let htmlstring = `Total records: <b>${data.length}</b><br>`;
  htmlstring += `Date interval: <b>${output.startDate} ~ ${output.endDate}</b><br>`;
  htmlstring += `Missing method: <b>${output.recordsMissingMethod} (${Math.floor(1000 * (1 - output.recordsMissingMethod / data.length))/10}% done)</b>${output.recordsMissingMethod > 0 ? ' <button class="btn btn-secondary" onclick="CopyRemaining(\'method\')">Copy</button>' : ''}<br>`;
  htmlstring += `Missing date: <b>${output.recordsMissingDate} (${Math.floor(1000 * (1 - output.recordsMissingDate / data.length))/10}% done)</b>${output.recordsMissingDate > 0 ? ' <button class="btn btn-secondary" onclick="CopyRemaining(\'date\')">Copy</button>' : ''}<br>`;
  htmlstring += `Missing country: <b>${output.recordsMissingCountry} (${Math.floor(1000 * (1 - output.recordsMissingCountry / data.length))/10}% done)</b>${output.recordsMissingCountry > 0 ? ' <button class="btn btn-secondary" onclick="CopyRemaining(\'country\')">Copy</button>' : ''}`;
  output.inputArray.forEach(ia => {
    let ia_str = `<br>[${ia.label}]`;
    ia.methods.forEach(iam => {
      ia_str += ` ${iam.label}:${iam.count},`;
    });
    htmlstring += ia_str;
  });
  
  // Display
  statusElement.innerHTML = htmlstring;
}

function Add() {
  // console.log("add tracking numbers to array *Never add duplicates");
  // add => data

  let nl_car = addElement.value.indexOf("\r\n") >= 0 ? "\r\n" : "\n";
  const tracking_numbers = addElement.value.split(nl_car);

  tracking_numbers.forEach(tracking => {
    if (data_lookup.indexOf(tracking) == -1) {
      data_lookup.push(tracking);
      data.push({
        track: tracking,
        method: "UNKNOWN",
        date: "UNKNOWN",
        country: "UNKNOWN"
      });
    }
  });

  // Clear input
  addElement.value = '';

  UpdateStatus();
}

function Delete() {
  // console.log("delete tracking numbers from array *Used for taio records");
  // data => add

  let nl_car = addElement.value.indexOf("\r\n") >= 0 ? "\r\n" : "\n";
  const tracking_numbers = addElement.value.split(nl_car);

  tracking_numbers.forEach(tracking => {
    const i = data_lookup.indexOf(tracking);
    if (i >= 0) {
      data_lookup.splice(i, 1);
      data.splice(i, 1);
    }
  });

  // Clear input
  addElement.value = '';

  UpdateStatus();
}

function Edit() {
  // console.log("edit tracking numbers in array *Never add new entries to array");
  // (type: value) => edit in data
  // type - method, date, country

  let nl_car = editElement.value.indexOf("\r\n") >= 0 ? "\r\n" : "\n";
  const tracking_numbers = editElement.value.split(nl_car);

  // Reformat date "2021/07/07" -> "2021-07-07"
  let value = valueElement.value;
  if (typeElement.value == 'date' && value.indexOf('/') > 0) {
    value = value.split('/').join('-');
  }

  tracking_numbers.forEach(tracking => {
    const i = data_lookup.indexOf(tracking);
    if (i >= 0) {
      data[i][typeElement.value] = value;
    }
  });

  // Clear input
  editElement.value = '';

  // Select and copy value of valueElement
  valueElement.select();
  document.execCommand('copy');

  UpdateStatus();
}

let startDate;
let endDate;
let methods;

function Upload() {
  startDate = '9999-99-99';
  endDate = '0000-00-00';
  methods = [];

  let updata = [];
  data.forEach(entry => {
    updata.push({
      t: entry.track,
      c: entry.country,
      sm: entry.method,
      sd: entry.date
    });

    if (methods.indexOf(entry.method) == -1) methods.push(entry.method);
    if (entry.date < startDate) startDate = entry.date;
    if (entry.date > endDate) endDate = entry.date;
  });

  startUploadTask(updata);
}

async function startUploadTask(updata) {
  try {
    const res = await fetch('/tracker/startTask', {
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
      method: 'POST',
      body: JSON.stringify(updata),
    });
    const taskId = res.data.taskId;

    let taskStatus = "Processing";
    while (taskStatus === "Processing") {
      const statusRes = await fetch(`/tracker/status/${taskId}`);
      taskStatus = statusRes.data.status;
      if (taskStatus === "Processing") {
        // If the task is still processing, wait 30 second before checking again.
        await new Promise(resolve => setTimeout(resolve, 30000));
      }
    }

    console.log(taskStatus);
    AddHistory(taskId, updata.length, taskStatus);
  } catch (error) {
    console.error(error);
  }
}

function CopyRemaining(key) {
  let output = '';
  data.forEach(entry => {
    if (entry[key] === "UNKNOWN") {
      output += `${entry.track}\r\n`;
    }
  });

  // Copy to clipboard
  function listener(e) {
    // e.clipboardData.setData('text/html', output);
    e.clipboardData.setData('text/plain', output);
    e.preventDefault();
  }
  document.addEventListener('copy', listener);
  document.execCommand('copy');
  document.removeEventListener('copy', listener);
}

// add functionality for updates list
let history_data = [];

// First load
if (localStorage.getItem("upload_history")) {
  history_data = JSON.parse(localStorage.getItem("upload_history"));
  history_data.forEach(h => {
    AddOneRow(h.ticket_id, h.start_date, h.end_date, h.methods, h.count, h.added_count, h.added_date);
  });
}

// update when upload is done
function AddHistory(task_id, count, response_status) {
  if (response_status.indexOf('Completed') == 0) {
    const added_count = parseInt(response_status.split(' ')[1]);
    history_data.push({
      ticket_id: task_id,
      start_date: startDate,
      end_date: endDate,
      methods: methods.join(', '),
      count,
      added_count,
      added_date: Date.now(),
    });
    localStorage.setItem("upload_history", JSON.stringify(history_data));
    AddOneRow(task_id, startDate, endDate, methods.join(', '), count, added_count, Date.now());
  }
}

function AddOneRow(ticket_id, start_date, end_date, mets, count, added_count, added_date) {
  const row = document.createElement("tr");
  const id = document.createElement("td");
  id.innerText = ticket_id;
  const start = document.createElement("td");
  start.innerText = start_date;
  const end = document.createElement("td");
  end.innerText = end_date;
  const methods = document.createElement("td");
  methods.innerText = mets;
  const count = document.createElement("td");
  count.innerText = count;
  const added_count = document.createElement("td");
  added_count.innerText = added_count;
  const added_date = document.createElement("td");
  added_date.innerText = new Date(added_date);
  row.appendChild(id);
  row.appendChild(start);
  row.appendChild(end);
  row.appendChild(methods);
  row.appendChild(count);
  row.appendChild(added_count);
  row.appendChild(added_date);

  historyElement.prepend(row);
}
