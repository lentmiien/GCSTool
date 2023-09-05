/***********************
 *
 * TODO
 *
 * Change to a database for managing available shipping methods
 * - Countryshippinglist database
 *    amiami.com country list and index for FM/JP shipping methods entries
 * - Countryshipping_jp database
 *    available shipping methods from Japan Post website
 * - Countryshipping_fm
 *    available shipping methods other than Japan Post from FM
 * - Add country name database
 *    country name
 *    source (FM/amiami.com/JP)
 *    ISO country code 2/3 letters, number code and cid (only fill in available)
 *
 * Functionality
 * - Fetch updates from Japan Post website and assist with update process
 * - Allow for manual updates (adding/removing country names, and manage suspended methods)
 *
 */

// Require used packages
const fs = require('fs');
const parseString = require('xml2js').parseString;
const cheerio = require('cheerio');
const axios = require('axios').default;

// Require necessary database models
const { Updatenotice, OfficialCountryList, InternalCountryList, JapanPostCountryList, CountryCodeEntryIdLink, Op } = require('../sequelize');

const monthsOfYear = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];
function numberToDateString(number) {
  if (number >= 11 && number <= 13) {
    return number + 'th';
  }

  switch (number % 10) {
    case 1:
      return number + 'st';
    case 2:
      return number + 'nd';
    case 3:
      return number + 'rd';
    default:
      return number + 'th';
  }
}

//---------------------------------------------//
// exports.endpoints = (req, res, next) => {}; //
//---------------------------------------------//

/// DEBUG CLEANUP DATABASE
async function CleanupDB() {}
/// DEBUG CLEANUP DATABASE

exports.index = async (req, res) => {
  // Display a control panel for managing shipping methods
  const d = new Date();
  const d_str = `${d.getFullYear()}-${d.getMonth() > 8 ? d.getMonth()+1 : '0' + (d.getMonth()+1)}-${d.getDate() > 9 ? d.getDate() : '0' + d.getDate()}`;
  const JP_announcements = await GetJPAnnouncements();

  CleanupDB();

  res.render('country_control_panel', {d_str, JP_announcements});
};

exports.officialCountryList_upload = async (req, res) => {
  const db = await OfficialCountryList.findAll();
  const file_data = fs.readFileSync(req.file.path, 'utf8');

  // index of country codes for easier lookup
  const db_country_code_index = [];
  const file_data_country_code_index = [];
  for (let i = 0; i < db.length; i++) {
    db_country_code_index.push(db[i].countryCode);
  }

  // file_data is CSV formatted, parse and save to array,
  // first row is column headers (country,country_code)
  const file_data_arr = [];
  const nl = file_data.indexOf('\r\n') >= 0 ? '\r\n' : '\n';
  const rows = file_data.split(nl);
  if (rows[0] === '"country","country_code"') {
    for (let i = 1; i < rows.length-1; i++) {
      const cells = rows[i].split(",");
      const country_code = cells[0].split('"')[1];
      const country_name = cells[1].split('"')[1];
      file_data_arr.push([country_code, country_name]);
      file_data_country_code_index.push(country_code);
    }
    
    const db_id_to_remove = [];// ids of db entires that were not in the uploaded file
    const db_id_to_update = [];// if a country code with different country name exists, put id and new country name in this array
    const db_to_add = [];// entries in the input file that are new to db
    
    // Generate update arrays
    for (let i = 0; i < db.length; i++) {
      const index = file_data_country_code_index.indexOf(db[i].countryCode);
      if (index == -1) {
        db_id_to_remove.push(db[i].id);
      } else if (db[i].countryName != file_data_arr[index][1]) {
        db_id_to_update.push({id: db[i].id, countryName: file_data_arr[index][1]});
      }
    }
    for (let i = 0; i < file_data_arr.length; i++) {
      const index = db_country_code_index.indexOf(file_data_arr[i][0]);
      if (index == -1) {
        db_to_add.push({countryCode: file_data_arr[i][0], countryName: file_data_arr[i][1]});
      }
    }
    
    // Update database
    if (db_id_to_remove.length > 0) {
      await OfficialCountryList.destroy({where:{id:{[Op.in]: db_id_to_remove}}});
    }
    if (db_id_to_update.length > 0) {
      await OfficialCountryList.bulkCreate(db_id_to_update, {updateOnDuplicate:["countryName"]});
      // Method 2: need to change to this if "updateOnDuplicate" isn't supported
      // let dataToUpdate = [
      //   { id: 1, new_name: 'New Name 1' },
      //   { id: 2, new_name: 'New Name 2' },
      //   // ...
      // ];
      // (async () => {
      //   for (let item of dataToUpdate) {
      //     await YourModel.update(
      //       { name: item.new_name },
      //       { where: { id: item.id } }
      //     );
      //   }
      // })();
    }
    if (db_to_add.length > 0) {
      await OfficialCountryList.bulkCreate(db_to_add);
    }
    
    // Return some type of completed message
    res.render("officialCountryList_upload", {db_id_to_remove, db_id_to_update, db_to_add});
  } else {
    res.render("officialCountryList_upload_error", {error:"Fileformat not recognized..."});
  }
};

exports.internalCountryList_upload = async (req, res) => {
  const db = await InternalCountryList.findAll();
  const file_data = fs.readFileSync(req.file.path, 'utf8');

  // index of country codes for easier lookup
  const db_country_code_index = [];
  const file_data_country_code_index = [];
  for (let i = 0; i < db.length; i++) {
    // id country code is already in db_country_code_index, then check which one is newer, and overwrite to older woth "---"
    const previous = db_country_code_index.indexOf(db[i].countryCode);
    if (previous == -1) {
      db_country_code_index.push(db[i].countryCode);
    } else {
      if (db[i].createdAt > db[previous].createdAt) {
        db_country_code_index[previous] = '---';
        db_country_code_index.push(db[i].countryCode);
      } else {
        db_country_code_index.push('---');
      }
    }
  }

  // file_data is CSV formatted, parse and save to array,
  // first row is column headers (country,country_code,country_j,DHL,AIT)
  const file_data_arr = [];
  const nl = file_data.indexOf('\r\n') >= 0 ? '\r\n' : '\n';
  const rows = file_data.split(nl);
  if (rows[0] === '"country","country_code","country_j","DHL","AIT"') {
    for (let i = 1; i < rows.length-1; i++) {
      const cells = rows[i].split('",');
      const country_name = cells[0].split('"')[1];
      const country_code = cells[1].split('"')[1];
      const country_j = cells[2].split('"')[1];
      const DHL = parseInt(cells[3].split('"')[1]);
      const AIT = parseInt(cells[4].split('"')[1]);
      file_data_arr.push([country_name, country_code, country_j, DHL, AIT]);
      file_data_country_code_index.push(country_code);
    }
    
    const db_to_add = [];// entries in the input file that are new to db
    
    // Generate update arrays
    for (let i = 0; i < db.length; i++) {
      const index = file_data_country_code_index.indexOf(db[i].countryCode);
      if (index >= 0 && db[i].DHLAvailability != file_data_arr[index][3]) {
        db_to_add.push({
          countryCode: file_data_arr[index][1],
          countryName: file_data_arr[index][0],
          countryNameJ: file_data_arr[index][2],
          DHLAvailability: file_data_arr[index][3],
          AITAvailability: file_data_arr[index][4],
        });
      }
    }
    for (let i = 0; i < file_data_arr.length; i++) {
      const index = db_country_code_index.indexOf(file_data_arr[i][1]);
      if (index == -1) {
        db_to_add.push({
          countryCode: file_data_arr[i][1],
          countryName: file_data_arr[i][0],
          countryNameJ: file_data_arr[i][2],
          DHLAvailability: file_data_arr[i][3],
          AITAvailability: file_data_arr[i][4],
        });
      }
    }
    
    // Update database
    if (db_to_add.length > 0) {
      await InternalCountryList.bulkCreate(db_to_add);
    }
    
    // Return some type of completed message
    res.render("InternalCountryList_upload", {db_to_add});
  } else {
    res.render("InternalCountryList_upload_error", {error:"Fileformat not recognized..."});
  }
};

exports.japanPostCountryList_update = async (req, res) => {
  const db = await JapanPostCountryList.findAll();
  const jp_data = await GenerateJPData();
  const date = new Date(req.body.update_date);

  const db_country_lookup = [];
  const jp_data_country_lookup = [];

  for (let i = 0; i < db.length; i++) {
    const previous = db_country_lookup.indexOf(db[i].countryName);
    if (previous == -1) {
      db_country_lookup.push(db[i].countryName);
    } else {
      if (db[i].createdAt > db[previous].createdAt) {
        db_country_lookup[previous] = '---';
        db_country_lookup.push(db[i].countryName);
      } else {
        db_country_lookup.push('---');
      }
    }
  }
  for (let i = 0; i < jp_data.length; i++) {
    jp_data_country_lookup.push(jp_data[i].country);
  }

  const db_to_add = [];// entries in the input file that are new to db
  const resumptions = {};// save a list of changes for generating an update message
  const suspensions = {};// save a list of changes for generating an update message

  /* changes format
RESUMPTION
[methods]: [countries]
-EMS shipments for Bulgaria, Croatia, Luxembourg, North Macedonia, Slovenia, Uruguay
-Air parcel, EMS shipments for Estonia, Latvia
-Air small packet, Air small packet unregistered, Air parcel shipments for Georgia
-Air small packet, Air small packet unregistered, Air parcel, EMS shipments for Paraguay

SUSPENSION
[methods]: [countries]
-Air small packet, Air small packet unregistered, Air parcel, EMS shipments for Sudan
  */

  // Generate update arrays
  for (let i = 0; i < db.length; i++) {
    if (db_country_lookup[i] != '---') {
      const index = jp_data_country_lookup.indexOf(db[i].countryName);
      if (
        index >= 0 &&
        !(
          db[i].airSmallPacketAvailability == jp_data[index].asp &&
          db[i].SALSmallPacketAvailability == jp_data[index].salsp &&
          db[i].surfaceSmallPacketAvailability == jp_data[index].ssp &&
          db[i].airParcelAvailability == jp_data[index].ap &&
          db[i].SALParcelAvailability == jp_data[index].salp &&
          db[i].surfaceParcelAvailability == jp_data[index].sp &&
          db[i].EMSAvailability == jp_data[index].ems
        )) {
        db_to_add.push({
          cid: jp_data[index].jp_cid,
          countryName: jp_data[index].country,
          countryNameJ: jp_data[index].country_j,
          airSmallPacketAvailability: jp_data[index].asp,
          SALSmallPacketAvailability: jp_data[index].salsp,
          surfaceSmallPacketAvailability: jp_data[index].ssp,
          airParcelAvailability: jp_data[index].ap,
          SALParcelAvailability: jp_data[index].salp,
          surfaceParcelAvailability: jp_data[index].sp,
          EMSAvailability: jp_data[index].ems,
          createdAt: date,
        });
        const methods_res = [];
        const methods_sus = [];
        if (db[i].airSmallPacketAvailability != jp_data[index].asp) {
          if (jp_data[index].asp == 0) {
            methods_sus.push('Air small packet');
            methods_sus.push('Air small packet unregistered');
          } else if (jp_data[index].asp == 1) {
            methods_res.push('Air small packet');
            methods_res.push('Air small packet unregistered');
          } else {
            methods_sus.push('Air small packet');
            methods_res.push('Air small packet unregistered');
          }
        }
        if (db[i].SALSmallPacketAvailability != jp_data[index].salsp) {
          if (jp_data[index].salsp == 0) {
            methods_sus.push('SAL small packet');
            methods_sus.push('SAL small packet unregistered');
          } else if (jp_data[index].salsp == 1) {
            methods_res.push('SAL small packet');
            methods_res.push('SAL small packet unregistered');
          } else {
            methods_sus.push('SAL small packet');
            methods_res.push('SAL small packet unregistered');
          }
        }
        if (db[i].airParcelAvailability != jp_data[index].ap) {
          if (jp_data[index].ap == 1) {
            methods_res.push('Air parcel');
          } else {
            methods_sus.push('Air parcel');
          }
        }
        if (db[i].SALParcelAvailability != jp_data[index].salp) {
          if (jp_data[index].salp == 1) {
            methods_res.push('SAL parcel');
          } else {
            methods_sus.push('SAL parcel');
          }
        }
        if (db[i].surfaceParcelAvailability != jp_data[index].sp) {
          if (jp_data[index].sp == 1) {
            methods_res.push('Surface parcel');
          } else {
            methods_sus.push('Surface parcel');
          }
        }
        if (db[i].EMSAvailability != jp_data[index].ems) {
          if (jp_data[index].ems == 1) {
            methods_res.push('EMS');
          } else {
            methods_sus.push('EMS');
          }
        }
        const res_key = methods_res.join(', ');
        const sus_key = methods_sus.join(', ');
        if (res_key.length > 0) {
          if (!(res_key in resumptions)) resumptions[res_key] = [];
          resumptions[res_key].push(jp_data[index].country);
        }
        if (sus_key.length > 0) {
          if (!(sus_key in suspensions)) suspensions[sus_key] = [];
          suspensions[sus_key].push(jp_data[index].country);
        }
      }
    }
  }
  for (let i = 0; i < jp_data.length; i++) {
    const index = db_country_lookup.indexOf(jp_data[i].country);
    if (index == -1) {
      db_to_add.push({
        cid: jp_data[i].jp_cid,
        countryName: jp_data[i].country,
        countryNameJ: jp_data[i].country_j,
        airSmallPacketAvailability: jp_data[i].asp,
        SALSmallPacketAvailability: jp_data[i].salsp,
        surfaceSmallPacketAvailability: jp_data[i].ssp,
        airParcelAvailability: jp_data[i].ap,
        SALParcelAvailability: jp_data[i].salp,
        surfaceParcelAvailability: jp_data[i].sp,
        EMSAvailability: jp_data[i].ems,
        createdAt: date,
      });
    }
  }
  
  // Update database
  if (db_to_add.length > 0) {
    await JapanPostCountryList.bulkCreate(db_to_add);
  }

  // TODO: Generate an entry for the Updatenotice database
  // date: type.STRING, <- req.body.update_date
  // message: type.TEXT, <- Use link in req.body.update_msg (change to english version),
  //                        and generate an update massage based on the changes
  const notice = {
    date: req.body.update_date,
    message: `# As of ${monthsOfYear[date.getMonth()]} ${numberToDateString(date.getDate())}:\n${req.body.update_msg.split('.htm').join('_en.htm')}`,
  };
  let has_updates = false;
  let keys = Object.keys(resumptions);
  if (keys.length > 0) {
    has_updates = true;
    notice.message += '\n\nRESUMPTION';
    keys.forEach(key => {
      notice.message += `\n-${key} shipments for ${resumptions[key].join(', ')}`;
    });
  }
  keys = Object.keys(suspensions);
  if (keys.length > 0) {
    has_updates = true;
    notice.message += '\n\nSUSPENSION';
    keys.forEach(key => {
      notice.message += `\n-${key} shipments for ${suspensions[key].join(', ')}`;
    });
  }
  if (has_updates) await Updatenotice.bulkCreate([notice]);
  else notice.message = "No changes...";
  // const date = new Date(req.body.update_date);
  /* changes output format
# As of May 19th:
https://www.post.japanpost.jp/int/information/2023/0518_01_en.html


RESUMPTION
-EMS shipments for Bulgaria, Croatia, Luxembourg, North Macedonia, Slovenia, Uruguay
-Air parcel, EMS shipments for Estonia, Latvia
-Air small packet, Air small packet unregistered, Air parcel shipments for Georgia
-Air small packet, Air small packet unregistered, Air parcel, EMS shipments for Paraguay

SUSPENSION
-Air small packet, Air small packet unregistered, Air parcel, EMS shipments for Sudan
  */
  
  // Return some type of completed message
  res.render("japanPostCountryList_update", {db_to_add, notice});
};

exports.countryCodeEntryIdLink_manage = async (req, res) => {
  const internal = await InternalCountryList.findAll();
  const jp = await JapanPostCountryList.findAll();
  const links= await CountryCodeEntryIdLink.findAll();

  // Country codes
  const all_country_codes = [];
  const all_country_names = [];
  internal.forEach(d => {
    if (all_country_codes.indexOf(d.countryCode) == -1) {
      all_country_codes.push(d.countryCode);
      all_country_names.push(d.countryName);
    }
  });
  const used_country_codes = [];
  const unused_country_codes = [];
  links.forEach(d => {
    if (used_country_codes.indexOf(d.countryCode) == -1) {
      used_country_codes.push(d.countryCode);
    }
  });
  all_country_codes.forEach(d => {
    if (used_country_codes.indexOf(d) == -1) {
      unused_country_codes.push(d);
    }
  });

  // JP country names (cid would generate duplicates)
  const all_jp_country_names = [];
  jp.forEach(d => {
    if (all_jp_country_names.indexOf(d.countryName) == -1) {
      all_jp_country_names.push(d.countryName);
    }
  });
  const used_country_names = [];
  const unused_country_names = [];
  links.forEach(d => {
    if (used_country_names.indexOf(d.cid) == -1) {
      used_country_names.push(d.cid);
    }
  });
  all_jp_country_names.forEach(d => {
    if (used_country_names.indexOf(d) == -1) {
      unused_country_names.push(d);
    }
  });

  res.render('countryCodeEntryIdLink_manage', {unused_country_names, unused_country_codes, all_country_codes, all_country_names})
};

exports.countryCodeEntryIdLink_add = async (req, res) => {
  const db_to_add = [];
  for (let i = 0; `entry${i}` in req.body; i++) {
    if (req.body[`entry${i}`].length == 3) {
      db_to_add.push({
        countryCode: req.body[`entry${i}`],
        cid: req.body[`entry${i}_c`],
      });
    }
  }

  // Update database
  if (db_to_add.length > 0) {
    await CountryCodeEntryIdLink.bulkCreate(db_to_add);
  }
  
  // Return some type of completed message
  res.render("countryCodeEntryIdLink_add", {db_to_add});
};

exports.countryCodeEntryIdLink_update = async (req, res) => {};// TODO at some later time
exports.countryCodeEntryIdLink_delete = async (req, res) => {};// TODO at some later time

exports.countries = async (req, res) => {
  const official = await OfficialCountryList.findAll();
  const internal = await InternalCountryList.findAll();
  const jp = await JapanPostCountryList.findAll();
  const links= await CountryCodeEntryIdLink.findAll();

  const table_data = [];
  const table_data_lookup = [];
  const table_data_idate = [];// Will hold internal update dates for eash entry, when finding duplicates, only update if idate is older, initiate to "new Date(0)"
  const table_data_jdate = [];// Similar to above, for jp dates
  /*
  {
    country_code: "123",
    o_country: "countryname_official",  //
    i_country: "countryname_internal",  // Any of these 3 can be null, indicating that data is missing
    j_country: "countryname_japanpost", //
    asp: 2,
    salsp: 0,
    ssp: 1,
    ap: 1,
    salp: 0,
    sp: 1,
    ems: 1,
    dhl: 1,
    ait: 0,
  }
  */

  // Step 1: official
  official.forEach(d => {
    table_data.push({
      country_code: d.countryCode,
      o_country: d.countryName,
      i_country: null,
      j_country: null,
      asp: 0,
      salsp: 0,
      ssp: 0,
      ap: 0,
      salp: 0,
      sp: 0,
      ems: 0,
      dhl: 0,
      ait: 0,
    });
    table_data_lookup.push(d.countryCode);
    table_data_idate.push(new Date(0));
    table_data_jdate.push(new Date(0));
  });

  // Step 2: internal
  internal.forEach(d => {
    const index = table_data_lookup.indexOf(d.countryCode);
    if (index == -1) {
      table_data.push({
        country_code: d.countryCode,
        o_country: null,
        i_country: d.countryName,
        j_country: null,
        asp: 0,
        salsp: 0,
        ssp: 0,
        ap: 0,
        salp: 0,
        sp: 0,
        ems: 0,
        dhl: d.DHLAvailability,
        ait: d.AITAvailability,
      });
      table_data_lookup.push(d.countryCode);
      table_data_idate.push(d.createdAt);
      table_data_jdate.push(new Date(0));
    } else {
      // UPDATE if newer
      if (d.createdAt > table_data_idate[index]) {
        table_data_idate[index] = d.createdAt;
        table_data[index].i_country = d.countryName;
        table_data[index].dhl = d.DHLAvailability;
        table_data[index].ait = d.AITAvailability;
      }
    }
  });
  
  // Step 3: jp / links
  const code_lookup = {};
  links.forEach(d => {
    code_lookup[d.cid] = d.countryCode;
  });
  jp.forEach(d => {
    if (d.countryName in code_lookup) {
      const index = table_data_lookup.indexOf(code_lookup[d.countryName]);
      if (index == -1) {
        table_data.push({
          country_code: code_lookup[d.countryName],
          o_country: null,
          i_country: null,
          j_country: d.countryName,
          asp: d.airSmallPacketAvailability,
          salsp: d.SALSmallPacketAvailability,
          ssp: d.surfaceSmallPacketAvailability,
          ap: d.airParcelAvailability,
          salp: d.SALParcelAvailability,
          sp: d.surfaceParcelAvailability,
          ems: d.EMSAvailability,
          dhl: 0,
          ait: 0,
        });
        table_data_lookup.push(code_lookup[d.countryName]);
        table_data_idate.push(new Date(0));
        table_data_jdate.push(d.createdAt);
      } else {
        // UPDATE if newer
        if (d.createdAt > table_data_jdate[index]) {
          table_data_jdate[index] = d.createdAt;
          table_data[index].j_country = d.countryName;
          table_data[index].asp = d.airSmallPacketAvailability;
          table_data[index].salsp = d.SALSmallPacketAvailability;
          table_data[index].ssp = d.surfaceSmallPacketAvailability;
          table_data[index].ap = d.airParcelAvailability;
          table_data[index].salp = d.SALParcelAvailability;
          table_data[index].sp = d.surfaceParcelAvailability;
          table_data[index].ems = d.EMSAvailability;
        }
      }
    } else {
      table_data.push({
        country_code: null,
        o_country: null,
        i_country: null,
        j_country: d.countryName,
        asp: d.airSmallPacketAvailability,
        salsp: d.SALSmallPacketAvailability,
        ssp: d.surfaceSmallPacketAvailability,
        ap: d.airParcelAvailability,
        salp: d.SALParcelAvailability,
        sp: d.surfaceParcelAvailability,
        ems: d.EMSAvailability,
        dhl: 0,
        ait: 0,
      });
      table_data_lookup.push(null);
      table_data_idate.push(new Date(0));
      table_data_jdate.push(d.createdAt);
    }
  });

  // Step 4: sort table_data (TODO: sometime later...)

  // Step 5: display output
  res.render("countries", {table_data});
};

exports.country = async (req, res) => {};

exports.updateHistory = async (req, res) => {
  const official = await OfficialCountryList.findAll();
  const internal = await InternalCountryList.findAll();
  const jp = await JapanPostCountryList.findAll();
  const links= await CountryCodeEntryIdLink.findAll();
  const updates = await Updatenotice.findAll({order: [['createdAt', 'DESC']]});

  // Get date of latest update
  let newest = '0000-00-00';
  let url_e = '';
  let url_j = '';
  updates.forEach(d => {
    if (d.date > newest) {
      newest = d.date;
      const parts = d.message.split('\n');
      parts.forEach(p => {
        if (p.indexOf("https://www.post.japanpost.jp/int/information") == 0) {
          url_e = p;
          url_j = p.split('_en.htm').join('.htm');
        }
      });
    }
  });
  const update_date = new Date(newest);

  // Get JP updates from the "newest" date
  const updated_list = [];
  const updated_list_lookup = [];
  const before_update_list = [];
  const code_dhl_ait = [];
  const code_lookup = [];
  jp.forEach(d => {
    if (d.createdAt.getTime() == update_date.getTime()) {
      updated_list.push(d);
      updated_list_lookup.push(d.countryName);
      before_update_list.push({
        "id": -1,
        "cid": d.cid,
        "countryName": d.countryName,
        "countryNameJ": d.countryNameJ,
        "airSmallPacketAvailability": 0,
        "SALSmallPacketAvailability": 0,
        "surfaceSmallPacketAvailability": 0,
        "airParcelAvailability": 0,
        "SALParcelAvailability": 0,
        "surfaceParcelAvailability": 0,
        "EMSAvailability": 0,
        "createdAt": new Date(0),
        "updatedAt": new Date(0),
      });
      code_dhl_ait.push({
        countryCode: '---',
        dhl: 0,
        ait: 0,
        createdAt: new Date(0),
        isOfficial: false,
      });
      code_lookup.push('---');
    }
  });

  // Get previous values for same countires as above
  jp.forEach(d => {
    const index = updated_list_lookup.indexOf(d.countryName);
    if (index >= 0) {
      if (d.createdAt < updated_list[index].createdAt && d.createdAt > before_update_list[index].createdAt) {
        // update before_update_list to same values as d
        before_update_list[index].id = d.id;
        before_update_list[index].airSmallPacketAvailability = d.airSmallPacketAvailability;
        before_update_list[index].SALSmallPacketAvailability = d.SALSmallPacketAvailability;
        before_update_list[index].surfaceSmallPacketAvailability = d.surfaceSmallPacketAvailability;
        before_update_list[index].airParcelAvailability = d.airParcelAvailability;
        before_update_list[index].SALParcelAvailability = d.SALParcelAvailability;
        before_update_list[index].surfaceParcelAvailability = d.surfaceParcelAvailability;
        before_update_list[index].EMSAvailability = d.EMSAvailability;
        before_update_list[index].createdAt = d.createdAt;
        before_update_list[index].updatedAt = d.updatedAt;
      }
    }
  });

  // Get DHL/AIT for same countries
  links.forEach(d => {
    const index = updated_list_lookup.indexOf(d.cid);
    if (index >= 0) {
      code_dhl_ait[index].countryCode = d.countryCode;
      code_lookup[index] = d.countryCode;
    }
  });
  // Go through internal list to get dhl and ait values
  internal.forEach(d => {
    const index = code_lookup.indexOf(d.countryCode);
    if (index >= 0) {
      if (d.createdAt > code_dhl_ait[index].createdAt) {
        code_dhl_ait[index].dhl = d.DHLAvailability;
        code_dhl_ait[index].ait = d.AITAvailability;
        code_dhl_ait[index].createdAt = d.createdAt;
      }
    }
  });
  // Check if the shipping method is on our website
  official.forEach(d => {
    const index = code_lookup.indexOf(d.countryCode);
    if (index >= 0) {
      code_dhl_ait[index].isOfficial = true;
    }
  });

  // Finalize CSV data
  let CSVdata = '';
  for (let i = 0; i < code_lookup.length; i++) {
    if (code_dhl_ait[i].isOfficial) {
      const methods_to_block = [];
      if (updated_list[i].EMSAvailability != 1) { methods_to_block.push(1); }
      if (updated_list[i].SALSmallPacketAvailability != 1) { methods_to_block.push(2); }
      if (updated_list[i].SALSmallPacketAvailability == 0) { methods_to_block.push(3); }
      if (code_dhl_ait[i].countryCode != "392"/*JP*/) { methods_to_block.push(4); }
      if (updated_list[i].SALParcelAvailability != 1) { methods_to_block.push(5); }
      if (updated_list[i].airParcelAvailability != 1) { methods_to_block.push(6); }
      if (updated_list[i].airSmallPacketAvailability == 0) { methods_to_block.push(11); }
      if (updated_list[i].airSmallPacketAvailability != 1) { methods_to_block.push(17); }
      if (code_dhl_ait[i].dhl != 1) { methods_to_block.push(19); }
      if (code_dhl_ait[i].countryCode != "840"/*US*/) { methods_to_block.push(20); }
      if (updated_list[i].surfaceParcelAvailability != 1) { methods_to_block.push(21); }
      CSVdata += `"${code_lookup[i]}","${updated_list[i].countryNameJ}","${methods_to_block.join(',')}"\n`;
    }
  }

  // Generate resumptions/suspensions lists
  const resumptions_list = {};
  const suspensions_list = {};
  const resumptions_list_j = {};
  const suspensions_list_j = {};
  for (let i = 0; i < updated_list.length; i++) {
    const res_methods = [];
    const sus_methods = [];
    if (before_update_list[i].airSmallPacketAvailability != 1 && updated_list[i].airSmallPacketAvailability == 1) {
      res_methods.push('Air small packet');
    } else if (before_update_list[i].airSmallPacketAvailability == 1 && updated_list[i].airSmallPacketAvailability != 1) {
      sus_methods.push('Air small packet');
    }
    if (before_update_list[i].airSmallPacketAvailability == 0 && updated_list[i].airSmallPacketAvailability != 0) {
      res_methods.push('Air small packet unregistered');
    } else if (before_update_list[i].airSmallPacketAvailability != 0 && updated_list[i].airSmallPacketAvailability == 0) {
      sus_methods.push('Air small packet unregistered');
    }
    if (before_update_list[i].airParcelAvailability != 1 && updated_list[i].airParcelAvailability == 1) {
      res_methods.push('Air parcel');
    } else if (before_update_list[i].airParcelAvailability == 1 && updated_list[i].airParcelAvailability != 1) {
      sus_methods.push('Air parcel');
    }
    if (before_update_list[i].EMSAvailability != 1 && updated_list[i].EMSAvailability == 1) {
      res_methods.push('EMS');
    } else if (before_update_list[i].EMSAvailability == 1 && updated_list[i].EMSAvailability != 1) {
      sus_methods.push('EMS');
    }
    if (before_update_list[i].SALSmallPacketAvailability != 1 && updated_list[i].SALSmallPacketAvailability == 1) {
      res_methods.push('SAL small packet');
    } else if (before_update_list[i].SALSmallPacketAvailability == 1 && updated_list[i].SALSmallPacketAvailability != 1) {
      sus_methods.push('SAL small packet');
    }
    if (before_update_list[i].SALSmallPacketAvailability == 0 && updated_list[i].SALSmallPacketAvailability != 0) {
      res_methods.push('SAL small packet unregistered');
    } else if (before_update_list[i].SALSmallPacketAvailability != 0 && updated_list[i].SALSmallPacketAvailability == 0) {
      sus_methods.push('SAL small packet unregistered');
    }
    if (before_update_list[i].SALParcelAvailability != 1 && updated_list[i].SALParcelAvailability == 1) {
      res_methods.push('SAL parcel');
    } else if (before_update_list[i].SALParcelAvailability == 1 && updated_list[i].SALParcelAvailability != 1) {
      sus_methods.push('SAL parcel');
    }
    if (before_update_list[i].surfaceParcelAvailability != 1 && updated_list[i].surfaceParcelAvailability == 1) {
      res_methods.push('Surface parcel');
    } else if (before_update_list[i].surfaceParcelAvailability == 1 && updated_list[i].surfaceParcelAvailability != 1) {
      sus_methods.push('Surface parcel');
    }

    if (res_methods.length > 0) {
      if (!(res_methods.join(', ') in resumptions_list)) resumptions_list[res_methods.join(', ')] = [];
      resumptions_list[res_methods.join(', ')].push(updated_list[i].countryName);
      if (!(res_methods.join(', ') in resumptions_list_j)) resumptions_list_j[res_methods.join(', ')] = [];
      resumptions_list_j[res_methods.join(', ')].push(updated_list[i].countryNameJ);
    }
    if (sus_methods.length > 0) {
      if (!(sus_methods.join(', ') in suspensions_list)) suspensions_list[sus_methods.join(', ')] = [];
      suspensions_list[sus_methods.join(', ')].push(updated_list[i].countryName);
      if (!(sus_methods.join(', ') in suspensions_list_j)) suspensions_list_j[sus_methods.join(', ')] = [];
      suspensions_list_j[sus_methods.join(', ')].push(updated_list[i].countryNameJ);
    }
  }

  const messages = {};
  let tmp = '';

  // Generate a list of shipping methods for all official countries
  const complete_official_list = [];
  const complete_official_list_lookup = [];
  official.forEach(d => {
    complete_official_list.push({
      country: d.countryName,
      ap: false,
      asp: false,
      asp_u: false,
      dhl: false,
      ems: false,
      salp: false,
      salsp: false,
      salsp_u: false,
      sp: false,
      ait: false,
      internal_date: new Date(0),
      jp_date: new Date(0),
    });
    complete_official_list_lookup.push(d.countryCode)
  });
  internal.forEach(d => {
    const index = complete_official_list_lookup.indexOf(d.countryCode);
    if (index >= 0) {
      if (d.createdAt > complete_official_list[index].internal_date) {
        complete_official_list[index].internal_date = d.createdAt;
        complete_official_list[index].dhl = (d.DHLAvailability == 1);
        complete_official_list[index].ait = (d.AITAvailability == 1);
      }
    }
  });
  const jp_to_code = {};
  links.forEach(d => {
    jp_to_code[d.cid] = d.countryCode;
  });
  jp.forEach(d => {
    if (d.countryName in jp_to_code) {
      const index = complete_official_list_lookup.indexOf(jp_to_code[d.countryName]);
      if (index >= 0) {
        if (d.createdAt > complete_official_list[index].jp_date) {
          complete_official_list[index].jp_date = d.createdAt;
          complete_official_list[index].ap = (d.airParcelAvailability == 1);
          complete_official_list[index].asp = (d.airSmallPacketAvailability == 1);
          complete_official_list[index].asp_u = (d.airSmallPacketAvailability != 0);
          complete_official_list[index].ems = (d.EMSAvailability == 1);
          complete_official_list[index].salp = (d.SALParcelAvailability == 1);
          complete_official_list[index].salsp = (d.SALSmallPacketAvailability == 1);
          complete_official_list[index].salsp_u = (d.SALSmallPacketAvailability != 0);
          complete_official_list[index].sp = (d.surfaceParcelAvailability == 1);
        }
      }
    }
  });
  complete_official_list.sort((a,b) => {
    if (a.country < b.country) return -1;
    if (a.country > b.country) return 1;
    return 0;
  });

  // Zendesk, country-method list
  // Set an initial message (top message, over table)
  tmp = `<p>\r\n  The list below shows the currently available shipping methods for each country.\r\n  To find your country quickly, please use the search function in your browser.\r\n</p>\r\n<p>\r\n  *We try to update the list as soon as possible when there are any updates.\r\n</p>\r\n<p>If you have any questions, then please contact our support.</p>\r\n<p>&nbsp;</p>\r\n`;
  // Generate a table (html table, with striped lines and a header line every 10-15? lines)
  let tbody_content = "";
  const colors = ["#FFFFFF", "#EEEEEE", "#CCCCCC"];
  complete_official_list.forEach((entry, i) => {
    if (i%15 == 0) {
      // Add header row
      tbody_content += `<tr style="background-color:${colors[2]};"><th style="witdh:18%;">Country</th><th style="witdh:8%;">Air Parcel</th><th style="witdh:8%;">Air small packet</th><th style="witdh:8%;">Air small packet unregistered</th><th style="witdh:8%;">DHL</th><th style="witdh:8%;">EMS</th><th style="witdh:8%;">SAL Parcel</th><th style="witdh:8%;">SAL small packet</th><th style="witdh:8%;">SAL small packet unregistered</th><th style="witdh:8%;">Surface parcel</th><th style="witdh:10%;">Other</th></tr>`;
      // 18% country
      // 72% 9 shipping methods = 8% per shipping method
      // 10% other
    }
    // Add content row
    tbody_content += `<tr style="background-color:${colors[i%2]};"><th>${entry.country}</th><td style="text-align: center; vertical-align: middle;">${entry.ap ? '〇' : ''}</td><td style="text-align: center; vertical-align: middle;">${entry.asp ? '〇' : ''}</td><td style="text-align: center; vertical-align: middle;">${entry.asp_u ? '〇' : ''}</td><td style="text-align: center; vertical-align: middle;">${entry.dhl ? '〇' : ''}</td><td style="text-align: center; vertical-align: middle;">${entry.ems ? '〇' : ''}</td><td style="text-align: center; vertical-align: middle;">${entry.salp ? '〇' : ''}</td><td style="text-align: center; vertical-align: middle;">${entry.salsp ? '〇' : ''}</td><td style="text-align: center; vertical-align: middle;">${entry.salsp_u ? '〇' : ''}</td><td style="text-align: center; vertical-align: middle;">${entry.sp ? '〇' : ''}</td><td style="text-align: center; vertical-align: middle;">${entry.ait ? "Surface Mail Premium" : ""}</td></tr>`;
  });
  tmp += `<table><tbody>${tbody_content}</tbody></table>`;
  // Add final notes (bottom message, under table)
  tmp += `\r\n<p>\r\n  *Ukraine: Shipment not available for all regions.\r\n</p>`;
  messages["z_country_method_list"] = {link: process.env.LINK_1, message: tmp};
  // CW msg, GCS
  tmp = `[toall]\r\n`;
  tmp += `お疲れ様です。\r\n`;
  tmp += `${url_j}\r\n`;
  tmp += `JPから引受停止状況が変わったというお知らせがありました。\r\n`;
  let keys = Object.keys(resumptions_list_j);
  if (keys.length > 0) {
    tmp += `[info][title]再開内容[/title]`;
    keys.forEach(key => {
      tmp += `${resumptions_list_j[key].join('・')}：${key}\r\n`;
    });
    tmp += `[/info]\r\n`;
  }
  keys = Object.keys(suspensions_list_j);
  if (keys.length > 0) {
    tmp += `[info][title]停止内容[/title]`;
    keys.forEach(key => {
      tmp += `${suspensions_list_j[key].join('・')}：${key}\r\n`;
    });
    tmp += `[/info]\r\n`;
  }
  tmp += 'よろしくお願いします。';
  messages["cw_msg_gcs"] = {link: "GCS課共有", message: tmp};
  // CW msg, GCS support
  tmp = `[toall]\r\n`;
  tmp += `${url_e}\r\n`;
  tmp += `Japan Post has announced the following changes to their available shipping methods.\r\n`;
  keys = Object.keys(resumptions_list);
  if (keys.length > 0) {
    tmp += `[info][title]Resumptions[/title]`;
    keys.forEach(key => {
      tmp += `${resumptions_list[key].join(', ')}: ${key}\r\n`;
    });
    tmp += `[/info]\r\n`;
  }
  keys = Object.keys(suspensions_list);
  if (keys.length > 0) {
    tmp += `[info][title]Suspensions[/title]`;
    keys.forEach(key => {
      tmp += `${suspensions_list[key].join(', ')}: ${key}\r\n`;
    });
    tmp += `[/info]\r\n`;
  }
  messages["cw_msg_gcs_support"] = {link: "GCS課サポート共有", message: tmp};
  // cybozu, share msg
  tmp = `お疲れ様です。\r\n\r\n`;
  tmp += `${url_j}\r\n`;
  tmp += `JPの引受停止状況が変わりましたので、下記の修正が必要になります。\r\n\r\n`;
  tmp += `${newest}から下記の国の引受停止状況が変わりました。\r\n\r\n`;
  tmp += `対象国：\r\n`;
  keys = Object.keys(resumptions_list_j);
  if (keys.length > 0) {
    tmp += `■再開内容\r\n`;
    keys.forEach(key => {
      tmp += `${resumptions_list_j[key].join('・')}：${key}\r\n`;
    });
    tmp += `\r\n`;
  }
  keys = Object.keys(suspensions_list_j);
  if (keys.length > 0) {
    tmp += `■停止内容\r\n`;
    keys.forEach(key => {
      tmp += `${suspensions_list_j[key].join('・')}：${key}\r\n`;
    });
    tmp += `\r\n`;
  }
  // Request header
  const d = new Date();
  const today_str = `${d.getFullYear()}-${d.getMonth() > 8 ? d.getMonth()+1 : '0' + (d.getMonth()+1)}-${d.getDate() > 9 ? d.getDate() : '0' + d.getDate()}`;
  
  tmp += `○処理内容\r\n掲載内容変更\r\n\r\n`;
  tmp += `○対象サイト\r\namiami.com\r\n\r\n`;
  tmp += `○掲載開始希望日時\r\n${new Date(newest) < d ? today_str : newest}\r\n\r\n`;
  tmp += `○特記事項\r\n更新日update表記は変更\r\n\r\n`;
  tmp += `○変更内容\r\n\r\n`;

  tmp += `修正対象お知らせタイトル\r\n-------------------------------------\r\nShipping method suspension and resumption updates\r\n\r\n\r\n\r\n`;

  const message_header = 'List of currently available shipping methods by country:\r\nhttps://support.amiami.com/hc/en-us/articles/360048840471-Available-Shipping-method-table-by-country';
  let message_body = "";
  updates.forEach(u => {
    if (u.date < newest) message_body += `\r\n\r\n---\r\n${u.message}`;
  });
  // Message part to replace
  tmp += `変更対象箇所\r\n-------------------------------------\r\n${message_header}${message_body}\r\n-------------------------------------\r\n\r\n\r\n\r\n`;

  message_body = "";
  updates.forEach(u => {
    message_body += `\r\n\r\n---\r\n${u.message}`;
  });
  // Updated message
  tmp += `以下の内容に置き換え\r\n-------------------------------------\r\n${message_header}${message_body}\r\n-------------------------------------\r\n\r\n`;
  messages["cy_share_msg"] = {link: process.env.LINK_2, message: tmp};
  // cybozu, request change
  messages["cy_request_change"] = {link: process.env.LINK_3, message: `【固定文面監修無し】\r\n${tmp}`};
  // CW, share
  tmp = 'お疲れ様です。\r\n';
  tmp += 'JPの引受停止状況はサイトトップの更新を申請いたしました。\r\n';
  tmp += `${process.env.LINK_5}\r\n`;
  tmp += `参考：　${url_j}`;
  messages["cw_share"] = {link: '記載希望文書', message: tmp};
  // cybozu, update shipping
  tmp = 'お疲れ様です。\r\n\r\n';
  tmp += `${newest}から引受停止状況の変更に関して、JPから発表がありました。\r\n\r\n`;
  tmp += `${url_j}\r\n\r\n`;
  tmp += '花田さんへ\r\n顧客が選択できる発送方法の更新をよろしくお願いいたします。\r\n\r\n';
  tmp += 'よろしくお願いします。';
  messages["cy_update_shipping"] = {link: process.env.LINK_4, message: tmp};

  res.render("updateHistory", {newest, CSVdata, messages, updates})
};

/************
 * Helper functions
 */

async function GenerateJPData() {
  const output = [];
  const jp_data_eng = await axios.get('https://www.post.japanpost.jp/int/information/overview_en.html');
  const $ = cheerio.load(jp_data_eng.data);
  const tbody = $('tr', '#country_table');
  const j_map = [null, "country", null, "asp", null, "salsp", null, "ssp", null, "ap", null, "salp", null, "sp", null, "ems", null, null, null, null, null, null, null, null]
  for(let i = 2; i < tbody.length; i++) {
    const index = output.length;
    output.push({
      country: "",
      asp: 0,
      salsp: 0,
      ssp: 0,
      ap: 0,
      salp: 0,
      sp: 0,
      ems: 0
    });
    const converter = {
      '-': 0,
      'X': 0,
      '✓': 1,
      '*': 2,
    };
    tbody[i].children.forEach((e, j) => {
      if (j_map[j]) {
        const value = e.children[0].data.split("\n\t\t\t\t\t\t").join("");
        output[index][j_map[j]] = value in converter ? converter[value] : value;
      }
    });
  }

  // Load japanese country names
  const jp_data_jap = await axios.get('https://www.post.japanpost.jp/int/information/overview.html');
  const $j = cheerio.load(jp_data_jap.data);
  const country_select = $j('#country');
  const country_options = country_select[0].children;
  for(let i = 3; i < country_options.length; i+=2) {
    const index = (i - 3) / 2;
    output[index]["country_j"] = country_options[i].children[0].data;
    output[index]["jp_cid"] = country_options[i].attribs['data-cid'];
  }
  
  return output;
}

async function GetJPAnnouncements() {
  // Get JP announcements RSS (XLM)
  const jp_announcements = await axios.get('https://www.post.japanpost.jp/rss/int.xml');

  // Conver to array and return array
  // xml to json
  let entries = undefined;
  parseString(jp_announcements.data, (err, result) => {
    entries = result.rss.channel[0].item;
  });

  return entries;
}
