module.exports = (sequelize, type) => {
  return sequelize.define('staff', {
    name: type.STRING,
    dayoff1: type.INTEGER,
    dayoff2: type.INTEGER
  });
};
