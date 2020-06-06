module.exports = (sequelize, type) => {
  return sequelize.define('countrylist', {
    country_name: type.STRING,
    country_code: type.STRING,
    baseentry: type.BOOLEAN,
  });
};

/*

For the combination country_name:country_code there can
be as many many entries as necessary, which is used
for converting country_name to country_code.

If baseentry==true then all country_code needs to be unique,
used for converting country_code to country_name

*/
