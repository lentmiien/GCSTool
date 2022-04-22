// Require used packages

// Require necessary database models
const { Tracking } = require('../sequelize');

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
          country: entry.country,
          lastchecked: entry.lastchecked,
          status: entry.status,
          shippeddate: entry.shippeddate,
          delivereddate: entry.delivereddate,
          delivered: entry.delivered,
          data: entry.data.length > 0 ? JSON.parse(entry.data): []
        });
      });
      database_cache[user_id].status = "Ok";
    });
  }

  // Return current data
  res.json(database_cache[user_id]);
};