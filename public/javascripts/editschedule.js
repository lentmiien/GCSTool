let popup;
let g_date_str;
let g_staff;
let g_year, g_month, g_date;

function ClickOnDate(year, month, date, status, staff_id) {
  // Display a popup with a select box to change that status of the day
  popup = document.createElement('div');
  popup.className = 'popup personal-schedule-popup';
  let oldStatus = '—';
  if (status) {
    try {
      oldStatus = GetData('_' + status + '_');
    } catch (_error) {
      // Keep unknown or legacy values from preventing the editor from opening.
    }
  }
  popup.innerHTML = `
  <div class="popup-center">
  <h3>Set schedule for ${year}-${month}-${date}</h3>
  <p>Old status: ${oldStatus}</p>
  <select id="popup_status" class="form-control" onchange="ChangeStatus()">
    <option value=''></option>
    <option value='work' lg_language='_work_'>${GetData('_work_')}</option>
    <option value='telwork' lg_language='_telwork_'>${GetData('_telwork_')}</option>
    <option value='2hoff_m' lg_language='_2off_6work_'>${GetData('_2off_6work_')}</option>
    <option value='2hoff_e' lg_language='_6work_2off_'>${GetData('_6work_2off_')}</option>
    <option value='halfoff_m' lg_language='_4off_4work_'>${GetData('_4off_4work_')}</option>
    <option value='halfoff_e' lg_language='_4work_4off_'>${GetData('_4work_4off_')}</option>
    <option value='off' lg_language='_day_off_'>${GetData('_day_off_')}</option>
    <option value='holiday' lg_language='_holiday_'>${GetData('_holiday_')}</option>
    <option value='vacation' lg_language='_vacation_'>${GetData('_vacation_')}</option>
  </select><br>
  <button class="btn btn-primary" onclick="Cancel()" lg_language='_cancel_'>${GetData('_cancel_')}</button>
  </div>
  `;
  document.body.appendChild(popup);

  g_date_str = `${year}-${month > 9 ? month : '0' + month}-${date > 9 ? date : '0' + date}`;
  g_staff = staff_id;
  g_year = year;
  g_month = month;
  g_date = date;
}

function ClickOnScheduleDay(day) {
  ClickOnDate(
    Number(day.dataset.year),
    Number(day.dataset.month),
    Number(day.dataset.date),
    day.dataset.status,
    Number(day.dataset.staff)
  );
}

function HandleScheduleDayKeydown(event) {
  if (event.key === 'Enter' || event.key === ' ') {
    event.preventDefault();
    event.currentTarget.click();
  }
}

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
    res.json().then((json) => {
      if (json.status !== 0) {
        // 3. Update schedule when receiving a response
        const day = document.getElementById(`day_${g_year}_${g_month}_${g_date}`);
        if (day) {
          day.dataset.status = json.status;
        }
      }
    });
    // 4. Hide popup
    document.body.removeChild(popup);
  });
}

function Cancel() {
  // Hide popup
  document.body.removeChild(popup);
}
