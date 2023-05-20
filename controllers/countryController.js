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

exports.country = (req, res, next) => {
  Countryshippinglist.findAll().then((countries) => {
    res.render('country', { countries });
  });
};
