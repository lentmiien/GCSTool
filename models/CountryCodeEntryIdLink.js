module.exports = (sequelize, type) => {
  return sequelize.define('CountryCodeEntryIdLink', {
    countryCode: type.STRING,
    cid: type.STRING,
  });
};
