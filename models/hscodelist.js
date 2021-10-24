module.exports = (sequelize, type) => {
  return sequelize.define('hscodelist', {
    name: type.STRING,
    code: type.STRING,
    uses: type.INTEGER,
  });
};
