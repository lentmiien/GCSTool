// Packages

// Database
const { Shipcost } = require('../sequelize');

//---------------------------------------------//
// exports.endpoints = (req, res, next) => {}; //
//---------------------------------------------//

exports.index = async (req, res) => {
  const current_data = await Shipcost.findAll();

  // Load online data

  // Generate output data

  res.render('shipcost', {});
};
  