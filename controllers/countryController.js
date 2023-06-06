/***********************
 *
 * version3 TODO
 *
 * Change to a database for managing available shipping methods
 * - Add ISO 3166 database
 *    ISO country name
 *    ISO region name
 *    ISO country code 2/3 letters and number code
 *    FM name (for converting to FM names)
 *    amiami.com name (for converting to amiami.com names)
 *    JP name (for converting to JP names)
 *    available (comma separated list, usa AmiAmi numbers for shipping methods)
 *    suspended (comma separated list, methods suspended by AmiAmi)
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
const parseString = require('xml2js').parseString;
const cheerio = require('cheerio');
const axios = require('axios').default;

// Require necessary database models
const { Countryshippinglist, Updatenotice, Op } = require('../sequelize');

//---------------------------------------------//
// exports.endpoints = (req, res, next) => {}; //
//---------------------------------------------//

exports.country = (req, res) => {
  // Display a table of all countries and avaiable shipping methods
  Countryshippinglist.findAll().then((countries) => {
    if (countries.length === 0) {
      // Render a form to upload old data
      // TODO: remove this part when no longer needed
      res.render('country_setup');
    } else {
      res.render('country', { countries });
    }
  });
};

exports.edit_country = async (req, res) => {
  const id = parseInt(req.query.id);

  try {
    // Updating an existing entry
    const country = await Countryshippinglist.findByPk(id);
    if (country) {
      res.render('update_country', { country });
    } else {
      res.redirect('/country');
    }
  } catch (err) {
    res.redirect('/country');
  }
};

exports.update3166 = (req, res) => {
  // opload a csv with the current 3166 country list
  // compare with existing data (iso3166_country/iso3166_alpha_2_code/iso3166_alpha_3_code/iso3166_numeric)
  // if there are any mismatches, display a page prompting the user on what actions to take
};

exports.update3166_api = (req, res) => {
  // update endpoint
};

exports.editamiamientry = async (req, res) => {
  // if an id is provided, update the entry with the input details, all "amiami_***" database fields
  // else add new entry
  const { id, amiami_country, amiami_code } = req.body;

  try {
    if (id === -1) {
      // Creating a new entry
      const newCountry = await Countryshippinglist.create({
        amiami_country,
        amiami_code,
      });
      res.status(201).json(newCountry); // 201 status code for created
    } else {
      // Updating an existing entry
      const countryToUpdate = await Countryshippinglist.findByPk(id);
      if (countryToUpdate) {
        await countryToUpdate.update({
          amiami_country,
          amiami_code,
        });
        res.json(countryToUpdate);
      } else {
        res.status(404).json({ message: 'Country not found' }); // 404 status code for not found
      }
    }
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message }); // 500 status code for server error
  }
};

exports.checkjp = async (req, res) => {
  // fetch the latest shipping method statuses from JP website
  // compare with current data in database
  // if there are any mismatches, display a page guiding the user through our update process, and update database (shipping methods and notice database) at final stage
  const JP_current = await GenerateJPData();
  const JP_announcements = await GetJPAnnouncements();
  const DB_data = await Countryshippinglist.findAll();
  const DB_notice = await Updatenotice.findAll();

  const changes = [];
  const DB_data_lookup = [];
  const DB_data_cid_lookup = [];
  DB_data.forEach(a => {
    DB_data_lookup.push(a.jp_country)
    DB_data_cid_lookup.push(a.jp_cid)
  });
  JP_current.forEach(entry => {
    const country_index = DB_data_lookup.indexOf(entry.country);
    const cid_index = DB_data_lookup.indexOf(entry.jp_cid);
    const index = (cid_index >= 0 ? cid_index : country_index);
    if (index == -1) {
      changes.push({
        before: null,
        after: {
          jp_country: entry.country,
          jp_country_jap: entry.country_j,
          jp_cid: entry.jp_cid,
          jp_asp: entry.asp,
          jp_salsp: entry.salsp,
          jp_ssp: entry.ssp,
          jp_ap: entry.ap,
          jp_salp: entry.salp,
          jp_sp: entry.sp,
          jp_ems: entry.ems,
        }
      });
    } else {
      if (
        DB_data[index].jp_country != entry.country ||
        DB_data[index].jp_country_jap != entry.country_j ||
        DB_data[index].jp_cid != entry.jp_cid ||
        DB_data[index].jp_asp != entry.asp ||
        DB_data[index].jp_salsp != entry.salsp ||
        DB_data[index].jp_ssp != entry.ssp ||
        DB_data[index].jp_ap != entry.ap ||
        DB_data[index].jp_salp != entry.salp ||
        DB_data[index].jp_sp != entry.sp ||
        DB_data[index].jp_ems != entry.ems
      ) {
        changes.push({
          before: {
            id: DB_data[index].id,
            jp_country: DB_data[index].jp_country,
            jp_country_jap: DB_data[index].jp_country_jap,
            jp_cid: DB_data[index].jp_cid,
            jp_asp: DB_data[index].jp_asp,
            jp_salsp: DB_data[index].jp_salsp,
            jp_ssp: DB_data[index].jp_ssp,
            jp_ap: DB_data[index].jp_ap,
            jp_salp: DB_data[index].jp_salp,
            jp_sp: DB_data[index].jp_sp,
            jp_ems: DB_data[index].jp_ems,
          },
          after: {
            jp_country: entry.country,
            jp_country_jap: entry.country_j,
            jp_cid: entry.jp_cid,
            jp_asp: entry.asp,
            jp_salsp: entry.salsp,
            jp_ssp: entry.ssp,
            jp_ap: entry.ap,
            jp_salp: entry.salp,
            jp_sp: entry.sp,
            jp_ems: entry.ems,
          }
        });
      }
    }
  });

  res.render("checkjp", {changes, JP_announcements});
};
/* DB_data 
    iso3166_country: type.STRING,
    iso3166_alpha_2_code: type.STRING,
    iso3166_alpha_3_code: type.STRING,
    iso3166_numeric: type.STRING,
    amiami_country: type.STRING,
    amiami_code: type.STRING,
    jp_country: type.STRING,
    jp_country_jap: type.STRING,
    jp_cid: type.STRING,
    jp_asp: type.STRING,
    jp_salsp: type.STRING,
    jp_ssp: type.STRING,
    jp_ap: type.STRING,
    jp_salp: type.STRING,
    jp_sp: type.STRING,
    jp_ems: type.STRING,
    fm_country: type.STRING,
    fm_country_full: type.STRING,
    fm_country_jap: type.STRING,
    fm_twoletter: type.STRING,
    fm_threeletter: type.STRING,
    fm_code: type.STRING,
    fm_dhl: type.STRING,
    fm_ait: type.STRING,
*/
/* JP_current 
[
  ...
  {
    "country": "St. Helena",
    "asp": "✓",
    "salsp": "-",
    "ssp": "X",
    "ap": "✓",
    "salp": "-",
    "sp": "X",
    "ems": "-",
    "country_j": "セント・ヘレナ",
    "jp_cid": "80"
  },
  ...
]
*/

exports.checkjp_update_notice = (req, res) => {
  // update endpoint
};

exports.checkjp_update_method = (req, res) => {
  // update endpoint
};

exports.editfmentry = async (req, res) => {
  // if an id is provided, update the entry with the input details, all "fm_***" database fields
  // else add new entry
  const { id, fm_country, fm_country_full, fm_country_jap, fm_twoletter, fm_threeletter, fm_code, fm_dhl, fm_ait } = req.body;

  try {
    if (id === -1) {
      // Creating a new entry
      const newCountry = await Countryshippinglist.create({
        fm_country,
        fm_country_full,
        fm_country_jap,
        fm_twoletter,
        fm_threeletter,
        fm_code,
        fm_dhl,
        fm_ait,
      });
      res.status(201).json(newCountry); // 201 status code for created
    } else {
      // Updating an existing entry
      const countryToUpdate = await Countryshippinglist.findByPk(id);
      if (countryToUpdate) {
        await countryToUpdate.update({
          fm_country,
          fm_country_full,
          fm_country_jap,
          fm_twoletter,
          fm_threeletter,
          fm_code,
          fm_dhl,
          fm_ait,
        });
        res.json(countryToUpdate);
      } else {
        res.status(404).json({ message: 'Country not found' }); // 404 status code for not found
      }
    }
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message }); // 500 status code for server error
  }
};

exports.fix_database = (req, res) => {
  // Show a list of incomplete entries, and allow for user to connect (combine) matching entries
};

exports.fix_database_update = (req, res) => {
  // update endpoint
};

// TODO: remove transfer when no longer needed
exports.transfer = (req, res) => {
  // Upload all current CSV to transfer to new database
  // The request has all the CSV files, parse and add to database
  /*
  console.log(req.files);
[
  {
    fieldname: 'data',
    originalname: 'entryController.js',
    encoding: '7bit',
    mimetype: 'application/x-javascript',
    destination: './temp/',
    filename: 'c87f7460276f22cdc1e01b7d33efbe3f',
    path: 'temp/c87f7460276f22cdc1e01b7d33efbe3f',
    size: 16088
  },
  ...
]
  */
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
      asp: "",
      salsp: "",
      ssp: "",
      ap: "",
      salp: "",
      sp: "",
      ems: ""
    });
    tbody[i].children.forEach((e, j) => {
      if (j_map[j]) {
        output[index][j_map[j]] = e.children[0].data.split("\n\t\t\t\t\t\t").join("");
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
