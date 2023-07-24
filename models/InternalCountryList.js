module.exports = (sequelize, type) => {
  return sequelize.define('InternalCountryList', {
    countryCode: type.STRING,
    countryName: type.STRING,
    countryNameJ: type.STRING,
    DHLAvailability: type.INTEGER,
    AITAvailability: type.INTEGER,
  });
};
