// Require used packages

// Require necessary database models
const { Country, Countrylist, Tracking, Op } = require('../sequelize');

//---------------------------------------------//
// exports.endpoints = (req, res, next) => {}; //
//---------------------------------------------//

exports.country = (req, res, next) => {
  Country.findAll().then((countries) => {
    Tracking.findAll({ attributes: ['tracking', 'country'] }).then((trackings) => {
      Countrylist.findAll().then((countrylist) => {
        // Create country code lookup table
        cc_lookup = {};
        countrylist.forEach((ce) => {
          cc_lookup[ce.country_name] = ce.country_code;
        });

        // Replace country with country code
        for (let i = 0; i < trackings.length; i++) {
          trackings[i].country = cc_lookup[trackings[i].country];
        }

        res.render('country', { countries, trackings });
      });
    });
  });
};

exports.country_graphs = async (req, res) => {
  const countrylist = await Countrylist.findAll();
  const trackings = await Tracking.findAll({ where: { delivereddate: { [Op.gt]: 1 } } });

  // Show data for country code
  const dataforcc = req.params.countrycode;

  // Create country code lookup table
  const cc_lookup = {};
  let country = '';
  countrylist.forEach((ce) => {
    if (ce.country_code == dataforcc) {
      cc_lookup[ce.country_name] = ce.country_code;

      // Save a copy of this country name
      if (ce.baseentry) {
        country = ce.country_name;
      }
    } else {
      cc_lookup[ce.country_name] = null;
    }
  });

  // Generate graph data array
  const graphdata = [];
  const sevendays = 1000 * 60 * 60 * 24 * 7;
  const now = Date.now();
  for (let i = 0; i < 52; i++) {
    graphdata.push({
      start: now - sevendays * (i + 1),
      end: now - sevendays * i,
      ems_cnt: 0,
      ems_days: 0,
      airsp_cnt: 0,
      airsp_days: 0,
      salspr_cnt: 0,
      salspr_days: 0,
      salspu_cnt: 0,
      salspu_days: 0,
      salp_cnt: 0,
      salp_days: 0,
      dhl_cnt: 0,
      dhl_days: 0,
      airp_cnt: 0,
      airp_days: 0,
    });
  }

  // Loop through tracking data
  const oneday = 1000 * 60 * 60 * 24;
  trackings.forEach((entry) => {
    if (cc_lookup[entry.country] != null) {
      for (let i = 0; i < 52; i++) {
        if (entry.delivereddate > graphdata[i].start && entry.delivereddate <= graphdata[i].end) {
          // Add data (TODO: change to use "method" when implemented)
          if (entry.carrier == 'DHL') {
            graphdata[i].dhl_cnt++;
            graphdata[i].dhl_days += (entry.delivereddate - entry.shippeddate) / oneday;
          } else if (entry.tracking.indexOf('EM') == 0) {
            graphdata[i].ems_cnt++;
            graphdata[i].ems_days += (entry.delivereddate - entry.shippeddate) / oneday;
          } else if (entry.tracking.indexOf('RM') == 0) {
            // TEMPORARY: do not know which so add to both
            graphdata[i].airsp_cnt++;
            graphdata[i].airsp_days += (entry.delivereddate - entry.shippeddate) / oneday;
            graphdata[i].salspr_cnt++;
            graphdata[i].salspr_days += (entry.delivereddate - entry.shippeddate) / oneday;
          } else if (entry.tracking.indexOf('CC') == 0) {
            // TEMPORARY: do not know which so add to both
            graphdata[i].salp_cnt++;
            graphdata[i].salp_days += (entry.delivereddate - entry.shippeddate) / oneday;
            graphdata[i].airp_cnt++;
            graphdata[i].airp_days += (entry.delivereddate - entry.shippeddate) / oneday;
          }
        }
      }
    }
  });

  // Render page
  res.render('country_graph', { country, country_code: dataforcc, graphdata });
};
