// DATA
const changes = JSON.parse(document.getElementById("changes").innerHTML);
const new_countries = JSON.parse(document.getElementById("new_countries").innerHTML);
const JP_announcements = JSON.parse(document.getElementById("JP_announcements").innerHTML);
const DB_notice = JSON.parse(document.getElementById("DB_notice").innerHTML);

// HTML elements
const step1 = document.getElementById("step1");
const step2 = document.getElementById("step2");
const step3 = document.getElementById("step3");
const step4 = document.getElementById("step4");
const step5 = document.getElementById("step5");
const new_country_entry = document.getElementsByClassName("new_country_entry");
const change_in_method = document.getElementsByClassName("change_in_method");
const changedate = document.getElementById("changedate");
const announcement = document.getElementById("announcement");
const announcement_text = document.getElementById("announcement_text");
const request_comment_number = document.getElementById("request_comment_number");

/******
 * New countries
 */
function Save_new_countries() {
  // Prepare a lookup table
  const jp_cid_lookup = [];
  new_countries.forEach(d => jp_cid_lookup.push(d.jp_cid));

  // Update input values
  for (let i = 0; i < new_country_entry.length; i++) {
    const index = jp_cid_lookup.indexOf(new_country_entry[i].dataset.id);
    new_countries[index][new_country_entry[i].dataset.method] = new_country_entry[i].value;
  }

  // Send to server
  const url = '/country/new_countries';
  fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(new_countries),
  })
  .then((response) => response.json())
  .then((data) => {
    window.open('/country/checkjp', '_self');
  })
  .catch((error) => {
    alert(error);
  });
}

/******
 * Changes
 */

let announcement_msg = "";
let s2_gcs_share_msg = "";
let s2_gcs_cs_share_msg = "";
let s2_zendesk_html_msg = "";

const month = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const postfix = ['', 'st', 'nd', 'rd', 'th', 'th', 'th', 'th', 'th', 'th', 'th', 'th', 'th', 'th', 'th', 'th', 'th', 'th', 'th', 'th', 'th', 'st', 'nd', 'rd', 'th', 'th', 'th', 'th', 'th', 'th', 'th', 'st'];

const method_key_converter = {
  "Air Small Packet": "jp_asp",
  "Air Small Packet Unregistered": "jp_asp_u",
  "SAL Small Packet": "jp_salsp",
  "SAL Small Packet Unregistered": "jp_salsp_u",
  "Air Parcel": "jp_ap",
  "SAL Parcel": "jp_salp",
  "Surface Parcel": "jp_sp",
  "EMS": "jp_ems",
};

const update_structure_r = {};
const update_structure_r_j = {};
const update_structure_s = {};
const update_structure_s_j = {};
const method_update_r = {};
const method_update_s = {};
const update_countries = [];

function s1_next() {
  // Generate announcement message
  const date = new Date(changedate.value);
  const link = announcement.value.split('.html').join('_en.html');
  for (let i = 0; i < change_in_method.length; i++) {
    if (!(change_in_method[i].dataset.country in update_countries)) {
      update_countries.push(change_in_method[i].dataset.country);
    }
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
      if (change_in_method[i].dataset.method in method_update_r) {
        method_update_r[change_in_method[i].dataset.method].push(change_in_method[i].dataset.country);
      } else {
        method_update_r[change_in_method[i].dataset.method] = [change_in_method[i].dataset.country];
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
      if (change_in_method[i].dataset.method in method_update_s) {
        method_update_s[change_in_method[i].dataset.method].push(change_in_method[i].dataset.country);
      } else {
        method_update_s[change_in_method[i].dataset.method] = [change_in_method[i].dataset.country];
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

  // Generate s2_zendesk_html_msg
  const id_change = {};
  for (let i = 0; i < change_in_method.length; i++) {
    const id = parseInt(change_in_method[i].dataset.id);
    if (id >= 0) {
      id_change[id] = {};
      id_change[id][change_in_method[i].dataset.method] = change_in_method[i].value;
    }
  }
  const zendesk_method_list = [];
  DB_data.forEach(entry => {
    if (entry.amiami_country.length > 0) {
      const index = zendesk_method_list.length;
      zendesk_method_list.push({
        country: entry.amiami_country,
        jp_asp: entry.jp_asp == "✓" ? true : false,
        jp_asp_u: entry.jp_asp == "✓" || entry.jp_asp == "*"  ? true : false,
        jp_salsp: entry.jp_salsp == "✓" ? true : false,
        jp_salsp_u: entry.jp_salsp == "✓" || entry.jp_salsp == "*"  ? true : false,
        jp_ap: entry.jp_ap == "✓" ? true : false,
        jp_salp: entry.jp_salp == "✓" ? true : false,
        jp_sp: entry.jp_sp == "✓" ? true : false,
        jp_ems: entry.jp_ems == "✓" ? true : false,
        fm_dhl: entry.fm_dhl == "✓" ? true : false,
        fm_ait: entry.fm_ait == "✓" ? true : false,
      });
      if (entry.id in id_change) {
        const id_methods = Object.keys(id_change[entry.id]);
        id_methods.forEach(m => {
          zendesk_method_list[index][method_key_converter[m]] = id_change[entry.id][m] == "available" ? true : false;
        });
      }
    }
  });
  zendesk_method_list.sort((a, b) => {
    if (a.country < b.country) return -1;
    if (a.country > b.country) return 1;
    return 0;
  });
  // Set an initial message (top message, over table)
  s2_zendesk_html_msg += `<p>\r\n  The list below shows the currently available shipping methods for each country.\r\n  To find your country quickly, please use the search function in your browser.\r\n</p>\r\n<p>\r\n  *We try to update the list as soon as possible when there are any updates.\r\n</p>\r\n<p>If you have any questions, then please contact our support.</p>\r\n<p>&nbsp;</p>\r\n`;
  // Generate a table (html table, with striped lines and a header line every 10-15? lines)
  let tbody_content = "";
  const colors = ["#FFFFFF", "#EEEEEE", "#CCCCCC"];
  zendesk_method_list.forEach((entry, i) => {
    if (i%15 == 0) {
      // Add header row
      tbody_content += `<tr style="background-color:${colors[2]};"><th style="witdh:18%;">Country</th><th style="witdh:8%;">Air Parcel</th><th style="witdh:8%;">Air small packet</th><th style="witdh:8%;">Air small packet unregistered</th><th style="witdh:8%;">DHL</th><th style="witdh:8%;">EMS</th><th style="witdh:8%;">SAL Parcel</th><th style="witdh:8%;">SAL small packet</th><th style="witdh:8%;">SAL small packet unregistered</th><th style="witdh:8%;">Surface parcel</th><th style="witdh:10%;">Other</th></tr>`;
      // 18% country
      // 72% 9 shipping methods = 8% per shipping method
      // 10% other
    }

    // Add content row
    tbody_content += `<tr style="background-color:${colors[i%2]};"><th>${entry.country}</th><td style="text-align: center; vertical-align: middle;">${entry.jp_ap ? '〇' : ''}</td><td style="text-align: center; vertical-align: middle;">${entry.jp_asp ? '〇' : ''}</td><td style="text-align: center; vertical-align: middle;">${entry.jp_asp_u ? '〇' : ''}</td><td style="text-align: center; vertical-align: middle;">${entry.fm_dhl ? '〇' : ''}</td><td style="text-align: center; vertical-align: middle;">${entry.jp_ems ? '〇' : ''}</td><td style="text-align: center; vertical-align: middle;">${entry.jp_salp ? '〇' : ''}</td><td style="text-align: center; vertical-align: middle;">${entry.jp_salsp ? '〇' : ''}</td><td style="text-align: center; vertical-align: middle;">${entry.jp_salsp_u ? '〇' : ''}</td><td style="text-align: center; vertical-align: middle;">${entry.jp_sp ? '〇' : ''}</td><td style="text-align: center; vertical-align: middle;">${entry.fm_ait ? "Surface Mail Premium" : ""}</td></tr>`;
  });
  s2_zendesk_html_msg += `<table><tbody>${tbody_content}</tbody></table>`;
  // Add final notes (bottom message, under table)
  s2_zendesk_html_msg += `\r\n<p>\r\n  *Ukraine: Shipment not available for all regions.\r\n</p>`;

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

function s2_zendesk_link(url) {
  Copy(url);
}

function s2_zendesk_html() {
  Copy(s2_zendesk_html_msg);
}

let s3_announcement_text_msg = '';
let s3_update_text_msg = '';
let s3_cw_share_msg = '';
const save_data = {};

function s2_next() {
  // Generate Cybozu messages (announcement)
  // Message top (link to JP announcement, list of changes, and top portion of update request)
  s3_announcement_text_msg = `お疲れ様です。\r\n\r\n${announcement.value}\r\nJPの引受停止状況が変わりましたので、下記の修正が必要になります。\r\n\r\n${changedate.value}から下記の国の引受停止状況が変わりました。\r\n\r\n対象国：\r\n`;
  let keys = Object.keys(update_structure_r_j);
  if (keys.length > 0) {
    s3_announcement_text_msg += `■再開内容\r\n`;
    keys.forEach(key => {
      s3_announcement_text_msg += `・${key}: ${update_structure_r_j[key]}\r\n`;
    });
    s3_announcement_text_msg += `\r\n`;
  }
  keys = Object.keys(update_structure_s_j);
  if (keys.length > 0) {
    s3_announcement_text_msg += `■停止内容\r\n`;
    keys.forEach(key => {
      s3_announcement_text_msg += `・${key}: ${update_structure_s_j[key]}\r\n`;
    });
    s3_announcement_text_msg += `\r\n`;
  }
  // Request header
  const d = new Date();
  const today_str = `${d.getFullYear()}-${d.getMonth() > 8 ? d.getMonth()+1 : '0' + (d.getMonth()+1)}-${d.getDate() > 9 ? d.getDate() : '0' + d.getDate()}`;
  
  s3_announcement_text_msg += `○処理内容\r\n掲載内容変更\r\n\r\n`;
  s3_announcement_text_msg += `○対象サイト\r\namiami.com\r\n\r\n`;
  s3_announcement_text_msg += `○掲載開始希望日時\r\n${new Date(changedate.value) < d ? today_str : changedate.value}\r\n\r\n`;
  s3_announcement_text_msg += `○特記事項\r\n更新日update表記は変更\r\n\r\n`;
  s3_announcement_text_msg += `○変更内容\r\n\r\n`;

  s3_announcement_text_msg += `修正対象お知らせタイトル\r\n-------------------------------------\r\nShipping method suspension and resumption updates\r\n\r\n\r\n\r\n`;

  const message_header = 'List of currently available shipping methods by country:\r\nhttps://support.amiami.com/hc/en-us/articles/360048840471-Available-Shipping-method-table-by-country';
  let message_body = "";
  DB_notice.forEach(u => {
    message_body += `\r\n\r\n---\r\n${u.message}`;
  });
  // Message part to replace
  s3_announcement_text_msg += `変更対象箇所\r\n-------------------------------------\r\n${message_header}${message_body}\r\n-------------------------------------\r\n\r\n\r\n\r\n`;
  
  save_data['notice'] = {};
  save_data['notice']['new_entry'] = {
    date: changedate.value,
    message: ""
  };
  save_data['notice']['delete_entries'] = [];

  // Generate new entry string
  const ud = new Date(changedate.value);
  let msg = `# As of ${month[ud.getMonth()]} ${ud.getDate()}${postfix[ud.getDate()]}:\r\n`;
  msg += `${announcement.value.split('.html').join('_en.html')}`;
  keys = Object.keys(method_update_r);
  if (keys.length > 0) {
    msg += "\r\n\r\nRESUMPTION\r\n";
    keys.sort((a,b) => {
      if (a < b) return -1;
      if (a > b) return 1;
      return 0;
    });
    keys.forEach(key => {
      msg += `-${key} shipments for ${method_update_r[key].join(', ')}'\r\n'`;
    });
  }
  keys = Object.keys(method_update_s);
  if (keys.length > 0) {
    msg += "\r\n\r\nSUSPENSION\r\n";
    keys.sort((a,b) => {
      if (a < b) return -1;
      if (a > b) return 1;
      return 0;
    });
    keys.forEach(key => {
      msg += `-${key} shipments for ${method_update_s[key].join(', ')}'\r\n'`;
    });
  }
  save_data['notice']['new_entry'].message = msg;

  const cd = new Date(d.getFullYear(), d.getMonth()-2, d.getDate());
  const cutoff_str = `${cd.getFullYear()}-${cd.getMonth() > 8 ? cd.getMonth()+1 : '0' + (cd.getMonth()+1)}-${cd.getDate() > 9 ? cd.getDate() : '0' + cd.getDate()}`;
  message_body = `\r\n\r\n---\r\n${msg}`;
  DB_notice.forEach(u => {
    if (u.date > cutoff_str) {
      message_body += `\r\n\r\n---\r\n${u.message}`;
    } else {
      save_data['notice']['delete_entries'].push(u.id);
    }
  });
  // Updated message
  s3_announcement_text_msg += `以下の内容に置き換え\r\n-------------------------------------\r\n${message_header}${message_body}\r\n-------------------------------------\r\n\r\n`;

  // Generate Cybozu messages (update request)
  s3_update_text_msg = 'TO:八重樫、中島、高篠\r\n\r\n【固定文面監修無し】\r\n' + s3_announcement_text_msg;
  // Generate share message for CW
  s3_cw_share_msg = 'TO:横山祐一、ニック\r\n\r\n';
  s3_cw_share_msg += 'お疲れ様です。\r\n';
  s3_cw_share_msg += 'JPの引受停止状況はサイトトップの更新を申請いたしました。\r\n';
  s3_cw_share_msg += `https://a6aa.cybozu.com/o/ag.cgi?page=MyFolderMessageView&mDBID=1&mDID=469528&tp=t&flno=${request_comment_number.value}#Follow\r\n`;
  s3_cw_share_msg += `参考：　${announcement.value}`;

  // Show next step
  step2.classList.add("hidden");
  step3.classList.remove("hidden");
}

function s3_announcement_link(url) {
  Copy(url);
}

function s3_announcement_text() {
  Copy(s3_announcement_text_msg);
}

function s3_update_link(url) {
  Copy(url);
}

function s3_update_text() {
  Copy(s3_update_text_msg);
}

function s3_cw_share() {
  Copy(s3_cw_share_msg);
}

let s4_update_csv_csv = "";
let s4_update_text_msg = "";

function s3_next() {
  // generate s4_update_csv_csv
  // output format: country_code, country_name, blocked_shipping_methods
  // data => csv
  const countries = Object.keys(update_process_data["_1_verify_data"]);
  const countries_jp = countries.map(c => workdata.jp_translator[c]);
  const iso_countries = countries.map(c => workdata.jp_to_iso3166[c]);
  const iso_country_index = iso_countries.map(c => update_process_data["_2_data"]["iso3166_shipping_method_list_lookup"].indexOf(c));
  const iso_country_methods = iso_country_index.map(c => update_process_data["_2_data"]["iso3166_shipping_method_list"][c]);
  const iso_data = iso_country_index.map(c => workdata.country_master_iso3166[c]);
  const count = countries.length;

  update_process_data["_5_Methods"] = {
    countries,
    countries_jp,
    iso_countries,
    iso_country_index,
    iso_country_methods,
    iso_data,
    count
  };

  const output_rows = [];
  for (let i = 0; i < count; i++) {
    if (iso_country_methods[i] != undefined) {
      const block_methods = [];
      if (!iso_country_methods[i].ems) { block_methods.push(1); }
      if (!iso_country_methods[i].salsp) { block_methods.push(2); }
      if (!iso_country_methods[i].salsp_u) { block_methods.push(3); }
      if (iso_data[i].alpha_2_code != 'JP') { block_methods.push(4); }
      if (!iso_country_methods[i].salp) { block_methods.push(5); }
      if (!iso_country_methods[i].ap) { block_methods.push(6); }
      if (!iso_country_methods[i].asp_u) { block_methods.push(11); }
      if (!iso_country_methods[i].asp) { block_methods.push(17); }
      if (!iso_country_methods[i].dhl) { block_methods.push(19); }
      if (iso_data[i].alpha_2_code != 'US') { block_methods.push(20); }
      if (!iso_country_methods[i].sp) { block_methods.push(21); }
      
      output_rows.push(`"${iso_data[i].numeric}","${countries_jp[i]}","${block_methods.join(',')}"`);
    }
  }
  s4_update_csv_csv = output_rows.join('\n');

  // TODO: generate s4_update_text_msg

  // Show next step
  step3.classList.add("hidden");
  step4.classList.remove("hidden");
}

function s4_update_link(url) {
  Copy(url);
}

function s4_update_csv() {
  // Save CSV
  //発送方法非表示20220927変更.csv
  saveDynamicDataToFile(s4_update_csv_csv, `発送方法非表示${changedate.value.split("-").join("")}変更.csv`);
}

function s4_update_text() {
  Copy(s4_update_text_msg);
}

function s4_next() {
  // TODO: prepare save_data

  // Show next step
  step4.classList.add("hidden");
  step5.classList.remove("hidden");
}

function s5_save() {
  // TODO: save save_data to database

  // Show next step
  step5.classList.add("hidden");
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