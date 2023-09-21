module.exports = (sequelize, type) => {
  return sequelize.define('JapanPostCountryList', {
    cid: type.STRING,
    countryName: type.STRING,
    countryNameJ: type.STRING,
    airSmallPacketAvailability: type.INTEGER,
    SALSmallPacketAvailability: type.INTEGER,
    surfaceSmallPacketAvailability: type.INTEGER,
    airParcelAvailability: type.INTEGER,
    SALParcelAvailability: type.INTEGER,
    surfaceParcelAvailability: type.INTEGER,
    EMSAvailability: type.INTEGER,
  });
};
