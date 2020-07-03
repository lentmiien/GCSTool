module.exports = (sequelize, type) => {
  return sequelize.define('staff', {
    name: type.STRING,
    dayoff1: type.INTEGER,
    dayoff2: type.INTEGER,

    // Group name
    // group: type.STRING,

    // Normal status per day (normal schedule)
    // nichi: type.STRING,
    // getu: type.STRING,
    // ka: type.STRING,
    // sui: type.STRING,
    // moku: type.STRING,
    // kin: type.STRING,
    // do: type.STRING,
  });
};
