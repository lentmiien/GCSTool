let popup;
let g_date_str;
let g_staff;
let g_year, g_month, g_date;

function ClickOnDate(year, month, date, status, staff_id) {
  // Display a popup with a select box to change that status of the day
  popup = document.createElement('div');
  popup.className = 'popup';
  popup.innerHTML = `
  <div class="popup-center">
  <h3>Set schedule for ${year}-${month}-${date}</h3>
  <p>Old status: ${status}</p>
  <select id="popup_status" class="form-control" onchange="ChangeStatus()">
    <option value=''></option>
    <option value='work'>Work</option>
    <option value='telwork'>Telework</option>
    <option value='2hoff_m'>2h off in morning</option>
    <option value='2hoff_e'>2h off in evening</option>
    <option value='halfoff_m'>Morning off</option>
    <option value='halfoff_e'>Evening off</option>
    <option value='off'>Day off</option>
    <option value='holiday'>Holiday</option>
    <option value='vacation'>Vacation</option>
  </select><br>
  <button class="btn btn-primary" onclick="Cancel()">Cancel</button>
  </div>
  `;
  document.body.appendChild(popup);

  g_date_str = `${year}-${month > 9 ? month : '0' + month}-${date > 9 ? date : '0' + date}`;
  g_staff = staff_id;
  g_year = year;
  g_month = month;
  g_date = date;
}

let colormap = {
  work: 'rgb(120,255,120)',
  telwork: 'rgb(180,255,180)',
  '2hoff_m': 'rgb(255,255,120)',
  '2hoff_e': 'rgb(255,255,120)',
  halfoff_m: 'rgb(255,255,120)',
  halfoff_e: 'rgb(255,255,120)',
  off: 'rgb(120,120,255)',
  holiday: 'rgb(255,120,120)',
  vacation: 'rgb(255,120,255)',
};

function ChangeStatus() {
  // When status is changed in popup window
  // 1. Disable select box
  document.getElementById('popup_status').disabled = true;
  // 2. Do a post request to the server to update database
  console.log({ date: g_date_str, status: document.getElementById('popup_status').value, staff: g_staff });
  fetch('/scheduler/update', {
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
    },
    method: 'POST',
    body: JSON.stringify({ date: g_date_str, status: document.getElementById('popup_status').value, staff: g_staff }),
  }).then((res) => {
    // 3. Update schedule when receiving a response
    document.getElementById(`day_${g_year}_${g_month}_${g_date}`).style.fill = colormap[document.getElementById('popup_status').value];
    // 4. Hide popup
    document.body.removeChild(popup);
  });
}

function Cancel() {
  // Hide popup
  document.body.removeChild(popup);
}
