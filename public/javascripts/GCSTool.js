/**********************************************
 *
 *                   GLOBALS
 *
 **********************************************/

const my_settings = {
  userid: 'NewUser',
  colormode: 'Style_dark.css',
  language: 'japanese',
  reminders: [],
  documents: {
    label: [],
    invoice: [],
    both: [],
    jplabel: [],
  },
};

function ReadStoredSettings() {
  try {
    const storedSettings = JSON.parse(localStorage.getItem('settings') || '{}');
    if (!storedSettings || typeof storedSettings !== 'object' || Array.isArray(storedSettings)) {
      return {};
    }
    return storedSettings;
  } catch (_error) {
    return {};
  }
}

function PersistSettings() {
  try {
    localStorage.setItem('settings', JSON.stringify(my_settings));
  } catch (_error) {
    // Keep the current session usable when browser storage is unavailable.
  }
}

function EscapeHTML(value) {
  return String(value === undefined || value === null ? '' : value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

const month_names = [
  'january',
  'february',
  'march',
  'april',
  'may',
  'june',
  'july',
  'august',
  'september',
  'october',
  'november',
  'december',
];

function GetColorModeName() {
  return my_settings.colormode === 'Style_dark.css' ? 'dark' : 'light';
}

function ApplyColorModeDataAttribute() {
  const mode = GetColorModeName();
  if (window.GCSTheme) {
    window.GCSTheme.apply(mode, { persist: false });
    return;
  }
  document.documentElement.setAttribute('data-color-mode', mode);
}

/**********************************************
 *
 *                SETTINGS
 *
 **********************************************/

// Run when every page has been loaded
function Loaded() {
  // Load local settings
  const my_settings_local = ReadStoredSettings();
  for (const key of Object.keys(my_settings)) {
    if (Object.prototype.hasOwnProperty.call(my_settings_local, key)) {
      my_settings[key] = my_settings_local[key];
    }
  }
  if (!my_settings.documents || typeof my_settings.documents !== 'object') {
    my_settings.documents = { label: [], invoice: [], both: [], jplabel: [] };
  }
  for (const documentType of ['label', 'invoice', 'both', 'jplabel']) {
    if (!Array.isArray(my_settings.documents[documentType])) {
      my_settings.documents[documentType] = [];
    }
  }
  if (!Array.isArray(my_settings.reminders)) {
    my_settings.reminders = [];
  }
  if (!['japanese', 'english', 'swedish'].includes(my_settings.language)) {
    my_settings.language = 'japanese';
  }

  if (window.GCSTheme) {
    const activeMode = window.GCSTheme.getPreferredMode();
    my_settings.colormode = activeMode === 'dark' ? 'Style_dark.css' : 'Style_normal.css';
  } else if (!['Style_dark.css', 'Style_normal.css'].includes(my_settings.colormode)) {
    my_settings.colormode = 'Style_dark.css';
  }

  // Set user ID
  let dom_uid = document.getElementById('user_id');
  if (dom_uid) {
    dom_uid.value = document.getElementById('u_name').innerHTML;
    if (!(dom_uid.value === 'NewUser')) {
      dom_uid.readOnly = true;
      document.getElementById('update_user_id_button').style.display = 'none';
    }
  }

  // Set interface language
  const languageSelect = document.getElementById('lg_language');
  if (languageSelect) {
    languageSelect.value = my_settings.language;
    UpdateLanguage('lg_language');
  }

  // Set color mode
  let dom_cmode = document.getElementById('cmode');
  if (dom_cmode) {
    dom_cmode.value = my_settings.colormode;
  }
  ApplyColorModeDataAttribute();
  // Update the color-mode stylesheet initialized in the page head
  let link = document.getElementById('myCss');
  if (!link) {
    link = document.createElement('link');
    link.id = 'myCss';
    link.rel = 'stylesheet';
    link.type = 'text/css';
    link.media = 'all';
    document.getElementsByTagName('head')[0].appendChild(link);
  }
  link.href = '/stylesheets/' + my_settings.colormode;

  // Process reminders
  ShowReminders();
  SetReminders();

  // If has entries, then hide all private entries from other users
  DisplayOthersPrivateEntries('none');

  // Make a search if search input field has content *can have content sent through GET parameters
  if (document.getElementById('s_box') && document.getElementById('s_box').value.length > 0) {
    Filter();
  }
}

// Show reminders
function ShowReminders() {
  // Stop if there is nowhere to display the reminders
  if (!document.getElementById('reminders')) {
    return;
  }

  // Show the reminders
  let reminder_html =
    '<thead><tr><th>' +
    GetHTMLElement('_days_') +
    '</th><th>' +
    GetHTMLElement('_time_') +
    '</th><th>' +
    GetHTMLElement('_message_') +
    '</th><th>' +
    GetHTMLElement('_action_') +
    '</th></tr></thead>';
  reminder_html += '<tbody>';
  for (let ri = 0; ri < my_settings.reminders.length; ri++) {
    reminder_html +=
      '<tr><td>' +
      EscapeHTML('days' in my_settings.reminders[ri] ? my_settings.reminders[ri].days : 'Su,M,Tu,W,Th,F,Sa') +
      '</td><td>' +
      EscapeHTML(my_settings.reminders[ri].time) +
      '</td><td>' +
      EscapeHTML(my_settings.reminders[ri].message) +
      '</td><td><button class="btn btn-outline-danger" onclick="RemoveReminder(' +
      ri +
      ')">' +
      GetHTMLElement('_delete_') +
      '</button></td></tr>';
  }
  reminder_html +=
    '<tr><td><div class="d-flex flex-row justify-content-around align-items-center"><div class="p-2"><input id="sunday_reminder" type="checkbox" title="Sunday" checked></div><div class="p-2"><input id="monday_reminder" type="checkbox" title="Monday" checked></div><div class="p-2"><input id="tuesday_reminder" type="checkbox" title="Tuesday" checked></div><div class="p-2"><input id="wednesday_reminder" type="checkbox" title="Wednesday" checked></div><div class="p-2"><input id="thursday_reminder" type="checkbox" title="Thursday" checked></div><div class="p-2"><input id="friday_reminder" type="checkbox" title="Friday" checked></div><div class="p-2"><input id="saturday_reminder" type="checkbox" title="Saturday" checked></div></div></td><td><input class="form-control mr-sm-2" id="reminder_time" type="text", placeholder="12:00"></td><td><input  class="form-control mr-sm-2" id="reminder_message" type="text" placeholder="Message"></td><td><button class="btn btn-outline-success" onclick="AddReminder()">' +
    GetHTMLElement('_addnew_') +
    '</button></td></tr>';
  reminder_html += '</tbody>';
  document.getElementById('reminders').innerHTML = reminder_html;
}

// Entry view admin controller
function AdminCheckBox() {
  if (document.getElementById('s_box')) {
    Filter();
  }
}

function DisplayOthersPrivateEntries(property) {
  const currentUserElement = document.getElementById('u_name');
  const currentUser = currentUserElement ? currentUserElement.textContent : '';
  const entries = document.getElementsByClassName('entry');
  for (let i = 0; i < entries.length; i++) {
    if (entries[i].dataset.private === 'true' && entries[i].dataset.creator !== currentUser) {
      entries[i].style.display = property;
    }
  }
}

function UpdateUserID() {
  my_settings.userid = document.getElementById('user_id').value;
  PersistSettings();
}

function UpdateColorMode() {
  const colorModeSelect = document.getElementById('cmode');
  if (!colorModeSelect || !['Style_dark.css', 'Style_normal.css'].includes(colorModeSelect.value)) {
    return;
  }
  my_settings.colormode = colorModeSelect.value;
  PersistSettings();
  if (window.GCSTheme) {
    window.GCSTheme.apply(GetColorModeName());
  } else {
    ApplyColorModeDataAttribute();
    document.getElementById('myCss').href = '/stylesheets/' + my_settings.colormode;
  }
}

function ToggleColorMode() {
  if (!window.GCSTheme) {
    return;
  }
  const mode = window.GCSTheme.toggle();
  my_settings.colormode = mode === 'dark' ? 'Style_dark.css' : 'Style_normal.css';
  PersistSettings();
}

function UpdateLanguageSettings() {
  const languageSelect = document.getElementById('lg_language');
  if (!languageSelect || !['japanese', 'english', 'swedish'].includes(languageSelect.value)) {
    return;
  }
  my_settings.language = languageSelect.value;
  PersistSettings();
  UpdateLanguage('lg_language');
}

function RemoveReminder(reminder_index) {
  my_settings.reminders.splice(reminder_index, 1);
  PersistSettings();
  ShowReminders();
}

function AddReminder() {
  //id="sunday_reminder" id="monday_reminder" id="tuesday_reminder" id="wednesday_reminder" id="thursday_reminder" id="friday_reminder" id="saturday_reminder"
  const days = [];
  if (document.getElementById("sunday_reminder").checked === true) days.push("Su");
  if (document.getElementById("monday_reminder").checked === true) days.push("M");
  if (document.getElementById("tuesday_reminder").checked === true) days.push("Tu");
  if (document.getElementById("wednesday_reminder").checked === true) days.push("W");
  if (document.getElementById("thursday_reminder").checked === true) days.push("Th");
  if (document.getElementById("friday_reminder").checked === true) days.push("F");
  if (document.getElementById("saturday_reminder").checked === true) days.push("Sa");
  my_settings.reminders.push({
    days: days.join(','),
    time: document.getElementById('reminder_time').value,
    message: document.getElementById('reminder_message').value,
  });
  SetReminderPopup(document.getElementById('reminder_time').value, document.getElementById('reminder_message').value, days.join(','));
  PersistSettings();
  ShowReminders();
}

/**********************************************
 *
 *                 INTERFACE
 *
 **********************************************/

/**********************************************
 *
 *                 KEYBOARD
 *
 **********************************************/

// Capture Ctrl+F
window.onkeydown = function (e) {
  // When enter is pressed
  if (e.keyCode == 13) {
    if (document.getElementById('filter_key')) {
      Filter();
    }
  }

  // Clear when Escape is pressed
  if (e.keyCode == 27) {
    if (document.getElementById('clear_key')) {
      Clear();
      document.getElementById('s_box').focus();
    }
  }
};

/**********************************************
 *
 *              COPY ANIMATION
 *
 **********************************************/

// Select + Copy + Show "Copy" animation
function Selector(this_element) {
  this_element.select();
  document.execCommand('copy');

  const copyOverlay = document.createElement('div');
  copyOverlay.id = 'test';
  copyOverlay.className = 'w3-animate-opacity';
  const copyLabel = document.createElement('b');
  copyLabel.textContent = 'COPY';
  copyOverlay.appendChild(copyLabel);
  this_element.parentElement.appendChild(copyOverlay);
  setTimeout(DeleteCOPY, 1000);
}
function DeleteCOPY() {
  let element = document.getElementById('test');
  if (element && element.parentElement) {
    element.parentElement.removeChild(element);
  }
}

function Copy(content) {
  const copyContent = String(content === undefined || content === null ? '' : content);
  // Put in copy buffer
  function listener(e) {
    e.clipboardData.setData('text/plain', copyContent.split('|').join('\n'));
    e.preventDefault();
  }
  document.addEventListener('copy', listener);
  document.execCommand('copy');
  document.removeEventListener('copy', listener);
}

/**********************************************
 *
 *             HELPER FUNCTIONS
 *
 **********************************************/

// Resize the text box
function auto_grow(element) {
  element.style.height = '5px';
  element.style.height = element.scrollHeight + 5 + 'px';
}

function ResizeAll() {
  const text_areas = document.getElementsByTagName('textarea');
  for (let i = 0; i < text_areas.length; i++) {
    auto_grow(text_areas[i]);
  }
}

/**********************************************
 *
 *             FILTER FUNCTIONS
 *
 **********************************************/

function UpdateFilter() {
  Filter();
}

function SetFilter(q_string, q_tag, q_template, q_manual, q_ccontact) {
  if (document.getElementById('s_box')) {
    const back = document.getElementById('back');
    const oldData = {
      search: document.getElementById('s_box').value,
      tag: document.getElementById('s_tag').value,
      template: document.getElementById('s_template').checked,
      manual: document.getElementById('s_manual').checked,
      ccontact: document.getElementById('s_ccontact').checked,
    };
    document.getElementById('s_box').value = String(q_string || '');
    document.getElementById('s_tag').value = String(q_tag || '_');
    document.getElementById('s_template').checked = q_template == 'true' ? true : false;
    document.getElementById('s_manual').checked = q_manual == 'true' ? true : false;
    document.getElementById('s_ccontact').checked = q_ccontact == 'true' ? true : false;
    Filter();
    back.dataset.filterState = JSON.stringify(oldData);
    const backButton = document.createElement('button');
    backButton.type = 'button';
    backButton.className = 'btn btn-outline-secondary btn-sm mb-3';
    backButton.textContent = 'Back to previous filter';
    backButton.addEventListener('click', SetFilterBack);
    back.replaceChildren(backButton);
  } else {
    window.location.assign(`/entry?search=${encodeURIComponent(String(q_string || ''))}`);
  }
}
function SetFilterBack() {
  const backElement = document.getElementById('back');
  if (!backElement || !backElement.dataset.filterState) {
    return;
  }
  let back;
  try {
    back = JSON.parse(backElement.dataset.filterState);
  } catch (_error) {
    return;
  }
  document.getElementById('s_box').value = back.search || '';
  document.getElementById('s_tag').value = back.tag || '_';
  document.getElementById('s_template').checked = Boolean(back.template);
  document.getElementById('s_manual').checked = Boolean(back.manual);
  document.getElementById('s_ccontact').checked = Boolean(back.ccontact);
  Filter();
}

function Clear() {
  document.getElementById('s_box').value = '';
  document.getElementById('s_tag').value = '_';
  document.getElementById('s_template').checked = true;
  document.getElementById('s_manual').checked = true;
  document.getElementById('s_ccontact').checked = true;
  Filter();
}

function Filter() {
  const back = document.getElementById('back');
  if (back) {
    back.replaceChildren();
    delete back.dataset.filterState;
  }
  const e = document.getElementsByClassName('entry');
  const s_string = document.getElementById('s_box').value.toLocaleLowerCase();
  const s_tag = document.getElementById('s_tag').value;
  const currentUserElement = document.getElementById('u_name');
  const currentUser = currentUserElement ? currentUserElement.textContent : '';
  const showOtherUsers = document.getElementById('admin') && document.getElementById('admin').checked === true;
  for (let i = 0; i < e.length; i++) {
    const isOtherPrivate = e[i].dataset.private === 'true' && e[i].dataset.creator !== currentUser;
    if (!isOtherPrivate || showOtherUsers) {
      // string1+string2+string3 => Must include all 3 strings to be true
      let query_words = [];
      if (s_string.indexOf('+') >= 0) {
        query_words = s_string.toLocaleLowerCase().split('+');
      } else {
        query_words.push(s_string.toLocaleLowerCase());
      }
      const titleButton = e[i].querySelector('.title_button');
      const contentBody = e[i].querySelector('.entry-detail');
      const button_title = titleButton ? titleButton.textContent.toLocaleLowerCase() : '';
      const content_body = contentBody ? contentBody.textContent.toLocaleLowerCase() : '';
      let found = true;
      query_words.forEach((qw) => {
        if (!(button_title.indexOf(qw) >= 0 || content_body.indexOf(qw) >= 0)) {
          found = false;
        }
      });
      const hasSelectedTag = s_tag === '_' || (titleButton && titleButton.classList.contains(s_tag));
      if (found && hasSelectedTag) {
        if (
          (e[i].className.indexOf('template') >= 0 && document.getElementById('s_template').checked == true) ||
          (e[i].className.indexOf('manual') >= 0 && document.getElementById('s_manual').checked == true) ||
          (e[i].className.indexOf('ccontact') >= 0 && document.getElementById('s_ccontact').checked == true)
        ) {
          e[i].style.display = 'block';
        } else {
          e[i].style.display = 'none';
        }
      } else {
        e[i].style.display = 'none';
      }
    } else {
      e[i].style.display = 'none';
    }
  }
}

function DisplayEntry(uid) {
  const entry = document.getElementById(uid);
  if (!entry) {
    return;
  }
  const trigger = document.querySelector(`[aria-controls="${uid}"]`);
  if (entry.style.display.indexOf('none') == 0) {
    entry.style.display = 'block';
    if (trigger) {
      trigger.setAttribute('aria-expanded', 'true');
    }

    // Scale up size of text box to fit the text
    let all_t_area = entry.getElementsByTagName('TEXTAREA');
    for (let ata = 0; ata < all_t_area.length; ata++) {
      auto_grow(all_t_area[ata]);
    }
  } else {
    entry.style.display = 'none';
    if (trigger) {
      trigger.setAttribute('aria-expanded', 'false');
    }
  }
}

/**********************************************
 *
 *              OTHER FUNCTIONS
 *
 **********************************************/

function AddDate() {
  const newDate = document.getElementById('date').value;
  const datesField = document.getElementById('dates');
  if (datesField.value.length > 0) {
    datesField.value += ';' + newDate;
  } else {
    datesField.value = newDate;
  }
}

// Return: -1 (date1 is first), 0 (same date), 1 (date 2 is first)
function CDate(date1, date2) {
  if (date1 < date2) {
    return -1;
  }
  if (date2 < date1) {
    return 1;
  }
  return 0;
}

// Add shipping label/invoice to ask for
function myGetDocument(type) {
  let input = document.getElementById('track').value;
  // Show current data if input field is empty
  if (input.length == 0) {
    PeekDocuments(10);
    return;
  }
  // If same entry already exists remove old entry
  for (let i = 0; i < my_settings.documents.both.length; i++) {
    if (input === my_settings.documents.both[i]) {
      my_settings.documents.both.splice(i, 1);
      // i--; // Would normally need to step back one step, but as each entry is unique, not necessary in this case
    }
  }
  for (let i = 0; i < my_settings.documents.label.length; i++) {
    if (input === my_settings.documents.label[i]) {
      my_settings.documents.label.splice(i, 1);
      // i--; // Would normally need to step back one step, but as each entry is unique, not necessary in this case
    }
  }
  for (let i = 0; i < my_settings.documents.invoice.length; i++) {
    if (input === my_settings.documents.invoice[i]) {
      my_settings.documents.invoice.splice(i, 1);
      // i--; // Would normally need to step back one step, but as each entry is unique, not necessary in this case
    }
  }
  for (let i = 0; i < my_settings.documents.jplabel.length; i++) {
    if (input === my_settings.documents.jplabel[i]) {
      my_settings.documents.jplabel.splice(i, 1);
      // i--; // Would normally need to step back one step, but as each entry is unique, not necessary in this case
    }
  }
  // Add data
  if (type == 0) {
    my_settings.documents.both.push(input);
  } else if (type == 1) {
    my_settings.documents.label.push(input);
  } else if (type == 2) {
    my_settings.documents.invoice.push(input);
  } else {
    my_settings.documents.jplabel.push(input);
  }
  document.getElementById('track').value = '';
  PersistSettings();
  PeekDocuments(3);
}
function ShowDocuments() {
  if (
    my_settings.documents.both.length > 0 ||
    my_settings.documents.label.length > 0 ||
    my_settings.documents.invoice.length > 0 ||
    my_settings.documents.jplabel.length > 0
  ) {
    let message = '<div class="alert alert-info alert-dismissible fade show" role="alert">お疲れ様です。<br><br>';
    if (my_settings.documents.jplabel.length > 0) {
      message += '伝票画像　＋　発送サポートシステム上での【送料】と【重量】<br>';
      while (my_settings.documents.jplabel.length > 0) {
        message += EscapeHTML(my_settings.documents.jplabel.pop()) + '<br>';
      }
      message += '<br>';
    }
    if (my_settings.documents.both.length > 0) {
      message += '伝票画像　＋　インボイス<br>';
      while (my_settings.documents.both.length > 0) {
        message += EscapeHTML(my_settings.documents.both.pop()) + '<br>';
      }
      message += '<br>';
    }
    if (my_settings.documents.label.length > 0) {
      let number_of_labels = my_settings.documents.label.length;
      message += '伝票画像<br>';
      while (my_settings.documents.label.length > 0) {
        message += EscapeHTML(my_settings.documents.label.pop()) + '<br>';
      }
      message += '<br>';
    }
    if (my_settings.documents.invoice.length > 0) {
      message += 'インボイス<br>';
      while (my_settings.documents.invoice.length > 0) {
        message += EscapeHTML(my_settings.documents.invoice.pop()) + '<br>';
      }
      message += '<br>';
    }
    message += 'よろしくお願いします。<div>';

    message +=
      '<button type="button" class="close" data-dismiss="alert" aria-label="Close"><span aria-hidden="true">&times;</span></button>';

    document.getElementById('ask_labels').innerHTML = message;

    PersistSettings();

    document.getElementById('alertsound_4').play();

    alert('Request documents!');
  }
}
function PeekDocuments(seconds) {
  if (
    my_settings.documents.both.length > 0 ||
    my_settings.documents.label.length > 0 ||
    my_settings.documents.invoice.length > 0 ||
    my_settings.documents.jplabel.length > 0
  ) {
    let message = '<div class="alert alert-info alert-dismissible fade show" role="alert">お疲れ様です。';
    message +=
      '<button type="button" class="close" data-dismiss="alert" aria-label="Close"><span aria-hidden="true">&times;</span></button>';
    message += '<br><br>';
    if (my_settings.documents.jplabel.length > 0) {
      message += '伝票画像　＋　発送サポートシステム上での【送料】と【重量】<br>';
      for (let i = 0; i < my_settings.documents.jplabel.length; i++) {
        message += EscapeHTML(my_settings.documents.jplabel[i]) + '<br>';
      }
      message += '<br>';
    }
    if (my_settings.documents.both.length > 0) {
      message += '伝票画像　＋　インボイス<br>';
      for (let i = 0; i < my_settings.documents.both.length; i++) {
        message += EscapeHTML(my_settings.documents.both[i]) + '<br>';
      }
      message += '<br>';
    }
    if (my_settings.documents.label.length > 0) {
      let number_of_labels = my_settings.documents.label.length;
      message += '伝票画像<br>';
      for (let i = 0; i < my_settings.documents.label.length; i++) {
        message += EscapeHTML(my_settings.documents.label[i]) + '<br>';
      }
      message += '<br>';
    }
    if (my_settings.documents.invoice.length > 0) {
      message += 'インボイス<br>';
      for (let i = 0; i < my_settings.documents.invoice.length; i++) {
        message += EscapeHTML(my_settings.documents.invoice[i]) + '<br>';
      }
      message += '<br>';
    }
    message += 'よろしくお願いします。<div>';

    message += '<i style="color:red;">*Autohide ' + seconds + ' seconds<br>※' + seconds + '秒後自動隠す</i>';

    Debug(message);
    setTimeout(function () {
      Debug('');
    }, seconds * 1000);
  }
}

/**********************************************
 *
 *               Phone schedule
 *
 **********************************************/

// Date.prototype.getWeekNumber = function () {
//   var d = new Date(Date.UTC(this.getFullYear(), this.getMonth(), this.getDate()));
//   var dayNum = d.getUTCDay() || 7;
//   d.setUTCDate(d.getUTCDate() + 4 - dayNum);
//   var yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
//   return Math.ceil(((d - yearStart) / 86400000 + 1) / 7);
// };
function UpdateStatusBar() {
  const statusBar = document.getElementById('status_bar');
  if (!statusBar) {
    return;
  }
  const d = new Date();
  const day = d.getDay();
  const hour = d.getHours();
  const staff = [
    'CLOSED',
    'Schoppmann & Jammie',
    'Victoria & Lennart',
    'Schoppmann & Victoria',
    'Katie & Lennart',
    'Katie & Jammie',
    'CLOSED',
  ];
  const isWeekday = day >= 1 && day <= 5;
  const isOpen = isWeekday && hour >= 12 && hour < 17;
  const statusText = isWeekday ? staff[day] : 'closed';
  const stateKey = `${isOpen ? 'open' : 'closed'}:${statusText}`;
  if (statusBar.dataset.state !== stateKey) {
    const dot = document.createElement('span');
    dot.className = `app-status-dot app-status-dot--${isOpen ? 'open' : 'closed'}`;
    dot.setAttribute('aria-hidden', 'true');
    dot.textContent = '●';
    const label = document.createElement('span');
    label.textContent = `Zendesk Talk: ${isOpen ? 'open' : 'closed'} · ${statusText}`;
    statusBar.replaceChildren(dot, label);
    statusBar.dataset.state = stateKey;
  }
  statusBar.classList.remove('hidden');

  setTimeout(UpdateStatusBar, 10000);
}
UpdateStatusBar();

/**********************************************
 *
 *                 Reminders
 *
 **********************************************/

function SetReminders() {
  my_settings.reminders.forEach((rem) => {
    if (rem && typeof rem === 'object') {
      SetReminderPopup(rem.time, rem.message, 'days' in rem ? rem.days : 'Su,M,Tu,W,Th,F,Sa');
    }
  });
  SetReminderFunction('16:59', ShowDocuments);
}

const weekdayConverter = ['Su', 'M', 'Tu', 'W', 'Th', 'F', 'Sa'];
function SetReminderPopup(trigger_time, message, days) {
  if (typeof trigger_time !== 'string' || !/^([01]\d|2[0-3]):[0-5]\d$/.test(trigger_time)) {
    return;
  }
  const activeDays = typeof days === 'string' ? days.split(',') : [];
  let nowdate = new Date();
  let split_time = trigger_time.split(':');
  let milliseconds_left =
    new Date(nowdate.getFullYear(), nowdate.getMonth(), nowdate.getDate(), split_time[0], split_time[1], 0, 0) - nowdate;
  if (milliseconds_left > 0 && activeDays.includes(weekdayConverter[nowdate.getDay()])) {
    setTimeout(() => Reminder(String(message || '')), milliseconds_left);
  }
}
function SetReminderFunction(trigger_time, functionname) {
  let nowdate = new Date();
  let split_time = trigger_time.split(':');
  let milliseconds_left =
    new Date(nowdate.getFullYear(), nowdate.getMonth(), nowdate.getDate(), split_time[0], split_time[1], 0, 0) - nowdate;
  if (milliseconds_left > 0) {
    setTimeout(functionname, milliseconds_left);
  }
}
function Reminder(message) {
  document.getElementById('alertsound_4').play();
  Debug(
    '<div class="alert alert-primary alert-dismissible fade show" role="alert"><strong>' +
      EscapeHTML(message) +
      '</strong><button type="button" class="close" data-dismiss="alert" aria-label="Close"><span aria-hidden="true">&times;</span></button></div>'
  );
  alert('Check reminders!');
}

function Debug(message) {
  document.getElementById('debug').innerHTML = message;
}

/***************************************\
/ Find order number and email addresses |
/***************************************/

function getIndexToUpdate(theArray, data) {
  //return values
  //-1: Ignore
  //0-999: Update this index
  //1000: Add new index

  //Ignore e_support@amiami.com
  if ('e_support@amiami.com'.indexOf(data) >= 0) {
    return -1; //already exists
  }

  let i = 0;
  while (i < theArray.length) {
    //is theArray[i] part of data?
    if (data.indexOf(theArray[i]) >= 0) {
      return i; //need update
    }
    //is data part of theArray[i]?
    if (theArray[i].indexOf(data) >= 0) {
      return -1; //already exists
    }

    i = i + 1;
  }
  return 1000; //new entry
}
function findordernumemail() {
  let outData = new Array();
  let inputstring = document.getElementById('all_inputfield').value;
  let emailstring = inputstring;
  inputstring = inputstring.replace(/ /g, '');
  inputstring = inputstring.replace(/\n/g, '');
  inputstring = inputstring.replace(/>/g, '');

  // Order number
  let next2index = inputstring.indexOf('2');
  let next7index = inputstring.indexOf('7');
  let output = '';
  while (next2index >= 0 || next7index >= 0) {
    if (next2index != -1) {
      output = getordernumber(inputstring, next2index);
      if (output.indexOf('0') != 1 && output.indexOf('1') != 1) {
        output = '';
      }
      if (output.length > 0) {
        let flag = getIndexToUpdate(outData, output);
        if (flag == 1000) {
          outData.push(output);
        } else if (flag >= 0) {
          outData[flag] = output;
        }
      }
      let nextat = inputstring.slice(next2index + 1).indexOf('2');
      if (nextat >= 0) {
        next2index += nextat + 1;
      } else {
        next2index = nextat;
      }
    } else {
      output = getordernumber(inputstring, next7index);
      if (output.indexOf('2') != 1) {
        output = '';
      }
      if (output.length > 0) {
        let flag = getIndexToUpdate(outData, output);
        if (flag == 1000) {
          outData.push(output);
        } else if (flag >= 0) {
          outData[flag] = output;
        }
      }
      let nextat = inputstring.slice(next7index + 1).indexOf('7');
      if (nextat >= 0) {
        next7index += nextat + 1;
      } else {
        next7index = nextat;
      }
    }
  }

  // Email
  let nextATindex = emailstring.indexOf('@');
  while (nextATindex > 0) {
    output = getemail(emailstring, nextATindex);
    if (output.length > 0) {
      let flag = getIndexToUpdate(outData, output);
      if (flag == 1000) {
        outData.push(output);
      } else if (flag >= 0) {
        outData[flag] = output;
      }
    }
    let nextat = emailstring.slice(nextATindex + 1).indexOf('@');
    if (nextat > 0) {
      nextATindex += nextat + 1;
    } else {
      nextATindex = nextat;
    }
  }

  // Result
  if (outData.length >= 0) {
    let i = 1;
    document.getElementById('s_result').innerHTML = outData[0];
    while (i < outData.length) {
      document.getElementById('s_result').innerHTML += '<br>' + outData[i];

      i = i + 1;
    }
  }

  // Clear input field
  document.getElementById('all_inputfield').value = '';
}

/************************************************************
 *  Find order number function
 */
function getordernumber(inputstring, index) {
  let retval = '';
  let type = 0;
  let tempstring = '';
  let cnt = 1;

  tempstring += inputstring.charAt(index);
  if (type == 0) {
    while (cnt + index < inputstring.length && type == 0) {
      if (inputstring.charCodeAt(cnt + index) > 47 && inputstring.charCodeAt(cnt + index) < 58) {
        tempstring += inputstring.charAt(cnt + index);
        cnt++;
      } else if (inputstring.charAt(cnt + index) == '-') {
        if (cnt == 3) {
          type = 1;
          index++;
        } else if (cnt == 6) {
          type = 2;
          tempstring += inputstring.charAt(cnt + index);
          cnt++;
        } else {
          return retval;
        }
      } else {
        return retval;
      }
      if (cnt == 9) {
        retval = tempstring;
        return retval;
      }
    }
  }
  if (type == 1) {
    while (cnt + index < inputstring.length && type == 1) {
      if (inputstring.charCodeAt(cnt + index) > 47 && inputstring.charCodeAt(cnt + index) < 58) {
        tempstring += inputstring.charAt(cnt + index);
        cnt++;
      } else if (inputstring.charAt(cnt + index) == '-') {
        if (cnt == 6) {
          index++;
        } else {
          return retval;
        }
      } else {
        return retval;
      }
      if (cnt == 9) {
        retval = tempstring;
        return retval;
      }
    }
  }
  if (type == 2) {
    // Rakuten order ######-########-## 9-10 ##
    while (cnt + index < inputstring.length && type == 2) {
      if (inputstring.charCodeAt(cnt + index) > 47 && inputstring.charCodeAt(cnt + index) < 58) {
        tempstring += inputstring.charAt(cnt + index);
        cnt++;
      } else if (inputstring.charAt(cnt + index) == '-') {
        if (cnt == 15) {
          tempstring += inputstring.charAt(cnt + index);
          cnt++;
        } else {
          if (cnt >= 23) {
            retval = tempstring;
          }
          return retval;
        }
      } else {
        if (cnt >= 23) {
          retval = tempstring;
        }
        return retval;
      }
    }
  }

  return retval;
}
function getemail(inputstring, index) {
  let retval = '';
  let tempstring = '@';

  // Front part
  let fcnt = index - 1;
  while (fcnt >= 0) {
    let ccode = inputstring.charCodeAt(fcnt);
    if (ccode >= 97 && ccode <= 122) {
      tempstring = inputstring.charAt(fcnt) + tempstring;
      fcnt--;
    } else if (ccode >= 65 && ccode <= 90) {
      tempstring = inputstring.charAt(fcnt) + tempstring;
      fcnt--;
    } else if (ccode >= 48 && ccode <= 57) {
      tempstring = inputstring.charAt(fcnt) + tempstring;
      fcnt--;
    } else if (ccode == 43 || ccode == 45 || ccode == 46 || ccode == 95) {
      tempstring = inputstring.charAt(fcnt) + tempstring;
      fcnt--;
    } else {
      break;
    }
  }

  // Back part
  let bcnt = index + 1;
  while (bcnt < inputstring.length) {
    let ccode = inputstring.charCodeAt(bcnt);
    if (ccode >= 97 && ccode <= 122) {
      tempstring = tempstring + inputstring.charAt(bcnt);
      bcnt++;
    } else if (ccode >= 65 && ccode <= 90) {
      tempstring = tempstring + inputstring.charAt(bcnt);
      bcnt++;
    } else if (ccode >= 48 && ccode <= 57) {
      tempstring = tempstring + inputstring.charAt(bcnt);
      bcnt++;
    } else if (ccode == 43 || ccode == 45 || ccode == 46 || ccode == 95) {
      tempstring = tempstring + inputstring.charAt(bcnt);
      bcnt++;
    } else {
      break;
    }
  }

  if (index - fcnt > 1 && bcnt - index > 1) {
    retval = tempstring;
  }
  return retval;
}
