// Packages
const fs = require("fs");
const cheerio = require('cheerio');
const axios = require('axios').default;

// Database
const service = require('../services/shipcost').createService(require('../sequelize'));
const { select, toRows } = require('../public/javascripts/shipcost-chart');
const { methods, MAX_BYTES, fail } = require('../utils/japanPostRatesCsv');
const { today } = require('../services/shipcost');
const { randomBytes, timingSafeEqual } = require('crypto');

//---------------------------------------------//
// exports.endpoints = (req, res, next) => {}; //
//---------------------------------------------//

const zoneLabels = {
  _4zones: [
    'First Zone; Asia',
    'Second Zone; Oceania, Canada, Central America, Middle East, Europe',
    'Third Zone; South America and Africa',
    'Fourth Zone; The United States (including overseas territories like Guam)'
  ],
  _5zones: [
    'First Zone; China, South Korea, Taiwan',
    'Second Zone; Asia (excluding China, South Korea, Taiwan)',
    'Third Zone; Oceania, North America (excluding the U.S.), Middle East, Europe',
    'Fourth Zone; U.S. (including Guam and other U.S. territories)',
    'Fifth Zone; Central and South America (excluding Mexico), Africa'
  ],
  _dhlzones: [
    'First-Third Zone; Asia',
    'Fourth Zone; India, Australia',
    'Fifth Zone; North America, Mexico',
    'Sixth Zone; Europe',
    'Seventh Zone; Russia, Ukraine',
    'Eight Zone; South America',
    'Nineth Zone; Africa, Middle East'
  ],
  _usaonly: [
    'The United States'
  ]
};

const handle = action => async (req, res, next) => {
  try { await action(req, res); }
  catch (error) {
    if (req.method === 'POST') return res.status(error.status || 503).json({ error: error.status ? error.message : 'Unable to save rates. Please try again later.' });
    next(error);
  }
};
exports.prepare = (req, res, next) => {
  res.set('Cache-Control', 'private, no-store');
  if (!req.user) return res.status(401).json({ error: 'Sign in to manage shipping rates.' });
  if (!req.session.shipcostCsrf) req.session.shipcostCsrf = randomBytes(32).toString('hex');
  if (req.method === 'POST') {
    const token = req.get('X-CSRF-Token') || '';
    const expected = req.session.shipcostCsrf;
    if (Buffer.byteLength(token) !== Buffer.byteLength(expected) || !timingSafeEqual(Buffer.from(token), Buffer.from(expected))) {
      return res.status(403).json({ error: 'This page has expired. Reload and try again.' });
    }
  }
  Object.assign(res.locals, { shipcostCsrf: req.session.shipcostCsrf, importMethods: methods, rateToday: String(today()), online: false });
  next();
};
exports.index = handle(async (req, res) => {
  const { rows, versions } = await service.data();
  const current = select(rows, versions);
  const output = {};
  for (const [method, { chart }] of Object.entries(current)) {
    output[method] = {};
    for (const row of toRows(chart, method)) {
      if (!output[method][row.zone]) output[method][row.zone] = [];
      output[method][row.zone].push({ uptoweight_g: row.uptoweight_g, before_cost: row.cost, current_cost: row.cost });
    }
  }
  res.render('shipcost', { zone_labels: zoneLabels, output });
});
exports.importCsv = handle(async (req, res) => {
  const file = req.files && req.files.csvFile;
  if (!file || Array.isArray(file) || Object.keys(req.files).length !== 1) fail('Choose one CSV file.');
  if (file.truncated || file.size > MAX_BYTES) fail('The CSV file must be 1 MB or smaller.', 413);
  if (!/\.csv$/i.test(file.name)) fail('Choose a file with the .csv extension.');
  res.json(await service.importCsv(file.data, req.body.method, file.name));
});
exports.history = handle(async (req, res) => {
  const method = req.query.method || 'EMS';
  res.render('shipcost_history', { method, history: await service.history(method) });
});
exports.online = handle(async (req, res) => {
  const zone_labels = zoneLabels;
  // Load database data
  const stored = await service.data();
  const current_data = Object.entries(select(stored.rows, stored.versions)).flatMap(([method, value]) => toRows(value.chart, method, value.costdate));

  // Load online data
  const charts = {};

  const sp_unreg_zone1 = await GetJPChart("https://www.post.japanpost.jp/int/charge/list/normal1_en.html", ["#t1-5", "#t3-2"]);
  const sp_unreg_zone2 = await GetJPChart("https://www.post.japanpost.jp/int/charge/list/normal2_en.html", ["#t1-5", "#t3-2"]);
  const sp_unreg_zone3 = await GetJPChart("https://www.post.japanpost.jp/int/charge/list/normal3_en.html", ["#t1-5", "#t3-2"]);
  const sp_unreg_zone4 = await GetJPChart("https://www.post.japanpost.jp/int/charge/list/normal4_en.html", ["#t1-5", "#t3-2"]);
  const sp_unreg_zone5 = await GetJPChart("https://www.post.japanpost.jp/int/charge/list/normal5_en.html", ["#t1-5", "#t3-2"]);
  charts["Air small packet unregistered"] = {
    zone1: sp_unreg_zone1[0],
    zone2: sp_unreg_zone2[0],
    zone3: sp_unreg_zone3[0],
    zone4: sp_unreg_zone4[0],
    zone5: sp_unreg_zone5[0],
  };
  charts["SAL small packet unregistered"] = {
    zone1: sp_unreg_zone1[1],
    zone2: sp_unreg_zone2[1],
    zone3: sp_unreg_zone3[1],
    zone4: sp_unreg_zone4[1],
    zone5: sp_unreg_zone5[1],
  };
  // "SAL small packet registered" is unregistered prices + 460 JPY
  charts["SAL small packet registered"] = { zone1: [], zone2: [], zone3: [], zone4: [], zone5: [] };
  sp_unreg_zone1[1].forEach(entry => {
    const label = entry[0];
    const cost = entry[1];
    charts["SAL small packet registered"].zone1.push([label, cost+460]);
  });
  sp_unreg_zone2[1].forEach(entry => {
    const label = entry[0];
    const cost = entry[1];
    charts["SAL small packet registered"].zone2.push([label, cost+460]);
  });
  sp_unreg_zone3[1].forEach(entry => {
    const label = entry[0];
    const cost = entry[1];
    charts["SAL small packet registered"].zone3.push([label, cost+460]);
  });
  sp_unreg_zone4[1].forEach(entry => {
    const label = entry[0];
    const cost = entry[1];
    charts["SAL small packet registered"].zone4.push([label, cost+460]);
  });
  sp_unreg_zone5[1].forEach(entry => {
    const label = entry[0];
    const cost = entry[1];
    charts["SAL small packet registered"].zone5.push([label, cost+460]);
  });

  const parcel_zone1 = await GetJPChart("https://www.post.japanpost.jp/int/charge/list/parcel1_en.html", ["#t1", "#t2", "#t3"]);
  const parcel_zone2 = await GetJPChart("https://www.post.japanpost.jp/int/charge/list/parcel2_en.html", ["#t1", "#t2", "#t3"]);
  const parcel_zone3 = await GetJPChart("https://www.post.japanpost.jp/int/charge/list/parcel3_en.html", ["#t1", "#t2", "#t3"]);
  const parcel_zone4 = await GetJPChart("https://www.post.japanpost.jp/int/charge/list/parcel4_en.html", ["#t1", "#t2", "#t3"]);
  const parcel_zone5 = await GetJPChart("https://www.post.japanpost.jp/int/charge/list/parcel5_en.html", ["#t1", "#t2", "#t3"]);
  charts["Air parcel"] = {
    zone1: parcel_zone1[0],
    zone2: parcel_zone2[0],
    zone3: parcel_zone3[0],
    zone4: parcel_zone4[0],
    zone5: parcel_zone5[0]
  };
  charts["Surface parcel"] = {
    zone1: parcel_zone1[1],
    zone2: parcel_zone2[1],
    zone3: parcel_zone3[1],
    zone4: parcel_zone4[1],
    zone5: parcel_zone5[1]
  };
  charts["SAL parcel"] = {
    zone1: parcel_zone1[2],
    zone2: parcel_zone2[2],
    zone3: parcel_zone3[2],
    zone4: parcel_zone4[2],
    zone5: parcel_zone5[2]
  };

  const ems_zone1 = await GetJPChart("https://www.post.japanpost.jp/int/charge/list/ems1_en.html", [".data"]);
  const ems_zone2 = await GetJPChart("https://www.post.japanpost.jp/int/charge/list/ems2_en.html", [".data"]);
  const ems_zone3 = await GetJPChart("https://www.post.japanpost.jp/int/charge/list/ems3_en.html", [".data"]);
  const ems_zone4 = await GetJPChart("https://www.post.japanpost.jp/int/charge/list/ems4_en.html", [".data"]);
  const ems_zone5 = await GetJPChart("https://www.post.japanpost.jp/int/charge/list/ems5_en.html", [".data"]);
  charts["EMS"] = {
    zone1: ems_zone1[0],
    zone2: ems_zone2[0],
    zone3: ems_zone3[0],
    zone4: ems_zone4[0],
    zone5: ems_zone5[0]
  };

  // "Air small packet registered" is unregistered prices + 460 JPY
  charts["Air small packet registered"] = { zone1: [], zone2: [], zone3: [], zone4: [], zone5: [] };
  sp_unreg_zone1[0].forEach(entry => {
    const label = entry[0];
    const cost = entry[1];
    charts["Air small packet registered"].zone1.push([label, cost+460]);
  });
  sp_unreg_zone2[0].forEach(entry => {
    const label = entry[0];
    const cost = entry[1];
    charts["Air small packet registered"].zone2.push([label, cost+460]);
  });
  sp_unreg_zone3[0].forEach(entry => {
    const label = entry[0];
    const cost = entry[1];
    charts["Air small packet registered"].zone3.push([label, cost+460]);
  });
  sp_unreg_zone4[0].forEach(entry => {
    const label = entry[0];
    const cost = entry[1];
    charts["Air small packet registered"].zone4.push([label, cost+460]);
  });
  sp_unreg_zone5[0].forEach(entry => {
    const label = entry[0];
    const cost = entry[1];
    charts["Air small packet registered"].zone5.push([label, cost+460]);
  });

  // DHL
  // "DHL_prices_20221001.csv"
  // change to load DB data to chart (since automatic loading of new data isn't possible)
  charts["DHL"] = {};
  const dhl_data = (fs.readFileSync("./data/DHL_prices_20221001.csv")).toString();
  let row_separator = dhl_data.indexOf('\r\n') >= 0 ? '\r\n' : '\n';
  const row_data = dhl_data.toString().split(row_separator);
  row_data.forEach((row, e) => {
    const cell_data = row.split(',');
    if (e == 0) {
      for (let i = 1; i < cell_data.length; i++) {
        charts["DHL"][`zone${i}`] = [];
      }
    }
    for (let i = 1; i < cell_data.length; i++) {
      const weight = parseInt(cell_data[0]);
      const cost = parseInt(cell_data[i]);
      charts["DHL"][`zone${i}`].push([weight, cost]);
    }
  });
  const dhl_dates = {};
  const dhl_zone_keys = Object.keys(charts["DHL"]);
  dhl_zone_keys.forEach(dhl_zone_key => {
    dhl_dates[dhl_zone_key] = {};
    charts["DHL"][dhl_zone_key].forEach(t => dhl_dates[dhl_zone_key][t[0]] = 0);
  });
  current_data.forEach(e => {
    if (e.method == "DHL") {
      if (dhl_dates[e.zone][e.uptoweight_g] < e.costdate) {
        dhl_dates[e.zone][e.uptoweight_g] = e.costdate;
        for (let j = 0; j < charts["DHL"][e.zone].length; j++) {
          if (charts["DHL"][e.zone][j][0] == e.uptoweight_g) {
            charts["DHL"][e.zone][j][1] = e.cost;
          }
        }
      }
    }
  });

  // Add Surface mail premium price list, from SurfaceMail(Premium)20221028.csv
  // Load DB data to chart (since automatic loading of new data isn't possible)
  charts["Surface mail premium"] = {};
  const smp_data = (fs.readFileSync("./data/SurfaceMail(Premium)20221028.csv")).toString();
  row_separator = smp_data.indexOf('\r\n') >= 0 ? '\r\n' : '\n';
  const smp_row_data = smp_data.split(row_separator);
  smp_row_data.forEach((row, e) => {
    const cell_data = row.split(',');
    if (e == 0) {
      for (let i = 1; i < cell_data.length; i++) {
        charts["Surface mail premium"][`zone${i}`] = [];
      }
    }
    for (let i = 1; i < cell_data.length; i++) {
      const weight = parseInt(cell_data[0]);
      const cost = parseInt(cell_data[i]);
      charts["Surface mail premium"][`zone${i}`].push([weight, cost]);
    }
  });
  const smp_dates = {};
  const smp_zone_keys = Object.keys(charts["Surface mail premium"]);
  smp_zone_keys.forEach(smp_zone_key => {
    smp_dates[smp_zone_key] = {};
    charts["Surface mail premium"][smp_zone_key].forEach(t => smp_dates[smp_zone_key][t[0]] = 0);
  });
  current_data.forEach(e => {
    if (e.method == "Surface mail premium") {
      if (smp_dates[e.zone][e.uptoweight_g] < e.costdate) {
        smp_dates[e.zone][e.uptoweight_g] = e.costdate;
        for (let j = 0; j < charts["Surface mail premium"][e.zone].length; j++) {
          if (charts["Surface mail premium"][e.zone][j][0] == e.uptoweight_g) {
            charts["Surface mail premium"][e.zone][j][1] = e.cost;
          }
        }
      }
    }
  });

  // Generate difference output data
  const output = {};
  const new_data = [];
  const mkeys = Object.keys(charts);
  mkeys.forEach(mkey => {
    const zkeys = Object.keys(charts[mkey]);
    zkeys.forEach(zkey => {
      charts[mkey][zkey].forEach(value => {
        new_data.push({
          uptoweight_g: value[0],
          method: mkey,
          cost: value[1],
          zone: zkey
        });
      });
    });
  });
  const old_data = {};
  current_data.forEach(entry => {
    if (!(entry.method in old_data)) old_data[entry.method] = {};
    if (!(entry.zone in old_data[entry.method])) old_data[entry.method][entry.zone] = {};
    if (entry.uptoweight_g in old_data[entry.method][entry.zone]) {
      if (entry.costdate > old_data[entry.method][entry.zone][entry.uptoweight_g].costdate) {
        old_data[entry.method][entry.zone][entry.uptoweight_g].cost = entry.cost;
        old_data[entry.method][entry.zone][entry.uptoweight_g].costdate = entry.costdate;
      }
    } else {
      old_data[entry.method][entry.zone][entry.uptoweight_g] = {
        cost: entry.cost,
        costdate: entry.costdate
      };
    }
  });
  new_data.forEach(d => {
    if (!(d.method in output)) output[d.method] = {};
    if (!(d.zone in output[d.method])) output[d.method][d.zone] = [];

    let before_cost = 0;
    if (d.method in old_data && d.zone in old_data[d.method] && d.uptoweight_g in old_data[d.method][d.zone]) {
      before_cost = old_data[d.method][d.zone][d.uptoweight_g].cost;
    }

    output[d.method][d.zone].push({
      uptoweight_g: d.uptoweight_g,
      before_cost,
      current_cost: d.cost
    })
  });

  res.render('shipcost', {zone_labels, current_data, charts, output, online: true});
});

async function GetJPChart(link, table_id_array) {
  const output = [];
  const jp_data = await axios.get(link);
  const $ = cheerio.load(jp_data.data);
  
  for (let i = 0; i < table_id_array.length; i++) {
    const tbody = $('tr', `${table_id_array[i]}`);
    const index = output.length;
    output.push([]);

    for (let j = 1; j < tbody.length; j++) {
      const data = ["", ""];
      for (let k = 0; k < tbody[j].children.length; k++) {
        if (tbody[j].children[k].type == 'tag') {
          data[0] = data[1];
          data[1] = tbody[j].children[k].children[0].data;
        }
      }
      const weight = parseFloat(data[0].split(',').join('').split('Up to ').join('')) * (data[0].indexOf('kg') >= 0 ? 1000 : 1);// data[0] "Up to 1,500g"/"Up to 2.0kg"
      const cost = parseInt(data[1].split(',').join(''));// data[1] "1,000"/"1,000yen"
      output[index].push([weight, cost]);
    }
  }

  return output;
}

/*
----<  Small Packet

First Zone (Asia)
https://www.post.japanpost.jp/int/charge/list/normal1_en.html

Second Zone (Oceania, Canada, Central America, Middle East, Europe)
https://www.post.japanpost.jp/int/charge/list/normal2_en.html

Third Zone (South America and Africa)
https://www.post.japanpost.jp/int/charge/list/normal3_en.html

Fourth Zone (The United States (including overseas territories like Guam))
https://www.post.japanpost.jp/int/charge/list/normal4_en.html





----<  Air Small Packet Registered (AKA "epacket")
https://www.post.japanpost.jp/int/download/epacket-charges.pdf




----<  Parcel  (Air parcel zone 3 and 4 includes additional fee, not included in FM)

First Zone (China, South Korea, Taiwan)
https://www.post.japanpost.jp/int/charge/list/parcel1_en.html

Second Zone (Asia (excluding China, South Korea, Taiwan))
https://www.post.japanpost.jp/int/charge/list/parcel2_en.html

Third Zone (Oceania, North America (excluding the U.S.), Middle East, Europe)
https://www.post.japanpost.jp/int/charge/list/parcel3_en.html

Fourth Zone (U.S. (including Guam and other U.S. territories))
https://www.post.japanpost.jp/int/charge/list/parcel4_en.html

Fifth Zone (Central and South America (excluding Mexico), Africa)
https://www.post.japanpost.jp/int/charge/list/parcel5_en.html




----<  EMS  (EMS zone 3 and 4 includes additional fee, not included in FM)

First Zone (China, South Korea, Taiwan)
https://www.post.japanpost.jp/int/charge/list/ems1_en.html

Second Zone (Asia (excluding China, South Korea, Taiwan))
https://www.post.japanpost.jp/int/charge/list/ems2_en.html

Third Zone (Oceania, North America (excluding the U.S.), Middle East, Europe)
https://www.post.japanpost.jp/int/charge/list/ems3_en.html

Fourth Zone (U.S. (including Guam and other U.S. territories))
https://www.post.japanpost.jp/int/charge/list/ems4_en.html

Fifth Zone (Central and South America (excluding Mexico), Africa)
https://www.post.japanpost.jp/int/charge/list/ems5_en.html
*/

exports.upload = handle(async (req, res) => {
  const result = await service.saveManual(req.body.method, req.body.data_array);
  res.json({ ...result, status: result.unchanged ? 'Chart unchanged; no new version saved.' : `Saved a full chart (${result.rows} weights × ${result.columns} zones).` });
});

exports.view = handle(async (req, res) => {
  const { rows, versions } = await service.data();
  res.render('shipcostview', { labels: zoneLabels, data: rows, versions });
});
