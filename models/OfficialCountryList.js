module.exports = (sequelize, type) => {
  return sequelize.define('OfficialCountryList', {
    countryCode: type.STRING,
    countryName: type.STRING,
  });
};
