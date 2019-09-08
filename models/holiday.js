module.exports = (sequelize, type) => {
  return sequelize.define('holiday', {
    date: type.DATEONLY
  });
};
