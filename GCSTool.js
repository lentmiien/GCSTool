/**********************************************
*
*                 VARIABLES
*
**********************************************/

var g_i = 1;

var category_keys = [
	"_account_related_",
	"_order_item_statuses_",
	"_order_modifying_",
	"_payment_shipping_",
	"_after_service_shipping_",
	"_after_service_defect_",
	"_after_service_preowned_",
	"_returns_refunds_",
	"_claims_cases_",
	"_work_related_",
	"_case_assist_",
	"_customer_dep_",
	"_logistics_dep_",
	"_feedback_",
	"_other_"
];

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

		// Refresh the search page
		document.getElementById('last_updated').innerHTML = "DELETED";
		News();
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
	
	// Load Master data from server
	includeHTML();

	// Load JSON Personal data if existing
	if (localStorage.hasOwnProperty("json_personal") == true) {
		extPersonal = JSON.parse(localStorage.getItem("json_personal"));
		document.getElementById("input_personal").value = 'Loaded!';

		document.getElementById("color_mode").value = extPersonal.Settings.style;
		document.getElementById("lg_language").value = extPersonal.Settings.i_language;
	}
	else {
		document.getElementById("input_personal").value = 'New user, leave empty.';
	}
	
	// Update interface to correct language
	UpdateLanguage('lg_language');

	// Auto-start
	setTimeout(AutoStart, 500);
}

function AutoStart() {
	if((document.getElementById('input_personal').value.indexOf('Loaded!') == 0 || document.getElementById('input_personal').value.indexOf('New user, leave empty.') == 0) && document.getElementById('input_master').value.indexOf('Loading...Loaded!') == 0) {
		LoadData();
	}
}

// Do some initial setup
function Setup() {
	var i = 0;
	var output = "";
	
	// Edit category
	for(i = 0; i < category_keys.length; i++) {
		output += '<option value="' + category_keys[i] + '" lg_language="' + category_keys[i] + '">' + GetData(category_keys[i]) + '</option>';
	}
	document.getElementById("category").innerHTML = '<div id="n_cat"><select id="category_select">' + output + '</select></div>';
	// Search category
	document.getElementById("cat_sel").innerHTML += output;
	
	// Set team
	output = '<select id="team_select">';
	for(var key in teams) { output += '<option value="' + key + '">' + teams[key] + '</option>'; }
	output += '</select>';
	document.getElementById("team").innerHTML = output;
	
	// Reminders
	SetReminderFunction("16:59", "ShowDocuments()");
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
			//document.getElementById(prefix + cnt + "_btn").style.color = "yellow";
		}
		else {
			document.getElementById(prefix + cnt + "_" + v_total).style.display = "none";
			//document.getElementById(prefix + cnt + "_btn").style.color = "white";
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
		}
	}
	
	// Focus search box
	if(v_id == 1) {
		document.getElementById("all_inputfield").focus();
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
	document.getElementById("counter").innerHTML = "-1";
	document.getElementById("left_to_check").innerHTML = "0/" + num_entries;
	
	// Stop if no data
	if(num_entries <= 0) {
		return;
	}

	// Start by showing the next entry to check
	Next();
	
	// Show Approve layout
	document.getElementById("run").style.display = "none";
	document.getElementById("menubar").style.display = "none";
	document.getElementById("approve").style.display = "block";
}

// Adjusted to json
function Approve(type) {
	// Add to current data
	
	// Get data
	var cnt = parseInt(document.getElementById("counter").innerHTML);
	var entries = JSON.parse(document.getElementById("save_out").value);

	var isMaster = false;
	var thisID = entries.Entries[cnt].uid;
	if (type == 1) {
		isMaster = true;
		if (thisID.indexOf('_COPY') >= 0) {
			thisID = thisID.slice(0, -5);
		}
	}
	
	// Save
	SaveDataToJSON(
		thisID,
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
		// Display any existing entries
		document.getElementById("current_master").innerHTML = "";
		var true_id = entries.Entries[cnt].uid;
		if (true_id.indexOf("_COPY") >= 0) {
			true_id = true_id.slice(0, -5);
			var j_index = ExistJSON(true_id);
			if (j_index >= 0) {
				document.getElementById("current_master").innerHTML += '<h2>' + GetData('_original_entry_') + '</h2>';
				document.getElementById("current_master").innerHTML += '<h3>' + json_data.Entries[j_index].data.Title + '</h3>';
				if (json_data.Entries[j_index].type.indexOf("manual") >= 0) {
					for (var c = 0; c < json_data.Entries[j_index].data.Content.length; c++) {
						document.getElementById("current_master").innerHTML += '<div class="entry">' + json_data.Entries[j_index].data.Content[c] + '</div>';
					}
				}
				else {
					for (var c = 0; c < json_data.Entries[j_index].data.Content.length; c++) {
						document.getElementById("current_master").innerHTML += '<textarea>' + json_data.Entries[j_index].data.Content[c] + '</textarea>';
					}
				}
				document.getElementById("current_master").innerHTML += '<div style="background-color:blue;">' + json_data.Entries[j_index].history + '</div>';
			}
		}

		// Display the suggested entry
		document.getElementById("suggested_entry").innerHTML = '<h2>' + GetData('_suggested_entry_') + '</h2>';
		document.getElementById("suggested_entry").innerHTML += '<h3>' + entries.Entries[cnt].data.Title + '</h3>';
		if (entries.Entries[cnt].type.indexOf("manual") >= 0) {
			for (var c = 0; c < entries.Entries[cnt].data.Content.length; c++) {
				document.getElementById("suggested_entry").innerHTML += '<div class="entry">' + entries.Entries[cnt].data.Content[c] + '</div>';
			}
		}
		else {
			for (var c = 0; c < entries.Entries[cnt].data.Content.length; c++) {
				document.getElementById("suggested_entry").innerHTML += '<textarea>' + entries.Entries[cnt].data.Content[c] + '</textarea>';
			}
		}
		document.getElementById("suggested_entry").innerHTML += '<div style="background-color:blue;">' + entries.Entries[cnt].history + '</div>';
	}
	else {
		Back();
	}
}

function Back() {
	document.getElementById("run").style.display = "block";
	document.getElementById("menubar").style.display = "block";
	document.getElementById("approve").style.display = "none";

	News();
}

function ShowEditBar(id) {
	document.getElementById("editbar_text").style.display = "none";
	document.getElementById("editbar_html").style.display = "none";
	
	if(id == 0) {
		document.getElementById("editbar_text").style.display = "block";
	}
	if(id == 1) {
		document.getElementById("editbar_html").style.display = "block";
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
	
	ExpSearch();
}

// Select + Copy + Show "Copy" animation
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

// Resize the text box
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
			ExpSearch();
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
		ExpSearch();
	}
	
	// Check for "-" input
	if(inputValue[inputValue.length-1] == "-") {
		document.getElementById(prefix + "stext").innerHTML  = "";
		document.getElementById(prefix + "inputfield").value = "";
		document.getElementById(prefix + "tags").innerHTML = "";
		ExpSearch();
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
				output += "<i class=\"label\">" + GetData('_' + text_input + '_') + "</i>";

				// Master / Private
				if (json_data.Entries[i].ismaster == true) {
					output += "<i class=\"label master" + "\" style=\"float:right;\">Master</i>";
				}
				else {
					output += "<i class=\"label private" + "\" style=\"float:right;\">Private</i>";
				}

				output += '<br><div id="c_' + myID + '" style="display:none;">';
				output += '<button onclick="EditEntry(' + i + ')">' + GetData('_edit_') + '</button>';
				if (json_data.Entries[i].ismaster == true) {
					output += '<button onclick="EditEntryCopy(' + i + ')">' + GetData('_edit_copy_') + '</button><br>';
				}
				for (var cd = 0; cd < json_data.Entries[i].data.Content.length; cd++) {
					if (json_data.Entries[i].type.indexOf('manual') == 0) {
						output += '<div>' + json_data.Entries[i].data.Content[cd] + '</div>';
					}
					else {
						output += '<textarea style="width: 100%; height: 135px;" onclick="Selector(this)" readonly>' + json_data.Entries[i].data.Content[cd] + '</textarea>';
					}
				}

				// Display update history
				output += '<hr><div>' + json_data.Entries[i].history + '</div>'
				
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

function ViewAll() {
	document.getElementById("s_result").innerHTML = "";
	for (var i = 0; i < json_data.Entries.length; i++) {
		var myID = json_data.Entries[i].uid;
		var class_name = json_data.Entries[i].type;
		var text_input = json_data.Entries[i].type;

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
	}
}

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
	var category_to_check = document.getElementById("cat_sel").value;

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
					for (var n = 0; n < json_data.Entries[u].data.Content.length; n++) {
						if (json_data.Entries[u].data.Content[n].toLowerCase().indexOf(multiwords[h].toLowerCase()) >= 0) {
							sub_find = true;
						}
					}

					h = h + 1;
				}
				if (sub_find == false) {
					found = false;
				}
			}
			else {
				// One word search
				var sub_find = false;
				if (json_data.Entries[u].data.Title.toLowerCase().indexOf(words[k].toLowerCase()) >= 0) {
					sub_find = true;
				}
				for (var n = 0; n < json_data.Entries[u].data.Content.length; n++) {
					if(json_data.Entries[u].data.Content[n] == null) {
						document.getElementById("debug").innerHTML += "ERROR: (" + json_data.Entries[u].uid + ") null content data...<br>";
					}
					else {
						if (json_data.Entries[u].data.Content[n].toLowerCase().indexOf(words[k].toLowerCase()) >= 0) {
							sub_find = true;
						}
					}
				}
				if (sub_find == false) {
					found = false;
				}
			}

			k = k + 1;
		}
		if (found == true && types_to_check.indexOf(json_data.Entries[u].type) >= 0 && json_data.Entries[u].category.indexOf(category_to_check) >= 0) {
			var class_name = json_data.Entries[u].type;
			var text_input = json_data.Entries[u].type;

			var output = "<div class=\"entry " + class_name + "\"><button class=\"title_button " + json_data.Entries[u].category + "\" onclick=\"DisplayEntry('" + myID + "')\">" + json_data.Entries[u].data.Title + "</button>";

			// Type of entry
			output += "<i class=\"label\">" + GetData('_' + text_input + '_') + "</i>";

			// Master / Private
			if (json_data.Entries[u].ismaster) {
				output += "<i class=\"label master" + "\" style=\"float:right;\">Master</i>";
			}
			else {
				output += "<i class=\"label private" + "\" style=\"float:right;\">Private</i>";
			}

			output += '<br><div id="c_' + myID + '" style="display:none;">';
			output += '<button onclick="EditEntry(' + u + ')">' + GetData('_edit_') + '</button>';
			if (json_data.Entries[u].ismaster == true) {
				output += '<button onclick="EditEntryCopy(' + u + ')">' + GetData('_edit_copy_') + '</button><br>';
			}
			for (var cd = 0; cd < json_data.Entries[u].data.Content.length; cd++) {
				if (json_data.Entries[u].type.indexOf('manual') == 0) {
					output += '<div>' + json_data.Entries[u].data.Content[cd] + '</div>';
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

// Do a search
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
	}
	else {
		json_data = extMaster;
		UpdateJSONSettings();
	}

	FinalizeLoadData();
}

function FinalizeLoadData() {
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
	
	// Some basic interface setups
	Setup();

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
	output += '<h3>' + GetData('_templates_') + '</h3>';
	for(i = 0; i < json_data.Entries.length; i++) {
		if (json_data.Entries[i].type.indexOf("template") == 0 && json_data.Entries[i].ismaster == false) {
			output += '<input type="checkbox" id="check_' + i + '" class="templates">' + json_data.Entries[i].data.Title + '<br>';
		}
	}
	
	output += "<hr>";
	
	// Manual
	output += '<h3>' + GetData('_manual_') + '</h3>';
	for (i = 0; i < json_data.Entries.length; i++) {
		if (json_data.Entries[i].type.indexOf("manual") == 0 && json_data.Entries[i].ismaster == false) {
			output += '<input type="checkbox" id="check_' + i + '" class="manual">' + json_data.Entries[i].data.Title + '<br>';
		}
	}
	
	output += "<hr>";
	
	// Ccontact
	output += '<h3>' + GetData('_ccontact_') + '</h3>';
	for (i = 0; i < json_data.Entries.length; i++) {
		if (json_data.Entries[i].type.indexOf("ccontact") == 0 && json_data.Entries[i].ismaster == false) {
			output += '<input type="checkbox" id="check_' + i + '" class="ccontact">' + json_data.Entries[i].data.Title + '<br>';
		}
	}
	
	output += "<hr>";
	
	// Display list
	output += '<button onclick="SetShareData()" style="background-color:red;">' + GetData('_generate_data_') + '</button><br><hr>';
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

	// JSON save
	var json_save = {
		Settings: {},
		Entries: []
	};
	var saved_ids = "";
	json_save.Settings = json_data.Settings;
	for(var x = 0; x < category_keys.length; x++) {
		var ckey = category_keys[x];
		for (i = 0; i < json_data.Entries.length; i++) {
			if (json_data.Entries[i].category.indexOf(ckey) >= 0 && saved_ids.indexOf('|' + json_data.Entries[i].uid + '|') == -1 && json_data.Entries[i].ismaster == false) {
				// Save to output
				saved_ids += '|' + json_data.Entries[i].uid + '|';
				json_save.Entries.push(json_data.Entries[i])
			}
		}
	}
	localStorage.setItem("json_personal", JSON.stringify(json_save));
	document.getElementById("save_out").value = JSON.stringify(json_save);

	document.getElementById("need_save").style.display = "none";
}
function GenerateShareData() {
	document.getElementById("save_out").value = "";
	
	ShareDataList();
}
function GenerateMasterData() {
	var i;

	// JSON save
	var json_save = {
		Settings: {},
		Entries: []
	};
	var saved_ids = "";
	for (var x = 0; x < category_keys.length; x++) {
		var ckey = category_keys[x];
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
	output += '<tr><th class="third">' + GetData('_time_') + '</th><th class="third">' + GetData('_message_') + '</th><th class="third">' + GetData('_edit_') + '</th></tr>';
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
				output += '<td><button onclick="ReminderDelete(' + cnt + ')">' + GetData('_delete_') + '</button></td>';
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
	output += '<td><button onclick="AddReminder()">' + GetData('_add_') + '</button></td>';
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
	output += '<tr><th class="third">' + GetData('_time_') + '</th><th class="third">' + GetData('_message_') + '</th><th class="third">' + GetData('_edit_') + '</th></tr>';
	// Current reminder row(s)
	if(reminders[0].length > 0) {
		var i = 0;
		while(i < reminders.length) {
			output += "<tr>";
			var this_reminder = reminders[i].split("|");
			output += "<td>" + this_reminder[0] + "</td>";
			output += "<td>" + this_reminder[1] + "</td>";
			output += '<td><button onclick="ReminderDelete(' + i + ')">' + GetData('_delete_') + '</button></td>';
			output += "</tr>";
			
			i += 1;
		}
	}
	// Add reminder row
	output += "<tr>";
	output += "<td><input id=\"rem_time\" type=\"text\"></td>";
	output += "<td><input id=\"rem_text\" type=\"text\"></td>";
	output += '<td><button onclick="AddReminder()">' + GetData('_add_') + '</button></td>';
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
	
	// Clear input boxes
	document.getElementById("selected_input_box").innerHTML = "";
	document.getElementById("input_boxes").innerHTML = "";
	
	// Set type
	if(type.indexOf("template") == 0) {
		document.getElementById("type").innerHTML = "Template";
		document.getElementById("n_cat").style.display = "block";
		//document.getElementById("t_cat").style.display = "none";
		ShowEditBar(0);
	}
	else if(type.indexOf("manual") == 0) {
		document.getElementById("type").innerHTML = "Manual";
		document.getElementById("n_cat").style.display = "block";
		//document.getElementById("t_cat").style.display = "none";
		ShowEditBar(1);
	}
	else if(type.indexOf("ccontact") == 0) {
		document.getElementById("type").innerHTML = "Company Contact";
		document.getElementById("n_cat").style.display = "block";
		//document.getElementById("t_cat").style.display = "block";
		ShowEditBar(0);
	}
	if(master == true) {
		document.getElementById("type").innerHTML += "<i>(Master)</i>";
	}
	
	// Show edit_body
	document.getElementById("edit_settings").style.display = "none";
	document.getElementById("edit_body").style.display = "block";

	document.getElementById('history_box').value = 'Created';
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
	
	// Reminders
	var reminders = json_data.Settings.reminders.split("||");
	var output = "<table>";
	// Header row
	output += '<tr><th class="third">' + GetData('_time_') + '</th><th class="third">' + GetData('_message_') + '</th><th class="third">' + GetData('_edit_') + '</th></tr>';
	// Current reminder row(s)
	if(reminders[0].length > 0) {
		var i = 0;
		while(i < reminders.length) {
			output += "<tr>";
			var this_reminder = reminders[i].split("|");
			output += "<td>" + this_reminder[0] + "</td>";
			output += "<td>" + this_reminder[1] + "</td>";
			output += '<td><button onclick="ReminderDelete(' + i + ')">' + GetData('_delete_') + '</button></td>';
			output += "</tr>";
			
			i += 1;
		}
	}
	// Add reminder row
	output += "<tr>";
	output += "<td><input id=\"rem_time\" type=\"text\"></td>";
	output += "<td><input id=\"rem_text\" type=\"text\"></td>";
	output += '<td><button onclick="AddReminder()">' + GetData('_add_') + '</button></td>';
	output += "</tr>";
	output += "</table>";
	// Show
	document.getElementById("show_reminders").innerHTML = output;
}

// Fixed for json
function Delete() {
	var uid = document.getElementById("unique_id").innerHTML;
	DeleteUidFromJSON(uid);
	document.getElementById("need_save").style.display = "inline";
	GeneratePersonalData();
}

// Fixed for json
function EditSave() {
	// Break if there is no content
	if(document.getElementById("input_boxes").innerHTML.length == 0) {
		alert(GetData('_alert_nodata_'));
		return;
	}

	if (document.getElementById("history_box").value.length == 0) {
		alert(GetData('_alert_noupdate_'));
		return;
	}
	
	// Break if there is no title
	if(document.getElementById("title_show_eng").innerHTML.indexOf("Not set") == 0) {
		alert(GetData('_alert_notitle_'));
		return;
	}
	
	var uid = document.getElementById("unique_id").innerHTML;
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
		if (entries[i].value.length > 0) {
			data.Content.push(entries[i].value);
		}
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

	var history = document.getElementById("history_box").value;
	SaveDataToJSON(uid, type, ismaster, lastupdate, category, team, 0, data, "[" + json_data.Settings.user_id + ":" + lastupdate + "] " + history);
	
	document.getElementById("need_save").style.display = "inline";
	GeneratePersonalData();

	document.getElementById('history_box').value = '';
	// Refresh the search page
	News();
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
		CreateInputBox();

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
function EditEntryCopy(json_index) {
	// Edit copy as personal entry
	SetEditStatus(0);

	// Setup variables
	document.getElementById("unique_id").innerHTML = json_data.Entries[json_index].uid + '_COPY';
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
	document.getElementById("last_updated").innerHTML = "NEW COPY";

	// Title
	document.getElementById("title_show_eng").innerHTML = json_data.Entries[json_index].data.Title;

	// Content
	document.getElementById("input_boxes").innerHTML = "";
	var t_area = json_data.Entries[json_index].data.Content;
	var i = 0;
	while (i < t_area.length) {
		CreateInputBox();

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

function CreateInputBox() {
	// Break if no edit has been started
	if(document.getElementById("unique_id").innerHTML.length == 0) {
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
	output += '<textarea id="' + GenerateUID() + g_i + '" class="textarea_edit" onclick="SelectTextarea(this)"></textarea>';
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
	
	alert(GetData('_alert_login_'));
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
					//includeHTML();
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
