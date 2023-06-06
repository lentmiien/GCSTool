const step1 = document.getElementById("step1");
const step2 = document.getElementById("step2");
const step3 = document.getElementById("step3");
const step4 = document.getElementById("step4");
const step5 = document.getElementById("step5");
const change_in_method = document.getElementsByClassName("change_in_method");
const changedate = document.getElementById("changedate");
const announcement = document.getElementById("announcement");
const announcement_text = document.getElementById("announcement_text");
const request_comment_number = document.getElementById("request_comment_number");

let announcement_msg = "";
let s2_gcs_share_msg = "";
let s2_gcs_cs_share_msg = "";

const month = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const postfix = ['', 'st', 'nd', 'rd', 'th', 'th', 'th', 'th', 'th', 'th', 'th', 'th', 'th', 'th', 'th', 'th', 'th', 'th', 'th', 'th', 'th', 'st', 'nd', 'rd', 'th', 'th', 'th', 'th', 'th', 'th', 'th', 'st'];

function s1_next() {
  // Generate announcement message
  const date = new Date(changedate.value);
  const link = announcement.value.split('.html').join('_en.html');
  const update_structure_r = {};
  const update_structure_r_j = {};
  const update_structure_s = {};
  const update_structure_s_j = {};
  for (let i = 0; i < change_in_method.length; i++) {
    if (change_in_method[i].value == 'available') {
      if (change_in_method[i].dataset.country in update_structure_r) {
        update_structure_r[change_in_method[i].dataset.country] += `, ${change_in_method[i].dataset.method}`;
      } else {
        update_structure_r[change_in_method[i].dataset.country] = `${change_in_method[i].dataset.method}`;
      }
      if (change_in_method[i].dataset.country_jp in update_structure_r_j) {
        update_structure_r_j[change_in_method[i].dataset.country_jp] += `, ${change_in_method[i].dataset.method}`;
      } else {
        update_structure_r_j[change_in_method[i].dataset.country_jp] = `${change_in_method[i].dataset.method}`;
      }
    } else {
      if (change_in_method[i].dataset.country in update_structure_s) {
        update_structure_s[change_in_method[i].dataset.country] += `, ${change_in_method[i].dataset.method}`;
      } else {
        update_structure_s[change_in_method[i].dataset.country] = `${change_in_method[i].dataset.method}`;
      }
      if (change_in_method[i].dataset.country_jp in update_structure_s_j) {
        update_structure_s_j[change_in_method[i].dataset.country_jp] += `, ${change_in_method[i].dataset.method}`;
      } else {
        update_structure_s_j[change_in_method[i].dataset.country_jp] = `${change_in_method[i].dataset.method}`;
      }
    }
  }
  const resumptions = {};
  let keys = Object.keys(update_structure_r);
  keys.forEach(key => {
    if (update_structure_r[key] in resumptions) {
      resumptions[update_structure_r[key]] += `, ${key}`;
    } else {
      resumptions[update_structure_r[key]] = `${key}`;
    }
  });
  const suspensions = {};
  keys = Object.keys(update_structure_s);
  keys.forEach(key => {
    if (update_structure_s[key] in suspensions) {
      suspensions[update_structure_s[key]] += `, ${key}`;
    } else {
      suspensions[update_structure_s[key]] = `${key}`;
    }
  });
  announcement_msg = `# As of ${month[date.getMonth()]} ${date.getDate()}${postfix[date.getDate()]}:\n`;
  announcement_msg += `${link}\n`;
  keys = Object.keys(resumptions);
  if (keys.length > 0) {
    announcement_msg += `\nRESUMPTION\n`;
    keys.forEach(key => {
      announcement_msg += `-${key} shipments for ${resumptions[key]}\n`;
    });
  }
  keys = Object.keys(suspensions);
  if (keys.length > 0) {
    announcement_msg += `\nSUSPENSION\n`;
    keys.forEach(key => {
      announcement_msg += `-${key} shipments for ${suspensions[key]}\n`;
    });
  }
  announcement_text.value = announcement_msg;
  // Generate s2_gcs_share message
  s2_gcs_share_msg = `[toall]\n`;
  s2_gcs_share_msg += `お疲れ様です。\n`;
  s2_gcs_share_msg += `JPから引受再開・停止の発表がありました。\n`;
  s2_gcs_share_msg += `${announcement.value}`;
  keys = Object.keys(update_structure_r_j);
  if (keys.length > 0) {
    s2_gcs_share_msg += `\n[info][title]引受再開[/title]`;
    keys.forEach(key => {
      s2_gcs_share_msg += `・${key}: ${update_structure_r_j[key]}\n`;
    });
    s2_gcs_share_msg += `[/info]`;
  }
  keys = Object.keys(update_structure_s_j);
  if (keys.length > 0) {
    s2_gcs_share_msg += `\n[info][title]引受停止[/title]`;
    keys.forEach(key => {
      s2_gcs_share_msg += `・${key}: ${update_structure_s_j[key]}\n`;
    });
    s2_gcs_share_msg += `[/info]`;
  }
  s2_gcs_share_msg += `\nよろしくお願いいたします。`;
  // Generate s2_gcs_cs_share message
  s2_gcs_cs_share_msg = `[toall]\n`;
  s2_gcs_cs_share_msg += `JP has made an announcement regarding resumptions/suspensions of shipping methods.\n`;
  s2_gcs_cs_share_msg += `${link}`;
  keys = Object.keys(update_structure_r);
  if (keys.length > 0) {
    s2_gcs_cs_share_msg += `\n[info][title]Resumptions[/title]`;
    keys.forEach(key => {
      s2_gcs_cs_share_msg += `・${key}: ${update_structure_r[key]}\n`;
    });
    s2_gcs_cs_share_msg += `[/info]`;
  }
  keys = Object.keys(update_structure_s);
  if (keys.length > 0) {
    s2_gcs_cs_share_msg += `\n[info][title]Suspensions[/title]`;
    keys.forEach(key => {
      s2_gcs_cs_share_msg += `・${key}: ${update_structure_s[key]}\n`;
    });
    s2_gcs_cs_share_msg += `[/info]`;
  }

  // Show next step
  step1.classList.add("hidden");
  step2.classList.remove("hidden");
}

function s2_gcs_share() {
  Copy(s2_gcs_share_msg);
}

function s2_gcs_cs_share() {
  Copy(s2_gcs_cs_share_msg);
}

let s3_announcement_text_msg = '';
let s3_update_text_msg = '';
let s3_cw_share_msg = '';

function s2_next() {
  // Generate Cybozu messages (announcement)
  // Generate Cybozu messages (update request)
  // Generate share message for CW

  // Show next step
  step2.classList.add("hidden");
  step3.classList.remove("hidden");
}

function s3_announcement_link() {
  Copy();
}

function s3_announcement_text() {
  Copy(s3_announcement_text_msg);
}

function s3_update_link() {
  Copy();
}

function s3_update_text() {
  Copy(s3_update_text_msg);
}

function s3_cw_share() {
  Copy(s3_cw_share_msg);
}

function s3_next() {
  // TODO

  // Show next step
  step3.classList.add("hidden");
  step4.classList.remove("hidden");
}

/****
 * Copy helper
 */
function Copy(text) {
  // Copy to clipboard
  function listener(e) {
    e.clipboardData.setData('text/plain', text);
    e.preventDefault();
  }
  document.addEventListener('copy', listener);
  document.execCommand('copy');
  document.removeEventListener('copy', listener);
}