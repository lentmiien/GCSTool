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

exports.checkjp = (req, res) => {
  // fetch the latest shipping method statuses from JP website
  // compare with current data in database
  // if there are any mismatches, display a page guiding the user through our update process, and update database (shipping methods and notice database) at final stage
};

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
};
