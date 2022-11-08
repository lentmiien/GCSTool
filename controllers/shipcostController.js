// Packages
const fs = require("fs");
const parseString = require('xml2js').parseString;
const cheerio = require('cheerio');
const axios = require('axios').default;

// Database
const { Shipcost } = require('../sequelize');

//---------------------------------------------//
// exports.endpoints = (req, res, next) => {}; //
//---------------------------------------------//

exports.index = async (req, res) => {
  // Zone labels
  const zone_labels = {
    _4zones: [
      "First Zone; Asia",
      "Second Zone; Oceania, Canada, Central America, Middle East, Europe",
      "Third Zone; South America and Africa",
      "Fourth Zone; The United States (including overseas territories like Guam)"
    ],
    _5zones: [
      "First Zone; China, South Korea, Taiwan",
      "Second Zone; Asia (excluding China, South Korea, Taiwan)",
      "Third Zone; Oceania, North America (excluding the U.S.), Middle East, Europe",
      "Fourth Zone; U.S. (including Guam and other U.S. territories)",
      "Fifth Zone; Central and South America (excluding Mexico), Africa"
    ],
    _dhlzones: [
      "First-Third Zone; Asia",
      "Fourth Zone; India, Australia",
      "Fifth Zone; North America, Mexico",
      "Sixth Zone; Europe",
      "Seventh Zone; Russia, Ukraine",
      "Eight Zone; South America",
      "Nineth Zone; Africa, Middle East"
    ],
    _usaonly: [
      "The United States"
    ]
  };

  // Load database data
  const current_data = await Shipcost.findAll();

  // Load online data
  const charts = {};

  const sp_unreg_zone1 = await GetJPChart("https://www.post.japanpost.jp/int/charge/list/normal1_en.html", ["#t1-5", "#t3-2"]);
  const sp_unreg_zone2 = await GetJPChart("https://www.post.japanpost.jp/int/charge/list/normal2_en.html", ["#t1-5", "#t3-2"]);
  const sp_unreg_zone3 = await GetJPChart("https://www.post.japanpost.jp/int/charge/list/normal3_en.html", ["#t1-5", "#t3-2"]);
  const sp_unreg_zone4 = await GetJPChart("https://www.post.japanpost.jp/int/charge/list/normal4_en.html", ["#t1-5", "#t3-2"]);
  charts["Air small packet unregistered"] = {
    zone1: sp_unreg_zone1[0],
    zone2: sp_unreg_zone2[0],
    zone3: sp_unreg_zone3[0],
    zone4: sp_unreg_zone4[0]
  };
  charts["SAL small packet unregistered"] = {
    zone1: sp_unreg_zone1[1],
    zone2: sp_unreg_zone2[1],
    zone3: sp_unreg_zone3[1],
    zone4: sp_unreg_zone4[1]
  };
  // "SAL small packet registered" is unregistered prices + 410 JPY
  charts["SAL small packet registered"] = { zone1: [], zone2: [], zone3: [], zone4: [] };
  sp_unreg_zone1[1].forEach(entry => {
    const label = entry[0];
    const cost = entry[1];
    charts["SAL small packet registered"].zone1.push([label, cost+410]);
  });
  sp_unreg_zone2[1].forEach(entry => {
    const label = entry[0];
    const cost = entry[1];
    charts["SAL small packet registered"].zone2.push([label, cost+410]);
  });
  sp_unreg_zone3[1].forEach(entry => {
    const label = entry[0];
    const cost = entry[1];
    charts["SAL small packet registered"].zone3.push([label, cost+410]);
  });
  sp_unreg_zone4[1].forEach(entry => {
    const label = entry[0];
    const cost = entry[1];
    charts["SAL small packet registered"].zone4.push([label, cost+410]);
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

  // Air small packet registered (epacket)
  // https://www.post.japanpost.jp/int/download/epacket-charges.pdf
  // change to load DB data to chart (since automatic loading of new data isn't possible)
  charts["Air small packet registered"] = {
    zone1: [
      [ 100, 690 ],
      [ 200, 780 ],
      [ 300, 870 ],
      [ 400, 960 ],
      [ 500, 1050 ],
      [ 600, 1140 ],
      [ 700, 1230 ],
      [ 800, 1320 ],
      [ 900, 1410 ],
      [ 1000, 1500 ],
      [ 1100, 1590 ],
      [ 1200, 1680 ],
      [ 1300, 1770 ],
      [ 1400, 1860 ],
      [ 1500, 1950 ],
      [ 1600, 2040 ],
      [ 1700, 2130 ],
      [ 1800, 2220 ],
      [ 1900, 2310 ],
      [ 2000, 2400 ]
    ],
    zone2: [
      [ 100, 790 ],
      [ 200, 910 ],
      [ 300, 1030 ],
      [ 400, 1150 ],
      [ 500, 1270 ],
      [ 600, 1390 ],
      [ 700, 1510 ],
      [ 800, 1630 ],
      [ 900, 1750 ],
      [ 1000, 1870 ],
      [ 1100, 1990 ],
      [ 1200, 2110 ],
      [ 1300, 2230 ],
      [ 1400, 2350 ],
      [ 1500, 2470 ],
      [ 1600, 2590 ],
      [ 1700, 2710 ],
      [ 1800, 2830 ],
      [ 1900, 2950 ],
      [ 2000, 3070 ]
    ],
    zone3: [
      [ 100, 820 ],
      [ 200, 1000 ],
      [ 300, 1180 ],
      [ 400, 1360 ],
      [ 500, 1540 ],
      [ 600, 1720 ],
      [ 700, 1900 ],
      [ 800, 2080 ],
      [ 900, 2260 ],
      [ 1000, 2440 ],
      [ 1100, 2620 ],
      [ 1200, 2800 ],
      [ 1300, 2980 ],
      [ 1400, 3160 ],
      [ 1500, 3340 ],
      [ 1600, 3520 ],
      [ 1700, 3700 ],
      [ 1800, 3880 ],
      [ 1900, 4060 ],
      [ 2000, 4240 ]
    ],
    zone4: [
      [ 100, 1150 ],
      [ 200, 1280 ],
      [ 300, 1410 ],
      [ 400, 1540 ],
      [ 500, 1670 ],
      [ 600, 1800 ],
      [ 700, 1930 ],
      [ 800, 2060 ],
      [ 900, 2190 ],
      [ 1000, 2320 ],
      [ 1100, 2450 ],
      [ 1200, 2580 ],
      [ 1300, 2710 ],
      [ 1400, 2840 ],
      [ 1500, 2970 ],
      [ 1600, 3100 ],
      [ 1700, 3230 ],
      [ 1800, 3360 ],
      [ 1900, 3490 ],
      [ 2000, 3620 ]
    ]
  };
  const aspr_dates = {
    zone1: {
      100: 0,
      200: 0,
      300: 0,
      400: 0,
      500: 0,
      600: 0,
      700: 0,
      800: 0,
      900: 0,
      1000: 0,
      1100: 0,
      1200: 0,
      1300: 0,
      1400: 0,
      1500: 0,
      1600: 0,
      1700: 0,
      1800: 0,
      1900: 0,
      2000: 0
    },
    zone2: {
      100: 0,
      200: 0,
      300: 0,
      400: 0,
      500: 0,
      600: 0,
      700: 0,
      800: 0,
      900: 0,
      1000: 0,
      1100: 0,
      1200: 0,
      1300: 0,
      1400: 0,
      1500: 0,
      1600: 0,
      1700: 0,
      1800: 0,
      1900: 0,
      2000: 0
    },
    zone3: {
      100: 0,
      200: 0,
      300: 0,
      400: 0,
      500: 0,
      600: 0,
      700: 0,
      800: 0,
      900: 0,
      1000: 0,
      1100: 0,
      1200: 0,
      1300: 0,
      1400: 0,
      1500: 0,
      1600: 0,
      1700: 0,
      1800: 0,
      1900: 0,
      2000: 0
    },
    zone4: {
      100: 0,
      200: 0,
      300: 0,
      400: 0,
      500: 0,
      600: 0,
      700: 0,
      800: 0,
      900: 0,
      1000: 0,
      1100: 0,
      1200: 0,
      1300: 0,
      1400: 0,
      1500: 0,
      1600: 0,
      1700: 0,
      1800: 0,
      1900: 0,
      2000: 0
    }
  };
  current_data.forEach(e => {
    if (e.method == "Air small packet registered") {
      if (aspr_dates[e.zone][e.uptoweight_g] < e.costdate) {
        aspr_dates[e.zone][e.uptoweight_g] = e.costdate;
        for (let j = 0; j < charts["Air small packet registered"][e.zone].length; j++) {
          if (charts["Air small packet registered"][e.zone][j][0] == e.uptoweight_g) {
            charts["Air small packet registered"][e.zone][j][1] = e.cost;
          }
        }
      }
    }
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

  res.render('shipcost', {zone_labels, current_data, charts, output});
};

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

exports.upload = async (req, res) => {
  // POST request
  // body: {method, data_array} *data_array is array of entries of same format as DB
  // load DB data
  const current_data = await Shipcost.findAll({where:{method:req.body.method}});
  // loop through input array and put updated data entries in a save_array
  const save_array = [];
  req.body.data_array.forEach(e => {
    const current_values = {
      // uptoweight_g: type.INTEGER,
      // method: type.STRING,
      cost: 0,
      costdate: 0,
      // zone: type.STRING
    };
    for (let i = 0; i < current_data.length; i++) {
      if (e.uptoweight_g == current_data[i].uptoweight_g && e.zone == current_data[i].zone) {
        if (current_values.costdate < current_data[i].costdate) {
          current_values.cost = current_data[i].cost;
          current_values.costdate = current_data[i].costdate;
        }
      }
    }
    if (current_values.cost != e.cost) {
      save_array.push(e);
    }
  });
  // save save_array to DB
  await Shipcost.bulkCreate(save_array);

  res.json({status: `Saved ${save_array.length} entries`});
};

exports.view = async (req, res) => {
  // Zone labels
  const zone_labels = {
    _4zones: [
      "Asia",
      "Oceania, Canada, Central America, Middle East, Europe",
      "South America and Africa",
      "The United States (including overseas territories like Guam)"
    ],
    _5zones: [
      "China, South Korea, Taiwan",
      "Asia (excluding China, South Korea, Taiwan)",
      "Oceania, North America (excluding the U.S.), Middle East, Europe",
      "U.S. (including Guam and other U.S. territories)",
      "Central and South America (excluding Mexico), Africa"
    ],
    _dhlzones: [
      "Asia",
      "India, Australia",
      "North America, Mexico",
      "Europe",
      "Russia, Ukraine",
      "South America",
      "Africa, Middle East"
    ],
    _usaonly: [
      "The United States"
    ]
  };

  // Load database data
  const current_data = await Shipcost.findAll();

  res.render('shipcostview', {labels: zone_labels, data: current_data});
};
