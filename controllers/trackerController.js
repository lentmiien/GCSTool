/********************************
 * 
 * version3 TODO
 * 
 * add support for new database format (history in separate database)
 * 
 * add tracking upload function
 * 
 */


// Require used packages

// Require necessary database models
const { InternalCountryList, Tracking } = require('../sequelize');

//---------------------------------------------//
// exports.endpoints = (req, res, next) => {}; //
//---------------------------------------------//

exports.index = (req, res) => {
  // Render a landing page for tracking
  // Displayed data is accessed through fetch calls (JS)
  // Tracking numbers is stored in local storage (JS)
  // 
  res.render('tracker');
};

const database_cache = {};
exports.getdata = (req, res) => {
  // POST request
  // Body: {local_date: "2022-4-22", tracking_numbers:[...]}

  const user_id = req.user.userid;
  const local_date = req.body.local_date;
  const tracking_numbers = req.body.tracking_numbers;

  // If user does not have any cached data, then first generate empty data structure
  if (!(user_id in database_cache)) {
    // Generate placeholder data structure
    database_cache[user_id] = {
      last_checked: "",
      status: "Ok",
      list: [],
      list_lookup: []
    };
  }

  // If currently updating, then return the current (old) data
  if (database_cache[user_id].status == "Updating") {
    return res.json(database_cache[user_id]);
  }

  // Check if tracking data update is needed (new tracking or old cache)
  let new_entries = false;
  tracking_numbers.forEach(tn => {
    if (database_cache[user_id].list_lookup.indexOf(tn) == -1) new_entries = true;
  });
  if (new_entries || local_date != database_cache[user_id].last_checked) {
    database_cache[user_id].last_checked = local_date;
    database_cache[user_id].status = "Updating";
    database_cache[user_id].list_lookup = tracking_numbers;
    Tracking.findAll({where:{tracking:tracking_numbers}}).then(response => {
      database_cache[user_id].list = [];
      response.forEach(entry => {
        database_cache[user_id].list.push({
          tracking: entry.tracking,
          carrier: entry.carrier,
          country: entry.country,
          addeddate: entry.addeddate,
          lastchecked: entry.lastchecked,
          status: entry.status,
          shippeddate: entry.shippeddate,
          delivereddate: entry.delivereddate,
          delivered: entry.delivered,
          data: entry.data,
          grouplabel: entry.grouplabel
        });
      });
      database_cache[user_id].status = "Ok";
    });
  }

  // Return current data
  res.json(database_cache[user_id]);
};

exports.generate = (req, res) => {
  // Display an input form for generating data,
  // and display an upload form for uploading the data to add to database
  // also display an upload history (stored locally in users browser)
  const auto_complete = [/* Shipping methods, Past 2 weeks dates, FM countries */];

  // Shipping methods
  auto_complete.push("EMS");
  auto_complete.push("Air Small Packet Registered");
  auto_complete.push("Air Parcel");
  auto_complete.push("DHL");
  auto_complete.push("SAL Registered");
  auto_complete.push("SAL Parcel");
  auto_complete.push("Surface Parcel");
  auto_complete.push("Surface Mail Premium");

  // Past 2 weeks dates
  let d = new Date();
  for (let i = 0; i < 14; i++) {
    auto_complete.push(`${d.getFullYear()}-${d.getMonth() > 8 ? d.getMonth()+1 : "0" + (d.getMonth()+1)}-${d.getDate() > 9 ? d.getDate() : "0" + d.getDate()}`);
    d = new Date(d.getFullYear(), d.getMonth(), d.getDate()-1);
  }

  // FM countries
  InternalCountryList.findAll({attributes: ['countryName']}).then(entries => {
    entries.forEach(entry => auto_complete.push(entry.countryName));
    
    // Done, so render the page
    res.render('generate', {auto_complete});
  });
};

let taskStatus = {};

const grouplabel_map = {
  "EMS": 19,
  "Air Small Packet Registered": 20,
  "Air Parcel": 21,
  "DHL": 22,
  "SAL Registered": 23,
  "SAL Parcel": 24,
  "Surface Parcel": 25,
  "Surface Mail Premium": 80
};

exports.start_upload_tracking = async (req, res) => {
  // POST request uploading data from 'generate_csv'
  const taskId = Math.random().toString(36).substring(7);  // Generate a unique task ID.
  taskStatus[taskId] = "Processing";

  // Return task id to user
  res.json({ taskId: taskId });

  // Find date range of records to be added
  let startDate = Date.now();
  let endDate = 0;
  req.body.forEach(entry => {
    const entry_shipped_date = new Date(entry.sd);
    if (entry_shipped_date.getTime() < startDate) startDate = entry_shipped_date.getTime();
    if (entry_shipped_date.getTime() > endDate) endDate = entry_shipped_date.getTime();
  });
  // Adjust 1 day (1000*60*60*24) to ensure that there is no timezone problems (often run development app localy)
  startDate -= 1000*60*60*24;
  endDate += 1000*60*60*24;

  // DB query parameters
  const where = {
    shippeddate: { [Op.gte]: startDate, [Op.lte]: endDate }
  };

  // Load relevant records from DB
  Tracking.findAll({
    attributes: ['tracking'],
    where
  }).then(entries => {
    // Check that there is no duplicate entries
    const tracking_lookup = [];
    entries.forEach(entry => tracking_lookup.push(entry.tracking));
    const savedata = [];
    req.body.forEach(entry => {
      if (tracking_lookup.indexOf(entry.t) == -1) {
        // Check that entry is valid
        let valid_entry = false;
        const length = entry.t.length;
        const isnum = /^\d+$/.test(entry.t);
        if ((length == 34 || length == 30) && isnum && entry.t.indexOf('420') == 0 && entry.sm == "Surface Mail Premium") {
          valid_entry = true; // AIT
        }
        if ((length == 26 || length == 22) && isnum && entry.t.indexOf('9') == 0 && entry.sm == "Surface Mail Premium") {
          valid_entry = true; // AIT
        }
        if (length == 13 && !isnum && entry.t.indexOf('JP') == 11 /* && (ASP || AParcel || SAL/Parcel || Surface Parcel) */) {
          valid_entry = true; // JP
        }
        if (length == 10 && isnum && entry.sm == "DHL") {
          valid_entry = true; // DHL
        }
        if (length == 18 && entry.t.indexOf('1Z') == 0) {
          valid_entry = true; // UPS
          // 1Z6F22060391995101
        }

        if (valid_entry) {
          tracking_lookup.push(entry.t);
          savedata.push({
            tracking: entry.t,
            carrier: entry.sm == "DHL" ? 'DHL' : (entry.sm == "Surface Mail Premium" ? (entry.t.indexOf('1Z') == 0 ? 'UPS' : 'USPS') : 'JP'),
            country: entry.c,
            addeddate: Date.now(),
            lastchecked: 0,
            status: "SHIPPED",
            shippeddate: (new Date(entry.sd)).getTime(),
            delivereddate: 0,
            delivered: false,
            data: "",
            grouplabel: grouplabel_map[entry.sm],
          });
        }
      }
    });

    // Add new entries to DB
    if (savedata.length > 0) {
      Tracking.bulkCreate(savedata).then(() => {
        taskStatus[taskId] = `Completed, ${savedata.length} entries added!`;
      });
    } else {
      taskStatus[taskId] = `Warning, No new/valid entries!`;
    }
  });
};

exports.status_upload_tracking = (req, res) => {
  const taskId = req.params.taskId;
  if (!taskStatus[taskId]) {
    res.status(404).json({ status: "Task not found" });
  } else {
    res.json({ status: taskStatus[taskId] });
  }
};
