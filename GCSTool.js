/**********************************************
*
*                 VARIABLES
*
**********************************************/

var g_i = 1;

var types = {
	"te_":"templates",
	"ma_":"manual",
	"cc_":"ccontact",
	"as_":"assistant"
};

var categories = {
	"_account_related_":"アカウント関連",
	"_order_item_statuses_":"注文・商品の状況",
	"_order_modifying_":"注文編集",
	"_payment_shipping_":"決済・発送",
	"_after_service_shipping_":"配達サポート",
	"_after_service_defect_":"不良サポート",
	"_after_service_preowned_":"中古サポート",
	"_returns_refunds_":"返品・返金",
	"_claims_cases_":"クレーム・ケース",
	"_other_":"その他",
	"_work_related_":"仕事関連"
};
var categories_eng = {
	"_account_related_":"Account Related",
	"_order_item_statuses_":"Order/Item Statuses",
	"_order_modifying_":"Order Modifying",
	"_payment_shipping_":"Payment/Shipping",
	"_after_service_shipping_":"After Service Shipping",
	"_after_service_defect_":"After Service Defect",
	"_after_service_preowned_":"After Service Pre-owned",
	"_returns_refunds_":"Returns/Refunds",
	"_claims_cases_":"Claims/Cases",
	"_other_":"Other",
	"_work_related_":"Work Related"
};

var target_team = {
	"_case_assist_":"ケース対応",
	"_customer_dep_":"カスタマーサポート",
	"_logistics_dep_":"発送・ロジ課",
	"_feedback_":"フィードバック",
	"_other_":"その他"
};
var target_team_eng = {
	"_case_assist_":"Case assist",
	"_customer_dep_":"Customer Support",
	"_logistics_dep_":"Shippin Logistics",
	"_feedback_":"Feedback",
	"_other_":"Other"
};

var teams = {
	"ohami":"大網",
	"ohami_cs":"CS課",
	"ohami_global":"グローバル課",
	"ohami_global_support":"グローバル課（サポート）",
	"ohami_global_order":"グローバル課（注文管理）"
};

/*******
* JSON
*/

var json_data = {
	Settings: {
		user_id: "New User",
		i_language: "english",
		team: "ohami",
		style: "Style_dark.css",
		reminders: ""
	},
	Entries: []
};

var extMaster = "";
var extPersonal = "";

function ExistJSON(id) {
	for (var i = 0; i < json_data.Entries.length; i++) {
		if (json_data.Entries[i].uid.indexOf(id) == 0 && json_data.Entries[i].uid.length == id.length) {
			return i;
		}
	}
	return -1;
}

function UpdateJSONSettings() {
	json_data.Settings.user_id = document.getElementById('user_id').innerHTML;
	json_data.Settings.i_language = document.getElementById('interface_language').innerHTML;
	json_data.Settings.team = document.getElementById('user_team').innerHTML;
	json_data.Settings.style = document.getElementById('my_style').innerHTML;
	json_data.Settings.reminders = document.getElementById('my_reminders').innerHTML;
}

function SaveDataToJSON(save_uid, save_type, save_ismaster, save_lastupdate, save_category, save_team, save_authority, save_e_data, save_history) {
	var index = ExistJSON(save_uid);
	var s_version = 2;

	if(index >= 0) {
		// Update if existing
		json_data.Entries[index].uid = save_uid;
		json_data.Entries[index].version = s_version;
		json_data.Entries[index].type = save_type;
		json_data.Entries[index].ismaster = save_ismaster;
		json_data.Entries[index].lastupdate = save_lastupdate;
		json_data.Entries[index].category = save_category;
		json_data.Entries[index].team = save_team;
		json_data.Entries[index].authority = save_authority;
		json_data.Entries[index].data = save_e_data;
		json_data.Entries[index].history = save_history + "<br>" + json_data.Entries[index].history;
	}
	else {
		// Create new if not existing
		json_data.Entries.push({
			uid: save_uid,
			version: s_version,
			type: save_type,
			ismaster: save_ismaster,
			lastupdate: save_lastupdate,
			category: save_category,
			team: save_team,
			authority: save_authority,
			data: save_e_data,
			history: save_history
		});
	}
}

function DeleteUidFromJSON(del_uid) {
	var index = ExistJSON(del_uid);
	if(index >= 0) {
		json_data.Entries.splice(index, 1); 
	}
}

function LoadDataToJSON(load_uid, this_type) {
	var s_uid = load_uid;
	var s_version = 2;
	var s_type = this_type;
	var s_isMaster = false;
	var s_lastUpdate;
	var s_category;
	var s_team;
	var s_authority = 0;
	var s_e_data = { Title: "", Content: [] };
	var s_history = ": New entry";

	// Template
	if (this_type.indexOf("template") == 0 && this_type.length == "template".length) {
		// Get necesdsary data
		var datatostore = document.getElementById(load_uid);
		var t_title = datatostore.getElementsByClassName('data')[0].innerHTML.split('●英語●')[1];
		var t_set = document.getElementById(load_uid + '_settings').innerHTML.split('|');
		s_category = t_set[0];
		s_team = t_set[1];
		s_lastUpdate = t_set[2];
		s_history = s_lastUpdate + s_history;
		if (t_set[3].indexOf('master') == 0) { s_isMaster = true; }
		var t_cont = document.getElementById(load_uid + '_content').getElementsByTagName('textarea');
		if(typeof t_title === "undefined") {
			s_e_data.Title = datatostore.getElementsByClassName('data')[0].innerHTML.split('●日本語●')[1];
		}
		else {
			s_e_data.Title = t_title;
		}
		for (var ta = 0; ta < t_cont.length-1; ta++) {
			s_e_data.Content.push(t_cont[ta].value);
		}

		// Check if entry exists
		var exist_id = -1;
		for(var i = 0; i < json_data.Entries.length; i++) {
			if (json_data.Entries[i].uid.indexOf(s_uid) == 0 && json_data.Entries[i].uid.length == s_uid.length) {
				exist_id = i;
			}
		}

		// Ignore existing entries
		if(exist_id == -1) {
			// Add new
			json_data.Entries.push({
				uid: s_uid,
				version: s_version,
				type: s_type,
				ismaster: s_isMaster,
				lastupdate: s_lastUpdate,
				category: s_category,
				team: s_team,
				authority: s_authority,
				data: s_e_data,
				history: s_history
			});
		}
	}

	// Manual
	if (this_type.indexOf("manual") == 0 && this_type.length == "manual".length) {
		// Get necesdsary data
		var datatostore = document.getElementById(load_uid);
		var t_title = datatostore.getElementsByClassName('data')[0].innerHTML.split('●英語●')[1];
		var t_set = document.getElementById(load_uid + '_settings').innerHTML.split('|');
		s_category = t_set[0];
		s_team = t_set[1];
		s_lastUpdate = t_set[2];
		s_history = s_lastUpdate + s_history;
		if (t_set[3].indexOf('master') == 0) { s_isMaster = true; }
		var t_cont = datatostore.getElementsByClassName('data')[1].innerHTML.split('●英語●')[1];
		if (typeof t_title === "undefined") {
			s_e_data.Title = datatostore.getElementsByClassName('data')[0].innerHTML.split('●日本語●')[1];
		}
		else {
			s_e_data.Title = t_title;
		}
		s_e_data.Content.push(t_cont);

		// Check if entry exists
		var exist_id = -1;
		for (var i = 0; i < json_data.Entries.length; i++) {
			if (json_data.Entries[i].uid.indexOf(s_uid) == 0 && json_data.Entries[i].uid.length == s_uid.length) {
				exist_id = i;
			}
		}

		// Ignore existing entries
		if (exist_id == -1) {
			// Add new
			json_data.Entries.push({
				uid: s_uid,
				version: s_version,
				type: s_type,
				ismaster: s_isMaster,
				lastupdate: s_lastUpdate,
				category: s_category,
				team: s_team,
				authority: s_authority,
				data: s_e_data,
				history: s_history
			});
		}
	}

	// Ccontact
	if (this_type.indexOf("ccontact") == 0 && this_type.length == "ccontact".length) {
		// Get necesdsary data
		var datatostore = document.getElementById(load_uid);
		var t_title = datatostore.getElementsByClassName('data')[0].innerHTML.split('●英語●')[1];
		var t_set = document.getElementById(load_uid + '_settings').innerHTML.split('|');
		s_category = t_set[0];
		s_team = t_set[1];
		s_lastUpdate = t_set[2];
		s_history = s_lastUpdate + s_history;
		if (t_set[3].indexOf('master') == 0) { s_isMaster = true; }
		var t_cont = document.getElementById(load_uid + '_content').getElementsByTagName('textarea')[0].value;
		if (typeof t_title === "undefined") {
			s_e_data.Title = datatostore.getElementsByClassName('data')[0].innerHTML.split('●日本語●')[1];
		}
		else {
			s_e_data.Title = t_title;
		}
		s_e_data.Content.push(t_cont);

		// Check if entry exists
		var exist_id = -1;
		for (var i = 0; i < json_data.Entries.length; i++) {
			if (json_data.Entries[i].uid.indexOf(s_uid) == 0 && json_data.Entries[i].uid.length == s_uid.length) {
				exist_id = i;
			}
		}

		// Ignore existing entries
		if (exist_id == -1) {
			// Add new
			json_data.Entries.push({
				uid: s_uid,
				version: s_version,
				type: s_type,
				ismaster: s_isMaster,
				lastupdate: s_lastUpdate,
				category: s_category,
				team: s_team,
				authority: s_authority,
				data: s_e_data,
				history: s_history
			});
		}
	}
}

/*******
 * Entry
 * 
 *  uid         (unique ID)
 *  version     (version)
 *  type        (template, manual...)
 *  ismaster    (true, false)
 *  lastupdate  (last updated)
 *  category    ()
 *  team        ()
 *  authority   (- only down, 0 down and up, + only up)
 *  data
 *   Title
 *   Content    (list of data entries)
 *  history
 * 
 */

/**********************************************
*
*                 INTERFACE
*
**********************************************/

// Check that script has been loaded
function CheckScriptEnabled() {
	document.getElementById("scriptenabled").style.display = "none";
	
	// Remove for IE compability
	includeHTML();

	// Personal data
	document.getElementById("input_personal").value = localStorage.getItem("input_personal");

	// Set style
	if (document.getElementById("input_personal").value.indexOf("Style_dark.css") >= 0) {
		document.getElementById("color_mode").value = "Style_dark.css";
	}

	// Set interface language
	if (document.getElementById("input_personal").value.indexOf("interface_language\">●英語●") >= 0) {
		document.getElementById("lg_language").value = "english";
	}
	else if (document.getElementById("input_personal").value.indexOf("interface_language\">english") >= 0) {
		document.getElementById("lg_language").value = "english";
	}
	else if (document.getElementById("input_personal").value.indexOf("interface_language\">swedish") >= 0) {
		document.getElementById("lg_language").value = "swedish";
	}
	else {
		document.getElementById("lg_language").value = "japanese";
	}

	// Load JSON Personal data if existing
	if (localStorage.hasOwnProperty("json_personal") == true) {
		extPersonal = JSON.parse(localStorage.getItem("json_personal"));

		document.getElementById("color_mode").value = extPersonal.Settings.style;
		document.getElementById("lg_language").value = extPersonal.Settings.i_language;
	}
	
	// Update interface to correct language
	UpdateLanguage('lg_language');
}

// Do some initial setup
function Setup() {
	// Setup category select on search pages
	var output = " ";
	for(var key in categories) {
		if(document.getElementById("templates").innerHTML.indexOf(key) >= 0) {
			output += '<span class="category ' + key + '"><input type="checkbox" id="te_' + key + '_check" value="' + key + '" onclick="ApplySearchParameters(\'te_\')">' + GenerateInterfaceText("●英語●" + categories_eng[key] + "●英語●●日本語●" + categories[key] + "●日本語●") + '</span> ';
		}
	}
	document.getElementById("te_categories_check").innerHTML += output;
	
	output = " ";
	for(var key in categories) {
		if(document.getElementById("manual").innerHTML.indexOf(key) >= 0) {
			output += '<span class="category ' + key + '"><input type="checkbox" id="ma_' + key + '_check" value="' + key + '" onclick="ApplySearchParameters(\'ma_\')">' + GenerateInterfaceText("●英語●" + categories_eng[key] + "●英語●●日本語●" + categories[key] + "●日本語●") + '</span> ';
		}
	}
	document.getElementById("ma_categories_check").innerHTML += output;
	
	output = " ";
	for(var key in target_team) {
		if(document.getElementById("ccontact").innerHTML.indexOf(key) >= 0) {
			output += '<span class="category ' + key + '"><input type="checkbox" id="cc_' + key + '_check" value="' + key + '" onclick="ApplySearchParameters(\'cc_\')">' + GenerateInterfaceText("●英語●" + target_team_eng[key] + "●英語●●日本語●" + target_team[key] + "●日本語●") + '</span> ';
		}
	}
	document.getElementById("cc_categories_check").innerHTML += output;
	
	output = " ";
	for(var key in categories) {
		if(document.getElementById("assistant").innerHTML.indexOf(key) >= 0) {
			output += '<span class="category ' + key + '"><input type="checkbox" id="as_' + key + '_check" value="' + key + '" onclick="ApplySearchParameters(\'as_\')">' + GenerateInterfaceText("●英語●" + categories_eng[key] + "●英語●●日本語●" + categories[key] + "●日本語●") + '</span> ';
		}
	}
	document.getElementById("as_categories_check").innerHTML += output;
	
	// Settings for edit layout
	// Set category
	output = '<div id="n_cat"><select id="category_select">';
	for(var key in categories) { output += '<option value="' + key + '">' + categories_eng[key] + "/" + categories[key] + '</option>'; }
	for(var key in target_team) { output += '<option value="' + key + '">' + target_team_eng[key] + "/" + target_team[key] + '</option>'; }
	output += '</select></div>';
	document.getElementById("category").innerHTML = output;
	
	// Set team
	output = '<select id="team_select">';
	for(var key in teams) { output += '<option value="' + key + '">' + teams[key] + '</option>'; }
	output += '</select>';
	document.getElementById("team").innerHTML = output;
	
	// Reminders
	SetReminderFunction("16:59", "ShowDocuments()");
	
	// Setup Interface
	SetupInterface();
}

// Desktop popup
function notifyMe(message) {}
/*	return;//Disable popups (Does not work in IE, Does not work in Chrome when run localy)

if(Notification.permission !== "granted") {
	//		Notification.requestPermission();
}
else {
	var notification = new Notification(
		'Notification',
		{
			icon: 'images/Note_icon.png',
			body: message
		}
		);
		
		/*    notification.onclick = function () {
			window.open("http://stackoverflow.com/a/13328397/1269037");      
		};
	}
}*/

var t_cnt = 0;
var m_cnt = 0;
var c_cnt = 0;
var a_cnt = 0;
// Capture Ctrl+F
window.onkeydown = function(e){
	// Ctrl + Q  [Continue previous search]
	if(e.keyCode == 81 && e.ctrlKey){
		TabHandler("ru_", 1);
		document.getElementById("all_inputfield").focus();
	}
	
	// Ctrl + Space  [New empty search]
	if(e.keyCode == 32 && e.ctrlKey){
		Clear("all_");
		TabHandler("ru_", 1);
		document.getElementById("all_inputfield").focus();
		setTimeout("Empty('all_')", 100); // Clear the space that is added to the input box
	}
	/*
	// T counter: 3 times and go to template layout
	if(e.keyCode == 84) {
		t_cnt += 1;
		if(t_cnt >= 3) {
			t_cnt = 0;
			Clear("te_");
			TabHandler("ru_", 2);
			document.getElementById("te_inputfield").focus();
			setTimeout("Empty('te_')", 100); // Clear the space that is added to the input box
		}
	}
	else {
		t_cnt = 0;
	}
	
	// M counter: 3 times and go to manual layout
	if(e.keyCode == 77) {
		m_cnt += 1;
		if(m_cnt >= 3) {
			m_cnt = 0;
			Clear("ma_");
			TabHandler("ru_", 3);
			document.getElementById("ma_inputfield").focus();
			setTimeout("Empty('ma_')", 100); // Clear the space that is added to the input box
		}
	}
	else {
		m_cnt = 0;
	}
	
	// C counter: 3 times and go to company contact layout
	if(e.keyCode == 67) {
		c_cnt += 1;
		if(c_cnt >= 3) {
			c_cnt = 0;
			Clear("cc_");
			TabHandler("ru_", 4);
			document.getElementById("cc_inputfield").focus();
			setTimeout("Empty('cc_')", 100); // Clear the space that is added to the input box
		}
	}
	else {
		c_cnt = 0;
	}
	
	// A counter: 3 times and go to assist layout
	if(e.keyCode == 65) {
		a_cnt += 1;
		if(a_cnt >= 3) {
			a_cnt = 0;
			Clear("as_");
			TabHandler("ru_", 5);
			document.getElementById("as_inputfield").focus();
			setTimeout("Empty('as_')", 100); // Clear the space that is added to the input box
		}
	}
	else {
		a_cnt = 0;
	}*/
}

function Empty(input) {
	var ctext = document.getElementById(input + "inputfield").value;
	document.getElementById(input + "inputfield").value = ctext.slice(1);
}

// TabHandler
function TabHandler(prefix, id) {
	var v_id = parseInt(id);
	var v_total = parseInt(document.getElementById(prefix + "tabcnt").innerHTML);
	var cnt = 1;
	
	while(cnt <= v_total) {
		if(cnt == v_id) {
			document.getElementById(prefix + cnt + "_" + v_total).style.display = "block";
			document.getElementById(prefix + cnt + "_btn").style.color = "yellow";
		}
		else {
			document.getElementById(prefix + cnt + "_" + v_total).style.display = "none";
			document.getElementById(prefix + cnt + "_btn").style.color = "white";
		}
		
		cnt = cnt + 1;
	}
	
	// Hide edit bar in all layouts beside the edit layout
	if(v_id != 6) {
		ShowEditBar(-1);
	}
	else {
		if(document.getElementById("type").innerHTML.length > 0) {
			if(document.getElementById("type").innerHTML.indexOf("Template") >= 0) {
				ShowEditBar(0);
			}
			else if(document.getElementById("type").innerHTML.indexOf("Manual") >= 0) {
				ShowEditBar(1);
			}
			else if(document.getElementById("type").innerHTML.indexOf("Company Contact") >= 0) {
				ShowEditBar(0);
			}
			else if(document.getElementById("type").innerHTML.indexOf("Assistant") >= 0) {
				ShowEditBar(2);
			}
		}
	}
	
	// Focus search box
	if(v_id == 1) {
		document.getElementById("all_inputfield").focus();
	}
	else if(v_id == 2) {
		document.getElementById("te_inputfield").focus();
	}
	else if(v_id == 3) {
		document.getElementById("ma_inputfield").focus();
	}
	else if(v_id == 4) {
		document.getElementById("cc_inputfield").focus();
	}
	else if(v_id == 5) {
		document.getElementById("as_inputfield").focus();
	}
}

function SaveTab(tab_id) {
	if(tab_id == 0) {
		document.getElementById("private_tab").style.display = "block";
		document.getElementById("share_tab").style.display = "none";
		document.getElementById("master_tab").style.display = "none";
	}
	if(tab_id == 1) {
		document.getElementById("private_tab").style.display = "none";
		document.getElementById("share_tab").style.display = "block";
		document.getElementById("master_tab").style.display = "none";
	}
	if(tab_id == 2) {
		document.getElementById("private_tab").style.display = "none";
		document.getElementById("share_tab").style.display = "none";
		document.getElementById("master_tab").style.display = "block";
	}
}

// Adjusted to json
function LoadShareData() {
	// Setup basic variables
	var entries = JSON.parse(document.getElementById("save_out").value);
	var num_entries = entries.Entries.length;
	document.getElementById("counter").innerHTML = "0";
	document.getElementById("left_to_check").innerHTML = "1/" + num_entries;
	
	// Stop if no data
	if(num_entries <= 0) {
		return;
	}
	
	// Load first entry
	document.getElementById("current_master").innerHTML = "";
	var true_id = entries.Entries[0].uid;
	if (true_id.indexOf("_COPY") >= 0) {
		true_id = true_id.slice(0, -5);
		var j_index = ExistJSON(true_id);
		if (j_index >= 0) {
			if(json_data.Entries[j_index].type.indexOf("manual") >= 0) {
				for (var cnt = 0; cnt < json_data.Entries[j_index].data.Content.length; cnt++) {
					document.getElementById("current_master").innerHTML = '<div class="entry">' + json_data.Entries[j_index].data.Content[cnt] + '</div>';
				}				
			}
			else {
				for (var cnt = 0; cnt < json_data.Entries[j_index].data.Content.length; cnt++) {
					document.getElementById("current_master").innerHTML = '<textarea>' + json_data.Entries[j_index].data.Content[cnt] + '</textarea>';
				}
			}
		}
	}

	if (entries.Entries[0].type.indexOf("manual") >= 0) {
		for (var cnt = 0; cnt < entries.Entries[0].data.Content.length; cnt++) {
			document.getElementById("current_master").innerHTML = '<div class="entry">' + entries.Entries[0].data.Content[cnt] + '</div>';
		}
	}
	else {
		for (var cnt = 0; cnt < entries.Entries[0].data.Content.length; cnt++) {
			document.getElementById("current_master").innerHTML = '<textarea>' + entries.Entries[0].data.Content[cnt] + '</textarea>';
		}
	}
	
	// Show Approve layout
	document.getElementById("run").style.display = "none";
	document.getElementById("menubar").style.display = "none";
	document.getElementById("approve").style.display = "block";
}

/*
String.prototype.replaceAll = function(search, replacement) {
	var target = this;
	return target.replace(new RegExp(search, 'g'), replacement);
};
*/

// Adjusted to json
function Approve(type) {
	// Add to current data
	
	// Get data
	var cnt = parseInt(document.getElementById("counter").innerHTML);
	var entries = JSON.parse(document.getElementById("save_out").value);

	var isMaster = false;
	if (type == 1) { isMaster = true; }
	
	// Save
	SaveDataToJSON(
		entries.Entries[cnt].uid,
		entries.Entries[cnt].type,
		isMaster,
		entries.Entries[cnt].lastupdate,
		entries.Entries[cnt].category,
		entries.Entries[cnt].team,
		entries.Entries[cnt].authority,
		entries.Entries[cnt].data,
		entries.Entries[cnt].history
	);
	
	// Go to next
	Next();
}

function Reject() {
	// Go to next
	Next();
}

// Adjusted to json
function Next() {
	var cnt = 1 + parseInt(document.getElementById("counter").innerHTML);
	document.getElementById("counter").innerHTML = cnt;
	
	// Setup basic variables
	var entries = JSON.parse(document.getElementById("save_out").value);
	var num_entries = entries.Entries.length;
	document.getElementById("left_to_check").innerHTML = (1+cnt) + "/" + num_entries;
	
	// Stop if no data
	if(num_entries <= 0) {
		return;
	}
	
	if(cnt < num_entries) {
		// Load *cnt* entry
		document.getElementById("current_master").innerHTML = "";
		var true_id = entries.Entries[cnt].uid;
		if (true_id.indexOf("_COPY") >= 0) {
			true_id = true_id.slice(0, -5);
			var j_index = ExistJSON(true_id);
			if (j_index >= 0) {
				if (json_data.Entries[j_index].type.indexOf("manual") >= 0) {
					for (var c = 0; c < json_data.Entries[j_index].data.Content.length; c++) {
						document.getElementById("current_master").innerHTML = '<div class="entry">' + json_data.Entries[j_index].data.Content[c] + '</div>';
					}
				}
				else {
					for (var c = 0; c < json_data.Entries[j_index].data.Content.length; c++) {
						document.getElementById("current_master").innerHTML = '<textarea>' + json_data.Entries[j_index].data.Content[c] + '</textarea>';
					}
				}
			}
		}

		if (entries.Entries[0].type.indexOf("manual") >= 0) {
			for (var c = 0; c < entries.Entries[cnt].data.Content.length; c++) {
				document.getElementById("current_master").innerHTML = '<div class="entry">' + entries.Entries[cnt].data.Content[c] + '</div>';
			}
		}
		else {
			for (var c = 0; c < entries.Entries[cnt].data.Content.length; c++) {
				document.getElementById("current_master").innerHTML = '<textarea>' + entries.Entries[cnt].data.Content[c] + '</textarea>';
			}
		}
	}
	else {
		Back();
	}
}

function Back() {
	document.getElementById("run").style.display = "block";
	document.getElementById("menubar").style.display = "block";
	document.getElementById("approve").style.display = "none";
}

function ShowEditBar(id) {
	document.getElementById("editbar_text").style.display = "none";
	document.getElementById("editbar_html").style.display = "none";
	document.getElementById("editbar_assist").style.display = "none";
	
	if(id == 0) {
		document.getElementById("editbar_text").style.display = "block";
	}
	if(id == 1) {
		document.getElementById("editbar_html").style.display = "block";
	}
	if(id == 2) {
		document.getElementById("editbar_assist").style.display = "block";
	}
}

// Update interface language, if selected language is not available, then select language based on priority languages
function ChangeLanguage(new_language) {
	// Stop if the language is already set correctly
	if(document.getElementById("interface_language").innerHTML.indexOf(new_language) == 0) {
		return;
	}
	document.getElementById("interface_language").innerHTML = new_language;
	
	// Get all multi language elements
	var multi_language = document.getElementsByClassName("multi_language");
	// Get language priority
	var language_priority = (new_language + "|" + document.getElementById("content_language").innerHTML).split("|");
	
	// Loop through all elements to update
	var i = 0;
	while(i < multi_language.length) {
		var contents = multi_language[i].getElementsByTagName("SPAN");
		
		var j = 0;
		var updated = 0;
		while(j < language_priority.length && updated == 0) {
			if(contents[1].innerHTML.indexOf(language_priority[j]) >= 0) {
				contents[0].innerHTML = contents[1].innerHTML.split(language_priority[j])[1];
				updated = 1;
			}
			
			j = j + 1;
		}
		
		i = i + 1;
	}
}
function SetDefaultLanguage() {
	// Get all multi language elements
	var multi_language = document.getElementsByClassName("multi_language");
	// Get language priority
	var language_priority = (document.getElementById("interface_language").innerHTML + "|" + document.getElementById("content_language").innerHTML).split("|");
	
	// Loop through all elements to update
	var i = 0;
	while(i < multi_language.length) {
		var contents = multi_language[i].getElementsByTagName("SPAN");
		
		var j = 0;
		var updated = 0;
		while(j < language_priority.length && updated == 0) {
			if(contents[1].innerHTML.indexOf(language_priority[j]) >= 0) {
				contents[0].innerHTML = contents[1].innerHTML.split(language_priority[j])[1];
				updated = 1;
			}
			
			j = j + 1;
		}
		
		i = i + 1;
	}
}

// Search field Add/Clear
function Add(prefix) {
	document.getElementById(prefix + "inputfield").value += "\n";
	ProcessTextInput(prefix);
}
function Clear(prefix) {
	document.getElementById(prefix + "inputfield").value += "-";
	ClearCheckBoxes(prefix);
	ProcessTextInput(prefix);
}
function ClearOne(prefix) {
	var all_text = document.getElementById(prefix + "stext").innerHTML.split(",");
	document.getElementById(prefix + "stext").innerHTML = "";
	var i = 0;
	while(i < all_text.length-1) {
		if(document.getElementById(prefix + "stext").innerHTML.length > 0) {
			document.getElementById(prefix + "stext").innerHTML += ",";
		}
		document.getElementById(prefix + "stext").innerHTML += all_text[i];
		i = i + 1;
	}
	
	ApplySearchParameters(prefix);
}
function ClearCheckBoxes(prefix) {
	if(prefix.indexOf("all_") == 0) {
		// Do nothing...
	}
	else if(prefix.indexOf("te_") == 0) {
		for(key in categories) {
			if(document.getElementById("templates").innerHTML.indexOf(key) >= 0) {
				document.getElementById(prefix + key + "_check").checked = false;
			}
		}
	}
	else if(prefix.indexOf("ma_") == 0) {
		for(key in categories) {
			if(document.getElementById("manual").innerHTML.indexOf(key) >= 0) {
				document.getElementById(prefix + key + "_check").checked = false;
			}
		}
	}
	else if(prefix.indexOf("cc_") == 0) {
		for(key in target_team) {
			if(document.getElementById("ccontact").innerHTML.indexOf(key) >= 0) {
				document.getElementById(prefix + key + "_check").checked = false;
			}
		}
	}
	else {
		for(key in categories) {
			if(document.getElementById("assistant").innerHTML.indexOf(key) >= 0) {
				document.getElementById(prefix + key + "_check").checked = false;
			}
		}
	}
}

// Template Show/Hide
function ShowTemplate(id) {
	if(document.getElementById("own_comments").innerHTML.indexOf(id) > 0) {
		document.getElementById(id + "_comment_input").value = document.getElementById(id + "_comment").innerHTML;
	}
	
	if(document.getElementById(id + "_var2").innerHTML.indexOf("0") == 0) {
		document.getElementById(id + "_content").style.display = "block";
		document.getElementById(id + "_var2").innerHTML = "1";
		
		// Scale up size of text box to fit the text
		var all_t_area = document.getElementById(id + "_content").getElementsByTagName("TEXTAREA");
		var ata = 0;
		while(ata < all_t_area.length) {
			auto_grow(all_t_area[ata]);
			ata += 1;
		}
	}
	else {
		document.getElementById(id + "_content").style.display = "none";
		document.getElementById(id + "_var2").innerHTML = "0";
	}
}
function HideTemplate(id) {
	document.getElementById(id + "_content").style.display = "none";
	document.getElementById(id + "_var2").innerHTML = "0";
}

function Selector(this_element) {
	this_element.select();
	document.execCommand("copy");

	this_element.parentElement.innerHTML += '<div id="test" class="w3-animate-opacity"><b>COPY</b></div>';
	setTimeout(DeleteCOPY, 1000);
}
function DeleteCOPY() {
	var element = document.getElementById("test");
	element.parentElement.removeChild(element);
}

function auto_grow(element) {
	element.style.height = "5px";
	element.style.height = (element.scrollHeight)+"px";
}

// Process text input
function ProcessTextInput(prefix) {
	// Get new input
	var inputValue = document.getElementById(prefix + "inputfield").value;
	var lines = inputValue.split(/\r\n|\r|\n/g);
	
	// When copy pasting long text break
	if(lines.length > 2) {
		return;
	}
	
	// Clear/Return if line 1 is empty
	if(lines[0].length == 0) {
		document.getElementById(prefix + "inputfield").value = "";
		return;
	}
	
	// Check tags
	var i = 0;
	var tags = document.getElementsByClassName("tag");
	var taginput = lines[0];
	var tagkey = false;
	var spacekey = false;
	if(lines.length > 1) {
		tagkey = true;
	}
	document.getElementById(prefix + "tags").innerHTML = "";
	while(i < tags.length) {
		// Check tag
		var tagdata = tags[i].innerHTML.split("|");
		if(tagdata[0].indexOf(taginput) == 0 && tagdata[0].length == taginput.length) {
			if(document.getElementById(prefix + "tags").innerHTML.length > 0) {
				document.getElementById(prefix + "tags").innerHTML += "/";
			}
			document.getElementById(prefix + "tags").innerHTML += tagdata[1];
		}
		
		i = i + 1;
	}
	if(tagkey == true) {
		if(document.getElementById(prefix + "tags").innerHTML.length > 0) {
			if(document.getElementById(prefix + "stext").innerHTML.length > 0) {
				document.getElementById(prefix + "stext").innerHTML += ",";
			}
			document.getElementById(prefix + "stext").innerHTML += document.getElementById(prefix + "tags").innerHTML.toLowerCase();
			document.getElementById(prefix + "inputfield").value = "";
			document.getElementById(prefix + "tags").innerHTML = "";
			ApplySearchParameters(prefix);
		}
		else {
			spacekey = true;
		}
	}
	
	// If no tags were specified, do a word search instead
	if(spacekey) {
		if(document.getElementById(prefix + "stext").innerHTML.length > 0) {
			document.getElementById(prefix + "stext").innerHTML += ",";
		}
		document.getElementById(prefix + "stext").innerHTML += lines[0].toLowerCase();
		document.getElementById(prefix + "inputfield").value = "";
		document.getElementById(prefix + "tags").innerHTML = "";
		ApplySearchParameters(prefix);
	}
	
	// Check for "-" input
	if(inputValue[inputValue.length-1] == "-") {
		document.getElementById(prefix + "stext").innerHTML  = "";
		document.getElementById(prefix + "inputfield").value = "";
		document.getElementById(prefix + "tags").innerHTML = "";
		ApplySearchParameters(prefix);
	}
}

// Apply search parameters
function ApplySearchParameters(prefix) {
	// Get all search words
	var words = document.getElementById(prefix + "stext").innerHTML.split(",");
	
	// Add categories
	var i = 0;
	var c_search = "";
	if(prefix.indexOf("all_") == 0) {
		// Do nothing...
	}
	else if(prefix.indexOf("te_") == 0) {
		for(key in categories) {
			if(document.getElementById("templates").innerHTML.indexOf(key) >= 0) {
				if(document.getElementById(prefix + key + "_check").checked == true) {
					if(c_search.length > 0) {
						c_search += "/";
					}
					c_search += key;
				}
			}
		}
	}
	else if(prefix.indexOf("ma_") == 0) {
		for(key in categories) {
			if(document.getElementById("manual").innerHTML.indexOf(key) >= 0) {
				if(document.getElementById(prefix + key + "_check").checked == true) {
					if(c_search.length > 0) {
						c_search += "/";
					}
					c_search += key;
				}
			}
		}
	}
	else if(prefix.indexOf("cc_") == 0) {
		for(key in target_team) {
			if(document.getElementById("ccontact").innerHTML.indexOf(key) >= 0) {
				if(document.getElementById(prefix + key + "_check").checked == true) {
					if(c_search.length > 0) {
						c_search += "/";
					}
					c_search += key;
				}
			}
		}
	}
	else {
		for(key in categories) {
			if(document.getElementById("assistant").innerHTML.indexOf(key) >= 0) {
				if(document.getElementById(prefix + key + "_check").checked == true) {
					if(c_search.length > 0) {
						c_search += "/";
					}
					c_search += key;
				}
			}
		}
	}
	if(c_search.length > 0) {
		words.push(c_search);
	}
	
	// Get all templates
	var entries;
	if(prefix.indexOf("te_") == 0) {
		entries = document.getElementById("templates").getElementsByClassName("entry");
	}
	else if(prefix.indexOf("ma_") == 0) {
		entries = document.getElementById("manual").getElementsByClassName("entry");
	}
	else if(prefix.indexOf("cc_") == 0) {
		entries = document.getElementById("ccontact").getElementsByClassName("entry");
	}
	else if(prefix.indexOf("as_") == 0) {
		entries = document.getElementById("assistant").getElementsByClassName("entry");
	}
	else if(prefix.indexOf("all_") == 0) {
		// Search for all entries
		entries = new Array();
		entries.push(document.getElementById("templates").getElementsByClassName("entry"));
		entries.push(document.getElementById("manual").getElementsByClassName("entry"));
		entries.push(document.getElementById("ccontact").getElementsByClassName("entry"));
		entries.push(document.getElementById("assistant").getElementsByClassName("entry"));
	}
	
	if(prefix.indexOf("all_") == -1) {
		ShowHideSearch(words, entries);
	}
	else {
		//FindLinkSearch(words, entries);
		ExpSearch();
	}
}

function ShowHideSearch(words, entries) {
	// Apply search parameters
	var i = 0;
	while(i < entries.length) {
		var myID = entries[i].id;
		
		// Show and colapse template by default
		entries[i].style.display = "block";
		HideTemplate(myID);
		
		// Word search (hide all entries that not include all search words)
		var k = 0;
		while(k < words.length) {
			if(words[k].indexOf("/") >= 0) {
				// Multi word search ("OR search")
				var multiwords = words[k].split("/");
				var found = false;
				var h = 0;
				while(h < multiwords.length) {
					if(document.getElementById(myID).innerHTML.toLowerCase().indexOf(multiwords[h].toLowerCase()) >= 0) {
						found = true;
					}
					
					h = h + 1;
				}
				if(found == false) {
					entries[i].style.display = "none";
				}
			}
			else {
				// One word search
				if(document.getElementById(myID).innerHTML.toLowerCase().indexOf(words[k].toLowerCase()) == -1) {
					entries[i].style.display = "none";
				}
			}
			
			k = k + 1;
		}
		
		i = i + 1;
	}
}

function News() {// JSON version
	document.getElementById("s_result").innerHTML = "";
	var d = new Date();
	var d2 = new Date(d.getFullYear(), d.getMonth() - 1, d.getDate());
	var d3 = new Date(d.getFullYear(), d.getMonth(), d.getDate() - 3);
	var d_str = ((((d.getFullYear() * 100) + (d.getMonth() + 1)) * 100) + d.getDate()).toString();
	var d2_str = ((((d2.getFullYear() * 100) + (d2.getMonth() + 1)) * 100) + d2.getDate()).toString();
	var d3_str = ((((d3.getFullYear() * 100) + (d3.getMonth() + 1)) * 100) + d3.getDate()).toString();
	var newest = d_str;
	var next_newest = "99999999";
	var max_results = 50;
	while (max_results > 0 && next_newest.indexOf("00000000") == -1) {
		next_newest = "00000000";
		var first = true;
		for (var i = 0; i < json_data.Entries.length && max_results > 0; i++) {
			var myID = json_data.Entries[i].uid;
			var tdat = json_data.Entries[i].lastupdate;
			if (CDate(newest, tdat) == 0) {
				if (first == true) {
					var d_string = newest.slice(0, 4) + " / " + newest.slice(4, 6) + " / " + newest.slice(6);
					var new_label = "";
					if (CDate(d3_str, newest) < 0) {
						new_label = "<span style=\"color:#FFD700;\"><big>★★NEW★★</big></span>";
					}
					else if (CDate(d2_str, newest) < 0) {
						new_label = "<span style=\"color:Red;\">★NEW★</span>";
					}
					document.getElementById("s_result").innerHTML += "<h2>" + d_string + new_label + "</h2>";
					first = false;
				}
				var class_name = json_data.Entries[i].type;
				var text_input = json_data.Entries[i].type;
				var u = 0;

				if (class_name.indexOf('manual') == 0) {
					u = 1;
				}
				if (class_name.indexOf('ccontact') == 0) {
					u = 2;
				}

				var output = "<div class=\"entry " + class_name + "\"><button class=\"title_button " + json_data.Entries[i].category + "\" onclick=\"DisplayEntry('" + myID + "')\">" + json_data.Entries[i].data.Title + "</button>";

				// Type of entry
				output += "<i class=\"label\">" + text_input + "</i>";

				// Master / Private
				if (json_data.Entries[i].ismaster == true) {
					output += "<i class=\"label master" + "\" style=\"float:right;\">Master</i>";
				}
				else {
					output += "<i class=\"label private" + "\" style=\"float:right;\">Private</i>";
				}

				output += '<br><div id="c_' + myID + '" style="display:none;">';
				output += '<button onclick="EditEntry(' + i + ')">Edit</button><br>';
				for (var cd = 0; cd < json_data.Entries[i].data.Content.length; cd++) {
					if (json_data.Entries[i].type.indexOf('manual') == 0) {
						output += json_data.Entries[i].data.Content[cd];
					}
					else {
						output += '<textarea style="width: 100%; height: 135px;" onclick="Selector(this)" readonly>' + json_data.Entries[i].data.Content[cd] + '</textarea>';
					}
				}
				
				output += '</div>';

				output += "</div>";

				document.getElementById("s_result").innerHTML += output;

				max_results -= 1;
				if (max_results <= 0) {
					document.getElementById("s_result").innerHTML += "<div class=\"entry_c\"><b style=\"color:red;background-color:black;\">Max results reached, please add more keywords to the search</b></div>"
					return;
				}
			}
			else if (CDate(newest, tdat) == 1) {
				if (CDate(tdat, next_newest) == 1) {
					next_newest = tdat;
				}
			}
		}
		newest = next_newest;
	}
}
// Return: -1 (date1 is first), 0 (same date), 1 (date 2 is first)
//CDate(d1, d2)

function ExpSearch() {
	document.getElementById("s_result").innerHTML = "";
	var types_to_check = "";
	if (document.getElementById('exp_template').checked == true) {
		types_to_check += 'template';
	}
	if (document.getElementById('exp_manual').checked == true) {
		types_to_check += 'manual';
	}
	if (document.getElementById('exp_ccontact').checked == true) {
		types_to_check += 'ccontact';
	}

	// Get all search words
	var words = document.getElementById("all_stext").innerHTML.split(",");

	var u;
	var max_results = 50;
	for (u = 0; u < json_data.Entries.length; u++) {
		var myID = json_data.Entries[u].uid;

		// Word search
		var k = 0;
		var found = true;
		while (k < words.length) {
			if (words[k].indexOf("/") >= 0) {
				// Multi word search ("OR search")
				var multiwords = words[k].split("/");
				var sub_find = false;
				var h = 0;
				while (h < multiwords.length) {
					if (json_data.Entries[u].data.Title.toLowerCase().indexOf(multiwords[h].toLowerCase()) >= 0) {
						sub_find = true;
					}
					if (json_data.Entries[u].data.Content[0].toLowerCase().indexOf(multiwords[h].toLowerCase()) >= 0) {
						sub_find = true;
					}

					h = h + 1;
				}
				if (sub_find == false) {
					found = false;
				}
			}
			else {
				// One word search
				if (json_data.Entries[u].data.Title.toLowerCase().indexOf(words[k].toLowerCase()) == -1 &&
					json_data.Entries[u].data.Content[0].toLowerCase().indexOf(words[k].toLowerCase()) == -1) {
					found = false;
				}
			}

			k = k + 1;
		}
		if (found == true && types_to_check.indexOf(json_data.Entries[u].type) >= 0) {
			var class_name = json_data.Entries[u].type;
			var text_input = json_data.Entries[u].type;

			var output = "<div class=\"entry " + class_name + "\"><button class=\"title_button " + json_data.Entries[u].category + "\" onclick=\"DisplayEntry('" + myID + "')\">" + json_data.Entries[u].data.Title + "</button>";

			// Type of entry
			output += "<i class=\"label\">" + text_input + "</i>";

			// Master / Private
			if (json_data.Entries[u].ismaster) {
				output += "<i class=\"label master" + "\" style=\"float:right;\">Master</i>";
			}
			else {
				output += "<i class=\"label private" + "\" style=\"float:right;\">Private</i>";
			}

			output += '<br><div id="c_' + myID + '" style="display:none;">';
			output += '<button onclick="EditEntry(' + u + ')">Edit</button><br>';
			for (var cd = 0; cd < json_data.Entries[u].data.Content.length; cd++) {
				if (json_data.Entries[u].type.indexOf('manual') == 0) {
					output += json_data.Entries[u].data.Content[cd];
				}
				else {
					output += '<textarea style="width: 100%; height: 135px;" onclick="Selector(this)" readonly>' + json_data.Entries[u].data.Content[cd] + '</textarea>';
				}
			}
			
			output += '</div>';

			output += "</div>";

			document.getElementById("s_result").innerHTML += output;

			max_results -= 1;
			if (max_results <= 0) {
				document.getElementById("s_result").innerHTML += "<div class=\"entry\"><b style=\"color:red;background-color:black;\">Max results reached, please add more keywords to the search</b></div>"
				return;
			}
		}
	}
}

function DisplayEntry(uid) {
	if(document.getElementById('c_' + uid).style.display.indexOf('none') == 0) {
		document.getElementById('c_' + uid).style.display = 'block';

		// Scale up size of text box to fit the text
		var all_t_area = document.getElementById('c_' + uid).getElementsByTagName("TEXTAREA");
		var ata = 0;
		while (ata < all_t_area.length) {
			auto_grow(all_t_area[ata]);
			ata += 1;
		}
	}
	else {
		document.getElementById('c_' + uid).style.display = 'none';
	}
}

function FindLinkSearch(words, entries) {
	// Empty previous search
	document.getElementById("s_result").innerHTML = "";
	
	var u;
	var v;
	var max_results = 50;
	for(u = 0; u < entries.length; u++) {
		for(v = 0; v < entries[u].length; v++) {
			var myID = entries[u][v].id;
			
			// Word search
			var k = 0;
			var found = true;
			while(k < words.length) {
				if(words[k].indexOf("/") >= 0) {
					// Multi word search ("OR search")
					var multiwords = words[k].split("/");
					var sub_find = false;
					var h = 0;
					while(h < multiwords.length) {
						if(document.getElementById(myID).innerHTML.toLowerCase().indexOf(multiwords[h].toLowerCase()) >= 0) {
							sub_find = true;
						}
						
						h = h + 1;
					}
					if(sub_find == false) {
						found = false;
					}
				}
				else {
					// One word search
					if(document.getElementById(myID).innerHTML.toLowerCase().indexOf(words[k].toLowerCase()) == -1) {
						found = false;
					}
				}
				
				k = k + 1;
			}
			if(found == true) {
				var class_name;
				var text_input;
				
				if(u == 0) {
					class_name = "template";
					text_input = GenerateInterfaceText("●英語●Template●英語●●日本語●テンプレート●日本語●");
				}
				if(u == 1) {
					class_name = "manual";
					text_input = GenerateInterfaceText("●英語●Manual●英語●●日本語●マニュアル●日本語●");
				}
				if(u == 2) {
					class_name = "ccontact";
					text_input = GenerateInterfaceText("●英語●Company Contact●英語●●日本語●会社連絡●日本語●");
				}
				if(u == 3) {
					class_name = "assist";
					text_input = GenerateInterfaceText("●英語●Assistant●英語●●日本語●サポート●日本語●");
				}
				
				var output = "<div class=\"entry " + class_name + "\"><button onclick=\"ShowContent(" + u + ",'" + myID + "','" + words.join(",") + "')\">" + document.getElementById(myID).getElementsByTagName("BUTTON")[0].innerHTML + "</button>";
				
				// Type of entry
				output += "<i class=\"label\">" + text_input + "</i>";
				
				// Master / Private
				if(document.getElementById(myID + "_settings").innerHTML.indexOf("master") >= 0) {
					output += "<i class=\"label master" + "\" style=\"float:right;\">Master</i>";
				}
				else {
					output += "<i class=\"label private" + "\" style=\"float:right;\">Private</i>";
				}
				
				output += "</div>";
				
				document.getElementById("s_result").innerHTML += output;
				
				max_results -= 1;
				if(max_results <= 0) {
					document.getElementById("s_result").innerHTML += "<div class=\"entry\"><b style=\"color:red;background-color:black;\">Max results reached, please add more keywords to the search</b></div>"
					return;
				}
			}
		}
	}
}

function Search() {
	ShowContent(-1, "", document.getElementById("all_inputfield").value);
}

function ShowContent(type_id, entry_id, words) {
	// Generate the search frase
	var search_frase = words;
	if(search_frase.length > 0 && entry_id.length > 0) {
		search_frase += "," + entry_id;;
	}
	else if(entry_id.length > 0) {
		search_frase = entry_id;
	}

	type_id = -1;
	
	// Do a search
	if(type_id == -1) {
		DoSearch("all_", search_frase);
	}
	if(type_id == 0) {
		DoSearch("te_", search_frase);
	}
	if(type_id == 1) {
		DoSearch("ma_", search_frase);
	}
	if(type_id == 2) {
		DoSearch("cc_", search_frase);
	}
	if(type_id == 3) {
		DoSearch("as_", search_frase);
	}
	
	// Open the correct tab
	TabHandler('ru_', 2 + type_id);
	
	// If an id was provided then show that entry
	if(entry_id.length > 0) {
		DisplayEntry(entry_id);
	}
}

function DoSearch(prefix, search_term) {
	Clear(prefix);
	document.getElementById(prefix + "inputfield").value = search_term;
	Add(prefix);
}

/**********************************************
*
*                DATA PROCESS
*
**********************************************/

// Return: -1 (date1 is first), 0 (same date), 1 (date 2 is first)
function CDate(date1, date2) {
	var j = 0;
	while(j < date1.length) {
		if(date1[j] < date2[j]) {
			return -1;
		}
		else if(date1[j] > date2[j]) {
			return 1;
		}
		
		j += 1;
	}
	
	return 0;
}

//javascript:{var temp = document.getElementById("__layout").innerHTML;var s_index = temp.indexOf("scode=") + 6;temp = temp.slice(s_index);s_index = temp.indexOf("&");temp = temp.slice(0, s_index);open("https://www.amiami.jp/top/detail/detail?gcode=" + temp).focus();};void(0);

var g_personal_data;
var g_master_data;

var g_v_offset = 0; // Used in MasterOldLoad()

function JSON_Load_Data(personal_is_old) {
}

function LoadData() {
	// Set style file
	var file_name = document.getElementById('color_mode').value;
	var head = document.getElementsByTagName('head')[0];
	var link = document.createElement('link');
	link.id = 'myCss';
	link.rel = 'stylesheet';
	link.type = 'text/css';
	link.href = file_name;
	link.media = 'all';
	head.appendChild(link);

	document.getElementById("lg_language2").value = document.getElementById("lg_language").value;

	// Hide "initialize"
	document.getElementById("initialize").style.display = "none";

	if (extPersonal.hasOwnProperty('Settings')) {
		json_data = extMaster;
		json_data.Settings = extPersonal.Settings;

		for(var i = 0; i < extPersonal.Entries.length; i++) {
			SaveDataToJSON(
				extPersonal.Entries[i].uid,
				extPersonal.Entries[i].type,
				extPersonal.Entries[i].ismaster,
				extPersonal.Entries[i].lastupdate,
				extPersonal.Entries[i].category,
				extPersonal.Entries[i].team,
				extPersonal.Entries[i].authority,
				extPersonal.Entries[i].data,
				extPersonal.Entries[i].history
			);
		}

		FinalizeLoadData();

		return;
	}

	// Load data
	if (document.getElementById("input_personal").value.indexOf("||||") > 0) {
		g_personal_data = document.getElementById("input_personal").value.split("||||");
	}
	else {
		g_personal_data = document.getElementById("input_personal").value.split("|===|");
	}
	// if (document.getElementById("online_master").innerHTML.length > 0) {
	// 	document.getElementById("input_master").value = document.getElementById("online_master").innerHTML.split("!!!!!")[0];
	// 	document.getElementById("online_master").innerHTML = "";
	// }
	if (document.getElementById("online_master").innerHTML.length > 0) {
		g_master_data = document.getElementById("online_master").innerHTML.split("|===|");
		document.getElementById("online_master").innerHTML = "";
	}
	else {
		g_master_data = document.getElementById("input_master").value.split("|===|");
	}

	// Load data based on version of input data
	var p_version = 0;
	var m_version = 0;
	if (g_personal_data[0].indexOf("__VERSION__") == 0) {
		p_version = parseInt(g_personal_data[0].split("__")[2]);
	}
	if (g_master_data[0].indexOf("__VERSION__") == 0) {
		m_version = parseInt(g_master_data[0].split("__")[2]);
		g_v_offset = 1;
	}
	VersionLoad(p_version, m_version);
}

var categories_keys;
var target_team_keys;
function VersionLoad(p_version, m_version) {
	// For backward compability
	if(p_version == 0) {
		PersonalOldLoad();
		if (m_version == 0 || m_version == 1) {
			MasterOldLoad();
		}
		else {
			// Version 2+ is not yet available
		}
	}
	else {
		// Load Master and Personal at the same time, with Master prioritized
		ParseData(p_version, m_version);
	}
}

var g_mi = 0;
var g_pi = 0;
var g_type_cnt = 0;
var g_m_process_data;
var g_p_process_data;
function ParseData(p_version, m_version) {
	// Load Personal and Master data, with Master data being prioritizes

	// Startup
	if (g_type_cnt == 0) {
		g_type_cnt = 1;
		if(g_master_data.length > 0) {
			g_m_process_data = g_master_data[g_type_cnt].split("|==|");
		}
		else {
			g_m_process_data = [];
		}
		if(g_personal_data.length > 0) {
			g_p_process_data = g_personal_data[g_type_cnt + 1].split("|==|");
			document.getElementById("settings").innerHTML = g_personal_data[1];
			UpdateJSONSettings();
			document.getElementById("own_comments").innerHTML = g_personal_data[6];
		}
		else {
			g_p_process_data = [];
			UpdateJSONSettings();
		}
	}

	// Templates
	if (g_type_cnt == 1) {
		if(g_mi < (g_m_process_data.length-1)) {
			var cdata = g_m_process_data[g_mi].split("|=|");
			if (document.getElementById("templates").innerHTML.indexOf("\"" + cdata[0] + "\"") >= 0) {
				// Compare latest updated date and only update if newer
				var entry_date = document.getElementById(cdata[0] + "_settings").innerHTML.split("|")[2];
				if (CDate(cdata[1], entry_date) >= 0) {
					document.getElementById(cdata[0]).innerHTML = cdata[2];
					LoadDataToJSON(cdata[0], 'template');
				}
			}
			else {
				// Add new entry to data
				document.getElementById("templates").innerHTML += '<div id="' + cdata[0] + '" class="entry">' + cdata[2] + '</div>';
				LoadDataToJSON(cdata[0], 'template');
			}

			g_mi += 1;
		}
		else if (g_pi < (g_p_process_data.length - 1)) {
			var cdata = g_p_process_data[g_pi].split("|=|");
			if (document.getElementById("templates").innerHTML.indexOf("\"" + cdata[0] + "\"") == -1) {
				// Add new entry to data
				document.getElementById("templates").innerHTML += '<div id="' + cdata[0] + '" class="entry">' + cdata[2] + '</div>';
				LoadDataToJSON(cdata[0], 'template');
			}

			g_pi += 1;
		}
		else {
			g_mi = 0;
			g_pi = 0;
			g_type_cnt = 2;
			if (g_master_data.length > 0) {
				g_m_process_data = g_master_data[g_type_cnt].split("|==|");
			}
			else {
				g_m_process_data = [];
			}
			if (g_personal_data.length > 0) {
				g_p_process_data = g_personal_data[g_type_cnt + 1].split("|==|");
			}
			else {
				g_p_process_data = [];
			}
		}
	}

	// Manual
	if (g_type_cnt == 2) {
		if (g_mi < (g_m_process_data.length - 1)) {
			var cdata = g_m_process_data[g_mi].split("|=|");
			if (document.getElementById("manual").innerHTML.indexOf("\"" + cdata[0] + "\"") >= 0) {
				// Compare latest updated date and only update if newer
				var entry_date = document.getElementById(cdata[0] + "_settings").innerHTML.split("|")[2];
				if (CDate(cdata[1], entry_date) >= 0) {
					document.getElementById(cdata[0]).innerHTML = cdata[2];
					LoadDataToJSON(cdata[0], 'manual');
				}
			}
			else {
				// Add new entry to data
				document.getElementById("manual").innerHTML += '<div id="' + cdata[0] + '" class="entry">' + cdata[2] + '</div>';
				LoadDataToJSON(cdata[0], 'manual');
			}

			g_mi += 1;
		}
		else if (g_pi < (g_p_process_data.length - 1)) {
			var cdata = g_p_process_data[g_pi].split("|=|");
			if (document.getElementById("manual").innerHTML.indexOf("\"" + cdata[0] + "\"") == -1) {
				// Add new entry to data
				document.getElementById("manual").innerHTML += '<div id="' + cdata[0] + '" class="entry">' + cdata[2] + '</div>';
				LoadDataToJSON(cdata[0], 'manual');
			}

			g_pi += 1;
		}
		else {
			g_mi = 0;
			g_pi = 0;
			g_type_cnt = 3;
			if (g_master_data.length > 0) {
				g_m_process_data = g_master_data[g_type_cnt].split("|==|");
			}
			else {
				g_m_process_data = [];
			}
			if (g_personal_data.length > 0) {
				g_p_process_data = g_personal_data[g_type_cnt + 1].split("|==|");
			}
			else {
				g_p_process_data = [];
			}
		}
	}

	// Company contact
	if (g_type_cnt == 3) {
		if (g_mi < (g_m_process_data.length - 1)) {
			var cdata = g_m_process_data[g_mi].split("|=|");
			if (document.getElementById("ccontact").innerHTML.indexOf("\"" + cdata[0] + "\"") >= 0) {
				// Compare latest updated date and only update if newer
				var entry_date = document.getElementById(cdata[0] + "_settings").innerHTML.split("|")[2];
				if (CDate(cdata[1], entry_date) >= 0) {
					document.getElementById(cdata[0]).innerHTML = cdata[2];
					LoadDataToJSON(cdata[0], 'ccontact');
				}
			}
			else {
				// Add new entry to data
				document.getElementById("ccontact").innerHTML += '<div id="' + cdata[0] + '" class="entry">' + cdata[2] + '</div>';
				LoadDataToJSON(cdata[0], 'ccontact');
			}

			g_mi += 1;
		}
		else if (g_pi < (g_p_process_data.length - 1)) {
			var cdata = g_p_process_data[g_pi].split("|=|");
			if (document.getElementById("ccontact").innerHTML.indexOf("\"" + cdata[0] + "\"") == -1) {
				// Add new entry to data
				document.getElementById("ccontact").innerHTML += '<div id="' + cdata[0] + '" class="entry">' + cdata[2] + '</div>';
				LoadDataToJSON(cdata[0], 'ccontact');
			}

			g_pi += 1;
		}
		else {
			g_mi = 0;
			g_pi = 0;
			g_type_cnt = 4;
			if (g_master_data.length > 0) {
				g_m_process_data = g_master_data[g_type_cnt].split("|==|");
			}
			else {
				g_m_process_data = [];
			}
			if (g_personal_data.length > 0) {
				g_p_process_data = g_personal_data[g_type_cnt + 1].split("|==|");
			}
			else {
				g_p_process_data = [];
			}
		}
	}

	// Assist tool
	if (g_type_cnt == 4) {
		if (g_mi < (g_m_process_data.length - 1)) {
			var cdata = g_m_process_data[g_mi].split("|=|");
			if (document.getElementById("assistant").innerHTML.indexOf("\"" + cdata[0] + "\"") >= 0) {
				// Compare latest updated date and only update if newer
				var entry_date = document.getElementById(cdata[0] + "_settings").innerHTML.split("|")[2];
				if (CDate(cdata[1], entry_date) >= 0) {
					document.getElementById(cdata[0]).innerHTML = cdata[2];
				}
			}
			else {
				// Add new entry to data
				document.getElementById("assistant").innerHTML += '<div id="' + cdata[0] + '" class="entry">' + cdata[2] + '</div>';
			}

			g_mi += 1;
		}
		else if (g_pi < (g_p_process_data.length - 1)) {
			var cdata = g_p_process_data[g_pi].split("|=|");
			if (document.getElementById("assistant").innerHTML.indexOf("\"" + cdata[0] + "\"") == -1) {
				// Add new entry to data
				document.getElementById("assistant").innerHTML += '<div id="' + cdata[0] + '" class="entry">' + cdata[2] + '</div>';
			}

			g_pi += 1;
		}
		else {
			g_mi = 0;
			g_pi = 0;
			g_type_cnt = 5;
			// if (g_master_data.length > 0) {
			// 	g_m_process_data = g_master_data[g_type_cnt].split("|==|");
			// }
			// else {
			// 	g_m_process_data = [];
			// }
			// if (g_personal_data.length > 0) {
			// 	g_p_process_data = g_personal_data[g_type_cnt+1].split("|==|");
			// }
			// else {
			// 	g_p_process_data = [];
			// }
		}
	}

	// End
	if (g_type_cnt == 5) {
		document.getElementById('save_out').value = JSON.stringify(json_data);
		FinalizeLoadData();
	}
	else {
		var p_done = Math.round(((g_type_cnt - 1 + ((g_mi+g_pi) / (g_m_process_data.length + g_p_process_data.length))) / 4) * 100);
		document.getElementById("load_progress").innerHTML = "Loading: " + p_done + "%";
		document.getElementById("load_progress").innerHTML += '<div style="height:20px;width:' + p_done + '%;background-color:#00FF00;"></div>';
		setTimeout("ParseData(" + p_version + ", " + m_version + ")", 1);
	}
}

function PersonalOldLoad() {
	// Load data in personal file
	// If settings has been specified, overwrite settings in personal data
	if (g_personal_data.length > 1) {
		document.getElementById("settings").innerHTML = g_personal_data[0];
		document.getElementById("templates").innerHTML = g_personal_data[1];
		document.getElementById("manual").innerHTML = g_personal_data[2];
		document.getElementById("ccontact").innerHTML = g_personal_data[3];
		document.getElementById("assistant").innerHTML = g_personal_data[4];
		document.getElementById("own_comments").innerHTML = g_personal_data[5];
	}
}


var g_i = 0;
var g_ci = -1;
var g_process_data;
function MasterOldLoad() {
	// Load data in master file *If available
	// Replace data in personal data if newer data is available in master data
	if(g_master_data.length > 1) {
		// Startup
		if(g_ci == -1) {
			g_ci = 0;
			g_process_data = g_master_data[g_ci + g_v_offset].split("|==|");
		}

		// Templates
		if (g_ci == 0) {
			if (g_i < (g_process_data.length-1)) {
				var cdata = g_process_data[g_i].split("|=|");
				if (document.getElementById("templates").innerHTML.indexOf("\"" + cdata[0] + "\"") >= 0) {
					// Compare latest updated date and only update if newer
					var entry_date = document.getElementById(cdata[0] + "_settings").innerHTML.split("|")[2];
					if(CDate(cdata[1], entry_date) >= 0) {
						document.getElementById(cdata[0]).innerHTML = cdata[2];
					}
				}
				else {
					// Add new entry to data
					document.getElementById("templates").innerHTML += '<div id="' + cdata[0] + '" class="entry">' + cdata[2] + '</div>';
				}

				g_i += 1;
			}
			else {
				g_i = 0;
				g_ci = 1;
				g_process_data = g_master_data[g_ci + g_v_offset].split("|==|");
			}
		}
		
		// Manuals
		if (g_ci == 1) {
			if (g_i < (g_process_data.length - 1)) {
				var cdata = g_process_data[g_i].split("|=|");
				if (document.getElementById("manual").innerHTML.indexOf("\"" + cdata[0] + "\"") >= 0) {
					// Compare latest updated date and only update if newer
					var entry_date = document.getElementById(cdata[0] + "_settings").innerHTML.split("|")[2];
					if(CDate(cdata[1], entry_date) > 0) {
						document.getElementById(cdata[0]).innerHTML = cdata[2];
					}
				}
				else {
					// Add new entry to data
					document.getElementById("manual").innerHTML += '<div id="' + cdata[0] + '" class="entry">' + cdata[2] + '</div>';
				}

				g_i += 1;
			}
			else {
				g_i = 0;
				g_ci = 2;
				g_process_data = g_master_data[g_ci + g_v_offset].split("|==|");
			}
		}
		
		// Company Contact
		if (g_ci == 2) {
			if (g_i < (g_process_data.length - 1)) {
				var cdata = g_process_data[g_i].split("|=|");
				if (document.getElementById("ccontact").innerHTML.indexOf("\"" + cdata[0] + "\"") >= 0) {
					// Compare latest updated date and only update if newer
					var entry_date = document.getElementById(cdata[0] + "_settings").innerHTML.split("|")[2];
					if(CDate(cdata[1], entry_date) > 0) {
						document.getElementById(cdata[0]).innerHTML = cdata[2];
					}
				}
				else {
					// Add new entry to data
					document.getElementById("ccontact").innerHTML += '<div id="' + cdata[0] + '" class="entry">' + cdata[2] + '</div>';
				}

				g_i += 1;
			}
			else {
				g_i = 0;
				g_ci = 3;
				g_process_data = g_master_data[g_ci + g_v_offset].split("|==|");
			}
		}
		
		// Assistant
		if (g_ci == 3) {
			if (g_i < (g_process_data.length - 1)) {
				var cdata = g_process_data[g_i].split("|=|");
				if (document.getElementById("assistant").innerHTML.indexOf("\"" + cdata[0] + "\"") >= 0) {
					// Compare latest updated date and only update if newer
					var entry_date = document.getElementById(cdata[0] + "_settings").innerHTML.split("|")[2];
					if(CDate(cdata[1], entry_date) > 0) {
						document.getElementById(cdata[0]).innerHTML = cdata[2];
					}
				}
				else {
					// Add new entry to data
					document.getElementById("assistant").innerHTML += '<div id="' + cdata[0] + '" class="entry">' + cdata[2] + '</div>';
				}

				g_i += 1;
			}
			else {
				g_i = 0;
				g_ci = 4;
				//g_process_data = g_master_data[g_ci + g_v_offset].split("|==|");
			}
		}

		// End
		if (g_ci == 4) {
			//document.getElementById("need_save").style.display = "inline";
			FinalizeLoadData();
		}
		else {
			var p_done = Math.round(((g_ci + (g_i / g_process_data.length)) / 4) * 100);
			document.getElementById("load_progress").innerHTML = "Loading: " + p_done + "%";
			document.getElementById("load_progress").innerHTML += '<div style="height:20px;width:' + p_done + '%;background-color:#00FF00;"></div>';
			setTimeout("MasterOldLoad()", 1);
		}
	}
	else {
		FinalizeLoadData();
	}
}

function FinalizeLoadData() {
/*	var apply_comments = document.getElementById("own_comments").getElementsByTagName("DIV");
	var i = 0;
	while(i < apply_comments.length) {
		document.getElementById(apply_comments[i].id + "_input").value = apply_comments[i].innerHTML;
		
		i += 1;
	}*/
	
	// Show "run"
	document.getElementById("run").style.display = "block";
	document.getElementById("menubar").style.display = "block";
	document.getElementById("debug").innerHTML = "";
	
	// Setup reminders
	var reminders = json_data.Settings.reminders.split("||");
	var i = 0;
	while(i < reminders.length) {
		var this_reminder = reminders[i].split("|");
		SetReminderPopup(this_reminder[0], this_reminder[1]);
		
		i += 1;
	}
	
	Setup();
	
	// Set default language according to user settings
	SetDefaultLanguage();

	// Show news
	News();

	// If no JSON personal data exists, create it
	if (localStorage.hasOwnProperty("json_personal") == false) {
		GeneratePersonalData();
	}
}

// Fixed for json
function ShareDataList() {
	var output = "<br><hr>";
	var i;
	
	// Template
	output += "<h3>" + GenerateInterfaceText("●英語●Templates●英語●●日本語●テンプレート●日本語●") + "</h3>";
	for(i = 0; i < json_data.Entries.length; i++) {
		if (json_data.Entries[i].type.indexOf("template") == 0 && json_data.Entries[i].ismaster == false) {
			output += '<input type="checkbox" id="check_' + i + '" class="templates">' + json_data.Entries[i].data.Title + '<br>';
		}
	}
	
	output += "<hr>";
	
	// Manual
	output += "<h3>" + GenerateInterfaceText("●英語●Manuals●英語●●日本語●マニュアル●日本語●") + "</h3>";
	for (i = 0; i < json_data.Entries.length; i++) {
		if (json_data.Entries[i].type.indexOf("manual") == 0 && json_data.Entries[i].ismaster == false) {
			output += '<input type="checkbox" id="check_' + i + '" class="manual">' + json_data.Entries[i].data.Title + '<br>';
		}
	}
	
	output += "<hr>";
	
	// Ccontact
	output += "<h3>" + GenerateInterfaceText("●英語●Company Contacts●英語●●日本語●会社連絡●日本語●") + "</h3>";
	for (i = 0; i < json_data.Entries.length; i++) {
		if (json_data.Entries[i].type.indexOf("ccontact") == 0 && json_data.Entries[i].ismaster == false) {
			output += '<input type="checkbox" id="check_' + i + '" class="ccontact">' + json_data.Entries[i].data.Title + '<br>';
		}
	}
	
	output += "<hr>";
	
	// Display list
	output += "<button onclick=\"SetShareData()\" style=\"background-color:red;\">" + GenerateInterfaceText("●英語●Generate data●英語●●日本語●データ作成●日本語●") + "</button><br><hr>";
	document.getElementById("share_output").innerHTML = output;
}

// Fixed for json
function SetShareData() {
	// Clear output
	document.getElementById("save_out").value = "";
	
	// Get all the check boxes
	var input_data = document.getElementById("share_output").getElementsByTagName("INPUT");
	
	// Save all
	var json_data_to_share = {
		Settings: {},
		Entries: []
	};
	var i;
	for(i = 0; i < input_data.length; i++) {
		if(input_data[i].checked == true) {
			var my_index = parseInt(input_data[i].id.slice(6));
			json_data_to_share.Entries.push(json_data.Entries[my_index]);
		}
	}
	document.getElementById("save_out").value = JSON.stringify(json_data_to_share);
	
	// Clear input
	document.getElementById("share_output").innerHTML = "";
}

function GenerateInterfaceText(input_data) {
	// input_data = "●英語●English●英語●●日本語●Japanese●日本語●........."
	
	// Get language priority
	var language_priority = (document.getElementById("interface_language").innerHTML + "|" + document.getElementById("content_language").innerHTML + "|●その他●").split("|");
	
	var j = 0;
	var out_string = "";
	while(j < language_priority.length && out_string.length == 0) {
		if(input_data.indexOf(language_priority[j]) >= 0) {
			out_string = input_data.split(language_priority[j])[1];
		}
		
		j = j + 1;
	}
	
	var output = '<span class="multi_language"><span class="visible">' + out_string + '</span><span class="data">' + input_data + '</span></span>';
	return output;
}

function SetupInterface() {
	var int_elements = document.getElementsByClassName("setup_interface");
	
	var i = 0;
	while(i < int_elements.length) {
		int_elements[i].innerHTML = GenerateInterfaceText(int_elements[i].innerHTML);
		
		i += 1;
	}
}

// Add shipping label/invoice to ask for
function myGetDocument(type) {
	var input = document.getElementById("all_inputfield").value;
	if(input.length == 0) { return; }
	if(type == 0) {
		if(document.getElementById("var_labinv").innerHTML.length > 0) {
			document.getElementById("var_labinv").innerHTML += "<br>";
		}
		document.getElementById("var_labinv").innerHTML += input;
	}
	else if(type == 1) {
		if(document.getElementById("var_label").innerHTML.length > 0) {
			document.getElementById("var_label").innerHTML += "<br>";
		}
		document.getElementById("var_label").innerHTML += input;
	}
	else {
		if(document.getElementById("var_invoice").innerHTML.length > 0) {
			document.getElementById("var_invoice").innerHTML += "<br>";
		}
		document.getElementById("var_invoice").innerHTML += input;
	}
	document.getElementById("all_inputfield").value = "";
}
function ShowDocuments() {
	if (document.getElementById("var_label").innerHTML.length > 0 || document.getElementById("var_invoice").innerHTML.length > 0 || document.getElementById("var_labinv").innerHTML.length > 0) {
		var op = "<div>お疲れ様です。<br><br>";
		if (document.getElementById("var_labinv").innerHTML.length > 0) {
			op += "伝票画像+インボイス<br>" + document.getElementById("var_labinv").innerHTML + "<br><br>";
		}
		if (document.getElementById("var_label").innerHTML.length > 0) {
			op += "伝票画像<br>" + document.getElementById("var_label").innerHTML + "<br><br>";
		}
		if (document.getElementById("var_invoice").innerHTML.length > 0) {
			op += "インボイス<br>" + document.getElementById("var_invoice").innerHTML + "<br><br>";
		}
		op += "よろしくお願いします。<div>";
		
		op += "<button onclick=\"Debug('')\">Done</button>";
		
		document.getElementById("debug").innerHTML = op;
		
		notifyMe("Request for shipping documents.\n発送書類を依頼してください。");
	}
}

// Change(new data save): Only save personal data (as master data is loaded automatically at every start up)
function GeneratePersonalData() {
	var i;
	// Settings
	document.getElementById("save_out").value = "__VERSION__1__|===|" + document.getElementById("settings").innerHTML + "|===|";
	
	for(key in types) {
		var entries = document.getElementById(types[key]).getElementsByClassName("entry");
		if(key.indexOf("cc_") < 0) {
			for(ckey in categories) {
				for (i = 0; i < entries.length; i++) {
					var uid = entries[i].id;
					if (entries[i].innerHTML.indexOf(ckey) >= 0 && entries[i].innerHTML.indexOf("___DELETE___") < 0 && document.getElementById(uid + "_settings").innerHTML.indexOf("master") < 0) {
						// Save to output
						var settings = document.getElementById(uid + "_settings").innerHTML.split("|");
						document.getElementById("save_out").value += uid + "|=|" + settings[2] + "|=|" + entries[i].innerHTML + "|==|";
					}
				}
			}
		}
		else {
			for(ckey in target_team) {
				for (i = 0; i < entries.length; i++) {
					var uid = entries[i].id;
					if (entries[i].innerHTML.indexOf(ckey) >= 0 && entries[i].innerHTML.indexOf("___DELETE___") < 0 && document.getElementById(uid + "_settings").innerHTML.indexOf("master") < 0) {
						// Save to output
						var settings = document.getElementById(uid + "_settings").innerHTML.split("|");
						document.getElementById("save_out").value += uid + "|=|" + settings[2] + "|=|" + entries[i].innerHTML + "|==|";
					}
				}
			}
		}
		document.getElementById("save_out").value += "|===|";
	}

	// Own comments
	document.getElementById("save_out").value += document.getElementById("own_comments").innerHTML;

	// Save
	localStorage.setItem("input_personal", document.getElementById("save_out").value);

	document.getElementById("need_save").style.display = "none";

	// JSON save
	var json_save = {
		Settings: {},
		Entries: []
	};
	var saved_ids = "";
	json_save.Settings = json_data.Settings;
	for (ckey in categories) {
		for (i = 0; i < json_data.Entries.length; i++) {
			if (json_data.Entries[i].category.indexOf(ckey) >= 0 && saved_ids.indexOf('|' + json_data.Entries[i].uid + '|') == -1 && json_data.Entries[i].ismaster == false) {
				// Save to output
				saved_ids += '|' + json_data.Entries[i].uid + '|';
				json_save.Entries.push(json_data.Entries[i])
			}
		}
	}
	for (ckey in target_team) {
		for (i = 0; i < json_data.Entries.length; i++) {
			if (json_data.Entries[i].category.indexOf(ckey) >= 0 && saved_ids.indexOf('|' + json_data.Entries[i].uid + '|') == -1 && json_data.Entries[i].ismaster == false) {
				// Save to output
				saved_ids += '|' + json_data.Entries[i].uid + '|';
				json_save.Entries.push(json_data.Entries[i])
			}
		}
	}
	localStorage.setItem("json_personal", JSON.stringify(json_save));
}
function GenerateShareData() {
	document.getElementById("save_out").value = "";
	
	ShareDataList();
}
function GenerateMasterData() {
	var i;
	var process_data;
	document.getElementById("save_out").value = "__VERSION__1__|===|";
	
	// Clear all searches
	for(key in types) {
		Clear(key);
	}

	// Generate master output data
	for (key in types) {
		process_data = document.getElementById(types[key]).getElementsByClassName("entry");
		if (key.indexOf("cc_") < 0) {
			for (ckey in categories) {
				for (i = 0; i < process_data.length; i++) {
					var uid = process_data[i].id;
					if (process_data[i].innerHTML.indexOf(ckey) >= 0 && process_data[i].innerHTML.indexOf("___DELETE___") < 0 && document.getElementById(uid + "_settings").innerHTML.indexOf("master") >= 0) {
						// Save to output
						var settings = document.getElementById(uid + "_settings").innerHTML.split("|");
						document.getElementById("save_out").value += uid + "|=|" + settings[2] + "|=|" + process_data[i].innerHTML + "|==|";
					}
				}
			}
		}
		else {
			for (ckey in target_team) {
				for (i = 0; i < process_data.length; i++) {
					var uid = process_data[i].id;
					if (process_data[i].innerHTML.indexOf(ckey) >= 0 && process_data[i].innerHTML.indexOf("___DELETE___") < 0 && document.getElementById(uid + "_settings").innerHTML.indexOf("master") >= 0) {
						// Save to output
						var settings = document.getElementById(uid + "_settings").innerHTML.split("|");
						document.getElementById("save_out").value += uid + "|=|" + settings[2] + "|=|" + process_data[i].innerHTML + "|==|";
					}
				}
			}
		}
		document.getElementById("save_out").value += "|===|";
	}

	// JSON save
	var json_save = {
		Settings: {},
		Entries: []
	};
	var saved_ids = "";
	for (ckey in categories) {
		for (i = 0; i < json_data.Entries.length; i++) {
			if (json_data.Entries[i].category.indexOf(ckey) >= 0 && saved_ids.indexOf('|' + json_data.Entries[i].uid + '|') == -1 && json_data.Entries[i].ismaster == true) {
				// Save to output
				saved_ids += '|' + json_data.Entries[i].uid + '|';
				json_save.Entries.push(json_data.Entries[i])
			}
		}
	}
	for (ckey in target_team) {
		for (i = 0; i < json_data.Entries.length; i++) {
			if (json_data.Entries[i].category.indexOf(ckey) >= 0 && saved_ids.indexOf('|' + json_data.Entries[i].uid + '|') == -1 && json_data.Entries[i].ismaster == true) {
				// Save to output
				saved_ids += '|' + json_data.Entries[i].uid + '|';
				json_save.Entries.push(json_data.Entries[i])
			}
		}
	}
	document.getElementById("save_out").value = JSON.stringify(json_save);
}

/**********************************************
*
*                 Reminders
*
**********************************************/

function SetReminderPopup(trigger_time, message) {
	var nowdate = new Date();
	var split_time = trigger_time.split(":");
	var milliseconds_left = new Date(nowdate.getFullYear(), nowdate.getMonth(), nowdate.getDate(), split_time[0], split_time[1], 0, 0) - nowdate;
	if(milliseconds_left > 0) {
		setTimeout('Reminder("' + message + '")', milliseconds_left);
	}
}
function SetReminderFunction(trigger_time, functionname) {
	var nowdate = new Date();
	var split_time = trigger_time.split(":");
	var milliseconds_left = new Date(nowdate.getFullYear(), nowdate.getMonth(), nowdate.getDate(), split_time[0], split_time[1], 0, 0) - nowdate;
	if(milliseconds_left > 0) {
		setTimeout(functionname, milliseconds_left);
	}
}
function Reminder(message) {
	var color = document.body.style.backgroundColor;
	document.body.style.backgroundColor = "red";
	notifyMe(message);
	alert(message);
	document.body.style.backgroundColor = color;
}

function ReminderDelete(id_num) {
	// Update Reminders
	var reminders = json_data.Settings.reminders.split("||");
	var output = "<table>";
	var updated_reminders = "";
	// Header row
	output += "<tr><th class=\"third\">" + GenerateInterfaceText("●英語●Time●英語●●日本語●時間●日本語●") + "</th><th class=\"third\">" + GenerateInterfaceText("●英語●Message●英語●●日本語●メッセージ●日本語●") + "</th><th class=\"third\">" + GenerateInterfaceText("●英語●Edit●英語●●日本語●編集●日本語●") + "</th></tr>";
	// Current reminder row(s)
	if(reminders[0].length > 0) {
		var i = 0;
		var cnt = 0;
		while(i < reminders.length) {
			if(i != id_num) {
				output += "<tr>";
				var this_reminder = reminders[i].split("|");
				output += "<td>" + this_reminder[0] + "</td>";
				output += "<td>" + this_reminder[1] + "</td>";
				output += "<td><button onclick=\"ReminderDelete(" + cnt + ")\">" + GenerateInterfaceText("●英語●Delete●英語●●日本語●削除●日本語●") + "</button></td>";
				output += "</tr>";
				
				if(updated_reminders.length > 0) {
					updated_reminders += "||";
				}
				updated_reminders += reminders[i];
				
				i += 1;
				cnt += 1;
			}
			else {
				i += 1;
			}
		}
	}
	// Add reminder row
	output += "<tr>";
	output += "<td><input id=\"rem_time\" type=\"text\"></td>";
	output += "<td><input id=\"rem_text\" type=\"text\"></td>";
	output += "<td><button onclick=\"AddReminder()\">" + GenerateInterfaceText("●英語●Add●英語●●日本語●追加●日本語●") + "</button></td>";
	output += "</tr>";
	output += "</table>";
	// Show
	document.getElementById("show_reminders").innerHTML = output;
	
	// Update saved reminders
	json_data.Settings.reminders = updated_reminders;
	
	document.getElementById("need_save").style.display = "inline";
}
function AddReminder() {
	if (json_data.Settings.reminders.length > 0) {
		json_data.Settings.reminders += "||";
	}
	json_data.Settings.reminders += document.getElementById("rem_time").value + "|" + document.getElementById("rem_text").value;
	SetReminderPopup(document.getElementById("rem_time").value, document.getElementById("rem_text").value);
	
	// Update Reminders
	var reminders = json_data.Settings.reminders.split("||");
	var output = "<table>";
	// Header row
	output += "<tr><th class=\"third\">" + GenerateInterfaceText("●英語●Time●英語●●日本語●時間●日本語●") + "</th><th class=\"third\">" + GenerateInterfaceText("●英語●Message●英語●●日本語●メッセージ●日本語●") + "</th><th class=\"third\">" + GenerateInterfaceText("●英語●Edit●英語●●日本語●編集●日本語●") + "</th></tr>";
	// Current reminder row(s)
	if(reminders[0].length > 0) {
		var i = 0;
		while(i < reminders.length) {
			output += "<tr>";
			var this_reminder = reminders[i].split("|");
			output += "<td>" + this_reminder[0] + "</td>";
			output += "<td>" + this_reminder[1] + "</td>";
			output += "<td><button onclick=\"ReminderDelete(" + i + ")\">" + GenerateInterfaceText("●英語●Delete●英語●●日本語●削除●日本語●") + "</button></td>";
			output += "</tr>";
			
			i += 1;
		}
	}
	// Add reminder row
	output += "<tr>";
	output += "<td><input id=\"rem_time\" type=\"text\"></td>";
	output += "<td><input id=\"rem_text\" type=\"text\"></td>";
	output += "<td><button onclick=\"AddReminder()\">" + GenerateInterfaceText("●英語●Add●英語●●日本語●追加●日本語●") + "</button></td>";
	output += "</tr>";
	output += "</table>";
	// Show
	document.getElementById("show_reminders").innerHTML = output;
	
	document.getElementById("need_save").style.display = "inline";
}

/**********************************************
*
*             HTML edit functions
*
**********************************************/

function SelectTextarea(selected) {
	document.getElementById("selected_input_box").innerHTML = selected.id;
	
	var t_areas = document.getElementById("input_boxes").getElementsByTagName("TEXTAREA");
	var i = 0;
	while(i < t_areas.length) {
		t_areas[i].style.border = "1px none #000000";
		
		i += 1;
	}
	
	selected.style.border = "5px solid green";
}

function CreateNew(type) {
	// Generate new unique_id
	document.getElementById("unique_id").innerHTML = GenerateUID();
	
	// Check if in edit master mode
	var master = (document.getElementById("current_mode").innerHTML.indexOf("Master") == 0);
	
	// Set team
	document.getElementById("team_select").value = json_data.Settings.team;
	
	// Set last updated to "NEW"
	document.getElementById("last_updated").innerHTML = "NEW";
	
	// Clear title
	document.getElementById("title_show_eng").innerHTML = "Not set";
	document.getElementById("title_show_jap").innerHTML = "未設定";
	document.getElementById("title_show_other").innerHTML = "Not set　未設定";
	
	// Clear input boxes
	document.getElementById("selected_input_box").innerHTML = "";
	document.getElementById("input_boxes").innerHTML = "";
	
	// Set type
	if(type.indexOf("template") == 0) {
		document.getElementById("type").innerHTML = GenerateInterfaceText("●英語●Template●英語●●日本語●テンプレート●日本語●");
		document.getElementById("n_cat").style.display = "block";
		//document.getElementById("t_cat").style.display = "none";
		ShowEditBar(0);
	}
	else if(type.indexOf("manual") == 0) {
		document.getElementById("type").innerHTML = GenerateInterfaceText("●英語●Manual●英語●●日本語●マニュアル●日本語●");
		document.getElementById("n_cat").style.display = "block";
		//document.getElementById("t_cat").style.display = "none";
		ShowEditBar(1);
	}
	else if(type.indexOf("ccontact") == 0) {
		document.getElementById("type").innerHTML = GenerateInterfaceText("●英語●Company Contact●英語●●日本語●会社連絡●日本語●");
		document.getElementById("n_cat").style.display = "block";
		//document.getElementById("t_cat").style.display = "block";
		ShowEditBar(0);
	}
	else if(type.indexOf("assistant") == 0) {
		document.getElementById("type").innerHTML = GenerateInterfaceText("●英語●Assistant●英語●●日本語●サポート●日本語●");
		document.getElementById("n_cat").style.display = "block";
		//document.getElementById("t_cat").style.display = "none";
		ShowEditBar(2);
		
		// Set default input data
		document.getElementById("input_boxes").innerHTML = '<div id="lang_settings" style="display:none"></div>';
		document.getElementById("input_boxes").innerHTML += '<h3>' + GenerateInterfaceText("●英語●Questions●英語●●日本語●質問●日本語●") + '</h3>';
		document.getElementById("input_boxes").innerHTML += '<div id="num_questions" style="display:none">0</div>';
		document.getElementById("input_boxes").innerHTML += '<div id="questions"></div>';
		document.getElementById("input_boxes").innerHTML += '<h3>' + GenerateInterfaceText("●英語●Answers●英語●●日本語●答え●日本語●") + '</h3>';
		document.getElementById("input_boxes").innerHTML += '<div id="num_answers" style="display:none">0</div>';
		document.getElementById("input_boxes").innerHTML += '<div id="answers"></div><br>';
		document.getElementById("input_boxes").innerHTML += '<div id="output_matrix"></div>';
	}
	else {
		document.getElementById("type").innerHTML = GenerateInterfaceText("●英語●Unknown●英語●●日本語●不明●日本語●");
		document.getElementById("debug").innerHTML = "Unknown type";
	}
	if(master == true) {
		document.getElementById("type").innerHTML += "<i>(Master)</i>";
	}
	
	// Show edit_body
	document.getElementById("edit_settings").style.display = "none";
	document.getElementById("edit_body").style.display = "block";
}

function SetID() {
	document.getElementById("user_id").innerHTML = document.getElementById("s_user_id").value;
	json_data.Settings.user_id = document.getElementById("s_user_id").value;
	
	document.getElementById("need_save").style.display = "inline";
}
function SetTeam() {
	document.getElementById("user_team").innerHTML = document.getElementById("s_user_team_sel").value;
	json_data.Settings.team = document.getElementById("s_user_team_sel").value;
	
	document.getElementById("need_save").style.display = "inline";
}
function SetILanguage() {
	if(document.getElementById("s_i_language_eng").checked == true) {
		document.getElementById("interface_language").innerHTML = "●英語●";
		json_data.Settings.i_language = "english";
	}
	else if (document.getElementById("s_i_language_jap").checked == true) {
		document.getElementById("interface_language").innerHTML = "●日本語●";
		json_data.Settings.i_language = "japanese";
	}
	else {
		json_data.Settings.i_language = "swedish";
	}
	
	document.getElementById("need_save").style.display = "inline";
}
function SetStyle() {
	if (document.getElementById("settings").innerHTML.indexOf("my_style") == -1) {
		document.getElementById("settings").innerHTML += '<div id="my_style"></div>';
	}
	if (document.getElementById("s_normal").checked == true) {
		document.getElementById("my_style").innerHTML = "Style_normal.css";
		json_data.Settings.style = "Style_normal.css";
	}
	else {
		document.getElementById("my_style").innerHTML = "Style_dark.css";
		json_data.Settings.style = "Style_dark.css";
	}

	document.getElementById("need_save").style.display = "inline";
}
function UpdateLanguagePrio() {/*
	var first = document.getElementsByName("prio_first");
	var second = document.getElementsByName("prio_second");
	var third = document.getElementsByName("prio_third");
	
	var output = "";
	
	var i = 0;
	while(i < 3) {
		if(first[i].checked == true) {
			if(i == 0) {
				output += "●英語●";
			}
			else if(i == 1) {
				output += "●日本語●";
			}
			else if(i == 2) {
				output += "●その他●";
			}
		}
		
		i += 1;
	}
	i = 0;
	while(i < 3) {
		if(second[i].checked == true) {
			if(i == 0) {
				if(output.length > 0) {
					output += "|";
				}
				output += "●英語●";
			}
			else if(i == 1) {
				if(output.length > 0) {
					output += "|";
				}
				output += "●日本語●";
			}
			else if(i == 2) {
				if(output.length > 0) {
					output += "|";
				}
				output += "●その他●";
			}
		}
		
		i += 1;
	}
	i = 0;
	while(i < 3) {
		if(third[i].checked == true) {
			if(i == 0) {
				if(output.length > 0) {
					output += "|";
				}
				output += "●英語●";
			}
			else if(i == 1) {
				if(output.length > 0) {
					output += "|";
				}
				output += "●日本語●";
			}
			else if(i == 2) {
				if(output.length > 0) {
					output += "|";
				}
				output += "●その他●";
			}
		}
		
		i += 1;
	}
	
	document.getElementById("content_language").innerHTML = output;
	
	document.getElementById("need_save").style.display = "inline";
*/}
/*
json_data.Settings.user_id = document.getElementById('user_id').innerHTML;
json_data.Settings.i_language = document.getElementById('interface_language').innerHTML;
json_data.Settings.team = document.getElementById('user_team').innerHTML;
json_data.Settings.style = document.getElementById('my_style').innerHTML;
json_data.Settings.reminders = document.getElementById('my_reminders').innerHTML;
*/
function UpdateSettings() {
	document.getElementById("edit_settings").style.display = "block";
	document.getElementById("edit_body").style.display = "none";
	
	// User ID
	document.getElementById("s_user_id").value = json_data.Settings.user_id;
	
	// Team
	var output = '<select id="s_user_team_sel" onclick="SetTeam()">';
	for(key in teams) {
		output += '<option value="' + key + '">' + teams[key] + '</option>';
	}
	output += '</select>';
	document.getElementById("s_user_team").innerHTML = output;
	document.getElementById("s_user_team_sel").value = json_data.Settings.team;
	
	// Interface
	if (json_data.Settings.i_language.indexOf("●日本語●") == 0) {
		document.getElementById("s_i_language_jap").checked = true;
		document.getElementById("s_i_language_eng").checked = false;
		document.getElementById("s_i_language_swe").checked = false;
	}
	else if (json_data.Settings.i_language.indexOf("●英語●") == 0) {
		document.getElementById("s_i_language_jap").checked = false;
		document.getElementById("s_i_language_eng").checked = true;
		document.getElementById("s_i_language_swe").checked = false;
	}
	else if (json_data.Settings.i_language.indexOf("english") == 0) {
		document.getElementById("s_i_language_jap").checked = false;
		document.getElementById("s_i_language_eng").checked = true;
		document.getElementById("s_i_language_swe").checked = false;
	}
	else if (json_data.Settings.i_language.indexOf("japanese") == 0) {
		document.getElementById("s_i_language_jap").checked = true;
		document.getElementById("s_i_language_eng").checked = false;
		document.getElementById("s_i_language_swe").checked = false;
	}
	else {
		document.getElementById("s_i_language_jap").checked = false;
		document.getElementById("s_i_language_eng").checked = false;
		document.getElementById("s_i_language_swe").checked = true;
	}

	// Style
	if (json_data.Settings.style.indexOf("Style_normal.css") == 0) {
		document.getElementById("s_normal").checked = true;
		document.getElementById("s_dark").checked = false;
	}
	else {
		document.getElementById("s_normal").checked = false;
		document.getElementById("s_dark").checked = true;
	}
	
	// Priority languages
	/*
	var langs = document.getElementById("content_language").innerHTML.split("|");
	if(langs.length > 0) {
		if(langs[0].indexOf("●日本語●") == 0) {
			document.getElementById("jap_first").checked = true;
		}
		else if(langs[0].indexOf("●英語●") == 0) {
			document.getElementById("eng_first").checked = true;
		}
		else {
			document.getElementById("oth_first").checked = true;
		}
	}
	if(langs.length > 1) {
		if(langs[1].indexOf("●日本語●") == 0) {
			document.getElementById("jap_second").checked = true;
		}
		else if(langs[1].indexOf("●英語●") == 0) {
			document.getElementById("eng_second").checked = true;
		}
		else {
			document.getElementById("oth_second").checked = true;
		}
	}
	if(langs.length > 2) {
		if(langs[2].indexOf("●日本語●") == 0) {
			document.getElementById("jap_third").checked = true;
		}
		else if(langs[2].indexOf("●英語●") == 0) {
			document.getElementById("eng_third").checked = true;
		}
		else {
			document.getElementById("oth_third").checked = true;
		}
	}
	*/
	
	// Reminders
	var reminders = json_data.Settings.reminders.split("||");
	var output = "<table>";
	// Header row
	output += "<tr><th class=\"third\">" + GenerateInterfaceText("●英語●Time●英語●●日本語●時間●日本語●") + "</th><th class=\"third\">" + GenerateInterfaceText("●英語●Message●英語●●日本語●メッセージ●日本語●") + "</th><th class=\"third\">" + GenerateInterfaceText("●英語●Edit●英語●●日本語●編集●日本語●") + "</th></tr>";
	// Current reminder row(s)
	if(reminders[0].length > 0) {
		var i = 0;
		while(i < reminders.length) {
			output += "<tr>";
			var this_reminder = reminders[i].split("|");
			output += "<td>" + this_reminder[0] + "</td>";
			output += "<td>" + this_reminder[1] + "</td>";
			output += "<td><button onclick=\"ReminderDelete(" + i + ")\">" + GenerateInterfaceText("●英語●Delete●英語●●日本語●削除●日本語●") + "</button></td>";
			output += "</tr>";
			
			i += 1;
		}
	}
	// Add reminder row
	output += "<tr>";
	output += "<td><input id=\"rem_time\" type=\"text\"></td>";
	output += "<td><input id=\"rem_text\" type=\"text\"></td>";
	output += "<td><button onclick=\"AddReminder()\">" + GenerateInterfaceText("●英語●Add●英語●●日本語●追加●日本語●") + "</button></td>";
	output += "</tr>";
	output += "</table>";
	// Show
	document.getElementById("show_reminders").innerHTML = output;
}

// Fixed for json
function Delete() {
	var uid = document.getElementById("unique_id").innerHTML;
	DeleteUidFromJSON(uid);
/*	var element_to_remove = document.getElementById(uid);
	if(element_to_remove) {
		element_to_remove.innerHTML += "<b style=\"background-color:black;color:red;\">___DELETE___</b>";
	}
	*/
	document.getElementById("need_save").style.display = "inline";
	GeneratePersonalData();
}

// Fixed for json
function EditSave() {
	// Break if there is no content
	if(document.getElementById("input_boxes").innerHTML.length == 0) {
		alert("There are no content to save.\n保存ができるコンテンツが無い。");
		return;
	}
	
	// Break if there is no title
	if(document.getElementById("title_show_eng").innerHTML.indexOf("Not set") == 0) {
		alert("Can not save as no title has been set.\nタイトルが設定されていない為に、保存ができない。");
		return;
	}
	
	var uid = document.getElementById("unique_id").innerHTML;
	var copy_string = "";
	if(uid.indexOf("_COPY") >= 0) {
		copy_string = " <i style=\"color:#888888\">Copy</i>"
	}
	var category = document.getElementById("category_select").value;
	//var target = document.getElementById("target_select").value;
	var team = document.getElementById("team_select").value;
	var lastupdate = GenerateDateTime("yyyymmdd");
	var ismaster = false;
	if(document.getElementById("type").innerHTML.indexOf("Master") >= 0) {
		ismaster = true;
	}
	var data = {
		Title: "",
		Content: []
	};
	var type = "";
	
	// Update last updated
	document.getElementById("last_updated").innerHTML = lastupdate;

	// Title
	data.Title = document.getElementById("title_show_eng").innerHTML;

	// Content
	var entries = document.getElementById("input_boxes").getElementsByTagName("TEXTAREA");
	for (var i = 0; i < entries.length; i++) {
		data.Content.push(entries[i].value);
	}
	
	if(document.getElementById("type").innerHTML.indexOf("Template") >= 0) {
		// Type
		type = "template";
	}
	else if(document.getElementById("type").innerHTML.indexOf("Manual") >= 0) {
		// Type
		type = "manual";
	}
	else if(document.getElementById("type").innerHTML.indexOf("Company Contact") >= 0) {
		// Type
		type = "ccontact";
	}
	else {
		document.getElementById("debug").innerHTML = "Unknown save type";
	}

	SaveDataToJSON(uid, type, ismaster, lastupdate, category, team, 0, data, "Updated by " + json_data.Settings.user_id + " at " + lastupdate);
	
	document.getElementById("need_save").style.display = "inline";
	GeneratePersonalData();
}

function Calculate(uid) {
	var settings = document.getElementById(uid + "_aset").innerHTML.split(",");
	var num_questions = parseInt(settings[1]);
	var num_answers = parseInt(settings[2]);
	
	// Get which row to check
	var i = num_questions - 1;
	var row = 0;
	while(i >= 0) {
		row = row << 1;
		if(document.getElementById(uid + "_q" + i).checked == true) {
			row += 1;
		}
		
		i -= 1;
	}
	
	// Get row data
	var answer_id = document.getElementById(uid + "_ct" + row).innerHTML.split("|");
	
	// Get answer data
	var answer = "<ol style=\"color:#777700;\">";
	var i = 0;
	while(i < answer_id.length) {
		if(answer_id[i].length > 0) {
			answer += "<li>" + document.getElementById(uid + "_a" + answer_id[i]).innerHTML + "</li>";
		}
		
		i += 1;
	}
	answer += "</ol>";
	
	// Output answer data
	document.getElementById(uid + "_out").innerHTML = answer;
}

// Fixed for json
function EditEntry(json_index) {
	// If trying to edit as master do a login check
	if(json_data.Entries[json_index].ismaster == true) {
		if (LoginCheck() == false) {
			return;
		}
		SetEditStatus(1);
	}
	else {
		SetEditStatus(0);
	}

	// Setup variables
	document.getElementById("unique_id").innerHTML = json_data.Entries[json_index].uid;
	if (json_data.Entries[json_index].type.indexOf("template") == 0) {
		document.getElementById("type").innerHTML = "Template";
	}
	else if (json_data.Entries[json_index].type.indexOf("manual") == 0) {
		document.getElementById("type").innerHTML = "Manual";
	}
	else if (json_data.Entries[json_index].type.indexOf("ccontact") == 0) {
		document.getElementById("type").innerHTML = "Company Contact";
	}
	document.getElementById("category_select").value = json_data.Entries[json_index].category;
	document.getElementById("team_select").value = json_data.Entries[json_index].team;
	document.getElementById("last_updated").innerHTML = json_data.Entries[json_index].lastupdate;

	// type
	if (json_data.Entries[json_index].ismaster == true) {
		document.getElementById("type").innerHTML += "<i>(Master)</i>";
	}

	// Title
	document.getElementById("title_show_eng").innerHTML = json_data.Entries[json_index].data.Title;

	// Content
	document.getElementById("input_boxes").innerHTML = "";
	var t_area = json_data.Entries[json_index].data.Content;
	var i = 0;
	while (i < t_area.length) {
		SetLanguageTag('英語');

		i = i + 1;
	}
	var i_area = document.getElementById("input_boxes").getElementsByTagName("TEXTAREA");
	i = 0;
	while (i < t_area.length) {
		i_area[i].value = t_area[i];

		i = i + 1;
	}

	// Open the tab and set up for editing
	TabHandler('ru_', 6);
	document.getElementById("edit_settings").style.display = "none";
	document.getElementById("edit_body").style.display = "block";

	document.getElementById("n_cat").style.display = "block";
	//document.getElementById("t_cat").style.display = "none";

	ShowEditBar(0);
}
function EditTemplate(uniqueID, e_type) {
	// If trying to edit as master do a login check
	if(e_type == 1) {
		if(LoginCheck() == false) {
			return;
		}
	}
	SetEditStatus(e_type);
	
	// Setup variables
	document.getElementById("unique_id").innerHTML = uniqueID;
	document.getElementById("type").innerHTML = GenerateInterfaceText("●英語●Template●英語●●日本語●テンプレート●日本語●");
	var template_settings = document.getElementById(uniqueID + "_settings").innerHTML.split("|");
	document.getElementById("category_select").value = template_settings[0];
	document.getElementById("team_select").value = template_settings[1];
	document.getElementById("last_updated").innerHTML = template_settings[2];
	
	// type
	if(template_settings[3].indexOf("master") == 0) {
		if(e_type == 0) {
			document.getElementById("unique_id").innerHTML += "_COPY";
		}
		else {
			document.getElementById("type").innerHTML += "<i>(Master)</i>";
		}
	}
	else if(e_type == 1) {
		document.getElementById("type").innerHTML += "<i>(Master)</i>";
	}
	
	// Title
	var titles = document.getElementById(uniqueID).getElementsByClassName("data")[0].innerHTML;
	if(titles.indexOf("●英語●") >= 0) {
		document.getElementById("title_show_eng").innerHTML = titles.split("●英語●")[1];
	}
	else {
		document.getElementById("title_show_eng").innerHTML = "Not set";
	}
	if(titles.indexOf("●日本語●") >= 0) {
		document.getElementById("title_show_jap").innerHTML = titles.split("●日本語●")[1];
	}
	else {
		document.getElementById("title_show_jap").innerHTML = "未設定";
	}
	if(titles.indexOf("●その他●") >= 0) {
		document.getElementById("title_show_other").innerHTML = titles.split("●その他●")[1];
	}
	else {
		document.getElementById("title_show_other").innerHTML = "Not set　未設定";
	}
	
	// Content
	document.getElementById("input_boxes").innerHTML = "";
	var t_area = document.getElementById(uniqueID + "_content").getElementsByTagName("TEXTAREA");
	var i = 0;
	while(i < t_area.length-1) {
		// Create necessary textareas
		if(t_area[i].className.indexOf("●英語●") == 0) {
			SetLanguageTag('英語');
		}
		else if(t_area[i].className.indexOf("●日本語●") == 0) {
			SetLanguageTag('日本語');
		}
		else {
			SetLanguageTag('その他');
		}
		
		i = i + 1;
	}
	var i_area = document.getElementById("input_boxes").getElementsByTagName("TEXTAREA");
	i = 0;
	while(i < t_area.length-1) {
		i_area[i].value = t_area[i].value;
		
		i = i + 1;
	}
	
	// Open the tab and set up for editing
	TabHandler('ru_', 6);
	document.getElementById("edit_settings").style.display = "none";
	document.getElementById("edit_body").style.display = "block";
	
	document.getElementById("n_cat").style.display = "block";
	//document.getElementById("t_cat").style.display = "none";
	
	ShowEditBar(0);
}
function EditManual(uniqueID, e_type) {
	// If trying to edit as master do a login check
	if(e_type == 1) {
		if(LoginCheck() == false) {
			return;
		}
	}
	SetEditStatus(e_type);
	
	// Setup variables
	document.getElementById("unique_id").innerHTML = uniqueID;
	document.getElementById("type").innerHTML = GenerateInterfaceText("●英語●Manual●英語●●日本語●マニュアル●日本語●");
	var template_settings = document.getElementById(uniqueID + "_settings").innerHTML.split("|");
	document.getElementById("category_select").value = template_settings[0];
	document.getElementById("team_select").value = template_settings[1];
	document.getElementById("last_updated").innerHTML = template_settings[2];
	
	// type
	if(template_settings[3].indexOf("master") == 0) {
		if(e_type == 0) {
			document.getElementById("unique_id").innerHTML += "_COPY";
		}
		else {
			document.getElementById("type").innerHTML += "<i>(Master)</i>";
		}
	}
	else if(e_type == 1) {
		document.getElementById("type").innerHTML += "<i>(Master)</i>";
	}
	
	// Title
	var titles = document.getElementById(uniqueID).getElementsByClassName("data")[0].innerHTML;
	if(titles.indexOf("●英語●") >= 0) {
		document.getElementById("title_show_eng").innerHTML = titles.split("●英語●")[1];
	}
	else {
		document.getElementById("title_show_eng").innerHTML = "Not set";
	}
	if(titles.indexOf("●日本語●") >= 0) {
		document.getElementById("title_show_jap").innerHTML = titles.split("●日本語●")[1];
	}
	else {
		document.getElementById("title_show_jap").innerHTML = "未設定";
	}
	if(titles.indexOf("●その他●") >= 0) {
		document.getElementById("title_show_other").innerHTML = titles.split("●その他●")[1];
	}
	else {
		document.getElementById("title_show_other").innerHTML = "Not set　未設定";
	}
	
	// Content
	document.getElementById("input_boxes").innerHTML = "";
	var t_area = document.getElementById(uniqueID + "_content").getElementsByClassName("data")[0].innerHTML;
	// Create necessary textareas
	if(t_area.indexOf("●英語●") >= 0) {
		SetLanguageTag('英語');
	}
	if(t_area.indexOf("●日本語●") >= 0) {
		SetLanguageTag('日本語');
	}
	if(t_area.indexOf("●その他●") >= 0) {
		SetLanguageTag('その他');
	}
	var i_area = document.getElementById("input_boxes").getElementsByTagName("TEXTAREA");
	var i = 0;
	if(t_area.indexOf("●英語●") >= 0) {
		i_area[i].value = t_area.split("●英語●")[1];
		i = i + 1;
	}
	if(t_area.indexOf("●日本語●") >= 0) {
		i_area[i].value = t_area.split("●日本語●")[1];
		i = i + 1;
	}
	if(t_area.indexOf("●その他●") >= 0) {
		i_area[i].value = t_area.split("●その他●")[1];
	}
	
	// Open the tab and set up for editing
	TabHandler('ru_', 6);
	document.getElementById("edit_settings").style.display = "none";
	document.getElementById("edit_body").style.display = "block";
	
	document.getElementById("n_cat").style.display = "block";
	//document.getElementById("t_cat").style.display = "none";
	ShowEditBar(1);
}
function EditCContact(uniqueID, e_type) {
	// If trying to edit as master do a login check
	if(e_type == 1) {
		if(LoginCheck() == false) {
			return;
		}
	}
	SetEditStatus(e_type);
	
	// Setup variables
	document.getElementById("unique_id").innerHTML = uniqueID;
	document.getElementById("type").innerHTML = GenerateInterfaceText("●英語●Company Contact●英語●●日本語●会社連絡●日本語●");
	var template_settings = document.getElementById(uniqueID + "_settings").innerHTML.split("|");
	document.getElementById("target_select").value = template_settings[0];
	document.getElementById("team_select").value = template_settings[1];
	document.getElementById("last_updated").innerHTML = template_settings[2];
	
	// type
	if(template_settings[3].indexOf("master") == 0) {
		if(e_type == 0) {
			document.getElementById("unique_id").innerHTML += "_COPY";
		}
		else {
			document.getElementById("type").innerHTML += "<i>(Master)</i>";
		}
	}
	else if(e_type == 1) {
		document.getElementById("type").innerHTML += "<i>(Master)</i>";
	}
	
	// Title
	var titles = document.getElementById(uniqueID).getElementsByClassName("data")[0].innerHTML;
	if(titles.indexOf("●英語●") >= 0) {
		document.getElementById("title_show_eng").innerHTML = titles.split("●英語●")[1];
	}
	else {
		document.getElementById("title_show_eng").innerHTML = "Not set";
	}
	if(titles.indexOf("●日本語●") >= 0) {
		document.getElementById("title_show_jap").innerHTML = titles.split("●日本語●")[1];
	}
	else {
		document.getElementById("title_show_jap").innerHTML = "未設定";
	}
	if(titles.indexOf("●その他●") >= 0) {
		document.getElementById("title_show_other").innerHTML = titles.split("●その他●")[1];
	}
	else {
		document.getElementById("title_show_other").innerHTML = "Not set　未設定";
	}
	
	// Content
	document.getElementById("input_boxes").innerHTML = "";
	var t_area = document.getElementById(uniqueID + "_content").getElementsByTagName("TEXTAREA");
	var i = 0;
	while(i < t_area.length-1) {
		// Create necessary textareas
		if(t_area[i].className.indexOf("●英語●") == 0) {
			SetLanguageTag('英語');
		}
		else if(t_area[i].className.indexOf("●日本語●") == 0) {
			SetLanguageTag('日本語');
		}
		else {
			SetLanguageTag('その他');
		}
		
		i = i + 1;
	}
	var i_area = document.getElementById("input_boxes").getElementsByTagName("TEXTAREA");
	i = 0;
	while(i < t_area.length-1) {
		i_area[i].value = t_area[i].value;
		
		i = i + 1;
	}
	
	// Open the tab and set up for editing
	TabHandler('ru_', 6);
	document.getElementById("edit_settings").style.display = "none";
	document.getElementById("edit_body").style.display = "block";
	
	document.getElementById("n_cat").style.display = "block";
	//document.getElementById("t_cat").style.display = "block";
	
	ShowEditBar(0);
}
function EditAssist(uniqueID, e_type) {
	// If trying to edit as master do a login check
	if(e_type == 1) {
		if(LoginCheck() == false) {
			return;
		}
	}
	SetEditStatus(e_type);
	
	// Setup variables
	document.getElementById("unique_id").innerHTML = uniqueID;
	document.getElementById("type").innerHTML = GenerateInterfaceText("●英語●Assistant●英語●●日本語●サポート●日本語●");
	var template_settings = document.getElementById(uniqueID + "_settings").innerHTML.split("|");
	document.getElementById("category_select").value = template_settings[0];
	document.getElementById("team_select").value = template_settings[1];
	document.getElementById("last_updated").innerHTML = template_settings[2];
	
	// type
	if(template_settings[3].indexOf("master") == 0) {
		if(e_type == 0) {
			document.getElementById("unique_id").innerHTML += "_COPY";
		}
		else {
			document.getElementById("type").innerHTML += "<i>(Master)</i>";
		}
	}
	else if(e_type == 1) {
		document.getElementById("type").innerHTML += "<i>(Master)</i>";
	}
	
	// Title
	var titles = document.getElementById(uniqueID).getElementsByClassName("data")[0].innerHTML;
	if(titles.indexOf("●英語●") >= 0) {
		document.getElementById("title_show_eng").innerHTML = titles.split("●英語●")[1];
	}
	else {
		document.getElementById("title_show_eng").innerHTML = "Not set";
	}
	if(titles.indexOf("●日本語●") >= 0) {
		document.getElementById("title_show_jap").innerHTML = titles.split("●日本語●")[1];
	}
	else {
		document.getElementById("title_show_jap").innerHTML = "未設定";
	}
	if(titles.indexOf("●その他●") >= 0) {
		document.getElementById("title_show_other").innerHTML = titles.split("●その他●")[1];
	}
	else {
		document.getElementById("title_show_other").innerHTML = "Not set　未設定";
	}
	
	// Content
	// Set default empty input fields
	document.getElementById("input_boxes").innerHTML = '<div id="lang_settings" style="display:none"></div>';
	document.getElementById("input_boxes").innerHTML += '<h3>' + GenerateInterfaceText("●英語●Questions●英語●●日本語●質問●日本語●") + '</h3>';
	document.getElementById("input_boxes").innerHTML += '<div id="num_questions" style="display:none">0</div>';
	document.getElementById("input_boxes").innerHTML += '<div id="questions"></div>';
	document.getElementById("input_boxes").innerHTML += '<h3>' + GenerateInterfaceText("●英語●Answers●英語●●日本語●答え●日本語●") + '</h3>';
	document.getElementById("input_boxes").innerHTML += '<div id="num_answers" style="display:none">0</div>';
	document.getElementById("input_boxes").innerHTML += '<div id="answers"></div><br>';
	document.getElementById("input_boxes").innerHTML += '<div id="output_matrix"></div>';
	
	// Get settings
	var settings = document.getElementById(uniqueID + "_aset").innerHTML.split(",");
	
	// Set lang_settings
	document.getElementById("lang_settings").innerHTML = settings[0];
	
	// "Press" add question/add answer buttons the correct number of times
	var i = 0;
	while(i < settings[1]) {
		AddQuestion();
		
		i += 1;
	}
	i = 0;
	while(i < settings[2]) {
		AddAnswer();
		
		i += 1;
	}
	
	// Fill in questions + answers data
	var t_input = document.getElementById(uniqueID + "_content").getElementsByClassName("data");
	var i_box = document.getElementById("input_boxes").getElementsByTagName("INPUT");
	i = 0;
	var cnt = 0;
	while(i < (parseInt(settings[1]) + parseInt(settings[2]))) {
		var i_data = t_input[i].innerHTML.split("●");
		if(i_data.length >= 3) {
			i_box[cnt].value = i_data[2];
			cnt += 1;
		}
		if(i_data.length >= 7) {
			i_box[cnt].value = i_data[6];
			cnt += 1;
		}
		if(i_data.length >= 11) {
			i_box[cnt].value = i_data[10];
			cnt += 1;
		}
		
		i += 1;
	}
	
	// Fill in matrix data
	i = 0;
	while(i < Math.pow(2, settings[1])) {
		var m_data = document.getElementById(uniqueID + "_ct" + i).innerHTML.split("|");
		i_box[cnt].value = m_data[0];
		i_box[cnt+1].value = m_data[1];
		i_box[cnt+2].value = m_data[2];
		
		cnt += 3;
		i += 1;
	}
	
	// Open the tab and set up for editing
	TabHandler('ru_', 6);
	document.getElementById("edit_settings").style.display = "none";
	document.getElementById("edit_body").style.display = "block";
	
	document.getElementById("n_cat").style.display = "block";
	//document.getElementById("t_cat").style.display = "none";
	
	ShowEditBar(2);
}

function SaveComment(save_id) {
	save_id = save_id + "_comment";
	
	if(document.getElementById("own_comments").innerHTML.indexOf(save_id) > 0) {
		document.getElementById(save_id).innerHTML = document.getElementById(save_id + "_input").value;
	}
	else {
		document.getElementById("own_comments").innerHTML += "<div id=\"" + save_id + "\">" + document.getElementById(save_id + "_input").value + "</div>";
	}
}

function GenerateUID() {
	var user_id = json_data.Settings.user_id;
	var datetime = GenerateDateTime("yyyymmddHHMMSS");
	
	return user_id + datetime;
}

function GenerateDateTime(type) {
	var now = new Date();
	var output = "";
	
	// Check year
	var yyyy = now.getFullYear();
	if(type.indexOf("yyyy") >= 0) {
		output += yyyy;
	}
	else if(type.indexOf("yy") >= 0) {
		output += yyyy%100;
	}
	
	// Check month
	var mm = now.getMonth() + 1;
	if(type.indexOf("mm") >= 0) {
		if(mm < 10) {
			output += "0" + mm;
		}
		else {
			output += mm;
		}
	}
	else if(type.indexOf("m") >= 0) {
		output += mm;
	}
	
	// Check date
	var dd = now.getDate();
	if(type.indexOf("dd") >= 0) {
		if(dd < 10) {
			output += "0" + dd;
		}
		else {
			output += dd;
		}
	}
	else if(type.indexOf("d") >= 0) {
		output += dd;
	}
	
	// Check hours
	var HH = now.getHours();
	if(type.indexOf("HH") >= 0) {
		if(HH < 10) {
			output += "0" + HH;
		}
		else {
			output += HH;
		}
	}
	else if(type.indexOf("H") >= 0) {
		output += HH;
	}
	
	// Check minutes
	var MM = now.getMinutes();
	if(type.indexOf("MM") >= 0) {
		if(MM < 10) {
			output += "0" + MM;
		}
		else {
			output += MM;
		}
	}
	else if(type.indexOf("M") >= 0) {
		output += MM;
	}
	
	// Check seconds
	var SS = now.getSeconds();
	if(type.indexOf("SS") >= 0) {
		if(SS < 10) {
			output += "0" + SS;
		}
		else {
			output += SS;
		}
	}
	else if(type.indexOf("S") >= 0) {
		output += SS;
	}
	
	return output;
}

function AddQuestion() {
	// Temporarilly save the content
	var old_input_id = new Array();
	var old_input_value = new Array();
	if(document.getElementById("input_boxes").innerHTML.length > 0) {
		var i_box = document.getElementById("input_boxes").getElementsByTagName("INPUT");
		for(var c = 0; c < i_box.length; c++) {
			old_input_id.push(i_box[c].id);
			old_input_value.push(i_box[c].value);
		}
	}
	
	// Create necessary input boxes
	var num_questions = document.getElementById("num_questions").innerHTML;
	var lang_settings = document.getElementById("lang_settings").innerHTML.split("|");
	var output = '<div id="q' + num_questions + '"><b>Q' + num_questions + '</b>';
	for(var c = 0; c < lang_settings.length; c++) {
		var ls = lang_settings[c];
		if(ls.indexOf("english") == 0) {
			output += '<div><input id="q' + num_questions + 'english"><i>(English)</i></div>';
		}
		if(ls.indexOf("japanese") == 0) {
			output += '<div><input id="q' + num_questions + 'japanese"><i>(日本語)</i></div>';
		}
		if(ls.indexOf("other") == 0) {
			output += '<div><input id="q' + num_questions + 'other"><i>(Other その他)</i></div>';
		}
	}
	output += '</div>';
	document.getElementById("questions").innerHTML += output;
	document.getElementById("num_questions").innerHTML = parseInt(num_questions) + 1;
	
	// Update output matrix (table)
	document.getElementById("output_matrix").innerHTML = GenerateOutputMatrix(parseInt(num_questions) + 1);
	
	// Restore data
	var i = 0;
	while(i < old_input_id.length) {
		document.getElementById(old_input_id[i]).value = old_input_value[i];
		
		i += 1;
	}
}
function GenerateOutputMatrix(num_questions) {
	var output = '<table>';
	
	var rows = Math.pow(2, num_questions);
	var cols = num_questions + 3;
	
	// Header row
	output += '<tr>';
	var i = 0;
	while(i < num_questions) {
		output += '<th>Q' + (num_questions - i - 1) + '</th>';
		
		i += 1;
	}
	output += '<th>' + GenerateInterfaceText("●英語●Normal●英語●●日本語●通常●日本語●") + '</th>';
	output += '<th>' + GenerateInterfaceText("●英語●Alternative●英語●●日本語●代替案●日本語●") + '</th>';
	output += '<th>' + GenerateInterfaceText("●英語●Other●英語●●日本語●その他●日本語●") + '</th>';
	output += '</tr>';
	
	// Table body
	i = 0;
	while(i < rows) {
		output += '<tr>';
		
		var looper = rows;
		var b_cnt = 1 << (num_questions - 1);
		
		// Content
		var cnt = 0;
		while(cnt < num_questions) {
			if((i&b_cnt) > 0) {
				output += '<td>●</td>';
			}
			else {
				output += '<td></td>';
			}
			
			b_cnt = b_cnt >> 1;
			cnt += 1;
		}
		output += '<th><input id="' + i + 'th_row_n" type="number"></th>';
		output += '<th><input id="' + i + 'th_row_na" type="number"></th>';
		output += '<th><input id="' + i + 'th_row_a" type="number"></th>';
		
		output += '</tr>';
		
		i += 1;
	}
	
	output += '</table>';
	return output;
}
function AddAnswer() {
	// Temporarilly save the content
	var old_input_id = new Array();
	var old_input_value = new Array();
	if(document.getElementById("input_boxes").innerHTML.length > 0) {
		var i_box = document.getElementById("input_boxes").getElementsByTagName("INPUT");
		for(var c = 0; c < i_box.length; c++) {
			old_input_id.push(i_box[c].id);
			old_input_value.push(i_box[c].value);
		}
	}
	
	// Create necessary input boxes
	var num_answers = document.getElementById("num_answers").innerHTML;
	var lang_settings = document.getElementById("lang_settings").innerHTML.split("|");
	var output = '<div id="a' + num_answers + '"><b>A' + num_answers + '</b>';
	for(var c = 0; c < lang_settings.length; c++) {
		var ls = lang_settings[c];
		if(ls.indexOf("english") == 0) {
			output += '<div><input id="a' + num_answers + 'english"><i>(English)</i></div>';
		}
		if(ls.indexOf("japanese") == 0) {
			output += '<div><input id="a' + num_answers + 'japanese"><i>(日本語)</i></div>';
		}
		if(ls.indexOf("other") == 0) {
			output += '<div><input id="a' + num_answers + 'other"><i>(Other その他)</i></div>';
		}
	}
	output += '</div>';
	document.getElementById("answers").innerHTML += output;
	document.getElementById("num_answers").innerHTML = parseInt(num_answers) + 1;
	
	// Restore data
	var i = 0;
	while(i < old_input_id.length) {
		document.getElementById(old_input_id[i]).value = old_input_value[i];
		
		i += 1;
	}
}

function AddTitle(identifier) {
	document.getElementById("title_show_" + identifier).innerHTML = document.getElementById("title").value;
}

function CreateTable(myField) {
	// Break if no textarea has been selected
	if(document.getElementById(myField).innerHTML.length == 0) { return; }
	
	myField = document.getElementById(document.getElementById(myField).innerHTML);
	var rows = parseInt(document.getElementById("rows").value);
	var cols = parseInt(document.getElementById("cols").value);
	var output = "";
	
	output = "<table>\n";
	var i;
	var j;
	for(i = 0; i < rows; i++) {
		output += "  <tr>\n";
		for(j = 0; j < cols; j++) {
			output += "    <td>" + i + j + "</td>\n";
		}
		output += "  </tr>\n";
	}
	output += "</table>";
	
	insertAtCursor(myField, output);
}

function SetLanguageTag(language) {
	// Break if no edit has been started
	if(document.getElementById("unique_id").innerHTML.length == 0) {
		return;
	}
	
	// Parse language
	var class_language = "other";
	var display_language = "Other / その他";
	if(language.indexOf("英語") == 0) {
		class_language = "english";
		display_language = "English";
	}
	if(language.indexOf("日本語") == 0) {
		class_language = "japanese";
		display_language = "日本語";
	}
	
	// Break if textarea already exists, exception is templates
	if(document.getElementById("type").innerHTML.indexOf("Template") == -1 && document.getElementById("input_boxes").innerHTML.indexOf(class_language) >= 0) {
		return;
	}
	
	// Special procedures for assistant
	if(document.getElementById("type").innerHTML.indexOf("Assistant") >= 0) {
		AddAssistantLanguage(class_language, display_language);
		return;
	}
	
	// Temporarilly save the content
	var current_data = document.getElementById("input_boxes").getElementsByTagName("TEXTAREA");
	document.getElementById("temp_save").innerHTML = "";
	var i = 0;
	while(i < current_data.length) {
		document.getElementById("temp_save").innerHTML += current_data[i].value + "|";
		
		i += 1;
	}
	
	// Create new textarea
	var output = "";
	if(document.getElementById("input_boxes").innerHTML > 0) {
		output = "<br>";
	}
	output += "<b>" + display_language + "</b><br>";
	output += '<textarea id="' + class_language + GenerateUID() + g_i + '" class="textarea_edit ' + class_language + '" onclick="SelectTextarea(this)"></textarea>';
	g_i += 1;
	document.getElementById("input_boxes").innerHTML += output;
	
	// Restore data
	current_data = document.getElementById("input_boxes").getElementsByTagName("TEXTAREA");
	var old_data = document.getElementById("temp_save").innerHTML.split("|");
	i = 0;
	while(i < current_data.length) {
		current_data[i].value = old_data[i];
		
		i += 1;
	}
}

function AddAssistantLanguage(class_language, display_language) {
	// Temporarilly save the content
	var old_input_id = new Array();
	var old_input_value = new Array();
	var num_questions = 0;
	var num_answers = 0;
	if(document.getElementById("input_boxes").innerHTML.length > 0) {
		var i_box = document.getElementById("input_boxes").getElementsByTagName("INPUT");
		for(var c = 0; c < i_box.length; c++) {
			old_input_id.push(i_box[c].id);
			old_input_value.push(i_box[c].value);
		}
		
		num_questions = document.getElementById("num_questions").innerHTML;
		num_answers = document.getElementById("num_answers").innerHTML;
	}
	
	// Create necessary input boxes
	var i = 0;
	while(i < num_questions) {
		document.getElementById("q" + i).innerHTML += "<div><input id=\"q" + i  + class_language + "\" type=\"text\"><i>(" + display_language + ")</i></div>";
		
		i += 1;
	}
	i = 0;
	while(i < num_answers) {
		document.getElementById("a" + i).innerHTML += "<div><input id=\"a" + i  + class_language + "\" type=\"text\"><i>(" + display_language + ")</i></div>";
		
		i += 1;
	}
	
	// Update language settings
	if(document.getElementById("lang_settings").innerHTML.length > 0) {
		document.getElementById("lang_settings").innerHTML += "|" + class_language;
	}
	else {
		document.getElementById("lang_settings").innerHTML = class_language;
	}
	
	// Restore data
	i = 0;
	while(i < old_input_id.length) {
		document.getElementById(old_input_id[i]).value = old_input_value[i];
		
		i += 1;
	}
}

function SetBackground(myField, input) {
	// Break if no textarea has been selected
	if(document.getElementById(myField).innerHTML.length == 0) { return; }
	
	input = document.getElementById(input).value;
	myField = document.getElementById(document.getElementById(myField).innerHTML);
	var output = "";
	
	//IE support
	if (document.selection) {
		myField.focus();
		sel = document.selection.createRange();
		output = "<span style=\"background-color:" + input + ";\">" + sel.text + "</span>";
	}
	//MOZILLA and others
	else if (myField.selectionStart || myField.selectionStart == '0') {
		var startPos = myField.selectionStart;
		var endPos = myField.selectionEnd;
		output = "<span style=\"background-color:" + input + ";\">" + myField.value.substring(startPos, endPos) + "</span>";
	}
	else {
		output = "<span style=\"background-color:" + input + ";\"></span>";
	}
	
	insertAtCursor(myField, output);
}

function SetTextcolor(myField, input) {
	// Break if no textarea has been selected
	if(document.getElementById(myField).innerHTML.length == 0) { return; }
	
	input = document.getElementById(input).value;
	myField = document.getElementById(document.getElementById(myField).innerHTML);
	var output = "";
	
	//IE support
	if (document.selection) {
		myField.focus();
		sel = document.selection.createRange();
		output = "<span style=\"color:" + input + ";\">" + sel.text + "</span>";
	}
	//MOZILLA and others
	else if (myField.selectionStart || myField.selectionStart == '0') {
		var startPos = myField.selectionStart;
		var endPos = myField.selectionEnd;
		output = "<span style=\"color:" + input + ";\">" + myField.value.substring(startPos, endPos) + "</span>";
	}
	else {
		output = "<span style=\"color:" + input + ";\"></span>";
	}
	
	insertAtCursor(myField, output);
}

function TagText(myField, tag) {
	// Break if no textarea has been selected
	if(document.getElementById(myField).innerHTML.length == 0) { return; }
	
	myField = document.getElementById(document.getElementById(myField).innerHTML);
	var output = "";
	
	//IE support
	if (document.selection) {
		myField.focus();
		sel = document.selection.createRange();
		output = "<" + tag + ">" + sel.text + "</" + tag + ">";
	}
	//MOZILLA and others
	else if (myField.selectionStart || myField.selectionStart == '0') {
		var startPos = myField.selectionStart;
		var endPos = myField.selectionEnd;
		output = "<" + tag + ">" + myField.value.substring(startPos, endPos) + "</" + tag + ">";
	}
	else {
		output = "<" + tag + "></" + tag + ">";
	}
	
	insertAtCursor(myField, output);
}

function SingelTagText(myField, tag) {
	// Break if no textarea has been selected
	if(document.getElementById(myField).innerHTML.length == 0) { return; }
	
	myField = document.getElementById(document.getElementById(myField).innerHTML);
	insertAtCursor(myField, tag);
}

function AddImage(myField) {
	// Break if no textarea has been selected
	if(document.getElementById(myField).innerHTML.length == 0) { return; }
	
	myField = document.getElementById(document.getElementById(myField).innerHTML);
	var image_link = "images/" + document.getElementById("image_link").value;
	insertAtCursor(myField, "<img src=\"" + image_link + "\" alt=\"" + image_link + "\">");
}

function AddSearchButton(myField) {
	// Break if no textarea has been selected
	if(document.getElementById(myField).innerHTML.length == 0) { return; }
	
	// Get relevant input data
	myField = document.getElementById(document.getElementById(myField).innerHTML);
	var search_frase = document.getElementById("search_word").value;
	var search_option = document.getElementById("search_type").value;
	
	// Determine type id
	var type_id = -1;
	if(search_option.indexOf("template") == 0) {
		type_id = 0;
	}
	if(search_option.indexOf("manual") == 0) {
		type_id = 1;
	}
	if(search_option.indexOf("ccontact") == 0) {
		type_id = 2;
	}
	if(search_option.indexOf("assist") == 0) {
		type_id = 3;
	}

	type_id = -1;
	
	// Add button
	insertAtCursor(myField, '<button onclick="ShowContent(' + type_id + ', \'\', \'' + search_frase + '\')">' + search_frase + '</button>');
}

function insertAtCursor(myField, myValue) {
	//IE support
	if (document.selection) {
		myField.focus();
		sel = document.selection.createRange();
		sel.text = myValue;
	}
	//MOZILLA and others
	else if (myField.selectionStart || myField.selectionStart == '0') {
		var startPos = myField.selectionStart;
		var endPos = myField.selectionEnd;
		myField.value = myField.value.substring(0, startPos) + myValue + myField.value.substring(endPos, myField.value.length);
		myField.selectionStart = startPos + myValue.length;
		myField.selectionEnd = startPos + myValue.length;
	}
	else {
		myField.value += myValue;
	}
}

function Debug(message) {
	document.getElementById("debug").innerHTML = message;
}

function SetEditStatus(type) {
	if(type == 0) {
		// Personal
		document.getElementById("login").style.display = "none";
		document.getElementById("current_mode").innerHTML = "Personal";
	}
	else {
		// Master
		document.getElementById("login").style.display = "inline";
		if(document.getElementById("password").value.length > 0) {
			Login();
		}
	}
}

function Login() {
	var password = document.getElementById("password").value;
	if(password.indexOf("amiami") == 0 && password.length == 6) {
		document.getElementById("login").style.display = "none";
		document.getElementById("current_mode").innerHTML = "Master";
	}
}

function LoginCheck() {
	var password = document.getElementById("password").value;
	if(password.indexOf("amiami") == 0 && password.length == 6) {
		return true;
	}
	
	alert("Please login from the Edit layout\n編集レイアウトからログインしてください。");
	return false;
}

/***************\
/ External load |
/***************/

function includeHTML() {
	var z, i, elmnt, file, xhttp;
	/*loop through a collection of all HTML elements:*/
	z = document.getElementsByTagName("*");
	for (i = 0; i < z.length; i++) {
		elmnt = z[i];
		/*search for elements with a certain atrribute:*/
		file = elmnt.getAttribute("w3-include-html");
		if (file) {
			document.getElementById("input_master").value = "Loading...";

			/*make an HTTP request using the attribute value as the file name:*/
			xhttp = new XMLHttpRequest();
			xhttp.onreadystatechange = function() {
				if (this.readyState == 4) {
					if (this.status == 200) {
						if (this.responseText.indexOf('{"Settings":') >= 0) {
							extMaster = JSON.parse(this.responseText);
						}
						else {
							elmnt.innerHTML = this.responseText;
						}
						document.getElementById("input_master").disabled = true;
						document.getElementById("input_master").value += "Loaded!";
					}
					else {
//					if (this.status == 404) {
						document.getElementById("input_master").disabled = false;
						document.getElementById("input_master").value += "Data not found.";
					}

					// Enable load button when done
					document.getElementById("load_button").disabled = false;

					/*remove the attribute, and call this function once more:*/
					elmnt.removeAttribute("w3-include-html");
					includeHTML();
				}
			}
			d = new Date();
			xhttp.open("GET", file + "?t=" + d.getTime(), true);
			xhttp.send();
			/*exit the function:*/
			return;
		}
	}
}

/***************************************\
/ Find order number and email addresses |
/***************************************/

function getIndexToUpdate(theArray,data){
	//return values
	//-1: Ignore
	//0-999: Update this index
	//1000: Add new index
	
	//Ignore e_support@amiami.com
	if("e_support@amiami.com".indexOf(data)>=0){
		return -1;//already exists
	}
	
	var i = 0;
	while(i < theArray.length){
		//is theArray[i] part of data?
		if(data.indexOf(theArray[i])>=0){
			return i;//need update
		}
		//is data part of theArray[i]?
		if(theArray[i].indexOf(data)>=0){
			return -1;//already exists
		}
		
		i = i + 1;
	}
	return 1000;//new entry
}
function findordernumemail() {
	var outData = new Array();
	var inputstring = document.getElementById("all_inputfield").value;
	var emailstring = inputstring;
	inputstring = inputstring.replace(/ /g,"");
	inputstring = inputstring.replace(/\n/g,"");
	inputstring = inputstring.replace(/>/g,"");
	
	// Order number
	var next2index = inputstring.indexOf("2");
	var next7index = inputstring.indexOf("7");
	var output = "";
	while(next2index >= 0 || next7index >= 0) {
		if(next2index  != -1) {
			output = getordernumber(inputstring, next2index);
			if(output.indexOf("0") != 1 && output.indexOf("1") != 1) {
				output = "";
			}
			if(output.length > 0){
				var flag = getIndexToUpdate(outData, output);
				if(flag==1000){
					outData.push(output);
				}
				else if(flag >= 0){
					outData[flag]=output;
				}
			}
			var nextat = inputstring.slice(next2index+1).indexOf("2");
			if(nextat >= 0) {
				next2index += nextat + 1;
			}
			else {
				next2index = nextat;
			}
		}
		else {
			output = getordernumber(inputstring, next7index);
			if(output.indexOf("2") != 1) {
				output = "";
			}
			if(output.length > 0){
				var flag = getIndexToUpdate(outData, output);
				if(flag==1000){
					outData.push(output);
				}
				else if(flag >= 0){
					outData[flag]=output;
				}
			}
			var nextat = inputstring.slice(next7index+1).indexOf("7");
			if(nextat >= 0) {
				next7index += nextat + 1;
			}
			else {
				next7index = nextat;
			}
		}
	}
	
	// Email
	var nextATindex = emailstring.indexOf("@");
	while(nextATindex > 0) {
		output = getemail(emailstring, nextATindex);
		if(output.length > 0){
			var flag = getIndexToUpdate(outData, output);
			if(flag==1000){
				outData.push(output);
			}
			else if(flag >= 0){
				outData[flag]=output;
			}
		}
		var nextat = emailstring.slice(nextATindex+1).indexOf("@");
		if(nextat > 0) {
			nextATindex += nextat + 1;
		}
		else {
			nextATindex = nextat;
		}
	}
	
	// Result
	if(outData.length>=0){
		var i = 1;
		document.getElementById("s_result").innerHTML = outData[0];
		while(i<outData.length){
			document.getElementById("s_result").innerHTML += "<br>" + outData[i];
			
			i = i + 1;
		}
	}
	
	// Clear input field
	document.getElementById("all_inputfield").value = "";
}

/************************************************************
*  Find order number function
*/
function getordernumber(inputstring, index) {
	var retval = "";
	var type = 0;
	var tempstring = "";
	var cnt = 1;
	
	tempstring += inputstring.charAt(index);
	if(type == 0) {
		while(cnt + index < inputstring.length && type == 0) {
			if(inputstring.charCodeAt(cnt + index) > 47 && inputstring.charCodeAt(cnt + index) < 58) {
				tempstring += inputstring.charAt(cnt + index);
				cnt++;
			}
			else if(inputstring.charAt(cnt + index) == "-") {
				if(cnt == 3) {
					type = 1;
					index++;
				}
				else if (cnt == 6) {
					type = 2;
					tempstring += inputstring.charAt(cnt + index);
					cnt++;
				}
				else {
					return retval;
				}
			}
			else {
				return retval;
			}
			if(cnt == 9) {
				retval = tempstring;
				return retval;
			}
		}
	}
	if(type == 1) {
		while(cnt + index < inputstring.length && type == 1) {
			if(inputstring.charCodeAt(cnt + index) > 47 && inputstring.charCodeAt(cnt + index) < 58) {
				tempstring += inputstring.charAt(cnt + index);
				cnt++;
			}
			else if(inputstring.charAt(cnt + index) == "-") {
				if(cnt == 6) {
					index++;
				}
				else {
					return retval;
				}
			}
			else {
				return retval;
			}
			if(cnt == 9) {
				retval = tempstring;
				return retval;
			}
		}
	}
	if(type == 2) {// Rakuten order ######-########-## 9-10 ##
		while(cnt + index < inputstring.length && type == 2) {
			if(inputstring.charCodeAt(cnt + index) > 47 && inputstring.charCodeAt(cnt + index) < 58) {
				tempstring += inputstring.charAt(cnt + index);
				cnt++;
			}
			else if(inputstring.charAt(cnt + index) == "-") {
				if(cnt == 15) {
					tempstring += inputstring.charAt(cnt + index);
					cnt++;
				}
				else {
					if(cnt >= 23) {
						retval = tempstring;
					}
					return retval;
				}
			}
			else {
				if(cnt >= 23) {
					retval = tempstring;
				}
				return retval;
			}
		}
	}
	
	return retval;
}
function getemail(inputstring, index) {
	var retval = "";
	var tempstring = "@";
	
	// Front part
	var fcnt = index - 1;
	while(fcnt >= 0) {
		var ccode = inputstring.charCodeAt(fcnt);
		if(ccode >= 97 && ccode <= 122) {
			tempstring = inputstring.charAt(fcnt) + tempstring;
			fcnt--;
		}
		else if(ccode >= 65 && ccode <= 90) {
			tempstring = inputstring.charAt(fcnt) + tempstring;
			fcnt--;
		}
		else if(ccode >= 48 && ccode <= 57) {
			tempstring = inputstring.charAt(fcnt) + tempstring;
			fcnt--;
		}
		else if(ccode == 43 || ccode == 45 || ccode == 46 || ccode == 95) {
			tempstring = inputstring.charAt(fcnt) + tempstring;
			fcnt--;
		}
		else {
			break;
		}
	}
	
	// Back part
	var bcnt = index + 1;
	while(bcnt < inputstring.length) {
		var ccode = inputstring.charCodeAt(bcnt);
		if(ccode >= 97 && ccode <= 122) {
			tempstring = tempstring + inputstring.charAt(bcnt);
			bcnt++;
		}
		else if(ccode >= 65 && ccode <= 90) {
			tempstring = tempstring + inputstring.charAt(bcnt);
			bcnt++;
		}
		else if(ccode >= 48 && ccode <= 57) {
			tempstring = tempstring + inputstring.charAt(bcnt);
			bcnt++;
		}
		else if(ccode == 43 || ccode == 45 || ccode == 46 || ccode == 95) {
			tempstring = tempstring + inputstring.charAt(bcnt);
			bcnt++;
		}
		else {
			break;
		}
	}
	
	if(index - fcnt > 1 && bcnt - index > 1) {
		retval = tempstring;
	}
	return retval;
}

/*********************
 * 
 *  JSON data
 * 
 *  1. Language => lg_language.js
 *  2. Content
 * 
 */