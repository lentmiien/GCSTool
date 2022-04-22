// Get data from server
const tracking_numbers = localStorage.getItem("tracking") ? JSON.parse(localStorage.getItem("tracking")) : [];
if (tracking_numbers.length > 0) {
  tracking_numbers.forEach(t => AddRow(t));
  getDataFromServer();
}
let data = {
  last_checked: "---",
  status: "---",
  list: [],
  list_lookup: []
};
async function getDataFromServer() {
  const d = new Date();
  let response = await fetch("/tracker/getdata", {
    method: "POST",
    headers: {
      'Accept': 'application/json',
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ local_date: `${d.getFullYear()}-${d.getMonth()+1}-${d.getDate()}`, tracking_numbers })
  });
  data = await response.json();
  UpdateTable();
}

function Add() {
  const new_tracking = document.getElementById("trackingnumber").value;
  const current_localstorage = localStorage.getItem("tracking") ? JSON.parse(localStorage.getItem("tracking")) : [];

  // Check input and add if new
  if (current_localstorage.indexOf(new_tracking) == -1) {
    current_localstorage.push(new_tracking);
    localStorage.setItem("tracking", JSON.stringify(current_localstorage));

    // Add row to table
    AddRow(new_tracking)
  }

  document.getElementById("trackingnumber").value = "";
}

function AddRow(t) {
  const new_row = document.createElement('tr');
  new_row.id = t;
  new_row.innerHTML = `
  <td id="tracking_${t}">${t}</td>
  <td id="shipped_${t}">---</td>
  <td id="delivered_${t}">---</td>
  <td id="lastchecked_${t}">---</td>
  <td id="status_${t}">---</td>
  <td id="action_${t}">
    <button class="btn btn-secondary" onclick="Details('${t}')">Details</button>
    <button class="btn btn-danger" onclick="Delete('${t}')">Delete</button>
  </td>
  `;
  document.getElementById("table_output").appendChild(new_row);
}

function Delete(t) {
  const current_localstorage = localStorage.getItem("tracking") ? JSON.parse(localStorage.getItem("tracking")) : [];

  // Delete if existing
  const i = current_localstorage.indexOf(t);
  if (i >= 0) {
    current_localstorage.splice(i, 1);
    localStorage.setItem("tracking", JSON.stringify(current_localstorage));

    // Delete row from table
    document.getElementById(t).remove();
  }
}

function UpdateTable() {
  // last_checked: "",
  // status: "Ok",
  // list: [],
  document.getElementById("status").innerText = data.status;
  document.getElementById("lastupdated").innerText = data.last_checked;
  data.list.forEach(entry => {
    // Check if row exists
    if (document.getElementById(entry.tracking)) {
      // td Tracking 
      document.getElementById(`tracking_${entry.tracking}`).innerText = entry.tracking;
      // td Shipped 
      document.getElementById(`shipped_${entry.tracking}`).innerText = entry.shippeddate > 1 ? (new Date(entry.shippeddate)).toDateString() : '---';
      // td Delivered 
      document.getElementById(`delivered_${entry.tracking}`).innerText = entry.delivereddate > 1 ? (new Date(entry.delivereddate)).toDateString() : '---';
      // td Last checked 
      document.getElementById(`lastchecked_${entry.tracking}`).innerText = entry.lastchecked > 1 ? (new Date(entry.lastchecked)).toDateString() : '---';
      // Add above: [Delivered -> "Done"] or [If expired -> "Expired"]
      if (entry.delivereddate > 1) document.getElementById(`lastchecked_${entry.tracking}`).innerHTML += ' <b class="tracker-done">Done</b>';
      else if (
        (entry.carrier == "JP" && entry.shippeddate < Date.now() - (1000*60*60*24*160)) ||
        (entry.carrier == "DHL" && entry.shippeddate < Date.now() - (1000*60*60*24*90)) ||
        (entry.carrier == "USPS" && entry.addeddate < Date.now() - (1000*60*60*24*90))) document.getElementById(`lastchecked_${entry.tracking}`).innerHTML += ' <b class="tracker-expired">Expired</b>';
      // td Status 
      document.getElementById(`status_${entry.tracking}`).innerText = entry.status;
    }
  });
}

function Details(t) {
  // Loop through data.list and find t == data.list[i].tracking
  // Display a fullscreen popup with all details and a close button

  for (let i = 0; i < data.list.length; i++) {
    if (data.list[i].tracking == t) {
      DisplayPupup(data.list[i]);
      break;
    }
  }
}

function DisplayPupup(disp_data) {
  const popup = document.createElement("div");
  popup.id = "popup";
  popup.classList.add("fullscreen-popup");

  let hist_table = '';
  const tracking_history = ("shipments" in disp_data.data) ? disp_data.data.shipments[0].events : disp_data.data;
  tracking_history.forEach(entry => {
    hist_table += `
    <tr>
      <td>${(new Date(entry.timestamp)).toDateString()}</td>
      <td>${entry.description}</td>
      <td>${(typeof entry.location === 'string' || entry.location instanceof String) ? entry.location : entry.location.address.addressLocality}</td>
    </tr>
    `;
  });

  popup.innerHTML = `
  <button class="btn btn-warning popup-close" onclick="ClosePopup()">Close</button>
  <h2 class="popup-title">${disp_data.tracking}</h2>
  <div class="popup-history">
    <table class="table table-dark table-striped">
      <thead>
        <tr>
          <th>Date</th>
          <th>Status</th>
          <th>Location</th>
        </tr>
      </thead>
      <tbody>${hist_table}</tbody>
    </table>
  </div>
  `;

  document.body.appendChild(popup);
}

function ClosePopup() {
  document.getElementById("popup").remove();
}
