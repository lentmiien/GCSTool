const SurfaceParcel_label_id = 25; // Surface Parcel in AmiAmi DB (won't work at home)
const MAX_TRACKING_ID_LENGTH = 64;
const TRACKING_ID_PATTERN = /^[A-Za-z0-9_-]+$/;

function normalizeTrackingId(value) {
  if (typeof value !== 'string') {
    return '';
  }

  const trackingId = value.trim();
  if (
    trackingId.length === 0
    || trackingId.length > MAX_TRACKING_ID_LENGTH
    || !TRACKING_ID_PATTERN.test(trackingId)
  ) {
    return '';
  }
  return trackingId;
}

function writeStoredTrackingNumbers(values) {
  try {
    localStorage.setItem('tracking', JSON.stringify(values));
    return true;
  } catch (error) {
    console.error('Unable to save tracking numbers:', error);
    return false;
  }
}

function readStoredTrackingNumbers() {
  let storedValue;
  try {
    storedValue = localStorage.getItem('tracking');
  } catch (error) {
    console.error('Unable to read tracking numbers:', error);
    return [];
  }

  if (storedValue === null) {
    return [];
  }

  let parsed;
  let shouldRewrite = false;
  try {
    parsed = JSON.parse(storedValue);
  } catch (error) {
    parsed = [];
    shouldRewrite = true;
  }

  if (!Array.isArray(parsed)) {
    parsed = [];
    shouldRewrite = true;
  }

  const seen = new Set();
  const validTrackingNumbers = [];
  parsed.forEach((value) => {
    const trackingId = normalizeTrackingId(value);
    if (!trackingId || seen.has(trackingId)) {
      shouldRewrite = true;
      return;
    }
    if (trackingId !== value) {
      shouldRewrite = true;
    }
    seen.add(trackingId);
    validTrackingNumbers.push(trackingId);
  });

  if (shouldRewrite) {
    writeStoredTrackingNumbers(validTrackingNumbers);
  }
  return validTrackingNumbers;
}

function syncTrackingNumbers(values) {
  tracking_numbers.length = 0;
  values.forEach((trackingId) => tracking_numbers.push(trackingId));
}

// Get data from server
const tracking_numbers = readStoredTrackingNumbers();
if (tracking_numbers.length > 0) {
  tracking_numbers.forEach((trackingId) => AddRow(trackingId));
  getDataFromServer();
}
let data = {
  last_checked: '---',
  status: '---',
  list: [],
  list_lookup: [],
};
async function getDataFromServer() {
  const d = new Date();
  const response = await fetch('/tracker/getdata', {
    method: 'POST',
    headers: {
      'Accept': 'application/json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ local_date: `${d.getFullYear()}-${d.getMonth()+1}-${d.getDate()}`, tracking_numbers }),
  });
  data = await response.json();
  UpdateTable();
}

function Add() {
  const input = document.getElementById('trackingnumber');
  if (!input) {
    return;
  }
  const new_tracking = normalizeTrackingId(input.value);
  const current_localstorage = readStoredTrackingNumbers();

  // Check input and add if new
  if (new_tracking && current_localstorage.indexOf(new_tracking) === -1) {
    current_localstorage.push(new_tracking);
    if (writeStoredTrackingNumbers(current_localstorage)) {
      syncTrackingNumbers(current_localstorage);
      // Add row to table
      AddRow(new_tracking);
    }
  }

  input.value = '';
}

function AddRow(t) {
  const trackingId = normalizeTrackingId(t);
  const tableOutput = document.getElementById('table_output');
  if (!trackingId || !tableOutput || document.getElementById(trackingId)) {
    return;
  }

  const new_row = document.createElement('tr');
  new_row.id = trackingId;

  const cellValues = [
    ['tracking', trackingId],
    ['shipped', '---'],
    ['delivered', '---'],
    ['lastchecked', '---'],
    ['status', '---'],
  ];
  cellValues.forEach(([prefix, value]) => {
    const cell = document.createElement('td');
    cell.id = `${prefix}_${trackingId}`;
    cell.textContent = value;
    new_row.appendChild(cell);
  });

  const actionCell = document.createElement('td');
  actionCell.id = `action_${trackingId}`;

  const detailsButton = document.createElement('button');
  detailsButton.type = 'button';
  detailsButton.classList.add('btn', 'btn-secondary');
  detailsButton.textContent = 'Details';
  detailsButton.addEventListener('click', () => Details(trackingId));
  actionCell.appendChild(detailsButton);
  actionCell.appendChild(document.createTextNode(' '));

  const deleteButton = document.createElement('button');
  deleteButton.type = 'button';
  deleteButton.classList.add('btn', 'btn-danger');
  deleteButton.textContent = 'Delete';
  deleteButton.addEventListener('click', () => Delete(trackingId));
  actionCell.appendChild(deleteButton);
  new_row.appendChild(actionCell);

  tableOutput.appendChild(new_row);
}

function Delete(t) {
  const trackingId = normalizeTrackingId(t);
  if (!trackingId) {
    return;
  }
  const current_localstorage = readStoredTrackingNumbers();

  // Delete if existing
  const i = current_localstorage.indexOf(trackingId);
  if (i >= 0) {
    current_localstorage.splice(i, 1);
    if (writeStoredTrackingNumbers(current_localstorage)) {
      syncTrackingNumbers(current_localstorage);
      // Delete row from table
      const row = document.getElementById(trackingId);
      if (row) {
        row.remove();
      }
    }
  }
}

function appendTrackerBadge(cell, className, text) {
  cell.appendChild(document.createTextNode(' '));
  const badge = document.createElement('b');
  badge.classList.add(className);
  badge.textContent = text;
  cell.appendChild(badge);
}

function UpdateTable() {
  // last_checked: "",
  // status: "Ok",
  // list: [],
  const status = document.getElementById('status');
  const lastUpdated = document.getElementById('lastupdated');
  if (status) {
    status.textContent = data.status;
  }
  if (lastUpdated) {
    lastUpdated.textContent = data.last_checked;
  }

  const entries = data && Array.isArray(data.list) ? data.list : [];
  entries.forEach((entry) => {
    const trackingId = normalizeTrackingId(entry && entry.tracking);
    // Check if row exists
    if (trackingId && document.getElementById(trackingId)) {
      // td Tracking 
      document.getElementById(`tracking_${trackingId}`).textContent = trackingId;
      // td Shipped 
      document.getElementById(`shipped_${trackingId}`).textContent = entry.shippeddate > 1 ? (new Date(entry.shippeddate)).toDateString() : '---';
      // td Delivered 
      document.getElementById(`delivered_${trackingId}`).textContent = entry.delivereddate > 1 ? (new Date(entry.delivereddate)).toDateString() : '---';
      // td Last checked 
      const lastCheckedCell = document.getElementById(`lastchecked_${trackingId}`);
      lastCheckedCell.textContent = entry.lastchecked > 1 ? (new Date(entry.lastchecked)).toDateString() : '---';
      // Add above: [Delivered -> "Done"] or [If expired -> "Expired"]
      if (entry.delivereddate > 1) appendTrackerBadge(lastCheckedCell, 'tracker-done', 'Done');
      else if (
        (entry.carrier === 'JP' && Number(entry.grouplabel) === SurfaceParcel_label_id && entry.shippeddate < Date.now() - (1000*60*60*24*300)) ||
        (entry.carrier === 'JP' && Number(entry.grouplabel) !== SurfaceParcel_label_id && entry.shippeddate < Date.now() - (1000*60*60*24*160)) ||
        (entry.carrier === 'DHL' && entry.shippeddate < Date.now() - (1000*60*60*24*90)) ||
        (entry.carrier === 'USPS' && entry.addeddate < Date.now() - (1000*60*60*24*90))
      ) appendTrackerBadge(lastCheckedCell, 'tracker-expired', 'Expired');
      // td Status 
      document.getElementById(`status_${trackingId}`).textContent = entry.status;
    }
  });
}

function Details(t) {
  // Loop through data.list and find t == data.list[i].tracking
  // Display a fullscreen popup with all details and a close button

  const trackingId = normalizeTrackingId(t);
  if (!trackingId) {
    return;
  }
  const entries = data && Array.isArray(data.list) ? data.list : [];
  for (let i = 0; i < entries.length; i++) {
    if (normalizeTrackingId(entries[i] && entries[i].tracking) === trackingId) {
      DisplayPupup(entries[i]);
      break;
    }
  }
}

function getTrackingHistory(disp_data) {
  const carrierData = disp_data && disp_data.data;
  if (carrierData && !Array.isArray(carrierData) && Array.isArray(carrierData.shipments)) {
    const firstShipment = carrierData.shipments[0];
    return firstShipment && Array.isArray(firstShipment.events) ? firstShipment.events : [];
  }
  return Array.isArray(carrierData) ? carrierData : [];
}

function displayText(value) {
  return value === null || value === undefined ? '' : String(value);
}

function getEventLocation(entry) {
  const location = entry && entry.location;
  if (typeof location === 'string' || location instanceof String) {
    return String(location);
  }
  if (location && location.address) {
    return displayText(location.address.addressLocality);
  }
  return '';
}

function appendTableCell(row, tagName, text) {
  const cell = document.createElement(tagName);
  cell.textContent = text;
  row.appendChild(cell);
}

function DisplayPupup(disp_data) {
  const popup = document.createElement('div');
  popup.id = 'popup';
  popup.classList.add('fullscreen-popup');

  const closeButton = document.createElement('button');
  closeButton.type = 'button';
  closeButton.classList.add('btn', 'btn-warning', 'popup-close');
  closeButton.textContent = 'Close';
  closeButton.addEventListener('click', ClosePopup);
  popup.appendChild(closeButton);

  const title = document.createElement('h2');
  title.classList.add('popup-title');
  title.textContent = displayText(disp_data && disp_data.tracking);
  popup.appendChild(title);

  const popupHistory = document.createElement('div');
  popupHistory.classList.add('popup-history');
  const table = document.createElement('table');
  table.classList.add('table', 'table-dark', 'table-striped');

  const tableHead = document.createElement('thead');
  const headerRow = document.createElement('tr');
  appendTableCell(headerRow, 'th', 'Date');
  appendTableCell(headerRow, 'th', 'Status');
  appendTableCell(headerRow, 'th', 'Location');
  tableHead.appendChild(headerRow);
  table.appendChild(tableHead);

  const tableBody = document.createElement('tbody');
  getTrackingHistory(disp_data).forEach((entry) => {
    const historyRow = document.createElement('tr');
    appendTableCell(historyRow, 'td', (new Date(entry && entry.timestamp)).toDateString());
    appendTableCell(historyRow, 'td', displayText(entry && entry.description));
    appendTableCell(historyRow, 'td', getEventLocation(entry));
    tableBody.appendChild(historyRow);
  });
  table.appendChild(tableBody);
  popupHistory.appendChild(table);
  popup.appendChild(popupHistory);

  document.body.appendChild(popup);
}

function ClosePopup() {
  const popup = document.getElementById('popup');
  if (popup) {
    popup.remove();
  }
}
