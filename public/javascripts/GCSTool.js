/**********************************************
 *
 *                   GLOBALS
 *
 **********************************************/

const my_settings = {
  userid: 'NewUser',
  colormode: 'Style_normal.css',
  language: 'japanese',
  reminders: [],
  documents: {
    label: [],
    invoice: [],
    both: []
  }
};

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
  'december'
];

/**********************************************
 *
 *                SETTINGS
 *
 **********************************************/

// Run when every page has been loaded
function Loaded() {
  // Load local settings
  if (localStorage.hasOwnProperty('settings') == true) {
    const my_settings_local = JSON.parse(localStorage.getItem('settings'));
    for (const key of Object.keys(my_settings)) {
      if (my_settings_local.hasOwnProperty(key)) {
        my_settings[key] = my_settings_local[key];
      }
    }
  }

  // Set user ID
  let dom_uid = document.getElementById('user_id');
  if (dom_uid) {
    dom_uid.value = my_settings.userid;
    if (!(my_settings.userid === 'NewUser')) {
      dom_uid.readOnly = true;
      document.getElementById('update_user_id_button').style.display = 'none';
    }
  }
  dom_uid = document.getElementById('creator');
  if (dom_uid) {
    dom_uid.value = my_settings.userid;
  }

  // Set interface language
  document.getElementById('lg_language').value = my_settings.language;
  UpdateLanguage('lg_language');

  // Set color mode
  let dom_cmode = document.getElementById('cmode');
  if (dom_cmode) {
    dom_cmode.value = my_settings.colormode;
  }
  // Load css file for selected color mode
  let head = document.getElementsByTagName('head')[0];
  let link = document.createElement('link');
  link.id = 'myCss';
  link.rel = 'stylesheet';
  link.type = 'text/css';
  link.href = '/stylesheets/' + my_settings.colormode;
  link.media = 'all';
  head.appendChild(link);

  // Process reminders
  ShowReminders();
  SetReminders();

  // If has entries, then hide all private entries from other users
  DisplayOthersPrivateEntries('none');

  // Setup admin_control
  const admins = document.getElementsByClassName('admin');
  const admin_controls = document.getElementsByClassName('admin_control');
  let is_admin = false;
  for (let i = 0; i < admins.length; i++) {
    if (my_settings.userid === admins[i].innerHTML) {
      is_admin = true;
    }
  }
  if (is_admin == true) {
    for (let i = 0; i < admin_controls.length; i++) {
      admin_controls[i].style.display = 'inline';
    }
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
    '<tr><th>' +
    GetHTMLElement('_time_') +
    '</th><th>' +
    GetHTMLElement('_message_') +
    '</th><th>' +
    GetHTMLElement('_action_') +
    '</th></tr>';
  for (let ri = 0; ri < my_settings.reminders.length; ri++) {
    reminder_html +=
      '<tr><td>' +
      my_settings.reminders[ri].time +
      '</td><td>' +
      my_settings.reminders[ri].message +
      '</td><td><button onclick="RemoveReminder(' +
      ri +
      ')">' +
      GetHTMLElement('_delete_') +
      '</button></td></tr>';
  }
  reminder_html +=
    '<tr><td><input id="reminder_time" type="text", placeholder="12:00"></td><td><input id="reminder_message" type="text" placeholder="Message"></td><td><button onclick="AddReminder()">' +
    GetHTMLElement('_addnew_') +
    '</button></td></tr>';
  document.getElementById('reminders').innerHTML = reminder_html;
}

// Entry view admin controller
function AdminCheckBox() {
  if (document.getElementById('admin').checked == false) {
    DisplayOthersPrivateEntries('none');
  }
}

function DisplayOthersPrivateEntries(property) {
  let entries = document.getElementsByClassName('entry');
  for (let i = 0; i < entries.length; i++) {
    if (entries[i].innerHTML.indexOf('lg_language="_private_"') >= 0) {
      if (entries[i].innerHTML.indexOf('</i><i>' + my_settings.userid + '</i>') == -1) {
        entries[i].style.display = property;
      }
    }
  }
}

function UpdateUserID() {
  my_settings.userid = document.getElementById('user_id').value;
  localStorage.setItem('settings', JSON.stringify(my_settings));
}

function UpdateColorMode() {
  my_settings.colormode = document.getElementById('cmode').value;
  localStorage.setItem('settings', JSON.stringify(my_settings));
}

function UpdateLanguageSettings() {
  my_settings.language = document.getElementById('lg_language').value;
  localStorage.setItem('settings', JSON.stringify(my_settings));
  UpdateLanguage('lg_language');
}

function RemoveReminder(reminder_index) {
  my_settings.reminders.splice(reminder_index, 1);
  localStorage.setItem('settings', JSON.stringify(my_settings));
  ShowReminders();
}

function AddReminder() {
  my_settings.reminders.push({
    time: document.getElementById('reminder_time').value,
    message: document.getElementById('reminder_message').value
  });
  SetReminderPopup(document.getElementById('reminder_time').value, document.getElementById('reminder_message').value);
  localStorage.setItem('settings', JSON.stringify(my_settings));
  ShowReminders();
}

/**********************************************
 *
 *                 INTERFACE
 *
 **********************************************/

// Setup scheduler
function SetupScheduler() {
  let dom_scheduler = document.getElementById('schedule');
  let data = JSON.parse(document.getElementById('data').innerHTML);
  dom_scheduler.innerHTML =
    '<tr><th style="background-color:rgb(141, 71, 71);" >' +
    GetHTMLElement('_su_') +
    '</th><th>' +
    GetHTMLElement('_m_') +
    '</th><th>' +
    GetHTMLElement('_tu_') +
    '</th><th>' +
    GetHTMLElement('_w_') +
    '</th><th>' +
    GetHTMLElement('_th_') +
    '</th><th>' +
    GetHTMLElement('_f_') +
    '</th><th>' +
    GetHTMLElement('_sa_') +
    '</th></tr>';
  let today = new Date();
  let output = '';
  let checkDate = new Date(
    parseInt(document.getElementById('year_select').value),
    parseInt(document.getElementById('month_select').value),
    parseInt(document.getElementById('date_select').value)
  );
  let show_weeks = parseInt(document.getElementById('show_weeks').value);
  d = new Date(checkDate.getFullYear(), checkDate.getMonth(), checkDate.getDate() - checkDate.getDay());
  let draw_month = -1;
  for (let wks = 0; wks < show_weeks; wks++) {
    output += '<tr><td colspan="7"><h2>';
    let dtest = new Date(d.getFullYear(), d.getMonth(), d.getDate() + wks * 7 + 6);
    if (dtest.getMonth() != draw_month) {
      draw_month = dtest.getMonth();
      output += GetHTMLElement('_' + month_names[draw_month].slice(0, 3) + '_');
    }
    output += '</h2></td></tr>';
    output += '<tr>';
    for (let wd = 0; wd < 7; wd++) {
      let td = new Date(d.getFullYear(), d.getMonth(), d.getDate() + wks * 7 + wd);
      let isholiday = '';
      if (td.getDay() == 0) {
        isholiday = ' style="background-color:rgb(141, 71, 71);"';
      }
      for (let i = 0; i < data.holidays.length; i++) {
        let data_split = data.holidays[i].date.split('-');
        let holiday = {
          year: parseInt(data_split[0]),
          month: parseInt(data_split[1]),
          date: parseInt(data_split[2])
        };
        if (td.getFullYear() == holiday.year && td.getMonth() + 1 == holiday.month && td.getDate() == holiday.date) {
          isholiday = ' style="background-color:rgb(141, 71, 71);"';
        }
      }
      let isToday = td.getMonth() == today.getMonth() && td.getDate() == today.getDate() ? ' today' : '';
      let datestring = td.getMonth() + 1 + '/' + td.getDate();
      if (isToday.length > 0) {
        datestring = '<b style="border: 5px solid orange; border-radius: 20%;">' + datestring + '</b>';
      }
      output += '<td class="' + month_names[td.getMonth()] + '" ' + isholiday + '>' + datestring + '<br><hr>';
      for (let sm = 0; sm < data.staff.length; sm++) {
        let s = data.staff[sm];
        let isWork = 'green';
        if (td.getDay() == s.dayoff1 || td.getDay() == s.dayoff2) {
          isWork = 'red';
        }
        if (isholiday.length > 0) {
          isWork = 'red';
        }
        for (let i = 0; i < s.schedules.length; i++) {
          let date_split = s.schedules[i].date.split('-');
          let dayoff = {
            year: parseInt(date_split[0]),
            month: parseInt(date_split[1]),
            date: parseInt(date_split[2])
          };
          if (td.getFullYear() == dayoff.year && td.getMonth() + 1 == dayoff.month && td.getDate() == dayoff.date) {
            if (s.schedules[i].work == true) {
              isWork = 'green';
            } else {
              isWork = 'red';
            }
          }
        }
        output +=
          '<div onclick="Toggle(this,\'' +
          td.getFullYear() +
          "','" +
          (td.getMonth() + 1) +
          "','" +
          td.getDate() +
          "','" +
          sm +
          '\')" style="width:100%;background-color:' +
          isWork +
          ';">' +
          s.name +
          '</div>';
      }
      output += '</td>';
    }
    output += '</tr>';
  }
  dom_scheduler.innerHTML += output;
}

/**********************************************
 *
 *                 KEYBOARD
 *
 **********************************************/

// Capture Ctrl+F
window.onkeydown = function(e) {
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

  this_element.parentElement.innerHTML += '<div id="test" class="w3-animate-opacity"><b>COPY</b></div>';
  setTimeout(DeleteCOPY, 1000);
}
function DeleteCOPY() {
  let element = document.getElementById('test');
  element.parentElement.removeChild(element);
}

/**********************************************
 *
 *             HELPER FUNCTIONS
 *
 **********************************************/

// Resize the text box
function auto_grow(element) {
  element.style.height = '5px';
  element.style.height = element.scrollHeight + 'px';
}

/**********************************************
 *
 *             FILTER FUNCTIONS
 *
 **********************************************/
function Clear() {
  document.getElementById('s_box').value = '';
  document.getElementById('s_tag').value = '_';
  document.getElementById('s_template').checked = true;
  document.getElementById('s_manual').checked = true;
  document.getElementById('s_ccontact').checked = true;
  Filter();
}

function Filter() {
  const e = document.getElementsByClassName('entry');
  const s_string = document.getElementById('s_box').value.toLocaleLowerCase();
  const s_tag = document.getElementById('s_tag').value;
  for (let i = 0; i < e.length; i++) {
    if (
      !(e[i].innerHTML.indexOf('lg_language="_private_"') >= 0 && e[i].innerHTML.indexOf('</i><i>' + my_settings.userid + '</i>') == -1) ||
      document.getElementById('admin').checked == true
    ) {
      if (e[i].innerHTML.toLocaleLowerCase().indexOf(s_string) >= 0 && e[i].innerHTML.indexOf(s_tag) >= 0) {
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
    }
  }
}

function DisplayEntry(uid) {
  if (document.getElementById(uid).style.display.indexOf('none') == 0) {
    document.getElementById(uid).style.display = 'block';

    // Scale up size of text box to fit the text
    let all_t_area = document.getElementById(uid).getElementsByTagName('TEXTAREA');
    for (let ata = 0; ata < all_t_area.length; ata++) {
      auto_grow(all_t_area[ata]);
    }
  } else {
    document.getElementById(uid).style.display = 'none';
  }
}

/**********************************************
 *
 *              OTHER FUNCTIONS
 *
 **********************************************/

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
  if (input.length == 0) {
    return;
  }
  if (type == 0) {
    my_settings.documents.both.push(input);
  } else if (type == 1) {
    my_settings.documents.label.push(input);
  } else {
    my_settings.documents.invoice.push(input);
  }
  document.getElementById('track').value = '';
  localStorage.setItem('settings', JSON.stringify(my_settings));
}
function ShowDocuments() {
  if (my_settings.documents.both.length > 0 || my_settings.documents.label.length > 0 || my_settings.documents.invoice.length > 0) {
    let message = '<div>お疲れ様です。<br><br>';
    if (my_settings.documents.both.length > 0) {
      message += '伝票画像+インボイス<br>';
      while (my_settings.documents.both.length > 0) {
        message += my_settings.documents.both.pop() + '<br>';
      }
      message += '<br>';
    }
    if (my_settings.documents.label.length > 0) {
      message += '伝票画像<br>';
      while (my_settings.documents.label.length > 0) {
        message += my_settings.documents.label.pop() + '<br>';
      }
      message += '<br>';
    }
    if (my_settings.documents.invoice.length > 0) {
      message += 'インボイス<br>';
      while (my_settings.documents.invoice.length > 0) {
        message += my_settings.documents.invoice.pop() + '<br>';
      }
      message += '<br>';
    }
    message += 'よろしくお願いします。<div>';

    message += '<button onclick="Debug(\'\')">Done</button>';

    Debug(message);

    localStorage.setItem('settings', JSON.stringify(my_settings));

    alert('Request for shipping documents.\n発送書類を依頼してください。');
  }
}

/**********************************************
 *
 *                 Reminders
 *
 **********************************************/

function SetReminders() {
  my_settings.reminders.forEach(rem => {
    SetReminderPopup(rem.time, rem.message);
  });
  SetReminderFunction('16:59', ShowDocuments);
}

function SetReminderPopup(trigger_time, message) {
  let nowdate = new Date();
  let split_time = trigger_time.split(':');
  let milliseconds_left =
    new Date(nowdate.getFullYear(), nowdate.getMonth(), nowdate.getDate(), split_time[0], split_time[1], 0, 0) - nowdate;
  if (milliseconds_left > 0) {
    setTimeout('Reminder("' + message + '")', milliseconds_left);
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
  let color = document.body.style.backgroundColor;
  document.body.style.backgroundColor = 'red';
  //notifyMe(message);
  alert(message);
  document.body.style.backgroundColor = color;
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
