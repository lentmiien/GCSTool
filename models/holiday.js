module.exports = (sequelize, type) => {
  return sequelize.define('holiday', {
    name: type.DATEONLY
  });
};
